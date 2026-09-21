import { getPrismaClient } from '../../database/client';
import { reportService } from './report.service';
import {
  PurchaseReportDTO,
  PurchasesByProductDTO,
  PurchasesBySupplierDTO,
  PurchaseReturnReportDTO,
} from '../../../shared/types';

function n(v: any): number {
  return Math.round(Number(v || 0) * 100) / 100;
}

/**
 * Purchase Report Service — Phase 11
 *
 * All aggregations at database level.
 * Cancelled purchases excluded from active totals.
 * Supplier outstanding uses authoritative Supplier.currentBalance.
 */
export class PurchaseReportService {
  private get prisma() {
    return getPrismaClient();
  }

  async getPurchaseReport(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    paymentMethod?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PurchaseReportDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const statusFilter =
      !query.status || query.status === 'ALL' ? undefined : query.status;
    const paymentFilter =
      !query.paymentMethod || query.paymentMethod === 'ALL' ? undefined : query.paymentMethod;

    const where: any = {
      purchaseDate: { gte: startDate, lte: endDate },
    };
    if (statusFilter) where.status = statusFilter;
    else where.status = { not: 'DRAFT' };
    if (paymentFilter) where.paymentMethod = paymentFilter;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search) where.purchaseNumber = { contains: query.search };

    const summaryWhere = {
      ...where,
      status: statusFilter || 'POSTED',
    };

    const [purchases, total, returnsAgg, summaryAgg] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { purchaseDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.purchase.count({ where }),
      this.prisma.purchaseReturn.aggregate({
        where: {
          status: 'POSTED',
          returnDate: { gte: startDate, lte: endDate },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.purchase.aggregate({
        where: summaryWhere,
        _sum: { total: true, discount: true, tax: true },
        _count: { id: true },
      }),
    ]);

    const grossPurchases = n(summaryAgg._sum.total);
    const totalDiscount = n(summaryAgg._sum.discount);
    const totalTax = n(summaryAgg._sum.tax);
    const purchaseReturns = n(returnsAgg._sum.totalAmount);
    const netPurchases = Math.max(0, Math.round((grossPurchases - purchaseReturns) * 100) / 100);

    return {
      summary: {
        period: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        grossPurchases,
        totalDiscount,
        totalTax,
        purchaseReturns,
        netPurchases,
        purchasesCount: summaryAgg._count.id,
        returnsCount: returnsAgg._count.id,
      },
      data: purchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        purchaseDate: p.purchaseDate.toISOString(),
        supplierId: p.supplierId,
        supplierName: p.supplier?.name || 'Cash Supplier',
        subtotal: n(p.subtotal),
        discount: n(p.discount),
        tax: n(p.tax),
        total: n(p.total),
        paidAmount: n(p.paidAmount),
        dueAmount: n(p.dueAmount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        itemCount: p._count.items,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPurchasesByProduct(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PurchasesByProductDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const [purchaseItems, returnItems] = await Promise.all([
      this.prisma.purchaseItem.findMany({
        where: {
          purchase: {
            status: 'POSTED',
            purchaseDate: { gte: startDate, lte: endDate },
          },
        },
        include: {
          product: {
            include: { unit: { select: { shortCode: true } } },
          },
        },
      }),
      this.prisma.purchaseReturnItem.findMany({
        where: {
          purchaseReturn: {
            status: 'POSTED',
            returnDate: { gte: startDate, lte: endDate },
          },
        },
        select: { productId: true, quantity: true, lineTotal: true },
      }),
    ]);

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        unitCode: string;
        quantityPurchased: number;
        grossPurchaseAmount: number;
        returnQty: number;
        returnValue: number;
      }
    >();

    for (const item of purchaseItems) {
      const pid = item.productId;
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          productName: item.product.name,
          sku: item.product.sku,
          unitCode: item.product.unit.shortCode,
          quantityPurchased: 0,
          grossPurchaseAmount: 0,
          returnQty: 0,
          returnValue: 0,
        });
      }
      const row = map.get(pid)!;
      row.quantityPurchased += Number(item.quantity);
      row.grossPurchaseAmount = Math.round((row.grossPurchaseAmount + Number(item.lineTotal)) * 100) / 100;
    }

    for (const ret of returnItems) {
      if (map.has(ret.productId)) {
        const row = map.get(ret.productId)!;
        row.returnQty += Number(ret.quantity);
        row.returnValue = Math.round((row.returnValue + Number(ret.lineTotal)) * 100) / 100;
      }
    }

    let totals = { quantityPurchased: 0, grossPurchaseAmount: 0, returnValue: 0, netPurchaseAmount: 0 };
    const data = Array.from(map.values()).map((row) => {
      const netQuantity = Math.max(0, row.quantityPurchased - row.returnQty);
      const netPurchaseAmount = Math.max(0, Math.round((row.grossPurchaseAmount - row.returnValue) * 100) / 100);
      totals.quantityPurchased += row.quantityPurchased;
      totals.grossPurchaseAmount = Math.round((totals.grossPurchaseAmount + row.grossPurchaseAmount) * 100) / 100;
      totals.returnValue = Math.round((totals.returnValue + row.returnValue) * 100) / 100;
      totals.netPurchaseAmount = Math.round((totals.netPurchaseAmount + netPurchaseAmount) * 100) / 100;
      return {
        ...row,
        quantityPurchased: Math.round(row.quantityPurchased * 1000) / 1000,
        returnQty: Math.round(row.returnQty * 1000) / 1000,
        netQuantity: Math.round(netQuantity * 1000) / 1000,
        netPurchaseAmount,
      };
    });

    data.sort((a, b) => b.grossPurchaseAmount - a.grossPurchaseAmount);
    return {
      period: periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data,
      totals,
    };
  }

  async getPurchasesBySupplier(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PurchasesBySupplierDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const [purchases, returns] = await Promise.all([
      this.prisma.purchase.findMany({
        where: {
          status: 'POSTED',
          purchaseDate: { gte: startDate, lte: endDate },
        },
        include: { supplier: { select: { id: true, name: true, phone: true, currentBalance: true } } },
      }),
      this.prisma.purchaseReturn.findMany({
        where: {
          status: 'POSTED',
          returnDate: { gte: startDate, lte: endDate },
        },
        include: { purchase: { select: { supplierId: true } } },
      }),
    ]);

    const CASH_KEY = '__CASH__';
    const map = new Map<
      string,
      {
        supplierId: string | null;
        supplierName: string;
        phone: string | null;
        purchasesCount: number;
        grossPurchases: number;
        returnsValue: number;
        amountPaid: number;
        outstanding: number;
      }
    >();

    for (const p of purchases) {
      const key = p.supplierId || CASH_KEY;
      if (!map.has(key)) {
        map.set(key, {
          supplierId: p.supplierId,
          supplierName: p.supplier?.name || 'Cash Supplier',
          phone: p.supplier?.phone || null,
          purchasesCount: 0,
          grossPurchases: 0,
          returnsValue: 0,
          amountPaid: 0,
          outstanding: p.supplier ? Number(p.supplier.currentBalance) : 0,
        });
      }
      const row = map.get(key)!;
      row.purchasesCount++;
      row.grossPurchases = Math.round((row.grossPurchases + Number(p.total)) * 100) / 100;
      row.amountPaid = Math.round((row.amountPaid + Number(p.paidAmount)) * 100) / 100;
    }

    for (const ret of returns) {
      const key = ret.purchase.supplierId || CASH_KEY;
      if (map.has(key)) {
        const row = map.get(key)!;
        row.returnsValue = Math.round((row.returnsValue + Number(ret.totalAmount)) * 100) / 100;
      }
    }

    let totals = { grossPurchases: 0, returnsValue: 0, netPurchases: 0, outstanding: 0 };
    const data = Array.from(map.values()).map((row) => {
      const netPurchases = Math.max(0, Math.round((row.grossPurchases - row.returnsValue) * 100) / 100);
      totals.grossPurchases = Math.round((totals.grossPurchases + row.grossPurchases) * 100) / 100;
      totals.returnsValue = Math.round((totals.returnsValue + row.returnsValue) * 100) / 100;
      totals.netPurchases = Math.round((totals.netPurchases + netPurchases) * 100) / 100;
      totals.outstanding = Math.round((totals.outstanding + Math.max(0, row.outstanding)) * 100) / 100;
      return { ...row, netPurchases };
    });

    data.sort((a, b) => b.grossPurchases - a.grossPurchases);
    return { period: periodLabel, startDate: startDate.toISOString(), endDate: endDate.toISOString(), data, totals };
  }

  async getPurchaseReturnReport(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PurchaseReturnReportDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = {
      status: 'POSTED',
      returnDate: { gte: startDate, lte: endDate },
    };

    const [returns, total, summary] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        include: {
          purchase: {
            include: { supplier: { select: { name: true } } },
          },
          _count: { select: { items: true } },
        },
        orderBy: { returnDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.purchaseReturn.count({ where }),
      this.prisma.purchaseReturn.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    return {
      period: periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalReturns: summary._count.id,
      totalReturnValue: n(summary._sum.totalAmount),
      data: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        purchaseId: r.purchaseId,
        purchaseNumber: r.purchase.purchaseNumber,
        returnDate: r.returnDate.toISOString(),
        supplierId: r.purchase.supplierId,
        supplierName: r.purchase.supplier?.name || 'Cash Supplier',
        subtotal: n(r.subtotal),
        discount: n(r.discount),
        tax: n(r.tax),
        totalAmount: n(r.totalAmount),
        refundType: r.refundType,
        status: r.status,
        itemCount: r._count.items,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const purchaseReportService = new PurchaseReportService();
