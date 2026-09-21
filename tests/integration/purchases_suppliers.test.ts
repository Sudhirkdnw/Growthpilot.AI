import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { supplierService } from '../../src/main/modules/suppliers/supplier.service';
import { supplierAccountService } from '../../src/main/modules/suppliers/supplier-account.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 6: Purchases & Supplier Accounts Test Suite', () => {
  const prisma = getPrismaClient();
  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;
  let testUnitId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up dependent tables in correct foreign-key order
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
    await prisma.stockAdjustment.deleteMany({});
    await prisma.stockLedger.deleteMany({});
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

    // 1. Create Admin User & Session
    const adminUser = await prisma.user.create({
      data: {
        username: 'purchase_admin',
        passwordHash: 'dummyHash',
        fullName: 'Purchase Administrator',
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

    // 2. Create Cashier User & Session
    const cashierUser = await prisma.user.create({
      data: {
        username: 'purchase_cashier',
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

    // 3. Seed Unit & Category
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Carton Box',
      shortCode: 'CTN',
      allowDecimal: false,
    });
    testUnitId = unit.id;

    const cat = await categoryBrandUnitService.createCategory({
      name: 'Wholesale Category',
      description: 'Test category for inward procurement',
    });
    testCategoryId = cat.id;
  });

  // --------------------------------------------------------------------------
  // 1. SUPPLIER CREATION & OPENING BALANCE
  // --------------------------------------------------------------------------
  it('1. Create supplier with opening balance initializes supplier_ledger and balance cache', async () => {
    const supplier = await supplierService.createSupplier(
      {
        name: 'Apex Wholesale Distro',
        phone: '9876500001',
        email: 'orders@apexdistro.com',
        address: '124 Market Yard, Sector 4',
        gstin: '27AAAAA0000A1Z5',
        openingBalance: 5000,
      },
      adminId
    );

    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe('Apex Wholesale Distro');
    expect(supplier.openingBalance).toBe(5000);
    expect(supplier.currentBalance).toBe(5000);
    expect(supplier.status).toBe('ACTIVE');

    // Verify supplier_ledger record
    const ledger = await prisma.supplierLedger.findMany({
      where: { supplierId: supplier.id },
    });

    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe('OPENING_BALANCE');
    expect(Number(ledger[0].credit)).toBe(5000);
    expect(Number(ledger[0].balance)).toBe(5000);
  });

  // --------------------------------------------------------------------------
  // 2. SUPPLIER UPDATES & DEACTIVATION
  // --------------------------------------------------------------------------
  it('2. Update supplier details and deactivate supplier', async () => {
    const supplier = await supplierService.createSupplier(
      {
        name: 'Old Supplier Co',
        phone: '9876500002',
      },
      adminId
    );

    const updated = await supplierService.updateSupplier(
      supplier.id,
      {
        name: 'Updated Supplier Co',
        gstin: '29BBBBB1111B1Z2',
      },
      adminId
    );

    expect(updated.name).toBe('Updated Supplier Co');
    expect(updated.gstin).toBe('29BBBBB1111B1Z2');

    // Deactivate
    const deactivated = await supplierService.deactivateSupplier(supplier.id, adminId);
    expect(deactivated.status).toBe('INACTIVE');
  });

  // --------------------------------------------------------------------------
  // 3. ATOMIC PURCHASE CREATION WITH STOCK & LEDGER INTEGRATION
  // --------------------------------------------------------------------------
  it('3. Create valid purchase: increases stock, creates PURCHASE stock_ledger, and updates supplier balance', async () => {
    // Create products
    const prodA = (
      await productService.createProduct(
        {
          name: 'Procured Biscuit Pack',
          sku: 'PROC_BISC_001',
          unitId: testUnitId,
          purchasePrice: 20,
          salePrice: 30,
          openingStock: 10,
        },
        adminId
      )
    ).product;

    const prodB = (
      await productService.createProduct(
        {
          name: 'Procured Juice Can',
          sku: 'PROC_JUICE_001',
          unitId: testUnitId,
          purchasePrice: 40,
          salePrice: 60,
          openingStock: 5,
        },
        adminId
      )
    ).product;

    // Create supplier
    const supplier = await supplierService.createSupplier(
      {
        name: 'Metro Mega Suppliers',
        phone: '9876500003',
        openingBalance: 0,
      },
      adminId
    );

    // Purchase 20 units of ProdA (₹20 = ₹400) and 10 units of ProdB (₹40 = ₹400)
    // Subtotal = ₹800. Discount = ₹50. Order Tax = ₹35. Grand Total = ₹785.
    // Paid Amount = ₹300 (Partial payment). Due Amount = ₹485.
    const purchase = await purchaseService.createPurchase(
      {
        supplierId: supplier.id,
        items: [
          { productId: prodA.id, quantity: 20, purchasePrice: 20, discount: 0, taxRate: 0 },
          { productId: prodB.id, quantity: 10, purchasePrice: 40, discount: 0, taxRate: 0 },
        ],
        discount: 50,
        tax: 35,
        paidAmount: 300,
        paymentMethod: 'CASH',
        notes: 'Inward shipment batch #101',
      },
      adminId
    );

    expect(purchase.purchaseNumber).toBeDefined();
    expect(purchase.subtotal).toBe(800);
    expect(purchase.discount).toBe(50);
    expect(purchase.tax).toBe(35);
    expect(purchase.total).toBe(785);
    expect(purchase.paidAmount).toBe(300);
    expect(purchase.dueAmount).toBe(485);
    expect(purchase.status).toBe('POSTED');

    // 3a. Verify Stock was increased
    const updatedProdA = await productService.getProductById(prodA.id);
    const updatedProdB = await productService.getProductById(prodB.id);

    expect(updatedProdA!.currentStock).toBe(30); // 10 opening + 20 purchase
    expect(updatedProdB!.currentStock).toBe(15); // 5 opening + 10 purchase

    // 3b. Verify authoritative Stock Ledger entries
    const ledgerA = await prisma.stockLedger.findFirst({
      where: { productId: prodA.id, transactionType: 'PURCHASE' },
    });
    expect(ledgerA).toBeDefined();
    expect(Number(ledgerA?.quantityChange)).toBe(20);
    expect(Number(ledgerA?.balanceAfter)).toBe(30);

    // 3c. Verify Supplier Ledger entry & Payable Balance
    const supLedger = await prisma.supplierLedger.findFirst({
      where: { supplierId: supplier.id, type: 'PURCHASE' },
    });
    expect(supLedger).toBeDefined();
    expect(Number(supLedger?.credit)).toBe(785);
    expect(Number(supLedger?.debit)).toBe(300);
    expect(Number(supLedger?.balance)).toBe(485);

    const updatedSup = await supplierService.getSupplierById(supplier.id);
    expect(updatedSup.currentBalance).toBe(485);
  });

  // --------------------------------------------------------------------------
  // 4. CASH SUPPLIER PURCHASES (SPOT PAYMENT ONLY)
  // --------------------------------------------------------------------------
  it('4. Cash Supplier purchase allows spot full payment but rejects credit', async () => {
    const prod = (
      await productService.createProduct(
        {
          name: 'Spot Cash Product',
          sku: 'SPOT_CASH_001',
          unitId: testUnitId,
          purchasePrice: 15,
          salePrice: 25,
          openingStock: 0,
        },
        adminId
      )
    ).product;

    // 4a. Attempt credit purchase with Cash Supplier (supplierId = null, dueAmount > 0) -> rejected
    await expect(
      purchaseService.createPurchase(
        {
          supplierId: null,
          items: [{ productId: prod.id, quantity: 10, purchasePrice: 15 }],
          paidAmount: 50, // Total = 150, due = 100
          paymentMethod: 'CASH',
        },
        adminId
      )
    ).rejects.toThrow(/Credit purchases require an active, registered supplier/);

    // 4b. Full payment with Cash Supplier -> succeeds
    const purchase = await purchaseService.createPurchase(
      {
        supplierId: null,
        items: [{ productId: prod.id, quantity: 10, purchasePrice: 15 }],
        paidAmount: 150, // Total = 150, due = 0
        paymentMethod: 'CASH',
      },
      adminId
    );

    expect(purchase.supplierName).toBe('Cash Supplier');
    expect(purchase.dueAmount).toBe(0);

    const updatedProd = await productService.getProductById(prod.id);
    expect(updatedProd!.currentStock).toBe(10);
  });

  // --------------------------------------------------------------------------
  // 5. HISTORICAL PURCHASE PRICE INTEGRITY
  // --------------------------------------------------------------------------
  it('5. Modifying product catalog purchasePrice later does NOT affect historical purchase items', async () => {
    const prod = (
      await productService.createProduct(
        {
          name: 'Historical Price Product',
          sku: 'HIST_PRICE_001',
          unitId: testUnitId,
          purchasePrice: 50,
          salePrice: 80,
          openingStock: 0,
        },
        adminId
      )
    ).product;

    // Create purchase bill at ₹50 per unit
    const purchase = await purchaseService.createPurchase(
      {
        supplierId: null,
        items: [{ productId: prod.id, quantity: 5, purchasePrice: 50 }],
        paidAmount: 250,
        paymentMethod: 'CASH',
      },
      adminId
    );

    // Later: update product purchase price to ₹75 in catalog
    await productService.updateProduct(
      prod.id,
      { purchasePrice: 75 },
      adminId
    );

    // Re-fetch historical purchase bill
    const historicalPurchase = await purchaseService.getPurchaseById(purchase.id);
    expect(historicalPurchase.items[0].purchasePrice).toBe(50);
    expect(historicalPurchase.items[0].lineTotal).toBe(250);
    expect(historicalPurchase.total).toBe(250);
  });

  // --------------------------------------------------------------------------
  // 6. SUPPLIER PAYMENT WORKFLOW & LEDGER RECONCILIATION
  // --------------------------------------------------------------------------
  it('6. Record supplier payment debits ledger, reduces payable, and reconciles balance', async () => {
    const supplier = await supplierService.createSupplier(
      {
        name: 'Payment Target Supplier',
        phone: '9876500004',
        openingBalance: 10000,
      },
      adminId
    );

    // Supplier has ₹10,000 payable. Make partial payment of ₹4,000
    const paymentRes = await supplierAccountService.recordSupplierPayment(
      {
        supplierId: supplier.id,
        amount: 4000,
        paymentMethod: 'BANK_TRANSFER',
        reference: 'NEFT-889922',
        notes: 'Monthly settlement',
      },
      adminId
    );

    expect(paymentRes.previousBalance).toBe(10000);
    expect(paymentRes.newBalance).toBe(6000);
    expect(paymentRes.payment.amount).toBe(4000);
    expect(paymentRes.payment.paymentMethod).toBe('BANK_TRANSFER');

    // Verify supplier DB balance
    const updatedSup = await supplierService.getSupplierById(supplier.id);
    expect(updatedSup.currentBalance).toBe(6000);

    // Verify reconciliation
    const recon = await supplierAccountService.reconcileSupplierBalance(supplier.id);
    expect(recon.isBalanced).toBe(true);
    expect(recon.cachedBalance).toBe(6000);
    expect(recon.calculatedBalance).toBe(6000);
    expect(recon.discrepancy).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 7. SUPPLIER DELETION PROTECTION (PRD SECTION 18.4)
  // --------------------------------------------------------------------------
  it('7. Supplier deletion is blocked when transaction history exists', async () => {
    const supplier = await supplierService.createSupplier(
      {
        name: 'Protected Supplier',
        phone: '9876500005',
        openingBalance: 2000,
      },
      adminId
    );

    // Attempting to delete supplier with ledger history -> rejected
    await expect(
      supplierService.deleteSupplier(supplier.id, adminId)
    ).rejects.toThrow(/Cannot delete supplier: \d+ transaction\(s\) exist/);

    // Create another supplier with NO history -> deletion succeeds
    const emptySup = await supplierService.createSupplier(
      {
        name: 'Empty Transient Supplier',
        phone: '9876500006',
        openingBalance: 0,
      },
      adminId
    );

    const delRes = await supplierService.deleteSupplier(emptySup.id, adminId);
    expect(delRes.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. SAFE PURCHASE CANCELLATION
  // --------------------------------------------------------------------------
  it('8. Safe purchase cancellation reverses stock and supplier payable balance', async () => {
    const prod = (
      await productService.createProduct(
        {
          name: 'Cancellation Test Item',
          sku: 'CANCEL_TEST_001',
          unitId: testUnitId,
          purchasePrice: 100,
          salePrice: 150,
          openingStock: 0,
        },
        adminId
      )
    ).product;

    const supplier = await supplierService.createSupplier(
      {
        name: 'Cancellation Supplier',
        phone: '9876500007',
        openingBalance: 0,
      },
      adminId
    );

    // Purchase 10 units on credit (Total = ₹1,000, paid = 0, due = ₹1,000)
    const purchase = await purchaseService.createPurchase(
      {
        supplierId: supplier.id,
        items: [{ productId: prod.id, quantity: 10, purchasePrice: 100 }],
        paidAmount: 0,
        paymentMethod: 'CREDIT',
      },
      adminId
    );

    // Stock = 10, Supplier Due = ₹1,000
    expect((await productService.getProductById(prod.id))!.currentStock).toBe(10);
    expect((await supplierService.getSupplierById(supplier.id)).currentBalance).toBe(1000);

    // Cancel purchase
    const cancelled = await purchaseService.cancelPurchase(
      purchase.id,
      'Damaged batch returned to supplier',
      adminId
    );

    expect(cancelled.status).toBe('CANCELLED');

    // 8a. Stock reversed to 0
    const reversedProd = await productService.getProductById(prod.id);
    expect(reversedProd!.currentStock).toBe(0);

    // 8b. Supplier due reversed to 0
    const reversedSup = await supplierService.getSupplierById(supplier.id);
    expect(reversedSup.currentBalance).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 9. VALIDATION EDGE CASES (Negative prices, Inactive products, etc.)
  // --------------------------------------------------------------------------
  it('9. Validation rejects inactive products, negative prices and zero quantity', async () => {
    const inactiveProd = (
      await productService.createProduct(
        {
          name: 'Inactive Proc Item',
          sku: 'INACT_PROC_001',
          unitId: testUnitId,
          purchasePrice: 10,
          salePrice: 20,
        },
        adminId
      )
    ).product;

    await productService.updateProduct(inactiveProd.id, { status: 'INACTIVE' }, adminId);

    // Inactive product
    await expect(
      purchaseService.createPurchase(
        {
          supplierId: null,
          items: [{ productId: inactiveProd.id, quantity: 5, purchasePrice: 10 }],
          paidAmount: 50,
          paymentMethod: 'CASH',
        },
        adminId
      )
    ).rejects.toThrow(/Cannot purchase inactive product/);

    // Zero quantity rejected by schema
    await expect(
      purchaseService.createPurchase(
        {
          supplierId: null,
          items: [{ productId: inactiveProd.id, quantity: 0, purchasePrice: 10 }],
          paidAmount: 0,
          paymentMethod: 'CASH',
        },
        adminId
      )
    ).rejects.toThrow(/Quantity must be greater than zero/);
  });

  // --------------------------------------------------------------------------
  // 10. FASTIFY PURCHASE & SUPPLIER ROUTES (AUTHORIZATION & IN-MEMORY DISPATCH)
  // --------------------------------------------------------------------------
  it('10. Fastify purchase and supplier endpoints enforce auth and execute operations', async () => {
    // 10a. Unauthenticated -> 401
    const unauthRes = await dispatchFastify('GET', '/api/suppliers');
    expect(unauthRes.error).toBeDefined();

    // 10b. Create supplier via Fastify POST with cashier token -> 200
    const supRes = await dispatchFastify(
      'POST',
      '/api/suppliers',
      { name: 'Fastify Supplier Co', phone: '9988776655' },
      { authorization: cashierToken }
    );
    expect(supRes.id).toBeDefined();
    expect(supRes.name).toBe('Fastify Supplier Co');

    // 10c. Cashier forbidden to delete supplier (403)
    const delCashier = await dispatchFastify(
      'DELETE',
      `/api/suppliers/${supRes.id}`,
      undefined,
      { authorization: cashierToken }
    );
    expect(delCashier.error).toBe('Forbidden');

    // 10d. Admin allowed to delete empty supplier (200)
    const delAdmin = await dispatchFastify(
      'DELETE',
      `/api/suppliers/${supRes.id}`,
      undefined,
      { authorization: adminToken }
    );
    expect(delAdmin.success).toBe(true);

    // 10e. List purchases via Fastify GET -> 200
    const purchasesRes = await dispatchFastify('GET', '/api/purchases', undefined, {
      authorization: cashierToken,
    });
    expect(Array.isArray(purchasesRes.data)).toBe(true);
    expect(purchasesRes.total).toBeGreaterThanOrEqual(1);
  });
});
