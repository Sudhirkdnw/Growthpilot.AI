/**
 * Phase 12 — Invoice Printing, PDF Generation & Printer Output Test Suite
 *
 * Verifies:
 * 1. Authoritative Invoice Data Service (Sale, Sales Return, Purchase, Purchase Return)
 * 2. Accuracy of historical prices, quantities, taxes, discounts, totals
 * 3. Cash Customer vs Credit Customer representation
 * 4. Financial Immutability (zero side effects on stock, ledgers, sequences)
 * 5. Amount in Words conversion (Rupees & Paise, large numbers, edge cases)
 * 6. Multi-format HTML rendering (A4 with repeating headers, 80mm thermal, 58mm thermal)
 * 7. Fastify Route security & validation (/api/invoices/document)
 * 8. Printer settings storage, defaults, and Admin-only update enforcement
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { productService } from '../../src/main/modules/products/product.service';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { customerService } from '../../src/main/modules/customers/customer.service';
import { supplierService } from '../../src/main/modules/suppliers/supplier.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { purchaseReturnService } from '../../src/main/modules/returns/purchase-return.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { invoiceDataService } from '../../src/main/modules/invoice/invoice-data.service';
import { amountToWords } from '../../src/shared/utils/amountInWords';
import {
  renderA4InvoiceHtml,
  renderThermal80mmHtml,
  renderThermal58mmHtml,
  renderInvoiceHtml,
} from '../../src/renderer/src/features/invoice/invoice-templates';
import { dispatchFastify } from '../../src/main/fastify/server';
import { sessionManager } from '../../src/main/modules/auth/session.manager';

describe('Phase 12: Invoice Printing, PDF & Output Test Suite', () => {
  const prisma = getPrismaClient();

  let adminToken: string;
  let adminId: string;
  let cashierToken: string;
  let cashierId: string;

  let unitId: string;
  let categoryId: string;
  let product1Id: string;
  let product2Id: string;
  let customerId: string;
  let supplierId: string;

  let sale1Id: string; // Credit sale with customer
  let sale2Id: string; // Cash sale
  let salesReturnId: string;
  let purchaseId: string;
  let purchaseReturnId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // 1. Clean tables in foreign-key safe order
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
    await prisma.unit.deleteMany({});
    await prisma.appSetting.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // 2. Create Users & Sessions
    const adminUser = await prisma.user.create({
      data: {
        username: 'print_admin',
        passwordHash: 'dummyHash',
        fullName: 'Print System Admin',
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

    const cashierUser = await prisma.user.create({
      data: {
        username: 'print_cashier',
        passwordHash: 'dummyHash',
        fullName: 'Counter Cashier',
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

    // 3. Initialize Sequences
    await prisma.invoiceSequence.createMany({
      data: [
        { type: 'SALE_INVOICE', prefix: 'INV-', nextNumber: 100, padLength: 6 },
        { type: 'PURCHASE_BILL', prefix: 'BILL-', nextNumber: 200, padLength: 6 },
        { type: 'SALES_RETURN', prefix: 'SR-', nextNumber: 300, padLength: 6 },
        { type: 'PURCHASE_RETURN', prefix: 'PR-', nextNumber: 400, padLength: 6 },
      ],
    });

    // 4. Seed Master Data
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Piece',
      shortCode: 'PCS',
      allowDecimal: false,
    });
    unitId = unit.id;

    const category = await categoryBrandUnitService.createCategory({
      name: 'Electronics',
    });
    categoryId = category.id;

    const p1 = await productService.createProduct(
      {
        name: 'Wireless Bluetooth Mouse',
        sku: 'MOUSE-BT-01',
        unitId,
        categoryId,
        purchasePrice: 400,
        salePrice: 850,
        taxRate: 18,
        openingStock: 100,
        reorderLevel: 10,
      },
      adminId
    );
    product1Id = p1.product.id;

    const p2 = await productService.createProduct(
      {
        name: 'Mechanical Gaming Keyboard',
        sku: 'KB-MECH-02',
        unitId,
        categoryId,
        purchasePrice: 1500,
        salePrice: 2800,
        taxRate: 18,
        openingStock: 50,
        reorderLevel: 10,
      },
      adminId
    );
    product2Id = p2.product.id;

    // 5. Seed Customer & Supplier
    const cust = await customerService.createCustomer({
      name: 'Rajesh Sharma',
      phone: '9876543210',
      email: 'rajesh@example.com',
      address: '24 Park Street, Mumbai',
      openingBalance: 0,
    });
    customerId = cust.id;

    const supp = await supplierService.createSupplier({
      name: 'Apex Tech Distributing',
      phone: '9123456780',
      email: 'sales@apextech.com',
      address: 'Industrial Area Phase 2, Pune',
      gstin: '27AABCA1234F1Z9',
      openingBalance: 0,
    });
    supplierId = supp.id;

    // 6. Create Transactions
    // Sale 1: Credit Sale (2 mice, 1 keyboard)
    const s1 = await saleService.createSale(
      {
        customerId,
        items: [
          { productId: product1Id, quantity: 2, sellingPrice: 850, discount: 50, taxRate: 18 },
          { productId: product2Id, quantity: 1, sellingPrice: 2800, discount: 100, taxRate: 18 },
        ],
        discount: 50, // global discount
        tax: 0,
        paidAmount: 2000,
        paymentMethod: 'CREDIT',
        notes: 'Priority Customer Credit Sale',
      },
      adminId
    );
    sale1Id = s1.id;

    // Sale 2: Cash Walk-in Sale
    const s2 = await saleService.createSale(
      {
        customerId: null,
        items: [
          { productId: product1Id, quantity: 1, sellingPrice: 850, discount: 0, taxRate: 18 },
        ],
        discount: 0,
        tax: 0,
        paidAmount: 1500,
        paymentMethod: 'CASH',
      },
      cashierId
    );
    sale2Id = s2.id;

    // Sales Return against Sale 1
    const sr = await salesReturnService.createSalesReturn(
      {
        saleId: sale1Id,
        refundType: 'CUSTOMER_CREDIT',
        notes: 'Customer returned 1 mouse',
        items: [{ saleItemId: s1.items[0].id, productId: product1Id, quantity: 1 }],
      },
      adminId
    );
    salesReturnId = sr.id;

    // Purchase: 10 Keyboards
    const pBill = await purchaseService.createPurchase(
      {
        supplierId,
        items: [
          { productId: product2Id, quantity: 10, purchasePrice: 1500, discount: 0, taxRate: 18 },
        ],
        discount: 500,
        tax: 0,
        paidAmount: 10000,
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Vendor Invoice #A-9988',
      },
      adminId
    );
    purchaseId = pBill.id;

    // Purchase Return: Return 2 Keyboards to vendor
    const pr = await purchaseReturnService.createPurchaseReturn(
      {
        purchaseId,
        notes: 'Defective units returned',
        items: [{ purchaseItemId: pBill.items[0].id, productId: product2Id, quantity: 2 }],
      },
      adminId
    );
    purchaseReturnId = pr.id;
  });

  // ==========================================================================
  // 1. AMOUNT IN WORDS TESTS
  // ==========================================================================
  describe('1. Amount in Words Engine', () => {
    it('1.1 formats zero correctly', () => {
      expect(amountToWords(0)).toBe('Rupees Zero Only');
    });

    it('1.2 formats standard round rupee amounts', () => {
      expect(amountToWords(500)).toBe('Rupees Five Hundred Only');
      expect(amountToWords(1250)).toBe('Rupees One Thousand Two Hundred Fifty Only');
    });

    it('1.3 formats rupee amounts with paise', () => {
      expect(amountToWords(1250.5)).toBe('Rupees One Thousand Two Hundred Fifty and Fifty Paise Only');
      expect(amountToWords(99.75)).toBe('Rupees Ninety Nine and Seventy Five Paise Only');
    });

    it('1.4 formats Lakhs and Crores accurately (Indian numbering system)', () => {
      expect(amountToWords(150000)).toBe('Rupees One Lakh Fifty Thousand Only');
      expect(amountToWords(10050200)).toBe('Rupees One Crore Fifty Thousand Two Hundred Only');
    });

    it('1.5 handles negative and custom currency names', () => {
      expect(amountToWords(-450, 'Dollars', 'Cents')).toBe('Minus Dollars Four Hundred Fifty Only');
    });
  });

  // ==========================================================================
  // 2. AUTHORITATIVE INVOICE DATA SERVICE
  // ==========================================================================
  describe('2. Authoritative Invoice Data Service', () => {
    it('2.1 loads correct sale invoice document for credit sale', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale1Id);

      expect(doc.documentType).toBe('SALE');
      expect(doc.title).toBe('TAX INVOICE');
      expect(doc.documentNumber).toBe('INV-000100');
      expect(doc.party.name).toBe('Rajesh Sharma');
      expect(doc.party.phone).toBe('9876543210');
      expect(doc.party.isCashParty).toBe(false);
      expect(doc.items.length).toBe(2);

      // Financial invariant check: grandTotal = subtotal + taxTotal - globalDiscount
      expect(doc.subtotal).toBeGreaterThan(0);
      expect(doc.grandTotal).toBe(
        Math.round((doc.subtotal + doc.taxTotal - doc.globalDiscount) * 100) / 100
      );
      expect(doc.paidAmount).toBe(2000);
      expect(doc.dueAmount).toBe(Math.round((doc.grandTotal - doc.paidAmount) * 100) / 100);
      expect(doc.paymentMethod).toBe('CREDIT');
      expect(doc.amountInWords).toContain('Rupees');
      expect(doc.amountInWords).toContain('Only');
    });

    it('2.2 loads correct sale invoice document for cash walk-in sale', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale2Id);

      expect(doc.documentType).toBe('SALE');
      expect(doc.party.name).toBe('Cash Customer');
      expect(doc.party.isCashParty).toBe(true);
      expect(doc.paymentMethod).toBe('CASH');
      expect(doc.dueAmount).toBe(0);
      expect(doc.changeAmount).toBeGreaterThan(0); // Paid 1500 for ~1003 sale
    });

    it('2.3 loads correct sales return credit note document', async () => {
      const doc = await invoiceDataService.getSalesReturnDocument(salesReturnId);

      expect(doc.documentType).toBe('SALES_RETURN');
      expect(doc.title).toBe('CREDIT NOTE (SALES RETURN)');
      expect(doc.documentNumber).toBe('SR-000300');
      expect(doc.originalDocumentNumber).toBe('INV-000100');
      expect(doc.party.name).toBe('Rajesh Sharma');
      expect(doc.items.length).toBe(1);
      expect(doc.items[0].name).toBe('Wireless Bluetooth Mouse');
      expect(doc.items[0].quantity).toBe(1);
      expect(doc.grandTotal).toBeGreaterThan(0);
      expect(doc.amountInWords).toContain('Rupees');
    });

    it('2.4 loads correct purchase inward bill document', async () => {
      const doc = await invoiceDataService.getPurchaseBillDocument(purchaseId);

      expect(doc.documentType).toBe('PURCHASE');
      expect(doc.title).toBe('PURCHASE INWARD BILL');
      expect(doc.documentNumber).toBe('BILL-000200');
      expect(doc.party.name).toBe('Apex Tech Distributing');
      expect(doc.party.gstin).toBe('27AABCA1234F1Z9');
      expect(doc.items.length).toBe(1);
      expect(doc.items[0].quantity).toBe(10);
      expect(doc.items[0].unitPrice).toBe(1500);
      expect(doc.paidAmount).toBe(10000);
      expect(doc.dueAmount).toBeGreaterThan(0);
    });

    it('2.5 loads correct purchase return debit note document', async () => {
      const doc = await invoiceDataService.getPurchaseReturnDocument(purchaseReturnId);

      expect(doc.documentType).toBe('PURCHASE_RETURN');
      expect(doc.title).toBe('DEBIT NOTE (PURCHASE RETURN)');
      expect(doc.documentNumber).toBe('PR-000400');
      expect(doc.originalDocumentNumber).toBe('BILL-000200');
      expect(doc.party.name).toBe('Apex Tech Distributing');
      expect(doc.items.length).toBe(1);
      expect(doc.items[0].quantity).toBe(2);
    });
  });

  // ==========================================================================
  // 3. FINANCIAL IMMUTABILITY & ZERO SIDE EFFECTS
  // ==========================================================================
  describe('3. Financial Immutability & Zero Side Effects', () => {
    it('3.1 invoice generation does not alter sale record', async () => {
      const saleBefore = await prisma.sale.findUnique({ where: { id: sale1Id } });
      await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const saleAfter = await prisma.sale.findUnique({ where: { id: sale1Id } });

      expect(Number(saleBefore?.grandTotal)).toBe(Number(saleAfter?.grandTotal));
      expect(Number(saleBefore?.paidAmount)).toBe(Number(saleAfter?.paidAmount));
      expect(Number(saleBefore?.dueAmount)).toBe(Number(saleAfter?.dueAmount));
    });

    it('3.2 invoice generation does not alter stock or product records', async () => {
      const pBefore = await prisma.product.findUnique({ where: { id: product1Id } });
      await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const pAfter = await prisma.product.findUnique({ where: { id: product1Id } });

      expect(Number(pBefore?.currentStock)).toBe(Number(pAfter?.currentStock));
    });

    it('3.3 invoice generation does not alter customer ledger', async () => {
      const countBefore = await prisma.customerLedger.count({ where: { customerId } });
      await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const countAfter = await prisma.customerLedger.count({ where: { customerId } });

      expect(countBefore).toBe(countAfter);
    });

    it('3.4 invoice generation does not increment invoice sequence', async () => {
      const seqBefore = await prisma.invoiceSequence.findUnique({
        where: { type: 'SALE_INVOICE' },
      });
      await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const seqAfter = await prisma.invoiceSequence.findUnique({
        where: { type: 'SALE_INVOICE' },
      });

      expect(seqBefore?.nextNumber).toBe(seqAfter?.nextNumber);
    });

    it('3.5 repeated reprint produces identical output with original document number', async () => {
      const doc1 = await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const doc2 = await invoiceDataService.getSaleInvoiceDocument(sale1Id);

      expect(doc1.documentNumber).toBe(doc2.documentNumber);
      expect(doc1.grandTotal).toBe(doc2.grandTotal);
      expect(doc1.date).toBe(doc2.date);
    });
  });

  // ==========================================================================
  // 4. HTML RENDERERS & TEMPLATES
  // ==========================================================================
  describe('4. Multi-Format HTML Template Generators', () => {
    it('4.1 renders valid A4 HTML containing company, party, repeating table headers, and terms', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const html = renderA4InvoiceHtml(doc);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(doc.documentNumber);
      expect(html).toContain('Rajesh Sharma');
      expect(html).toContain('Wireless Bluetooth Mouse');
      expect(html).toContain('Mechanical Gaming Keyboard');
      expect(html).toContain('thead');
      expect(html).toContain('display: table-header-group'); // Multi-page repetition requirement
      expect(html).toContain('Amount in Words');
      expect(html).toContain('Authorized Signatory');
    });

    it('4.2 renders valid 80mm thermal receipt HTML with correct wrapping and totals', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      const html = renderThermal80mmHtml(doc);

      expect(html).toContain('width: 76mm');
      expect(html).toContain(doc.documentNumber);
      expect(html).toContain('Rajesh Sharma');
      expect(html).toContain('Subtotal:');
      expect(html).toContain('TOTAL:');
      expect(html).toContain('Balance Due:');
    });

    it('4.3 renders valid 58mm thermal receipt HTML in compact format', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale2Id);
      const html = renderThermal58mmHtml(doc);

      expect(html).toContain('width: 48mm');
      expect(html).toContain(doc.documentNumber);
      expect(html).toContain('Cash Customer');
      expect(html).toContain('TOTAL:');
    });

    it('4.4 universal dispatcher renderInvoiceHtml renders chosen format', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale1Id);

      const a4 = renderInvoiceHtml(doc, 'A4');
      expect(a4).toContain('A4 portrait');

      const t80 = renderInvoiceHtml(doc, 'THERMAL_80MM');
      expect(t80).toContain('76mm');

      const t58 = renderInvoiceHtml(doc, 'THERMAL_58MM');
      expect(t58).toContain('48mm');
    });

    it('4.5 displays watermark when document status is CANCELLED', async () => {
      const doc = await invoiceDataService.getSaleInvoiceDocument(sale1Id);
      doc.status = 'CANCELLED';

      const htmlA4 = renderA4InvoiceHtml(doc);
      expect(htmlA4).toContain('CANCELLED');

      const html80 = renderThermal80mmHtml(doc);
      expect(html80).toContain('*** CANCELLED ***');
    });
  });

  // ==========================================================================
  // 5. SETTINGS & PRINTER PERSISTENCE
  // ==========================================================================
  describe('5. Printer & Invoice Settings Persistence', () => {
    it('5.1 returns default printer settings in app settings', async () => {
      const settings = await settingsService.getAppSettings();
      expect(settings.printer).toBeDefined();
      expect(settings.printer?.copies).toBe(1);
      expect(['A4', 'THERMAL_58MM', 'THERMAL_80MM']).toContain(settings.printer?.paperFormat);
    });

    it('5.2 allows ADMIN to update printer and invoice configuration', async () => {
      const res = await dispatchFastify(
        'PUT',
        '/api/settings',
        {
          settings: {
            printer: {
              printerName: 'POS-80-Receipt-Printer',
              paperFormat: 'THERMAL_80MM',
              copies: 2,
              silent: true,
              showPreview: false,
            },
          },
        },
        { authorization: adminToken }
      );

      expect(res.success).toBe(true);
      expect(res.settings.printer.printerName).toBe('POS-80-Receipt-Printer');
      expect(res.settings.printer.copies).toBe(2);
      expect(res.settings.printer.silent).toBe(true);
      expect(res.settings.printer.showPreview).toBe(false);
    });

    it('5.3 rejects non-admin users from updating printer settings (403 Forbidden)', async () => {
      const res = await dispatchFastify(
        'PUT',
        '/api/settings',
        {
          settings: {
            printer: {
              printerName: 'Hacked-Printer',
            },
          },
        },
        { authorization: cashierToken }
      );

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. FASTIFY ROUTE SECURITY & VALIDATION
  // ==========================================================================
  describe('6. Fastify Route Security & Validation (/api/invoices/document)', () => {
    it('6.1 rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await dispatchFastify('GET', `/api/invoices/document?type=SALE&id=${sale1Id}`);
      expect(res.error).toBeDefined();
    });

    it('6.2 serves invoice document for authenticated session', async () => {
      const res = await dispatchFastify(
        'GET',
        `/api/invoices/document?type=SALE&id=${sale1Id}`,
        undefined,
        { authorization: cashierToken }
      );

      expect(res.success).toBe(true);
      expect(res.document).toBeDefined();
      expect(res.document.documentNumber).toBe('INV-000100');
    });

    it('6.3 returns 404 error when transaction ID is not found', async () => {
      const res = await dispatchFastify(
        'GET',
        '/api/invoices/document?type=SALE&id=non-existent-uuid',
        undefined,
        { authorization: adminToken }
      );

      expect(res.error).toContain('not found');
    });

    it('6.4 returns 400 error when document type is invalid', async () => {
      const res = await dispatchFastify(
        'GET',
        `/api/invoices/document?type=INVALID_TYPE&id=${sale1Id}`,
        undefined,
        { authorization: adminToken }
      );

      expect(res.error).toContain('Invalid document type');
    });
  });
});
