import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { customerAccountService } from '../../src/main/modules/customers/customer-account.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 9: Customer Ledger & Accounts Receivable (AR) Test Suite', () => {
  const prisma = getPrismaClient();

  let adminId: string;
  let adminToken: string;
  let cashierId: string;
  let cashierToken: string;

  let testUnitId: string;
  let testCategoryId: string;
  let testProduct1Id: string;
  let testProduct2Id: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up tables in foreign key dependency order
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

    // 1. Create Admin
    const adminUser = await prisma.user.create({
      data: {
        username: 'ar_admin',
        passwordHash: 'dummyAdminHash',
        fullName: 'AR Admin',
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

    // 2. Create Cashier
    const cashierUser = await prisma.user.create({
      data: {
        username: 'ar_cashier',
        passwordHash: 'dummyCashierHash',
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

    // 3. Create Unit & Category
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Piece',
      shortCode: 'PCS',
      allowDecimal: false,
    });
    testUnitId = unit.id;

    const cat = await categoryBrandUnitService.createCategory({
      name: 'General Hardware',
      description: 'Test category for retail sales',
    });
    testCategoryId = cat.id;

    // 4. Create Products
    const prod1 = await productService.createProduct({
      name: 'DeWalt Drill Bit Set',
      sku: 'BIT-SET-001',
      unitId: testUnitId,
      categoryId: testCategoryId,
      purchasePrice: 500,
      salePrice: 1000,
      taxRate: 0,
      openingStock: 100,
      reorderLevel: 5,
    });
    testProduct1Id = prod1.product.id;

    const prod2 = await productService.createProduct({
      name: 'Bosch Cordless Screwdriver',
      sku: 'BOSCH-SCREW-002',
      unitId: testUnitId,
      categoryId: testCategoryId,
      purchasePrice: 1500,
      salePrice: 2500,
      taxRate: 0,
      openingStock: 50,
      reorderLevel: 5,
    });
    testProduct2Id = prod2.product.id;
  });

  // ==========================================================================
  // SECTION 1: CUSTOMER MASTER & OPENING BALANCE
  // ==========================================================================
  describe('Customer Master & Opening Balance', () => {
    let createdCustId: string;

    it('1. Create customer without opening balance', async () => {
      const cust = await customerService.createCustomer(
        {
          name: 'Aarav Sharma',
          phone: '9810011111',
          email: 'aarav@example.com',
          address: '42 Main St, Delhi',
          openingBalance: 0,
        },
        adminId
      );

      expect(cust.id).toBeDefined();
      expect(cust.name).toBe('Aarav Sharma');
      expect(cust.openingBalance).toBe(0);
      expect(cust.currentBalance).toBe(0);
      expect(cust.status).toBe('ACTIVE');

      // Zero opening balance must not create unnecessary ledger row
      const ledger = await prisma.customerLedger.findMany({
        where: { customerId: cust.id },
      });
      expect(ledger.length).toBe(0);
    });

    it('2. Create customer with opening balance creates authoritative OPENING_BALANCE ledger entry', async () => {
      const cust = await customerService.createCustomer(
        {
          name: 'Vikram Mehta',
          phone: '9820022222',
          email: 'vikram@example.com',
          address: 'Sector 15, Gurgaon',
          openingBalance: 5000,
        },
        adminId
      );

      createdCustId = cust.id;
      expect(cust.openingBalance).toBe(5000);
      expect(cust.currentBalance).toBe(5000);

      // Verify authoritative ledger entry
      const ledger = await prisma.customerLedger.findMany({
        where: { customerId: cust.id },
      });
      expect(ledger.length).toBe(1);
      expect(ledger[0].type).toBe('OPENING_BALANCE');
      expect(Number(ledger[0].debit)).toBe(5000);
      expect(Number(ledger[0].credit)).toBe(0);
      expect(Number(ledger[0].balance)).toBe(5000);
    });

    it('3. Update customer details (name, phone, address)', async () => {
      const updated = await customerService.updateCustomer(
        createdCustId,
        {
          name: 'Vikram R. Mehta',
          phone: '9820022299',
          address: 'Sector 15, Block B, Gurgaon',
        },
        adminId
      );

      expect(updated.name).toBe('Vikram R. Mehta');
      expect(updated.phone).toBe('9820022299');
      expect(updated.address).toBe('Sector 15, Block B, Gurgaon');
      // Financial balance must remain unchanged
      expect(updated.currentBalance).toBe(5000);
    });

    it('4. Search customers by name and phone', async () => {
      const resName = await customerService.listCustomers({ search: 'Vikram' });
      expect(resName.data.length).toBeGreaterThanOrEqual(1);
      expect(resName.data.some((c) => c.name.includes('Vikram'))).toBe(true);

      const resPhone = await customerService.listCustomers({ search: '9820022299' });
      expect(resPhone.data.length).toBe(1);
      expect(resPhone.data[0].id).toBe(createdCustId);
    });

    it('5. Cannot delete customer with existing ledger entry (e.g. opening balance)', async () => {
      await expect(
        customerService.deleteCustomer(createdCustId, adminId)
      ).rejects.toThrow(/CUSTOMER_HAS_FINANCIAL_HISTORY/);
    });

    it('5a. Cannot delete customer with existing sale record', async () => {
      const saleCust = await customerService.createCustomer({
        name: 'Cust With Sale',
        phone: '9911223344',
        openingBalance: 0,
      });
      await saleService.createSale({
        customerId: saleCust.id,
        items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 1000 }],
        paidAmount: 1000,
        paymentMethod: 'CASH',
      });

      await expect(
        customerService.deleteCustomer(saleCust.id, adminId)
      ).rejects.toThrow(/CUSTOMER_HAS_FINANCIAL_HISTORY/);
    });

    it('5b. Cannot delete customer with existing customer payment', async () => {
      const payCust = await customerService.createCustomer({
        name: 'Cust With Payment',
        phone: '9922334455',
        openingBalance: 1000,
      });
      await customerAccountService.recordCustomerPayment({
        customerId: payCust.id,
        amount: 500,
        paymentMethod: 'CASH',
      });

      await expect(
        customerService.deleteCustomer(payCust.id, adminId)
      ).rejects.toThrow(/CUSTOMER_HAS_FINANCIAL_HISTORY/);
    });

    it('5c. Cannot delete customer with existing sales return', async () => {
      const returnCust = await customerService.createCustomer({
        name: 'Cust With Return',
        phone: '9933445566',
        openingBalance: 0,
      });
      const sale = await saleService.createSale({
        customerId: returnCust.id,
        items: [{ productId: testProduct1Id, quantity: 2, sellingPrice: 1000 }],
        paidAmount: 2000,
        paymentMethod: 'CASH',
      });
      await salesReturnService.createSalesReturn({
        saleId: sale.id,
        items: [{ productId: testProduct1Id, quantity: 1 }],
        refundType: 'CASH_REFUND',
      });

      await expect(
        customerService.deleteCustomer(returnCust.id, adminId)
      ).rejects.toThrow(/CUSTOMER_HAS_FINANCIAL_HISTORY/);
    });

    it('6. Safely delete customer without financial history', async () => {
      const tempCust = await customerService.createCustomer({
        name: 'Temp Customer Without History',
        phone: '9999900000',
        openingBalance: 0,
      });

      const delResult = await customerService.deleteCustomer(tempCust.id, adminId);
      expect(delResult.success).toBe(true);

      await expect(customerService.getCustomerById(tempCust.id)).rejects.toThrow(/not found/);
    });

    it('7. Deactivate customer preserves all records with status INACTIVE', async () => {
      const deactivated = await customerService.deactivateCustomer(createdCustId, adminId);
      expect(deactivated.status).toBe('INACTIVE');

      // Verify records are intact in DB
      const dbCust = await prisma.customer.findUnique({ where: { id: createdCustId } });
      expect(dbCust?.status).toBe('INACTIVE');
      expect(Number(dbCust?.currentBalance)).toBe(5000);

      // Reactivate for subsequent tests
      await customerService.updateCustomer(createdCustId, { status: 'ACTIVE' }, adminId);
    });
  });

  // ==========================================================================
  // SECTION 2: CREDIT SALES & AR MOVEMENTS
  // ==========================================================================
  describe('Credit Sales & Receivable Debits', () => {
    let creditCustId: string;

    beforeAll(async () => {
      const cust = await customerService.createCustomer({
        name: 'Pooja Patel',
        phone: '9830033333',
        openingBalance: 0,
      });
      creditCustId = cust.id;
    });

    it('8. Cash sale with Cash Customer creates zero customer receivable', async () => {
      const sale = await saleService.createSale({
        customerId: null, // Cash Customer
        items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 1000 }],
        paidAmount: 1000,
        paymentMethod: 'CASH',
      });

      expect(sale.customerName).toBe('Cash Customer');
      expect(sale.dueAmount).toBe(0);

      // Default Cash Customer balance must strictly be 0
      const cashCustomer = customerService.getDefaultCashCustomer();
      expect(cashCustomer.currentBalance).toBe(0);

      const cashLedger = await prisma.customerLedger.findMany({
        where: { customerId: 'cash-customer' },
      });
      expect(cashLedger.length).toBe(0);
    });

    it('9. Partial payment credit sale increases customer receivable by dueAmount', async () => {
      // Bill: 2 x 1000 = 2000. Paid = 500. Due = 1500.
      const sale = await saleService.createSale(
        {
          customerId: creditCustId,
          items: [{ productId: testProduct1Id, quantity: 2, sellingPrice: 1000 }],
          paidAmount: 500,
          paymentMethod: 'CASH',
        },
        cashierId
      );

      expect(sale.dueAmount).toBe(1500);

      // Verify customer current balance is exactly 1500
      const customer = await customerService.getCustomerById(creditCustId);
      expect(customer.currentBalance).toBe(1500);

      // Verify ledger entry: type INVOICE, debit 1500, credit 0, balance 1500
      const ledger = await prisma.customerLedger.findMany({
        where: { customerId: creditCustId, type: 'INVOICE' },
      });
      expect(ledger.length).toBe(1);
      expect(Number(ledger[0].debit)).toBe(1500);
      expect(Number(ledger[0].credit)).toBe(0);
      expect(Number(ledger[0].balance)).toBe(1500);
    });

    it('10. Second credit sale accumulates onto customer receivable', async () => {
      // Bill: 1 x 2500 = 2500. Paid = 0. Due = 2500.
      const sale = await saleService.createSale(
        {
          customerId: creditCustId,
          items: [{ productId: testProduct2Id, quantity: 1, sellingPrice: 2500 }],
          paidAmount: 0,
          paymentMethod: 'CREDIT',
        },
        cashierId
      );

      expect(sale.dueAmount).toBe(2500);

      // New Balance: 1500 + 2500 = 4000
      const customer = await customerService.getCustomerById(creditCustId);
      expect(customer.currentBalance).toBe(4000);

      const ledger = await prisma.customerLedger.findMany({
        where: { customerId: creditCustId },
        orderBy: { createdAt: 'asc' },
      });
      expect(ledger.length).toBe(2);
      expect(Number(ledger[1].balance)).toBe(4000);
    });

    it('11. Full payment sale does NOT increase customer receivable', async () => {
      // Bill: 1000. Paid = 1000. Due = 0.
      await saleService.createSale(
        {
          customerId: creditCustId,
          items: [{ productId: testProduct1Id, quantity: 1, sellingPrice: 1000 }],
          paidAmount: 1000,
          paymentMethod: 'UPI',
        },
        cashierId
      );

      // Balance remains 4000
      const customer = await customerService.getCustomerById(creditCustId);
      expect(customer.currentBalance).toBe(4000);

      // No new INVOICE ledger entry should be created for fully paid sale
      const invoiceEntries = await prisma.customerLedger.findMany({
        where: { customerId: creditCustId, type: 'INVOICE' },
      });
      expect(invoiceEntries.length).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 3: CUSTOMER PAYMENTS & ATOMICITY
  // ==========================================================================
  describe('Customer Payments & Atomicity', () => {
    let paymentCustId: string;

    beforeAll(async () => {
      const cust = await customerService.createCustomer({
        name: 'Sunil Rao',
        phone: '9840044444',
        openingBalance: 3000,
      });
      paymentCustId = cust.id;
    });

    it('12. Rejects zero payment amount', async () => {
      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: paymentCustId,
          amount: 0,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow();
    });

    it('13. Rejects negative payment amount', async () => {
      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: paymentCustId,
          amount: -500,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow();
    });

    it('14. Rejects payment against non-existent customer', async () => {
      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: 'a0000000-0000-0000-0000-000000000000',
          amount: 500,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow(/not found/);
    });

    it('15. Rejects payment against walk-in cash customer', async () => {
      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: 'cash-customer',
          amount: 500,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow(/Invalid customer ID|cannot be recorded/);
    });

    it('16. Rejects payment exceeding outstanding receivable (PAYMENT_EXCEEDS_OUTSTANDING) with zero mutation', async () => {
      // Balance is 3000. Attempt payment of 3001.
      const initialPaymentsCount = await prisma.customerPayment.count({ where: { customerId: paymentCustId } });
      const initialLedgerCount = await prisma.customerLedger.count({ where: { customerId: paymentCustId } });

      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: paymentCustId,
          amount: 3001,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow(/PAYMENT_EXCEEDS_OUTSTANDING/);

      // Verify NO payment row created, NO ledger row created, balance untouched at 3000
      const afterPaymentsCount = await prisma.customerPayment.count({ where: { customerId: paymentCustId } });
      const afterLedgerCount = await prisma.customerLedger.count({ where: { customerId: paymentCustId } });
      const customer = await customerService.getCustomerById(paymentCustId);

      expect(afterPaymentsCount).toBe(initialPaymentsCount);
      expect(afterLedgerCount).toBe(initialLedgerCount);
      expect(customer.currentBalance).toBe(3000);
    });

    it('17. Rejects payment against inactive customer', async () => {
      await customerService.deactivateCustomer(paymentCustId, adminId);

      await expect(
        customerAccountService.recordCustomerPayment({
          customerId: paymentCustId,
          amount: 500,
          paymentMethod: 'CASH',
        })
      ).rejects.toThrow(/inactive/);

      // Reactivate
      await customerService.updateCustomer(paymentCustId, { status: 'ACTIVE' }, adminId);
    });

    it('18. Valid partial payment reduces receivable and creates PAYMENT_RECEIVED ledger entry', async () => {
      // Balance: 3000 -> pay 1000 -> new balance 2000
      const res = await customerAccountService.recordCustomerPayment(
        {
          customerId: paymentCustId,
          amount: 1000,
          paymentMethod: 'UPI',
          reference: 'UPI-TXN-998811',
          notes: 'Partial payment via GPay',
        },
        cashierId
      );

      expect(res.previousBalance).toBe(3000);
      expect(res.newBalance).toBe(2000);
      expect(res.payment.amount).toBe(1000);
      expect(res.payment.paymentMethod).toBe('UPI');
      expect(res.payment.reference).toBe('UPI-TXN-998811');

      // Verify cached customer balance
      const customer = await customerService.getCustomerById(paymentCustId);
      expect(customer.currentBalance).toBe(2000);

      // Verify customer ledger entry
      const ledger = await prisma.customerLedger.findFirst({
        where: { customerId: paymentCustId, referenceId: res.payment.id },
      });
      expect(ledger).toBeDefined();
      expect(ledger?.type).toBe('PAYMENT_RECEIVED');
      expect(Number(ledger?.debit)).toBe(0);
      expect(Number(ledger?.credit)).toBe(1000);
      expect(Number(ledger?.balance)).toBe(2000);
    });

    it('19. Second payment reducing balance to zero', async () => {
      // Balance: 2000 -> pay 2000 -> new balance 0
      const res = await customerAccountService.recordCustomerPayment(
        {
          customerId: paymentCustId,
          amount: 2000,
          paymentMethod: 'BANK_TRANSFER',
          reference: 'NEFT-123456',
        },
        cashierId
      );

      expect(res.newBalance).toBe(0);

      const customer = await customerService.getCustomerById(paymentCustId);
      expect(customer.currentBalance).toBe(0);
    });

    it('20. Payment reversal restores receivable balance as an immutable ledger transaction', async () => {
      // Find the last payment of 2000
      const payments = await prisma.customerPayment.findMany({
        where: { customerId: paymentCustId },
        orderBy: { createdAt: 'desc' },
      });
      const lastPayment = payments[0];
      const origPaymentId = lastPayment.id;
      const origAmount = Number(lastPayment.amount);
      const origDate = lastPayment.paymentDate.toISOString();

      // Original ledger entry prior to reversal
      const origLedger = await prisma.customerLedger.findFirst({
        where: { customerId: paymentCustId, referenceId: origPaymentId, type: 'PAYMENT_RECEIVED' },
      });
      expect(origLedger).toBeDefined();
      expect(Number(origLedger?.credit)).toBe(2000);

      // Reverse payment
      const reversal = await customerAccountService.reverseCustomerPayment(
        {
          paymentId: lastPayment.id,
          reason: 'Cheque bounced / transaction failed',
        },
        adminId
      );

      // Balance was 0, now restored to 2000 (net effect = 0)
      expect(reversal.newBalance).toBe(2000);
      expect(reversal.ledgerEntry.type).toBe('PAYMENT_REVERSED');
      expect(reversal.ledgerEntry.debit).toBe(2000);
      expect(reversal.ledgerEntry.credit).toBe(0);
      expect(reversal.ledgerEntry.balance).toBe(2000);

      // Invariant Check 1: Original payment record remains untouched in DB
      const dbPayment = await prisma.customerPayment.findUnique({ where: { id: origPaymentId } });
      expect(dbPayment).toBeDefined();
      expect(Number(dbPayment?.amount)).toBe(origAmount);
      expect(dbPayment?.paymentDate.toISOString()).toBe(origDate);

      // Invariant Check 2: Original PAYMENT_RECEIVED ledger entry remains untouched
      const dbOrigLedger = await prisma.customerLedger.findFirst({
        where: { id: origLedger!.id },
      });
      expect(dbOrigLedger).toBeDefined();
      expect(Number(dbOrigLedger?.credit)).toBe(2000);
      expect(Number(dbOrigLedger?.debit)).toBe(0);

      // Invariant Check 3: Current balance updated accurately
      const customer = await customerService.getCustomerById(paymentCustId);
      expect(customer.currentBalance).toBe(2000);

      // Invariant Check 4: Cannot reverse the same payment twice (PAYMENT_ALREADY_REVERSED)
      await expect(
        customerAccountService.reverseCustomerPayment(
          {
            paymentId: lastPayment.id,
            reason: 'Double reversal attempt',
          },
          adminId
        )
      ).rejects.toThrow(/PAYMENT_ALREADY_REVERSED/);

      // Invariant Check 5: No duplicate reversal ledger entries created
      const reversalEntries = await prisma.customerLedger.findMany({
        where: { customerId: paymentCustId, referenceId: origPaymentId, type: 'PAYMENT_REVERSED' },
      });
      expect(reversalEntries.length).toBe(1);
    });
  });

  // ==========================================================================
  // SECTION 4: SALES RETURNS INTEGRATION
  // ==========================================================================
  describe('Sales Returns & Customer Credit Integration', () => {
    let returnCustId: string;
    let saleWithReturn: any;

    beforeAll(async () => {
      const cust = await customerService.createCustomer({
        name: 'Deepak Verma',
        phone: '9850055555',
        openingBalance: 0,
      });
      returnCustId = cust.id;

      // Create a credit sale: 2 x 1000 = 2000. Paid: 0. Due: 2000.
      saleWithReturn = await saleService.createSale(
        {
          customerId: returnCustId,
          items: [{ productId: testProduct1Id, quantity: 2, sellingPrice: 1000 }],
          paidAmount: 0,
          paymentMethod: 'CREDIT',
        },
        cashierId
      );
    });

    it('21. Sales return with CUSTOMER_CREDIT reduces customer receivable', async () => {
      // Customer currently owes 2000. Return 1 item worth 1000.
      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: saleWithReturn.id,
          items: [{ productId: testProduct1Id, quantity: 1 }],
          refundType: 'CUSTOMER_CREDIT',
          notes: 'Defective packaging return',
        },
        cashierId
      );

      expect(ret.totalAmount).toBe(1000);
      expect(ret.refundType).toBe('CUSTOMER_CREDIT');

      // Customer outstanding should be 2000 - 1000 = 1000
      const customer = await customerService.getCustomerById(returnCustId);
      expect(customer.currentBalance).toBe(1000);

      // Verify SALES_RETURN entry in customer_ledger
      const ledgerEntry = await prisma.customerLedger.findFirst({
        where: { customerId: returnCustId, referenceId: ret.id },
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.type).toBe('SALES_RETURN');
      expect(Number(ledgerEntry?.credit)).toBe(1000);
      expect(Number(ledgerEntry?.balance)).toBe(1000);
    });

    it('22. Sales return with CASH_REFUND does NOT alter customer receivable', async () => {
      // Return 2nd item with CASH_REFUND
      const ret2 = await salesReturnService.createSalesReturn(
        {
          saleId: saleWithReturn.id,
          items: [{ productId: testProduct1Id, quantity: 1 }],
          refundType: 'CASH_REFUND',
          notes: 'Customer chose cash refund',
        },
        cashierId
      );

      expect(ret2.refundType).toBe('CASH_REFUND');

      // Customer balance should remain unchanged at 1000
      const customer = await customerService.getCustomerById(returnCustId);
      expect(customer.currentBalance).toBe(1000);
    });

    it('23. Original sale record remains immutable after returns', async () => {
      const origSale = await saleService.getSaleById(saleWithReturn.id);
      expect(origSale.total).toBe(2000);
      expect(origSale.items.length).toBe(1);
      expect(origSale.items[0].quantity).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 5: STATEMENTS & RECONCILIATION
  // ==========================================================================
  describe('Customer Statements & Ledger Reconciliation', () => {
    let stmtCustId: string;

    beforeAll(async () => {
      // Customer with Opening Balance = 10,000
      const cust = await customerService.createCustomer({
        name: 'Ananya Roy',
        phone: '9860066666',
        openingBalance: 10000,
      });
      stmtCustId = cust.id;

      // Sale 1: Due 2500 (1 x Bosch screwdriver)
      await saleService.createSale(
        {
          customerId: stmtCustId,
          items: [{ productId: testProduct2Id, quantity: 1, sellingPrice: 2500 }],
          paidAmount: 0,
          paymentMethod: 'CREDIT',
        },
        cashierId
      );

      // Payment 1: 5000
      await customerAccountService.recordCustomerPayment(
        {
          customerId: stmtCustId,
          amount: 5000,
          paymentMethod: 'BANK_TRANSFER',
          reference: 'IMPS-001122',
        },
        cashierId
      );
      // Current Balance: 10000 + 2500 - 5000 = 7500
    });

    it('24. Accurate running balance across ledger entries', async () => {
      const ledger = await customerAccountService.getCustomerLedger(stmtCustId, {
        page: 1,
        pageSize: 50,
      });

      expect(ledger.total).toBe(3); // OPENING_BALANCE, INVOICE, PAYMENT_RECEIVED

      // Newest first:
      expect(ledger.data[0].type).toBe('PAYMENT_RECEIVED');
      expect(ledger.data[0].balance).toBe(7500);

      expect(ledger.data[1].type).toBe('INVOICE');
      expect(ledger.data[1].balance).toBe(12500);

      expect(ledger.data[2].type).toBe('OPENING_BALANCE');
      expect(ledger.data[2].balance).toBe(10000);
    });

    it('25. Customer statement computes totals and chronological movements', async () => {
      const stmt = await customerAccountService.getCustomerStatement(stmtCustId, {});

      expect(stmt.customer.id).toBe(stmtCustId);
      expect(stmt.totalDebit).toBe(12500); // 10000 opening + 2500 sale
      expect(stmt.totalCredit).toBe(5000); // 5000 payment
      expect(stmt.closingBalance).toBe(7500);
      expect(stmt.entries.length).toBe(3);
    });

    it('26. Ledger reconciliation detects matched balance correctly', async () => {
      const rec = await customerAccountService.reconcileCustomerBalance(stmtCustId, false);
      expect(rec.isBalanced).toBe(true);
      expect(rec.discrepancy).toBe(0);
      expect(rec.cachedBalance).toBe(7500);
      expect(rec.calculatedBalance).toBe(7500);
    });

    it('27. Ledger reconciliation detects and repairs intentional discrepancy', async () => {
      // Artificially corrupt cached balance directly in database to test audit detection
      await prisma.customer.update({
        where: { id: stmtCustId },
        data: { currentBalance: 9999 }, // Corrupted value
      });

      // Diagnostic check detects discrepancy
      const check = await customerAccountService.reconcileCustomerBalance(stmtCustId, false);
      expect(check.isBalanced).toBe(false);
      expect(check.discrepancy).toBe(2499); // |7500 - 9999|
      expect(check.cachedBalance).toBe(9999);
      expect(check.calculatedBalance).toBe(7500);

      // Auto-fix repair restores ledger authority
      const repaired = await customerAccountService.reconcileCustomerBalance(stmtCustId, true, adminId);
      expect(repaired.isBalanced).toBe(true);
      expect(repaired.discrepancy).toBe(0);
      expect(repaired.cachedBalance).toBe(7500);

      // Verify customer row in DB was corrected
      const customer = await customerService.getCustomerById(stmtCustId);
      expect(customer.currentBalance).toBe(7500);
    });
  });

  // ==========================================================================
  // SECTION 6: CONCURRENCY & SERIALIZED WRITE QUEUE
  // ==========================================================================
  describe('Concurrency & Race Condition Protection', () => {
    it('28. Two simultaneous payments cannot overpay available outstanding balance', async () => {
      const cust = await customerService.createCustomer({
        name: 'Concurrent Test Customer',
        phone: '9870077777',
        openingBalance: 5000,
      });

      // Two simultaneous payments of ₹4,000 against ₹5,000 outstanding
      // Only one must succeed; the second must be rejected because 4000 > 1000 remaining
      const p1 = customerAccountService.recordCustomerPayment(
        {
          customerId: cust.id,
          amount: 4000,
          paymentMethod: 'CASH',
        },
        cashierId
      );

      const p2 = customerAccountService.recordCustomerPayment(
        {
          customerId: cust.id,
          amount: 4000,
          paymentMethod: 'UPI',
        },
        cashierId
      );

      const results = await Promise.allSettled([p1, p2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // The final balance must be exactly 1000, never negative
      const finalCust = await customerService.getCustomerById(cust.id);
      expect(finalCust.currentBalance).toBe(1000);

      // Authoritative reconciliation must confirm zero discrepancy
      const rec = await customerAccountService.reconcileCustomerBalance(cust.id);
      expect(rec.isBalanced).toBe(true);
      expect(rec.calculatedBalance).toBe(1000);
    });
  });

  // ==========================================================================
  // SECTION 7: FASTIFY IN-PROCESS HTTP API & SECURITY
  // ==========================================================================
  describe('Fastify In-Process API & Security Guard', () => {
    let apiCustId: string;

    beforeAll(async () => {
      const cust = await customerService.createCustomer({
        name: 'API Security Test Customer',
        phone: '9880088888',
        openingBalance: 2000,
      });
      apiCustId = cust.id;
    });

    it('29. Rejects unauthenticated requests with 401 error message', async () => {
      const res = await dispatchFastify('GET', '/api/customers');
      expect(res.error).toMatch(/Authentication required|Session expired/);
    });

    it('30. Authenticated user can fetch customers list and receivables summary', async () => {
      const listRes = await dispatchFastify(
        'GET',
        '/api/customers',
        undefined,
        { authorization: cashierToken }
      );
      expect(listRes.data).toBeDefined();
      expect(listRes.data.length).toBeGreaterThan(0);

      const sumRes = await dispatchFastify(
        'GET',
        '/api/customers/receivables/summary',
        undefined,
        { authorization: cashierToken }
      );
      expect(sumRes.totalReceivables).toBeGreaterThan(0);
      expect(sumRes.customersWithOutstanding).toBeGreaterThan(0);
    });

    it('31. Cashier can record customer payment via Fastify API', async () => {
      const res = await dispatchFastify(
        'POST',
        `/api/customers/${apiCustId}/payments`,
        {
          amount: 500,
          paymentMethod: 'CASH',
          notes: 'Cashier desk payment',
        },
        { authorization: cashierToken }
      );

      expect(res.newBalance).toBe(1500);
      expect(res.payment.amount).toBe(500);
    });

    it('32. Non-Admin (Cashier) cannot delete customer (403 Forbidden)', async () => {
      const res = await dispatchFastify(
        'DELETE',
        `/api/customers/${apiCustId}`,
        undefined,
        { authorization: cashierToken }
      );
      expect(res.error).toBe('Forbidden');
    });

    it('33. Non-Admin (Cashier) cannot execute balance repair auto-fix (403 Forbidden)', async () => {
      const res = await dispatchFastify(
        'POST',
        `/api/customers/${apiCustId}/reconcile`,
        { autoFix: true },
        { authorization: cashierToken }
      );
      expect(res.error).toBe('Forbidden');
    });

    it('34. Admin can execute diagnostic reconciliation via Fastify API', async () => {
      const res = await dispatchFastify(
        'GET',
        `/api/customers/${apiCustId}/reconcile`,
        undefined,
        { authorization: adminToken }
      );
      expect(res.isBalanced).toBe(true);
      expect(res.calculatedBalance).toBe(1500);
    });
  });
});
