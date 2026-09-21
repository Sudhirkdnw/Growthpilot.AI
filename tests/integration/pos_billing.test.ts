import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 7: POS & Billing Workstation Test Suite', () => {
  const prisma = getPrismaClient();
  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;
  let testUnitId: string;
  let testCategoryId: string;
  let product1Id: string;
  let product2Id: string;

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
    await prisma.saleItem.deleteMany({});
    await prisma.salePayment.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.customerPayment.deleteMany({});
    await prisma.customerLedger.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.stockAdjustment.deleteMany({});
    await prisma.stockLedger.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.invoiceSequence.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Create Admin User & Session
    const adminUser = await prisma.user.create({
      data: {
        username: 'pos_admin',
        passwordHash: 'dummyHash',
        fullName: 'POS Administrator',
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
      createdAt: new Date().toISOString(),
    });
    adminToken = adminSession.token;

    // 2. Create Cashier User & Session
    const cashierUser = await prisma.user.create({
      data: {
        username: 'pos_cashier',
        passwordHash: 'dummyHash',
        fullName: 'POS Cashier Station 1',
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
      createdAt: new Date().toISOString(),
    });
    cashierToken = cashierSession.token;

    // 3. Create Base Unit & Category
    const unit = await categoryBrandUnitService.createUnit(
      { name: 'Pieces', shortCode: 'PCS', allowDecimal: false },
      adminId
    );
    testUnitId = unit.id;

    const cat = await categoryBrandUnitService.createCategory(
      { name: 'POS Groceries', description: 'POS test category' },
      adminId
    );
    testCategoryId = cat.id;

    // 4. Create Test Products with Inward Stock
    const p1 = await productService.createProduct(
      {
        name: 'Organic Basmati Rice 5kg',
        sku: 'RICE-5KG',
        barcode: '8901234567890',
        categoryId: testCategoryId,
        unitId: testUnitId,
        purchasePrice: 350.0,
        salePrice: 480.0,
        taxRate: 5.0,
        openingStock: 50,
        reorderLevel: 10,
      },
      adminId
    );
    product1Id = p1.product.id;

    const p2 = await productService.createProduct(
      {
        name: 'Extra Virgin Olive Oil 1L',
        sku: 'OIL-1L',
        barcode: '8909876543210',
        categoryId: testCategoryId,
        unitId: testUnitId,
        purchasePrice: 650.0,
        salePrice: 850.0,
        taxRate: 12.0,
        openingStock: 20,
        reorderLevel: 5,
      },
      adminId
    );
    product2Id = p2.product.id;
  });

  // --------------------------------------------------------------------------
  // 1. POS MATHEMATICAL CALCULATIONS & CHANGE/DUE ENGINE
  // --------------------------------------------------------------------------
  describe('1. POS Math & Totals Calculation Engine', () => {
    it('calculates deterministic subtotals, line taxes, global discounts, and cash change accurately', () => {
      // Items:
      // Item 1: 2 x 480 = 960 gross, 60 discount -> 900 taxable @ 5% tax = 45 tax. Line total = 945
      // Item 2: 1 x 850 = 850 gross, 0 discount -> 850 taxable @ 12% tax = 102 tax. Line total = 952
      // Subtotal = 900 + 850 = 1750
      // Global discount = 50 -> Net Taxable = 1700
      // Taxes = 45 + 102 = 147 + Order Tax 3 = 150
      // Grand Total = 1700 + 150 = 1850
      // Tendered = 2000 -> Change Due = 150, Balance Due = 0
      const calc = saleService.calculateSaleTotals(
        [
          { productId: product1Id, quantity: 2, sellingPrice: 480, discount: 60, taxRate: 5 },
          { productId: product2Id, quantity: 1, sellingPrice: 850, discount: 0, taxRate: 12 },
        ],
        50, // global discount
        3,  // order tax
        2000, // paid
        'CASH'
      );

      expect(calc.subtotal).toBe(1750);
      expect(calc.discount).toBe(110);
      expect(calc.tax).toBe(150);
      expect(calc.total).toBe(1850);
      expect(calc.changeAmount).toBe(150);
      expect(calc.dueAmount).toBe(0);
    });

    it('calculates partial payment with balance due (Credit Khata)', () => {
      const calc = saleService.calculateSaleTotals(
        [{ productId: product1Id, quantity: 1, sellingPrice: 480, discount: 0, taxRate: 0 }],
        0,
        0,
        200, // paid 200 out of 480
        'CASH'
      );

      expect(calc.total).toBe(480);
      expect(calc.changeAmount).toBe(0);
      expect(calc.dueAmount).toBe(280);
    });
  });

  // --------------------------------------------------------------------------
  // 2. CUSTOMER ACCOUNTS & LEDGER
  // --------------------------------------------------------------------------
  describe('2. Customer Accounts & Ledger', () => {
    let testCustomerId: string;

    it('returns default Cash Customer descriptor for walk-ins', () => {
      const cashCust = customerService.getDefaultCashCustomer();
      expect(cashCust.id).toBe('cash-customer');
      expect(cashCust.name).toBe('Cash Customer');
      expect(cashCust.currentBalance).toBe(0);
    });

    it('registers a customer account with opening balance and writes OPENING_BALANCE ledger', async () => {
      const customer = await customerService.createCustomer(
        {
          name: 'Vikram Mehta',
          phone: '9876543210',
          email: 'vikram@example.com',
          address: '42 MG Road, Bengaluru',
          openingBalance: 1200.0,
        },
        adminId
      );

      expect(customer.id).toBeDefined();
      expect(customer.name).toBe('Vikram Mehta');
      expect(customer.openingBalance).toBe(1200);
      expect(customer.currentBalance).toBe(1200);
      testCustomerId = customer.id;

      // Verify authoritative customer ledger entry
      const ledger = await prisma.customerLedger.findFirst({
        where: { customerId: customer.id, type: 'OPENING_BALANCE' },
      });
      expect(ledger).toBeDefined();
      expect(Number(ledger?.debit)).toBe(1200);
      expect(Number(ledger?.balance)).toBe(1200);
    });

    it('lists and searches customers accurately', async () => {
      const result = await customerService.listCustomers({
        search: 'Vikram',
        page: 1,
        pageSize: 10,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data[0].name).toContain('Vikram');
    });

    it('rejects duplicate customer phone numbers', async () => {
      await expect(
        customerService.createCustomer(
          {
            name: 'Duplicate Phone Person',
            phone: '9876543210',
          },
          adminId
        )
      ).rejects.toThrow(/already exists/);
    });
  });

  // --------------------------------------------------------------------------
  // 3. ATOMIC SALE CREATION & HISTORICAL COST PRESERVATION
  // --------------------------------------------------------------------------
  describe('3. Atomic Sale Creation & Historical Cost Preservation', () => {
    let createdSaleId: string;
    let initialStockP1: number;

    beforeAll(async () => {
      const p1 = await productService.getProductById(product1Id);
      initialStockP1 = p1!.currentStock;
    });

    it('processes multi-item cash sale with sequential invoice number and stock deduction', async () => {
      const sale = await saleService.createSale(
        {
          customerId: null, // Walk-in Cash Customer
          items: [
            {
              productId: product1Id,
              quantity: 3,
              sellingPrice: 480.0,
              discount: 40.0,
              taxRate: 5.0,
            },
          ],
          discount: 0,
          tax: 0,
          paidAmount: 1470.0, // Full payment
          paymentMethod: 'CASH',
          notes: 'POS Walk-in Sale Test',
        },
        cashierId
      );

      expect(sale.id).toBeDefined();
      expect(sale.invoiceNumber).toMatch(/^(RS)?INV-\d{6}$/);
      expect(sale.customerName).toBe('Cash Customer');
      expect(sale.status).toBe('POSTED');
      expect(sale.items.length).toBe(1);
      createdSaleId = sale.id;

      // Invariant: historical cost captured must match product.purchasePrice (350.0)
      expect(sale.items[0].costPrice).toBe(350.0);

      // Verify stock deducted strictly via stock_ledger
      const updatedP1 = await productService.getProductById(product1Id);
      expect(updatedP1!.currentStock).toBe(initialStockP1 - 3);

      const ledgerEntry = await prisma.stockLedger.findFirst({
        where: {
          productId: product1Id,
          referenceId: sale.id,
          transactionType: 'SALE',
        },
      });
      expect(ledgerEntry).toBeDefined();
      expect(Number(ledgerEntry?.quantityChange)).toBe(-3);
      expect(Number(ledgerEntry?.balanceAfter)).toBe(initialStockP1 - 3);
    });

    it('captures sale payment record and audit trail', async () => {
      const payments = await prisma.salePayment.findMany({
        where: { saleId: createdSaleId },
      });
      expect(payments.length).toBe(1);
      expect(payments[0].paymentMethod).toBe('CASH');

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: createdSaleId, action: 'SALE_CREATED' },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(cashierId);
    });
  });

  // --------------------------------------------------------------------------
  // 4. NEGATIVE STOCK ENFORCEMENT & POLICY CHECKS
  // --------------------------------------------------------------------------
  describe('4. Negative Stock Enforcement & Policy Checks', () => {
    it('blocks sale when stock is insufficient and policy is BLOCK', async () => {
      // Ensure settings has negativeStockPolicy = BLOCK
      await settingsService.updateAppSettings(
        {
          pos: {
            negativeStockPolicy: 'BLOCK',
          },
        },
        adminId
      );

      // Try to sell 9999 units of p2 (which only has 20 in stock)
      await expect(
        saleService.createSale(
          {
            customerId: null,
            items: [{ productId: product2Id, quantity: 9999, sellingPrice: 850 }],
            paidAmount: 9999 * 850,
            paymentMethod: 'CASH',
          },
          cashierId
        )
      ).rejects.toThrow(/Insufficient stock/);
    });

    it('permits negative stock sale only when policy is ALLOW_WITH_WARNING and override is flagged', async () => {
      // Change policy to ALLOW_WITH_WARNING
      await settingsService.updateAppSettings(
        {
          pos: {
            negativeStockPolicy: 'ALLOW_WITH_WARNING',
          },
        },
        adminId
      );

      // Without override, should reject
      await expect(
        saleService.createSale(
          {
            customerId: null,
            items: [{ productId: product2Id, quantity: 50, sellingPrice: 850 }],
            paidAmount: 50 * 850,
            paymentMethod: 'CASH',
            allowNegativeStockOverride: false,
          },
          cashierId
        )
      ).rejects.toThrow(/Negative Stock Warning.*Please confirm override/);

      // With override, should succeed and deduct stock into negative
      const p2Before = await productService.getProductById(product2Id);
      const sale = await saleService.createSale(
        {
          customerId: null,
          items: [{ productId: product2Id, quantity: 50, sellingPrice: 850 }],
          paidAmount: 50 * 850,
          paymentMethod: 'CASH',
          allowNegativeStockOverride: true,
        },
        cashierId
      );

      expect(sale.id).toBeDefined();
      const p2After = await productService.getProductById(product2Id);
      expect(p2After!.currentStock).toBe(p2Before!.currentStock - 50);
      expect(p2After!.currentStock).toBeLessThan(0); // Authoritative negative stock recorded

      // Reset policy back to default BLOCK
      await settingsService.updateAppSettings(
        { pos: { negativeStockPolicy: 'BLOCK' } },
        adminId
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. CREDIT (KHATA) BILLING & CASH CUSTOMER VALIDATION
  // --------------------------------------------------------------------------
  describe('5. Credit (Khata) Billing & Cash Customer Invariants', () => {
    let regCustomerId: string;

    beforeAll(async () => {
      const cust = await customerService.createCustomer(
        { name: 'Pooja Sharma', phone: '9123456780', openingBalance: 0 },
        adminId
      );
      regCustomerId = cust.id;
    });

    it('rejects credit/partial payment for Cash Customer (walk-in)', async () => {
      await expect(
        saleService.createSale(
          {
            customerId: null, // Cash Customer
            items: [{ productId: product1Id, quantity: 1, sellingPrice: 480 }],
            paidAmount: 100, // Due 380!
            paymentMethod: 'CASH',
          },
          cashierId
        )
      ).rejects.toThrow(/Walk-in Cash Customer must pay in full/);
    });

    it('allows credit sale for registered customer, updating balance and customer ledger', async () => {
      const custBefore = await customerService.getCustomerById(regCustomerId);
      expect(custBefore.currentBalance).toBe(0);

      const sale = await saleService.createSale(
        {
          customerId: regCustomerId,
          items: [{ productId: product1Id, quantity: 2, sellingPrice: 480, taxRate: 0 }],
          paidAmount: 400, // Total is 960 -> Due is 560
          paymentMethod: 'CASH',
        },
        cashierId
      );

      expect(sale.total).toBe(960);
      expect(sale.paidAmount).toBe(400);
      expect(sale.dueAmount).toBe(560);

      // Customer balance increased by dueAmount
      const custAfter = await customerService.getCustomerById(regCustomerId);
      expect(custAfter.currentBalance).toBe(560);

      // Authoritative customer ledger entry created
      const ledger = await prisma.customerLedger.findFirst({
        where: { customerId: regCustomerId, referenceId: sale.id, type: 'INVOICE' },
      });
      expect(ledger).toBeDefined();
      expect(Number(ledger?.debit)).toBe(560);
      expect(Number(ledger?.balance)).toBe(560);
    });
  });

  // --------------------------------------------------------------------------
  // 6. SAFE SALE CANCELLATION & INVENTORY REVERSAL
  // --------------------------------------------------------------------------
  describe('6. Safe Sale Cancellation & Stock/Credit Reversal', () => {
    let cancelTestSaleId: string;
    let customerForCancelId: string;

    beforeAll(async () => {
      const cust = await customerService.createCustomer(
        { name: 'Anil Gupta', phone: '9988776655', openingBalance: 0 },
        adminId
      );
      customerForCancelId = cust.id;

      // Create a sale with 5 units of product1 and 500 due
      const sale = await saleService.createSale(
        {
          customerId: customerForCancelId,
          items: [{ productId: product1Id, quantity: 5, sellingPrice: 480, taxRate: 0 }],
          paidAmount: 1900, // Total = 2400, Due = 500
          paymentMethod: 'CASH',
          notes: 'Sale to be cancelled',
        },
        cashierId
      );
      cancelTestSaleId = sale.id;
    });

    it('cancels sale safely: restores stock via RETURN_IN and reverses customer debt', async () => {
      const p1Before = await productService.getProductById(product1Id);
      const custBefore = await customerService.getCustomerById(customerForCancelId);

      const cancelledSale = await saleService.cancelSale(
        cancelTestSaleId,
        'Accidental entry by cashier',
        adminId
      );

      expect(cancelledSale.status).toBe('CANCELLED');

      // 1. Stock restored by +5 units
      const p1After = await productService.getProductById(product1Id);
      expect(p1After!.currentStock).toBe(p1Before!.currentStock + 5);

      const stockLedgerReversal = await prisma.stockLedger.findFirst({
        where: {
          productId: product1Id,
          referenceId: cancelTestSaleId,
          transactionType: 'RETURN_IN',
        },
      });
      expect(stockLedgerReversal).toBeDefined();
      expect(Number(stockLedgerReversal?.quantityChange)).toBe(5);

      // 2. Customer receivable debt reversed (500 credit)
      const custAfter = await customerService.getCustomerById(customerForCancelId);
      expect(custAfter.currentBalance).toBe(custBefore.currentBalance - 500);

      const custLedgerReversal = await prisma.customerLedger.findFirst({
        where: {
          customerId: customerForCancelId,
          referenceId: cancelTestSaleId,
          type: 'ADJUSTMENT',
        },
      });
      expect(custLedgerReversal).toBeDefined();
      expect(Number(custLedgerReversal?.credit)).toBe(500);
    });

    it('prevents double cancellation of an already cancelled sale', async () => {
      await expect(
        saleService.cancelSale(cancelTestSaleId, 'Try again', adminId)
      ).rejects.toThrow(/already CANCELLED/);
    });
  });

  // --------------------------------------------------------------------------
  // 7. FASTIFY HTTP API ENDPOINTS & AUTHENTICATION GUARD
  // --------------------------------------------------------------------------
  describe('7. Fastify HTTP API Endpoints & Auth Guard', () => {
    it('rejects unauthenticated requests to /api/sales with 401', async () => {
      const res = await dispatchFastify('GET', '/api/sales');
      expect(res.error).toMatch(/Authentication required|Session expired/);
    });

    it('creates sale via Fastify POST /api/sales with valid cashier session', async () => {
      const res = await dispatchFastify(
        'POST',
        '/api/sales',
        {
          customerId: null,
          items: [{ productId: product1Id, quantity: 1, sellingPrice: 480 }],
          paidAmount: 480,
          paymentMethod: 'UPI',
        },
        { authorization: cashierToken }
      );

      expect(res.id).toBeDefined();
      expect(res.invoiceNumber).toBeDefined();
      expect(res.paymentMethod).toBe('UPI');
      expect(res.status).toBe('POSTED');
    });

    it('fetches sale detail via Fastify GET /api/sales/:id', async () => {
      // List sales first
      const list = await dispatchFastify('GET', '/api/sales?page=1&pageSize=5', undefined, {
        authorization: cashierToken,
      });
      expect(list.data.length).toBeGreaterThan(0);

      const saleId = list.data[0].id;
      const detail = await dispatchFastify('GET', `/api/sales/${saleId}`, undefined, {
        authorization: cashierToken,
      });
      expect(detail.id).toBe(saleId);
      expect(detail.items).toBeDefined();
    });

    it('lists customers via Fastify GET /api/customers', async () => {
      const res = await dispatchFastify('GET', '/api/customers?page=1&pageSize=10', undefined, {
        authorization: cashierToken,
      });
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
    });
  });
});
