import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthGuard } from '../plugins/authGuard';
import { auditService } from '../../modules/audit/audit.service';
import { dashboardService } from '../../modules/reports/dashboard.service';
import { salesReportService } from '../../modules/reports/sales-report.service';
import { purchaseReportService } from '../../modules/reports/purchase-report.service';
import { inventoryReportService } from '../../modules/reports/inventory-report.service';
import { customerReportService } from '../../modules/reports/customer-report.service';
import { supplierReportService } from '../../modules/reports/supplier-report.service';
import { reportService } from '../../modules/reports/report.service';
import { getPrismaClient } from '../../database/client';

function getQ(request: any) {
  return request.query as Record<string, any>;
}

function getToken(request: any): string {
  return (request.headers['authorization'] || getQ(request)?.token) as string;
}

/**
 * Phase 11 — Consolidated Report Routes
 * All under /api/reports/
 * All routes require authentication via AuthGuard.verifySession.
 * Profit/financial reports are additionally audit-logged.
 */
export const reportRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/dashboard', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      return await dashboardService.getDashboardMetrics();
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // SALES REPORTS
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/sales', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await salesReportService.getSalesReport({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
        customerId: q.customerId,
        paymentMethod: q.paymentMethod,
        status: q.status,
        search: q.search,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch sales report' };
    }
  });

  fastify.get('/api/reports/sales/by-product', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await salesReportService.getSalesByProduct({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch sales by product' };
    }
  });

  fastify.get('/api/reports/sales/by-customer', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await salesReportService.getSalesByCustomer({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch sales by customer' };
    }
  });

  fastify.get('/api/reports/sales/by-payment-method', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await salesReportService.getSalesByPaymentMethod({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch sales by payment method' };
    }
  });

  fastify.get('/api/reports/sales/returns', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await salesReportService.getSalesReturnReport({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
        search: q.search,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch sales returns report' };
    }
  });

  // --------------------------------------------------------------------------
  // PURCHASE REPORTS
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/purchases', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await purchaseReportService.getPurchaseReport({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
        supplierId: q.supplierId,
        paymentMethod: q.paymentMethod,
        status: q.status,
        search: q.search,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch purchase report' };
    }
  });

  fastify.get('/api/reports/purchases/by-product', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await purchaseReportService.getPurchasesByProduct({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch purchases by product' };
    }
  });

  fastify.get('/api/reports/purchases/by-supplier', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await purchaseReportService.getPurchasesBySupplier({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch purchases by supplier' };
    }
  });

  fastify.get('/api/reports/purchases/returns', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await purchaseReportService.getPurchaseReturnReport({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
        search: q.search,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch purchase returns report' };
    }
  });

  // --------------------------------------------------------------------------
  // INVENTORY REPORTS
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/inventory/current-stock', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await inventoryReportService.getCurrentStockReport({
        search: q.search,
        categoryId: q.categoryId,
        stockStatus: q.stockStatus,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch stock report' };
    }
  });

  fastify.get('/api/reports/inventory/low-stock', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      return await inventoryReportService.getLowStockReport();
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  fastify.get('/api/reports/inventory/stock-movement', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await inventoryReportService.getStockMovementReport({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
        productId: q.productId,
        transactionType: q.transactionType,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch stock movement report' };
    }
  });

  fastify.get('/api/reports/inventory/stock-ledger/:productId', async (request, reply) => {
    const token = getToken(request);
    const { productId } = request.params as { productId: string };
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await inventoryReportService.getStockLedgerForProduct(productId, {
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch stock ledger' };
    }
  });

  // --------------------------------------------------------------------------
  // CUSTOMER REPORTS
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/customers/outstanding', async (request, reply) => {
    const token = getToken(request);
    try {
      const session = AuthGuard.verifySession(token);
      // Audit: sensitive financial report
      await auditService.log({
        userId: session.user.id,
        action: 'FINANCIAL_REPORT_ACCESSED',
        entityType: 'CustomerOutstandingReport',
        entityId: undefined,
        newValue: JSON.stringify({ accessedBy: session.user.username }),
      });
      const q = getQ(request);
      return await customerReportService.getCustomerOutstandingReport({
        search: q.search,
        status: q.status,
        sortBy: q.sortBy,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Authentication required' };
    }
  });

  fastify.get('/api/reports/customers/:id/ledger', async (request, reply) => {
    const token = getToken(request);
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await customerReportService.getCustomerLedgerReport(id, {
        type: q.type,
        startDate: q.startDate,
        endDate: q.endDate,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // SUPPLIER REPORTS
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/suppliers/outstanding', async (request, reply) => {
    const token = getToken(request);
    try {
      const session = AuthGuard.verifySession(token);
      await auditService.log({
        userId: session.user.id,
        action: 'FINANCIAL_REPORT_ACCESSED',
        entityType: 'SupplierOutstandingReport',
        entityId: undefined,
        newValue: JSON.stringify({ accessedBy: session.user.username }),
      });
      const q = getQ(request);
      return await supplierReportService.getSupplierOutstandingReport({
        search: q.search,
        status: q.status,
        sortBy: q.sortBy,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Authentication required' };
    }
  });

  fastify.get('/api/reports/suppliers/:id/ledger', async (request, reply) => {
    const token = getToken(request);
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      return await supplierReportService.getSupplierLedgerReport(id, {
        type: q.type,
        startDate: q.startDate,
        endDate: q.endDate,
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // EXPENSE REPORT
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/expenses', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });

      const prisma = getPrismaClient();
      const [expenses, categoryAgg] = await Promise.all([
        prisma.expense.findMany({
          where: {
            status: 'POSTED',
            date: { gte: startDate, lte: endDate },
            ...(q.categoryId ? { categoryId: q.categoryId } : {}),
            ...(q.paymentMethod && q.paymentMethod !== 'ALL' ? { paymentMethod: q.paymentMethod } : {}),
          },
          include: { category: { select: { id: true, name: true } } },
        }),
        prisma.expense.groupBy({
          by: ['categoryId'],
          where: {
            status: 'POSTED',
            date: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

      // By category breakdown
      const categoryIds = [...new Set(categoryAgg.map((a) => a.categoryId))];
      const categories = await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      });
      const catMap = new Map(categories.map((c) => [c.id, c.name]));

      const byCategory = categoryAgg.map((a) => ({
        categoryId: a.categoryId,
        categoryName: catMap.get(a.categoryId) || 'Unknown',
        total: Math.round(Number(a._sum.amount || 0) * 100) / 100,
        count: a._count.id,
      }));

      // By payment method
      const pmMap = new Map<string, { total: number; count: number }>();
      for (const e of expenses) {
        if (!pmMap.has(e.paymentMethod)) pmMap.set(e.paymentMethod, { total: 0, count: 0 });
        const row = pmMap.get(e.paymentMethod)!;
        row.total = Math.round((row.total + Number(e.amount)) * 100) / 100;
        row.count++;
      }
      const byPaymentMethod = Array.from(pmMap.entries()).map(([pm, data]) => ({
        paymentMethod: pm,
        total: data.total,
        count: data.count,
      }));

      return {
        period: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        expensesCount: expenses.length,
        byCategory,
        byPaymentMethod,
      };
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch expense report' };
    }
  });

  // --------------------------------------------------------------------------
  // TAX SUMMARY
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/tax-summary', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const q = getQ(request);
      const { startDate, endDate, periodLabel } = reportService.resolveDateRange({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });

      const prisma = getPrismaClient();

      // Sales tax (output tax) — only POSTED sales
      const [saleItemsAgg, purchaseItemsAgg, saleReturnItemsAgg, purchaseReturnItemsAgg] =
        await Promise.all([
          prisma.saleItem.findMany({
            where: {
              sale: { status: 'POSTED', saleDate: { gte: startDate, lte: endDate } },
            },
            select: { lineTotal: true, taxAmount: true, taxRate: true, discount: true, quantity: true, sellingPrice: true },
          }),
          prisma.purchaseItem.findMany({
            where: {
              purchase: { status: 'POSTED', purchaseDate: { gte: startDate, lte: endDate } },
            },
            select: { lineTotal: true, taxAmount: true, taxRate: true },
          }),
          prisma.salesReturnItem.findMany({
            where: {
              salesReturn: { status: 'POSTED', returnDate: { gte: startDate, lte: endDate } },
            },
            select: { taxAmount: true, lineTotal: true, taxRate: true },
          }),
          prisma.purchaseReturnItem.findMany({
            where: {
              purchaseReturn: { status: 'POSTED', returnDate: { gte: startDate, lte: endDate } },
            },
            select: { taxAmount: true, lineTotal: true },
          }),
        ]);

      // Only count items with taxRate > 0 as taxable
      let taxableSalesAmount = 0;
      let outputTaxAmount = 0;
      for (const item of saleItemsAgg) {
        if (Number(item.taxRate) > 0) {
          taxableSalesAmount = Math.round((taxableSalesAmount + Number(item.lineTotal) - Number(item.taxAmount)) * 100) / 100;
          outputTaxAmount = Math.round((outputTaxAmount + Number(item.taxAmount)) * 100) / 100;
        }
      }

      let taxablePurchasesAmount = 0;
      let inputTaxAmount = 0;
      for (const item of purchaseItemsAgg) {
        if (Number(item.taxRate) > 0) {
          taxablePurchasesAmount = Math.round((taxablePurchasesAmount + Number(item.lineTotal) - Number(item.taxAmount)) * 100) / 100;
          inputTaxAmount = Math.round((inputTaxAmount + Number(item.taxAmount)) * 100) / 100;
        }
      }

      const salesReturnTaxAmount = Math.round(
        saleReturnItemsAgg.reduce((acc, i) => acc + Number(i.taxAmount), 0) * 100
      ) / 100;
      const purchaseReturnTaxAmount = Math.round(
        purchaseReturnItemsAgg.reduce((acc, i) => acc + Number(i.taxAmount), 0) * 100
      ) / 100;

      const netOutputTax = Math.max(0, Math.round((outputTaxAmount - salesReturnTaxAmount) * 100) / 100);
      const netInputTax = Math.max(0, Math.round((inputTaxAmount - purchaseReturnTaxAmount) * 100) / 100);
      const netTaxLiability = Math.round((netOutputTax - netInputTax) * 100) / 100;

      return {
        period: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        taxableSalesAmount,
        outputTaxAmount,
        taxablePurchasesAmount,
        inputTaxAmount,
        salesReturnTaxAmount,
        purchaseReturnTaxAmount,
        netOutputTax,
        netInputTax,
        netTaxLiability,
      };
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Failed to fetch tax summary' };
    }
  });

  // --------------------------------------------------------------------------
  // PROFIT SUMMARY — also accessible from /api/reports/profit-summary
  // (the canonical one exists in expense.routes.ts — this provides an alias)
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/profit', async (request, reply) => {
    const token = getToken(request);
    try {
      const session = AuthGuard.verifySession(token);
      await auditService.log({
        userId: session.user.id,
        action: 'PROFIT_REPORT_ACCESSED',
        entityType: 'ProfitReport',
        entityId: undefined,
        newValue: JSON.stringify({ accessedBy: session.user.username }),
      });
      const q = getQ(request);
      return await reportService.getProfitSummary({
        period: q.period,
        startDate: q.startDate,
        endDate: q.endDate,
      });
    } catch (err: any) {
      reply.status(err?.message?.includes('Authentication') ? 401 : 400);
      return { error: err?.message || 'Authentication required' };
    }
  });
};
