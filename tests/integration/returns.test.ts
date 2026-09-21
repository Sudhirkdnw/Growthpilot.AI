import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { supplierService } from '../../src/main/modules/suppliers/supplier.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { inventoryService } from '../../src/main/modules/inventory/inventory.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { purchaseReturnService } from '../../src/main/modules/returns/purchase-return.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 8: Sales Returns & Purchase Returns Test Suite', () => {
  const prisma = getPrismaClient();
  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;
  let testUnitId: string;
  let testCategoryId: string;
  let supplierId: string;
  let customerId: string;
  let product1Id: string;
  let product2Id: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up dependent tables in strict foreign-key order
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
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Create Admin User & Session
    const adminUser = await prisma.user.create({
      data: {
        username: 'returns_admin',
        passwordHash: 'dummyHash',
        fullName: 'Returns Administrator',
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
        username: 'returns_cashier',
        passwordHash: 'dummyHash',
        fullName: 'Returns Cashier',
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

    // 3. Create Unit & Category
    const unit = await categoryBrandUnitService.createUnit({ name: 'Piece', shortCode: 'PCS', allowDecimal: false });
    testUnitId = unit.id;
    const category = await categoryBrandUnitService.createCategory({ name: 'Electronics' });
    testCategoryId = category.id;

    // 4. Create Supplier
    const supplier = await supplierService.createSupplier(
      {
        name: 'Apex Wholesale Distro',
        phone: '9876543210',
        openingBalance: 0,
      },
      adminId
    );
    supplierId = supplier.id;

    // 5. Create Customer
    const customer = await customerService.createCustomer(
      {
        name: 'Rahul Sharma',
        phone: '9123456780',
        openingBalance: 0,
      },
      adminId
    );
    customerId = customer.id;

    // 6. Create Products
    const p1 = await productService.createProduct(
      {
        name: 'Logitech MX Master 3S',
        sku: 'MOU-LOGI-001',
        categoryId: testCategoryId,
        unitId: testUnitId,
        purchasePrice: 6000,
        salePrice: 8500,
        taxRate: 18,
      },
      adminId
    );
    product1Id = p1.product.id;

    const p2 = await productService.createProduct(
      {
        name: 'Keychron K2 V2',
        sku: 'KEY-K2-001',
        categoryId: testCategoryId,
        unitId: testUnitId,
        purchasePrice: 4500,
        salePrice: 7000,
        taxRate: 18,
      },
      adminId
    );
    product2Id = p2.product.id;
  });

  const getProductStock = async (pId: string): Promise<number> => {
    const p = await prisma.product.findUnique({ where: { id: pId }, select: { currentStock: true } });
    return Number(p?.currentStock || 0);
  };

  // ==========================================================================
  // SECTION 1: SALES RETURNS TESTS
  // ==========================================================================
  describe('Sales Returns Core Workflows', () => {
    let testSaleId: string;
    let saleItemId1: string;
    let saleItemId2: string;

    beforeAll(async () => {
      // First, add stock via purchase so sales have inventory
      await purchaseService.createPurchase(
        {
          supplierId,
          paymentMethod: 'CASH',
          paidAmount: 60000 + 45000,
          items: [
            { productId: product1Id, quantity: 10, purchasePrice: 6000, discount: 0, taxRate: 0 },
            { productId: product2Id, quantity: 10, purchasePrice: 4500, discount: 0, taxRate: 0 },
          ],
        },
        adminId
      );

      // Create a sale for customer: 3x product1, 2x product2 on CREDIT
      const sale = await saleService.createSale(
        {
          customerId,
          paymentMethod: 'CREDIT',
          paidAmount: 0,
          items: [
            { productId: product1Id, quantity: 3, sellingPrice: 8500, discount: 500, taxRate: 0 },
            { productId: product2Id, quantity: 2, sellingPrice: 7000, discount: 0, taxRate: 0 },
          ],
        },
        cashierId
      );

      testSaleId = sale.id;
      const fullSale = await saleService.getSaleById(testSaleId);
      const item1 = fullSale.items.find((i) => i.productId === product1Id);
      const item2 = fullSale.items.find((i) => i.productId === product2Id);
      saleItemId1 = item1!.id;
      saleItemId2 = item2!.id;
    });

    it('1. Fetches returnable details for a posted sale correctly', async () => {
      const details = await salesReturnService.getSaleReturnableDetails(testSaleId);

      expect(details.saleId).toBe(testSaleId);
      expect(details.customerId).toBe(customerId);
      expect(details.items).toHaveLength(2);

      const it1 = details.items.find((i) => i.productId === product1Id);
      expect(it1?.soldQuantity).toBe(3);
      expect(it1?.previouslyReturnedQuantity).toBe(0);
      expect(it1?.returnableQuantity).toBe(3);
      expect(it1?.unitPrice).toBe(8500);
      expect(it1?.discount).toBe(500); // Proportional discount tracked
    });

    it('2. Processes a partial sales return with RETURN_IN stock movement and customer credit', async () => {
      const stockBefore = await getProductStock(product1Id);
      const customerBefore = await customerService.getCustomerById(customerId);

      // Return 1 of product1
      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: testSaleId,
          refundType: 'CUSTOMER_CREDIT',
          refundMethod: 'CREDIT',
          notes: 'Customer returned 1 mouse due to ergonomic preference',
          items: [{ saleItemId: saleItemId1, productId: product1Id, quantity: 1 }],
        },
        cashierId
      );

      expect(ret.returnNumber).toMatch(/^SR-\d{6}$/);
      expect(ret.status).toBe('POSTED');
      expect(ret.refundType).toBe('CUSTOMER_CREDIT');

      // Proportional refund: unit price 8500 - (500/3 discount) = 8500 - 166.67 = 8333.33
      expect(ret.totalAmount).toBeCloseTo(8333.33, 1);

      // Verify Stock Movement: RETURN_IN
      const stockAfter = await getProductStock(product1Id);
      expect(stockAfter).toBe(stockBefore + 1);

      const ledger = await prisma.stockLedger.findFirst({
        where: { referenceId: ret.id, transactionType: 'RETURN_IN' },
      });
      expect(ledger).toBeDefined();
      expect(Number(ledger?.quantityChange)).toBe(1);

      // Verify Customer Ledger Credit: Decreased customer debt
      const customerAfter = await customerService.getCustomerById(customerId);
      expect(customerAfter.currentBalance).toBeCloseTo(customerBefore.currentBalance - ret.totalAmount, 1);
    });

    it('3. Updates remaining returnable quantities accurately after partial return', async () => {
      const details = await salesReturnService.getSaleReturnableDetails(testSaleId);
      const it1 = details.items.find((i) => i.productId === product1Id);

      expect(it1?.soldQuantity).toBe(3);
      expect(it1?.previouslyReturnedQuantity).toBe(1);
      expect(it1?.returnableQuantity).toBe(2); // 3 sold - 1 returned = 2 remaining
    });

    it('4. Rejects over-return attempt exceeding remaining available quantity', async () => {
      await expect(
        salesReturnService.createSalesReturn(
          {
            saleId: testSaleId,
            refundType: 'CUSTOMER_CREDIT',
            items: [{ saleItemId: saleItemId1, productId: product1Id, quantity: 3 }], // only 2 left!
          },
          cashierId
        )
      ).rejects.toThrow(/Cannot return more than available quantity/);
    });

    it('5. Rejects return with zero or negative quantity', async () => {
      await expect(
        salesReturnService.createSalesReturn(
          {
            saleId: testSaleId,
            items: [{ saleItemId: saleItemId1, productId: product1Id, quantity: 0 }],
          },
          cashierId
        )
      ).rejects.toThrow();
    });

    it('6. Rejects return against a CANCELLED sale', async () => {
      // Create a separate sale and cancel it
      const tempSale = await saleService.createSale(
        {
          customerId,
          paymentMethod: 'CASH',
          paidAmount: 8500,
          items: [{ productId: product1Id, quantity: 1, sellingPrice: 8500 }],
        },
        adminId
      );

      await saleService.cancelSale(tempSale.id, 'Customer requested immediate void', adminId);

      await expect(
        salesReturnService.createSalesReturn(
          {
            saleId: tempSale.id,
            items: [{ productId: product1Id, quantity: 1 }],
          },
          adminId
        )
      ).rejects.toThrow(/Cannot process return against CANCELLED sale/i);
    });

    it('7. Enforces CASH_REFUND for Walk-in Cash Customers (rejects phantom CUSTOMER_CREDIT)', async () => {
      const cashSale = await saleService.createSale(
        {
          customerId: null,
          paymentMethod: 'CASH',
          paidAmount: 7000,
          items: [{ productId: product2Id, quantity: 1, sellingPrice: 7000 }],
        },
        cashierId
      );

      const cashItem = (await saleService.getSaleById(cashSale.id)).items[0];

      // Attempt CUSTOMER_CREDIT on cash sale -> must reject
      await expect(
        salesReturnService.createSalesReturn(
          {
            saleId: cashSale.id,
            refundType: 'CUSTOMER_CREDIT',
            items: [{ saleItemId: cashItem.id, productId: product2Id, quantity: 1 }],
          },
          cashierId
        )
      ).rejects.toThrow(/Customer credit refund is not permitted for Cash Customer/i);

      // CASH_REFUND must succeed
      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: cashSale.id,
          refundType: 'CASH_REFUND',
          refundMethod: 'CASH',
          items: [{ saleItemId: cashItem.id, productId: product2Id, quantity: 1 }],
        },
        cashierId
      );

      expect(ret.status).toBe('POSTED');
      expect(ret.refundType).toBe('CASH_REFUND');
    });

    it('8. Cancelling a sales return safely reverses restocked items and customer credit', async () => {
      const stockBefore = await getProductStock(product2Id);
      const customerBefore = await customerService.getCustomerById(customerId);

      // Return 1 of product2
      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: testSaleId,
          refundType: 'CUSTOMER_CREDIT',
          items: [{ saleItemId: saleItemId2, productId: product2Id, quantity: 1 }],
        },
        cashierId
      );

      expect(await getProductStock(product2Id)).toBe(stockBefore + 1);

      // Now Cancel the Sales Return
      const cancelled = await salesReturnService.cancelSalesReturn(
        ret.id,
        'Wrong item returned by clerk mistake',
        adminId
      );

      expect(cancelled.status).toBe('CANCELLED');

      // Stock should be deducted back
      const stockAfter = await getProductStock(product2Id);
      expect(stockAfter).toBe(stockBefore);

      // Customer credit should be reversed
      const customerAfter = await customerService.getCustomerById(customerId);
      expect(customerAfter.currentBalance).toBeCloseTo(customerBefore.currentBalance, 1);

      // Original sale must remain completely POSTED and uncorrupted
      const originalSale = await saleService.getSaleById(testSaleId);
      expect(originalSale.status).toBe('POSTED');
    });

    it('9. Concurrency race protection prevents over-returning beyond available quantity', async () => {
      // Create a fresh dedicated sale for concurrency testing: 2 sold
      const concSale = await saleService.createSale(
        {
          customerId,
          paymentMethod: 'CASH',
          paidAmount: 17000,
          items: [{ productId: product1Id, quantity: 2, sellingPrice: 8500 }],
        },
        cashierId
      );
      const concSaleDet = await saleService.getSaleById(concSale.id);
      const concSaleItemId = concSaleDet.items[0].id;

      // Dispatch 3 concurrent returns each attempting to return 1 item (total 3, but only 2 available)
      const requests = [1, 2, 3].map(() =>
        salesReturnService
          .createSalesReturn(
            {
              saleId: concSale.id,
              refundType: 'CASH_REFUND',
              items: [{ saleItemId: concSaleItemId, productId: product1Id, quantity: 1 }],
            },
            adminId
          )
          .then(() => ({ success: true }))
          .catch((err) => ({ success: false, error: err.message }))
      );

      const results = await Promise.all(requests);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(2); // Exactly 2 should succeed
      expect(failCount).toBe(1); // 1 must fail due to serialized over-return rejection
    });
  });

  // ==========================================================================
  // SECTION 2: PURCHASE RETURNS TESTS
  // ==========================================================================
  describe('Purchase Returns Core Workflows', () => {
    let testPurchaseId: string;
    let purchaseItemId1: string;

    beforeAll(async () => {
      // Create a fresh purchase order: 10 of product1 at 6000 each on CREDIT
      const p = await purchaseService.createPurchase(
        {
          supplierId,
          paymentMethod: 'CREDIT',
          paidAmount: 0,
          items: [
            { productId: product1Id, quantity: 10, purchasePrice: 6000, discount: 0, taxRate: 0 },
          ],
        },
        adminId
      );

      testPurchaseId = p.id;
      const fullPurchase = await purchaseService.getPurchaseById(testPurchaseId);
      purchaseItemId1 = fullPurchase.items[0].id;
    });

    it('10. Fetches purchase returnable details accurately', async () => {
      const details = await purchaseReturnService.getPurchaseReturnableDetails(testPurchaseId);

      expect(details.purchaseId).toBe(testPurchaseId);
      expect(details.supplierId).toBe(supplierId);
      expect(details.items).toHaveLength(1);

      const item = details.items[0];
      expect(item.purchasedQuantity).toBe(10);
      expect(item.previouslyReturnedQuantity).toBe(0);
      expect(item.returnableQuantity).toBe(10);
      expect(item.purchasePrice).toBe(6000);
    });

    it('11. Processes a partial purchase return with RETURN_OUT stock reduction and supplier ledger debit', async () => {
      const stockBefore = await getProductStock(product1Id);
      const supplierBefore = await supplierService.getSupplierById(supplierId);

      // Return 3 items to supplier
      const ret = await purchaseReturnService.createPurchaseReturn(
        {
          purchaseId: testPurchaseId,
          refundType: 'SUPPLIER_PAYABLE_DEDUCTION',
          notes: '3 units damaged in manufacturer shipping box',
          items: [{ purchaseItemId: purchaseItemId1, productId: product1Id, quantity: 3 }],
        },
        adminId
      );

      expect(ret.returnNumber).toMatch(/^PR-\d{6}$/);
      expect(ret.status).toBe('POSTED');
      expect(ret.totalAmount).toBe(3 * 6000);

      // Stock should be deducted: RETURN_OUT
      const stockAfter = await getProductStock(product1Id);
      expect(stockAfter).toBe(stockBefore - 3);

      const ledger = await prisma.stockLedger.findFirst({
        where: { referenceId: ret.id, transactionType: 'RETURN_OUT' },
      });
      expect(ledger).toBeDefined();
      expect(Number(ledger?.quantityChange)).toBe(-3);

      // Supplier payable balance should be reduced by 18,000
      const supplierAfter = await supplierService.getSupplierById(supplierId);
      expect(supplierAfter.currentBalance).toBe(supplierBefore.currentBalance - 18000);

      // Supplier ledger must have a PURCHASE_RETURN debit entry
      const supLedger = await prisma.supplierLedger.findFirst({
        where: { referenceId: ret.id, type: 'PURCHASE_RETURN' },
      });
      expect(supLedger).toBeDefined();
      expect(Number(supLedger?.debit)).toBe(18000);
    });

    it('12. Rejects purchase over-return exceeding available un-returned quantity', async () => {
      // 10 purchased - 3 returned = 7 remaining
      await expect(
        purchaseReturnService.createPurchaseReturn(
          {
            purchaseId: testPurchaseId,
            items: [{ purchaseItemId: purchaseItemId1, productId: product1Id, quantity: 8 }],
          },
          adminId
        )
      ).rejects.toThrow(/Cannot return more than available quantity/);
    });

    it('13. Enforces negative stock policy when returning to supplier', async () => {
      // Ensure negativeStockPolicy is BLOCK
      await settingsService.updateAppSettings(
        {
          pos: {
            negativeStockPolicy: 'BLOCK',
          },
        },
        adminId
      );

      // Artificially sell or adjust stock so stock is lower than return quantity
      const currentStock = await getProductStock(product1Id);
      // Adjust stock to 1
      await inventoryService.createStockAdjustment(
        {
          productId: product1Id,
          type: 'ADJUSTMENT_OUT',
          quantity: currentStock - 1,
          reason: 'Test stock reduction',
        },
        adminId
      );

      // Attempt to return 2 items to supplier (current stock is 1)
      await expect(
        purchaseReturnService.createPurchaseReturn(
          {
            purchaseId: testPurchaseId,
            items: [{ purchaseItemId: purchaseItemId1, productId: product1Id, quantity: 2 }],
            allowNegativeStockOverride: false,
          },
          adminId
        )
      ).rejects.toThrow(/Insufficient on-hand stock/i);

      // Restore stock for remaining tests
      await inventoryService.createStockAdjustment(
        {
          productId: product1Id,
          type: 'ADJUSTMENT_IN',
          quantity: 10,
          reason: 'Restore stock',
        },
        adminId
      );
    });

    it('14. Cancelling a purchase return safely restocks items and reverses supplier ledger debit', async () => {
      const stockBefore = await getProductStock(product1Id);
      const supplierBefore = await supplierService.getSupplierById(supplierId);

      // Return 1 item
      const ret = await purchaseReturnService.createPurchaseReturn(
        {
          purchaseId: testPurchaseId,
          items: [{ purchaseItemId: purchaseItemId1, productId: product1Id, quantity: 1 }],
        },
        adminId
      );

      expect(await getProductStock(product1Id)).toBe(stockBefore - 1);

      // Cancel the purchase return
      const cancelled = await purchaseReturnService.cancelPurchaseReturn(
        ret.id,
        'Supplier refused return delivery',
        adminId
      );

      expect(cancelled.status).toBe('CANCELLED');

      // Stock should be put back (RETURN_IN)
      expect(await getProductStock(product1Id)).toBe(stockBefore);

      // Supplier payable debt restored
      const supplierAfter = await supplierService.getSupplierById(supplierId);
      expect(supplierAfter.currentBalance).toBe(supplierBefore.currentBalance);
    });
  });

  // ==========================================================================
  // SECTION 3: FASTIFY IN-PROCESS DISPATCH & IPC INTEGRATION
  // ==========================================================================
  describe('Fastify In-Process API & IPC Integration', () => {
    let fastifySaleId: string;
    let fastifyPurchaseId: string;
    let fastifySaleItemId: string;
    let fastifyPurchaseItemId: string;

    beforeAll(async () => {
      // Stock up
      await inventoryService.createStockAdjustment(
        {
          productId: product1Id,
          type: 'ADJUSTMENT_IN',
          quantity: 20,
          reason: 'Fastify dispatch test setup',
        },
        adminId
      );

      // Create a sale via fastify inject
      const sRes = await dispatchFastify<{ id: string }>(
        'POST',
        '/api/sales',
        {
          customerId,
          paymentMethod: 'CASH',
          paidAmount: 8500,
          items: [{ productId: product1Id, quantity: 1, sellingPrice: 8500 }],
        },
        { authorization: cashierToken }
      );
      fastifySaleId = sRes.id;
      const saleDet = await saleService.getSaleById(fastifySaleId);
      fastifySaleItemId = saleDet.items[0].id;

      // Create a purchase via fastify inject
      const pRes = await dispatchFastify<{ id: string }>(
        'POST',
        '/api/purchases',
        {
          supplierId,
          paymentMethod: 'CASH',
          paidAmount: 12000,
          items: [{ productId: product1Id, quantity: 2, purchasePrice: 6000 }],
        },
        { authorization: adminToken }
      );
      fastifyPurchaseId = pRes.id;
      const purDet = await purchaseService.getPurchaseById(fastifyPurchaseId);
      fastifyPurchaseItemId = purDet.items[0].id;
    });

    it('15. GET /api/sales/:id/returnable returns returnable data', async () => {
      const res = await dispatchFastify<any>(
        'GET',
        `/api/sales/${fastifySaleId}/returnable`,
        undefined,
        { authorization: cashierToken }
      );

      expect(res.saleId).toBe(fastifySaleId);
      expect(res.items[0].returnableQuantity).toBe(1);
    });

    it('16. POST /api/sales-returns creates return transaction through fastify in-process', async () => {
      const res = await dispatchFastify<any>(
        'POST',
        '/api/sales-returns',
        {
          saleId: fastifySaleId,
          refundType: 'CASH_REFUND',
          items: [{ saleItemId: fastifySaleItemId, productId: product1Id, quantity: 1 }],
        },
        { authorization: cashierToken }
      );

      expect(res.returnNumber).toMatch(/^SR-\d{6}$/);
      expect(res.status).toBe('POSTED');
    });

    it('17. GET /api/sales-returns lists returns with pagination', async () => {
      const res = await dispatchFastify<any>(
        'GET',
        '/api/sales-returns?page=1&pageSize=10',
        undefined,
        { authorization: cashierToken }
      );

      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.total).toBeGreaterThanOrEqual(1);
    });

    it('18. GET /api/purchases/:id/returnable returns purchase returnable data', async () => {
      const res = await dispatchFastify<any>(
        'GET',
        `/api/purchases/${fastifyPurchaseId}/returnable`,
        undefined,
        { authorization: adminToken }
      );

      expect(res.purchaseId).toBe(fastifyPurchaseId);
      expect(res.items[0].returnableQuantity).toBe(2);
    });

    it('19. POST /api/purchase-returns creates purchase return through fastify in-process', async () => {
      const res = await dispatchFastify<any>(
        'POST',
        '/api/purchase-returns',
        {
          purchaseId: fastifyPurchaseId,
          refundType: 'SUPPLIER_PAYABLE_DEDUCTION',
          items: [{ purchaseItemId: fastifyPurchaseItemId, productId: product1Id, quantity: 1 }],
        },
        { authorization: adminToken }
      );

      expect(res.returnNumber).toMatch(/^PR-\d{6}$/);
      expect(res.status).toBe('POSTED');
    });

    it('20. GET /api/purchase-returns lists purchase returns', async () => {
      const res = await dispatchFastify<any>(
        'GET',
        '/api/purchase-returns?page=1&pageSize=10',
        undefined,
        { authorization: adminToken }
      );

      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.total).toBeGreaterThanOrEqual(1);
    });

    it('21. AuthGuard blocks unauthenticated requests to return endpoints', async () => {
      const res = await dispatchFastify<any>(
        'POST',
        '/api/sales-returns',
        {
          saleId: fastifySaleId,
          items: [{ productId: product1Id, quantity: 1 }],
        }
        // No authorization header
      );

      expect(res.error).toMatch(/Authentication required|Session invalid/i);
    });
  });
});
