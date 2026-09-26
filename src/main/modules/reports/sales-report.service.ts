import { getPrismaClient } from '../../database/client';
import { reportService } from './report.service';
import {
  SalesReportDTO,
  SalesByProductDTO,
  SalesByCustomerDTO,
  SalesByPaymentMethodDTO,
  SalesReturnReportDTO,
} from '../../../shared/types';
import { roundQuantity, roundMoney } from '../../../shared/utils/quantity';

function n(v: any): number {
  return roundMoney(Number(v || 0));
}

/**
 * Sales Report Service — Phase 11
 *
 * All aggregations are performed at the database level.
 * Historical cost uses saleItem.costPrice — never product.purchasePrice.
 * Cancelled sales are excluded from all active totals.
 * Split payments aggregated from SalePayment rows.
 */
export class SalesReportService {
  private get prisma() {
    return getPrismaClient();
  }

  async getSalesReport(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    paymentMethod?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<SalesReportDTO> {
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
      saleDate: { gte: startDate, lte: endDate },
    };
    if (statusFilter) where.status = statusFilter;
    else where.status = { not: 'DRAFT' }; // exclude drafts by default
    if (paymentFilter) where.paymentMethod = paymentFilter;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.invoiceNumber = { contains: query.search };
    }

    const [sales, total, returnsAgg] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { saleDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.sale.count({ where }),
      // Returns in same period
      this.prisma.salesReturn.aggregate({
        where: {
          status: 'POSTED',
          returnDate: { gte: startDate, lte: endDate },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    // Summary aggregation for the filter period (financial totals reflect POSTED sales only)
    const summaryWhere = {
      ...where,
      status: statusFilter || 'POSTED',
    };
    const summaryAgg = await this.prisma.sale.aggregate({
      where: summaryWhere,
      _sum: { grandTotal: true, discount: true, tax: true },
      _count: { id: true },
    });

    const grossSales = n(summaryAgg._sum.grandTotal);
    const totalDiscount = n(summaryAgg._sum.discount);
    const totalTax = n(summaryAgg._sum.tax);
    const salesReturns = n(returnsAgg._sum.totalAmount);
    const netSales = Math.max(0, Math.round((grossSales - salesReturns) * 100) / 100);

    return {
      summary: {
        period: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        grossSales,
        totalDiscount,
        totalTax,
        salesReturns,
        netSales,
        salesCount: summaryAgg._count.id,
        returnsCount: returnsAgg._count.id,
      },
      data: sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate.toISOString(),
        customerId: s.customerId,
        customerName: s.customer?.name || 'Cash Customer',
        subtotal: n(s.subtotal),
        discount: n(s.discount),
        tax: n(s.tax),
        grandTotal: n(s.grandTotal),
        paidAmount: n(s.paidAmount),
        dueAmount: n(s.dueAmount),
        paymentMethod: s.paymentMethod,
        status: s.status,
        itemCount: s._count.items,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSalesByProduct(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesByProductDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    // Fetch POSTED sale items in period with product info
    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          status: 'POSTED',
          saleDate: { gte: startDate, lte: endDate },
        },
      },
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            unit: { select: { shortCode: true } },
          },
        },
      },
    });

    // Fetch POSTED sales return items in period
    const returnItems = await this.prisma.salesReturnItem.findMany({
      where: {
        salesReturn: {
          status: 'POSTED',
          returnDate: { gte: startDate, lte: endDate },
        },
        saleItem: { isNot: null }, // only items linked to original sale
      },
      include: {
        saleItem: { select: { costPrice: true } },
      },
    });

    // Build product-level aggregation
    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        barcode: string | null;
        categoryName: string | null;
        unitCode: string;
        quantitySold: number;
        grossRevenue: number;
        totalDiscount: number;
        totalTax: number;
        historicalCogs: number;
        salesReturnQty: number;
        salesReturnValue: number;
      }
    >();

    for (const item of saleItems) {
      const pid = item.productId;
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          productName: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode,
          categoryName: item.product.category?.name || null,
          unitCode: item.product.unit.shortCode,
          quantitySold: 0,
          grossRevenue: 0,
          totalDiscount: 0,
          totalTax: 0,
          historicalCogs: 0,
          salesReturnQty: 0,
          salesReturnValue: 0,
        });
      }
      const row = map.get(pid)!;
      row.quantitySold += Number(item.quantity);
      row.grossRevenue += Number(item.lineTotal);
      row.totalDiscount += Number(item.discount);
      row.totalTax += Number(item.taxAmount);
      // INVARIANT: use captured historical cost, NOT product.purchasePrice
      row.historicalCogs += Number(item.quantity) * Number(item.costPrice);
    }

    for (const ret of returnItems) {
      const pid = ret.productId;
      if (map.has(pid)) {
        const row = map.get(pid)!;
        row.salesReturnQty += Number(ret.quantity);
        row.salesReturnValue += Number(ret.lineTotal);
      }
    }

    let totals = {
      quantitySold: 0,
      grossRevenue: 0,
      salesReturnValue: 0,
      netRevenue: 0,
      historicalCogs: 0,
      grossProfit: 0,
    };

    const data = Array.from(map.values()).map((row) => {
      const netQuantity = Math.max(0, row.quantitySold - row.salesReturnQty);
      const netRevenue = Math.max(0, Math.round((row.grossRevenue - row.salesReturnValue) * 100) / 100);
      // Historical cost for returns: use saleItem.costPrice via returnItems linkage (avg cost per unit)
      const avgCostPerUnit = row.quantitySold > 0 ? row.historicalCogs / row.quantitySold : 0;
      const returnCogs = row.salesReturnQty * avgCostPerUnit;
      const netCogs = Math.max(0, Math.round((row.historicalCogs - returnCogs) * 100) / 100);
      const grossProfit = Math.round((netRevenue - netCogs) * 100) / 100;
      const grossMarginPercent = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 10000) / 100 : 0;

      totals.quantitySold = roundQuantity(totals.quantitySold + row.quantitySold, 4);
      totals.grossRevenue = roundMoney(totals.grossRevenue + row.grossRevenue);
      totals.salesReturnValue = roundMoney(totals.salesReturnValue + row.salesReturnValue);
      totals.netRevenue = roundMoney(totals.netRevenue + netRevenue);
      totals.historicalCogs = roundMoney(totals.historicalCogs + netCogs);
      totals.grossProfit = roundMoney(totals.grossProfit + grossProfit);

      return {
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        barcode: row.barcode,
        categoryName: row.categoryName,
        unitCode: row.unitCode,
        quantitySold: roundQuantity(row.quantitySold, 4),
        grossRevenue: roundMoney(row.grossRevenue),
        totalDiscount: roundMoney(row.totalDiscount),
        totalTax: roundMoney(row.totalTax),
        salesReturnQty: roundQuantity(row.salesReturnQty, 4),
        salesReturnValue: roundMoney(row.salesReturnValue),
        netQuantity: roundQuantity(netQuantity, 4),
        netRevenue,
        historicalCogs: netCogs,
        grossProfit,
        grossMarginPercent,
      };
    });

    // Sort by grossRevenue descending
    data.sort((a, b) => b.grossRevenue - a.grossRevenue);

    return {
      period: periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data,
      totals,
    };
  }

  async getSalesByCustomer(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesByCustomerDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const sales = await this.prisma.sale.findMany({
      where: {
        status: 'POSTED',
        saleDate: { gte: startDate, lte: endDate },
      },
      include: { customer: { select: { id: true, name: true, phone: true, currentBalance: true } } },
    });

    const returns = await this.prisma.salesReturn.findMany({
      where: {
        status: 'POSTED',
        returnDate: { gte: startDate, lte: endDate },
      },
      include: { sale: { select: { customerId: true } } },
    });

    // Group by customer
    const map = new Map<
      string,
      {
        customerId: string | null;
        customerName: string;
        phone: string | null;
        salesCount: number;
        grossSales: number;
        returnsValue: number;
        amountPaid: number;
        outstanding: number;
      }
    >();

    const CASH_KEY = '__CASH__';
    for (const s of sales) {
      const key = s.customerId || CASH_KEY;
      if (!map.has(key)) {
        map.set(key, {
          customerId: s.customerId,
          customerName: s.customer?.name || 'Cash Customer',
          phone: s.customer?.phone || null,
          salesCount: 0,
          grossSales: 0,
          returnsValue: 0,
          amountPaid: 0,
          outstanding: s.customer ? Number(s.customer.currentBalance) : 0,
        });
      }
      const row = map.get(key)!;
      row.salesCount++;
      row.grossSales = Math.round((row.grossSales + Number(s.grandTotal)) * 100) / 100;
      row.amountPaid = Math.round((row.amountPaid + Number(s.paidAmount)) * 100) / 100;
    }

    for (const ret of returns) {
      const key = ret.sale.customerId || CASH_KEY;
      if (map.has(key)) {
        const row = map.get(key)!;
        row.returnsValue = Math.round((row.returnsValue + Number(ret.totalAmount)) * 100) / 100;
      }
    }

    let totals = { grossSales: 0, returnsValue: 0, netSales: 0, outstanding: 0 };
    const data = Array.from(map.values()).map((row) => {
      const netSales = Math.max(0, Math.round((row.grossSales - row.returnsValue) * 100) / 100);
      totals.grossSales = Math.round((totals.grossSales + row.grossSales) * 100) / 100;
      totals.returnsValue = Math.round((totals.returnsValue + row.returnsValue) * 100) / 100;
      totals.netSales = Math.round((totals.netSales + netSales) * 100) / 100;
      totals.outstanding = Math.round((totals.outstanding + Math.max(0, row.outstanding)) * 100) / 100;
      return { ...row, netSales };
    });

    data.sort((a, b) => b.grossSales - a.grossSales);
    return { period: periodLabel, startDate: startDate.toISOString(), endDate: endDate.toISOString(), data, totals };
  }

  async getSalesByPaymentMethod(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesByPaymentMethodDTO> {
    const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    // Aggregate actual payment rows (handles SPLIT payments correctly)
    const payments = await this.prisma.salePayment.findMany({
      where: {
        sale: {
          status: 'POSTED',
          saleDate: { gte: startDate, lte: endDate },
        },
      },
      select: { paymentMethod: true, amount: true },
    });

    const sales = await this.prisma.sale.findMany({
      where: {
        status: 'POSTED',
        saleDate: { gte: startDate, lte: endDate },
      },
      select: { paymentMethod: true, grandTotal: true },
    });

    // Sales amount by primary paymentMethod
    const salesByMethod = new Map<string, { salesAmount: number; transactionCount: number }>();
    for (const s of sales) {
      if (!salesByMethod.has(s.paymentMethod)) {
        salesByMethod.set(s.paymentMethod, { salesAmount: 0, transactionCount: 0 });
      }
      const row = salesByMethod.get(s.paymentMethod)!;
      row.salesAmount = Math.round((row.salesAmount + Number(s.grandTotal)) * 100) / 100;
      row.transactionCount++;
    }

    // Collection amount by actual payment method (split-aware)
    const collectionByMethod = new Map<string, number>();
    for (const p of payments) {
      collectionByMethod.set(
        p.paymentMethod,
        Math.round(((collectionByMethod.get(p.paymentMethod) || 0) + Number(p.amount)) * 100) / 100
      );
    }

    // Merge all methods
    const methods = new Set([...salesByMethod.keys(), ...collectionByMethod.keys()]);
    const data = Array.from(methods).map((method) => ({
      paymentMethod: method,
      transactionCount: salesByMethod.get(method)?.transactionCount || 0,
      salesAmount: salesByMethod.get(method)?.salesAmount || 0,
      collectionAmount: collectionByMethod.get(method) || 0,
    }));

    data.sort((a, b) => b.salesAmount - a.salesAmount);
    return { period: periodLabel, startDate: startDate.toISOString(), endDate: endDate.toISOString(), data };
  }

  async getSalesReturnReport(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<SalesReturnReportDTO> {
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
      this.prisma.salesReturn.findMany({
        where,
        include: {
          sale: {
            include: { customer: { select: { name: true } } },
          },
          _count: { select: { items: true } },
        },
        orderBy: { returnDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.salesReturn.count({ where }),
      this.prisma.salesReturn.aggregate({
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
        saleId: r.saleId,
        invoiceNumber: r.sale.invoiceNumber,
        returnDate: r.returnDate.toISOString(),
        customerId: r.sale.customerId,
        customerName: r.sale.customer?.name || 'Cash Customer',
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

export const salesReportService = new SalesReportService();
