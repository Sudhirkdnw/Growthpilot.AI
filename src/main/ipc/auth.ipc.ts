import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerAuthIpc() {
  ipcMain.handle('auth:isFirstRun', async () => {
    const res = await dispatchFastify('GET', '/api/auth/first-run');
    return res.isFirstRun;
  });

  ipcMain.handle('auth:setupFirstRun', async (_, wizardData) => {
    return await dispatchFastify('POST', '/api/auth/first-run/setup', wizardData);
  });

  ipcMain.handle('auth:login', async (_, credentials) => {
    return await dispatchFastify('POST', '/api/auth/login', credentials);
  });

  ipcMain.handle('auth:logout', async (_, token) => {
    return await dispatchFastify('POST', '/api/auth/logout', { token });
  });

  ipcMain.handle('auth:getSession', async (_, token) => {
    const res = await dispatchFastify('GET', `/api/auth/session?token=${encodeURIComponent(token)}`);
    return res.session;
  });

  ipcMain.handle('auth:lockSession', async (_, token) => {
    return await dispatchFastify('POST', '/api/auth/lock', { token });
  });

  ipcMain.handle('auth:unlockSession', async (_, { token, password }) => {
    return await dispatchFastify('POST', '/api/auth/unlock', { token, password });
  });
}
