import { describe, it, expect, beforeAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { categoryBrandUnitService } from '../../src/main/modules/products/category-brand-unit.service';
import { productService } from '../../src/main/modules/products/product.service';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { purchaseService } from '../../src/main/modules/purchases/purchase.service';
import { salesReturnService } from '../../src/main/modules/returns/sales-return.service';
import { inventoryReportService } from '../../src/main/modules/reports/inventory-report.service';
import { salesReportService } from '../../src/main/modules/reports/sales-report.service';
import { roundMoney, roundQuantity } from '../../src/shared/utils/quantity';

describe('Mixed General Retail / Multi-Category Product System - Real End-to-End Suite', () => {
  const prisma = getPrismaClient();

  let adminUserId: string;
  let unitKgId: string;
  let unitGId: string;
  let unitLtrId: string;
  let unitPcsId: string;
  let unitMtrId: string;

  let catGroceryId: string;
  let catStationeryId: string;
  let catToysId: string;
  let catPersonalCareId: string;
  let catHouseholdId: string;
  let catElectricalId: string;
  let catCleaningId: string;
  let catSnacksId: string;
  let catBeveragesId: string;
  let catPackagedFoodId: string;

  let subcatRiceGrainsId: string;
  let subcatSugarSaltId: string;
  let subcatPensPencilsId: string;
  let subcatVehiclesId: string;
  let subcatSoapsId: string;
  let subcatOilId: string;
  let subcatWiringId: string;

  let prodRiceLooseId: string;
  let prodSugarLooseId: string;
  let prodBallPenId: string;
  let prodToyCarId: string;
  let prodBathSoapId: string;
  let prodOilLooseId: string;
  let prodWireLooseId: string;
  let prodRicePackId: string;

  let testCustomerId: string;
  let testSupplierId: string;
  let saleId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Clean tables in foreign key order
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
    await prisma.subcategory.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Create Admin User
    const admin = await prisma.user.create({
      data: {
        username: 'mixed_store_admin',
        passwordHash: 'dummyHash',
        fullName: 'Mixed Retail Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminUserId = admin.id;

    // 2. Create Units
    const uKg = await categoryBrandUnitService.createUnit(
      { name: 'Kilogram', shortCode: 'KG', category: 'WEIGHT', allowDecimal: true, precision: 3, conversionFactor: 1, baseUnitCode: 'KG' },
      adminUserId
    );
    unitKgId = uKg.id;

    const uG = await categoryBrandUnitService.createUnit(
      { name: 'Gram', shortCode: 'G', category: 'WEIGHT', allowDecimal: true, precision: 3, conversionFactor: 0.001, baseUnitCode: 'KG' },
      adminUserId
    );
    unitGId = uG.id;

    const uLtr = await categoryBrandUnitService.createUnit(
      { name: 'Liter', shortCode: 'LTR', category: 'VOLUME', allowDecimal: true, precision: 3, conversionFactor: 1, baseUnitCode: 'LTR' },
      adminUserId
    );
    unitLtrId = uLtr.id;

    const uPcs = await categoryBrandUnitService.createUnit(
      { name: 'Piece', shortCode: 'PCS', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 1, baseUnitCode: 'PCS' },
      adminUserId
    );
    unitPcsId = uPcs.id;

    const uMtr = await categoryBrandUnitService.createUnit(
      { name: 'Meter', shortCode: 'MTR', category: 'LENGTH', allowDecimal: true, precision: 2, conversionFactor: 1, baseUnitCode: 'MTR' },
      adminUserId
    );
    unitMtrId = uMtr.id;

    // 3. Create Categories
    const catGrocery = await categoryBrandUnitService.createCategory({ name: 'Grocery', description: 'Grocery Staples' }, adminUserId);
    catGroceryId = catGrocery.id;

    const catStationery = await categoryBrandUnitService.createCategory({ name: 'Stationery', description: 'Stationery & Pens' }, adminUserId);
    catStationeryId = catStationery.id;

    const catToys = await categoryBrandUnitService.createCategory({ name: 'Toys', description: 'Toys & Games' }, adminUserId);
    catToysId = catToys.id;

    const catPersonalCare = await categoryBrandUnitService.createCategory({ name: 'Personal Care', description: 'Hygiene & Soaps' }, adminUserId);
    catPersonalCareId = catPersonalCare.id;

    const catHousehold = await categoryBrandUnitService.createCategory({ name: 'Household', description: 'Buckets & Houseware' }, adminUserId);
    catHouseholdId = catHousehold.id;

    const catElectrical = await categoryBrandUnitService.createCategory({ name: 'Electrical', description: 'Cables & Lighting' }, adminUserId);
    catElectricalId = catElectrical.id;

    const catCleaning = await categoryBrandUnitService.createCategory({ name: 'Cleaning', description: 'Cleaning Supplies' }, adminUserId);
    catCleaningId = catCleaning.id;

    const catSnacks = await categoryBrandUnitService.createCategory({ name: 'Snacks', description: 'Snacks & Biscuits' }, adminUserId);
    catSnacksId = catSnacks.id;

    const catBeverages = await categoryBrandUnitService.createCategory({ name: 'Beverages', description: 'Drinks & Juices' }, adminUserId);
    catBeveragesId = catBeverages.id;

    const catPackagedFood = await categoryBrandUnitService.createCategory({ name: 'Packaged Food', description: 'Packaged Staples' }, adminUserId);
    catPackagedFoodId = catPackagedFoodId = catPackagedFood.id;

    // 4. Create Subcategories
    const subRice = await categoryBrandUnitService.createSubcategory({ categoryId: catGroceryId, name: 'Rice & Grains' }, adminUserId);
    subcatRiceGrainsId = subRice.id;

    const subSugar = await categoryBrandUnitService.createSubcategory({ categoryId: catGroceryId, name: 'Sugar & Salt' }, adminUserId);
    subcatSugarSaltId = subSugar.id;

    const subOil = await categoryBrandUnitService.createSubcategory({ categoryId: catGroceryId, name: 'Oil' }, adminUserId);
    subcatOilId = subOil.id;

    const subPens = await categoryBrandUnitService.createSubcategory({ categoryId: catStationeryId, name: 'Pens & Pencils' }, adminUserId);
    subcatPensPencilsId = subPens.id;

    const subToys = await categoryBrandUnitService.createSubcategory({ categoryId: catToysId, name: 'Die-cast & Vehicles' }, adminUserId);
    subcatVehiclesId = subToys.id;

    const subSoaps = await categoryBrandUnitService.createSubcategory({ categoryId: catPersonalCareId, name: 'Soaps & Body Wash' }, adminUserId);
    subcatSoapsId = subSoaps.id;

    const subWiring = await categoryBrandUnitService.createSubcategory({ categoryId: catElectricalId, name: 'Wiring & Extension' }, adminUserId);
    subcatWiringId = subWiring.id;

    // 5. Create Brands
    const brandFortune = await categoryBrandUnitService.createBrand({ name: 'Fortune' }, adminUserId);
    const brandCello = await categoryBrandUnitService.createBrand({ name: 'Cello' }, adminUserId);
    const brandHotWheels = await categoryBrandUnitService.createBrand({ name: 'Hot Wheels' }, adminUserId);
    const brandDettol = await categoryBrandUnitService.createBrand({ name: 'Dettol' }, adminUserId);
    const brandGeneric = await categoryBrandUnitService.createBrand({ name: 'Generic / Local' }, adminUserId);

    // 6. Create Customer & Supplier
    const cust = await prisma.customer.create({
      data: {
        name: 'Ramesh Patel',
        phone: '9876543210',
        openingBalance: 0,
        currentBalance: 0,
      },
    });
    testCustomerId = cust.id;

    const supp = await prisma.supplier.create({
      data: {
        name: 'City Wholesale Traders',
        phone: '9822012345',
        openingBalance: 0,
        currentBalance: 0,
      },
    });
    testSupplierId = supp.id;

    // 7. Seed Mixed Store Products
    // 1. Basmati Rice Loose (Grocery, kg, ₹95 cost, ₹120 sale)
    const p1 = await productService.createProduct(
      {
        name: 'Basmati Rice Loose',
        sku: 'SKU-RICE-LOOSE',
        barcode: '890100100001',
        categoryId: catGroceryId,
        subcategoryId: subcatRiceGrainsId,
        brandId: brandGeneric.id,
        unitId: unitKgId,
        purchasePrice: 95.0,
        salePrice: 120.0,
        taxRate: 0,
        openingStock: 100.0,
        reorderLevel: 10.0,
        allowSellByAmount: true,
      },
      adminUserId
    );
    prodRiceLooseId = p1.product.id;

    // 2. Sugar Loose (Grocery, kg, ₹42 cost, ₹50 sale)
    const p2 = await productService.createProduct(
      {
        name: 'Sugar Loose',
        sku: 'SKU-SUGAR-LOOSE',
        barcode: '890100100002',
        categoryId: catGroceryId,
        subcategoryId: subcatSugarSaltId,
        brandId: brandGeneric.id,
        unitId: unitKgId,
        purchasePrice: 42.0,
        salePrice: 50.0,
        taxRate: 0,
        openingStock: 150.0,
        reorderLevel: 20.0,
        allowSellByAmount: true,
      },
      adminUserId
    );
    prodSugarLooseId = p2.product.id;

    // 3. Ball Pen (Stationery, pc, ₹6 cost, ₹10 sale)
    const p3 = await productService.createProduct(
      {
        name: 'Ball Pen',
        sku: 'SKU-BALL-PEN',
        barcode: '890100500001',
        categoryId: catStationeryId,
        subcategoryId: subcatPensPencilsId,
        brandId: brandCello.id,
        unitId: unitPcsId,
        purchasePrice: 6.0,
        salePrice: 10.0,
        taxRate: 12,
        openingStock: 200.0,
        reorderLevel: 25.0,
      },
      adminUserId
    );
    prodBallPenId = p3.product.id;

    // 4. Toy Car (Toys, pc, ₹100 cost, ₹150 sale)
    const p4 = await productService.createProduct(
      {
        name: 'Toy Car',
        sku: 'SKU-TOY-CAR',
        barcode: '890100600001',
        categoryId: catToysId,
        subcategoryId: subcatVehiclesId,
        brandId: brandHotWheels.id,
        unitId: unitPcsId,
        purchasePrice: 100.0,
        salePrice: 150.0,
        taxRate: 18,
        openingStock: 30.0,
        reorderLevel: 5.0,
      },
      adminUserId
    );
    prodToyCarId = p4.product.id;

    // 5. Bath Soap (Personal Care, pc, ₹24 cost, ₹35 sale)
    const p5 = await productService.createProduct(
      {
        name: 'Bath Soap',
        sku: 'SKU-BATH-SOAP',
        barcode: '890100700001',
        categoryId: catPersonalCareId,
        subcategoryId: subcatSoapsId,
        brandId: brandDettol.id,
        unitId: unitPcsId,
        purchasePrice: 24.0,
        salePrice: 35.0,
        taxRate: 18,
        openingStock: 100.0,
        reorderLevel: 15.0,
      },
      adminUserId
    );
    prodBathSoapId = p5.product.id;

    // 6. Cooking Oil Loose (Grocery, ltr, ₹115 cost, ₹140 sale)
    const p6 = await productService.createProduct(
      {
        name: 'Cooking Oil Loose',
        sku: 'SKU-OIL-LOOSE',
        barcode: '890100100005',
        categoryId: catGroceryId,
        subcategoryId: subcatOilId,
        brandId: brandFortune.id,
        unitId: unitLtrId,
        purchasePrice: 115.0,
        salePrice: 140.0,
        taxRate: 5,
        openingStock: 100.0,
        reorderLevel: 15.0,
        allowSellByAmount: true,
      },
      adminUserId
    );
    prodOilLooseId = p6.product.id;

    // 7. Electrical Ribbon Wire (Electrical, mtr, ₹12 cost, ₹20 sale)
    const p7 = await productService.createProduct(
      {
        name: 'Electrical Ribbon Wire',
        sku: 'SKU-ELEC-WIRE',
        barcode: '890101000007',
        categoryId: catElectricalId,
        subcategoryId: subcatWiringId,
        brandId: brandGeneric.id,
        unitId: unitMtrId,
        purchasePrice: 12.0,
        salePrice: 20.0,
        taxRate: 18,
        openingStock: 100.0,
        reorderLevel: 20.0,
        allowSellByAmount: true,
      },
      adminUserId
    );
    prodWireLooseId = p7.product.id;

    // 8. Rice 5kg Pack (Packaged Food, pc, ₹520 cost, ₹650 sale)
    const p8 = await productService.createProduct(
      {
        name: 'Rice 5kg Pack',
        sku: 'SKU-RICE-5KG-PACK',
        barcode: '890100200001',
        categoryId: catPackagedFoodId,
        brandId: brandFortune.id,
        unitId: unitPcsId,
        purchasePrice: 520.0,
        salePrice: 650.0,
        taxRate: 0,
        openingStock: 25.0,
        reorderLevel: 5.0,
      },
      adminUserId
    );
    prodRicePackId = p8.product.id;
  });

  // ==========================================================================
  // SECTION 1: DYNAMIC CATEGORY & SUBCATEGORY CRUD & PROTECTION
  // ==========================================================================
  describe('1. Dynamic Category & Subcategory Architecture', () => {
    it('1.1 Lists categories with subcategories and product counts', async () => {
      const cats = await categoryBrandUnitService.listCategories();
      expect(cats.length).toBeGreaterThanOrEqual(10);

      const grocery = cats.find((c) => c.name === 'Grocery');
      expect(grocery).toBeDefined();
      expect(grocery?.productCount).toBe(3); // Rice Loose, Sugar Loose, Cooking Oil Loose
      expect(grocery?.subcategories?.length).toBe(3); // Rice & Grains, Sugar & Salt, Oil
    });

    it('1.2 Creates, edits, and manages subcategories dynamically', async () => {
      // Create new subcategory
      const sub = await categoryBrandUnitService.createSubcategory(
        { categoryId: catGroceryId, name: 'Spices & Masala', description: 'Whole & ground spices' },
        adminUserId
      );
      expect(sub.id).toBeDefined();
      expect(sub.name).toBe('Spices & Masala');

      // Edit subcategory
      const updated = await categoryBrandUnitService.updateSubcategory(
        sub.id,
        { name: 'Spices & Seasoning', description: 'Updated description' },
        adminUserId
      );
      expect(updated.name).toBe('Spices & Seasoning');

      // Delete unused subcategory
      const del = await categoryBrandUnitService.deleteSubcategory(sub.id, adminUserId);
      expect(del.success).toBe(true);
    });

    it('1.3 Prevents deleting category when products are assigned', async () => {
      await expect(categoryBrandUnitService.deleteCategory(catGroceryId, adminUserId)).rejects.toThrow(
        /Cannot delete category: \d+ product\(s\) are currently assigned/
      );
    });

    it('1.4 Prevents deleting subcategory when products are assigned', async () => {
      await expect(categoryBrandUnitService.deleteSubcategory(subcatRiceGrainsId, adminUserId)).rejects.toThrow(
        /Cannot delete subcategory: \d+ product\(s\) are currently assigned/
      );
    });

    it('1.5 Allows changing a product category without altering stock or historical prices', async () => {
      const before = await productService.getProductById(prodRiceLooseId);
      expect(before?.currentStock).toBe(100);

      // Change category to Household temporarily
      await productService.updateProduct(
        prodRiceLooseId,
        { categoryId: catHouseholdId },
        adminUserId
      );

      const after = await productService.getProductById(prodRiceLooseId);
      expect(after?.categoryId).toBe(catHouseholdId);
      expect(after?.currentStock).toBe(100);
      expect(after?.salePrice).toBe(120);
      expect(after?.sku).toBe(before?.sku);

      // Restore category
      await productService.updateProduct(
        prodRiceLooseId,
        { categoryId: catGroceryId, subcategoryId: subcatRiceGrainsId },
        adminUserId
      );
    });
  });

  // ==========================================================================
  // SECTION 2: GLOBAL SEARCH ACROSS MULTI-CATEGORY FIELDS
  // ==========================================================================
  describe('2. Multi-Category Global Product Search', () => {
    it('2.1 Finds products by category name', async () => {
      const res = await productService.listProducts({ search: 'Stationery' });
      expect(res.data.some((p) => p.name === 'Ball Pen')).toBe(true);
    });

    it('2.2 Finds products by subcategory name', async () => {
      const res = await productService.listProducts({ search: 'Rice & Grains' });
      expect(res.data.some((p) => p.name === 'Basmati Rice Loose')).toBe(true);
    });

    it('2.3 Finds products by brand name', async () => {
      const res = await productService.listProducts({ search: 'Hot Wheels' });
      expect(res.data.some((p) => p.name === 'Toy Car')).toBe(true);
    });

    it('2.4 Finds products by barcode', async () => {
      const p = await productService.getProductByBarcode('890100700001');
      expect(p).not.toBeNull();
      expect(p?.name).toBe('Bath Soap');
    });

    it('2.5 Distinguishes loose products from packaged packs', async () => {
      const loose = await productService.getProductById(prodRiceLooseId);
      const pack = await productService.getProductById(prodRicePackId);

      expect(loose?.unitCode).toBe('KG');
      expect(pack?.unitCode).toBe('PCS');
      expect(loose?.salePrice).toBe(120);
      expect(pack?.salePrice).toBe(650);
    });
  });

  // ==========================================================================
  // SECTION 3: REAL MIXED-STORE SALE (Section 31 & 32)
  // ==========================================================================
  describe('3. Execution of the 6-Item Mixed General Store Sale', () => {
    it('3.1 Executes atomic mixed sale with 6 distinct items', async () => {
      // 1. Basmati Rice Loose: 1.5 kg @ ₹120/kg = ₹180.00
      // 2. Sugar Loose: 250 g (0.25 kg) @ ₹50/kg = ₹12.50
      // 3. Ball Pen: 2 pc @ ₹10/pc = ₹20.00
      // 4. Toy Car: 1 pc @ ₹150/pc = ₹150.00
      // 5. Bath Soap: 2 pc @ ₹35/pc = ₹70.00
      // 6. Cooking Oil Loose: 0.5 l @ ₹140/l = ₹70.00
      // Total Gross: 180 + 12.50 + 20 + 150 + 70 + 70 = ₹502.50
      const sale = await saleService.createSale(
        {
          customerId: testCustomerId,
          items: [
            {
              productId: prodRiceLooseId,
              quantity: 1.5,
              sellingPrice: 120.0,
              unitCode: 'KG',
              taxRate: 0,
            },
            {
              productId: prodSugarLooseId,
              quantity: 250, // 250 g
              sellingPrice: 50.0,
              unitCode: 'G', // Will be converted to 0.25 kg
              taxRate: 0,
            },
            {
              productId: prodBallPenId,
              quantity: 2,
              sellingPrice: 10.0,
              unitCode: 'PCS',
              taxRate: 12,
            },
            {
              productId: prodToyCarId,
              quantity: 1,
              sellingPrice: 150.0,
              unitCode: 'PCS',
              taxRate: 18,
            },
            {
              productId: prodBathSoapId,
              quantity: 2,
              sellingPrice: 35.0,
              unitCode: 'PCS',
              taxRate: 18,
            },
            {
              productId: prodOilLooseId,
              quantity: 0.5,
              sellingPrice: 140.0,
              unitCode: 'LTR',
              taxRate: 5,
            },
          ],
          discount: 0,
          paidAmount: 548.0,
          paymentMethod: 'CASH',
        },
        adminUserId
      );

      saleId = sale.id;

      expect(sale).toBeDefined();
      expect(sale.items.length).toBe(6);
      expect(sale.subtotal).toBe(502.5);
      expect(sale.tax).toBe(45.5);
      expect(sale.total).toBe(548.0);

      // Verify individual items and line totals
      const riceItem = sale.items.find((i) => i.productId === prodRiceLooseId);
      expect(riceItem?.quantity).toBe(1.5);
      expect(riceItem?.lineTotal).toBe(180.0);
      expect(riceItem?.costPrice).toBe(95.0); // Historical cost captured

      const sugarItem = sale.items.find((i) => i.productId === prodSugarLooseId);
      expect(sugarItem?.quantity).toBe(0.25); // Converted from 250 G to 0.25 KG
      expect(sugarItem?.lineTotal).toBe(12.5);
      expect(sugarItem?.costPrice).toBe(42.0);

      const penItem = sale.items.find((i) => i.productId === prodBallPenId);
      expect(penItem?.quantity).toBe(2);
      expect(penItem?.lineTotal).toBe(22.4);
      expect(penItem?.costPrice).toBe(6.0);

      const toyItem = sale.items.find((i) => i.productId === prodToyCarId);
      expect(toyItem?.quantity).toBe(1);
      expect(toyItem?.lineTotal).toBe(177.0);
      expect(toyItem?.costPrice).toBe(100.0);

      const soapItem = sale.items.find((i) => i.productId === prodBathSoapId);
      expect(soapItem?.quantity).toBe(2);
      expect(soapItem?.lineTotal).toBe(82.6);
      expect(soapItem?.costPrice).toBe(24.0);

      const oilItem = sale.items.find((i) => i.productId === prodOilLooseId);
      expect(oilItem?.quantity).toBe(0.5);
      expect(oilItem?.lineTotal).toBe(73.5);
      expect(oilItem?.costPrice).toBe(115.0);
    });

    it('3.2 Verifies exact decimal stock deduction across all 6 products', async () => {
      // 1. Rice: 100 - 1.5 = 98.5 kg
      const rice = await productService.getProductById(prodRiceLooseId);
      expect(rice?.currentStock).toBe(98.5);

      // 2. Sugar: 150 - 0.25 = 149.75 kg
      const sugar = await productService.getProductById(prodSugarLooseId);
      expect(sugar?.currentStock).toBe(149.75);

      // 3. Pen: 200 - 2 = 198 pcs
      const pen = await productService.getProductById(prodBallPenId);
      expect(pen?.currentStock).toBe(198);

      // 4. Toy: 30 - 1 = 29 pcs
      const toy = await productService.getProductById(prodToyCarId);
      expect(toy?.currentStock).toBe(29);

      // 5. Soap: 100 - 2 = 98 pcs
      const soap = await productService.getProductById(prodBathSoapId);
      expect(soap?.currentStock).toBe(98);

      // 6. Oil: 100 - 0.5 = 99.5 ltr
      const oil = await productService.getProductById(prodOilLooseId);
      expect(oil?.currentStock).toBe(99.5);
    });

    it('3.3 Authoritative Stock Ledger records atomic SALE transactions for each product', async () => {
      const ledgerEntries = await prisma.stockLedger.findMany({
        where: { referenceId: saleId, transactionType: 'SALE' },
      });
      expect(ledgerEntries.length).toBe(6);

      const riceEntry = ledgerEntries.find((e) => e.productId === prodRiceLooseId);
      expect(Number(riceEntry?.quantityChange)).toBe(-1.5);
      expect(Number(riceEntry?.balanceAfter)).toBe(98.5);

      const sugarEntry = ledgerEntries.find((e) => e.productId === prodSugarLooseId);
      expect(Number(sugarEntry?.quantityChange)).toBe(-0.25);
      expect(Number(sugarEntry?.balanceAfter)).toBe(149.75);

      const oilEntry = ledgerEntries.find((e) => e.productId === prodOilLooseId);
      expect(Number(oilEntry?.quantityChange)).toBe(-0.5);
      expect(Number(oilEntry?.balanceAfter)).toBe(99.5);
    });

    it('3.4 Verifies historical COGS and Gross Profit calculation for the mixed cart', async () => {
      // Historical Cost:
      // Rice: 1.5 * 95 = 142.50
      // Sugar: 0.25 * 42 = 10.50
      // Pen: 2 * 6 = 12.00
      // Toy: 1 * 100 = 100.00
      // Soap: 2 * 24 = 48.00
      // Oil: 0.5 * 115 = 57.50
      // Total COGS: 142.50 + 10.50 + 12.00 + 100.00 + 48.00 + 57.50 = 370.50
      const sale = await saleService.getSaleById(saleId);
      const totalCogs = sale?.items.reduce((sum, i) => sum + (i.costPrice || 0) * i.quantity, 0);
      expect(roundMoney(totalCogs || 0)).toBe(370.5);
    });

    it('3.5 Reports: Sales by Category includes all 4 affected categories', async () => {
      const byCat = await salesReportService.getSalesByCategory({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(byCat.data.length).toBeGreaterThanOrEqual(4);

      // Grocery Category Check: Rice (180) + Sugar (12.5) + Oil (73.50) = 266.00
      const groc = byCat.data.find((r) => r.categoryName === 'Grocery');
      expect(groc).toBeDefined();
      expect(groc?.grossRevenue).toBe(266.0);

      // Stationery Category Check: Pen (22.40)
      const stat = byCat.data.find((r) => r.categoryName === 'Stationery');
      expect(stat).toBeDefined();
      expect(stat?.grossRevenue).toBe(22.4);

      // Toys Category Check: Toy Car (177.00)
      const toy = byCat.data.find((r) => r.categoryName === 'Toys');
      expect(toy).toBeDefined();
      expect(toy?.grossRevenue).toBe(177.0);

      // Personal Care Category Check: Soap (82.60)
      const pc = byCat.data.find((r) => r.categoryName === 'Personal Care');
      expect(pc).toBeDefined();
      expect(pc?.grossRevenue).toBe(82.6);

      // Total revenue matches
      expect(byCat.totals.grossRevenue).toBe(548.0);
    });

    it('3.6 Reports: Inventory Report displays products with Subcategories and Stock Values', async () => {
      const inv = await inventoryReportService.getCurrentStockReport({ pageSize: 50 });
      expect(inv.data.length).toBeGreaterThanOrEqual(8);

      const riceRow = inv.data.find((r) => r.name === 'Basmati Rice Loose');
      expect(riceRow).toBeDefined();
      expect(riceRow?.categoryName).toBe('Grocery');
      expect(riceRow?.subcategoryName).toBe('Rice & Grains');
      expect(riceRow?.unitCode).toBe('KG');
      expect(riceRow?.currentStock).toBe(98.5);
      expect(riceRow?.stockValue).toBe(roundMoney(98.5 * 95)); // ₹9,357.50
    });
  });

  // ==========================================================================
  // SECTION 4: PURCHASES, RETURNS & CREDIT SALES (Section 32)
  // ==========================================================================
  describe('4. Mixed Purchases, Sales Returns & Unit Protection', () => {
    it('4.1 Multi-item mixed purchase increases inventory accurately', async () => {
      // Purchase: 100 kg Rice, 50 pc Pens, 25 pc Toy Cars, 50 m Wire
      const purchase = await purchaseService.createPurchase(
        {
          supplierId: testSupplierId,
          items: [
            { productId: prodRiceLooseId, quantity: 100, purchasePrice: 92, unitCode: 'KG', taxRate: 0 },
            { productId: prodBallPenId, quantity: 50, purchasePrice: 5.5, unitCode: 'PCS', taxRate: 12 },
            { productId: prodToyCarId, quantity: 25, purchasePrice: 95, unitCode: 'PCS', taxRate: 18 },
            { productId: prodWireLooseId, quantity: 50, purchasePrice: 11, unitCode: 'MTR', taxRate: 18 },
          ],
          discount: 0,
          paidAmount: 0,
          paymentMethod: 'CASH',
        },
        adminUserId
      );

      expect(purchase).toBeDefined();
      expect(purchase.items.length).toBe(4);

      // Verify stock increases
      const rice = await productService.getProductById(prodRiceLooseId);
      expect(rice?.currentStock).toBe(198.5); // 98.5 + 100

      const pens = await productService.getProductById(prodBallPenId);
      expect(pens?.currentStock).toBe(248); // 198 + 50

      const wire = await productService.getProductById(prodWireLooseId);
      expect(wire?.currentStock).toBe(150); // 100 + 50
    });

    it('4.2 Returns mixed items (1.5 kg rice, 2 pens, 1 toy) and restores stock', async () => {
      const sale = await saleService.getSaleById(saleId);
      expect(sale).not.toBeNull();

      const riceItem = sale!.items.find((i) => i.productId === prodRiceLooseId);
      const penItem = sale!.items.find((i) => i.productId === prodBallPenId);
      const toyItem = sale!.items.find((i) => i.productId === prodToyCarId);

      const ret = await salesReturnService.createSalesReturn(
        {
          saleId: sale!.id,
          notes: 'Customer returned items',
          refundMethod: 'CASH',
          items: [
            { saleItemId: riceItem!.id, productId: prodRiceLooseId, quantity: 1.5, reason: 'Excess quantity' },
            { saleItemId: penItem!.id, productId: prodBallPenId, quantity: 2, reason: 'Wrong color' },
            { saleItemId: toyItem!.id, productId: prodToyCarId, quantity: 1, reason: 'Defective box' },
          ],
        },
        adminUserId
      );

      expect(ret).toBeDefined();
      expect(ret.items.length).toBe(3);

      // Verify restored stock
      const rice = await productService.getProductById(prodRiceLooseId);
      expect(rice?.currentStock).toBe(200); // 198.5 + 1.5

      const pens = await productService.getProductById(prodBallPenId);
      expect(pens?.currentStock).toBe(250); // 248 + 2

      const toys = await productService.getProductById(prodToyCarId);
      expect(toys?.currentStock).toBe(55); // 29 - 1 sold earlier + 25 purchased + 1 returned = 55
    });

    it('4.3 Unit change protection prevents altering unit of product with transaction history', async () => {
      // Rice has sales and purchase history; changing unit from KG to PCS must be rejected
      await expect(
        productService.updateProduct(prodRiceLooseId, { unitId: unitPcsId }, adminUserId)
      ).rejects.toThrow(/because historical transactions exist/i);
    });

    it('4.4 Length unit product sale (3.5 meters of electrical wire)', async () => {
      const sale = await saleService.createSale(
        {
          customerId: testCustomerId,
          items: [
            {
              productId: prodWireLooseId,
              quantity: 3.5,
              sellingPrice: 20,
              unitCode: 'MTR',
              taxRate: 18,
            },
          ],
          paymentMethod: 'CASH',
          paidAmount: 82.6,
        },
        adminUserId
      );

      expect(sale.total).toBe(82.6);
      const wire = await productService.getProductById(prodWireLooseId);
      expect(wire?.currentStock).toBe(146.5); // 150 - 3.5
    });
  });
});
