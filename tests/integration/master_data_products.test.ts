import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { authService } from '../../src/main/modules/auth/auth.service';
import { dispatchFastify } from '../../src/main/fastify/server';

describe('Phase 4: Master Data (Products, Categories, Brands & Units) Test Suite', () => {
  const prisma = getPrismaClient();
  let adminId: string;
  let adminToken: string;
  let testCategoryId: string;
  let testBrandId: string;
  let testUnitId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean up master data test records
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
    await prisma.stockAdjustment.deleteMany({});
    await prisma.stockLedger.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.salePayment.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // Setup an admin user and session
    const adminUser = await prisma.user.create({
      data: {
        username: 'master_admin',
        passwordHash: 'dummyHash',
        fullName: 'Master Data Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminId = adminUser.id;

    const session = await authService.login({
      username: 'master_admin',
      password: 'Any', // Bypass hash in unit session creation or create session directly
    });

    // Create valid session token
    const activeSession = (await import('../../src/main/modules/auth/session.manager')).sessionManager.createSession({
      id: adminUser.id,
      username: adminUser.username,
      fullName: adminUser.fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: adminUser.createdAt.toISOString(),
    });
    adminToken = activeSession.token;

    // Seed default Unit
    const unit = await categoryBrandUnitService.createUnit({
      name: 'Test Pieces',
      shortCode: 'TPCS',
      allowDecimal: false,
    });
    testUnitId = unit.id;

    // Seed default Category
    const cat = await categoryBrandUnitService.createCategory({
      name: 'Beverages',
      description: 'Cold and hot drinks',
    });
    testCategoryId = cat.id;

    // Seed default Brand
    const brand = await categoryBrandUnitService.createBrand({
      name: 'PepsiCo',
    });
    testBrandId = brand.id;
  });

  // --------------------------------------------------------------------------
  // CATEGORIES, BRANDS, UNITS TESTS
  // --------------------------------------------------------------------------

  it('1. Category creation, deactivation and update', async () => {
    const cat = await categoryBrandUnitService.createCategory({
      name: 'Snacks & Biscuits',
      description: 'Crunchy food items',
    });
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe('Snacks & Biscuits');

    // Update
    const updated = await categoryBrandUnitService.updateCategory(cat.id, {
      description: 'Updated description',
      status: 'INACTIVE',
    });
    expect(updated.description).toBe('Updated description');
    expect(updated.status).toBe('INACTIVE');
  });

  it('2. Category deletion protection when referenced by a product', async () => {
    // Create product referencing testCategoryId
    const prodRes = await productService.createProduct({
      name: 'Category Protection Product',
      sku: 'CAT_PROT_001',
      unitId: testUnitId,
      categoryId: testCategoryId,
      purchasePrice: 10,
      salePrice: 15,
      openingStock: 0,
      reorderLevel: 5,
    });

    // Deleting category must be rejected
    await expect(categoryBrandUnitService.deleteCategory(testCategoryId)).rejects.toThrow(
      /Cannot delete category: 1 product\(s\) are currently assigned/
    );

    // Clean up test product
    await prisma.product.delete({ where: { id: prodRes.product.id } });
  });

  it('3. Brand creation, deactivation and delete protection', async () => {
    const brand = await categoryBrandUnitService.createBrand({ name: 'CocaCola' });
    expect(brand.id).toBeDefined();

    const prodRes = await productService.createProduct({
      name: 'Brand Protection Product',
      sku: 'BRAND_PROT_001',
      unitId: testUnitId,
      brandId: brand.id,
      purchasePrice: 20,
      salePrice: 25,
      openingStock: 0,
      reorderLevel: 5,
    });

    // Delete rejected
    await expect(categoryBrandUnitService.deleteBrand(brand.id)).rejects.toThrow(
      /Cannot delete brand: 1 product\(s\) are currently assigned/
    );

    // Clean up
    await prisma.product.delete({ where: { id: prodRes.product.id } });
    const deleted = await categoryBrandUnitService.deleteBrand(brand.id);
    expect(deleted.success).toBe(true);
  });

  it('4. Unit creation, allowDecimal flag and delete protection', async () => {
    const kgUnit = await categoryBrandUnitService.createUnit({
      name: 'Kilogram',
      shortCode: 'KG',
      allowDecimal: true,
    });
    expect(kgUnit.allowDecimal).toBe(true);

    const prod = await productService.createProduct({
      name: 'Unit Protection Sugar',
      sku: 'UNIT_PROT_001',
      unitId: kgUnit.id,
      purchasePrice: 40,
      salePrice: 45,
      openingStock: 0,
      reorderLevel: 10,
    });

    await expect(categoryBrandUnitService.deleteUnit(kgUnit.id)).rejects.toThrow(
      /Cannot delete unit: 1 product\(s\) are currently assigned/
    );

    await prisma.product.delete({ where: { id: prod.product.id } });
  });

  // --------------------------------------------------------------------------
  // PRODUCT VALIDATION TESTS
  // --------------------------------------------------------------------------

  it('5. Product creation validation: price, tax, reorder level, unit', async () => {
    // Negative price
    await expect(
      productService.createProduct({
        name: 'Invalid Price',
        sku: 'INV_PRICE',
        unitId: testUnitId,
        purchasePrice: -5,
        salePrice: 10,
      })
    ).rejects.toThrow(/must be positive or zero/);

    // Negative tax rate
    await expect(
      productService.createProduct({
        name: 'Invalid Tax',
        sku: 'INV_TAX',
        unitId: testUnitId,
        purchasePrice: 10,
        salePrice: 15,
        taxRate: -1,
      })
    ).rejects.toThrow(/cannot be negative/);

    // Invalid unit (non-existent UUID)
    await expect(
      productService.createProduct({
        name: 'Invalid Unit',
        sku: 'INV_UNIT',
        unitId: '00000000-0000-0000-0000-000000000099',
        purchasePrice: 10,
        salePrice: 15,
      })
    ).rejects.toThrow(/does not exist/);
  });

  // --------------------------------------------------------------------------
  // PRODUCT CORE BUSINESS RULES
  // --------------------------------------------------------------------------

  it('6. Product creation with atomic opening stock & stock ledger entry', async () => {
    const result = await productService.createProduct({
      name: 'Basmati Rice 5kg',
      sku: 'RICE_BAS_001',
      barcode: '8901000111222',
      unitId: testUnitId,
      categoryId: testCategoryId,
      brandId: testBrandId,
      purchasePrice: 350,
      salePrice: 420,
      taxRate: 5,
      openingStock: 25,
      reorderLevel: 5,
    });

    expect(result.product.id).toBeDefined();
    expect(result.product.currentStock).toBe(25);

    // Verify stock_ledger entry was created atomically
    const ledger = await prisma.stockLedger.findFirst({
      where: { productId: result.product.id, transactionType: 'OPENING' },
    });
    expect(ledger).toBeDefined();
    expect(Number(ledger?.quantityChange)).toBe(25);
    expect(Number(ledger?.balanceAfter)).toBe(25);
  });

  it('7. Duplicate SKU rejection at database level', async () => {
    await expect(
      productService.createProduct({
        name: 'Duplicate SKU Item',
        sku: 'RICE_BAS_001', // Already exists!
        unitId: testUnitId,
        purchasePrice: 100,
        salePrice: 120,
      })
    ).rejects.toThrow(/already exists. SKU must be unique/);
  });

  it('8. Duplicate Barcode rejection at database level', async () => {
    await expect(
      productService.createProduct({
        name: 'Duplicate Barcode Item',
        sku: 'NEW_SKU_UNIQUE_01',
        barcode: '8901000111222', // Already assigned to Basmati Rice!
        unitId: testUnitId,
        purchasePrice: 100,
        salePrice: 120,
      })
    ).rejects.toThrow(/already exists. Barcode must be unique/);
  });

  it('9. Null and empty barcode allowed for multiple products', async () => {
    const p1 = await productService.createProduct({
      name: 'Loose Vegetable A',
      sku: 'LOOSE_VEG_A',
      barcode: '', // empty string transforms to null
      unitId: testUnitId,
      purchasePrice: 10,
      salePrice: 15,
    });

    const p2 = await productService.createProduct({
      name: 'Loose Vegetable B',
      sku: 'LOOSE_VEG_B',
      barcode: null, // explicit null
      unitId: testUnitId,
      purchasePrice: 12,
      salePrice: 18,
    });

    expect(p1.product.barcode).toBeNull();
    expect(p2.product.barcode).toBeNull();
  });

  it('10. Duplicate Product-Name Warning (Non-blocking as required by PRD)', async () => {
    // Create first item "Fresh Apple"
    await productService.createProduct({
      name: 'Fresh Apple',
      sku: 'APPLE_001',
      unitId: testUnitId,
      purchasePrice: 80,
      salePrice: 120,
    });

    // Create second item with identical name "Fresh Apple"
    const second = await productService.createProduct({
      name: 'Fresh Apple',
      sku: 'APPLE_002', // Unique SKU
      unitId: testUnitId,
      purchasePrice: 85,
      salePrice: 130,
    });

    // Product is created, but duplicateNameWarning is populated
    expect(second.product.id).toBeDefined();
    expect(second.duplicateNameWarning).toContain('already exists');
  });

  it('11. Product Search by Name, SKU, and Barcode', async () => {
    // Search by Name
    const nameSearch = await productService.listProducts({ search: 'Basmati', page: 1, pageSize: 10 });
    expect(nameSearch.data.length).toBeGreaterThanOrEqual(1);
    expect(nameSearch.data[0].name).toContain('Basmati Rice');

    // Search by SKU
    const skuSearch = await productService.listProducts({ search: 'RICE_BAS', page: 1, pageSize: 10 });
    expect(skuSearch.data.length).toBeGreaterThanOrEqual(1);

    // Search by Barcode
    const barcodeSearch = await productService.getProductByBarcode('8901000111222');
    expect(barcodeSearch).toBeDefined();
    expect(barcodeSearch?.name).toBe('Basmati Rice 5kg');
  });

  it('12. Deletion Protection: Product with transaction history must be soft-deactivated', async () => {
    // Create product
    const prodRes = await productService.createProduct({
      name: 'Tea Pack 250g',
      sku: 'TEA_250G',
      unitId: testUnitId,
      purchasePrice: 90,
      salePrice: 110,
      openingStock: 10, // Creates stock_ledger transaction history!
    });
    const productId = prodRes.product.id;

    // Attempt deletion
    const deleteResult = await productService.deleteOrDeactivateProduct(productId, adminId);

    // Assert: Hard delete is blocked; product is deactivated instead
    expect(deleteResult.action).toBe('DEACTIVATED');
    expect(deleteResult.message).toContain('deactivated instead');

    // Verify product still exists in DB as INACTIVE
    const dbProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(dbProduct).toBeDefined();
    expect(dbProduct?.status).toBe('INACTIVE');
  });

  it('13. Inactive product cannot be sold in new POS sale', async () => {
    const inactiveProd = await prisma.product.findFirst({ where: { status: 'INACTIVE' } });
    expect(inactiveProd).toBeDefined();

    // Attempt sale of inactive product
    await expect(
      saleService.createSale({
        items: [{ productId: inactiveProd!.id, quantity: 1, sellingPrice: 100 }],
        paidAmount: 100,
        paymentMethod: 'CASH',
      })
    ).rejects.toThrow(/is inactive and cannot be sold/);
  });

  it('14. Product Price Change preserves historical sale costPrice', async () => {
    // Create product
    const p = await productService.createProduct({
      name: 'Sunflower Oil 1L',
      sku: 'OIL_SUN_1L',
      unitId: testUnitId,
      purchasePrice: 120,
      salePrice: 150,
      openingStock: 20,
    });

    // Make a POS Sale at cost 120, sell 150
    const sale = await saleService.createSale({
      items: [{ productId: p.product.id, quantity: 2, sellingPrice: 150 }],
      paidAmount: 300,
      paymentMethod: 'CASH',
    });

    const historicalCostBefore = Number(sale.items[0].costPrice);
    expect(historicalCostBefore).toBe(120);

    // Update product prices in master catalog
    await productService.updateProduct(p.product.id, {
      purchasePrice: 140, // Increased cost
      salePrice: 180,     // Increased sell
    });

    // Re-verify the historical sale record
    const saleRecord = await saleService.getSaleById(sale.id);
    expect(Number(saleRecord?.items[0].costPrice)).toBe(120); // Historical cost unchanged!
  });

  it('15. Concurrent duplicate SKU creation safety', async () => {
    const duplicateSku = 'CONCURRENT_RACE_SKU';

    const req1 = productService.createProduct({
      name: 'Race 1',
      sku: duplicateSku,
      unitId: testUnitId,
      purchasePrice: 50,
      salePrice: 70,
    });

    const req2 = productService.createProduct({
      name: 'Race 2',
      sku: duplicateSku,
      unitId: testUnitId,
      purchasePrice: 50,
      salePrice: 70,
    });

    // Exactly one should succeed, the other must be cleanly rejected by DB unique constraint
    const outcomes = await Promise.allSettled([req1, req2]);
    const succeeded = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it('16. Fastify Route: Product CRUD & Permissions Check', async () => {
    // List products via Fastify route
    const listRes = await dispatchFastify('GET', '/api/products?page=1&pageSize=5');
    expect(listRes.data).toBeDefined();
    expect(Array.isArray(listRes.data)).toBe(true);

    // Create product via Fastify route without token -> 400/Unauthorized
    const unauthRes = await dispatchFastify('POST', '/api/products', {
      name: 'Unauth Prod',
      sku: 'UNAUTH_001',
      unitId: testUnitId,
      purchasePrice: 10,
      salePrice: 20,
    });
    expect(unauthRes.error).toContain('Authentication required');

    // Create product via Fastify route with admin token -> 200 Success
    const authRes = await dispatchFastify(
      'POST',
      '/api/products',
      {
        name: 'Fastify Route Product',
        sku: 'FASTIFY_PROD_001',
        unitId: testUnitId,
        purchasePrice: 50,
        salePrice: 75,
      },
      { authorization: adminToken }
    );
    expect(authRes.product).toBeDefined();
    expect(authRes.product.sku).toBe('FASTIFY_PROD_001');
  });

  it('17. Product status toggle via Fastify update (ACTIVE <-> INACTIVE)', async () => {
    // Create product
    const created = await productService.createProduct(
      {
        name: 'Toggle Status Product',
        sku: 'TOGGLE_001',
        unitId: testUnitId,
        purchasePrice: 10,
        salePrice: 15,
      },
      adminId
    );
    expect(created.product.status).toBe('ACTIVE');

    // Deactivate via Fastify PUT
    const deactivated = await dispatchFastify(
      'PUT',
      `/api/products/${created.product.id}`,
      { status: 'INACTIVE' },
      { authorization: adminToken }
    );
    expect(deactivated.status).toBe('INACTIVE');

    // Reactivate via Fastify PUT
    const reactivated = await dispatchFastify(
      'PUT',
      `/api/products/${created.product.id}`,
      { status: 'ACTIVE' },
      { authorization: adminToken }
    );
    expect(reactivated.status).toBe('ACTIVE');
  });

  it('18. Category, Brand, Unit list methods return computed productCount', async () => {
    const cats = await categoryBrandUnitService.listCategories(true);
    expect(Array.isArray(cats)).toBe(true);
    const beverageCat = cats.find((c) => c.id === testCategoryId);
    expect(beverageCat).toBeDefined();
    expect(typeof beverageCat?.productCount).toBe('number');
    expect(beverageCat!.productCount).toBeGreaterThanOrEqual(1);

    const units = await categoryBrandUnitService.listUnits(true);
    expect(Array.isArray(units)).toBe(true);
    const testUnit = units.find((u) => u.id === testUnitId);
    expect(testUnit).toBeDefined();
    expect(typeof testUnit?.productCount).toBe('number');
  });
});

