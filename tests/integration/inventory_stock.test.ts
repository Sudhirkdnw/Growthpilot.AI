import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { inventoryService } from '../../src/main/modules/inventory/inventory.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 5: Inventory & Stock Management Test Suite', () => {
  const prisma = getPrismaClient();
  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;
  let testUnitId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up test data
    await prisma.purchaseReturnItem.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.salesReturnItem.deleteMany({});
    await prisma.salesReturn.deleteMany({});
    await prisma.purchaseReturnItem.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.purchasePayment.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.supplierPayment.deleteMany({});
    await prisma.supplierLedger.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.stockLedger.deleteMany({});
    await prisma.stockAdjustment.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.salePayment.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // Create Admin User & Session
    const adminUser = await prisma.user.create({
      data: {
        username: 'inv_admin',
        passwordHash: 'dummyHash',
        fullName: 'Inventory Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminId = adminUser.id;
    const adminSession = sessionManager.createSession({
      id: adminUser.id,
      username: adminUser.username,
      fullName: adminUser.fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: adminUser.createdAt.toISOString(),
    });
    adminToken = adminSession.token;

    // Create Cashier User & Session
    const cashierUser = await prisma.user.create({
      data: {
        username: 'inv_cashier',
        passwordHash: 'dummyHash',
        fullName: 'Frontline Cashier',
        role: 'CASHIER',
        status: 'ACTIVE',
      },
    });
    cashierId = cashierUser.id;
    const cashierSession = sessionManager.createSession({
      id: cashierUser.id,
      username: cashierUser.username,
      fullName: cashierUser.fullName,
      role: 'CASHIER',
      status: 'ACTIVE',
      createdAt: cashierUser.createdAt.toISOString(),
    });
    cashierToken = cashierSession.token;

    // Seed Unit & Category
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Standard Box',
      shortCode: 'BOX',
      allowDecimal: false,
    });
    testUnitId = unit.id;

    const cat = await categoryBrandUnitService.createCategory({
      name: 'Inventory Cat',
      description: 'Category for inventory tests',
    });
    testCategoryId = cat.id;

    // Configure system settings with BLOCK policy initially
    await prisma.appSetting.upsert({
      where: { key: 'pos.negativeStockPolicy' },
      update: { value: JSON.stringify('BLOCK') },
      create: { key: 'pos.negativeStockPolicy', value: JSON.stringify('BLOCK') },
    });
  });

  // --------------------------------------------------------------------------
  // 1. OPENING STOCK & LEDGER INTEGRITY
  // --------------------------------------------------------------------------
  it('1. Creating product with openingStock creates an OPENING ledger record and matches currentStock', async () => {
    const prodRes = await productService.createProduct(
      {
        name: 'Opening Stock Test Item',
        sku: 'OPENING_STOCK_001',
        unitId: testUnitId,
        categoryId: testCategoryId,
        purchasePrice: 100,
        salePrice: 150,
        openingStock: 25,
        reorderLevel: 5,
      },
      adminId
    );

    const product = prodRes.product;
    expect(product.currentStock).toBe(25);

    // Verify stock_ledger entry
    const ledgerEntries = await prisma.stockLedger.findMany({
      where: { productId: product.id },
    });

    expect(ledgerEntries.length).toBe(1);
    expect(ledgerEntries[0].transactionType).toBe('OPENING');
    expect(Number(ledgerEntries[0].quantityChange)).toBe(25);
    expect(Number(ledgerEntries[0].balanceAfter)).toBe(25);
  });

  // --------------------------------------------------------------------------
  // 2. MANUAL ADJUSTMENT IN (INCREASE STOCK)
  // --------------------------------------------------------------------------
  it('2. ADJUSTMENT_IN increases currentStock, records balanceAfter and writes audit log', async () => {
    const prodRes = await productService.createProduct(
      {
        name: 'Adjustment In Product',
        sku: 'ADJ_IN_001',
        unitId: testUnitId,
        purchasePrice: 50,
        salePrice: 80,
        openingStock: 10,
        reorderLevel: 5,
      },
      adminId
    );
    const productId = prodRes.product.id;

    const result = await inventoryService.createStockAdjustment(
      {
        productId,
        type: 'ADJUSTMENT_IN',
        quantity: 15,
        reason: 'Found extra inventory during count',
        notes: 'Warehouse shelf B3',
      },
      adminId
    );

    expect(result.previousBalance).toBe(10);
    expect(result.quantity).toBe(15);
    expect(result.newBalance).toBe(25);

    // Verify product in DB
    const updatedProd = await productService.getProductById(productId);
    expect(updatedProd!.currentStock).toBe(25);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Product',
        entityId: productId,
        action: 'STOCK_ADJUSTMENT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(adminId);
  });

  // --------------------------------------------------------------------------
  // 3. MANUAL ADJUSTMENT OUT (DECREASE STOCK)
  // --------------------------------------------------------------------------
  it('3. ADJUSTMENT_OUT decreases currentStock and records negative quantityChange in ledger', async () => {
    const prodRes = await productService.createProduct(
      {
        name: 'Adjustment Out Product',
        sku: 'ADJ_OUT_001',
        unitId: testUnitId,
        purchasePrice: 20,
        salePrice: 35,
        openingStock: 30,
      },
      adminId
    );
    const productId = prodRes.product.id;

    const result = await inventoryService.createStockAdjustment(
      {
        productId,
        type: 'ADJUSTMENT_OUT',
        quantity: 8,
        reason: 'Damaged in transit / water leak',
      },
      adminId
    );

    expect(result.previousBalance).toBe(30);
    expect(result.quantity).toBe(8);
    expect(result.newBalance).toBe(22);

    const updatedProd = await productService.getProductById(productId);
    expect(updatedProd!.currentStock).toBe(22);

    // Verify ledger balance
    const ledger = await prisma.stockLedger.findFirst({
      where: { productId, transactionType: 'ADJUSTMENT_OUT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledger).toBeDefined();
    expect(Number(ledger?.quantityChange)).toBe(-8);
    expect(Number(ledger?.balanceAfter)).toBe(22);
  });

  // --------------------------------------------------------------------------
  // 4. NEGATIVE STOCK POLICY: BLOCK
  // --------------------------------------------------------------------------
  it('4. Negative stock policy BLOCK rejects adjustments that reduce stock below zero', async () => {
    // Ensure settings policy is explicitly BLOCK
    await settingsService.updateAppSettings(
      {
        pos: {
          negativeStockPolicy: 'BLOCK',
        },
      },
      adminId
    );

    const prodRes = await productService.createProduct(
      {
        name: 'Block Negative Product',
        sku: 'BLOCK_NEG_001',
        unitId: testUnitId,
        purchasePrice: 10,
        salePrice: 20,
        openingStock: 5,
      },
      adminId
    );
    const productId = prodRes.product.id;

    // Attempt to adjust out 10 items when only 5 exist
    await expect(
      inventoryService.createStockAdjustment(
        {
          productId,
          type: 'ADJUSTMENT_OUT',
          quantity: 10,
          reason: 'Attempting to exceed available inventory',
        },
        adminId
      )
    ).rejects.toThrow(/Negative Stock Policy Violation/);

    // Ensure stock remained intact (5)
    const intactProd = await productService.getProductById(productId);
    expect(intactProd!.currentStock).toBe(5);
  });

  // --------------------------------------------------------------------------
  // 5. NEGATIVE STOCK POLICY: ALLOW_WITH_WARNING
  // --------------------------------------------------------------------------
  it('5. Negative stock policy ALLOW_WITH_WARNING requires override flag, then permits negative stock', async () => {
    // Set policy to ALLOW_WITH_WARNING
    const currentSettings = await (await import('../../src/main/modules/settings/settings.service')).settingsService.getAppSettings();
    await prisma.appSetting.upsert({
      where: { key: 'SYSTEM_SETTINGS' },
      update: { value: JSON.stringify({ ...currentSettings, pos: { ...currentSettings.pos, negativeStockPolicy: 'ALLOW_WITH_WARNING' } }) },
      create: { key: 'SYSTEM_SETTINGS', value: JSON.stringify({ ...currentSettings, pos: { ...currentSettings.pos, negativeStockPolicy: 'ALLOW_WITH_WARNING' } }) },
    });

    const prodRes = await productService.createProduct(
      {
        name: 'Allow Warning Product',
        sku: 'ALLOW_WARN_001',
        unitId: testUnitId,
        purchasePrice: 40,
        salePrice: 60,
        openingStock: 2,
      },
      adminId
    );
    const productId = prodRes.product.id;

    // 5a. Without override flag -> rejected with prompt to confirm
    await expect(
      inventoryService.createStockAdjustment(
        {
          productId,
          type: 'ADJUSTMENT_OUT',
          quantity: 5,
          reason: 'Sold or discarded before count',
        },
        adminId
      )
    ).rejects.toThrow(/Negative Stock Warning/);

    // 5b. With override flag -> succeeds and results in -3 stock
    const overrideResult = await inventoryService.createStockAdjustment(
      {
        productId,
        type: 'ADJUSTMENT_OUT',
        quantity: 5,
        reason: 'Confirmed override for missing items',
        allowNegativeStockOverride: true,
      },
      adminId
    );

    expect(overrideResult.newBalance).toBe(-3);
    const updated = await productService.getProductById(productId);
    expect(updated!.currentStock).toBe(-3);

    // Restore policy to BLOCK
    await prisma.appSetting.update({
      where: { key: 'SYSTEM_SETTINGS' },
      data: { value: JSON.stringify({ ...currentSettings, pos: { ...currentSettings.pos, negativeStockPolicy: 'BLOCK' } }) },
    });
  });

  // --------------------------------------------------------------------------
  // 6. VALIDATION CHECKS (Negative Qty, Empty Reason, Unknown Product)
  // --------------------------------------------------------------------------
  it('6. Validation rejects negative quantity, short reason and nonexistent product', async () => {
    const validProd = (await productService.listProducts({})).data[0];

    // Nonexistent product (valid UUID format so schema passes, service rejects)
    await expect(
      inventoryService.createStockAdjustment(
        {
          productId: '00000000-0000-0000-0000-000000000000',
          type: 'ADJUSTMENT_IN',
          quantity: 10,
          reason: 'Valid reason here',
        },
        adminId
      )
    ).rejects.toThrow(/does not exist/);

    // Negative quantity rejected by schema
    await expect(
      inventoryService.createStockAdjustment(
        {
          productId: validProd.id,
          type: 'ADJUSTMENT_IN',
          quantity: -5,
          reason: 'Negative quantity test',
        },
        adminId
      )
    ).rejects.toThrow(/Adjustment quantity must be greater than zero/);

    // Reason too short rejected by schema
    await expect(
      inventoryService.createStockAdjustment(
        {
          productId: validProd.id,
          type: 'ADJUSTMENT_IN',
          quantity: 5,
          reason: 'ab',
        },
        adminId
      )
    ).rejects.toThrow(/Reason must be at least 3 characters/);
  });

  // --------------------------------------------------------------------------
  // 7. STOCK RECONCILIATION DIAGNOSTIC & AUTO-FIX
  // --------------------------------------------------------------------------
  it('7. Reconcile detects matched balance and identifies & fixes discrepancies', async () => {
    const prodRes = await productService.createProduct(
      {
        name: 'Reconciliation Test Item',
        sku: 'RECON_001',
        unitId: testUnitId,
        purchasePrice: 15,
        salePrice: 25,
        openingStock: 10,
      },
      adminId
    );
    const productId = prodRes.product.id;

    // 7a. Clean state -> isBalanced is true
    let recon = await inventoryService.reconcileProductStock(productId, false, adminId);
    expect(recon.isBalanced).toBe(true);
    expect(recon.cachedBalance).toBe(10);
    expect(recon.calculatedBalance).toBe(10);
    expect(recon.discrepancy).toBe(0);

    // 7b. Inject discrepancy: simulate a desync by directly modifying product.currentStock in DB
    await prisma.product.update({
      where: { id: productId },
      data: { currentStock: 17 }, // discrepancy: +7
    });

    // Run reconciliation diagnostic without autoFix
    recon = await inventoryService.reconcileProductStock(productId, false, adminId);
    expect(recon.isBalanced).toBe(false);
    expect(recon.cachedBalance).toBe(17);
    expect(recon.calculatedBalance).toBe(10);
    expect(recon.discrepancy).toBe(7);

    // 7c. Run reconciliation with autoFix = true
    const fixedRecon = await inventoryService.reconcileProductStock(productId, true, adminId);
    expect(fixedRecon.isBalanced).toBe(true);
    expect(fixedRecon.cachedBalance).toBe(10);
    expect(fixedRecon.discrepancy).toBe(0);

    // Verify DB product is repaired
    const repairedProduct = await productService.getProductById(productId);
    expect(repairedProduct!.currentStock).toBe(10);

    // Verify audit log recorded auto-fix
    const autoFixAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'STOCK_RECONCILIATION',
        entityId: productId,
      },
    });
    expect(autoFixAudit).toBeDefined();
    expect(autoFixAudit?.action).toBe('AUTO_RECONCILE_STOCK');
  });

  // --------------------------------------------------------------------------
  // 8. LOW STOCK & OUT OF STOCK DETECTION
  // --------------------------------------------------------------------------
  it('8. Low stock query correctly detects LOW_STOCK and OUT_OF_STOCK items', async () => {
    // Product A: 2 in stock, reorder level 5 -> LOW_STOCK
    await productService.createProduct(
      {
        name: 'Low Stock Item A',
        sku: 'LOW_STOCK_A',
        unitId: testUnitId,
        purchasePrice: 10,
        salePrice: 20,
        openingStock: 2,
        reorderLevel: 5,
      },
      adminId
    );

    // Product B: 0 in stock, reorder level 10 -> OUT_OF_STOCK
    await productService.createProduct(
      {
        name: 'Out of Stock Item B',
        sku: 'OUT_STOCK_B',
        unitId: testUnitId,
        purchasePrice: 30,
        salePrice: 50,
        openingStock: 0,
        reorderLevel: 10,
      },
      adminId
    );

    // Product C: 50 in stock, reorder level 5 -> IN_STOCK (not returned)
    await productService.createProduct(
      {
        name: 'Sufficient Stock Item C',
        sku: 'SUFF_STOCK_C',
        unitId: testUnitId,
        purchasePrice: 5,
        salePrice: 10,
        openingStock: 50,
        reorderLevel: 5,
      },
      adminId
    );

    const lowStockResult = await inventoryService.getLowStockProducts();
    const lowStockItems = lowStockResult.data;

    const itemA = lowStockItems.find((p) => p.sku === 'LOW_STOCK_A');
    const itemB = lowStockItems.find((p) => p.sku === 'OUT_STOCK_B');
    const itemC = lowStockItems.find((p) => p.sku === 'SUFF_STOCK_C');

    expect(itemA).toBeDefined();
    expect(itemA?.stockStatus).toBe('LOW_STOCK');
    expect(itemA?.currentStock).toBe(2);

    expect(itemB).toBeDefined();
    expect(itemB?.stockStatus).toBe('OUT_OF_STOCK');
    expect(itemB?.currentStock).toBe(0);

    expect(itemC).toBeUndefined(); // should not be in low stock report
  });

  // --------------------------------------------------------------------------
  // 9. INVENTORY SUMMARY & VALUATION
  // --------------------------------------------------------------------------
  it('9. getInventorySummary returns accurate aggregate SKU counts, units, and valuation', async () => {
    const summary = await inventoryService.getInventorySummary();

    expect(summary.totalProducts).toBeGreaterThanOrEqual(5);
    expect(summary.totalStockValue).toBeGreaterThanOrEqual(0);
    expect(summary.lowStockCount).toBeGreaterThanOrEqual(1);
    expect(summary.outOfStockCount).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // 10. FASTIFY INVENTORY API ROUTES
  // --------------------------------------------------------------------------
  it('10. Fastify inventory routes enforce auth, create adjustments, and serve ledger data', async () => {
    // 10a. Unauthenticated -> 401
    const unauthRes = await dispatchFastify('GET', '/api/inventory/summary');
    expect(unauthRes.error).toBeDefined();

    // 10b. Summary with Cashier token -> 200 Success
    const summaryRes = await dispatchFastify('GET', '/api/inventory/summary', undefined, {
      authorization: cashierToken,
    });
    expect(summaryRes.totalProducts).toBeDefined();

    // 10c. Create Adjustment via Fastify POST with Admin Token -> 200 Success
    const allProds = await productService.listProducts({});
    const targetProd = allProds.data[0];

    const adjPayload = {
      productId: targetProd.id,
      type: 'ADJUSTMENT_IN',
      quantity: 5,
      reason: 'Fastify endpoint adjustment test',
      notes: 'API verification',
    };

    const adjRes = await dispatchFastify('POST', '/api/inventory/adjustments', adjPayload, {
      authorization: adminToken,
    });

    expect(adjRes.id).toBeDefined();
    expect(adjRes.quantity).toBe(5);
    expect(adjRes.type).toBe('ADJUSTMENT_IN');

    // 10d. Query Ledger via Fastify GET -> 200 with pagination
    const ledgerRes = await dispatchFastify(
      'GET',
      `/api/inventory/ledger?productId=${targetProd.id}&limit=10`,
      undefined,
      { authorization: adminToken }
    );

    expect(Array.isArray(ledgerRes.data)).toBe(true);
    expect(ledgerRes.data.length).toBeGreaterThanOrEqual(1);
    expect(ledgerRes.total).toBeGreaterThanOrEqual(1);

    // 10e. Reconcile route: Cashier forbidden (403)
    const cashierRecon = await dispatchFastify(
      'POST',
      `/api/inventory/reconcile/${targetProd.id}`,
      { autoFix: false },
      { authorization: cashierToken }
    );
    expect(cashierRecon.error).toBe('Forbidden');

    // 10f. Reconcile route: Admin allowed (200)
    const adminRecon = await dispatchFastify(
      'POST',
      `/api/inventory/reconcile/${targetProd.id}`,
      { autoFix: false },
      { authorization: adminToken }
    );
    expect(adminRecon.productId).toBe(targetProd.id);
    expect(adminRecon.isBalanced).toBe(true);
  });
});
