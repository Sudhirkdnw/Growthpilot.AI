import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { userManagementService } from '../../src/main/modules/auth/user-management.service';
import { authService } from '../../src/main/modules/auth/auth.service';
import { sessionManager } from '../../src/main/modules/auth/session.manager';
import { dispatchFastify } from '../../src/main/fastify/server';
import { formatCurrency } from '../../src/renderer/src/utils/formatCurrency';
import { AppSettingsDTO } from '../../src/shared/types';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-msg-id' }),
  })),
}));

describe('Complete Master Administration & Settings System Test Suite', () => {
  const prisma = getPrismaClient();
  let adminToken: string;
  let cashierToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Ensure pristine test users
    await prisma.userSession.deleteMany({});

    // Create or find Admin User
    let admin = await prisma.user.findFirst({ where: { username: 'admin_settings_test' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          username: 'admin_settings_test',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
          fullName: 'Master Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    adminUserId = admin.id;

    // Create or find Cashier User
    let cashier = await prisma.user.findFirst({ where: { username: 'cashier_settings_test' } });
    if (!cashier) {
      cashier = await prisma.user.create({
        data: {
          username: 'cashier_settings_test',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
          fullName: 'John Cashier',
          role: 'CASHIER',
          status: 'ACTIVE',
        },
      });
    }

    // Create active test sessions
    const adminSession = sessionManager.createSession({
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: admin.createdAt.toISOString(),
    });
    adminToken = adminSession.token;

    const cashierSession = sessionManager.createSession({
      id: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: 'CASHIER',
      status: 'ACTIVE',
      createdAt: cashier.createdAt.toISOString(),
    });
    cashierToken = cashierSession.token;
  });

  // 1. DEFAULT SETTINGS INTEGRITY
  it('1. Returns safe defaults for all 22 master settings categories', async () => {
    const defaults = settingsService.getDefaultSettings();

    // Core
    expect(defaults.company.shopName).toBe('RS Retail Store');
    expect(defaults.invoice.format).toBe('THERMAL_80MM');
    expect(defaults.pos.defaultPaymentMethod).toBe('CASH');
    expect(defaults.backup.retentionCount).toBe(7);

    // Branding & Theme
    expect(defaults.branding.accentColor).toBe('#F97316');
    expect(defaults.branding.theme).toBe('dark');

    // Regional & Currency
    expect(defaults.regional.timezone).toBe('Asia/Kolkata');
    expect(defaults.regional.financialYearStartMonth).toBe(4);
    expect(defaults.currency.symbol).toBe('₹');
    expect(defaults.currency.decimalPlaces).toBe(2);

    // Receipt & Cashier POS
    expect(defaults.receipt.paperSize).toBe('80mm');
    expect(defaults.receipt.showBarcode).toBe(true);
    expect(defaults.cashierPos.cartPosition).toBe('counter');
    expect(defaults.cashierPos.tileSize).toBe('comfortable');

    // Security & Scripts
    expect(defaults.security.singleSessionPerAccount).toBe(false);
    expect(defaults.scripts.enabled).toBe(false);

    // Hardware & Weighing Scale
    expect(defaults.scale.prefix).toBe('20');
    expect(defaults.scale.pluDigits).toBe(5);

    // Stock Locations & Loyalty
    expect(defaults.stockLocations.locationTypes).toContain('Main Shelf');
    expect(defaults.loyalty.amountThreshold).toBe(100);

    // Pricing & Numbering
    expect(defaults.pricing.pricingMode).toBe('PRODUCT_BASED');
    expect(defaults.numbering.saleInvoiceFormat).toBe('INV-{seq:6}');

    // SMTP & WhatsApp
    expect(defaults.smtp.driver).toBe('LOG');
    expect(defaults.whatsapp.mode).toBe('CLICK_TO_CHAT');

    // Payment Methods & Gateways
    expect(defaults.paymentMethods.length).toBeGreaterThanOrEqual(5);
    expect(defaults.gateways.stripe.enabled).toBe(false);

    // Scheduler, Updates, License, Legal, Store, Terminal
    expect(defaults.scheduler.autoBackupEnabled).toBe(true);
    expect(defaults.updates.currentVersion).toBe('1.0.0');
    expect(defaults.license.status).toBe('ACTIVE');
    expect(defaults.legal.privacyPolicyHtml).toBeDefined();
    expect(defaults.store.storeName).toBe('RS Retail Store');
    expect(defaults.terminal.active).toBe(true);
  });

  // 2. SETTINGS PERSISTENCE & DEEP MERGE
  it('2. Persists and deep-merges partial updates without overwriting sibling keys', async () => {
    const prevSettings = await settingsService.getAppSettings();
    const prevPhone = prevSettings.company.phone;

    // Update company name and accent color
    const updated = await settingsService.updateAppSettings(
      {
        company: { shopName: 'RS Supermarket Global' },
        branding: { accentColor: '#00AEEF' },
      },
      adminUserId
    );

    expect(updated.company.shopName).toBe('RS Supermarket Global');
    expect(updated.branding.accentColor).toBe('#00AEEF');

    // Sibling keys should remain intact
    expect(updated.company.phone).toBe(prevPhone);
    expect(updated.branding.appName).toBe('RS Inventory');
    expect(updated.currency.symbol).toBe('₹');

    // Retrieve fresh from DB
    const fresh = await settingsService.getAppSettings();
    expect(fresh.company.shopName).toBe('RS Supermarket Global');
    expect(fresh.branding.accentColor).toBe('#00AEEF');
  });

  // 3. SECRETS ENCRYPTION, MASKING & PRESERVATION
  it('3. Masks sensitive secrets and preserves existing credentials when update is masked', async () => {
    // Set raw SMTP password and Stripe key
    await settingsService.updateAppSettings(
      {
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          username: 'owner@store.com',
          password: 'SecretSmtpPassword#2026',
        },
        gateways: {
          stripe: {
            enabled: true,
            mode: 'TEST',
            publishableKey: 'pk_test_123456789',
            secretKey: 'sk_test_supersecretkey999',
          },
        },
      },
      adminUserId
    );

    // Verify getAppSettings masks secrets
    const masked = await settingsService.getAppSettings();
    expect(masked.smtp.password).toBe('••••••••');
    expect(masked.smtp.isPasswordConfigured).toBe(true);
    expect(masked.gateways.stripe.secretKey).toContain('••••••••');
    expect(masked.gateways.stripe.secretKey).not.toBe('sk_test_supersecretkey999');
    expect(masked.gateways.stripe.isSecretKeyConfigured).toBe(true);

    // Save with masked value passed back (simulating user saving other form fields)
    const afterResave = await settingsService.updateAppSettings(
      {
        smtp: {
          password: '••••••••',
        },
        company: {
          phone: '9998887776',
        },
      },
      adminUserId
    );

    // Verify raw secret was preserved in database
    const raw = await settingsService.getRawAppSettings();
    expect(raw.smtp.password).toBe('SecretSmtpPassword#2026');
    expect(raw.gateways.stripe.secretKey).toBe('sk_test_supersecretkey999');
    expect(raw.company.phone).toBe('9998887776');
  });

  // 4. SERVER-SIDE RBAC ENFORCEMENT
  it('4. Fastify PUT /api/settings allows Admin and strictly blocks Cashier (403)', async () => {
    // 1. Admin attempt -> 200 OK
    const adminRes = await dispatchFastify(
      'PUT',
      '/api/settings',
      { settings: { branding: { accentColor: '#10B981' } } },
      { authorization: adminToken }
    );
    expect(adminRes.success).toBe(true);
    expect(adminRes.settings.branding.accentColor).toBe('#10B981');

    // 2. Cashier attempt -> 403 Forbidden
    const cashierRes = await dispatchFastify(
      'PUT',
      '/api/settings',
      { settings: { branding: { accentColor: '#FF0000' } } },
      { authorization: cashierToken }
    );
    expect(cashierRes.success).toBe(false);
    expect(cashierRes.error).toContain('Unauthorized');

    // 3. Unauthenticated attempt -> 403 Forbidden
    const noAuthRes = await dispatchFastify(
      'PUT',
      '/api/settings',
      { settings: { branding: { accentColor: '#FF0000' } } }
    );
    expect(noAuthRes.success).toBe(false);
  });

  // 5. SINGLE-SESSION PER ACCOUNT POLICY
  it('5. Terminate other active sessions when singleSessionPerAccount is active', async () => {
    // Enable single-session mode
    await settingsService.updateAppSettings(
      {
        security: { singleSessionPerAccount: true },
      },
      adminUserId
    );

    // Create session 1 for cashier
    const cashier = await prisma.user.findFirstOrThrow({ where: { username: 'cashier_settings_test' } });
    const session1 = sessionManager.createSession({
      id: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: 'CASHIER',
      status: 'ACTIVE',
      createdAt: cashier.createdAt.toISOString(),
    });

    expect(sessionManager.getSession(session1.token)).not.toBeNull();

    // Terminate older sessions for cashier
    sessionManager.terminateOtherSessionsForUser(cashier.id, 'new_token_123');

    // Session 1 must be terminated
    expect(sessionManager.getSession(session1.token)).toBeNull();
  });

  // 6. USER MANAGEMENT SERVICE
  it('6. Admin can list, create, and update users, but cannot deactivate last Admin', async () => {
    // 1. List users
    const users = await userManagementService.listUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);

    // 2. Create new Cashier
    const uniqueName = `cashier_${Date.now()}`;
    const newUser = await userManagementService.createUser(
      {
        username: uniqueName,
        password: 'CashierPass123!',
        fullName: 'Jane Cashier',
        role: 'CASHIER',
      },
      adminUserId
    );

    expect(newUser.username).toBe(uniqueName);
    expect(newUser.role).toBe('CASHIER');
    expect(newUser.status).toBe('ACTIVE');

    // 3. Update Cashier
    const updated = await userManagementService.updateUser(
      newUser.id,
      { fullName: 'Jane Doe Senior Cashier', status: 'INACTIVE' },
      adminUserId
    );
    expect(updated.fullName).toBe('Jane Doe Senior Cashier');
    expect(updated.status).toBe('INACTIVE');

    // 4. Protection: Deactivating last admin is blocked
    const allAdmins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    // If there's only 1 admin, trying to deactivate must fail
    if (allAdmins.length === 1) {
      await expect(
        userManagementService.updateUser(allAdmins[0].id, { status: 'INACTIVE' }, adminUserId)
      ).rejects.toThrow('Cannot deactivate or change role of the last active Administrator');
    }
  });

  // 7. SYSTEM HEALTH DIAGNOSTICS
  it('7. Returns SQLite integrity status and database file size diagnostics', async () => {
    const health = await settingsService.getSystemHealth();

    expect(health.databaseIntegrity).toBe('OK');
    expect(health.databaseSizeBytes).toBeGreaterThan(0);
    expect(health.tableCounts.users).toBeGreaterThanOrEqual(1);
    expect(health.appVersion).toBeDefined();
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  // 8. SMTP CONNECTION TEST DIAGNOSTICS
  it('8. Validates SMTP connection parameters with diagnostic verification', async () => {
    // Empty host fails
    const failRes = await settingsService.testSmtpConnection({ host: '', port: 587, fromAddress: 'test@store.com' });
    expect(failRes.success).toBe(false);
    expect(failRes.message).toContain('Host cannot be empty');

    // Valid parameters succeed
    const okRes = await settingsService.testSmtpConnection({
      host: 'smtp.gmail.com',
      port: 587,
      fromAddress: 'billing@store.com',
      encryption: 'TLS',
    });
    expect(okRes.success).toBe(true);
    expect(okRes.message).toContain('Connected to');
  });

  // 9. CENTRALIZED CURRENCY FORMATTER
  it('9. Formats currency correctly according to dynamic settings', async () => {
    const mockSettings: any = {
      currency: {
        symbol: '₹',
        decimalPlaces: 2,
        thousandSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'prefix',
      },
    };

    expect(formatCurrency(1250.5, mockSettings)).toBe('₹1,250.50');
    expect(formatCurrency(-500, mockSettings)).toBe('-₹500.00');

    // Suffix symbol with 3 decimals
    const suffixSettings: any = {
      currency: {
        symbol: 'KWD',
        decimalPlaces: 3,
        thousandSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'suffix',
      },
    };
    expect(formatCurrency(12.5, suffixSettings)).toBe('12.500 KWD');
  });

  // 10. DYNAMIC PAYMENT METHODS TOGGLE
  it('10. Disabling a payment method updates settings and propagates to consumers', async () => {
    const current = await settingsService.getRawAppSettings();
    const updatedMethods = current.paymentMethods.map((m) =>
      m.type === 'UPI' ? { ...m, active: false } : m
    );

    const saved = await settingsService.updateAppSettings({ paymentMethods: updatedMethods }, adminUserId);
    const upiMethod = saved.paymentMethods.find((m) => m.type === 'UPI');
    expect(upiMethod?.active).toBe(false);

    // Active methods no longer include UPI
    const activeMethods = saved.paymentMethods.filter((m) => m.active).map((m) => m.type);
    expect(activeMethods).not.toContain('UPI');
    expect(activeMethods).toContain('CASH');
  });
});
