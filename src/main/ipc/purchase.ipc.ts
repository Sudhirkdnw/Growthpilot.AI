import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerPurchaseIpc() {
  // List Purchases
  ipcMain.handle('purchases:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.supplierId) params.append('supplierId', query.supplierId);
    if (query?.status) params.append('status', query.status);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/purchases?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Purchase by ID
  ipcMain.handle('purchases:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/purchases/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Purchase
  ipcMain.handle('purchases:create', async (_, { purchase, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/purchases',
      purchase,
      token ? { authorization: token } : undefined
    );
  });

  // Cancel Purchase
  ipcMain.handle('purchases:cancel', async (_, { id, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/purchases/${id}/cancel`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });
}
