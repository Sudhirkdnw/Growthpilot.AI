import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { productService } from '../../src/main/modules/products/product.service';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';

describe('RS Inventory Solo — Smart Add Product UX & Automation Suite', () => {
  const prisma = getPrismaClient();
  let defaultUnitId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Ensure default Unit exists
    let unit = await prisma.unit.findFirst({ where: { shortCode: 'PCS' } });
    if (!unit) {
      unit = await categoryBrandUnitService.createUnit({
        name: 'Pieces',
        shortCode: 'PCS',
        allowDecimal: false,
      });
    }
    defaultUnitId = unit.id;
  });

  it('1. Quick Add with minimum fields: Name, Sale Price, Unit (SKU auto-generated)', async () => {
    const res = await productService.createProduct({
      name: 'Smart Quick Add Test Item',
      salePrice: 45.0,
      unitId: defaultUnitId,
    });

    expect(res.product).toBeDefined();
    expect(res.product.name).toBe('Smart Quick Add Test Item');
    expect(res.product.salePrice).toBe(45.0);
    expect(res.product.purchasePrice).toBe(0);
    expect(res.product.openingStock).toBe(0);
    expect(res.product.status).toBe('ACTIVE');
    // SKU must be auto-generated with prefix
    expect(res.product.sku).toMatch(/^SKU-\d+$/);
  });

  it('2. Auto-generated SKU sequence increments on subsequent saves', async () => {
    const p1 = await productService.createProduct({
      name: 'Auto SKU Item 1',
      salePrice: 10.0,
      unitId: defaultUnitId,
    });

    const p2 = await productService.createProduct({
      name: 'Auto SKU Item 2',
      salePrice: 20.0,
      unitId: defaultUnitId,
    });

    expect(p1.product.sku).toBeDefined();
    expect(p2.product.sku).toBeDefined();
    expect(p1.product.sku).not.toBe(p2.product.sku);
  });

  it('3. In-Store Barcode Generation produces valid 13-digit EAN format', async () => {
    const barcode1 = productService.generateInStoreBarcode('21');
    const barcode2 = productService.generateInStoreBarcode('21');

    expect(barcode1).toHaveLength(13);
    expect(barcode1.startsWith('21')).toBe(true);
    expect(barcode2).toHaveLength(13);
    expect(barcode1).not.toBe(barcode2);
  });

  it('4. Duplicate product name returns non-blocking warning', async () => {
    const uniqueName = `Duplicate Test Item ${Date.now()}`;
    await productService.createProduct({
      name: uniqueName,
      salePrice: 99.0,
      unitId: defaultUnitId,
    });

    const check = await productService.checkDuplicateName(uniqueName);
    expect(check.hasDuplicate).toBe(true);
    expect(check.similarName).toBe(uniqueName);

    // Creating again should succeed but flag duplicateNameWarning
    const duplicateCreation = await productService.createProduct({
      name: uniqueName,
      salePrice: 105.0,
      unitId: defaultUnitId,
    });
    expect(duplicateCreation.product).toBeDefined();
    expect(duplicateCreation.duplicateNameWarning).toBeDefined();
  });

  it('5. Opening stock > 0 atomically generates OPENING ledger movement', async () => {
    const res = await productService.createProduct({
      name: 'Stocked Product Test',
      salePrice: 150.0,
      purchasePrice: 100.0,
      openingStock: 25,
      unitId: defaultUnitId,
    });

    expect(res.product.currentStock).toBe(25);

    const ledgerEntries = await prisma.stockLedger.findMany({
      where: { productId: res.product.id, transactionType: 'OPENING' },
    });

    expect(ledgerEntries).toHaveLength(1);
    expect(Number(ledgerEntries[0].quantityChange)).toBe(25);
    expect(Number(ledgerEntries[0].balanceAfter)).toBe(25);
  });

  it('6. Allows optional Category and Brand (null relations allowed)', async () => {
    const res = await productService.createProduct({
      name: 'Uncategorized Brandless Item',
      salePrice: 30.0,
      unitId: defaultUnitId,
      categoryId: null,
      brandId: null,
    });

    expect(res.product.categoryId).toBeNull();
    expect(res.product.brandId).toBeNull();
  });
});
