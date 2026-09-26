import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { invoiceDataService } from '../../src/main/modules/invoice/invoice-data.service';
import { renderInvoiceHtml } from '../../src/renderer/src/features/invoice/invoice-templates';
import {
  roundQuantity,
  roundMoney,
  validateQuantity,
  compareQuantities,
  convertQuantity,
  calculateSellByAmount,
  formatQuantity,
  formatUnitPrice,
  parseScaleBarcode,
} from '../../src/shared/utils/quantity';

describe('Loose / Open / Variable-Quantity Products - Production-Grade Test Suite', () => {
  const prisma = getPrismaClient();

  let adminUserId: string;
  let unitKgId: string;
  let unitGId: string;
  let unitLtrId: string;
  let unitMlId: string;
  let unitPcsId: string;
  let riceProductId: string;
  let penProductId: string;
  let milkProductId: string;
  let supplierId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up test tables in foreign-key order
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

    // Create Admin User
    const admin = await prisma.user.create({
      data: {
        username: 'loose_test_admin',
        passwordHash: 'hash',
        fullName: 'Loose Test Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminUserId = admin.id;

    // Seed Units with full unit classification
    const uPcs = await categoryBrandUnitService.createUnit(
      {
        name: 'Piece',
        shortCode: 'PCS',
        allowDecimal: false,
        category: 'COUNT',
        precision: 0,
        conversionFactor: 1,
      },
      adminUserId
    );
    unitPcsId = uPcs.id;

    const uKg = await categoryBrandUnitService.createUnit(
      {
        name: 'Kilogram',
        shortCode: 'KG',
        allowDecimal: true,
        category: 'WEIGHT',
        precision: 3,
        conversionFactor: 1,
        baseUnitCode: 'KG',
      },
      adminUserId
    );
    unitKgId = uKg.id;

    const uG = await categoryBrandUnitService.createUnit(
      {
        name: 'Gram',
        shortCode: 'G',
        allowDecimal: true,
        category: 'WEIGHT',
        precision: 3,
        conversionFactor: 0.001,
        baseUnitCode: 'KG',
      },
      adminUserId
    );
    unitGId = uG.id;

    const uLtr = await categoryBrandUnitService.createUnit(
      {
        name: 'Liter',
        shortCode: 'LTR',
        allowDecimal: true,
        category: 'VOLUME',
        precision: 3,
        conversionFactor: 1,
        baseUnitCode: 'LTR',
      },
      adminUserId
    );
    unitLtrId = uLtr.id;

    const uMl = await categoryBrandUnitService.createUnit(
      {
        name: 'Milliliter',
        shortCode: 'ML',
        allowDecimal: true,
        category: 'VOLUME',
        precision: 3,
        conversionFactor: 0.001,
        baseUnitCode: 'LTR',
      },
      adminUserId
    );
    unitMlId = uMl.id;

    // Create Supplier for purchase tests
    const sup = await prisma.supplier.create({
      data: {
        name: 'Loose Goods Wholesale Ltd',
        phone: '9988776655',
        openingBalance: 0,
        currentBalance: 0,
      },
    });
    supplierId = sup.id;

    // Seed Products
    // 1. Basmati Rice (WEIGHT, KG)
    const rice = await productService.createProduct(
      {
        name: 'Basmati Rice',
        sku: 'RICE-BASMATI-KG',
        barcode: '8901234567890',
        unitId: unitKgId,
        purchasePrice: 90,
        salePrice: 120,
        taxRate: 0,
        openingStock: 50,
        reorderLevel: 10,
        allowSellByAmount: true,
      },
      adminUserId
    );
    riceProductId = rice.product.id;

    // 2. Ballpoint Pen (COUNT, PCS)
    const pen = await productService.createProduct(
      {
        name: 'Reynolds Ballpoint Pen',
        sku: 'PEN-REYNOLDS-01',
        barcode: '8901234567891',
        unitId: unitPcsId,
        purchasePrice: 6,
        salePrice: 10,
        taxRate: 0,
        openingStock: 100,
        reorderLevel: 20,
        allowSellByAmount: false,
      },
      adminUserId
    );
    penProductId = pen.product.id;

    // 3. Cow Milk (VOLUME, LTR)
    const milk = await productService.createProduct(
      {
        name: 'Fresh Cow Milk',
        sku: 'MILK-COW-1L',
        barcode: '8901234567892',
        unitId: unitLtrId,
        purchasePrice: 45,
        salePrice: 65,
        taxRate: 0,
        openingStock: 30,
        reorderLevel: 5,
        allowSellByAmount: true,
      },
      adminUserId
    );
    milkProductId = milk.product.id;
  });

  // ==========================================================================
  // SECTION 1: CENTRALIZED QUANTITY MATH & VALIDATION
  // ==========================================================================
  describe('1. Centralized Quantity Math, Conversion & Validation', () => {
    it('1. Piece product rejects decimal quantity', () => {
      const result = validateQuantity(1.5, {
        allowDecimal: false,
        precision: 0,
        unitCode: 'PCS',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not permitted');
    });

    it('2. Weight product accepts valid decimal quantity', () => {
      const result = validateQuantity(1.5, {
        allowDecimal: true,
        precision: 3,
        unitCode: 'KG',
      });
      expect(result.valid).toBe(true);
    });

    it('3. Volume product accepts valid decimal quantity', () => {
      const result = validateQuantity(0.75, {
        allowDecimal: true,
        precision: 3,
        unitCode: 'LTR',
      });
      expect(result.valid).toBe(true);
    });

    it('4. Length product accepts valid decimal quantity', () => {
      const result = validateQuantity(2.75, {
        allowDecimal: true,
        precision: 3,
        unitCode: 'MTR',
      });
      expect(result.valid).toBe(true);
    });

    it('5. Rejects NaN, Infinity, negative and zero quantity', () => {
      expect(validateQuantity(NaN, {}).valid).toBe(false);
      expect(validateQuantity(Infinity, {}).valid).toBe(false);
      expect(validateQuantity(-1.5, {}).valid).toBe(false);
      expect(validateQuantity(0, {}).valid).toBe(false);
    });

    it('6. Normalizes and converts quantities accurately', () => {
      // 100g -> 0.1kg
      expect(convertQuantity(100, 'G', 'KG')).toBe(0.1);
      // 250g -> 0.25kg
      expect(convertQuantity(250, 'G', 'KG')).toBe(0.25);
      // 1.5kg remains 1.5kg
      expect(convertQuantity(1.5, 'KG', 'KG')).toBe(1.5);
      // 1000ml -> 1l
      expect(convertQuantity(1000, 'ML', 'LTR')).toBe(1);
      // 500ml -> 0.5l
      expect(convertQuantity(500, 'ML', 'LTR')).toBe(0.5);
    });

    it('7. Incompatible cross-category conversion throws error', () => {
      expect(() => convertQuantity(1.5, 'KG', 'PCS')).toThrow('Incompatible unit conversion');
      expect(() => convertQuantity(500, 'ML', 'MTR')).toThrow('Incompatible unit conversion');
    });

    it('8. Compares decimal quantities accurately without IEEE-754 drift', () => {
      const sum = roundQuantity(0.1 + 0.2, 4);
      expect(compareQuantities(sum, 0.3)).toBe(0);
      expect(compareQuantities(1.5001, 1.5, 3)).toBe(0);
      expect(compareQuantities(1.501, 1.5, 3)).toBe(1);
      expect(compareQuantities(1.499, 1.5, 3)).toBe(-1);
    });
  });

  // ==========================================================================
  // SECTION 2: POS SALES WORKFLOW & AUTHORITATIVE INVENTORY
  // ==========================================================================
  describe('2. Sales & Stock Ledger with Decimal Quantities', () => {
    it('1. Sells 1.5 kg Basmati Rice: Line Total = ₹180, Stock: 50 kg -> 48.5 kg', async () => {
      const sale = await saleService.createSale(
        {
          items: [
            {
              productId: riceProductId,
              quantity: 1.5,
              sellingPrice: 120,
              discount: 0,
              taxRate: 0,
              unitCode: 'KG',
            },
          ],
          discount: 0,
          paymentMethod: 'CASH',
          paidAmount: 180,
        },
        adminUserId
      );

      expect(sale.total).toBe(180);
      expect(sale.items[0].quantity).toBe(1.5);
      expect(sale.items[0].lineTotal).toBe(180);
      // Historical cost captured
      expect(sale.items[0].costPrice).toBe(90);

      // Check authoritative stock ledger & cached stock
      const product = await productService.getProductById(riceProductId);
      expect(product?.currentStock).toBe(48.5);

      const latestMovement = await prisma.stockLedger.findFirst({
        where: { productId: riceProductId, transactionType: 'SALE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(latestMovement).toBeDefined();
      expect(Number(latestMovement?.quantityChange)).toBe(-1.5);
      expect(Number(latestMovement?.balanceAfter)).toBe(48.5);
    });

    it('2. Sells 100 g Basmati Rice: Auto-normalizes to 0.1 kg, Total = ₹12, Stock: 48.5 kg -> 48.4 kg', async () => {
      const sale = await saleService.createSale(
        {
          items: [
            {
              productId: riceProductId,
              quantity: 100,
              sellingPrice: 120,
              discount: 0,
              taxRate: 0,
              unitCode: 'G', // Customer buys in grams
            },
          ],
          discount: 0,
          paymentMethod: 'CASH',
          paidAmount: 12,
        },
        adminUserId
      );

      expect(sale.total).toBe(12);
      expect(sale.items[0].quantity).toBe(0.1); // Normalized to base unit KG
      expect(sale.items[0].lineTotal).toBe(12);

      const product = await productService.getProductById(riceProductId);
      expect(product?.currentStock).toBe(48.4);
    });

    it('3. Rejects decimal quantity for COUNT product (Pen)', async () => {
      await expect(
        saleService.createSale(
          {
            items: [
              {
                productId: penProductId,
                quantity: 1.5,
                sellingPrice: 10,
                unitCode: 'PCS',
              },
            ],
            paymentMethod: 'CASH',
            paidAmount: 15,
          },
          adminUserId
        )
      ).rejects.toThrow(/fractional/i);

      // Current stock must remain unaffected
      const pen = await productService.getProductById(penProductId);
      expect(pen?.currentStock).toBe(100);
    });

    it('4. Rejects overselling when insufficient stock under BLOCK policy', async () => {
      // Current stock is 48.4 kg. Try to sell 50 kg.
      await expect(
        saleService.createSale(
          {
            items: [
              {
                productId: riceProductId,
                quantity: 50,
                sellingPrice: 120,
                unitCode: 'KG',
              },
            ],
            paymentMethod: 'CASH',
            paidAmount: 6000,
          },
          adminUserId
        )
      ).rejects.toThrow(/insufficient stock/i);

      // Stock must never have gone negative
      const product = await productService.getProductById(riceProductId);
      expect(product?.currentStock).toBe(48.4);
    });
  });

  // ==========================================================================
  // SECTION 3: PURCHASES & SUPPLIER BALANCES
  // ==========================================================================
  describe('3. Purchases with Decimal Quantities', () => {
    it('1. Purchases 100.5 kg Rice at ₹85/kg: Stock increases by 100.5 kg', async () => {
      const initialStock = (await productService.getProductById(riceProductId))?.currentStock || 0;

      const purchase = await purchaseService.createPurchase(
        {
          supplierId,
          items: [
            {
              productId: riceProductId,
              quantity: 100.5,
              purchasePrice: 85,
              unitCode: 'KG',
              taxRate: 0,
            },
          ],
          discount: 0,
          paidAmount: 0,
          paymentMethod: 'CASH',
        },
        adminUserId
      );

      const expectedTotal = roundMoney(100.5 * 85); // 8542.50
      expect(purchase.total).toBe(expectedTotal);

      // Check stock increase
      const updatedProduct = await productService.getProductById(riceProductId);
      expect(updatedProduct?.currentStock).toBe(roundQuantity(initialStock + 100.5, 4));

      // Check authoritative stock ledger
      const movement = await prisma.stockLedger.findFirst({
        where: { productId: riceProductId, transactionType: 'PURCHASE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(movement).toBeDefined();
      expect(Number(movement?.quantityChange)).toBe(100.5);
    });
  });

  // ==========================================================================
  // SECTION 4: SALES RETURNS WITH DECIMAL QUANTITIES
  // ==========================================================================
  describe('4. Sales Returns with Decimal Quantities', () => {
    it('1. Partial return of decimal quantity works and increases stock', async () => {
      // First make a sale of 2.5 Ltr Milk
      const sale = await saleService.createSale(
        {
          items: [
            {
              productId: milkProductId,
              quantity: 2.5,
              sellingPrice: 65,
              unitCode: 'LTR',
            },
          ],
          paymentMethod: 'CASH',
          paidAmount: roundMoney(2.5 * 65), // 162.50
        },
        adminUserId
      );

      const stockAfterSale = (await productService.getProductById(milkProductId))?.currentStock || 0;
      const saleItemId = sale.items[0].id;

      // Customer returns 0.75 Ltr
      const sReturn = await salesReturnService.createSalesReturn(
        {
          saleId: sale.id,
          refundType: 'CASH_REFUND',
          items: [
            {
              productId: milkProductId,
              saleItemId,
              quantity: 0.75,
              reason: 'Excess milk',
            },
          ],
        },
        adminUserId
      );

      expect(sReturn.status).toBe('POSTED');
      expect(sReturn.totalAmount).toBe(roundMoney(0.75 * 65)); // 48.75

      // Stock should increase by 0.75
      const stockAfterReturn = (await productService.getProductById(milkProductId))?.currentStock || 0;
      expect(stockAfterReturn).toBe(roundQuantity(stockAfterSale + 0.75, 4));

      // Attempt to return more than remaining sold quantity (2.5 - 0.75 = 1.75 remaining. Try returning 2.0)
      await expect(
        salesReturnService.createSalesReturn(
          {
            saleId: sale.id,
            refundType: 'CASH_REFUND',
            items: [
              {
                productId: milkProductId,
                saleItemId,
                quantity: 2.0,
              },
            ],
          },
          adminUserId
        )
      ).rejects.toThrow(/Cannot return more than available quantity|exceeds remaining returnable/i);
    });
  });

  // ==========================================================================
  // SECTION 5: SELL BY AMOUNT (₹ BUDGET SELLING)
  // ==========================================================================
  describe('5. Sell By Amount (₹ Budget Selling)', () => {
    it('1. Customer wants ₹100 ka rice at ₹120/kg: calculates 0.833 kg deterministically', () => {
      const calculatedQty = calculateSellByAmount(100, 120, 3);
      expect(calculatedQty).toBe(0.833);

      const lineTotal = roundMoney(calculatedQty * 120);
      expect(lineTotal).toBe(99.96); // Exactly 0.833 * 120
    });

    it('2. Sells by amount and deducts calculated stock accurately', async () => {
      const initialStock = (await productService.getProductById(riceProductId))?.currentStock || 0;
      const qty = calculateSellByAmount(60, 120, 3); // exactly 0.500 kg

      const sale = await saleService.createSale(
        {
          items: [
            {
              productId: riceProductId,
              quantity: qty,
              sellingPrice: 120,
              unitCode: 'KG',
            },
          ],
          paymentMethod: 'CASH',
          paidAmount: 60,
        },
        adminUserId
      );

      expect(sale.total).toBe(60);
      const stockAfter = (await productService.getProductById(riceProductId))?.currentStock || 0;
      expect(stockAfter).toBe(roundQuantity(initialStock - 0.5, 4));
    });
  });

  // ==========================================================================
  // SECTION 6: PRODUCT UNIT IMMUTABILITY
  // ==========================================================================
  describe('6. Product Unit Immutability after Transactions Exist', () => {
    it('1. Prevents changing unit from KG to PCS when transaction history exists', async () => {
      // Rice already has sales and purchases in KG
      await expect(
        productService.updateProduct(
          riceProductId,
          {
            unitId: unitPcsId, // Attempt to switch unit to PCS
          },
          adminUserId
        )
      ).rejects.toThrow(/Cannot change unit.*historical/i);

      // Verify product unit is unchanged
      const rice = await productService.getProductById(riceProductId);
      expect(rice?.unitId).toBe(unitKgId);
    });

    it('2. Allows changing unit when no transactions exist for a product', async () => {
      // Create a fresh un-transacted product
      const freshProd = await productService.createProduct(
        {
          name: 'Organic Wheat Flour',
          sku: 'FLOUR-01',
          unitId: unitKgId,
          purchasePrice: 40,
          salePrice: 55,
          openingStock: 0,
        },
        adminUserId
      );

      // Updating unit to Grams should succeed because 0 movements exist
      const updated = await productService.updateProduct(
        freshProd.product.id,
        {
          unitId: unitGId,
        },
        adminUserId
      );
      expect(updated.unitId).toBe(unitGId);
    });
  });

  // ==========================================================================
  // SECTION 7: WEIGHING SCALE BARCODE & FORMATTING
  // ==========================================================================
  describe('7. Weighing Scale Barcode Parser & Formatting', () => {
    it('1. Parses scale barcode with weight correctly', () => {
      // Barcode: 20 + 01234 (item code) + 01500 (1.500 kg) + 0
      const parsed = parseScaleBarcode('2001234015000', {
        enabled: true,
        prefix: '20',
        embeddedValue: 'WEIGHT',
        pluDigits: 5,
        digitsToSkip: 0,
        valueDigits: 5,
        valueDecimals: 3,
      });

      expect(parsed.valid).toBe(true);
      expect(parsed.plu).toBe('01234');
      expect(parsed.value).toBe(1.5);
      expect(parsed.embeddedValue).toBe('WEIGHT');
    });

    it('2. Formats quantities and unit prices without ugly floating point decimals', () => {
      expect(formatQuantity(1.5, 'KG')).toBe('1.5 KG');
      expect(formatQuantity(0.25, 'KG')).toBe('0.25 KG');
      expect(formatQuantity(2, 'PCS')).toBe('2 PCS');
      expect(formatUnitPrice(120, 'KG', '₹')).toBe('₹120.00 / KG');
      expect(formatUnitPrice(10, 'PCS', '₹')).toBe('₹10.00 / PCS');
    });

    it('3. Generates receipt HTML displaying unit price per unit and exact quantity', async () => {
      // Build invoice document from real sale
      const sale = await saleService.createSale(
        {
          items: [
            {
              productId: riceProductId,
              quantity: 1.5,
              sellingPrice: 120,
              unitCode: 'KG',
            },
          ],
          paymentMethod: 'CASH',
          paidAmount: 180,
        },
        adminUserId
      );

      const invoiceDoc = await invoiceDataService.getSaleInvoiceDocument(sale.id);
      expect(invoiceDoc).toBeDefined();

      const html = renderInvoiceHtml(invoiceDoc!, 'THERMAL_80MM');

      // Verify receipt contains unit badges and formatted rate
      expect(html).toContain('1.5 KG');
      expect(html).toContain('/KG');
    });
  });

  // ==========================================================================
  // SECTION 8: CONCURRENCY & OVERSELLING INTEGRITY
  // ==========================================================================
  describe('8. Concurrency & Overselling Integrity', () => {
    it('1. Two concurrent sales competing for limited stock cannot oversell', async () => {
      // Create a test product with exactly 1.000 kg stock
      const limitedRice = await productService.createProduct(
        {
          name: 'Limited Sona Masoori Rice',
          sku: 'RICE-LTD-1KG',
          unitId: unitKgId,
          purchasePrice: 80,
          salePrice: 100,
          openingStock: 1.0,
          reorderLevel: 0.5,
        },
        adminUserId
      );

      // Fire two simultaneous sales each requesting 0.750 kg (Total = 1.500 kg > 1.000 kg available)
      const results = await Promise.allSettled([
        saleService.createSale(
          {
            items: [{ productId: limitedRice.product.id, quantity: 0.75, sellingPrice: 100, unitCode: 'KG' }],
            paymentMethod: 'CASH',
            paidAmount: 75,
          },
          adminUserId
        ),
        saleService.createSale(
          {
            items: [{ productId: limitedRice.product.id, quantity: 0.75, sellingPrice: 100, unitCode: 'KG' }],
            paymentMethod: 'CASH',
            paidAmount: 75,
          },
          adminUserId
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one sale must succeed, one must fail due to insufficient stock
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Final stock must be exactly 0.250 kg — NEVER negative
      const finalProduct = await productService.getProductById(limitedRice.product.id);
      expect(finalProduct?.currentStock).toBe(0.25);
    });
  });
});
