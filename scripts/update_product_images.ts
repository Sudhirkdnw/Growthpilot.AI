import { getPrismaClient, initializeDatabasePragmas } from '../src/main/database/client';

export function getRealisticProductImage(categoryName: string, name: string): string {
  const n = (name || '').toLowerCase();
  const c = (categoryName || '').toLowerCase();

  if (n.includes('basmati') || n.includes('rice')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('dal') || n.includes('toor') || n.includes('moong') || n.includes('chana') || n.includes('rajma') || n.includes('urad')) {
    return 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('atta') || n.includes('flour') || n.includes('besan') || n.includes('maida') || n.includes('sooji')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('ghee') || n.includes('butter')) {
    return 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('oil')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('sugar') || n.includes('salt')) {
    return 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('masala') || n.includes('chilli') || n.includes('turmeric') || n.includes('coriander') || n.includes('cumin') || n.includes('pepper') || c.includes('spice')) {
    return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('biscuit') || n.includes('cookie') || n.includes('marie') || n.includes('glucose')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('chip') || n.includes('bhujia') || n.includes('namkeen') || n.includes('peanut') || n.includes('popcorn') || n.includes('sev') || c.includes('snack')) {
    return 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('drink') || n.includes('juice') || n.includes('water') || n.includes('cola') || n.includes('soda') || c.includes('beverage')) {
    return 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('tea') || n.includes('chai')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('coffee') || n.includes('nescafe')) {
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('milk') || n.includes('curd') || n.includes('paneer') || c.includes('dairy')) {
    return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('chocolate') || n.includes('candy') || n.includes('toffee') || n.includes('lollipop') || c.includes('confectionery')) {
    return 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('soap') || n.includes('wash') || n.includes('lotion') || n.includes('talc') || n.includes('deo') || c.includes('personal')) {
    return 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('paste') || n.includes('brush') || n.includes('mouthwash') || c.includes('oral')) {
    return 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('shampoo') || n.includes('hair') || n.includes('conditioner') || c.includes('hair')) {
    return 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('detergent') || n.includes('cleaner') || n.includes('dishwash') || c.includes('cleaning')) {
    return 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('pen') || n.includes('pencil') || n.includes('marker') || n.includes('eraser') || n.includes('scale') || n.includes('highlighter') || c.includes('stationery')) {
    return 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('notebook') || n.includes('register') || n.includes('paper') || n.includes('book') || n.includes('color') || c.includes('school')) {
    return 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('car') || n.includes('ball') || n.includes('bat') || n.includes('toy') || n.includes('doll') || n.includes('block') || c.includes('toy')) {
    return 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('battery') || n.includes('bulb') || n.includes('cable') || n.includes('usb') || n.includes('plug') || n.includes('adapter') || c.includes('electrical')) {
    return 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('spoon') || n.includes('bottle') || n.includes('knife') || n.includes('peeler') || n.includes('container') || n.includes('glass') || n.includes('plate') || c.includes('kitchen')) {
    return 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('bucket') || n.includes('mug') || n.includes('bin') || n.includes('clip') || c.includes('household')) {
    return 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('almond') || n.includes('cashew') || n.includes('kaju') || n.includes('badam') || n.includes('poha')) {
    return 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=400&q=80';
  }

  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
}

async function main() {
  await initializeDatabasePragmas();
  const prisma = getPrismaClient();

  const products = await prisma.product.findMany({
    include: { category: true },
  });

  console.log(`[UpdateImages] Found ${products.length} products to populate images for.`);

  let updatedCount = 0;
  for (const p of products) {
    const categoryName = p.category?.name || '';
    const imgUrl = getRealisticProductImage(categoryName, p.name);

    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: imgUrl },
    });
    updatedCount++;
  }

  console.log(`[UpdateImages] Successfully updated ${updatedCount} products with realistic imageUrls!`);
}

if (process.argv[1] && process.argv[1].includes('update_product_images')) {
  main().catch(console.error);
}
