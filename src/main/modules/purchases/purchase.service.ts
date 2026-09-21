import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import { inventoryService } from '../inventory/inventory.service';
import { invoiceSequenceService } from '../sales/invoice-sequence.service';
import { CreatePurchaseSchema, PurchaseQuerySchema } from '../../../shared/schemas';
import {
  PurchaseSummaryDTO,
  PurchaseDetailDTO,
  PaginatedResult,
} from '../../../shared/types';

export class PurchaseService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Deterministic calculations for purchase items, subtotal, taxes, discounts, and grand totals.
   */
  calculatePurchaseTotals(
    items: {
      productId: string;
      quantity: number;
      purchasePrice: number;
      discount?: number;
      taxRate?: number;
    }[],
    globalDiscount = 0,
    orderTax = 0
  ) {
    let subtotal = 0;
    let totalItemDiscounts = 0;
    let totalTaxAmount = 0;

    const processedItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const purchasePrice = Number(item.purchasePrice);
      const discount = Number(item.discount || 0);
      const taxRate = Number(item.taxRate || 0);

      const lineGross = quantity * purchasePrice;
      const taxable = Math.max(0, lineGross - discount);
      const lineTax = Math.round(taxable * (taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + lineTax) * 100) / 100;

      subtotal += lineGross;
      totalItemDiscounts += discount;
      totalTaxAmount += lineTax;

      return {
        productId: item.productId,
        quantity,
        purchasePrice,
        discount,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
      };
    });

    const netSubtotal = Math.round(subtotal * 100) / 100;
    const finalDiscount = Math.round((totalItemDiscounts + Number(globalDiscount || 0)) * 100) / 100;
    const finalTax = Math.round((totalTaxAmount + Number(orderTax || 0)) * 100) / 100;
    const grandTotal = Math.max(0, Math.round((subtotal - finalDiscount + finalTax) * 100) / 100);

    return {
      items: processedItems,
      subtotal: netSubtotal,
      discount: finalDiscount,
      tax: finalTax,
      total: grandTotal,
    };
  }

  /**
   * Creates a purchase order inside a single atomic database transaction.
   * Atomically updates:
   * 1. Sequence numbering (PURCHASE_BILL)
   * 2. Purchases & PurchaseItems
   * 3. PurchasePayments (if paidAmount > 0)
   * 4. Product stock + StockLedger (PURCHASE)
   * 5. Supplier ledger & outstanding balance (if credit / registered supplier)
   * 6. AuditLog
   */
  async createPurchase(
    input: z.input<typeof CreatePurchaseSchema>,
    userId?: string
  ): Promise<PurchaseDetailDTO> {
    const validated = CreatePurchaseSchema.parse(input);

    // 1. Supplier Validation
    let supplier: any = null;
    if (validated.supplierId) {
      supplier = await this.prisma.supplier.findUnique({
        where: { id: validated.supplierId },
      });
      if (!supplier) {
        throw new Error(`Supplier with ID ${validated.supplierId} does not exist.`);
      }
      if (supplier.status === 'INACTIVE') {
        throw new Error(`Supplier "${supplier.name}" is INACTIVE. Cannot process new purchases.`);
      }
    }

    // 2. Product Validation
    const productIds = validated.items.map((i) => i.productId);
    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, status: true },
    });

    if (existingProducts.length !== productIds.length) {
      const foundIds = new Set(existingProducts.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new Error(`One or more products do not exist: ${missing.join(', ')}`);
    }

    const inactiveProducts = existingProducts.filter((p) => p.status === 'INACTIVE');
    if (inactiveProducts.length > 0) {
      throw new Error(
        `Cannot purchase inactive product(s): ${inactiveProducts.map((p) => p.name).join(', ')}`
      );
    }

    // 3. Calculation & Validation
    const calc = this.calculatePurchaseTotals(
      validated.items,
      validated.discount,
      validated.tax
    );

    const paidAmount = Math.round(Number(validated.paidAmount || 0) * 100) / 100;
    if (paidAmount < 0) {
      throw new Error('Paid amount cannot be negative.');
    }
    if (paidAmount > calc.total) {
      throw new Error(
        `Overpayment rejected: Paid amount (₹${paidAmount.toFixed(2)}) exceeds grand total (₹${calc.total.toFixed(2)}).`
      );
    }

    const dueAmount = Math.round((calc.total - paidAmount) * 100) / 100;

    // Credit purchases strictly require a registered supplier (PRD Section 12.2 / 16)
    if (dueAmount > 0 && !validated.supplierId) {
      throw new Error(
        'Credit purchases require an active, registered supplier. Cash Supplier cannot hold an outstanding debt balance.'
      );
    }

    // 4. Atomic Execution via Write Queue
    return await executeWriteTransaction(async (tx) => {
      // Generate unique sequential purchase bill number
      const purchaseNumber =
        validated.purchaseNumber?.trim() ||
        (await invoiceSequenceService.getNextInvoiceNumber(tx, 'PURCHASE_BILL'));

      // Insert Purchase Header
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: validated.supplierId || null,
          purchaseDate: new Date(),
          subtotal: calc.subtotal,
          discount: calc.discount,
          tax: calc.tax,
          total: calc.total,
          paidAmount,
          dueAmount,
          paymentMethod: validated.paymentMethod,
          status: 'POSTED',
          notes: validated.notes?.trim() || null,
        },
      });

      // Insert Purchase Items & Update Stock atomically
      const itemsDTO = [];
      for (const item of calc.items) {
        const prod = existingProducts.find((p) => p.id === item.productId)!;

        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          },
        });

        // Authoritative stock movement (increases inventory + writes stock_ledger)
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'PURCHASE',
          referenceId: purchase.id,
          quantityChange: item.quantity,
          notes: `Purchase Bill ${purchaseNumber} from ${supplier?.name || 'Cash Supplier'}`,
        });

        itemsDTO.push({
          id: purchaseItem.id,
          productId: item.productId,
          productName: prod.name,
          sku: prod.sku,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          discount: item.discount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
        });
      }

      // Record Purchase Payment if paidAmount > 0
      const paymentsDTO = [];
      if (paidAmount > 0) {
        const payment = await tx.purchasePayment.create({
          data: {
            purchaseId: purchase.id,
            amount: paidAmount,
            paymentMethod: validated.paymentMethod,
          },
        });
        paymentsDTO.push({
          id: payment.id,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod as any,
          createdAt: payment.createdAt.toISOString(),
        });
      }

      // If registered supplier: update supplier ledger & payable balance
      if (supplier) {
        const prevBal = Number(supplier.currentBalance);
        const newBal = Math.round((prevBal + dueAmount) * 100) / 100;

        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: 'PURCHASE',
            referenceId: purchase.id,
            credit: calc.total,
            debit: paidAmount,
            balance: newBal,
            notes: `Purchase Bill ${purchaseNumber} (Total: ₹${calc.total.toFixed(2)}, Paid: ₹${paidAmount.toFixed(2)})`,
          },
        });

        await tx.supplier.update({
          where: { id: supplier.id },
          data: { currentBalance: newBal },
        });
      }

      // Audit Log
      await auditService.log(
        {
          userId,
          action: 'PURCHASE_CREATED',
          entityType: 'Purchase',
          entityId: purchase.id,
          newValue: {
            purchaseNumber,
            supplierId: supplier?.id || null,
            supplierName: supplier?.name || 'Cash Supplier',
            total: calc.total,
            paidAmount,
            dueAmount,
            itemCount: calc.items.length,
          },
          reason: `Created purchase ${purchaseNumber}`,
        },
        tx
      );

      return {
        id: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        supplierId: purchase.supplierId,
        supplierName: supplier?.name || 'Cash Supplier',
        purchaseDate: purchase.purchaseDate.toISOString(),
        subtotal: Number(purchase.subtotal),
        discount: Number(purchase.discount),
        tax: Number(purchase.tax),
        total: Number(purchase.total),
        paidAmount: Number(purchase.paidAmount),
        dueAmount: Number(purchase.dueAmount),
        paymentMethod: purchase.paymentMethod as any,
        status: purchase.status as any,
        itemCount: itemsDTO.length,
        notes: purchase.notes,
        items: itemsDTO,
        payments: paymentsDTO,
        createdAt: purchase.createdAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves a single purchase by ID with items, products, and payments.
   */
  async getPurchaseById(id: string): Promise<PurchaseDetailDTO> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: true,
      },
    });

    if (!purchase) {
      throw new Error(`Purchase with ID ${id} not found.`);
    }

    return {
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name || 'Cash Supplier',
      purchaseDate: purchase.purchaseDate.toISOString(),
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      total: Number(purchase.total),
      paidAmount: Number(purchase.paidAmount),
      dueAmount: Number(purchase.dueAmount),
      paymentMethod: purchase.paymentMethod as any,
      status: purchase.status as any,
      itemCount: purchase.items.length,
      notes: purchase.notes,
      items: purchase.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name || 'Unknown Product',
        sku: i.product?.sku || 'UNKNOWN',
        quantity: Number(i.quantity),
        purchasePrice: Number(i.purchasePrice),
        discount: Number(i.discount),
        taxRate: Number(i.taxRate),
        taxAmount: Number(i.taxAmount),
        lineTotal: Number(i.lineTotal),
      })),
      payments: purchase.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod as any,
        createdAt: p.createdAt.toISOString(),
      })),
      createdAt: purchase.createdAt.toISOString(),
    };
  }

  /**
   * Lists paginated purchase bills with search and status filtering.
   */
  async listPurchases(
    params: z.input<typeof PurchaseQuerySchema>
  ): Promise<PaginatedResult<PurchaseSummaryDTO>> {
    const validated = PurchaseQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.supplierId) {
      where.supplierId = validated.supplierId;
    }

    if (validated.startDate || validated.endDate) {
      where.purchaseDate = {};
      if (validated.startDate) {
        where.purchaseDate.gte = new Date(validated.startDate);
      }
      if (validated.endDate) {
        where.purchaseDate.lte = new Date(validated.endDate);
      }
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { purchaseNumber: { contains: q } },
        { notes: { contains: q } },
        { supplier: { name: { contains: q } } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { purchaseDate: 'desc' },
        include: {
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const data: PurchaseSummaryDTO[] = purchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplierId: p.supplierId,
      supplierName: p.supplier?.name || 'Cash Supplier',
      purchaseDate: p.purchaseDate.toISOString(),
      subtotal: Number(p.subtotal),
      discount: Number(p.discount),
      tax: Number(p.tax),
      total: Number(p.total),
      paidAmount: Number(p.paidAmount),
      dueAmount: Number(p.dueAmount),
      paymentMethod: p.paymentMethod as any,
      status: p.status as any,
      itemCount: p._count.items,
      createdAt: p.createdAt.toISOString(),
    }));

    return {
      data,
      total,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Safely cancels a purchase.
   * Non-destructive reversal:
   * - Marks status CANCELLED
   * - Deducts received stock via ADJUSTMENT_OUT
   * - Reverses supplier balance if credit was involved
   * - Leaves original historical records intact with audit logging
   */
  async cancelPurchase(id: string, reason: string, userId?: string): Promise<PurchaseDetailDTO> {
    if (!reason || reason.trim().length < 3) {
      throw new Error('A valid cancellation reason of at least 3 characters is required.');
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!purchase) {
      throw new Error(`Purchase with ID ${id} not found.`);
    }

    if (purchase.status === 'CANCELLED') {
      throw new Error(`Purchase ${purchase.purchaseNumber} is already CANCELLED.`);
    }

    await executeWriteTransaction(async (tx) => {
      // 1. Mark status CANCELLED
      await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: purchase.notes
            ? `${purchase.notes}\n[CANCELLED: ${reason.trim()}]`
            : `[CANCELLED: ${reason.trim()}]`,
        },
      });

      // 2. Reverse stock received
      for (const item of purchase.items) {
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'ADJUSTMENT_OUT',
          referenceId: purchase.id,
          quantityChange: -Number(item.quantity),
          notes: `Reversal of cancelled purchase ${purchase.purchaseNumber}: ${reason.trim()}`,
        });
      }

      // 3. Reverse supplier ledger & balance if dueAmount > 0
      const dueAmount = Number(purchase.dueAmount);
      if (purchase.supplierId && dueAmount > 0 && purchase.supplier) {
        const prevBal = Number(purchase.supplier.currentBalance);
        const newBal = Math.round((prevBal - dueAmount) * 100) / 100;

        await tx.supplierLedger.create({
          data: {
            supplierId: purchase.supplierId,
            type: 'ADJUSTMENT',
            referenceId: purchase.id,
            debit: dueAmount,
            credit: 0,
            balance: newBal,
            notes: `Reversal of cancelled purchase ${purchase.purchaseNumber}: ${reason.trim()}`,
          },
        });

        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { currentBalance: newBal },
        });
      }

      // 4. Audit log
      await auditService.log(
        {
          userId,
          action: 'PURCHASE_CANCELLED',
          entityType: 'Purchase',
          entityId: purchase.id,
          oldValue: { status: purchase.status },
          newValue: { status: 'CANCELLED', reason: reason.trim() },
          reason: `Cancelled purchase ${purchase.purchaseNumber}: ${reason.trim()}`,
        },
        tx
      );
    });

    return await this.getPurchaseById(id);
  }
}

export const purchaseService = new PurchaseService();
