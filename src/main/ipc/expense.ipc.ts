import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerExpenseIpc() {
  // --------------------------------------------------------------------------
  // EXPENSE CATEGORIES
  // --------------------------------------------------------------------------

  // List Categories
  ipcMain.handle('expenseCategories:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/expense-categories?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Category
  ipcMain.handle('expenseCategories:create', async (_, { category, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/expense-categories',
      category,
      token ? { authorization: token } : undefined
    );
  });

  // Update Category
  ipcMain.handle('expenseCategories:update', async (_, { id, category, token }) => {
    return await dispatchFastify(
      'PUT',
      `/api/expense-categories/${id}`,
      category,
      token ? { authorization: token } : undefined
    );
  });

  // Delete Category
  ipcMain.handle('expenseCategories:delete', async (_, { id, token }) => {
    return await dispatchFastify(
      'DELETE',
      `/api/expense-categories/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------

  // List Expenses
  ipcMain.handle('expenses:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.categoryId) params.append('categoryId', query.categoryId);
    if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/expenses?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Expense By ID
  ipcMain.handle('expenses:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/expenses/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Expense
  ipcMain.handle('expenses:create', async (_, { expense, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/expenses',
      expense,
      token ? { authorization: token } : undefined
    );
  });

  // Cancel Expense
  ipcMain.handle('expenses:cancel', async (_, { id, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/expenses/${id}/cancel`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });

  // --------------------------------------------------------------------------
  // PROFIT SUMMARY
  // --------------------------------------------------------------------------
  ipcMain.handle('reports:getProfitSummary', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.period) params.append('period', query.period);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/reports/profit-summary?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });
}
