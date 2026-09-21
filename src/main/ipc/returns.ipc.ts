import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerReturnsIpc() {
  // ==========================================================================
  // SALES RETURNS IPC
  // ==========================================================================

  // Get Returnable Details for a Sale
  ipcMain.handle('salesReturns:getReturnable', async (_, { saleId, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/sales/${saleId}/returnable`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Sales Return
  ipcMain.handle('salesReturns:create', async (_, { returnData, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/sales-returns',
      returnData,
      token ? { authorization: token } : undefined
    );
  });

  // List Sales Returns
  ipcMain.handle('salesReturns:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.customerId) params.append('customerId', query.customerId);
    if (query?.status) params.append('status', query.status);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/sales-returns?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Sales Return by ID
  ipcMain.handle('salesReturns:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/sales-returns/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Cancel Sales Return
  ipcMain.handle('salesReturns:cancel', async (_, { id, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/sales-returns/${id}/cancel`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });

  // ==========================================================================
  // PURCHASE RETURNS IPC
  // ==========================================================================

  // Get Returnable Details for a Purchase
  ipcMain.handle('purchaseReturns:getReturnable', async (_, { purchaseId, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/purchases/${purchaseId}/returnable`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Purchase Return
  ipcMain.handle('purchaseReturns:create', async (_, { returnData, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/purchase-returns',
      returnData,
      token ? { authorization: token } : undefined
    );
  });

  // List Purchase Returns
  ipcMain.handle('purchaseReturns:list', async (_, query) => {
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
      `/api/purchase-returns?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Purchase Return by ID
  ipcMain.handle('purchaseReturns:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/purchase-returns/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Cancel Purchase Return
  ipcMain.handle('purchaseReturns:cancel', async (_, { id, reason, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/purchase-returns/${id}/cancel`,
      { reason },
      token ? { authorization: token } : undefined
    );
  });
}
