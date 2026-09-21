import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { backupService } from '../../modules/backup/backup.service';
import { restoreService } from '../../modules/backup/restore.service';
import { AuthGuard } from '../plugins/authGuard';

export const maintenanceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. List Available Backups (Cashier or Admin)
  fastify.get('/api/maintenance/backups', async (request) => {
    const customDir = (request.query as any)?.directory;
    const backups = await backupService.listBackups(customDir);
    return { success: true, backups };
  });

  // 2. Create Snapshot Backup (Manual "Backup Now")
  fastify.post('/api/maintenance/backup', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = await AuthGuard.requirePermission(token, 'backup.run');
      const metadata = await backupService.createSnapshotBackup({
        userId: session.user.id,
      });
      return { success: true, backup: metadata };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err.message || 'Backup failed' };
    }
  });

  // 3. Verify Backup File Integrity & Schema
  fastify.post('/api/maintenance/verify', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { filePath } = (request.body as any) || {};

    if (!filePath || typeof filePath !== 'string') {
      reply.status(400);
      return { success: false, error: 'filePath is required' };
    }

    try {
      await AuthGuard.requirePermission(token, 'backup.run');
      const result = await backupService.verifyBackupFile(filePath);
      return { success: true, verification: result };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err.message || 'Verification failed' };
    }
  });

  // 4. Delete Backup File — STRICT ADMIN / BACKUP RESTORE
  fastify.delete('/api/maintenance/backups', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { filePath } = (request.body as any) || {};

    if (!filePath || typeof filePath !== 'string') {
      reply.status(400);
      return { success: false, error: 'filePath is required' };
    }

    try {
      const session = await AuthGuard.requirePermission(token, 'backup.restore');
      await backupService.deleteBackup(filePath, session.user.id);
      return { success: true, message: 'Backup file deleted successfully' };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err.message || 'Unauthorized backup deletion' };
    }
  });

  // 5. Destructive Database Restore — STRICT DANGEROUS PERMISSION: backup.restore
  fastify.post('/api/maintenance/restore', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { backupFilePath } = (request.body as any) || {};

    if (!backupFilePath || typeof backupFilePath !== 'string') {
      reply.status(400);
      return { success: false, error: 'backupFilePath is required' };
    }

    try {
      const session = await AuthGuard.requirePermission(token, 'backup.restore');
      const result = await restoreService.restoreDatabase(backupFilePath, session.user.id);
      return { success: true, result };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err.message || 'Restore operation failed' };
    }
  });

};
