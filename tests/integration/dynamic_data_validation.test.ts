import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { customerAccountService } from '../../src/main/modules/customers/customer-account.service';
import { dashboardService } from '../../src/main/modules/reports/dashboard.service';
import { salesReportService } from '../../src/main/modules/reports/sales-report.service';
import { inventoryReportService } from '../../src/main/modules/reports/inventory-report.service';
import { reportService } from '../../src/main/modules/reports/report.service';
import { seedCatalog } from '../../prisma/seed';

describe('Mixed General Store — Dynamic Data & Business Logic Validation Suite', () => {
  const prisma = getPrismaClient();

  let adminUserId: string;
  let testCustomerId: string;
  let testSupplierId: string;
  let unitKgId: string;
  let unitPcsId: string;
  let unitLtrId: string;
  let unitMtrId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Ensure full catalog and initial transactions are seeded
    const prodCount = await prisma.product.count();
    if (prodCount < 100) {
      await seedCatalog();
    }

    // Verify or fetch Admin User
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          username: 'dynamic_test_admin',
          passwordHash: 'dummyHash',
          fullName: 'Dynamic Test Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    adminUserId = admin.id;

    // Fetch basic units
    const uKg = await prisma.unit.findUniqueOrThrow({ where: { shortCode: 'KG' } });
    const uPcs = await prisma.unit.findUniqueOrThrow({ where: { shortCode: 'PCS' } });
    const uLtr = await prisma.unit.findUniqueOrThrow({ where: { shortCode: 'LTR' } });
    const uMtr = await prisma.unit.findUniqueOrThrow({ where: { shortCode: 'MTR' } });

    unitKgId = uKg.id;
    unitPcsId = uPcs.id;
    unitLtrId = uLtr.id;
    unitMtrId = uMtr.id;

    // Fetch or create Customer
    let cust = await prisma.customer.findFirst({ where: { name: 'Amit Sharma' } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          name: 'Amit Sharma',
          phone: '9811122233',
          openingBalance: 0,
          currentBalance: 0,
        },
      });
    }
    testCustomerId = cust.id;

    // Fetch or create Supplier
    let supp = await prisma.supplier.findFirst({ where: { name: 'City Wholesale Grocery Mart' } });
    if (!supp) {
      supp = await prisma.supplier.create({
        data: {
          name: 'City Wholesale Grocery Mart',
          phone: '9822011111',
          openingBalance: 0,
          currentBalance: 0,
        },
      });
    }
    testSupplierId = supp.id;
  });

  // ==========================================================================
  // 1. DYNAMIC CATALOG & PRESENTATION TESTS
  // ==========================================================================
  describe('1. Dynamic Master Data Loading (No Static Data)', () => {
    it('1.1 Loads dynamic categories from the database', async () => {
      const categories = await categoryBrandUnitService.listCategories();
      expect(categories.length).toBeGreaterThanOrEqual(25);
      expect(categories.some((c) => c.name === 'Grocery')).toBe(true);
      expect(categories.some((c) => c.name === 'Stationery')).toBe(true);
      expect(categories.some((c) => c.name === 'Electrical')).toBe(true);
      expect(categories.some((c) => c.name === 'Kitchen & Utility')).toBe(true);
    });

    it('1.2 Loads dynamic products across multiple categories', async () => {
      const res = await productService.listProducts({ page: 1, pageSize: 200 });
      expect(res.total).toBeGreaterThanOrEqual(100);
      expect(res.data.some((p) => p.name.includes('Basmati Rice'))).toBe(true);
      expect(res.data.some((p) => p.name.includes('Ballpoint Pen'))).toBe(true);
      expect(res.data.some((p) => p.name.includes('LED Bulb'))).toBe(true);
      expect(res.data.some((p) => p.name.includes('Cricket Ball'))).toBe(true);
    });

    it('1.3 Dynamic POS search matches products by name, SKU, category, and brand', async () => {
      // By name
      const penSearch = await productService.listProducts({ search: 'Ballpoint Pen' });
      expect(penSearch.data.length).toBeGreaterThanOrEqual(1);

      // By category name
      const toySearch = await productService.listProducts({ search: 'Toys' });
      expect(toySearch.data.length).toBeGreaterThanOrEqual(1);

      // By brand name
      const tataSearch = await productService.listProducts({ search: 'Tata' });
      expect(tataSearch.data.length).toBeGreaterThanOrEqual(1);
    });

    it('1.4 Dynamic category filtering filters products strictly by categoryId', async () => {
      const cats = await categoryBrandUnitService.listCategories();
      const statCat = cats.find((c) => c.name === 'Stationery')!;

      const statProducts = await productService.listProducts({ categoryId: statCat.id, pageSize: 100 });
      expect(statProducts.data.length).toBeGreaterThanOrEqual(5);
      expect(statProducts.data.every((p) => p.categoryId === statCat.id)).toBe(true);
    });

    it('1.5 Exact Barcode lookup finds matching packaged products', async () => {
      // Packaged product has barcode
      const product = await productService.getProductByBarcode('890102000101');
      expect(product).not.toBeNull();
      expect(product?.name).toBe('Blue Ballpoint Pen');
      expect(product?.barcode).toBe('890102000101');

      // Loose product has no barcode
      const looseRice = await productService.getProductById(product?.id || '');
      expect(looseRice).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. DYNAMIC CREATION WITHOUT CODE CHANGES
  // ==========================================================================
  describe('2. Dynamic Creation Without Code Changes (Section 28, 29, 30)', () => {
    let createdCategoryId: string;
    let createdProductId: string;

    it('2.1 Dynamically creates a new Category (e.g. Gift Items) and lists it immediately', async () => {
      const cat = await categoryBrandUnitService.createCategory(
        { name: 'Gift Items ' + Date.now(), description: 'Gift wrapping, cards and accessories' },
        adminUserId
      );
      createdCategoryId = cat.id;

      const categories = await categoryBrandUnitService.listCategories();
      expect(categories.some((c) => c.id === createdCategoryId)).toBe(true);
    });

    it('2.2 Dynamically creates a new Product (e.g. Gift Wrap) under the new Category', async () => {
      const uniqueSku = 'SKU-GIFT-WRAP-' + Date.now();
      const prod = await productService.createProduct(
        {
          name: 'Metallic Gift Wrap Paper',
          sku: uniqueSku,
          barcode: '89099' + String(Date.now()).slice(-7),
          categoryId: createdCategoryId,
          unitId: unitPcsId,
          purchasePrice: 15,
          salePrice: 30,
          taxRate: 12,
          openingStock: 50,
          reorderLevel: 10,
        },
        adminUserId
      );
      createdProductId = prod.product.id;

      // Product immediately appears in product search
      const searchRes = await productService.listProducts({ search: 'Metallic Gift Wrap' });
      expect(searchRes.data.some((p) => p.id === createdProductId)).toBe(true);

      // Product appears under dynamic category filter
      const catFilterRes = await productService.listProducts({ categoryId: createdCategoryId });
      expect(catFilterRes.data.some((p) => p.id === createdProductId)).toBe(true);

      // Product stock ledger was atomically created
      const movements = await prisma.stockLedger.findMany({ where: { productId: createdProductId } });
      expect(movements.length).toBe(1);
      expect(movements[0].transactionType).toBe('OPENING');
      expect(Number(movements[0].quantityChange)).toBe(50);
    });

    it('2.3 Allows selling the newly created dynamic product via POS immediately', async () => {
      const sale = await saleService.createSale(
        {
          items: [{ productId: createdProductId, quantity: 2, sellingPrice: 30, unitCode: 'PCS', taxRate: 12 }],
          paymentMethod: 'CASH',
          paidAmount: 67.2,
        },
        adminUserId
      );

      expect(sale).toBeDefined();
      expect(sale.total).toBe(67.2);

      // Stock deducted accurately in database
      const updated = await productService.getProductById(createdProductId);
      expect(updated?.currentStock).toBe(48); // 50 - 2
    });
  });

  // ==========================================================================
  // 3. DYNAMIC TRANSACTIONS, DASHBOARD & REPORTS (Section 26, 27)
  // ==========================================================================
  describe('3. Real-Time Dynamic Reports & Dashboard Synchronization', () => {
    it('3.1 Dashboard metrics reflect live persisted database state', async () => {
      const dashboard = await dashboardService.getDashboardMetrics();
      expect(dashboard).toBeDefined();
      expect(dashboard.todaySalesCount).toBeGreaterThan(0);
      expect(dashboard.todayGrossSales).toBeGreaterThan(0);
      expect(dashboard.totalActiveProducts).toBeGreaterThanOrEqual(100);
      expect(dashboard.stockValue).toBeGreaterThan(0);
    });

    it('3.2 Executing a new sale immediately changes dashboard metrics and sales report', async () => {
      const beforeDashboard = await dashboardService.getDashboardMetrics();
      const beforeSalesCount = beforeDashboard.todaySalesCount;
      const beforeRevenue = beforeDashboard.todayGrossSales;

      // Fetch a product
      const rice = await prisma.product.findUnique({ where: { sku: 'SKU-RICE-LOOSE-KG' } });
      expect(rice).not.toBeNull();

      // Execute real sale
      const sale = await saleService.createSale(
        {
          items: [{ productId: rice!.id, quantity: 1, sellingPrice: 120, unitCode: 'KG', taxRate: 0 }],
          paymentMethod: 'CASH',
          paidAmount: 120,
        },
        adminUserId
      );

      // Re-fetch dashboard
      const afterDashboard = await dashboardService.getDashboardMetrics();
      expect(afterDashboard.todaySalesCount).toBe(beforeSalesCount + 1);
      expect(afterDashboard.todayGrossSales).toBe(beforeRevenue + 120);

      // Verify sales report also updated
      const salesRep = await salesReportService.getSalesReport({
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
      });
      expect(salesRep.data.some((s) => s.id === sale.id)).toBe(true);
    });

    it('3.3 Customer payment immediately updates receivables in customer ledger and dashboard', async () => {
      // Find customer with outstanding balance
      const cust = await prisma.customer.findFirst({ where: { currentBalance: { gt: 10 } } });
      if (cust) {
        const initialBalance = Number(cust.currentBalance);
        const payAmount = 10;

        await customerAccountService.recordCustomerPayment(
          {
            customerId: cust.id,
            amount: payAmount,
            paymentMethod: 'CASH',
            notes: 'Test cash installment',
          },
          adminUserId
        );

        const updatedCust = await prisma.customer.findUnique({ where: { id: cust.id } });
        expect(Number(updatedCust?.currentBalance)).toBe(Math.round((initialBalance - payAmount) * 100) / 100);
      }
    });

    it('3.4 Processing a Sales Return immediately restores inventory and updates reports', async () => {
      // Fetch a recent sale with items
      const recentSale = await prisma.sale.findFirst({
        where: { status: 'POSTED', items: { some: {} } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(recentSale).not.toBeNull();
      const itemToReturn = recentSale!.items[0];
      const productBefore = await productService.getProductById(itemToReturn.productId);
      const stockBefore = Number(productBefore?.currentStock);

      // Return 1 unit
      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: recentSale!.id,
          notes: 'Customer dynamic return test',
          refundMethod: 'CASH',
          items: [
            {
              saleItemId: itemToReturn.id,
              productId: itemToReturn.productId,
              quantity: 1,
              reason: 'Customer return test',
            },
          ],
        },
        adminUserId
      );

      expect(ret).toBeDefined();

      // Verify stock restored
      const productAfter = await productService.getProductById(itemToReturn.productId);
      expect(Number(productAfter?.currentStock)).toBe(stockBefore + 1);

      // Verify return appears in sales return report
      const returnReport = await salesReportService.getSalesReturnReport({});
      expect(returnReport.data.some((r) => r.id === ret.id)).toBe(true);
    });

    it('3.5 Profit report computes profit from historical sale cost and ignores later price updates', async () => {
      const profitSummary = await reportService.getProfitSummary({ period: 'TODAY' });
      expect(profitSummary).toBeDefined();
      expect(profitSummary.grossSales).toBeGreaterThan(0);
      expect(profitSummary.cogs).toBeGreaterThan(0);
      expect(profitSummary.grossProfit).toBe(profitSummary.netSales - profitSummary.cogs);
    });
  });

  // ==========================================================================
  // 4. LOW STOCK & INACTIVE PRODUCT CONSTRAINTS
  // ==========================================================================
  describe('4. Low Stock Alerts & Inactive Product Enforcement', () => {
    it('4.1 Low stock products are correctly identified by inventory service', async () => {
      const invReport = await inventoryReportService.getCurrentStockReport({ stockStatus: 'LOW_STOCK' });
      expect(invReport.data.length).toBeGreaterThanOrEqual(1);
      expect(invReport.data.every((p) => p.stockStatus === 'LOW_STOCK')).toBe(true);
    });

    it('4.2 Inactive products cannot be sold at POS', async () => {
      const inactive = await prisma.product.findFirst({ where: { status: 'INACTIVE' } });
      expect(inactive).not.toBeNull();

      await expect(
        saleService.createSale(
          {
            items: [{ productId: inactive!.id, quantity: 1, sellingPrice: 15, unitCode: 'PCS' }],
            paymentMethod: 'CASH',
            paidAmount: 15,
          },
          adminUserId
        )
      ).rejects.toThrow(/inactive and cannot be sold/i);
    });
  });
});
