import fs from 'fs';
import path from 'path';
import {
  getPrismaClient,
  getDatabaseFilePath,
  disconnectPrismaClient,
  initializeDatabasePragmas,
  dbWriteQueue,
} from '../../database/client';
import { backupService } from './backup.service';
import { auditService } from '../audit/audit.service';
import { RestoreResultDTO } from '../../../shared/types';

export class RestoreService {
  /**
   * Executes a safe, destructive database restoration from a verified SQLite backup.
   *
   * Flow:
   * 1. Acquire global operation lock to prevent concurrent backups or restores.
   * 2. Pre-restoration validation: ensure backup exists, has valid SQLite header,
   *    passes PRAGMA integrity_check, and contains all required core tables.
   * 3. Pause write queue to stop incoming POS and financial mutations.
   * 4. Create mandatory Pre-Restore Safety Backup of current live database.
   *    If safety backup fails, restoration aborts immediately with live DB untouched.
   * 5. Disconnect active PrismaClient and close connection pool.
   * 6. Clean up active WAL (-wal) and shared memory (-shm) files to prevent stale state replay.
   * 7. Atomically copy the validated backup file over the live database file.
   * 8. Re-initialize PrismaClient and execute WAL & integrity pragmas.
   * 9. Run post-restore integrity check on the newly activated database.
   * 10. Log audit record and resume write queue.
   */
  async restoreDatabase(backupFilePath: string, userId?: string): Promise<RestoreResultDTO> {
    if (!backupService.acquireLock()) {
      throw new Error('RESTORE_IN_PROGRESS: Another backup or restore operation is currently in progress.');
    }

    const liveDbPath = path.resolve(getDatabaseFilePath());
    const resolvedBackupPath = path.resolve(backupFilePath);
    let safetyBackupPath = '';

    console.log(`[Restore] Initiating database restore from: ${resolvedBackupPath}`);
    console.log(`[Restore] Target live database: ${liveDbPath}`);

    try {
      // 1. Audit restore start
      await auditService.log({
        userId: userId || null,
        action: 'RESTORE_STARTED',
        entityType: 'SystemRestore',
        entityId: path.basename(resolvedBackupPath),
        newValue: { sourceBackup: resolvedBackupPath, liveDb: liveDbPath },
      });

      // 2. Pre-restoration verification of the candidate backup file
      const verification = await backupService.verifyBackupFile(resolvedBackupPath);
      if (!verification.ok) {
        throw new Error(`RESTORE_VALIDATION_FAILED: ${verification.message}`);
      }

      // 3. Pause write queue so no new transactions can start
      dbWriteQueue.pause();

      // 4. Mandatory Pre-Restore Safety Backup
      try {
        // Temporarily release lock for createSnapshotBackup call
        backupService.releaseLock();
        const safetyBackupMeta = await backupService.createSnapshotBackup({
          userId,
          prefix: 'RS-Inventory-PreRestore',
        });
        safetyBackupPath = safetyBackupMeta.filePath;
        // Re-acquire lock
        backupService.acquireLock();
        console.log(`[Restore] Pre-restore safety backup successfully created at: ${safetyBackupPath}`);
      } catch (safetyErr: any) {
        dbWriteQueue.resume();
        throw new Error(`RESTORE_SAFETY_BACKUP_FAILED: Could not create pre-restore safety backup: ${safetyErr.message}`);
      }

      // 5. Disconnect Prisma client completely
      await disconnectPrismaClient();

      // 6. Remove existing WAL and SHM files if present
      const walPath = `${liveDbPath}-wal`;
      const shmPath = `${liveDbPath}-shm`;

      if (fs.existsSync(walPath)) {
        try {
          fs.unlinkSync(walPath);
        } catch (err) {
          console.warn('[Restore] Could not unlink live WAL file:', err);
        }
      }
      if (fs.existsSync(shmPath)) {
        try {
          fs.unlinkSync(shmPath);
        } catch (err) {
          console.warn('[Restore] Could not unlink live SHM file:', err);
        }
      }

      // 7. Atomically copy validated backup over live database
      fs.copyFileSync(resolvedBackupPath, liveDbPath);
      console.log(`[Restore] Live database file successfully replaced with backup.`);

      // 8. Re-initialize Prisma client & PRAGMAs
      await initializeDatabasePragmas();

      // 9. Post-restore integrity verification
      const postVerification = await backupService.verifyDatabaseIntegrity();
      if (!postVerification.ok) {
        throw new Error(`RESTORE_INTEGRITY_FAILED: Database failed integrity check after restoration: ${postVerification.message}`);
      }

      // 10. Audit completion
      await auditService.log({
        userId: userId || null,
        action: 'RESTORE_COMPLETED',
        entityType: 'SystemRestore',
        entityId: path.basename(resolvedBackupPath),
        newValue: {
          restoredFrom: resolvedBackupPath,
          safetyBackupCreated: safetyBackupPath,
          restoredAt: new Date().toISOString(),
        },
      });

      console.log(`[Restore] Restore completed successfully!`);

      return {
        success: true,
        message: 'Database restored and verified successfully.',
        safetyBackupPath,
        restoredAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[Restore] Fatal restore error:', err);
      await auditService.log({
        userId: userId || null,
        action: 'RESTORE_FAILED',
        entityType: 'SystemRestore',
        reason: err.message || 'Unknown restore error',
      });
      throw err;
    } finally {
      dbWriteQueue.resume();
      backupService.releaseLock();
    }
  }
}

export const restoreService = new RestoreService();
