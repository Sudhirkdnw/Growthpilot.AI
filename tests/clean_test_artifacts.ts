import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
  const testProds = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'Test' } },
        { sku: { startsWith: 'TEST' } },
        { sku: { in: ['CONCURRENT_RACE_SKU', 'FASTIFY_PROD_001', 'TOGGLE_001', 'LOOSE_VEG_A', 'LOOSE_VEG_B', 'APPLE_001', 'APPLE_002'] } },
      ],
    },
    select: { id: true, name: true, sku: true },
  });

  console.log(`Found ${testProds.length} test products to clean.`);
  const ids = testProds.map((p) => p.id);

  if (ids.length > 0) {
    await prisma.stockLedger.deleteMany({ where: { productId: { in: ids } } });
    await prisma.salesReturnItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.purchaseReturnItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.saleItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.purchaseItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }

  // Ensure every remaining product has matching stock ledger entry
  const remainingProducts = await prisma.product.findMany();
  for (const p of remainingProducts) {
    const movements = await prisma.stockLedger.findMany({
      where: { productId: p.id },
    });
    if (movements.length === 0 && Number(p.currentStock) > 0) {
      await prisma.stockLedger.create({
        data: {
          productId: p.id,
          transactionType: 'OPENING',
          referenceId: p.id,
          quantityChange: p.currentStock,
          balanceAfter: p.currentStock,
          notes: 'Reconciled opening balance',
        },
      });
    }
  }

  console.log('Cleanup and reconciliation complete.');
}

clean()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
