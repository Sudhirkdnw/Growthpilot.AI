import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerCustomerIpc() {
  // List Customers
  ipcMain.handle('customers:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.hasOutstanding !== undefined) params.append('hasOutstanding', String(query.hasOutstanding));
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/customers?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Receivables Summary
  ipcMain.handle('customers:getReceivablesSummary', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      '/api/customers/receivables/summary',
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Customer by ID
  ipcMain.handle('customers:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/customers/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Customer
  ipcMain.handle('customers:create', async (_, { customer, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/customers',
      customer,
      token ? { authorization: token } : undefined
    );
  });

  // Update Customer
  ipcMain.handle('customers:update', async (_, { id, customer, token }) => {
    return await dispatchFastify(
      'PUT',
      `/api/customers/${id}`,
      customer,
      token ? { authorization: token } : undefined
    );
  });

  // Delete Customer
  ipcMain.handle('customers:delete', async (_, { id, token }) => {
    return await dispatchFastify(
      'DELETE',
      `/api/customers/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Customer Ledger History
  ipcMain.handle('customers:getLedger', async (_, { customerId, type, startDate, endDate, page, pageSize, token }) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));

    return await dispatchFastify(
      'GET',
      `/api/customers/${customerId}/ledger?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Record Customer Payment
  ipcMain.handle('customers:recordPayment', async (_, { payment, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/customers/${payment.customerId}/payments`,
      payment,
      token ? { authorization: token } : undefined
    );
  });

  // Reverse Customer Payment
  ipcMain.handle('customers:reversePayment', async (_, { paymentId, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/customers/payments/${paymentId}/reverse`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });

  // Customer Statement
  ipcMain.handle('customers:getStatement', async (_, { customerId, startDate, endDate, token }) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return await dispatchFastify(
      'GET',
      `/api/customers/${customerId}/statement?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Customer Reconciliation
  ipcMain.handle('customers:reconcile', async (_, { customerId, autoFix, token }) => {
    if (autoFix) {
      return await dispatchFastify(
        'POST',
        `/api/customers/${customerId}/reconcile`,
        { autoFix: true },
        token ? { authorization: token } : undefined
      );
    }
    return await dispatchFastify(
      'GET',
      `/api/customers/${customerId}/reconcile`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });
}
