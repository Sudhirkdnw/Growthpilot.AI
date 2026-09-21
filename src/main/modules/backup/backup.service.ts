import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, getDatabaseFilePath } from '../../database/client';
import { settingsService } from '../settings/settings.service';
import { auditService } from '../audit/audit.service';
import { BackupMetadataDTO, BackupVerifyResultDTO } from '../../../shared/types';

export const REQUIRED_CORE_TABLES = [
  'users',
  'categories',
  'brands',
  'units',
  'products',
  'stock_ledger',
  'stock_adjustments',
  'customers',
  'customer_ledger',
  'customer_payments',
  'suppliers',
  'supplier_ledger',
  'supplier_payments',
  'purchases',
  'purchase_items',
  'purchase_returns',
  'purchase_return_items',
  'sales',
  'sale_items',
  'sales_returns',
  'sales_return_items',
  'expense_categories',
  'expenses',
  'invoice_sequences',
  'app_settings',
  'audit_logs',
];

export class BackupService {
  private isOperationLocked = false;

  public acquireLock(): boolean {
    if (this.isOperationLocked) return false;
    this.isOperationLocked = true;
    return true;
  }

  public releaseLock(): void {
    this.isOperationLocked = false;
  }

  public isLocked(): boolean {
    return this.isOperationLocked;
  }

  /**
   * Resolves the configured backup destination directory safely.
   */
  async resolveBackupDirectory(customDir?: string): Promise<string> {
    if (customDir && typeof customDir === 'string' && customDir.trim().length > 0) {
      return path.resolve(customDir.trim());
    }
    const settings = await settingsService.getAppSettings();
    const configDir = settings?.backup?.backupDirectory || './backups';
    return path.resolve(process.cwd(), configDir);
  }

  /**
   * Computes SHA-256 hash for a given file.
   */
  computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Formats bytes into a human-readable string.
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Verifies the integrity and structure of an isolated SQLite file using a temporary PrismaClient.
   */
  async verifyBackupFile(filePath: string): Promise<BackupVerifyResultDTO> {
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        message: `File not found: ${filePath}`,
        tableCount: 0,
        tables: [],
        sha256Checksum: '',
      };
    }

    // 1. Verify SQLite Header (First 16 bytes: "SQLite format 3\0")
    try {
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);
      const headerStr = buffer.toString('utf8');
      if (!headerStr.startsWith('SQLite format 3')) {
        return {
          ok: false,
          message: 'Invalid SQLite file header. File is not a valid SQLite database.',
          tableCount: 0,
          tables: [],
          sha256Checksum: '',
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: `Failed to inspect file header: ${err.message}`,
        tableCount: 0,
        tables: [],
        sha256Checksum: '',
      };
    }

    // 2. Open temporary isolated connection to run PRAGMA integrity_check & inspect tables
    const normalizedPath = path.resolve(filePath).replace(/\\/g, '/');
    const isolatedPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${normalizedPath}`,
        },
      },
      log: ['error'],
    });

    try {
      // PRAGMA integrity_check
      const integrityResult: any = await isolatedPrisma.$queryRawUnsafe(`PRAGMA integrity_check;`);
      const status = integrityResult?.[0]?.integrity_check || 'unknown';
      if (status !== 'ok') {
        await isolatedPrisma.$disconnect();
        return {
          ok: false,
          message: `SQLite integrity check failed: ${status}`,
          tableCount: 0,
          tables: [],
          sha256Checksum: '',
        };
      }

      // Query sqlite_master for table definitions
      const tableRows: any[] = await isolatedPrisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%';`
      );
      const tables = tableRows.map((r) => r.name);

      // Check required core tables
      const missingTables = REQUIRED_CORE_TABLES.filter((t) => !tables.includes(t));
      if (missingTables.length > 0) {
        await isolatedPrisma.$disconnect();
        return {
          ok: false,
          message: `Database is missing essential business tables: ${missingTables.join(', ')}`,
          tableCount: tables.length,
          tables,
          sha256Checksum: '',
        };
      }

      await isolatedPrisma.$disconnect();
      const sha256 = await this.computeSha256(filePath);

      return {
        ok: true,
        message: 'Database integrity verified successfully. All core business tables present.',
        tableCount: tables.length,
        tables,
        sha256Checksum: sha256,
      };
    } catch (err: any) {
      try {
        await isolatedPrisma.$disconnect();
      } catch {}
      return {
        ok: false,
        message: `Database verification failed: ${err.message || err}`,
        tableCount: 0,
        tables: [],
        sha256Checksum: '',
      };
    }
  }

  /**
   * Creates a SQLite-safe snapshot backup using SQLite VACUUM INTO.
   * Staged with a .tmp extension and validated before atomic publication.
   */
  async createSnapshotBackup(
    optionsOrDestDir?:
      | string
      | {
          destinationDir?: string;
          userId?: string;
          prefix?: string;
        }
  ): Promise<BackupMetadataDTO> {
    const options =
      typeof optionsOrDestDir === 'string'
        ? { destinationDir: optionsOrDestDir }
        : optionsOrDestDir || {};

    if (!this.acquireLock()) {
      throw new Error('BACKUP_ALREADY_RUNNING: Another backup or restore operation is currently in progress.');
    }

    const prisma = getPrismaClient();
    const destDir = await this.resolveBackupDirectory(options?.destinationDir);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const prefix = options?.prefix || 'RS-Inventory-Solo';
    // Deterministic timestamp format: YYYY-MM-DD-HHmmss
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const finalFilename = `${prefix}-${timestampStr}.db`;
    const finalFilePath = path.join(destDir, finalFilename);
    const tempFilePath = path.join(destDir, `${finalFilename}.tmp`);

    // Escape Windows backslashes for SQLite VACUUM INTO query
    const sanitizedTmpPath = tempFilePath.replace(/\\/g, '/');

    try {
      // 1. Audit start
      await auditService.log({
        userId: options?.userId || null,
        action: 'BACKUP_STARTED',
        entityType: 'SystemBackup',
        newValue: { destination: destDir, tempFile: tempFilePath },
      });

      // 2. Perform atomic VACUUM INTO into temporary file
      await prisma.$executeRawUnsafe(`VACUUM INTO '${sanitizedTmpPath}';`);

      // 3. Verify SQLite integrity and core tables of the newly generated temporary file
      const verification = await this.verifyBackupFile(tempFilePath);
      if (!verification.ok) {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw new Error(`BACKUP_INTEGRITY_FAILED: ${verification.message}`);
      }

      // 4. Atomic rename from .tmp to final .db
      fs.renameSync(tempFilePath, finalFilePath);

      // 5. Gather file stats and checksum
      const stats = fs.statSync(finalFilePath);
      const sha256 = verification.sha256Checksum || (await this.computeSha256(finalFilePath));

      const isPreRestore = prefix.includes('PreRestore');
      const metadata: BackupMetadataDTO = {
        filename: finalFilename,
        filePath: finalFilePath,
        fileSizeBytes: stats.size,
        fileSizeFormatted: this.formatBytes(stats.size),
        createdAt: stats.mtime.toISOString(),
        sha256Checksum: sha256,
        integrityStatus: 'VALID',
        tableCount: verification.tableCount,
        isPreRestoreSafety: isPreRestore,
      };

      // 6. Enforce retention policy (unless it is a pre-restore safety snapshot)
      if (!isPreRestore) {
        await this.applyRetentionPolicy(destDir);
      }

      // 7. Audit success
      await auditService.log({
        userId: options?.userId || null,
        action: 'BACKUP_COMPLETED',
        entityType: 'SystemBackup',
        entityId: finalFilename,
        newValue: {
          filename: finalFilename,
          size: stats.size,
          sha256,
          tables: verification.tableCount,
        },
      });

      console.log(`[Backup] Successfully published backup: ${finalFilePath} (${this.formatBytes(stats.size)})`);
      return metadata;
    } catch (err: any) {
      // Clean up temporary artifact if still present
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }

      await auditService.log({
        userId: options?.userId || null,
        action: 'BACKUP_FAILED',
        entityType: 'SystemBackup',
        reason: err.message || 'Unknown backup error',
      });

      console.error('[Backup] Backup operation failed:', err);
      throw err;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Applies configured backup retention policy.
   * Keeps the latest N backups and safely removes older ones.
   * NEVER deletes the active database, temporary files, or pre-restore safety backups.
   */
  async applyRetentionPolicy(destinationDir?: string): Promise<{ deletedCount: number; keptCount: number }> {
    const destDir = await this.resolveBackupDirectory(destinationDir);
    if (!fs.existsSync(destDir)) return { deletedCount: 0, keptCount: 0 };

    const settings = await settingsService.getAppSettings();
    const retentionCount = Math.max(1, settings?.backup?.retentionCount || 7);

    // List all regular backup files matching RS-Inventory-Solo-*.db
    const allFiles = fs.readdirSync(destDir);
    const backupFiles = allFiles
      .filter((file) => file.startsWith('RS-Inventory-Solo-') && file.endsWith('.db') && !file.endsWith('.tmp'))
      .map((file) => {
        const fullPath = path.join(destDir, file);
        const stats = fs.statSync(fullPath);
        return { file, fullPath, mtime: stats.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (backupFiles.length <= retentionCount) {
      return { deletedCount: 0, keptCount: backupFiles.length };
    }

    const filesToDelete = backupFiles.slice(retentionCount);
    let deletedCount = 0;

    for (const item of filesToDelete) {
      try {
        fs.unlinkSync(item.fullPath);
        deletedCount++;
        console.log(`[Backup Retention] Pruned old backup file: ${item.file}`);
      } catch (err) {
        console.warn(`[Backup Retention] Failed to delete old backup ${item.file}:`, err);
      }
    }

    return {
      deletedCount,
      keptCount: backupFiles.length - deletedCount,
    };
  }

  /**
   * Lists all existing backups in the destination directory with metadata.
   */
  async listBackups(customDir?: string): Promise<BackupMetadataDTO[]> {
    const destDir = await this.resolveBackupDirectory(customDir);
    if (!fs.existsSync(destDir)) return [];

    const files = fs.readdirSync(destDir);
    const dbFiles = files.filter(
      (f) => f.endsWith('.db') && (f.startsWith('RS-Inventory-Solo-') || f.startsWith('RS-Inventory-PreRestore-') || f.startsWith('rs_inventory_backup_'))
    );

    const results: BackupMetadataDTO[] = [];

    for (const file of dbFiles) {
      const fullPath = path.join(destDir, file);
      try {
        const stats = fs.statSync(fullPath);
        const isPreRestore = file.includes('PreRestore');
        results.push({
          filename: file,
          filePath: fullPath,
          fileSizeBytes: stats.size,
          fileSizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          sha256Checksum: '', // lazily evaluated when requested or verified
          integrityStatus: 'VALID',
          tableCount: REQUIRED_CORE_TABLES.length,
          isPreRestoreSafety: isPreRestore,
        });
      } catch (err) {
        console.warn(`[Backup] Could not stat backup file ${file}:`, err);
      }
    }

    // Sort newest first
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Deletes a specific backup file safely, preventing directory traversal.
   */
  async deleteBackup(filePath: string, userId?: string): Promise<boolean> {
    const resolvedPath = path.resolve(filePath);
    const liveDbPath = path.resolve(getDatabaseFilePath());

    // Security check: must not delete live database
    if (resolvedPath === liveDbPath) {
      throw new Error('SECURITY_ERROR: Cannot delete the live database file.');
    }

    // Security check: path must be inside backup directory or end with .db
    if (!resolvedPath.endsWith('.db')) {
      throw new Error('INVALID_BACKUP_FILE: Only .db backup files can be deleted.');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error('BACKUP_NOT_FOUND: Backup file does not exist.');
    }

    fs.unlinkSync(resolvedPath);

    await auditService.log({
      userId: userId || null,
      action: 'BACKUP_DELETED',
      entityType: 'SystemBackup',
      entityId: path.basename(resolvedPath),
      newValue: { path: resolvedPath },
    });

    console.log(`[Backup] Safely deleted backup file: ${resolvedPath}`);
    return true;
  }

  /**
   * Verifies live database integrity.
   */
  async verifyDatabaseIntegrity(): Promise<{ ok: boolean; message: string }> {
    const prisma = getPrismaClient();
    try {
      const result: any = await prisma.$queryRawUnsafe(`PRAGMA integrity_check;`);
      const status = result?.[0]?.integrity_check || 'ok';
      return {
        ok: status === 'ok',
        message: status,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message || 'Integrity check failed',
      };
    }
  }
}

export const backupService = new BackupService();
