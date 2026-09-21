import { getPrismaClient } from '../../database/client';
import { reportService } from './report.service';
import { DashboardMetricsDTO } from '../../../shared/types';

/**
 * Dashboard Service — Phase 11
 *
 * All queries run concurrently via Promise.all to minimize latency.
 * Uses authoritative data sources:
 *   - Customer.currentBalance for receivables (Phase 9 ledger cache)
 *   - Supplier.currentBalance for payables (Phase 6 ledger cache)
 *   - CustomerPayment.amount for collections (NOT Sale.paidAmount)
 *   - SalesReturn.totalAmount for return deductions
 */
export class DashboardService {
  private get prisma() {
    return getPrismaClient();
  }

  async getDashboardMetrics(): Promise<DashboardMetricsDTO> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      todaySalesAgg,
      todaySalesReturnsAgg,
      todayPurchasesAgg,
      todayPurchaseReturnsAgg,
      todayCollectionsAgg,
      todayExpensesAgg,
      receivablesAgg,
      payablesAgg,
      stockAgg,
      productCounts,
    ] = await Promise.all([
      // Today POSTED sales (gross)
      this.prisma.sale.aggregate({
        where: { status: 'POSTED', saleDate: { gte: todayStart, lte: todayEnd } },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      // Today POSTED sales returns
      this.prisma.salesReturn.aggregate({
        where: { status: 'POSTED', returnDate: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Today POSTED purchases (gross)
      this.prisma.purchase.aggregate({
        where: { status: 'POSTED', purchaseDate: { gte: todayStart, lte: todayEnd } },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Today POSTED purchase returns
      this.prisma.purchaseReturn.aggregate({
        where: { status: 'POSTED', returnDate: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Today's actual collections (CustomerPayment.paymentDate — not Sale.paidAmount)
      this.prisma.customerPayment.aggregate({
        where: { paymentDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      // Today POSTED expenses
      this.prisma.expense.aggregate({
        where: { status: 'POSTED', date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Total receivables = SUM of positive customer balances (authoritative Phase 9 cache)
      this.prisma.customer.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
      // Total payables = SUM of positive supplier balances (authoritative Phase 6 cache)
      this.prisma.supplier.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
      // Stock value = SUM(currentStock × purchasePrice) for ACTIVE products
      // NOTE: This uses current purchasePrice (not FIFO/LIFO) — documented in spec
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { currentStock: true, purchasePrice: true, reorderLevel: true },
      }),
      // Product counts for dashboard
      this.prisma.product.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Compute stock stats from product list
    let stockValue = 0;
    let lowStockCount = 0;
    for (const p of stockAgg) {
      const stock = Number(p.currentStock);
      const price = Number(p.purchasePrice);
      const reorder = Number(p.reorderLevel);
      stockValue += stock * price;
      if (stock <= reorder) lowStockCount++;
    }
    stockValue = Math.round(stockValue * 100) / 100;

    const totalActiveProducts =
      productCounts.find((g) => g.status === 'ACTIVE')?._count?.id ?? 0;

    const todayGrossSales = Math.round(Number(todaySalesAgg._sum.grandTotal || 0) * 100) / 100;
    const todaySalesReturns = Math.round(Number(todaySalesReturnsAgg._sum.totalAmount || 0) * 100) / 100;
    const todayNetSales = Math.max(0, Math.round((todayGrossSales - todaySalesReturns) * 100) / 100);

    const todayGrossPurchases = Math.round(Number(todayPurchasesAgg._sum.total || 0) * 100) / 100;
    const todayPurchaseReturns = Math.round(Number(todayPurchaseReturnsAgg._sum.totalAmount || 0) * 100) / 100;
    const todayNetPurchases = Math.max(0, Math.round((todayGrossPurchases - todayPurchaseReturns) * 100) / 100);

    const todayCollections = Math.round(Number(todayCollectionsAgg._sum.amount || 0) * 100) / 100;
    const todayExpenses = Math.round(Number(todayExpensesAgg._sum.amount || 0) * 100) / 100;

    const totalReceivables = Math.round(Number(receivablesAgg._sum.currentBalance || 0) * 100) / 100;
    const totalPayables = Math.round(Number(payablesAgg._sum.currentBalance || 0) * 100) / 100;

    // Profit for today (uses the authoritative getProfitSummary)
    const todayProfit = await reportService.getProfitSummary({ period: 'TODAY' });
    const todayGrossProfit = todayProfit.grossProfit;
    const todayGrossMarginPercent = todayProfit.grossMarginPercent;
    const todayNetProfit = Math.round((todayGrossProfit - todayExpenses) * 100) / 100;

    return {
      todayGrossSales,
      todaySalesReturns,
      todayNetSales,
      todaySalesCount: todaySalesAgg._count.id,
      todayGrossPurchases,
      todayPurchaseReturns,
      todayNetPurchases,
      todayPurchasesCount: todayPurchasesAgg._count.id,
      todayCollections,
      todayExpenses,
      todayExpensesCount: todayExpensesAgg._count.id,
      totalReceivables,
      totalPayables,
      stockValue,
      totalActiveProducts,
      lowStockCount,
      todayGrossProfit,
      todayNetProfit,
      todayGrossMarginPercent,
    };
  }
}

export const dashboardService = new DashboardService();
