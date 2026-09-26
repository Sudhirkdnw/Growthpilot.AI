import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { inventoryService } from '../inventory/inventory.service';
import { invoiceSequenceService } from '../sales/invoice-sequence.service';
import { settingsService } from '../settings/settings.service';
import { auditService } from '../audit/audit.service';
import { CreatePurchaseReturnSchema, PurchaseReturnQuerySchema } from '../../../shared/schemas';
import {
  PurchaseReturnableDetailsDTO,
  ReturnablePurchaseItemDTO,
  PurchaseReturnSummaryDTO,
  PurchaseReturnDetailDTO,
  PaginatedResult,
} from '../../../shared/types';
import { roundQuantity, compareQuantities } from '../../../shared/utils/quantity';

export class PurchaseReturnService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves purchase details with itemized returnable quantities and current stock.
   */
  async getPurchaseReturnableDetails(purchaseIdOrNumber: string): Promise<PurchaseReturnableDetailsDTO> {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        OR: [{ id: purchaseIdOrNumber }, { purchaseNumber: purchaseIdOrNumber }],
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
        returns: {
          where: { status: 'POSTED' },
          include: { items: true },
        },
      },
    });

    if (!purchase) {
      throw new Error(`Purchase order "${purchaseIdOrNumber}" not found.`);
    }

    // Aggregate previously returned quantities per line item
    const previouslyReturnedMap = new Map<string, number>();
    for (const ret of purchase.returns) {
      for (const item of ret.items) {
        const key = item.purchaseItemId || item.productId;
        const current = previouslyReturnedMap.get(key) || 0;
        previouslyReturnedMap.set(key, current + Number(item.quantity));
      }
    }

    const items: ReturnablePurchaseItemDTO[] = purchase.items.map((it) => {
      const purchasedQty = Number(it.quantity);
      const previouslyReturned = previouslyReturnedMap.get(it.id) || previouslyReturnedMap.get(it.productId) || 0;
      const returnableQty = Math.max(0, purchasedQty - previouslyReturned);

      return {
        purchaseItemId: it.id,
        productId: it.productId,
        productName: it.product.name,
        sku: it.product.sku,
        unitCode: it.product.unit?.shortCode || 'PCS',
        purchasedQuantity: purchasedQty,
        previouslyReturnedQuantity: previouslyReturned,
        returnableQuantity: returnableQty,
        currentStock: Number(it.product.currentStock),
        purchasePrice: Number(it.purchasePrice),
        discount: Number(it.discount),
        taxRate: Number(it.taxRate),
        taxAmount: Number(it.taxAmount),
        lineTotal: Number(it.lineTotal),
      };
    });

    return {
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate.toISOString(),
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier ? purchase.supplier.name : 'Cash Supplier',
      paymentMethod: purchase.paymentMethod as any,
      total: Number(purchase.total),
      paidAmount: Number(purchase.paidAmount),
      dueAmount: Number(purchase.dueAmount),
      status: purchase.status as any,
      items,
    };
  }

  /**
   * Creates an atomic, verified Purchase Return transaction through the serialized write queue.
   */
  async createPurchaseReturn(
    input: z.input<typeof CreatePurchaseReturnSchema>,
    userId?: string
  ): Promise<PurchaseReturnDetailDTO> {
    const validated = CreatePurchaseReturnSchema.parse(input);

    return await executeWriteTransaction(async (tx) => {
      // 1. Fetch original purchase inside transaction with lock
      const purchase = await tx.purchase.findUnique({
        where: { id: validated.purchaseId },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
          returns: {
            where: { status: 'POSTED' },
            include: { items: true },
          },
        },
      });

      if (!purchase) {
        throw new Error(`Original purchase with ID "${validated.purchaseId}" not found.`);
      }

      if (purchase.status !== 'POSTED') {
        throw new Error(`Cannot process return against ${purchase.status} purchase "${purchase.purchaseNumber}". Only POSTED purchases can be returned.`);
      }

      // 2. Fetch app settings for negative stock policy
      const settings = await settingsService.getAppSettings();
      const negativeStockPolicy = settings.pos.negativeStockPolicy;

      // 3. Concurrency-safe returnable quantity check inside tx
      const previouslyReturnedByItemId = new Map<string, number>();
      const previouslyReturnedByProductId = new Map<string, number>();
      for (const ret of purchase.returns) {
        for (const item of ret.items) {
          const qty = Number(item.quantity);
          if (item.purchaseItemId) {
            const cur = previouslyReturnedByItemId.get(item.purchaseItemId) || 0;
            previouslyReturnedByItemId.set(item.purchaseItemId, cur + qty);
          }
          const curP = previouslyReturnedByProductId.get(item.productId) || 0;
          previouslyReturnedByProductId.set(item.productId, curP + qty);
        }
      }

      // 4. Process requested return items
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const itemsToCreate: {
        purchaseItemId: string;
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
        taxAmount: number;
        lineTotal: number;
      }[] = [];

      for (const reqItem of validated.items) {
        const returnQty = Number(reqItem.quantity);
        if (returnQty <= 0) {
          throw new Error('Return quantity must be greater than zero.');
        }

        // Match original purchase item
        const origItem = purchase.items.find(
          (i: any) => (reqItem.purchaseItemId && i.id === reqItem.purchaseItemId) || i.productId === reqItem.productId
        );

        if (!origItem) {
          throw new Error(`Product ${reqItem.productId} was not part of original purchase ${purchase.purchaseNumber}.`);
        }

        const purchasedQty = roundQuantity(Number(origItem.quantity), 4);
        const prevReturned = roundQuantity(
          (origItem.id && previouslyReturnedByItemId.get(origItem.id)) ||
          previouslyReturnedByProductId.get(origItem.productId) || 0,
          4
        );
        const returnableQty = roundQuantity(Math.max(0, purchasedQty - prevReturned), 4);

        if (compareQuantities(returnQty, returnableQty) > 0) {
          throw new Error(
            `Cannot return more than available quantity. Requested ${returnQty} for "${origItem.product.name}" exceeds remaining returnable quantity (${returnableQty}).`
          );
        }

        // Physical stock check: Returning goods to supplier removes physical inventory
        const productInDb = await tx.product.findUnique({
          where: { id: origItem.productId },
          select: { id: true, name: true, currentStock: true },
        });

        const currentStock = Number(productInDb?.currentStock || 0);
        if (currentStock < returnQty) {
          if (negativeStockPolicy === 'BLOCK') {
            throw new Error(
              `Insufficient on-hand stock (${currentStock}) to return ${returnQty} units of "${origItem.product.name}". Return blocked by negative stock policy.`
            );
          }
          if (negativeStockPolicy === 'ALLOW_WITH_WARNING' && !validated.allowNegativeStockOverride) {
            throw new Error(
              `Negative Stock Warning: Purchase return will reduce stock for "${origItem.product.name}" below zero (${currentStock - returnQty} units). Please confirm override to proceed.`
            );
          }
        }

        // Proportional discount & tax calculation based on historical purchase line
        const unitPurchasePrice = Number(origItem.purchasePrice);
        const origDiscountTotal = Number(origItem.discount || 0);
        const discountPerUnit = purchasedQty > 0 ? origDiscountTotal / purchasedQty : 0;
        const lineDiscount = Math.round(discountPerUnit * returnQty * 100) / 100;

        const lineGross = Math.round(unitPurchasePrice * returnQty * 100) / 100;
        const lineTaxable = Math.max(0, lineGross - lineDiscount);
        const taxRate = Number(origItem.taxRate || 0);
        const lineTax = Math.round(lineTaxable * (taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((lineTaxable + lineTax) * 100) / 100;

        subtotal += lineTaxable;
        totalDiscount += lineDiscount;
        totalTax += lineTax;

        itemsToCreate.push({
          purchaseItemId: origItem.id,
          productId: origItem.productId,
          productName: origItem.product.name,
          sku: origItem.product.sku,
          quantity: returnQty,
          unitPrice: unitPurchasePrice,
          discount: lineDiscount,
          taxRate,
          taxAmount: lineTax,
          lineTotal,
        });

        if (origItem.id) {
          previouslyReturnedByItemId.set(origItem.id, prevReturned + returnQty);
        }
        previouslyReturnedByProductId.set(origItem.productId, prevReturned + returnQty);
      }

      const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

      // 5. Generate return sequence number (PR-000001)
      const returnNumber = await invoiceSequenceService.getNextInvoiceNumber(tx, 'PURCHASE_RETURN');

      // 6. Create PurchaseReturn record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseId: purchase.id,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          totalAmount,
          refundType: validated.refundType,
          status: 'POSTED',
          notes: validated.notes?.trim() || null,
        },
      });

      // 7. Create PurchaseReturnItem records and update Stock Ledger via InventoryService
      for (const item of itemsToCreate) {
        await tx.purchaseReturnItem.create({
          data: {
            purchaseReturnId: purchaseReturn.id,
            purchaseItemId: item.purchaseItemId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          },
        });

        // Authoritative stock deduction via RETURN_OUT
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'RETURN_OUT',
          referenceId: purchaseReturn.id,
          quantityChange: -roundQuantity(item.quantity, 4),
          notes: `Purchase Return ${returnNumber} for Purchase ${purchase.purchaseNumber}`,
        });
      }

      // 8. Update Supplier Ledger & Balance if SUPPLIER_PAYABLE_DEDUCTION
      if (
        validated.refundType === 'SUPPLIER_PAYABLE_DEDUCTION' &&
        purchase.supplierId &&
        purchase.supplier
      ) {
        const prevBal = Number(purchase.supplier.currentBalance);
        const newBal = Math.round((prevBal - totalAmount) * 100) / 100;

        await tx.supplierLedger.create({
          data: {
            supplierId: purchase.supplierId,
            type: 'PURCHASE_RETURN',
            referenceId: purchaseReturn.id,
            debit: totalAmount, // Reduces supplier payable (store owes less)
            credit: 0,
            balance: newBal,
            notes: `Debit note for Purchase Return ${returnNumber}`,
          },
        });

        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { currentBalance: newBal },
        });
      }

      // 9. Audit log entry
      await auditService.log(
        {
          userId,
          action: 'PURCHASE_RETURN_CREATED',
          entityType: 'PurchaseReturn',
          entityId: purchaseReturn.id,
          newValue: {
            returnNumber,
            purchaseNumber: purchase.purchaseNumber,
            totalAmount,
            refundType: validated.refundType,
            itemCount: itemsToCreate.length,
          },
          reason: `Processed purchase return ${returnNumber} for purchase ${purchase.purchaseNumber}`,
        },
        tx
      );

      return {
        id: purchaseReturn.id,
        returnNumber: purchaseReturn.returnNumber,
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier ? purchase.supplier.name : 'Cash Supplier',
        returnDate: purchaseReturn.returnDate.toISOString(),
        subtotal: Number(purchaseReturn.subtotal),
        discount: Number(purchaseReturn.discount),
        tax: Number(purchaseReturn.tax),
        totalAmount: Number(purchaseReturn.totalAmount),
        refundType: purchaseReturn.refundType as any,
        status: purchaseReturn.status as any,
        itemCount: itemsToCreate.length,
        notes: purchaseReturn.notes,
        createdAt: purchaseReturn.createdAt.toISOString(),
        items: itemsToCreate.map((it, idx) => ({
          id: `item-${idx}`,
          purchaseReturnId: purchaseReturn.id,
          purchaseItemId: it.purchaseItemId,
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
        })),
      };
    });
  }

  /**
   * Retrieves purchase return detail by ID.
   */
  async getPurchaseReturnById(id: string): Promise<PurchaseReturnDetailDTO> {
    const ret = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        purchase: {
          include: { supplier: true },
        },
        items: {
          include: { product: true },
        },
      },
    });

    if (!ret) {
      throw new Error(`Purchase return with ID "${id}" not found.`);
    }

    return {
      id: ret.id,
      returnNumber: ret.returnNumber,
      purchaseId: ret.purchaseId,
      purchaseNumber: ret.purchase.purchaseNumber,
      supplierId: ret.purchase.supplierId,
      supplierName: ret.purchase.supplier ? ret.purchase.supplier.name : 'Cash Supplier',
      returnDate: ret.returnDate.toISOString(),
      subtotal: Number(ret.subtotal),
      discount: Number(ret.discount),
      tax: Number(ret.tax),
      totalAmount: Number(ret.totalAmount),
      refundType: ret.refundType as any,
      status: ret.status as any,
      itemCount: ret.items.length,
      notes: ret.notes,
      createdAt: ret.createdAt.toISOString(),
      items: ret.items.map((it) => ({
        id: it.id,
        purchaseReturnId: it.purchaseReturnId,
        purchaseItemId: it.purchaseItemId,
        productId: it.productId,
        productName: it.product.name,
        sku: it.product.sku,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount),
        taxRate: Number(it.taxRate),
        taxAmount: Number(it.taxAmount),
        lineTotal: Number(it.lineTotal),
      })),
    };
  }

  /**
   * Lists purchase returns with search, purchase filter, and pagination.
   */
  async listPurchaseReturns(
    params: z.input<typeof PurchaseReturnQuerySchema>
  ): Promise<PaginatedResult<PurchaseReturnSummaryDTO>> {
    const validated = PurchaseReturnQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.purchaseId) {
      where.purchaseId = validated.purchaseId;
    }

    if (validated.supplierId) {
      where.purchase = { ...where.purchase, supplierId: validated.supplierId };
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { returnNumber: { contains: q } },
        { purchase: { purchaseNumber: { contains: q } } },
        { purchase: { supplier: { name: { contains: q } } } },
      ];
    }

    if (validated.startDate || validated.endDate) {
      where.returnDate = {};
      if (validated.startDate) where.returnDate.gte = new Date(validated.startDate);
      if (validated.endDate) where.returnDate.lte = new Date(validated.endDate);
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [returns, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { returnDate: 'desc' },
        include: {
          purchase: {
            include: { supplier: true },
          },
          items: true,
        },
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);

    const data: PurchaseReturnSummaryDTO[] = returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      purchaseId: r.purchaseId,
      purchaseNumber: r.purchase.purchaseNumber,
      supplierId: r.purchase.supplierId,
      supplierName: r.purchase.supplier ? r.purchase.supplier.name : 'Cash Supplier',
      returnDate: r.returnDate.toISOString(),
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      tax: Number(r.tax),
      totalAmount: Number(r.totalAmount),
      refundType: r.refundType as any,
      status: r.status as any,
      itemCount: r.items.length,
      createdAt: r.createdAt.toISOString(),
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
   * Safely cancels a posted purchase return, reversing the stock deduction and supplier payable adjustment.
   */
  async cancelPurchaseReturn(
    id: string,
    reason: string,
    userId?: string
  ): Promise<PurchaseReturnDetailDTO> {
    if (!reason || !reason.trim()) {
      throw new Error('A cancellation reason is required.');
    }

    await executeWriteTransaction(async (tx) => {
      const ret = await tx.purchaseReturn.findUnique({
        where: { id },
        include: {
          purchase: { include: { supplier: true } },
          items: true,
        },
      });

      if (!ret) {
        throw new Error(`Purchase return with ID "${id}" not found.`);
      }

      if (ret.status === 'CANCELLED') {
        throw new Error(`Purchase return ${ret.returnNumber} is already CANCELLED.`);
      }

      // 1. Mark status as CANCELLED
      await tx.purchaseReturn.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 2. Reverse stock movements: RETURN_IN
      for (const item of ret.items) {
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'RETURN_IN',
          referenceId: ret.id,
          quantityChange: Number(item.quantity),
          notes: `Reversal of cancelled purchase return ${ret.returnNumber}: ${reason.trim()}`,
        });
      }

      // 3. Reverse supplier balance adjustment if applied
      if (
        ret.refundType === 'SUPPLIER_PAYABLE_DEDUCTION' &&
        ret.purchase.supplierId &&
        ret.purchase.supplier
      ) {
        const prevBal = Number(ret.purchase.supplier.currentBalance);
        const amount = Number(ret.totalAmount);
        const newBal = Math.round((prevBal + amount) * 100) / 100;

        await tx.supplierLedger.create({
          data: {
            supplierId: ret.purchase.supplierId,
            type: 'ADJUSTMENT',
            referenceId: ret.id,
            debit: 0,
            credit: amount, // Restores supplier payable (store owes supplier again)
            balance: newBal,
            notes: `Reversal of cancelled purchase return ${ret.returnNumber}: ${reason.trim()}`,
          },
        });

        await tx.supplier.update({
          where: { id: ret.purchase.supplierId },
          data: { currentBalance: newBal },
        });
      }

      // 4. Audit log
      await auditService.log(
        {
          userId,
          action: 'PURCHASE_RETURN_CANCELLED',
          entityType: 'PurchaseReturn',
          entityId: ret.id,
          oldValue: { status: 'POSTED' },
          newValue: { status: 'CANCELLED', reason: reason.trim() },
          reason: `Cancelled purchase return ${ret.returnNumber}: ${reason.trim()}`,
        },
        tx
      );
    });

    return await this.getPurchaseReturnById(id);
  }
}

export const purchaseReturnService = new PurchaseReturnService();
