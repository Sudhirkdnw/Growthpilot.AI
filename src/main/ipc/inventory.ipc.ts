import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerInventoryIpc() {
  // Summary Metrics
  ipcMain.handle('inventory:getSummary', async () => {
    return await dispatchFastify('GET', '/api/inventory/summary');
  });

  // Stock Ledger History
  ipcMain.handle('inventory:getLedger', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.productId) params.append('productId', query.productId);
    if (query?.transactionType) params.append('transactionType', query.transactionType);
    if (query?.search) params.append('search', query.search);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    return await dispatchFastify('GET', `/api/inventory/ledger?${params.toString()}`);
  });

  // Low Stock & Out of Stock Alerts
  ipcMain.handle('inventory:getLowStock', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    return await dispatchFastify('GET', `/api/inventory/low-stock?${params.toString()}`);
  });

  // Stock Adjustment
  ipcMain.handle('inventory:adjustStock', async (_, { adjustment, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/inventory/adjust',
      { ...adjustment, token },
      { authorization: token }
    );
  });

  // Reconciliation for single product
  ipcMain.handle('inventory:reconcile', async (_, productId) => {
    return await dispatchFastify('GET', `/api/inventory/reconcile/${productId}`);
  });

  // Bulk Reconciliation Scanner
  ipcMain.handle('inventory:reconcileAll', async () => {
    return await dispatchFastify('GET', '/api/inventory/reconcile');
  });
}
