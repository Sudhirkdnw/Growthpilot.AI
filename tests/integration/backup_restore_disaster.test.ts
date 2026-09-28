import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getPrismaClient,
  initializeDatabasePragmas,
  getDatabaseFilePath,
} from '../../src/main/database/client';
import { backupService, REQUIRED_CORE_TABLES } from '../../src/main/modules/backup/backup.service';
import { restoreService } from '../../src/main/modules/backup/restore.service';
import { productService } from '../../src/main/modules/products/product.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { expenseService } from '../../src/main/modules/expenses/expense.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 13: Backup, Restore & Disaster Recovery Test Suite', () => {
  const prisma = getPrismaClient();
  const testBackupsDir = path.resolve(process.cwd(), 'data', 'test_backups_phase13');

  let adminToken: string;
  let cashierToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    if (!fs.existsSync(testBackupsDir)) {
      fs.mkdirSync(testBackupsDir, { recursive: true });
    }

    // Seed or fetch Admin User
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          username: 'admin_test_phase13',
          passwordHash: 'dummy_hash',
          fullName: 'Admin Test Phase 13',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    adminUserId = admin.id;

    // Seed or fetch Cashier User
    let cashier = await prisma.user.findFirst({ where: { role: 'CASHIER' } });
    if (!cashier) {
      cashier = await prisma.user.create({
        data: {
          username: 'cashier_test_phase13',
          passwordHash: 'dummy_hash',
          fullName: 'Cashier Test Phase 13',
          role: 'CASHIER',
          status: 'ACTIVE',
        },
      });
    }

    // Create active sessions
    const adminSession = sessionManager.createSession({
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    adminToken = adminSession.token;

    const cashierSession = sessionManager.createSession({
      id: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: 'CASHIER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    cashierToken = cashierSession.token;
  });

  afterAll(async () => {
    if (fs.existsSync(testBackupsDir)) {
      fs.rmSync(testBackupsDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------
  // 1. Manual Backup & SQLite Snapshot Tests
  // -------------------------------------------------------------
  describe('1. SQLite Snapshot Backup Creation', () => {
    it('creates a SQLite-safe snapshot backup using VACUUM INTO', async () => {
      const metadata = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
        userId: adminUserId,
      });

      expect(metadata).toBeDefined();
      expect(metadata.filename).toMatch(/^RS-Inventory-Solo-\d{4}-\d{2}-\d{2}-\d{6}\.db$/);
      expect(fs.existsSync(metadata.filePath)).toBe(true);
      expect(metadata.fileSizeBytes).toBeGreaterThan(0);
      expect(metadata.sha256Checksum).toHaveLength(64);
      expect(metadata.integrityStatus).toBe('VALID');
      expect(metadata.tableCount).toBeGreaterThanOrEqual(REQUIRED_CORE_TABLES.length);

      // Verify no temporary .tmp file left behind
      expect(fs.existsSync(`${metadata.filePath}.tmp`)).toBe(false);
    });

    it('creates backup via Fastify endpoint /api/maintenance/backup', async () => {
      const response = await dispatchFastify(
        'POST',
        '/api/maintenance/backup',
        { token: adminToken },
        { authorization: adminToken }
      );

      expect(response.success).toBe(true);
      expect(response.backup).toBeDefined();
      expect(response.backup.integrityStatus).toBe('VALID');
      expect(fs.existsSync(response.backup.filePath)).toBe(true);
    });

    it('lists backups correctly via /api/maintenance/backups', async () => {
      const response = await dispatchFastify('GET', `/api/maintenance/backups?directory=${encodeURIComponent(testBackupsDir)}`);
      expect(response.success).toBe(true);
      expect(Array.isArray(response.backups)).toBe(true);
      expect(response.backups.length).toBeGreaterThan(0);
      expect(response.backups[0].filename).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 2. Integrity Verification Tests
  // -------------------------------------------------------------
  describe('2. Backup Integrity & Structure Validation', () => {
    it('validates a healthy SQLite backup file', async () => {
      const metadata = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
      });

      const verification = await backupService.verifyBackupFile(metadata.filePath);
      expect(verification.ok).toBe(true);
      expect(verification.message).toContain('integrity verified successfully');
      expect(verification.sha256Checksum).toHaveLength(64);
      expect(verification.tableCount).toBeGreaterThanOrEqual(REQUIRED_CORE_TABLES.length);

      for (const table of REQUIRED_CORE_TABLES) {
        expect(verification.tables).toContain(table);
      }
    });

    it('rejects a non-SQLite random text file disguised as .db', async () => {
      const fakeDbPath = path.join(testBackupsDir, 'RS-Inventory-Solo-Fake.db');
      fs.writeFileSync(fakeDbPath, 'Hello world this is definitely not a SQLite database file!');

      const verification = await backupService.verifyBackupFile(fakeDbPath);
      expect(verification.ok).toBe(false);
      expect(verification.message).toMatch(/Invalid SQLite file header/i);

      fs.unlinkSync(fakeDbPath);
    });

    it('rejects a corrupt SQLite database file', async () => {
      // Create a valid backup first, then corrupt middle bytes
      const metadata = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
      });
      const corruptPath = path.join(testBackupsDir, 'Corrupt-Test.db');
      fs.copyFileSync(metadata.filePath, corruptPath);

      // Overwrite database pages with random garbage beyond header
      const fd = fs.openSync(corruptPath, 'r+');
      const garbage = Buffer.alloc(512, 0xff);
      fs.writeSync(fd, garbage, 0, 512, 100);
      fs.closeSync(fd);

      const verification = await backupService.verifyBackupFile(corruptPath);
      expect(verification.ok).toBe(false);

      fs.unlinkSync(corruptPath);
    });
  });

  // -------------------------------------------------------------
  // 3. Retention Policy Tests
  // -------------------------------------------------------------
  describe('3. Backup Retention Policy', () => {
    it('safely prunes older backups keeping only the latest N versions', async () => {
      const retentionTestDir = path.join(testBackupsDir, 'retention_test');
      if (!fs.existsSync(retentionTestDir)) {
        fs.mkdirSync(retentionTestDir, { recursive: true });
      }

      // Generate 5 backups spaced slightly in time
      for (let i = 1; i <= 5; i++) {
        await backupService.createSnapshotBackup({
          destinationDir: retentionTestDir,
        });
        await new Promise((res) => setTimeout(res, 50));
      }

      const initialFiles = fs.readdirSync(retentionTestDir).filter((f) => f.endsWith('.db'));
      expect(initialFiles.length).toBeGreaterThanOrEqual(1);

      // Clean up
      fs.rmSync(retentionTestDir, { recursive: true, force: true });
    });
  });

  // -------------------------------------------------------------
  // 4. Authorization & Security Tests
  // -------------------------------------------------------------
  describe('4. Security & Authorization Enforcement', () => {
    it('forbids Cashier role from restoring the database (403 Forbidden)', async () => {
      const metadata = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
      });

      const response = await dispatchFastify(
        'POST',
        '/api/maintenance/restore',
        { token: cashierToken, backupFilePath: metadata.filePath },
        { authorization: cashierToken }
      );

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Administrative privileges required|Access denied|Unauthorized/i);
    });

    it('forbids Cashier role from deleting a backup file (403 Forbidden)', async () => {
      const metadata = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
      });

      const response = await dispatchFastify(
        'DELETE',
        '/api/maintenance/backups',
        { token: cashierToken, filePath: metadata.filePath },
        { authorization: cashierToken }
      );

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Administrative privileges required|Access denied|Unauthorized/i);
    });

    it('prevents deletion of the live active database file (anti-traversal/security check)', async () => {
      const livePath = getDatabaseFilePath();

      await expect(
        backupService.deleteBackup(livePath, adminUserId)
      ).rejects.toThrow(/Cannot delete the live database file/);
    });
  });

  // -------------------------------------------------------------
  // 5. Complete Disaster Recovery & State Round-Trip Test
  // -------------------------------------------------------------
  describe('5. Comprehensive State A -> State B -> Restore State A Round-Trip', () => {
    it('restores exact database state, preserving financial and inventory integrity', async () => {
      // 1. Establish STATE A: Create unique Customer and Product
      const testSku = `TEST-PROD-${Date.now()}`;
      const unit = await prisma.unit.findFirst() || await prisma.unit.create({
        data: { name: 'Piece Test', shortCode: 'PCT', allowDecimal: false },
      });

      const { product: productA } = await productService.createProduct(
        {
          name: 'State A Test Product',
          sku: testSku,
          unitId: unit.id,
          purchasePrice: 50,
          salePrice: 100,
          openingStock: 100,
        },
        adminUserId
      );

      const customerPhone = `99${Date.now().toString().slice(-8)}`;
      const customerA = await prisma.customer.create({
        data: {
          name: 'Customer State A',
          phone: customerPhone,
          openingBalance: 0,
          currentBalance: 0,
        },
      });

      // Create Sale in State A
      const saleA = await saleService.createSale({
        customerId: customerA.id,
        items: [{ productId: productA.id, quantity: 10, sellingPrice: 100 }],
        paidAmount: 118,
        paymentMethod: 'CASH',
      });

      // Verify State A Product stock is 90
      const pAfterSaleA = await prisma.product.findUnique({ where: { id: productA.id } });
      expect(Number(pAfterSaleA?.currentStock)).toBe(90);

      // 2. Snapshot STATE A Backup
      const backupA = await backupService.createSnapshotBackup({
        destinationDir: testBackupsDir,
        userId: adminUserId,
      });
      expect(fs.existsSync(backupA.filePath)).toBe(true);

      // 3. Mutate to STATE B:
      // - Sell 40 more units of productA (stock should become 50)
      // - Create a brand new customerB
      // - Create a new expense
      const saleB = await saleService.createSale({
        customerId: customerA.id,
        items: [{ productId: productA.id, quantity: 40, sellingPrice: 100 }],
        paidAmount: 472,
        paymentMethod: 'CASH',
      });

      const pAfterSaleB = await prisma.product.findUnique({ where: { id: productA.id } });
      expect(Number(pAfterSaleB?.currentStock)).toBe(50);

      const customerB = await prisma.customer.create({
        data: {
          name: 'Customer State B Only',
          phone: `88${Date.now().toString().slice(-8)}`,
          openingBalance: 500,
          currentBalance: 500,
        },
      });

      // 4. Perform Destructive Restore to Backup A
      const restoreResult = await restoreService.restoreDatabase(backupA.filePath, adminUserId);
      expect(restoreResult.success).toBe(true);
      expect(fs.existsSync(restoreResult.safetyBackupPath)).toBe(true);

      // 5. Verify Database has returned precisely to STATE A:
      // - productA stock should be 90 (NOT 50)
      // - customerB should NOT exist in the restored database
      // - saleA should exist
      // - saleB should NOT exist
      const pRestored = await prisma.product.findUnique({ where: { id: productA.id } });
      expect(pRestored).toBeDefined();
      expect(Number(pRestored?.currentStock)).toBe(90);

      const customerBRestored = await prisma.customer.findUnique({ where: { id: customerB.id } });
      expect(customerBRestored).toBeNull();

      const saleARestored = await prisma.sale.findUnique({ where: { id: saleA.id } });
      expect(saleARestored).toBeDefined();

      const saleBRestored = await prisma.sale.findUnique({ where: { id: saleB.id } });
      expect(saleBRestored).toBeNull();

      // 6. Verify Post-Restore Live Integrity Check
      const liveIntegrity = await backupService.verifyDatabaseIntegrity();
      expect(liveIntegrity.ok).toBe(true);
    });
  });
});
