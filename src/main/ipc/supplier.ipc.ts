import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerSupplierIpc() {
  // List Suppliers
  ipcMain.handle('suppliers:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    const token = query?.token;
    return await dispatchFastify(
      'GET',
      `/api/suppliers?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Get Supplier by ID
  ipcMain.handle('suppliers:getById', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/suppliers/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Create Supplier
  ipcMain.handle('suppliers:create', async (_, { supplier, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/suppliers',
      supplier,
      token ? { authorization: token } : undefined
    );
  });

  // Update Supplier
  ipcMain.handle('suppliers:update', async (_, { id, supplier, token }) => {
    return await dispatchFastify(
      'PUT',
      `/api/suppliers/${id}`,
      supplier,
      token ? { authorization: token } : undefined
    );
  });

  // Delete Supplier
  ipcMain.handle('suppliers:delete', async (_, { id, token }) => {
    return await dispatchFastify(
      'DELETE',
      `/api/suppliers/${id}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Supplier Ledger History
  ipcMain.handle('suppliers:getLedger', async (_, { supplierId, page, pageSize, token }) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (pageSize) params.append('pageSize', String(pageSize));

    return await dispatchFastify(
      'GET',
      `/api/suppliers/${supplierId}/ledger?${params.toString()}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  // Record Supplier Payment
  ipcMain.handle('suppliers:recordPayment', async (_, { payment, token }) => {
    return await dispatchFastify(
      'POST',
      `/api/suppliers/${payment.supplierId}/payments`,
      payment,
      token ? { authorization: token } : undefined
    );
  });
}
