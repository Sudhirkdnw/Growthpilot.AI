import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

/**
 * Phase 11 — Report IPC Handlers
 *
 * All channels route through dispatchFastify → Fastify → AuthGuard → ReportService.
 * No direct Prisma access from renderer.
 * `reports:getProfitSummary` already registered in expense.ipc.ts — NOT duplicated here.
 */
export function registerReportsIpc() {
  // --------------------------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getDashboard', async (_, query) => {
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      '/api/reports/dashboard',
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // SALES REPORTS
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getSales', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.customerId) params.append('customerId', query.customerId);
    if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/sales?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getSalesByProduct', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/sales/by-product?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getSalesByCustomer', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/sales/by-customer?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getSalesByPaymentMethod', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/sales/by-payment-method?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getSalesReturns', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/sales/returns?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // PURCHASE REPORTS
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getPurchases', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.supplierId) params.append('supplierId', query.supplierId);
    if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/purchases?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getPurchasesByProduct', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/purchases/by-product?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getPurchasesBySupplier', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/purchases/by-supplier?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getPurchaseReturns', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/purchases/returns?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // INVENTORY REPORTS
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getCurrentStock', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.categoryId) params.append('categoryId', query.categoryId);
    if (query?.stockStatus) params.append('stockStatus', query.stockStatus);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/inventory/current-stock?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getLowStock', async (_, query) => {
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      '/api/reports/inventory/low-stock',
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getStockMovement', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.productId) params.append('productId', query.productId);
    if (query?.transactionType) params.append('transactionType', query.transactionType);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/inventory/stock-movement?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getStockLedger', async (_, { productId, token, ...query }) => {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    return await dispatchFastify(
      'GET',
      `/api/reports/inventory/stock-ledger/${productId}?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // CUSTOMER REPORTS
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getCustomersOutstanding', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/customers/outstanding?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getCustomerLedger', async (_, { customerId, token, ...query }) => {
    const params = new URLSearchParams();
    if (query?.type) params.append('type', query.type);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    return await dispatchFastify(
      'GET',
      `/api/reports/customers/${customerId}/ledger?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // SUPPLIER REPORTS
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getSuppliersOutstanding', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/suppliers/outstanding?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  ipcMain.handle('reports:getSupplierLedger', async (_, { supplierId, token, ...query }) => {
    const params = new URLSearchParams();
    if (query?.type) params.append('type', query.type);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    return await dispatchFastify(
      'GET',
      `/api/reports/suppliers/${supplierId}/ledger?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // EXPENSE REPORT
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getExpensesReport', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.categoryId) params.append('categoryId', query.categoryId);
    if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/expenses?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // TAX SUMMARY
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getTaxSummary', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/tax-summary?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // PROFIT REPORT (audit-logged alias)
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getProfit', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/profit?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  console.log('[IPC] Registered Phase 11 Report IPC handlers.');
}
