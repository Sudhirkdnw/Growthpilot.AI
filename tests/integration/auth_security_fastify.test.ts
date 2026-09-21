import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { PasswordHasher } from '../../src/main/security/password.hasher';
import { bruteForceProtector } from '../../src/main/security/bruteForceProtector';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { authService } from '../../src/main/modules/auth/auth.service';
import { sessionManager } from '../../src/main/modules/auth/session.manager';
import { dispatchFastify } from '../../src/main/fastify/server';

describe('Phase 2 & 3: Production Security, Fastify & Setup Test Suite', () => {
  const prisma = getPrismaClient();

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean test database for pristine test run
    await prisma.userSession.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.appSetting.deleteMany({});
    await prisma.customer.deleteMany({ where: { phone: '0000000000' } });
  });

  it('1. Password Hashing with Argon2id', async () => {
    const rawPass = 'ShopMasterPass#2026';
    const hash = await PasswordHasher.hash(rawPass);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(rawPass);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('2. Password Verification (Correct)', async () => {
    const rawPass = 'ShopMasterPass#2026';
    const hash = await PasswordHasher.hash(rawPass);
    const isValid = await PasswordHasher.verify(rawPass, hash);
    expect(isValid).toBe(true);
  });

  it('3. Password Verification (Wrong Password)', async () => {
    const rawPass = 'ShopMasterPass#2026';
    const hash = await PasswordHasher.hash(rawPass);
    const isInvalid = await PasswordHasher.verify('IncorrectPass123', hash);
    expect(isInvalid).toBe(false);
  });

  it('4. First-Run Detection When Fresh Database', async () => {
    const isFirst = await settingsService.isFirstRun();
    expect(isFirst).toBe(true);
  });

  it('5. Schema Migration & Table Verification Pre-Flight Check', async () => {
    const isReady = await settingsService.verifyDatabaseReady();
    expect(isReady).toBe(true);
  });

  it('6. Setup Rollback on Transaction Failure & Setup Retry', async () => {
    // Attempt setup with invalid payload that causes validation/hashing failure (empty password)
    await expect(
      settingsService.completeFirstRunWizard({
        company: { shopName: 'Test Rollback Store', address: 'X', phone: '123', currency: 'INR', currencySymbol: '₹' },
        invoice: { prefix: 'INV-', startingSequence: 1, format: 'A4' },
        admin: { username: 'fail_admin', password: '12', fullName: 'Fail' }, // Password < 6 chars -> throws
      })
    ).rejects.toThrow(/at least 6 characters/);

    // Verify 100% rollback occurred: no admin created, isFirstRun still true
    const adminCount = await prisma.user.count();
    expect(adminCount).toBe(0);
    const isStillFirst = await settingsService.isFirstRun();
    expect(isStillFirst).toBe(true);

    // Setup Retry after failure: Now run with valid password and ensure it succeeds
    const retryResult = await settingsService.completeFirstRunWizard({
      company: {
        shopName: 'RS Retail Express',
        address: '100 Commercial Blvd',
        phone: '9800011122',
        email: 'billing@rsretail.local',
        gstin: '27AABCR1234F1Z5',
        currency: 'INR',
        currencySymbol: '₹',
      },
      invoice: {
        prefix: 'RSINV-',
        startingSequence: 1001,
        format: 'THERMAL_80MM',
      },
      admin: {
        username: 'rs_superadmin',
        password: 'ValidPassword#2026',
        fullName: 'Rajesh Sharma',
      },
      backup: {
        backupDirectory: './backups',
        autoBackupDaily: true,
        retentionCount: 10,
      },
    });

    expect(retryResult.success).toBe(true);
    expect(retryResult.admin.username).toBe('rs_superadmin');
  });

  it('7. Duplicate Initialization Prevention', async () => {
    // Attempting setup again must throw error
    await expect(
      settingsService.completeFirstRunWizard({
        company: { shopName: 'Intruder Store', address: 'X', phone: '0', currency: 'INR', currencySymbol: '₹' },
        invoice: { prefix: 'INV-', startingSequence: 1, format: 'A4' },
        admin: { username: 'intruder', password: 'password123', fullName: 'Intruder' },
      })
    ).rejects.toThrow(/already been completed/);
  });

  it('8. Default Cash Customer & Invoice Sequence Seeding', async () => {
    const cashCustomer = await prisma.customer.findUnique({
      where: { phone: '0000000000' },
    });
    expect(cashCustomer).toBeDefined();
    expect(cashCustomer?.name).toBe('Cash Customer');

    const invoiceSeq = await prisma.invoiceSequence.findUnique({
      where: { type: 'SALE_INVOICE' },
    });
    expect(invoiceSeq?.prefix).toBe('RSINV-');
    expect(invoiceSeq?.nextNumber).toBe(1001);
  });

  it('9. Duplicate Username Prevention', async () => {
    // Attempt to insert another user with the same username
    await expect(
      prisma.user.create({
        data: {
          username: 'rs_superadmin', // Duplicate!
          passwordHash: 'dummyHash',
          fullName: 'Duplicate Admin',
          role: 'ADMIN',
        },
      })
    ).rejects.toThrow();
  });

  it('10. Fastify In-Memory Route: Login & Logout', async () => {
    // Login via Fastify dispatch
    const loginRes = await dispatchFastify('POST', '/api/auth/login', {
      username: 'rs_superadmin',
      password: 'ValidPassword#2026',
    });

    expect(loginRes.success).toBe(true);
    expect(loginRes.session).toBeDefined();
    expect(loginRes.session.token).toBeDefined();

    // Verify session retrieval via Fastify
    const sessionRes = await dispatchFastify(
      'GET',
      `/api/auth/session?token=${encodeURIComponent(loginRes.session.token)}`
    );
    expect(sessionRes.session).toBeDefined();
    expect(sessionRes.session.user.username).toBe('rs_superadmin');

    // Logout via Fastify
    const logoutRes = await dispatchFastify('POST', '/api/auth/logout', {
      token: loginRes.session.token,
    });
    expect(logoutRes.success).toBe(true);

    // Verify dead session
    const deadSessionRes = await dispatchFastify(
      'GET',
      `/api/auth/session?token=${encodeURIComponent(loginRes.session.token)}`
    );
    expect(deadSessionRes.session).toBeNull();
  });

  it('11. Inactivity Lock & Secure Password Unlock', async () => {
    const loginRes = await authService.login({
      username: 'rs_superadmin',
      password: 'ValidPassword#2026',
    });
    const token = loginRes.session!.token;

    // Lock session
    authService.lockSession(token);
    const lockedSession = await authService.getSession(token);
    expect(lockedSession?.isLocked).toBe(true);

    // Fail unlock with wrong password
    const failUnlock = await authService.unlockSession(token, 'WrongUnlockPass');
    expect(failUnlock.success).toBe(false);

    // Succeed unlock with right password
    const successUnlock = await authService.unlockSession(token, 'ValidPassword#2026');
    expect(successUnlock.success).toBe(true);

    const unlockedSession = await authService.getSession(token);
    expect(unlockedSession?.isLocked).toBe(false);
  });

  it('12. Session Expiry Handling', () => {
    const fakeUser = {
      id: 'usr-1',
      username: 'test',
      fullName: 'Test User',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    };

    // Create session with 1ms timeout
    const session = sessionManager.createSession(fakeUser, 1);

    // Sleep 10ms
    const start = Date.now();
    while (Date.now() - start < 10) {}

    const retrieved = sessionManager.getSession(session.token);
    expect(retrieved).toBeNull();
  });

  it('13. Brute-Force Login Protection (5 Failed Attempts Lockout)', async () => {
    const testUsername = 'victim_account';

    // 4 failed attempts should not lock out
    for (let i = 1; i <= 4; i++) {
      const status = bruteForceProtector.recordFailedAttempt(testUsername);
      expect(status.isLocked).toBe(false);
      expect(status.attempts).toBe(i);
    }

    // 5th failed attempt triggers lockout
    const lockStatus = bruteForceProtector.recordFailedAttempt(testUsername);
    expect(lockStatus.isLocked).toBe(true);
    expect(lockStatus.remainingMinutes).toBeGreaterThan(0);

    // Fastify route should return 429 Too Many Requests
    const res = await dispatchFastify('POST', '/api/auth/login', {
      username: testUsername,
      password: 'AnyPassword',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('locked due to 5 failed attempts');
  });

  it('14. Unauthorized Request Rejection on Protected Fastify Routes', async () => {
    // Attempting settings update without token
    const res = await dispatchFastify('PUT', '/api/settings', {
      settings: { company: { shopName: 'Hacked Store' } },
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Authentication required');
  });

  it('15. Non-Admin Role Attempting Admin-Only Operation (403 Forbidden)', async () => {
    // Create a Cashier user
    const cashierHash = await PasswordHasher.hash('CashierPass123!');
    const cashierUser = await prisma.user.upsert({
      where: { username: 'cashier_john' },
      update: {},
      create: {
        username: 'cashier_john',
        passwordHash: cashierHash,
        fullName: 'John Cashier',
        role: 'CASHIER',
        status: 'ACTIVE',
      },
    });

    // Login as Cashier
    const cashierLogin = await authService.login({
      username: 'cashier_john',
      password: 'CashierPass123!',
    });
    const cashierToken = cashierLogin.session!.token;

    // Cashier attempts to update store settings (Admin only)
    const updateRes = await dispatchFastify(
      'PUT',
      '/api/settings',
      { settings: { company: { shopName: 'Cashier Overwrite' } }, token: cashierToken },
      { authorization: cashierToken }
    );

    expect(updateRes.success).toBe(false);
    expect(updateRes.error).toContain('requires Administrator permissions');
  });

  it('16. Admin Authorization for Sensitive Settings Update', async () => {
    // Login as Admin
    const adminLogin = await authService.login({
      username: 'rs_superadmin',
      password: 'ValidPassword#2026',
    });
    const adminToken = adminLogin.session!.token;

    // Admin updates store settings
    const updateRes = await dispatchFastify(
      'PUT',
      '/api/settings',
      {
        settings: { company: { shopName: 'RS Super Mega Store' } },
        token: adminToken,
      },
      { authorization: adminToken }
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.settings.company.shopName).toBe('RS Super Mega Store');
  });

  it('17. Audit Logging Without Exposing Passwords or Secrets', async () => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    expect(logs.length).toBeGreaterThan(0);

    // Verify none of the logs leak passwords, hashes, or tokens
    for (const log of logs) {
      const logContent = JSON.stringify(log);
      expect(logContent).not.toContain('ValidPassword#2026');
      expect(logContent).not.toContain('CashierPass123!');
      expect(logContent).not.toContain('$argon2id$');
    }
  });
});
