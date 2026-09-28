import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Integrity] Checking database integrity...');

  // 1. Check duplicate SKU
  const products = await prisma.product.findMany();
  const skus = new Set<string>();
  const barcodes = new Set<string>();

  for (const p of products) {
    if (skus.has(p.sku)) {
      throw new Error(`Duplicate SKU detected: ${p.sku}`);
    }
    skus.add(p.sku);

    if (p.barcode) {
      if (barcodes.has(p.barcode)) {
        throw new Error(`Duplicate Barcode detected: ${p.barcode}`);
      }
      barcodes.add(p.barcode);
    }

    if (Number.isNaN(Number(p.currentStock)) || !Number.isFinite(Number(p.currentStock))) {
      throw new Error(`Invalid stock value (NaN or Infinite) in product ${p.name}`);
    }

    if (Number(p.currentStock) < 0) {
      throw new Error(`Negative stock detected in product ${p.name}: ${p.currentStock}`);
    }
  }

  // 2. Check orphan subcategories
  const subcategories = await prisma.subcategory.findMany();
  const categories = await prisma.category.findMany();
  const categoryIds = new Set(categories.map((c) => c.id));

  for (const sub of subcategories) {
    if (!categoryIds.has(sub.categoryId)) {
      throw new Error(`Orphan subcategory detected: ${sub.name} (categoryId: ${sub.categoryId})`);
    }
  }

  // 3. Check product references
  const subcategoryIds = new Set(subcategories.map((s) => s.id));
  const units = await prisma.unit.findMany();
  const unitIds = new Set(units.map((u) => u.id));

  for (const p of products) {
    if (p.categoryId && !categoryIds.has(p.categoryId)) {
      throw new Error(`Product ${p.name} has invalid categoryId: ${p.categoryId}`);
    }
    if (p.subcategoryId && !subcategoryIds.has(p.subcategoryId)) {
      throw new Error(`Product ${p.name} has invalid subcategoryId: ${p.subcategoryId}`);
    }
    if (!unitIds.has(p.unitId)) {
      throw new Error(`Product ${p.name} has invalid unitId: ${p.unitId}`);
    }
  }

  // 3b. Verify Prisma relation loading without inconsistent query results
  const fullProducts = await prisma.product.findMany({
    include: {
      unit: true,
      category: true,
      subcategory: true,
      brand: true,
    },
  });
  console.log(`[Integrity] Successfully queried all ${fullProducts.length} products with their related unit, category, subcategory, and brand.`);

  // 4. Stock Ledger Reconciliation
  for (const p of products) {
    const movements = await prisma.stockLedger.findMany({
      where: { productId: p.id },
      orderBy: { createdAt: 'asc' },
    });

    if (movements.length > 0) {
      const sum = movements.reduce((acc, m) => acc + Number(m.quantityChange), 0);
      const diff = Math.abs(sum - Number(p.currentStock));
      if (diff > 0.0001) {
        throw new Error(
          `Stock ledger mismatch for product ${p.name}: Ledger sum = ${sum}, currentStock = ${p.currentStock}`
        );
      }
    }
  }

  // 5. Customer Ledger Reconciliation
  const customersList = await prisma.customer.findMany();
  for (const c of customersList) {
    const entries = await prisma.customerLedger.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: 'asc' },
    });
    if (entries.length > 0) {
      const net = entries.reduce((acc, e) => acc + Number(e.debit) - Number(e.credit), 0);
      const diff = Math.abs(net - Number(c.currentBalance));
      if (diff > 0.01) {
        throw new Error(`Customer ledger mismatch for ${c.name}: Ledger net = ${net}, currentBalance = ${c.currentBalance}`);
      }
    }
  }

  // 6. Supplier Ledger Reconciliation
  const suppliersList = await prisma.supplier.findMany();
  for (const s of suppliersList) {
    const entries = await prisma.supplierLedger.findMany({
      where: { supplierId: s.id },
      orderBy: { createdAt: 'asc' },
    });
    if (entries.length > 0) {
      const net = entries.reduce((acc, e) => acc + Number(e.credit) - Number(e.debit), 0);
      const diff = Math.abs(net - Number(s.currentBalance));
      if (diff > 0.01) {
        throw new Error(`Supplier ledger mismatch for ${s.name}: Ledger net = ${net}, currentBalance = ${s.currentBalance}`);
      }
    }
  }

  console.log(`[Integrity] Verified ${products.length} products, ${categories.length} categories, ${subcategories.length} subcategories, ${units.length} units.`);
  console.log(`[Integrity] Verified ${customersList.length} customers, ${suppliersList.length} suppliers.`);
  console.log('[Integrity] Stock ledger reconciliation: 100% MATCH.');
  console.log('[Integrity] Customer ledger reconciliation: 100% MATCH.');
  console.log('[Integrity] Supplier ledger reconciliation: 100% MATCH.');
  console.log('[Integrity] Database integrity verified successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
