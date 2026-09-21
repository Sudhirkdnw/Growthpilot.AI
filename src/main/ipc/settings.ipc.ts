import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerSettingsIpc() {
  ipcMain.handle('settings:get', async () => {
    return await dispatchFastify('GET', '/api/settings');
  });

  ipcMain.handle('settings:update', async (_, { settings, token }) => {
    return await dispatchFastify(
      'PUT',
      '/api/settings',
      { settings, token },
      { authorization: token }
    );
  });

  ipcMain.handle('settings:testSmtp', async (_, { config, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/settings/test-smtp',
      { config },
      { authorization: token }
    );
  });

  ipcMain.handle('admin:getSystemHealth', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      `/api/admin/system-health?token=${encodeURIComponent(token || '')}`,
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:listUsers', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      `/api/admin/users?token=${encodeURIComponent(token || '')}`,
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:createUser', async (_, { user, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/admin/users',
      user,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:updateUser', async (_, { id, updates, token }) => {
    return await dispatchFastify(
      'PUT',
      `/api/admin/users/${id}`,
      updates,
      { authorization: token }
    );
  });
}
