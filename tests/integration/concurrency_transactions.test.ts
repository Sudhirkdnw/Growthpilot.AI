import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { inventoryService } from '../../src/main/modules/inventory/inventory.service';
import { reportService } from '../../src/main/modules/reports/report.service';
import { backupService } from '../../src/main/modules/backup/backup.service';
import path from 'path';
import fs from 'fs';

describe('Concurrency, Transactions & Integrity Test Suite', () => {
  const prisma = getPrismaClient();
  let testUnitId: string;
  let testProduct1Id: string;
  let testProduct2Id: string;
  let testCustomerId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean prior sales and stock ledger for isolation
    await prisma.salesReturnItem.deleteMany({});
    await prisma.salesReturn.deleteMany({});
    await prisma.purchaseReturnItem.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.salePayment.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.invoiceSequence.deleteMany({});

    // Create test unit
    const unit = await prisma.unit.upsert({
      where: { shortCode: 'TEST_PCS' },
      update: {},
      create: {
        name: 'Concurrency Test Pieces',
        shortCode: 'TEST_PCS',
        allowDecimal: false,
      },
    });
    testUnitId = unit.id;

    // Create test customer
    const customer = await prisma.customer.upsert({
      where: { phone: '9999988888' },
      update: { currentBalance: 0 },
      create: {
        name: 'Test Regular Customer',
        phone: '9999988888',
        currentBalance: 0,
      },
    });
    testCustomerId = customer.id;

    // Create test products
    // Clean prior test data for test products
    await prisma.stockLedger.deleteMany({
      where: { product: { sku: { in: ['TEST_SKU_001', 'TEST_SKU_002'] } } },
    });

    const p1 = await prisma.product.upsert({
      where: { sku: 'TEST_SKU_001' },
      update: { currentStock: 100, purchasePrice: 50, salePrice: 100 },
      create: {
        name: 'Concurrency Product 1',
        sku: 'TEST_SKU_001',
        barcode: '8901234567890',
        unitId: testUnitId,
        purchasePrice: 50,
        salePrice: 100,
        taxRate: 18,
        currentStock: 100,
      },
    });
    testProduct1Id = p1.id;

    // Record Opening Stock in Ledger to preserve invariant
    await prisma.stockLedger.create({
      data: {
        productId: p1.id,
        transactionType: 'OPENING',
        referenceId: p1.id,
        quantityChange: 100,
        balanceAfter: 100,
        notes: 'Initial test opening stock',
      },
    });

    const p2 = await prisma.product.upsert({
      where: { sku: 'TEST_SKU_002' },
      update: { currentStock: 5, purchasePrice: 40, salePrice: 80 },
      create: {
        name: 'Limited Stock Product 2',
        sku: 'TEST_SKU_002',
        barcode: '8901234567891',
        unitId: testUnitId,
        purchasePrice: 40,
        salePrice: 80,
        taxRate: 18,
        currentStock: 5,
      },
    });
    testProduct2Id = p2.id;
  });

  it('Scenario 1: Transaction Rollback on Partial Failure', async () => {
    // Attempt sale where item 1 has enough stock (qty 2 of 100), but item 2 exceeds stock (qty 10 of 5)
    const initialP1 = await prisma.product.findUnique({ where: { id: testProduct1Id } });
    const initialP2 = await prisma.product.findUnique({ where: { id: testProduct2Id } });
    const initialSaleCount = await prisma.sale.count();
    const initialLedgerCount = await prisma.stockLedger.count();

    await expect(
      saleService.createSale({
        customerId: testCustomerId,
        items: [
          { productId: testProduct1Id, quantity: 2, sellingPrice: 100 },
          { productId: testProduct2Id, quantity: 10, sellingPrice: 80 }, // Exceeds available stock 5
        ],
        paidAmount: 1000,
        paymentMethod: 'CASH',
        allowNegativeStockOverride: false,
      })
    ).rejects.toThrow(/Insufficient stock/);

    // Assert absolute rollback: No stock deducted, no sales saved, no ledger entries added
    const afterP1 = await prisma.product.findUnique({ where: { id: testProduct1Id } });
    const afterP2 = await prisma.product.findUnique({ where: { id: testProduct2Id } });
    const afterSaleCount = await prisma.sale.count();
    const afterLedgerCount = await prisma.stockLedger.count();

    expect(Number(afterP1?.currentStock)).toBe(Number(initialP1?.currentStock));
    expect(Number(afterP2?.currentStock)).toBe(Number(initialP2?.currentStock));
    expect(afterSaleCount).toBe(initialSaleCount);
    expect(afterLedgerCount).toBe(initialLedgerCount);
  });

  it('Scenario 2: Rapid Consecutive Sales & Stock Consistency', async () => {
    const p1Before = await prisma.product.findUnique({ where: { id: testProduct1Id } });
    const stockStart = Number(p1Before?.currentStock);

    // Trigger 10 rapid concurrent sale requests (each selling 2 units)
    const salePromises = Array.from({ length: 10 }, (_, i) =>
      saleService.createSale({
        customerId: testCustomerId,
        items: [{ productId: testProduct1Id, quantity: 2, sellingPrice: 100 }],
        paidAmount: 236, // (2*100 + 18% tax) = 236
        paymentMethod: 'CASH',
      })
    );

    const results = await Promise.all(salePromises);
    expect(results).toHaveLength(10);

    // Verify all 10 have unique invoice numbers
    const invoiceNumbers = results.map((r) => r.invoiceNumber);
    const uniqueInvoices = new Set(invoiceNumbers);
    expect(uniqueInvoices.size).toBe(10);

    // Verify exactly 20 units were deducted
    const p1After = await prisma.product.findUnique({ where: { id: testProduct1Id } });
    expect(Number(p1After?.currentStock)).toBe(stockStart - 20);

    // Verify stock ledger audit reconciliation
    const reconciliation = await inventoryService.reconcileProductStock(testProduct1Id);
    expect(reconciliation.isBalanced).toBe(true);
    expect(reconciliation.cachedBalance).toBe(reconciliation.calculatedBalance);
  });

  it('Scenario 3: Concurrent Reads and Writes without Locking', async () => {
    // Concurrently trigger write transactions while querying dashboard metrics and stock
    const operations: Promise<any>[] = [];

    // 5 concurrent sales
    for (let i = 0; i < 5; i++) {
      operations.push(
        saleService.createSale({
          customerId: testCustomerId,
          items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 100 }],
          paidAmount: 118,
          paymentMethod: 'CASH',
        })
      );
    }

    // 10 concurrent reads
    for (let i = 0; i < 10; i++) {
      operations.push(reportService.getDashboardMetrics());
      operations.push(prisma.product.findMany({ where: { status: 'ACTIVE' } }));
    }

    const allResults = await Promise.all(operations);
    expect(allResults).toHaveLength(25); // All 25 concurrent operations resolved without SQLITE_BUSY crash
  });

  it('Scenario 4: Report Generation During Active Sales', async () => {
    // Generate historical gross profit while sales are in flight
    const [saleResult, profitReport] = await Promise.all([
      saleService.createSale({
        customerId: testCustomerId,
        items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 100 }],
        paidAmount: 118,
        paymentMethod: 'CASH',
      }),
      reportService.getHistoricalGrossProfit(),
    ]);

    expect(saleResult.id).toBeDefined();
    expect(profitReport.totalGrossProfit).toBeGreaterThan(0);
  });

  it('Scenario 5: SQLite-Safe Backup Snapshot During Activity', async () => {
    const backupDir = path.join(process.cwd(), 'data', 'test_backups');

    // Run snapshot backup and a sale simultaneously
    const [backupResult, saleResult] = await Promise.all([
      backupService.createSnapshotBackup(backupDir),
      saleService.createSale({
        customerId: testCustomerId,
        items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 100 }],
        paidAmount: 118,
        paymentMethod: 'CASH',
      }),
    ]);

    const resolvedBackupPath = typeof backupResult === 'string' ? backupResult : backupResult.filePath;
    expect(fs.existsSync(resolvedBackupPath)).toBe(true);
    expect(saleResult.id).toBeDefined();

    // Verify database integrity
    const integrity = await backupService.verifyDatabaseIntegrity();
    expect(integrity.ok).toBe(true);

    // Clean up test backup
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });

  it('Scenario 6: Historical Profit Immutability Verification', async () => {
    // 1. Sell product at cost ₹50, sell ₹100
    const sale = await saleService.createSale({
      customerId: testCustomerId,
      items: [{ productId: testProduct1Id, quantity: 2, sellingPrice: 100 }],
      paidAmount: 236,
      paymentMethod: 'CASH',
    });

    const item = sale.items[0];
    expect(Number(item.costPrice)).toBe(50); // Historical cost recorded as 50

    // 2. Change product purchase price in master catalog to ₹75
    await prisma.product.update({
      where: { id: testProduct1Id },
      data: { purchasePrice: 75 },
    });

    // 3. Fetch past sale details
    const pastSale = await saleService.getSaleById(sale.id);
    const pastItem = pastSale?.items[0];

    // Assert: Historical cost MUST remain 50, not updated to 75!
    expect(Number(pastItem?.costPrice)).toBe(50);

    // Reset product price
    await prisma.product.update({
      where: { id: testProduct1Id },
      data: { purchasePrice: 50 },
    });
  });
});
