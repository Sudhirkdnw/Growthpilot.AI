import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { inventoryService } from '../inventory/inventory.service';
import { invoiceSequenceService } from './invoice-sequence.service';
import { settingsService } from '../settings/settings.service';
import { auditService } from '../audit/audit.service';
import { CreateSaleSchema, SaleQuerySchema } from '../../../shared/schemas';
import {
  SaleSummaryDTO,
  SaleDetailDTO,
  PaginatedResult,
} from '../../../shared/types';
import {
  roundQuantity,
  roundMoney,
  validateQuantity,
  normalizeQuantity,
  compareQuantities,
} from '../../../shared/utils/quantity';

export class SaleService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Deterministic calculations for POS line items, subtotals, taxes, discounts, change, and due balance.
   */
  calculateSaleTotals(
    items: {
      productId: string;
      quantity: number;
      sellingPrice: number;
      discount?: number;
      taxRate?: number;
    }[],
    globalDiscount = 0,
    orderTax = 0,
    paidAmount = 0,
    paymentMethod = 'CASH'
  ) {
    let subtotal = 0;
    let totalItemDiscounts = 0;
    let totalTaxAmount = 0;

    const processedItems = items.map((item) => {
      const quantity = roundQuantity(Number(item.quantity), 4);
      const sellingPrice = roundMoney(Number(item.sellingPrice));
      const discount = roundMoney(Number(item.discount || 0));
      const taxRate = Number(item.taxRate || 0);

      const lineGross = roundMoney(quantity * sellingPrice);
      const taxable = Math.max(0, roundMoney(lineGross - discount));
      const lineTax = roundMoney(taxable * (taxRate / 100));
      const lineTotal = roundMoney(taxable + lineTax);

      subtotal += taxable;
      totalItemDiscounts += discount;
      totalTaxAmount += lineTax;

      return {
        productId: item.productId,
        quantity,
        sellingPrice,
        discount,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
      };
    });

    const netSubtotal = roundMoney(subtotal);
    const finalDiscount = roundMoney(totalItemDiscounts + Number(globalDiscount || 0));
    const finalTax = roundMoney(totalTaxAmount + Number(orderTax || 0));
    const grandTotal = Math.max(0, roundMoney(netSubtotal + finalTax - Number(globalDiscount || 0)));

    const paid = roundMoney(Number(paidAmount || 0));
    const dueAmount = Math.max(0, roundMoney(grandTotal - paid));
    const changeAmount =
      paymentMethod === 'CASH' && paid > grandTotal
        ? roundMoney(paid - grandTotal)
        : 0;

    return {
      items: processedItems,
      subtotal: netSubtotal,
      discount: finalDiscount,
      tax: finalTax,
      total: grandTotal,
      paidAmount: paid,
      dueAmount,
      changeAmount,
    };
  }

  /**
   * Executes the critical atomic POS sale transaction through the serialized write queue.
   * Guarantees all operations succeed or 100% rolls back.
   */
  async createSale(
    input: z.input<typeof CreateSaleSchema>,
    userId?: string
  ): Promise<SaleDetailDTO> {
    const validated = CreateSaleSchema.parse(input);

    // 1. Fetch products and lock validation
    const productIds = validated.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { unit: true },
    });

    if (products.length !== productIds.length) {
      throw new Error('One or more products in cart were not found.');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Validate product status, unit compatibility & negative stock policy
    const settings = await settingsService.getAppSettings();
    const stockPolicy = settings.pos?.negativeStockPolicy || 'BLOCK';

    for (const item of validated.items) {
      const product = productMap.get(item.productId)!;
      if (product.status !== 'ACTIVE') {
        throw new Error(`Product "${product.name}" is inactive and cannot be sold.`);
      }

      // Unit conversion if compatible unitCode provided
      if (item.unitCode && product.unit) {
        try {
          item.quantity = normalizeQuantity(item.quantity, item.unitCode, product.unit.shortCode);
        } catch (err: any) {
          throw new Error(`Unit validation failed for "${product.name}": ${err?.message}`);
        }
      }

      // Validate decimal permissions & precision
      const qVal = validateQuantity(item.quantity, {
        allowDecimal: product.unit?.allowDecimal,
        precision: product.unit?.precision,
        unitCode: product.unit?.shortCode,
      });
      if (!qVal.valid) {
        throw new Error(`Invalid quantity for "${product.name}": ${qVal.error}`);
      }

      const currentStock = roundQuantity(Number(product.currentStock), 4);
      if (compareQuantities(item.quantity, currentStock) > 0) {
        if (stockPolicy === 'BLOCK') {
          throw new Error(
            `Negative Stock Policy Violation: Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${item.quantity}. Policy blocks negative stock.`
          );
        } else if (stockPolicy === 'ALLOW_WITH_WARNING' && !validated.allowNegativeStockOverride) {
          throw new Error(
            `Negative Stock Warning: Sale will reduce stock for "${product.name}" below zero (${currentStock - item.quantity} units). Please confirm override to proceed.`
          );
        }
      }
    }

    // 3. Customer validation
    let customer: any = null;
    if (validated.customerId) {
      customer = await this.prisma.customer.findUnique({
        where: { id: validated.customerId },
      });
      if (!customer) {
        throw new Error(`Customer with ID ${validated.customerId} not found.`);
      }
      if (customer.status === 'INACTIVE') {
        throw new Error(`Customer "${customer.name}" is inactive.`);
      }
    }

    // 4. Calculate deterministic totals
    const calc = this.calculateSaleTotals(
      validated.items,
      validated.discount,
      validated.tax,
      validated.paidAmount,
      validated.paymentMethod
    );

    // Validate non-cash overpayment
    if (validated.paymentMethod !== 'CASH' && calc.paidAmount > calc.total) {
      throw new Error(
        `Overpayment is only supported for cash transactions. Paid amount (₹${calc.paidAmount.toFixed(2)}) exceeds grand total (₹${calc.total.toFixed(2)}).`
      );
    }

    // Validate credit sale rules
    if (calc.dueAmount > 0 && !validated.customerId) {
      throw new Error(
        'Credit sale (unpaid due balance) requires a registered customer. Walk-in Cash Customer must pay in full.'
      );
    }

    // 5. Atomic Execution via Write Queue
    return await executeWriteTransaction(async (tx) => {
      // Re-verify stock inside write transaction lock to eliminate concurrency race conditions
      for (const item of calc.items) {
        const prod = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true, currentStock: true },
        });
        if (!prod) throw new Error(`Product not found: ${item.productId}`);
        const currentStockInTx = roundQuantity(Number(prod.currentStock), 4);
        if (compareQuantities(item.quantity, currentStockInTx) > 0) {
          if (stockPolicy === 'BLOCK') {
            throw new Error(
              `Negative Stock Policy Violation: Insufficient stock for "${prod.name}". Available: ${currentStockInTx}, Requested: ${item.quantity}. Policy blocks negative stock.`
            );
          } else if (stockPolicy === 'ALLOW_WITH_WARNING' && !validated.allowNegativeStockOverride) {
            throw new Error(
              `Negative Stock Warning: Sale will reduce stock for "${prod.name}" below zero (${currentStockInTx - item.quantity} units). Please confirm override to proceed.`
            );
          }
        }
      }

      // Generate safe unique invoice number
      const invoiceNumber = await invoiceSequenceService.getNextInvoiceNumber(tx, 'SALE_INVOICE');

      // Prepare items capturing HISTORICAL cost price
      const saleItemsToCreate = calc.items.map((item) => {
        const product = productMap.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          costPrice: Number(product.purchasePrice), // CAPTURED HISTORICAL COST
          discount: item.discount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
        };
      });

      // Create Sale Header & Items
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: validated.customerId || null,
          subtotal: calc.subtotal,
          discount: calc.discount,
          tax: calc.tax,
          grandTotal: calc.total,
          paidAmount: calc.paidAmount,
          dueAmount: calc.dueAmount,
          paymentMethod: validated.paymentMethod,
          status: 'POSTED',
          notes: validated.notes?.trim() || null,
          items: {
            create: saleItemsToCreate,
          },
          payments: {
            create: [
              {
                amount: calc.paidAmount,
                paymentMethod: validated.paymentMethod,
                reference: validated.notes?.trim() || null,
                gatewayProvider: validated.gatewayProvider || null,
                providerOrderId: validated.providerOrderId || null,
                providerPaymentId: validated.providerPaymentId || null,
                paymentAttemptId: validated.paymentAttemptId || null,
              },
            ],
          },
        },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
          payments: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      // Authoritative inventory stock deduction
      for (const item of calc.items) {
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'SALE',
          referenceId: sale.id,
          quantityChange: -item.quantity, // Negative for reduction
          notes: `POS Sale Invoice ${invoiceNumber}`,
        });
      }

      // Update customer ledger & balance if credit
      if (calc.dueAmount > 0 && customer) {
        const prevBal = Number(customer.currentBalance);
        const newBal = Math.round((prevBal + calc.dueAmount) * 100) / 100;

        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newBal },
        });

        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: 'INVOICE',
            referenceId: sale.id,
            debit: calc.dueAmount, // Increases receivable owed
            credit: 0,
            balance: newBal,
            notes: `Credit Sale Invoice ${invoiceNumber}`,
          },
        });
      }

      // Record audit log
      await auditService.log(
        {
          userId,
          action: 'SALE_CREATED',
          entityType: 'Sale',
          entityId: sale.id,
          newValue: {
            invoiceNumber,
            grandTotal: calc.total,
            paidAmount: calc.paidAmount,
            dueAmount: calc.dueAmount,
            changeAmount: calc.changeAmount,
            itemCount: calc.items.length,
          },
          reason: `Completed POS sale ${invoiceNumber}`,
        },
        tx
      );

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customer?.name || 'Cash Customer',
        saleDate: sale.createdAt.toISOString(),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.grandTotal),
        paidAmount: Number(sale.paidAmount),
        dueAmount: Number(sale.dueAmount),
        paymentMethod: sale.paymentMethod as any,
        status: sale.status as any,
        itemCount: sale.items.length,
        notes: sale.notes,
        items: sale.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product?.name || 'Unknown Product',
          sku: i.product?.sku || 'UNKNOWN',
          quantity: Number(i.quantity),
          sellingPrice: Number(i.sellingPrice),
          costPrice: Number(i.costPrice),
          discount: Number(i.discount),
          taxRate: Number(i.taxRate),
          lineTotal: Number(i.lineTotal),
        })),
        payments: sale.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod as any,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    });
  }

  /**
   * Retrieves complete sale details by ID with items, historical cost, and customer.
   */
  async getSaleById(id: string): Promise<SaleDetailDTO> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        payments: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!sale) {
      throw new Error(`Sale with ID ${id} not found.`);
    }

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.customer?.name || 'Cash Customer',
      saleDate: sale.createdAt.toISOString(),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.grandTotal),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      paymentMethod: sale.paymentMethod as any,
      status: sale.status as any,
      itemCount: sale.items.length,
      notes: sale.notes,
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name || 'Unknown Product',
        sku: i.product?.sku || 'UNKNOWN',
        quantity: Number(i.quantity),
        sellingPrice: Number(i.sellingPrice),
        costPrice: Number(i.costPrice),
        discount: Number(i.discount),
        taxRate: Number(i.taxRate),
        lineTotal: Number(i.lineTotal),
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod as any,
        reference: p.reference,
        gatewayProvider: (p.gatewayProvider as any) || null,
        providerOrderId: p.providerOrderId,
        providerPaymentId: p.providerPaymentId,
        paymentAttemptId: p.paymentAttemptId,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Lists historical sales with search, customer, payment method, date, and status filtering.
   */
  async listSales(
    params: z.input<typeof SaleQuerySchema>
  ): Promise<PaginatedResult<SaleSummaryDTO>> {
    const validated = SaleQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.paymentMethod && validated.paymentMethod !== 'ALL') {
      where.paymentMethod = validated.paymentMethod;
    }

    if (validated.customerId) {
      where.customerId = validated.customerId;
    }

    if (validated.startDate || validated.endDate) {
      where.createdAt = {};
      if (validated.startDate) where.createdAt.gte = new Date(validated.startDate);
      if (validated.endDate) where.createdAt.lte = new Date(validated.endDate);
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { phone: { contains: q } } },
        { notes: { contains: q } },
      ];
    }

    if (validated.userId) {
      const ownLogs = await this.prisma.auditLog.findMany({
        where: {
          action: 'SALE_CREATED',
          userId: validated.userId,
          entityType: 'Sale',
        },
        select: { entityId: true },
      });
      const saleIds = ownLogs.map((l) => l.entityId).filter(Boolean) as string[];
      where.id = { in: saleIds };
    }


    const skip = (validated.page - 1) * validated.pageSize;

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    const data: SaleSummaryDTO[] = sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customer?.name || 'Cash Customer',
      saleDate: s.createdAt.toISOString(),
      total: Number(s.grandTotal),
      paidAmount: Number(s.paidAmount),
      dueAmount: Number(s.dueAmount),
      paymentMethod: s.paymentMethod as any,
      status: s.status as any,
      itemCount: s._count.items,
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
   * Safely cancels a sale: marks status CANCELLED, reverses inventory via RETURN_IN,
   * reverses customer debt balance if credit sale, and records audit log.
   */
  async cancelSale(id: string, reason: string, userId?: string): Promise<SaleDetailDTO> {
    if (!reason || reason.trim().length < 3) {
      throw new Error('A cancellation reason of at least 3 characters is required.');
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!sale) {
      throw new Error(`Sale with ID ${id} not found.`);
    }

    if (sale.status === 'CANCELLED') {
      throw new Error(`Sale ${sale.invoiceNumber} is already CANCELLED.`);
    }

    await executeWriteTransaction(async (tx) => {
      // 1. Mark status CANCELLED
      await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: sale.notes
            ? `${sale.notes}\n[CANCELLED: ${reason.trim()}]`
            : `[CANCELLED: ${reason.trim()}]`,
        },
      });

      // 2. Reverse stock deducted
      for (const item of sale.items) {
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'RETURN_IN',
          referenceId: sale.id,
          quantityChange: Number(item.quantity), // Positive for restoration
          notes: `Reversal of cancelled sale ${sale.invoiceNumber}: ${reason.trim()}`,
        });
      }

      // 3. Reverse customer balance if credit due
      const dueAmount = Number(sale.dueAmount);
      if (sale.customerId && dueAmount > 0 && sale.customer) {
        const prevBal = Number(sale.customer.currentBalance);
        const newBal = Math.max(0, Math.round((prevBal - dueAmount) * 100) / 100);

        await tx.customerLedger.create({
          data: {
            customerId: sale.customerId,
            type: 'ADJUSTMENT',
            referenceId: sale.id,
            credit: dueAmount, // Decreases receivable
            debit: 0,
            balance: newBal,
            notes: `Reversal of cancelled sale ${sale.invoiceNumber}: ${reason.trim()}`,
          },
        });

        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: newBal },
        });
      }

      // 4. Audit log
      await auditService.log(
        {
          userId,
          action: 'SALE_CANCELLED',
          entityType: 'Sale',
          entityId: sale.id,
          oldValue: { status: sale.status },
          newValue: { status: 'CANCELLED', reason: reason.trim() },
          reason: `Cancelled sale ${sale.invoiceNumber}: ${reason.trim()}`,
        },
        tx
      );
    });

    return await this.getSaleById(id);
  }
}

export const saleService = new SaleService();
