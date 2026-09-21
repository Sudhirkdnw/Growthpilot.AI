import { ipcMain } from 'electron';
import { dispatchFastify } from '../fastify/server';

export function registerMaintenanceIpc() {
  // 1. List Backups
  ipcMain.handle('maintenance:listBackups', async (_, directory?: string) => {
    const query = directory ? `?directory=${encodeURIComponent(directory)}` : '';
    return await dispatchFastify('GET', `/api/maintenance/backups${query}`);
  });

  // 2. Create Backup
  ipcMain.handle('maintenance:createBackup', async (_, { token }: { token: string }) => {
    return await dispatchFastify(
      'POST',
      '/api/maintenance/backup',
      { token },
      { authorization: token }
    );
  });

  // 3. Verify Integrity
  ipcMain.handle('maintenance:verifyIntegrity', async (_, { token, filePath }: { token: string; filePath: string }) => {
    return await dispatchFastify(
      'POST',
      '/api/maintenance/verify',
      { token, filePath },
      { authorization: token }
    );
  });

  // 4. Restore Backup (Strict Admin)
  ipcMain.handle('maintenance:restoreBackup', async (_, { token, backupFilePath }: { token: string; backupFilePath: string }) => {
    return await dispatchFastify(
      'POST',
      '/api/maintenance/restore',
      { token, backupFilePath },
      { authorization: token }
    );
  });

  // 5. Delete Backup (Strict Admin)
  ipcMain.handle('maintenance:deleteBackup', async (_, { token, filePath }: { token: string; filePath: string }) => {
    return await dispatchFastify(
      'DELETE',
      '/api/maintenance/backups',
      { token, filePath },
      { authorization: token }
    );
  });
}
