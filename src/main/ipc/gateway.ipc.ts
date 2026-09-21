import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerGatewayIpc() {
  ipcMain.handle('gateways:test', async (_, { gateway, config, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/test',
      { gateway, config },
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:createOrder', async (_, { payload, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/create-order',
      payload,
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:checkStatus', async (_, { gateway, orderId, attemptId, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/check-status',
      { gateway, orderId, attemptId },
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:cancel', async (_, { attemptId, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/cancel-attempt',
      { attemptId },
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:manualOverride', async (_, { payload, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/manual-override',
      payload,
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:unreconciled', async (_, { token }) => {
    return await dispatchFastify(
      'GET',
      '/api/gateways/unreconciled',
      undefined,
      { authorization: token }
    );
  });

  ipcMain.handle('gateways:recover', async (_, { attemptId, token }) => {
    return await dispatchFastify(
      'POST',
      '/api/gateways/recover-payment',
      { attemptId },
      { authorization: token }
    );
  });
}
