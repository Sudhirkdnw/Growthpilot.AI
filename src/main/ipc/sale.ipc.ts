import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerSaleIpc() {
  // List Sales
  ipcMain.handle('sales:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.customerId) params.append('customerId', query.customerId);
    if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
    if (query?.status) params.append('status', query.status);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/sales?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Sale by ID
  ipcMain.handle('sales:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/sales/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Sale
  ipcMain.handle('sales:create', async (_, { sale, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/sales',
      sale,
      token ? { authorization: token } : undefined
    );
  });

  // Cancel Sale
  ipcMain.handle('sales:cancel', async (_, { id, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/sales/${id}/cancel`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });
}
