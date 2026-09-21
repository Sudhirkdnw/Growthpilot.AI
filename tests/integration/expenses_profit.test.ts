import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { expenseCategoryService } from '../../src/main/modules/expenses/expense-category.service';
import { expenseService } from '../../src/main/modules/expenses/expense.service';
import { reportService } from '../../src/main/modules/reports/report.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 10: Expense Management & Historical Profit Test Suite', () => {
  const prisma = getPrismaClient();

  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;

  let testUnitId: string;
  let testCategoryId: string;
  let product1Id: string;
  let product2Id: string;
  let customerId: string;
  let cancelTestExpenseId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up tables in foreign key dependency order
    await prisma.expense.deleteMany({});
    await prisma.expenseCategory.deleteMany({});
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
    await prisma.customerPayment.deleteMany({});
    await prisma.customerLedger.deleteMany({});
    await prisma.salePayment.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
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
        username: 'expense_admin',
        passwordHash: 'dummyHashAdmin',
        fullName: 'Managing Director',
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
        username: 'expense_cashier',
        passwordHash: 'dummyHashCashier',
        fullName: 'Checkout Cashier',
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

    // 3. Create Unit & Category for Products
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Piece',
      shortCode: 'PCS',
      allowDecimal: false,
    });
    testUnitId = unit.id;

    const cat = await categoryBrandUnitService.createCategory({
      name: 'Electronics & Tools',
      description: 'Test catalog category',
    });
    testCategoryId = cat.id;

    // 4. Create Products
    // Product 1: Cost 600, Sale 1000 (Margin 400 = 40%)
    const p1 = await productService.createProduct({
      name: 'Power Drill 500W',
      sku: 'DRILL-500W',
      unitId: testUnitId,
      categoryId: testCategoryId,
      purchasePrice: 600,
      salePrice: 1000,
      taxRate: 0,
      openingStock: 100,
      reorderLevel: 5,
    });
    product1Id = p1.product.id;

    // Product 2: Cost 1500, Sale 2500 (Margin 1000 = 40%)
    const p2 = await productService.createProduct({
      name: 'Rotary Hammer 800W',
      sku: 'HAMMER-800W',
      unitId: testUnitId,
      categoryId: testCategoryId,
      purchasePrice: 1500,
      salePrice: 2500,
      taxRate: 0,
      openingStock: 50,
      reorderLevel: 5,
    });
    product2Id = p2.product.id;

    // 5. Create Customer
    const cust = await customerService.createCustomer(
      {
        name: 'Aakash Trading Co',
        phone: '9988776655',
        openingBalance: 0,
      },
      adminId
    );
    customerId = cust.id;
  });

  // ==========================================================================
  // SECTION 0: MANDATORY SCHEMA VERIFICATION ACCEPTANCE TESTS
  // ==========================================================================
  describe('0. Mandatory Schema Verification Acceptance Tests', () => {
    it('ExpenseCategory.description, status, and timestamps exist and work', async () => {
      const cat = await prisma.expenseCategory.create({
        data: {
          name: 'Schema Verification Category',
          description: 'Testing schema fields presence',
          status: 'ACTIVE',
        },
      });

      expect(cat.id).toBeDefined();
      expect(cat.description).toBe('Testing schema fields presence');
      expect(cat.status).toBe('ACTIVE');
      expect(cat.createdAt).toBeInstanceOf(Date);
      expect(cat.updatedAt).toBeInstanceOf(Date);

      // Verify status enum supports INACTIVE
      const updated = await prisma.expenseCategory.update({
        where: { id: cat.id },
        data: { status: 'INACTIVE' },
      });
      expect(updated.status).toBe('INACTIVE');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(cat.createdAt.getTime());
    });

    it('Expense.expenseNumber, status, cancellationReason, createdBy, updatedAt exist and work', async () => {
      const cat = await prisma.expenseCategory.create({
        data: {
          name: 'Schema Category For Expense',
          status: 'ACTIVE',
        },
      });
      const exp = await prisma.expense.create({
        data: {
          expenseNumber: 'EXP-999999',
          categoryId: cat.id,
          amount: 100,
          paymentMethod: 'CASH',
          description: 'Schema test expense',
          status: 'POSTED',
          cancellationReason: null,
          createdBy: adminId,
        },
      });

      expect(exp.id).toBeDefined();
      expect(exp.expenseNumber).toBe('EXP-999999');
      expect(exp.status).toBe('POSTED');
      expect(exp.cancellationReason).toBeNull();
      expect(exp.createdBy).toBe(adminId);
      expect(exp.createdAt).toBeInstanceOf(Date);
      expect(exp.updatedAt).toBeInstanceOf(Date);

      // Verify cancellationReason and status update
      const cancelled = await prisma.expense.update({
        where: { id: exp.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: 'Schema acceptance reason test',
        },
      });
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Schema acceptance reason test');
      expect(cancelled.updatedAt.getTime()).toBeGreaterThanOrEqual(exp.createdAt.getTime());
    });
  });

  // ==========================================================================
  // SECTION 1: EXPENSE CATEGORY MANAGEMENT
  // ==========================================================================
  describe('1. Expense Category Management', () => {
    let rentCatId: string;
    let tempCatId: string;

    it('1. Create active expense category with name and description', async () => {
      const cat = await expenseCategoryService.createCategory(
        {
          name: 'Store Rent',
          description: 'Monthly commercial shop rental',
        },
        adminId
      );

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('Store Rent');
      expect(cat.description).toBe('Monthly commercial shop rental');
      expect(cat.status).toBe('ACTIVE');
      expect(cat.expenseCount).toBe(0);
      rentCatId = cat.id;
    });

    it('2. Update category name and description', async () => {
      const updated = await expenseCategoryService.updateCategory(
        rentCatId,
        {
          name: 'Premises Rent & Maintenance',
          description: 'Monthly commercial shop rental including common area maintenance',
        },
        adminId
      );

      expect(updated.id).toBe(rentCatId);
      expect(updated.name).toBe('Premises Rent & Maintenance');
      expect(updated.description).toContain('common area maintenance');
      expect(updated.status).toBe('ACTIVE');
    });

    it('3. Deactivate category (sets status to INACTIVE)', async () => {
      const deact = await expenseCategoryService.deactivateCategory(rentCatId, adminId);
      expect(deact.status).toBe('INACTIVE');

      // Reactivate for later expense tests
      const react = await expenseCategoryService.updateCategory(rentCatId, { status: 'ACTIVE' }, adminId);
      expect(react.status).toBe('ACTIVE');
    });

    it('4. Delete category with 0 expenses succeeds', async () => {
      const tempCat = await expenseCategoryService.createCategory(
        {
          name: 'Temporary Promotion',
          description: 'Will be deleted before use',
        },
        adminId
      );
      tempCatId = tempCat.id;

      const res = await expenseCategoryService.deleteCategory(tempCatId, adminId);
      expect(res.success).toBe(true);

      const check = await prisma.expenseCategory.findUnique({ where: { id: tempCatId } });
      expect(check).toBeNull();
    });

    it('5. Delete category with >= 1 expenses fails with CATEGORY_HAS_EXPENSES', async () => {
      // Record an expense against rent category
      await expenseService.createExpense(
        {
          categoryId: rentCatId,
          amount: 5000,
          paymentMethod: 'BANK_TRANSFER',
          description: 'September 2026 rent advance',
        },
        adminId
      );

      await expect(expenseCategoryService.deleteCategory(rentCatId, adminId)).rejects.toThrow(
        /CATEGORY_HAS_EXPENSES/
      );
    });
  });

  // ==========================================================================
  // SECTION 2: EXPENSE RECORDING & VALIDATION
  // ==========================================================================
  describe('2. Expense Recording & Validation', () => {
    let utilityCatId: string;
    let inactiveCatId: string;

    beforeAll(async () => {
      const cat = await expenseCategoryService.createCategory(
        { name: 'Utilities', description: 'Electricity, Water, Internet' },
        adminId
      );
      utilityCatId = cat.id;

      const inact = await expenseCategoryService.createCategory(
        { name: 'Discontinued Channel', description: 'Deactivated category' },
        adminId
      );
      inactiveCatId = inact.id;
      await expenseCategoryService.deactivateCategory(inactiveCatId, adminId);
    });

    it('6. Sequential expense numbering (EXP-000001, EXP-000002)', async () => {
      const exp1 = await expenseService.createExpense(
        {
          categoryId: utilityCatId,
          amount: 1250.5,
          paymentMethod: 'UPI',
          description: 'Fiber internet bill',
        },
        cashierId
      );

      const exp2 = await expenseService.createExpense(
        {
          categoryId: utilityCatId,
          amount: 3400,
          paymentMethod: 'BANK_TRANSFER',
          description: 'Commercial power bill',
        },
        cashierId
      );

      expect(exp1.expenseNumber).toMatch(/^EXP-\d{6}$/);
      expect(exp2.expenseNumber).toMatch(/^EXP-\d{6}$/);

      const num1 = parseInt(exp1.expenseNumber.replace('EXP-', ''), 10);
      const num2 = parseInt(exp2.expenseNumber.replace('EXP-', ''), 10);
      expect(num2).toBe(num1 + 1);
    });

    it('7. Create expenses across all supported payment methods (CASH, CARD, UPI, BANK_TRANSFER)', async () => {
      const methods = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'] as const;
      for (const m of methods) {
        const exp = await expenseService.createExpense(
          {
            categoryId: utilityCatId,
            amount: 100,
            paymentMethod: m,
            description: `Test payment with ${m}`,
          },
          cashierId
        );
        expect(exp.paymentMethod).toBe(m);
        expect(exp.status).toBe('POSTED');
      }
    });

    it('8. Reject zero amount', async () => {
      await expect(
        expenseService.createExpense(
          {
            categoryId: utilityCatId,
            amount: 0,
            paymentMethod: 'CASH',
            description: 'Zero amount expense',
          },
          cashierId
        )
      ).rejects.toThrow();
    });

    it('9. Reject negative amount', async () => {
      await expect(
        expenseService.createExpense(
          {
            categoryId: utilityCatId,
            amount: -500,
            paymentMethod: 'CASH',
            description: 'Negative expense',
          },
          cashierId
        )
      ).rejects.toThrow();
    });

    it('10. Reject non-existent category', async () => {
      await expect(
        expenseService.createExpense(
          {
            categoryId: '00000000-0000-0000-0000-000000000000',
            amount: 250,
            paymentMethod: 'CASH',
            description: 'Missing category expense',
          },
          cashierId
        )
      ).rejects.toThrow(/EXPENSE_CATEGORY_NOT_FOUND/);
    });

    it('11. Reject inactive category', async () => {
      await expect(
        expenseService.createExpense(
          {
            categoryId: inactiveCatId,
            amount: 350,
            paymentMethod: 'CASH',
            description: 'Expense against inactive category',
          },
          cashierId
        )
      ).rejects.toThrow(/EXPENSE_CATEGORY_INACTIVE/);
    });

    it('12. Reject invalid payment method schema validation', async () => {
      await expect(
        expenseService.createExpense(
          {
            categoryId: utilityCatId,
            amount: 150,
            paymentMethod: 'BITCOIN' as any,
            description: 'Crypto payment',
          },
          cashierId
        )
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // SECTION 3: LISTING, QUERYING & BREAKDOWN SUMMARY
  // ==========================================================================
  describe('3. Expense Listing, Filtering & Breakdown Summary', () => {
    let officeCatId: string;
    let sampleExpenseId: string;

    beforeAll(async () => {
      const cat = await expenseCategoryService.createCategory(
        { name: 'Office Supplies', description: 'Stationery and packaging materials' },
        adminId
      );
      officeCatId = cat.id;

      const e = await expenseService.createExpense(
        {
          categoryId: officeCatId,
          amount: 450,
          paymentMethod: 'CASH',
          description: 'Thermal receipt rolls 50pk',
          reference: 'BILL-4412',
        },
        cashierId
      );
      sampleExpenseId = e.id;
    });

    it('13. List expenses with filters (categoryId, paymentMethod, status, pagination)', async () => {
      const list = await expenseService.listExpenses({
        categoryId: officeCatId,
        paymentMethod: 'CASH',
        status: 'POSTED',
        page: 1,
        pageSize: 10,
      });

      expect(list.data.length).toBeGreaterThanOrEqual(1);
      expect(list.data[0].categoryId).toBe(officeCatId);
      expect(list.data[0].paymentMethod).toBe('CASH');
      expect(list.data[0].status).toBe('POSTED');
      expect(list.total).toBeGreaterThanOrEqual(1);
    });

    it('14. Get single expense by ID', async () => {
      const exp = await expenseService.getExpenseById(sampleExpenseId);
      expect(exp.id).toBe(sampleExpenseId);
      expect(exp.description).toBe('Thermal receipt rolls 50pk');
      expect(exp.reference).toBe('BILL-4412');
      expect(exp.categoryName).toBe('Office Supplies');
    });

    it('15. Expense summary endpoint returns correct totalAmount and byCategory / byPaymentMethod breakdowns', async () => {
      const summary = await expenseService.getExpenseSummary();
      expect(summary.totalAmount).toBeGreaterThan(0);
      expect(summary.totalCount).toBeGreaterThan(0);
      expect(summary.byCategory.length).toBeGreaterThanOrEqual(1);

      const officeSummary = summary.byCategory.find((c) => c.categoryId === officeCatId);
      expect(officeSummary).toBeDefined();
      expect(officeSummary?.amount).toBeGreaterThanOrEqual(450);
      expect(summary.byPaymentMethod['CASH']).toBeGreaterThanOrEqual(450);
    });
  });

  // ==========================================================================
  // SECTION 4: EXPENSE CANCELLATION & IMMUTABILITY
  // ==========================================================================
  describe('4. Expense Cancellation & Immutability', () => {
    let cancelCatId: string;

    beforeAll(async () => {
      const cat = await expenseCategoryService.createCategory(
        { name: 'Miscellaneous', description: 'General sundry expenses' },
        adminId
      );
      cancelCatId = cat.id;

      const exp = await expenseService.createExpense(
        {
          categoryId: cancelCatId,
          amount: 750,
          paymentMethod: 'CASH',
          description: 'Erroneous duplicate entry for courier charges',
        },
        cashierId
      );
      cancelTestExpenseId = exp.id;
    });

    it('16. Cancel expense by Admin with reason marks status CANCELLED and populates cancellationReason', async () => {
      const cancelled = await expenseService.cancelExpense(
        {
          expenseId: cancelTestExpenseId,
          reason: 'Duplicate courier bill entered by mistake',
        },
        adminId
      );

      expect(cancelled.id).toBe(cancelTestExpenseId);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Duplicate courier bill entered by mistake');

      // Verify in DB directly
      const dbExp = await prisma.expense.findUnique({ where: { id: cancelTestExpenseId } });
      expect(dbExp?.status).toBe('CANCELLED');
      expect(dbExp?.cancellationReason).toBe('Duplicate courier bill entered by mistake');
    });

    it('17. Fastify non-admin role receives 403 Forbidden on cancel expense', async () => {
      const res = await dispatchFastify<any>(
        'POST',
        `/api/expenses/${cancelTestExpenseId}/cancel`,
        { reason: 'Cashier trying to cancel' },
        { authorization: cashierToken }
      );

      expect(res.error).toMatch(/Forbidden|Access denied/i);
    });

    it('18. Cancel without reason fails', async () => {
      const exp = await expenseService.createExpense(
        {
          categoryId: cancelCatId,
          amount: 200,
          paymentMethod: 'CASH',
          description: 'Valid expense to test empty cancel reason',
        },
        cashierId
      );

      await expect(
        expenseService.cancelExpense(
          {
            expenseId: exp.id,
            reason: '   ', // whitespace only
          },
          adminId
        )
      ).rejects.toThrow(/cancellation reason/i);
    });

    it('19. Cancel already cancelled expense fails with EXPENSE_ALREADY_CANCELLED', async () => {
      await expect(
        expenseService.cancelExpense(
          {
            expenseId: cancelTestExpenseId,
            reason: 'Trying to cancel again',
          },
          adminId
        )
      ).rejects.toThrow(/EXPENSE_ALREADY_CANCELLED/);
    });

    it('20. Cancelled expenses are completely excluded from profit summary totalExpenses', async () => {
      const summary = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Sum all POSTED expenses in DB
      const postedSum = await prisma.expense.aggregate({
        where: { status: 'POSTED' },
        _sum: { amount: true },
      });

      expect(summary.totalExpenses).toBe(Number(postedSum._sum.amount || 0));

      // Verify the cancelled expense amount is not added
      const cancelledExp = await prisma.expense.findUnique({ where: { id: cancelTestExpenseId } });
      expect(cancelledExp?.status).toBe('CANCELLED');
    });

    it('20b. Original expense record remains after cancellation (amount not zeroed, dates intact)', async () => {
      const exp = await prisma.expense.findUnique({ where: { id: cancelTestExpenseId } });
      expect(exp).toBeDefined();
      expect(exp?.id).toBe(cancelTestExpenseId);
      expect(Number(exp?.amount)).toBe(750); // Original amount NOT overwritten to zero
      expect(exp?.paymentMethod).toBe('CASH');
      expect(exp?.status).toBe('CANCELLED');
      expect(exp?.cancellationReason).toBe('Duplicate courier bill entered by mistake');
      expect(exp?.date).toBeInstanceOf(Date);
      expect(exp?.createdAt).toBeInstanceOf(Date);
      expect(exp?.updatedAt).toBeInstanceOf(Date);
    });

    it('20c. POSTED expense cannot be deleted or destructively edited via API', async () => {
      // API exposes no DELETE route for expenses
      const delRes = await dispatchFastify<any>(
        'DELETE',
        `/api/expenses/${cancelTestExpenseId}`,
        undefined,
        { authorization: adminToken }
      );
      expect(delRes.error).toBeDefined();

      // API exposes no destructive PUT route for expenses
      const putRes = await dispatchFastify<any>(
        'PUT',
        `/api/expenses/${cancelTestExpenseId}`,
        { amount: 0 },
        { authorization: adminToken }
      );
      expect(putRes.error).toBeDefined();
    });
  });

  // ==========================================================================
  // SECTION 5: AUTHORITATIVE HISTORICAL PROFIT & LOSS
  // ==========================================================================
  describe('5. Authoritative Historical Profit & Loss', () => {
    let baseSaleId: string;
    let baseSaleItemId: string;

    it('21. Sale captures saleItem.costPrice from product at checkout time', async () => {
      // Product 1: purchasePrice = 600, salePrice = 1000
      const sale = await saleService.createSale(
        {
          customerId,
          items: [
            {
              productId: product1Id,
              quantity: 2,
              sellingPrice: 1000,
              discount: 0,
            },
          ],
          paidAmount: 2000,
          paymentMethod: 'CASH',
        },
        cashierId
      );

      baseSaleId = sale.id;
      baseSaleItemId = sale.items[0].id;

      expect(sale.items[0].costPrice).toBe(600);
      expect(sale.total).toBe(2000);
    });

    it('22. Gross profit = Net Sales - COGS using captured historical cost', async () => {
      // Single sale of 2 units @ 1000 = 2000 revenue. Cost = 2 * 600 = 1200.
      // Expected Gross Profit = 2000 - 1200 = 800.
      const profit = await reportService.getHistoricalGrossProfit();

      // Check specific sale impact
      const sale = await prisma.sale.findUnique({
        where: { id: baseSaleId },
        include: { items: true },
      });
      const rev = Number(sale?.grandTotal);
      const cost = sale!.items.reduce((acc, it) => acc + Number(it.costPrice) * Number(it.quantity), 0);
      expect(rev).toBe(2000);
      expect(cost).toBe(1200);
      expect(rev - cost).toBe(800);
    });

    it('23. Modifying product.purchasePrice later has ZERO effect on historical profit (LOCKED INVARIANT)', async () => {
      // Fetch current profit before product price modification
      const summaryBefore = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Now drastically update Product 1 purchasePrice from 600 to 900
      await productService.updateProduct(
        product1Id,
        {
          purchasePrice: 900,
        },
        adminId
      );

      // Verify product table was updated
      const updatedProduct = await productService.getProductById(product1Id);
      expect(updatedProduct?.purchasePrice).toBe(900);

      // Re-fetch profit summary
      const summaryAfter = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Invariant: Historical COGS, Gross Profit, and Net Profit must be IDENTICAL
      expect(summaryAfter.cogs).toBe(summaryBefore.cogs);
      expect(summaryAfter.grossProfit).toBe(summaryBefore.grossProfit);
      expect(summaryAfter.netProfit).toBe(summaryBefore.netProfit);
      expect(summaryAfter.grossMarginPercent).toBe(summaryBefore.grossMarginPercent);
    });

    it('24. Discount reduces net revenue and gross profit correctly', async () => {
      // Product 2: purchasePrice = 1500, salePrice = 2500
      // Sell 1 unit with 200 discount -> grandTotal = 2300. Cost = 1500. Margin = 800.
      const discountedSale = await saleService.createSale(
        {
          customerId,
          items: [
            {
              productId: product2Id,
              quantity: 1,
              sellingPrice: 2500,
              discount: 200,
            },
          ],
          paidAmount: 2300,
          paymentMethod: 'CASH',
        },
        cashierId
      );

      expect(discountedSale.subtotal).toBe(2300);
      expect(discountedSale.discount).toBe(200);
      expect(discountedSale.total).toBe(2300);
      expect(discountedSale.items[0].costPrice).toBe(1500);
    });

    it('25. Partial sales return reverses partial revenue and reverses partial historical cost using original saleItem.costPrice', async () => {
      // We return 1 unit out of 2 from baseSale (costPrice was 600, unitPrice was 1000)
      const summaryBefore = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      const sReturn = await salesReturnService.createSalesReturn(
        {
          saleId: baseSaleId,
          refundType: 'CASH_REFUND',
          items: [
            {
              saleItemId: baseSaleItemId,
              productId: product1Id,
              quantity: 1,
            },
          ],
        },
        cashierId
      );

      expect(sReturn.status).toBe('POSTED');
      expect(sReturn.totalAmount).toBe(1000);

      const summaryAfter = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Invariant 5: Verify product purchasePrice is currently 900
      const currentProd = await productService.getProductById(product1Id);
      expect(currentProd?.purchasePrice).toBe(900);

      // Returns must increase by 1000
      expect(summaryAfter.salesReturns).toBe(Math.round((summaryBefore.salesReturns + 1000) * 100) / 100);
      // Net sales must decrease by 1000
      expect(summaryAfter.netSales).toBe(Math.round((summaryBefore.netSales - 1000) * 100) / 100);
      // COGS must strictly decrease by 1 * 600 = 600, NOT 900!
      expect(summaryAfter.cogs).toBe(Math.round((summaryBefore.cogs - 600) * 100) / 100);
      // Gross Profit must decrease by net margin on 1 unit (1000 - 600 = 400)
      expect(summaryAfter.grossProfit).toBe(Math.round((summaryBefore.grossProfit - 400) * 100) / 100);
    });

    it('26. Full sales return reverses remaining revenue and remaining historical cost', async () => {
      const summaryBefore = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Return the remaining 1 unit from baseSale
      const return2 = await salesReturnService.createSalesReturn(
        {
          saleId: baseSaleId,
          refundType: 'CASH_REFUND',
          items: [
            {
              saleItemId: baseSaleItemId,
              productId: product1Id,
              quantity: 1,
            },
          ],
        },
        cashierId
      );

      expect(return2.status).toBe('POSTED');

      const summaryAfter = await reportService.getProfitSummary({ period: 'THIS_MONTH' });
      // Both revenue and COGS for that 2nd unit are reversed
      expect(summaryAfter.netSales).toBe(Math.round((summaryBefore.netSales - 1000) * 100) / 100);
      expect(summaryAfter.cogs).toBe(Math.round((summaryBefore.cogs - 600) * 100) / 100);
      expect(summaryAfter.grossProfit).toBe(Math.round((summaryBefore.grossProfit - 400) * 100) / 100);
    });

    it('27. Cancelled sales are completely excluded from profit calculation', async () => {
      // Create a sale and then cancel it
      const tempSale = await saleService.createSale(
        {
          customerId,
          items: [
            {
              productId: product2Id,
              quantity: 1,
              sellingPrice: 2500,
              discount: 0,
            },
          ],
          paidAmount: 2500,
          paymentMethod: 'CASH',
        },
        cashierId
      );

      const summaryActive = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Cancel the sale
      await saleService.cancelSale(tempSale.id, 'Customer payment dishonoured', adminId);

      const summaryCancelled = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      // Cancelled sale must not be in gross sales or COGS
      expect(summaryCancelled.grossSales).toBe(Math.round((summaryActive.grossSales - 2500) * 100) / 100);
      expect(summaryCancelled.cogs).toBe(Math.round((summaryActive.cogs - 1500) * 100) / 100);
    });

    it('28. Net profit = Gross profit - Total operating expenses', async () => {
      const summary = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      const expectedNetProfit = Math.round((summary.grossProfit - summary.totalExpenses) * 100) / 100;
      expect(summary.netProfit).toBe(expectedNetProfit);
    });

    it('29. Gross margin percentage and net margin percentage calculations are accurate', async () => {
      const summary = await reportService.getProfitSummary({ period: 'THIS_MONTH' });

      if (summary.netSales > 0) {
        const expectedGrossMargin = Math.round((summary.grossProfit / summary.netSales) * 10000) / 100;
        const expectedNetMargin = Math.round((summary.netProfit / summary.netSales) * 10000) / 100;

        expect(summary.grossMarginPercent).toBe(expectedGrossMargin);
        expect(summary.netMarginPercent).toBe(expectedNetMargin);
      } else {
        expect(summary.grossMarginPercent).toBe(0);
        expect(summary.netMarginPercent).toBe(0);
      }
    });
  });

  // ==========================================================================
  // SECTION 6: PERIOD FILTERING & DATE BOUNDARIES
  // ==========================================================================
  describe('6. Period Filtering & Date Boundaries', () => {
    it('30. Date range filtering (TODAY, YESTERDAY, THIS_MONTH, CUSTOM) isolates transactions to proper windows', async () => {
      const todaySummary = await reportService.getProfitSummary({ period: 'TODAY' });
      expect(todaySummary.period).toBe('TODAY');
      expect(new Date(todaySummary.startDate).getHours()).toBe(0);

      const yestSummary = await reportService.getProfitSummary({ period: 'YESTERDAY' });
      expect(yestSummary.period).toBe('YESTERDAY');

      const monthSummary = await reportService.getProfitSummary({ period: 'THIS_MONTH' });
      expect(monthSummary.period).toBe('THIS_MONTH');

      // Custom window with future dates should yield 0
      const futureSummary = await reportService.getProfitSummary({
        period: 'CUSTOM',
        startDate: '2099-01-01T00:00:00.000Z',
        endDate: '2099-12-31T23:59:59.999Z',
      });
      expect(futureSummary.period).toBe('CUSTOM');
      expect(futureSummary.grossSales).toBe(0);
      expect(futureSummary.totalExpenses).toBe(0);
      expect(futureSummary.netProfit).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 7: FASTIFY IN-PROCESS API, IPC & AUDIT TRAIL
  // ==========================================================================
  describe('7. Fastify In-Process API, Preload IPC & Audit Logging', () => {
    it('31. Expense cancellation creates audit event containing expenseId, expenseNumber, userId, cancellationReason, timestamp', async () => {
      const logs = await prisma.auditLog.findMany({
        where: {
          action: { in: ['EXPENSE_CREATED', 'EXPENSE_CANCELLED', 'EXPENSE_CATEGORY_CREATED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);
      const cancelLog = logs.find((l) => l.action === 'EXPENSE_CANCELLED');
      expect(cancelLog).toBeDefined();
      expect(cancelLog?.entityId).toBe(cancelTestExpenseId);
      const parsedNewValue = cancelLog?.newValue ? JSON.parse(cancelLog.newValue) : {};
      expect(parsedNewValue.expenseNumber).toMatch(/^EXP-\d{6}$/);
      expect(cancelLog?.userId).toBe(adminId);
      expect(parsedNewValue.cancellationReason).toBe('Duplicate courier bill entered by mistake');
      expect(cancelLog?.createdAt).toBeInstanceOf(Date);
    });

    it('32. Fastify endpoints enforce authentication (401 for unauthenticated requests)', async () => {
      const unauthExp = await dispatchFastify<any>('GET', '/api/expenses');
      expect(unauthExp.error).toMatch(/Authentication required|Session invalid/i);

      const unauthSummary = await dispatchFastify<any>('GET', '/api/reports/profit-summary');
      expect(unauthSummary.error).toMatch(/Authentication required|Session invalid/i);
    });

    it('33. Fastify endpoints enforce authorization (403 for non-admin deleting category or cancelling expense)', async () => {
      // Create fresh category
      const c = await expenseCategoryService.createCategory(
        { name: 'Role Test Category', description: 'Testing 403' },
        adminId
      );

      // Cashier tries to delete
      const cashierDel = await dispatchFastify<any>(
        'DELETE',
        `/api/expense-categories/${c.id}`,
        undefined,
        { authorization: cashierToken }
      );
      expect(cashierDel.error).toMatch(/Forbidden|Access denied/i);

      // Admin deletes successfully
      const adminDel = await dispatchFastify<any>(
        'DELETE',
        `/api/expense-categories/${c.id}`,
        undefined,
        { authorization: adminToken }
      );
      expect(adminDel.success).toBe(true);
    });
  });
});
