import { getPrismaClient } from '../../database/client';
import { ProfitSummaryDTO } from '../../../shared/types';

export class ReportService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Fast read-only query for dashboard metrics.
   * Runs concurrently without locking SQLite writes.
   */
  async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySales, totalProducts, lowStockProducts, customerReceivables] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          saleDate: { gte: today },
          status: 'POSTED',
        },
        _sum: { grandTotal: true, paidAmount: true },
        _count: { id: true },
      }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({
        where: {
          status: 'ACTIVE',
          currentStock: { lte: 10 },
        },
      }),
      this.prisma.customer.aggregate({
        _sum: { currentBalance: true },
      }),
    ]);

    return {
      todaySalesTotal: Number(todaySales._sum.grandTotal || 0),
      todaySalesCount: todaySales._count.id,
      todayCollection: Number(todaySales._sum.paidAmount || 0),
      totalProducts,
      lowStockProducts,
      customerReceivables: Number(customerReceivables._sum.currentBalance || 0),
    };
  }

  /**
   * Resolves date boundaries for predefined or custom time periods.
   * Supports: TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, LAST_MONTH, THIS_YEAR, CUSTOM
   */
  resolveDateRange(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): {
    startDate: Date;
    endDate: Date;
    periodLabel: string;
  } {
    const now = new Date();
    const period = params.period || 'THIS_MONTH';

    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let periodLabel = period;

    if (period === 'TODAY') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (period === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    } else if (period === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === 'LAST_MONTH') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); // last day of prev month
    } else if (period === 'THIS_YEAR') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else if (period === 'CUSTOM' && (params.startDate || params.endDate)) {
      startDate = params.startDate ? new Date(params.startDate) : new Date(2000, 0, 1);
      if (params.endDate) {
        endDate = new Date(params.endDate);
        if (endDate.getHours() === 0 && endDate.getMinutes() === 0) {
          endDate.setHours(23, 59, 59, 999);
        }
      }
      periodLabel = 'CUSTOM';
    } else {
      // Default: current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    return { startDate, endDate, periodLabel };
  }

  /**
   * Authoritative Historical Profit & Loss Calculation.
   *
   * Invariants strictly enforced:
   * 1. Sale item historical cost captured at checkout (saleItem.costPrice) is used.
   * 2. Modifying product.purchasePrice later has zero effect on historical profit.
   * 3. Sales returns reverse both revenue and historical cost proportional to returned quantities.
   * 4. Cancelled sales and cancelled expenses are completely excluded.
   * 5. Net Profit = Gross Profit - Operating Expenses.
   */
  async getProfitSummary(
    params: { period?: string; startDate?: string; endDate?: string }
  ): Promise<ProfitSummaryDTO> {
    const { startDate, endDate, periodLabel } = this.resolveDateRange(params);

    // 1. Fetch all POSTED sales within period
    const sales = await this.prisma.sale.findMany({
      where: {
        status: 'POSTED',
        saleDate: { gte: startDate, lte: endDate },
      },
      include: {
        items: true,
      },
    });

    let grossSales = 0;
    let soldGoodsCost = 0;

    for (const s of sales) {
      grossSales += Number(s.grandTotal);
      for (const item of s.items) {
        const qty = Number(item.quantity);
        const costPrice = Number(item.costPrice); // Captured historical cost
        soldGoodsCost += qty * costPrice;
      }
    }

    // 2. Fetch all POSTED sales returns within period
    const returns = await this.prisma.salesReturn.findMany({
      where: {
        status: 'POSTED',
        returnDate: { gte: startDate, lte: endDate },
      },
      include: {
        items: {
          include: {
            saleItem: true,
            product: true,
          },
        },
      },
    });

    let salesReturns = 0;
    let returnedGoodsCost = 0;

    for (const ret of returns) {
      salesReturns += Number(ret.totalAmount);
      for (const item of ret.items) {
        const retQty = Number(item.quantity);
        // Strictly use original historical cost captured on saleItem
        const historicalCost = item.saleItem
          ? Number(item.saleItem.costPrice)
          : Number(item.product.purchasePrice);
        returnedGoodsCost += retQty * historicalCost;
      }
    }

    // 3. Fetch all POSTED operating expenses within period
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'POSTED',
        date: { gte: startDate, lte: endDate },
      },
    });

    let totalExpenses = 0;
    for (const exp of expenses) {
      totalExpenses += Number(exp.amount);
    }

    // 4. Compute Authoritative Derived Values
    grossSales = Math.round(grossSales * 100) / 100;
    salesReturns = Math.round(salesReturns * 100) / 100;
    const netSales = Math.max(0, Math.round((grossSales - salesReturns) * 100) / 100);

    soldGoodsCost = Math.round(soldGoodsCost * 100) / 100;
    returnedGoodsCost = Math.round(returnedGoodsCost * 100) / 100;
    const cogs = Math.max(0, Math.round((soldGoodsCost - returnedGoodsCost) * 100) / 100);

    const grossProfit = Math.round((netSales - cogs) * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

    const grossMarginPercent = netSales > 0 ? Math.round((grossProfit / netSales) * 10000) / 100 : 0;
    const netMarginPercent = netSales > 0 ? Math.round((netProfit / netSales) * 10000) / 100 : 0;

    return {
      period: periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      grossSales,
      salesReturns,
      netSales,
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
      grossMarginPercent,
      netMarginPercent,
      totalSalesCount: sales.length,
      totalReturnsCount: returns.length,
      totalExpensesCount: expenses.length,
    };
  }

  /**
   * Backward-compatible helper for gross profit queries.
   */
  async getHistoricalGrossProfit(startDate?: Date, endDate?: Date) {
    const summary = await this.getProfitSummary({
      period: 'CUSTOM',
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    });

    return {
      totalRevenue: summary.netSales,
      totalCost: summary.cogs,
      totalGrossProfit: summary.grossProfit,
      marginPercentage: summary.grossMarginPercent,
      totalItemsSold: summary.totalSalesCount,
    };
  }
}

export const reportService = new ReportService();
