import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerProductIpc() {
  // Categories
  ipcMain.handle('categories:list', async (_, includeInactive) => {
    return await dispatchFastify('GET', `/api/categories?includeInactive=${includeInactive ? 'true' : 'false'}`);
  });

  ipcMain.handle('categories:create', async (_, { name, description, token }) => {
    return await dispatchFastify('POST', '/api/categories', { name, description, token }, { authorization: token });
  });

  ipcMain.handle('categories:update', async (_, { id, data, token }) => {
    return await dispatchFastify('PUT', `/api/categories/${id}`, { ...data, token }, { authorization: token });
  });

  ipcMain.handle('categories:delete', async (_, { id, token }) => {
    return await dispatchFastify('DELETE', `/api/categories/${id}`, null, { authorization: token });
  });

  // Brands
  ipcMain.handle('brands:list', async (_, includeInactive) => {
    return await dispatchFastify('GET', `/api/brands?includeInactive=${includeInactive ? 'true' : 'false'}`);
  });

  ipcMain.handle('brands:create', async (_, { name, token }) => {
    return await dispatchFastify('POST', '/api/brands', { name, token }, { authorization: token });
  });

  ipcMain.handle('brands:update', async (_, { id, data, token }) => {
    return await dispatchFastify('PUT', `/api/brands/${id}`, { ...data, token }, { authorization: token });
  });

  ipcMain.handle('brands:delete', async (_, { id, token }) => {
    return await dispatchFastify('DELETE', `/api/brands/${id}`, null, { authorization: token });
  });

  // Units
  ipcMain.handle('units:list', async (_, includeInactive) => {
    return await dispatchFastify('GET', `/api/units?includeInactive=${includeInactive ? 'true' : 'false'}`);
  });

  ipcMain.handle('units:create', async (_, { name, shortCode, allowDecimal, token }) => {
    return await dispatchFastify('POST', '/api/units', { name, shortCode, allowDecimal, token }, { authorization: token });
  });

  ipcMain.handle('units:update', async (_, { id, data, token }) => {
    return await dispatchFastify('PUT', `/api/units/${id}`, { ...data, token }, { authorization: token });
  });

  ipcMain.handle('units:delete', async (_, { id, token }) => {
    return await dispatchFastify('DELETE', `/api/units/${id}`, null, { authorization: token });
  });

  // Products
  ipcMain.handle('products:list', async (_, query) => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.categoryId) params.append('categoryId', query.categoryId);
    if (query?.brandId) params.append('brandId', query.brandId);
    if (query?.status) params.append('status', query.status);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));

    return await dispatchFastify('GET', `/api/products?${params.toString()}`);
  });

  ipcMain.handle('products:getById', async (_, id) => {
    return await dispatchFastify('GET', `/api/products/${id}`);
  });

  ipcMain.handle('products:getByBarcode', async (_, barcode) => {
    return await dispatchFastify('GET', `/api/products/search/barcode?barcode=${encodeURIComponent(barcode)}`);
  });

  ipcMain.handle('products:checkName', async (_, { name, excludeId }) => {
    return await dispatchFastify('GET', `/api/products/check-name?name=${encodeURIComponent(name || '')}&excludeId=${excludeId || ''}`);
  });

  ipcMain.handle('products:getNextSku', async () => {
    return await dispatchFastify('GET', '/api/products/next-sku');
  });

  ipcMain.handle('products:generateBarcode', async (_, prefix) => {
    return await dispatchFastify('GET', `/api/products/generate-barcode?prefix=${encodeURIComponent(prefix || '21')}`);
  });

  ipcMain.handle('products:create', async (_, { product, token }) => {
    return await dispatchFastify('POST', '/api/products', { ...product, token }, { authorization: token });
  });

  ipcMain.handle('products:update', async (_, { id, data, token }) => {
    return await dispatchFastify('PUT', `/api/products/${id}`, { ...data, token }, { authorization: token });
  });

  ipcMain.handle('products:delete', async (_, { id, token }) => {
    return await dispatchFastify('DELETE', `/api/products/${id}`, null, { authorization: token });
  });

  ipcMain.handle('products:deactivate', async (_, { id, token }) => {
    return await dispatchFastify('PUT', `/api/products/${id}`, { status: 'INACTIVE', token }, { authorization: token });
  });
}

