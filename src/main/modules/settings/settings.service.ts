import fs from 'fs';
import path from 'path';
import { executeWriteTransaction, getPrismaClient, getDatabaseFilePath } from '../../database/client';
import { PasswordHasher } from '../../security/password.hasher';
import { SecretCipher } from '../../security/secret.cipher';
import { sessionManager, ActiveSession } from '../auth/session.manager';
import { auditService } from '../audit/audit.service';
import { AppSettingsDTO, UserDTO, SystemHealthDTO } from '../../../shared/types';


export interface FirstRunWizardInput {
  // Company
  company: {
    shopName: string;
    address: string;
    phone: string;
    email?: string;
    gstin?: string;
    currency: string;
    currencySymbol: string;
  };
  // Invoice
  invoice: {
    prefix: string;
    startingSequence: number;
    format: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM';
    footerNotes?: string;
    termsAndConditions?: string;
  };
  // Admin
  admin: {
    username: string;
    password: string;
    fullName: string;
  };
  // POS & Backup preferences
  pos?: {
    negativeStockPolicy?: 'BLOCK' | 'ALLOW_WITH_WARNING';
    defaultPaymentMethod?: string;
  };
  backup?: {
    backupDirectory?: string;
    autoBackupDaily?: boolean;
    retentionCount?: number;
  };
}

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P];
};

export class SettingsService {
  /**
   * Checks whether the store has completed first-run setup.
   */
  async isFirstRun(): Promise<boolean> {
    const prisma = getPrismaClient();
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });
    return adminCount === 0;
  }

  /**
   * Retrieves raw unmasked application settings from SQLite.
   */
  async getRawAppSettings(): Promise<AppSettingsDTO> {
    const prisma = getPrismaClient();
    const settingsRecord = await prisma.appSetting.findUnique({
      where: { key: 'SYSTEM_SETTINGS' },
    });

    const defaults = this.getDefaultSettings();

    if (settingsRecord) {
      try {
        const parsed = JSON.parse(settingsRecord.value) as Partial<AppSettingsDTO>;
        // Decrypt sensitive secrets from encrypted storage
        if (parsed.gateways) {
          if (parsed.gateways.stripe?.secretKey) {
            parsed.gateways.stripe.secretKey = SecretCipher.decrypt(parsed.gateways.stripe.secretKey);
          }
          if (parsed.gateways.stripe?.webhookSecret) {
            parsed.gateways.stripe.webhookSecret = SecretCipher.decrypt(parsed.gateways.stripe.webhookSecret);
          }
          if (parsed.gateways.razorpay?.keySecret) {
            parsed.gateways.razorpay.keySecret = SecretCipher.decrypt(parsed.gateways.razorpay.keySecret);
          }
          if (parsed.gateways.razorpay?.webhookSecret) {
            parsed.gateways.razorpay.webhookSecret = SecretCipher.decrypt(parsed.gateways.razorpay.webhookSecret);
          }
          if (parsed.gateways.cashfree?.secretKey) {
            parsed.gateways.cashfree.secretKey = SecretCipher.decrypt(parsed.gateways.cashfree.secretKey);
          }
          if (parsed.gateways.paystack?.secretKey) {
            parsed.gateways.paystack.secretKey = SecretCipher.decrypt(parsed.gateways.paystack.secretKey);
          }
        }
        return this.deepMergeDefaults(defaults, parsed);
      } catch {
        return defaults;
      }
    }

    return defaults;
  }

  /**
   * Retrieves application settings with sensitive secrets safely masked for renderer consumption.
   */
  async getAppSettings(): Promise<AppSettingsDTO> {
    const raw = await this.getRawAppSettings();
    return this.maskSensitiveSettings(raw);
  }

  /**
   * Updates application settings with validation, secrets preservation, and audit logging.
   */
  async updateAppSettings(
    newSettings: RecursivePartial<AppSettingsDTO>,
    userId?: string
  ): Promise<AppSettingsDTO> {
    const currentRaw = await this.getRawAppSettings();

    // Preserve secrets if incoming settings are masked or empty
    const preserved = this.preserveSecrets(currentRaw, newSettings);
    const merged = this.deepMergeDefaults(currentRaw, preserved);

    // Encrypt sensitive secrets before persisting to SQLite
    const toPersist = JSON.parse(JSON.stringify(merged));
    if (toPersist.gateways) {
      if (toPersist.gateways.stripe?.secretKey) {
        toPersist.gateways.stripe.secretKey = SecretCipher.encrypt(toPersist.gateways.stripe.secretKey);
      }
      if (toPersist.gateways.stripe?.webhookSecret) {
        toPersist.gateways.stripe.webhookSecret = SecretCipher.encrypt(toPersist.gateways.stripe.webhookSecret);
      }
      if (toPersist.gateways.razorpay?.keySecret) {
        toPersist.gateways.razorpay.keySecret = SecretCipher.encrypt(toPersist.gateways.razorpay.keySecret);
      }
      if (toPersist.gateways.razorpay?.webhookSecret) {
        toPersist.gateways.razorpay.webhookSecret = SecretCipher.encrypt(toPersist.gateways.razorpay.webhookSecret);
      }
      if (toPersist.gateways.cashfree?.secretKey) {
        toPersist.gateways.cashfree.secretKey = SecretCipher.encrypt(toPersist.gateways.cashfree.secretKey);
      }
      if (toPersist.gateways.paystack?.secretKey) {
        toPersist.gateways.paystack.secretKey = SecretCipher.encrypt(toPersist.gateways.paystack.secretKey);
      }
    }

    const prisma = getPrismaClient();
    await prisma.appSetting.upsert({
      where: { key: 'SYSTEM_SETTINGS' },
      update: { value: JSON.stringify(toPersist) },
      create: { key: 'SYSTEM_SETTINGS', value: JSON.stringify(toPersist) },
    });

    // Mask for audit log to prevent leaking secrets into audit trail
    const auditOld = this.maskSensitiveSettings(currentRaw);
    const auditNew = this.maskSensitiveSettings(merged);

    await auditService.log({
      userId,
      action: 'SETTINGS_UPDATE',
      entityType: 'AppSetting',
      entityId: 'SYSTEM_SETTINGS',
      oldValue: auditOld,
      newValue: auditNew,
    });

    return this.maskSensitiveSettings(merged);
  }

  /**
   * Verifies that the required SQLite database tables and schema exist.
   */
  async verifyDatabaseReady(): Promise<boolean> {
    const prisma = getPrismaClient();
    try {
      const requiredTables = ['users', 'app_settings', 'customers', 'units', 'invoice_sequences', 'audit_logs'];
      for (const table of requiredTables) {
        const info: any = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table});`);
        if (!info || info.length === 0) {
          throw new Error(`Database table "${table}" is missing. Migrations must run before first-run setup.`);
        }
      }
      return true;
    } catch (err: any) {
      console.error('[DB Schema Check Failed]', err);
      throw new Error(`Database schema check failed: ${err.message}`);
    }
  }

  /**
   * Completes the first-run wizard atomically.
   */
  async completeFirstRunWizard(input: FirstRunWizardInput): Promise<{
    success: boolean;
    admin: UserDTO;
    session: ActiveSession;
    settings: AppSettingsDTO;
  }> {
    await this.verifyDatabaseReady();

    const isAlreadySetup = !(await this.isFirstRun());
    if (isAlreadySetup) {
      throw new Error('Store setup has already been completed. First-run wizard is locked.');
    }

    const passwordHash = await PasswordHasher.hash(input.admin.password);
    const defaults = this.getDefaultSettings();

    const appSettings: AppSettingsDTO = {
      ...defaults,
      company: {
        ...defaults.company,
        shopName: input.company.shopName,
        address: input.company.address,
        phone: input.company.phone,
        email: input.company.email || '',
        gstin: input.company.gstin || '',
        currency: input.company.currency || 'INR',
        currencySymbol: input.company.currencySymbol || '₹',
      },
      invoice: {
        ...defaults.invoice,
        prefix: input.invoice.prefix || 'INV-',
        startingSequence: input.invoice.startingSequence || 1,
        format: input.invoice.format || 'THERMAL_80MM',
        footerNotes: input.invoice.footerNotes || 'Thank you for shopping with us!',
        termsAndConditions: input.invoice.termsAndConditions || 'Goods once sold are subject to store return policy.',
      },
      pos: {
        ...defaults.pos,
        defaultPaymentMethod: (input.pos?.defaultPaymentMethod as any) || 'CASH',
        negativeStockPolicy: input.pos?.negativeStockPolicy || 'BLOCK',
      },
      backup: {
        ...defaults.backup,
        backupDirectory: input.backup?.backupDirectory || './backups',
        autoBackupDaily: input.backup?.autoBackupDaily ?? true,
        retentionCount: input.backup?.retentionCount || 7,
      },
      printer: {
        ...defaults.printer,
        printerName: '',
        paperFormat: input.invoice.format || 'THERMAL_80MM',
        copies: 1,
        silent: false,
        showPreview: true,
      },
      store: {
        ...defaults.store,
        storeName: input.company.shopName,
        address: input.company.address,
        phone: input.company.phone,
        taxNumber: input.company.gstin || '',
      },
    };

    return await executeWriteTransaction(async (tx) => {
      // 1. Create first Administrator
      const admin = await tx.user.create({
        data: {
          username: input.admin.username,
          passwordHash,
          fullName: input.admin.fullName,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      // 2. Persist App Settings
      await tx.appSetting.upsert({
        where: { key: 'SYSTEM_SETTINGS' },
        update: { value: JSON.stringify(appSettings) },
        create: { key: 'SYSTEM_SETTINGS', value: JSON.stringify(appSettings) },
      });

      // 3. Seed Cash Customer (System Default)
      await tx.customer.upsert({
        where: { phone: '0000000000' },
        update: {},
        create: {
          name: 'Cash Customer',
          phone: '0000000000',
          address: 'Walk-in Store Customer',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
        },
      });

      // 4. Seed Standard Retail Units
      const defaultUnits = [
        { name: 'Piece', shortCode: 'PCS', allowDecimal: false },
        { name: 'Kilogram', shortCode: 'KG', allowDecimal: true },
        { name: 'Box', shortCode: 'BOX', allowDecimal: false },
        { name: 'Meter', shortCode: 'MTR', allowDecimal: true },
        { name: 'Liter', shortCode: 'LTR', allowDecimal: true },
      ];

      for (const unit of defaultUnits) {
        await tx.unit.upsert({
          where: { shortCode: unit.shortCode },
          update: {},
          create: unit,
        });
      }

      // 5. Initialize Invoice Sequences
      await tx.invoiceSequence.upsert({
        where: { type: 'SALE_INVOICE' },
        update: {
          prefix: input.invoice.prefix || 'INV-',
          nextNumber: input.invoice.startingSequence || 1,
        },
        create: {
          type: 'SALE_INVOICE',
          prefix: input.invoice.prefix || 'INV-',
          nextNumber: input.invoice.startingSequence || 1,
          padLength: 6,
        },
      });

      await tx.invoiceSequence.upsert({
        where: { type: 'PURCHASE_BILL' },
        update: {},
        create: {
          type: 'PURCHASE_BILL',
          prefix: 'BILL-',
          nextNumber: 1,
          padLength: 6,
        },
      });

      await tx.invoiceSequence.upsert({
        where: { type: 'SALE_RETURN' },
        update: {},
        create: {
          type: 'SALE_RETURN',
          prefix: 'SR-',
          nextNumber: 1,
          padLength: 6,
        },
      });

      await tx.invoiceSequence.upsert({
        where: { type: 'PURCHASE_RETURN' },
        update: {},
        create: {
          type: 'PURCHASE_RETURN',
          prefix: 'PR-',
          nextNumber: 1,
          padLength: 6,
        },
      });

      // 6. Record Audit Log
      await auditService.log(
        {
          userId: admin.id,
          action: 'FIRST_RUN_COMPLETED',
          entityType: 'System',
          reason: `Initial store setup completed for ${input.company.shopName}`,
        },
        tx
      );

      const adminDTO: UserDTO = {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: admin.createdAt.toISOString(),
      };

      const session = sessionManager.createSession(adminDTO);

      return {
        success: true,
        admin: adminDTO,
        session,
        settings: this.maskSensitiveSettings(appSettings),
      };
    });
  }

  /**
   * Runs SQLite diagnostic health checks (integrity, table counts, disk size).
   */
  async getSystemHealth(): Promise<SystemHealthDTO> {
    const prisma = getPrismaClient();

    // 1. Run PRAGMA integrity_check
    let integrity: 'OK' | 'ERROR' = 'OK';
    try {
      const result: any = await prisma.$queryRawUnsafe(`PRAGMA integrity_check;`);
      if (!result || !result[0] || result[0].integrity_check !== 'ok') {
        integrity = 'ERROR';
      }
    } catch {
      integrity = 'ERROR';
    }

    // 2. Database file size
    const dbPath = getDatabaseFilePath();
    let sizeBytes = 0;
    try {
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        sizeBytes = stats.size;
      }
    } catch (e) {
      console.warn('[System Health] Could not stat db file:', e);
    }

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // 3. Table counts
    const tableCounts: Record<string, number> = {};
    const tables = ['users', 'products', 'categories', 'sales', 'purchases', 'customers', 'suppliers', 'expenses', 'audit_logs'];
    for (const tbl of tables) {
      try {
        const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tbl}";`);
        tableCounts[tbl] = Number(count[0]?.count || 0);
      } catch {
        tableCounts[tbl] = 0;
      }
    }

    // 4. Last backup info
    const current = await this.getRawAppSettings();
    const backupDir = path.resolve(process.cwd(), current.backup.backupDirectory || './backups');
    let lastBackupDate: string | undefined;
    let lastBackupStatus = 'NO_BACKUPS_FOUND';

    try {
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
        if (files.length > 0) {
          files.sort((a, b) => fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs);
          const latest = path.join(backupDir, files[0]);
          lastBackupDate = fs.statSync(latest).mtime.toISOString();
          lastBackupStatus = 'HEALTHY';
        }
      }
    } catch {
      lastBackupStatus = 'DIRECTORY_ERROR';
    }

    return {
      databaseIntegrity: integrity,
      databaseSizeBytes: sizeBytes,
      databaseSizeFormatted: formatBytes(sizeBytes),
      diskFreeBytes: 1024 * 1024 * 1024 * 50, // 50GB simulated desktop headroom
      diskFreeFormatted: '50.0 GB',
      appVersion: current.updates.currentVersion || '1.0.0',
      schemaVersion: '1.0.0',
      lastBackupDate,
      lastBackupStatus,
      tableCounts,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Validates / tests SMTP configuration parameters.
   */
  async testSmtpConnection(config: Partial<AppSettingsDTO['smtp']>): Promise<{ success: boolean; message: string }> {
    if (!config.host || !config.host.trim()) {
      return { success: false, message: 'SMTP Host cannot be empty.' };
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
      return { success: false, message: 'Invalid SMTP Port. Must be between 1 and 65535.' };
    }
    if (!config.fromAddress || !config.fromAddress.includes('@')) {
      return { success: false, message: 'From Address must be a valid email address.' };
    }

    try {
      const nodemailer = await import('nodemailer');

      // Resolve password: if omitted or masked (••••••••), look up stored password from DB
      let passwordToUse = config.password;
      if (!passwordToUse || passwordToUse.startsWith('••')) {
        const current = await this.getRawAppSettings();
        passwordToUse = current.smtp?.password || '';
      }

      // If user typed App Password with spaces e.g. "abcd efgh ijkl mnop", sanitize spaces
      if (passwordToUse) {
        passwordToUse = passwordToUse.trim();
        if (config.host?.includes('gmail') && passwordToUse.replace(/\s+/g, '').length === 16) {
          passwordToUse = passwordToUse.replace(/\s+/g, '');
        }
      }

      if (config.username && !passwordToUse) {
        return {
          success: false,
          message: 'SMTP Password is required when a Username is specified.',
        };
      }

      const secure = config.encryption === 'SSL';
      const transporter = nodemailer.createTransport({
        host: config.host.trim(),
        port: config.port,
        secure,
        auth: config.username
          ? { user: config.username.trim(), pass: passwordToUse || '' }
          : undefined,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });

      // Step 1: Verify TCP + AUTH handshake
      await transporter.verify();

      // Step 2: Send a real test email to fromAddress
      const fromLabel = config.fromName
        ? `"${config.fromName}" <${config.fromAddress}>`
        : config.fromAddress;

      await transporter.sendMail({
        from: fromLabel,
        to: config.fromAddress,
        subject: '✅ RS Inventory — SMTP Test',
        text: `This is a test email sent from RS Inventory to verify your SMTP configuration.\n\nHost: ${config.host}:${config.port}\nEncryption: ${config.encryption || 'TLS'}\nUsername: ${config.username || 'anonymous'}\n\nIf you received this, your SMTP settings are working correctly.`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
          <h2 style="color:#38bdf8;margin-top:0">✅ SMTP Configuration Verified</h2>
          <p>This test email confirms your SMTP settings are correctly configured in <strong>RS Inventory</strong>.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
            <tr><td style="padding:6px 0;color:#94a3b8">Host</td><td style="padding:6px 0">${config.host}:${config.port}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">Encryption</td><td style="padding:6px 0">${config.encryption || 'TLS'}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">Username</td><td style="padding:6px 0">${config.username || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">From</td><td style="padding:6px 0">${config.fromAddress}</td></tr>
          </table>
          <p style="font-size:12px;color:#64748b">Sent automatically by RS Inventory SMTP configuration test.</p>
        </div>`,
      });

      console.log(`[SMTP Test] ✅ Connection verified and test email sent to ${config.fromAddress}`);
      return {
        success: true,
        message: `✅ Connected to ${config.host}:${config.port} successfully. Test email sent to ${config.fromAddress} — check your inbox.`,
      };
    } catch (err: any) {
      const reason = err?.message || 'Unknown error';
      console.error(`[SMTP Test] ❌ Failed: ${reason}`);

      let helpfulMessage = reason;
      if (reason.includes('535') || reason.includes('BadCredentials') || reason.includes('Username and Password not accepted')) {
        helpfulMessage = 'Authentication failed (Bad Credentials). If using Gmail, your regular Google account password will NOT work. You must enable 2-Step Verification in your Google Account and generate a 16-character "App Password" (go to: Google Account > Security > 2-Step Verification > App passwords).';
      }

      return {
        success: false,
        message: `Connection failed: ${helpfulMessage}`,
      };
    }
  }

  /**
   * Helper: Masks passwords, tokens, API keys before sending to renderer or audit logs.
   */
  private maskSensitiveSettings(settings: AppSettingsDTO): AppSettingsDTO {
    const copy: AppSettingsDTO = JSON.parse(JSON.stringify(settings));

    if (copy.smtp) {
      copy.smtp.isPasswordConfigured = Boolean(copy.smtp.password && copy.smtp.password.length > 0);
      if (copy.smtp.password) copy.smtp.password = '••••••••';
    }

    if (copy.whatsapp) {
      copy.whatsapp.isTokenConfigured = Boolean(copy.whatsapp.accessToken && copy.whatsapp.accessToken.length > 0);
      if (copy.whatsapp.accessToken) {
        copy.whatsapp.accessToken = '••••••••' + copy.whatsapp.accessToken.slice(-4);
      }
      if (copy.whatsapp.metaAppSecret) {
        copy.whatsapp.metaAppSecret = '••••••••';
      }
    }

    if (copy.gateways) {
      if (copy.gateways.stripe) {
        copy.gateways.stripe.isSecretKeyConfigured = Boolean(copy.gateways.stripe.secretKey && copy.gateways.stripe.secretKey.length > 0);
        if (copy.gateways.stripe.secretKey) {
          copy.gateways.stripe.secretKey = '••••••••' + copy.gateways.stripe.secretKey.slice(-4);
        }
      }
      if (copy.gateways.razorpay) {
        copy.gateways.razorpay.isKeySecretConfigured = Boolean(copy.gateways.razorpay.keySecret && copy.gateways.razorpay.keySecret.length > 0);
        if (copy.gateways.razorpay.keySecret) {
          copy.gateways.razorpay.keySecret = '••••••••' + copy.gateways.razorpay.keySecret.slice(-4);
        }
      }
      if (copy.gateways.cashfree) {
        copy.gateways.cashfree.isSecretKeyConfigured = Boolean(copy.gateways.cashfree.secretKey && copy.gateways.cashfree.secretKey.length > 0);
        if (copy.gateways.cashfree.secretKey) {
          copy.gateways.cashfree.secretKey = '••••••••' + copy.gateways.cashfree.secretKey.slice(-4);
        }
      }
      if (copy.gateways.paystack) {
        copy.gateways.paystack.isSecretKeyConfigured = Boolean(copy.gateways.paystack.secretKey && copy.gateways.paystack.secretKey.length > 0);
        if (copy.gateways.paystack.secretKey) {
          copy.gateways.paystack.secretKey = '••••••••' + copy.gateways.paystack.secretKey.slice(-4);
        }
      }
    }

    if (copy.license && copy.license.purchaseCode) {
      copy.license.purchaseCode = '••••••••' + copy.license.purchaseCode.slice(-4);
    }

    return copy;
  }

  /**
   * Helper: Preserves existing plaintext secrets when incoming values are masked or empty.
   */
  private preserveSecrets(
    current: AppSettingsDTO,
    incoming: RecursivePartial<AppSettingsDTO>
  ): RecursivePartial<AppSettingsDTO> {
    const updated = { ...incoming };

    // SMTP password
    if (updated.smtp) {
      if (!updated.smtp.password || updated.smtp.password.startsWith('••')) {
        updated.smtp.password = current.smtp?.password || '';
      } else {
        updated.smtp.password = updated.smtp.password.trim();
        const host = updated.smtp.host || current.smtp?.host || '';
        if (host.includes('gmail') && updated.smtp.password.replace(/\s+/g, '').length === 16) {
          updated.smtp.password = updated.smtp.password.replace(/\s+/g, '');
        }
      }
    }

    // WhatsApp token
    if (updated.whatsapp) {
      if (!updated.whatsapp.accessToken || updated.whatsapp.accessToken.startsWith('••')) {
        updated.whatsapp.accessToken = current.whatsapp?.accessToken || '';
      }
      if (!updated.whatsapp.metaAppSecret || updated.whatsapp.metaAppSecret.startsWith('••')) {
        updated.whatsapp.metaAppSecret = current.whatsapp?.metaAppSecret || '';
      }
    }

    // Gateways
    if (updated.gateways) {
      if (updated.gateways.stripe && (!updated.gateways.stripe.secretKey || updated.gateways.stripe.secretKey.startsWith('••'))) {
        updated.gateways.stripe.secretKey = current.gateways?.stripe?.secretKey || '';
      }
      if (updated.gateways.razorpay && (!updated.gateways.razorpay.keySecret || updated.gateways.razorpay.keySecret.startsWith('••'))) {
        updated.gateways.razorpay.keySecret = current.gateways?.razorpay?.keySecret || '';
      }
      if (updated.gateways.cashfree && (!updated.gateways.cashfree.secretKey || updated.gateways.cashfree.secretKey.startsWith('••'))) {
        updated.gateways.cashfree.secretKey = current.gateways?.cashfree?.secretKey || '';
      }
      if (updated.gateways.paystack && (!updated.gateways.paystack.secretKey || updated.gateways.paystack.secretKey.startsWith('••'))) {
        updated.gateways.paystack.secretKey = current.gateways?.paystack?.secretKey || '';
      }
    }

    // License purchase code
    if (updated.license && (!updated.license.purchaseCode || updated.license.purchaseCode.startsWith('••'))) {
      updated.license.purchaseCode = current.license?.purchaseCode || '';
    }

    return updated;
  }

  /**
   * Deep merges user partial settings with default settings safely.
   */
  private deepMergeDefaults(defaults: AppSettingsDTO, incoming: Partial<AppSettingsDTO> | RecursivePartial<AppSettingsDTO>): AppSettingsDTO {
    return {
      ...defaults,
      ...incoming,
      company: { ...(defaults?.company || {}), ...(incoming.company || {}) } as any,
      invoice: { ...(defaults?.invoice || {}), ...(incoming.invoice || {}) } as any,
      pos: {
        ...(defaults?.pos || {}),
        ...(incoming.pos || {}),
        scanner: { ...(defaults?.pos?.scanner || {}), ...(incoming.pos?.scanner || {}) },
      } as any,
      backup: { ...(defaults?.backup || {}), ...(incoming.backup || {}) } as any,
      printer: { ...(defaults?.printer || {}), ...(incoming.printer || {}) } as any,
      branding: { ...(defaults?.branding || {}), ...(incoming.branding || {}) } as any,
      regional: { ...(defaults?.regional || {}), ...(incoming.regional || {}) } as any,
      currency: { ...(defaults?.currency || {}), ...(incoming.currency || {}) } as any,
      receipt: { ...(defaults?.receipt || {}), ...(incoming.receipt || {}) } as any,
      cashierPos: { ...(defaults?.cashierPos || {}), ...(incoming.cashierPos || {}) } as any,
      security: { ...(defaults?.security || {}), ...(incoming.security || {}) } as any,
      scripts: { ...(defaults?.scripts || {}), ...(incoming.scripts || {}) } as any,
      scale: { ...(defaults?.scale || {}), ...(incoming.scale || {}) } as any,
      stockLocations: {
        ...(defaults?.stockLocations || {}),
        ...(incoming.stockLocations || {}),
        fields: {
          ...(defaults?.stockLocations?.fields || {}),
          ...((incoming.stockLocations as any)?.fields || {}),
        },
      } as any,
      loyalty: { ...(defaults?.loyalty || {}), ...(incoming.loyalty || {}) } as any,
      pricing: { ...(defaults?.pricing || {}), ...(incoming.pricing || {}) } as any,
      numbering: { ...(defaults?.numbering || {}), ...(incoming.numbering || {}) } as any,
      smtp: { ...(defaults?.smtp || {}), ...(incoming.smtp || {}) } as any,
      whatsapp: {
        ...(defaults?.whatsapp || {}),
        ...(incoming.whatsapp || {}),
        templates: { ...(defaults?.whatsapp?.templates || {}), ...(incoming.whatsapp?.templates || {}) },
      } as any,
      paymentMethods: incoming.paymentMethods
        ? (incoming.paymentMethods as any)
        : defaults.paymentMethods,
      gateways: {
        ...defaults.gateways,
        ...(incoming.gateways || {}),
        stripe: { ...defaults.gateways.stripe, ...(incoming.gateways?.stripe || {}) },
        razorpay: { ...defaults.gateways.razorpay, ...(incoming.gateways?.razorpay || {}) },
        cashfree: { ...defaults.gateways.cashfree, ...(incoming.gateways?.cashfree || {}) },
        paystack: { ...defaults.gateways.paystack, ...(incoming.gateways?.paystack || {}) },
      } as any,
      scheduler: { ...defaults.scheduler, ...(incoming.scheduler || {}) } as any,
      updates: { ...defaults.updates, ...(incoming.updates || {}) } as any,
      license: { ...defaults.license, ...(incoming.license || {}) } as any,
      legal: { ...defaults.legal, ...(incoming.legal || {}) } as any,
      store: { ...defaults.store, ...(incoming.store || {}) } as any,
      terminal: { ...defaults.terminal, ...(incoming.terminal || {}) } as any,
    };
  }

  /**
   * Safe, complete default settings for RS Inventory - Solo.
   */
  getDefaultSettings(): AppSettingsDTO {
    return {
      company: {
        shopName: 'RS Retail Store',
        address: 'Main Market Road',
        phone: '9876543210',
        currency: 'INR',
        currencySymbol: '₹',
      },
      invoice: {
        prefix: 'INV-',
        startingSequence: 1,
        format: 'THERMAL_80MM',
        footerNotes: 'Thank you for your visit!',
        termsAndConditions: 'Items subject to standard return policy.',
      },
      pos: {
        defaultPaymentMethod: 'CASH',
        negativeStockPolicy: 'BLOCK',
        defaultReorderLevel: 10,
        scanner: {
          enabled: true,
          minBarcodeLength: 3,
          interCharTimingThresholdMs: 60,
          bufferTimeoutMs: 300,
        },
      },
      backup: {
        backupDirectory: './backups',
        autoBackupDaily: true,
        retentionCount: 7,
      },
      printer: {
        printerName: '',
        paperFormat: 'THERMAL_80MM',
        copies: 1,
        silent: false,
        showPreview: true,
      },
      branding: {
        appName: 'RS Inventory',
        footerText: 'RS Inventory – Solo Station',
        accentColor: '#F97316',
        accentTextColor: '#FFFFFF',
        theme: 'dark',
      },
      regional: {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        financialYearStartMonth: 4,
      },
      currency: {
        baseCurrency: 'INR',
        symbol: '₹',
        decimalPlaces: 2,
        thousandSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'prefix',
      },
      receipt: {
        paperSize: '80mm',
        showLogo: true,
        showCustomerDetails: true,
        showCashier: true,
        showTaxBreakdown: true,
        showBarcode: true,
        showQrCode: false,
        showSku: false,
        showHsn: false,
        showHsnTaxSummary: false,
        headerText: '',
        footerText: 'Thank you for your visit!',
        returnPolicy: 'Items subject to standard return policy.',
      },
      cashierPos: {
        cartPosition: 'counter',
        tileSize: 'comfortable',
        theme: 'dark',
        defaultCategoryId: 'ALL',
      },
      security: {
        singleSessionPerAccount: false,
        sessionTimeoutMinutes: 30,
      },
      scripts: {
        enabled: false,
        headerScript: '',
        footerScript: '',
      },
      scale: {
        enabled: false,
        prefix: '20',
        pluDigits: 5,
        digitsToSkip: 1,
        valueDigits: 5,
        valueDecimals: 3,
        embeddedValue: 'WEIGHT',
      },
      stockLocations: {
        enabled: false,
        fields: {
          aisle: { enabled: true, label: 'Aisle' },
          rack: { enabled: true, label: 'Rack' },
          shelf: { enabled: true, label: 'Shelf' },
          bin: { enabled: true, label: 'Bin' },
        },
        locationTypes: ['Main Shelf', 'Back Stock', 'Refrigerated', 'Locked Cabinet', 'Other'],
      },
      loyalty: {
        enabled: false,
        pointsPerAmount: 1,
        amountThreshold: 100,
        earnOn: 'GRAND_TOTAL',
        expirationMonths: 12,
        redemptionPoints: 100,
        redemptionValue: 10,
        minRedeemBalance: 50,
        maxRedeemSalePercentage: 50,
      },
      pricing: {
        pricingMode: 'PRODUCT_BASED',
        defaultUpdateSellingPricesOnReceive: false,
      },
      numbering: {
        saleInvoiceFormat: 'INV-{seq:6}',
        heldOrderFormat: 'HOLD-{seq:4}',
        quotationFormat: 'QUO-{seq:6}',
        refundFormat: 'SR-{seq:6}',
        skuPrefix: 'SKU-',
        inStoreBarcodePrefix: '21',
      },
      smtp: {
        driver: 'LOG',
        host: '',
        port: 587,
        username: '',
        password: '',
        isPasswordConfigured: false,
        encryption: 'TLS',
        fromAddress: '',
        fromName: 'RS Inventory',
      },
      whatsapp: {
        mode: 'CLICK_TO_CHAT',
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        isTokenConfigured: false,
        templates: {
          saleReceipt: 'Hello {customer_name}, thank you for your purchase! Total: {currency}{total}. Invoice: {invoice_number}',
          quotation: 'Hello {customer_name}, here is your quotation {quotation_number} for {currency}{total}.',
          creditNote: 'Credit note {return_number} issued for {currency}{total}.',
          customerStatement: 'Account statement for {customer_name}: Current balance: {currency}{balance}.',
          paymentReceipt: 'Payment of {currency}{amount} received with thanks.',
        },
      },
      paymentMethods: [
        { id: 'CASH', name: 'Cash', type: 'CASH', requiresReference: false, active: true },
        { id: 'CARD', name: 'Card / POS Terminal', type: 'CARD', requiresReference: true, active: true },
        { id: 'UPI', name: 'UPI / QR Code', type: 'UPI', requiresReference: true, active: true, upiVpa: 'store@upi', upiPayeeName: 'RS Store' },
        { id: 'BANK_TRANSFER', name: 'Bank Transfer / NEFT', type: 'BANK_TRANSFER', requiresReference: true, active: true },
        { id: 'CREDIT', name: 'Store Credit / Khata', type: 'CREDIT', requiresReference: false, active: true },
      ],
      gateways: {
        stripe: {
          enabled: false,
          mode: 'TEST',
          publishableKey: '',
          secretKey: '',
          isSecretKeyConfigured: false,
        },
        razorpay: {
          enabled: false,
          mode: 'TEST',
          keyId: '',
          keySecret: '',
          isKeySecretConfigured: false,
        },
        cashfree: {
          enabled: false,
          mode: 'TEST',
          appId: '',
          secretKey: '',
          isSecretKeyConfigured: false,
        },
        paystack: {
          enabled: false,
          mode: 'TEST',
          publicKey: '',
          secretKey: '',
          isSecretKeyConfigured: false,
        },
      },
      scheduler: {
        autoBackupEnabled: true,
        autoBackupIntervalHours: 24,
        lowStockAlertsEnabled: true,
        updateChecksEnabled: true,
      },
      updates: {
        currentVersion: '1.0.0',
        releaseChannel: 'STABLE',
        autoCheckUpdates: true,
        autoInstallPatches: false,
      },
      license: {
        isConfigured: true,
        status: 'ACTIVE',
        offlineGraceDaysRemaining: 30,
      },
      legal: {
        privacyPolicyHtml: '<h2>Privacy Policy</h2><p>Your business data is stored strictly locally on this device in SQLite.</p>',
        termsOfServiceHtml: '<h2>Terms of Service</h2><p>RS Inventory Solo is an offline-first single-station retail management workstation.</p>',
      },
      store: {
        storeName: 'RS Retail Store',
        legalName: 'RS Retail Private Limited',
        taxNumber: '',
        phone: '9876543210',
        email: '',
        address: 'Main Market Road',
        city: 'City',
        state: 'State',
        postalCode: '100001',
        country: 'India',
      },
      terminal: {
        terminalName: 'Terminal 01 - Main Counter',
        active: true,
        defaultPrinter: '',
      },
    };
  }
}

export const settingsService = new SettingsService();
