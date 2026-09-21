import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerRoleIpc() {
  ipcMain.handle('admin:getPermissions', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      `/api/admin/permissions?token=${encodeURIComponent(token || '')}`,
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:listRoles', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      `/api/admin/roles?token=${encodeURIComponent(token || '')}`,
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:getRole', async (_, { id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/admin/roles/${id}?token=${encodeURIComponent(token || '')}`,
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:createRole', async (_, { role, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/admin/roles',
      role,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:updateRole', async (_, { id, updates, token }) => {
    return await dispatchFastify(
      'PUT',
      `/api/admin/roles/${id}`,
      updates,
      { authorization: token }
    );
  });

  ipcMain.handle('admin:deleteRole', async (_, { id, token }) => {
    return await dispatchFastify(
      'DELETE',
      `/api/admin/roles/${id}`,
      undefined,
      { authorization: token }
    );
  });
}
