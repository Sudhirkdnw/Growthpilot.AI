import { backupService } from './backup.service';
import { settingsService } from '../settings/settings.service';

export class AutoBackupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastBackupTime: number = 0;

  /**
   * Starts the background automatic backup scheduler.
   * Runs an hourly check to ensure daily backups occur gracefully without crashing POS.
   */
  start(): void {
    if (this.timer) {
      console.log('[AutoBackup] Scheduler is already active.');
      return;
    }

    console.log('[AutoBackup] Initializing automatic backup scheduler (hourly check interval).');

    // Run first check after 30 seconds of app start, then every hour
    setTimeout(() => {
      this.executeCheck().catch((err) => {
        console.warn('[AutoBackup] Initial check failed:', err);
      });
    }, 30000);

    this.timer = setInterval(() => {
      this.executeCheck().catch((err) => {
        console.warn('[AutoBackup] Scheduled check failed:', err);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AutoBackup] Scheduler stopped.');
    }
  }

  private async executeCheck(): Promise<void> {
    if (this.isRunning) return;

    try {
      const settings = await settingsService.getAppSettings();
      if (!settings?.backup?.autoBackupDaily) {
        return;
      }

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Check if 24 hours elapsed since last backup
      if (now - this.lastBackupTime < twentyFourHours) {
        return;
      }

      // Check existing backups to determine if one was created in the last 24h
      const existingBackups = await backupService.listBackups();
      const regularBackups = existingBackups.filter((b) => !b.isPreRestoreSafety);
      if (regularBackups.length > 0) {
        const newest = new Date(regularBackups[0].createdAt).getTime();
        if (now - newest < twentyFourHours) {
          this.lastBackupTime = newest;
          return;
        }
      }

      this.isRunning = true;
      console.log('[AutoBackup] Executing scheduled automatic daily SQLite snapshot...');
      const metadata = await backupService.createSnapshotBackup({
        prefix: 'RS-Inventory-Solo-Auto',
      });
      this.lastBackupTime = now;
      console.log(`[AutoBackup] Auto backup completed successfully: ${metadata.filename}`);
    } catch (err: any) {
      console.error('[AutoBackup] Scheduled auto-backup encountered an error (POS unaffected):', err.message || err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const autoBackupScheduler = new AutoBackupScheduler();
