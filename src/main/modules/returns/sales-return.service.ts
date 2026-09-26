import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { inventoryService } from '../inventory/inventory.service';
import { invoiceSequenceService } from '../sales/invoice-sequence.service';
import { auditService } from '../audit/audit.service';
import { CreateSalesReturnSchema, SalesReturnQuerySchema } from '../../../shared/schemas';
import {
  SaleReturnableDetailsDTO,
  ReturnableSaleItemDTO,
  SalesReturnSummaryDTO,
  SalesReturnDetailDTO,
  PaginatedResult,
} from '../../../shared/types';
import { roundQuantity, compareQuantities } from '../../../shared/utils/quantity';

export class SalesReturnService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves sale details with itemized returnable quantities.
   * Computes originally sold qty, previously returned qty, and remaining returnable quantity.
   */
  async getSaleReturnableDetails(saleIdOrInvoice: string): Promise<SaleReturnableDetailsDTO> {
    const sale = await this.prisma.sale.findFirst({
      where: {
        OR: [{ id: saleIdOrInvoice }, { invoiceNumber: saleIdOrInvoice }],
      },
      include: {
        customer: true,
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

    if (!sale) {
      throw new Error(`Sale invoice "${saleIdOrInvoice}" not found.`);
    }

    // Aggregate previously returned quantities per line item
    const previouslyReturnedMap = new Map<string, number>();
    for (const ret of sale.returns) {
      for (const item of ret.items) {
        const key = item.saleItemId || item.productId;
        const current = previouslyReturnedMap.get(key) || 0;
        previouslyReturnedMap.set(key, current + Number(item.quantity));
      }
    }

    const items: ReturnableSaleItemDTO[] = sale.items.map((it) => {
      const soldQty = Number(it.quantity);
      const previouslyReturned = previouslyReturnedMap.get(it.id) || previouslyReturnedMap.get(it.productId) || 0;
      const returnableQty = Math.max(0, soldQty - previouslyReturned);

      return {
        saleItemId: it.id,
        productId: it.productId,
        productName: it.product.name,
        sku: it.product.sku,
        barcode: it.product.barcode,
        unitCode: it.product.unit?.shortCode || 'PCS',
        soldQuantity: soldQty,
        previouslyReturnedQuantity: previouslyReturned,
        returnableQuantity: returnableQty,
        unitPrice: Number(it.sellingPrice),
        costPrice: Number(it.costPrice),
        discount: Number(it.discount),
        taxRate: Number(it.taxRate),
        taxAmount: Number(it.taxAmount),
        lineTotal: Number(it.lineTotal),
      };
    });

    return {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString(),
      customerId: sale.customerId,
      customerName: sale.customer ? sale.customer.name : 'Cash Customer',
      paymentMethod: sale.paymentMethod as any,
      total: Number(sale.grandTotal),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      status: sale.status as any,
      items,
    };
  }

  /**
   * Creates an atomic, verified Sales Return transaction through the serialized write queue.
   */
  async createSalesReturn(
    input: z.input<typeof CreateSalesReturnSchema>,
    userId?: string
  ): Promise<SalesReturnDetailDTO> {
    const validated = CreateSalesReturnSchema.parse(input);

    return await executeWriteTransaction(async (tx) => {
      // 1. Fetch original sale inside transaction with lock
      const sale = await tx.sale.findUnique({
        where: { id: validated.saleId },
        include: {
          customer: true,
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

      if (!sale) {
        throw new Error(`Original sale with ID "${validated.saleId}" not found.`);
      }

      if (sale.status !== 'POSTED') {
        throw new Error(`Cannot process return against ${sale.status} sale "${sale.invoiceNumber}". Only POSTED sales can be returned.`);
      }

      // 2. Concurrency-safe returnable quantity check inside tx
      const previouslyReturnedByItemId = new Map<string, number>();
      const previouslyReturnedByProductId = new Map<string, number>();
      for (const ret of sale.returns) {
        for (const item of ret.items) {
          const qty = Number(item.quantity);
          if (item.saleItemId) {
            const cur = previouslyReturnedByItemId.get(item.saleItemId) || 0;
            previouslyReturnedByItemId.set(item.saleItemId, cur + qty);
          }
          const curP = previouslyReturnedByProductId.get(item.productId) || 0;
          previouslyReturnedByProductId.set(item.productId, curP + qty);
        }
      }

      // 3. Process requested return items
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const itemsToCreate: {
        saleItemId: string;
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

        // Match original sale item
        const origItem = sale.items.find(
          (i: any) => (reqItem.saleItemId && i.id === reqItem.saleItemId) || i.productId === reqItem.productId
        );

        if (!origItem) {
          throw new Error(`Product ${reqItem.productId} was not part of original sale ${sale.invoiceNumber}.`);
        }

        const soldQty = roundQuantity(Number(origItem.quantity), 4);
        const prevReturned = roundQuantity(
          (origItem.id && previouslyReturnedByItemId.get(origItem.id)) ||
          previouslyReturnedByProductId.get(origItem.productId) || 0,
          4
        );
        const returnableQty = roundQuantity(Math.max(0, soldQty - prevReturned), 4);

        if (compareQuantities(returnQty, returnableQty) > 0) {
          throw new Error(
            `Cannot return more than available quantity. Requested ${returnQty} for "${origItem.product.name}" exceeds remaining returnable quantity (${returnableQty}).`
          );
        }

        // Proportional discount & tax calculation based on historical sale line
        const unitSellingPrice = Number(origItem.sellingPrice);
        const origDiscountTotal = Number(origItem.discount || 0);
        const discountPerUnit = soldQty > 0 ? origDiscountTotal / soldQty : 0;
        const lineDiscount = Math.round(discountPerUnit * returnQty * 100) / 100;

        const lineGross = Math.round(unitSellingPrice * returnQty * 100) / 100;
        const lineTaxable = Math.max(0, lineGross - lineDiscount);
        const taxRate = Number(origItem.taxRate || 0);
        const lineTax = Math.round(lineTaxable * (taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((lineTaxable + lineTax) * 100) / 100;

        subtotal += lineTaxable;
        totalDiscount += lineDiscount;
        totalTax += lineTax;

        itemsToCreate.push({
          saleItemId: origItem.id,
          productId: origItem.productId,
          productName: origItem.product.name,
          sku: origItem.product.sku,
          quantity: returnQty,
          unitPrice: unitSellingPrice,
          discount: lineDiscount,
          taxRate,
          taxAmount: lineTax,
          lineTotal,
        });

        // Update local map in case multiple chunks of same product are in the payload
        if (origItem.id) {
          previouslyReturnedByItemId.set(origItem.id, prevReturned + returnQty);
        }
        previouslyReturnedByProductId.set(origItem.productId, prevReturned + returnQty);
      }

      const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

      // 4. Validate refund method & customer constraints
      if (validated.refundType === 'CUSTOMER_CREDIT' && !sale.customerId) {
        throw new Error('Customer credit refund is not permitted for Cash Customer. Walk-in Cash Customer must receive CASH_REFUND.');
      }

      // 5. Generate return sequence number (SR-000001)
      const returnNumber = await invoiceSequenceService.getNextInvoiceNumber(tx, 'SALES_RETURN');

      // 6. Create SalesReturn record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          totalAmount,
          refundType: validated.refundType,
          status: 'POSTED',
          notes: validated.notes?.trim() || null,
        },
      });

      // 7. Create SalesReturnItem records and update Stock Ledger via InventoryService
      for (const item of itemsToCreate) {
        await tx.salesReturnItem.create({
          data: {
            salesReturnId: salesReturn.id,
            saleItemId: item.saleItemId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          },
        });

        // Authoritative stock increase via RETURN_IN
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'RETURN_IN',
          referenceId: salesReturn.id,
          quantityChange: roundQuantity(item.quantity, 4),
          notes: `Sales Return ${returnNumber} for Invoice ${sale.invoiceNumber}`,
        });
      }

      // 8. Update Customer Ledger & Balance if CUSTOMER_CREDIT
      if (validated.refundType === 'CUSTOMER_CREDIT' && sale.customerId && sale.customer) {
        const prevBal = Number(sale.customer.currentBalance);
        const newBal = Math.max(0, Math.round((prevBal - totalAmount) * 100) / 100);

        await tx.customerLedger.create({
          data: {
            customerId: sale.customerId,
            type: 'SALES_RETURN',
            referenceId: salesReturn.id,
            debit: 0,
            credit: totalAmount, // Decreases customer debt
            balance: newBal,
            notes: `Credit refund for Sales Return ${returnNumber}`,
          },
        });

        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: newBal },
        });
      }

      // 9. Audit log entry
      await auditService.log(
        {
          userId,
          action: 'SALES_RETURN_CREATED',
          entityType: 'SalesReturn',
          entityId: salesReturn.id,
          newValue: {
            returnNumber,
            saleInvoiceNumber: sale.invoiceNumber,
            totalAmount,
            refundType: validated.refundType,
            itemCount: itemsToCreate.length,
          },
          reason: `Processed sales return ${returnNumber} for invoice ${sale.invoiceNumber}`,
        },
        tx
      );

      return {
        id: salesReturn.id,
        returnNumber: salesReturn.returnNumber,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerId: sale.customerId,
        customerName: sale.customer ? sale.customer.name : 'Cash Customer',
        returnDate: salesReturn.returnDate.toISOString(),
        subtotal: Number(salesReturn.subtotal),
        discount: Number(salesReturn.discount),
        tax: Number(salesReturn.tax),
        totalAmount: Number(salesReturn.totalAmount),
        refundType: salesReturn.refundType as any,
        status: salesReturn.status as any,
        itemCount: itemsToCreate.length,
        notes: salesReturn.notes,
        createdAt: salesReturn.createdAt.toISOString(),
        items: itemsToCreate.map((it, idx) => ({
          id: `item-${idx}`,
          salesReturnId: salesReturn.id,
          saleItemId: it.saleItemId,
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
   * Retrieves sales return detail by ID.
   */
  async getSalesReturnById(id: string): Promise<SalesReturnDetailDTO> {
    const ret = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        sale: {
          include: { customer: true },
        },
        items: {
          include: { product: true },
        },
      },
    });

    if (!ret) {
      throw new Error(`Sales return with ID "${id}" not found.`);
    }

    return {
      id: ret.id,
      returnNumber: ret.returnNumber,
      saleId: ret.saleId,
      invoiceNumber: ret.sale.invoiceNumber,
      customerId: ret.sale.customerId,
      customerName: ret.sale.customer ? ret.sale.customer.name : 'Cash Customer',
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
        salesReturnId: it.salesReturnId,
        saleItemId: it.saleItemId,
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
   * Lists sales returns with search, sale filter, and pagination.
   */
  async listSalesReturns(
    params: z.input<typeof SalesReturnQuerySchema>
  ): Promise<PaginatedResult<SalesReturnSummaryDTO>> {
    const validated = SalesReturnQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.saleId) {
      where.saleId = validated.saleId;
    }

    if (validated.customerId) {
      where.sale = { ...where.sale, customerId: validated.customerId };
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { returnNumber: { contains: q } },
        { sale: { invoiceNumber: { contains: q } } },
        { sale: { customer: { name: { contains: q } } } },
      ];
    }

    if (validated.startDate || validated.endDate) {
      where.returnDate = {};
      if (validated.startDate) where.returnDate.gte = new Date(validated.startDate);
      if (validated.endDate) where.returnDate.lte = new Date(validated.endDate);
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [returns, total] = await Promise.all([
      this.prisma.salesReturn.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { returnDate: 'desc' },
        include: {
          sale: {
            include: { customer: true },
          },
          items: true,
        },
      }),
      this.prisma.salesReturn.count({ where }),
    ]);

    const data: SalesReturnSummaryDTO[] = returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      saleId: r.saleId,
      invoiceNumber: r.sale.invoiceNumber,
      customerId: r.sale.customerId,
      customerName: r.sale.customer ? r.sale.customer.name : 'Cash Customer',
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
   * Safely cancels a posted sales return, reversing the stock increase and customer credit adjustment.
   */
  async cancelSalesReturn(
    id: string,
    reason: string,
    userId?: string
  ): Promise<SalesReturnDetailDTO> {
    if (!reason || !reason.trim()) {
      throw new Error('A cancellation reason is required.');
    }

    await executeWriteTransaction(async (tx) => {
      const ret = await tx.salesReturn.findUnique({
        where: { id },
        include: {
          sale: { include: { customer: true } },
          items: true,
        },
      });

      if (!ret) {
        throw new Error(`Sales return with ID "${id}" not found.`);
      }

      if (ret.status === 'CANCELLED') {
        throw new Error(`Sales return ${ret.returnNumber} is already CANCELLED.`);
      }

      // 1. Mark status as CANCELLED
      await tx.salesReturn.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 2. Reverse stock movements: RETURN_OUT
      for (const item of ret.items) {
        await inventoryService.recordStockMovement(tx, {
          productId: item.productId,
          transactionType: 'RETURN_OUT',
          referenceId: ret.id,
          quantityChange: -Number(item.quantity),
          notes: `Reversal of cancelled sales return ${ret.returnNumber}: ${reason.trim()}`,
        });
      }

      // 3. Reverse customer credit if applied
      if (ret.refundType === 'CUSTOMER_CREDIT' && ret.sale.customerId && ret.sale.customer) {
        const prevBal = Number(ret.sale.customer.currentBalance);
        const amount = Number(ret.totalAmount);
        const newBal = Math.round((prevBal + amount) * 100) / 100;

        await tx.customerLedger.create({
          data: {
            customerId: ret.sale.customerId,
            type: 'ADJUSTMENT',
            referenceId: ret.id,
            debit: amount, // Restores customer debt
            credit: 0,
            balance: newBal,
            notes: `Reversal of cancelled sales return ${ret.returnNumber}: ${reason.trim()}`,
          },
        });

        await tx.customer.update({
          where: { id: ret.sale.customerId },
          data: { currentBalance: newBal },
        });
      }

      // 4. Audit log
      await auditService.log(
        {
          userId,
          action: 'SALES_RETURN_CANCELLED',
          entityType: 'SalesReturn',
          entityId: ret.id,
          oldValue: { status: 'POSTED' },
          newValue: { status: 'CANCELLED', reason: reason.trim() },
          reason: `Cancelled sales return ${ret.returnNumber}: ${reason.trim()}`,
        },
        tx
      );
    });

    return await this.getSalesReturnById(id);
  }
}

export const salesReturnService = new SalesReturnService();
