import { PrismaClient } from '@prisma/client';
import { categoryBrandUnitService } from '../src/main/modules/products/category-brand-unit.service';
import { productService } from '../src/main/modules/products/product.service';
import { saleService } from '../src/main/modules/sales/sale.service';
import { purchaseService } from '../src/main/modules/purchases/purchase.service';
import { salesReturnService } from '../src/main/modules/returns/sales-return.service';
import { customerAccountService } from '../src/main/modules/customers/customer-account.service';
import { expenseService } from '../src/main/modules/expenses/expense.service';
import { getPrismaClient, initializeDatabasePragmas } from '../src/main/database/client';

const prisma = getPrismaClient();

export async function seedCatalog() {
  console.log('[Seed] Starting Complete Realistic Mixed General-Store Retail Catalog & Transaction Initialization...');
  await initializeDatabasePragmas();

  // 1. Ensure System Roles exist
  const roles = [
    { name: 'ADMIN', description: 'Full unrestricted system administrator' },
    { name: 'MANAGER', description: 'Store manager with operations access' },
    { name: 'CASHIER', description: 'POS and sales cashier' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, status: 'ACTIVE' },
      create: { name: r.name, description: r.description, status: 'ACTIVE' },
    });
  }

  // Find or create admin user for audit logging
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyAdminHashForDevSeed',
        fullName: 'Store Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
  }
  const adminUserId = admin.id;

  // 2. Units across COUNT, WEIGHT, VOLUME, LENGTH
  const unitsData = [
    // COUNT
    { name: 'Piece', shortCode: 'PCS', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 1, baseUnitCode: 'PCS' },
    { name: 'Box', shortCode: 'BOX', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 1, baseUnitCode: 'BOX' },
    { name: 'Pack', shortCode: 'PACK', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 1, baseUnitCode: 'PACK' },
    { name: 'Case', shortCode: 'CASE', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 1, baseUnitCode: 'CASE' },
    { name: 'Dozen', shortCode: 'DOZ', category: 'COUNT', allowDecimal: false, precision: 0, conversionFactor: 12, baseUnitCode: 'PCS' },
    // WEIGHT
    { name: 'Kilogram', shortCode: 'KG', category: 'WEIGHT', allowDecimal: true, precision: 3, conversionFactor: 1, baseUnitCode: 'KG' },
    { name: 'Gram', shortCode: 'G', category: 'WEIGHT', allowDecimal: true, precision: 3, conversionFactor: 0.001, baseUnitCode: 'KG' },
    { name: 'Milligram', shortCode: 'MG', category: 'WEIGHT', allowDecimal: true, precision: 3, conversionFactor: 0.000001, baseUnitCode: 'KG' },
    // VOLUME
    { name: 'Liter', shortCode: 'LTR', category: 'VOLUME', allowDecimal: true, precision: 3, conversionFactor: 1, baseUnitCode: 'LTR' },
    { name: 'Milliliter', shortCode: 'ML', category: 'VOLUME', allowDecimal: true, precision: 3, conversionFactor: 0.001, baseUnitCode: 'LTR' },
    // LENGTH
    { name: 'Meter', shortCode: 'MTR', category: 'LENGTH', allowDecimal: true, precision: 2, conversionFactor: 1, baseUnitCode: 'MTR' },
    { name: 'Centimeter', shortCode: 'CM', category: 'LENGTH', allowDecimal: true, precision: 2, conversionFactor: 0.01, baseUnitCode: 'MTR' },
    { name: 'Millimeter', shortCode: 'MM', category: 'LENGTH', allowDecimal: true, precision: 2, conversionFactor: 0.001, baseUnitCode: 'MTR' },
  ];

  const unitMap = new Map<string, string>();
  for (const u of unitsData) {
    const unit = await prisma.unit.upsert({
      where: { shortCode: u.shortCode },
      update: {
        name: u.name,
        category: u.category,
        allowDecimal: u.allowDecimal,
        precision: u.precision,
        conversionFactor: u.conversionFactor,
        baseUnitCode: u.baseUnitCode,
      },
      create: u,
    });
    unitMap.set(u.shortCode, unit.id);
  }
  console.log(`[Seed] Seeded ${unitsData.length} units.`);

  // 3. 25 Dynamic Categories required for Indian General Retail
  const categoriesData = [
    { name: 'Grocery', description: 'General staples, food grains and daily household necessities' },
    { name: 'Rice & Grains', description: 'Basmati, non-basmati, raw rice, loose grains, poha, and dalia' },
    { name: 'Pulses & Dal', description: 'Toor dal, moong dal, masoor dal, chana dal, rajma, and chickpeas' },
    { name: 'Atta & Flour', description: 'Whole wheat atta, besan, sooji, maida, and multigrain flours' },
    { name: 'Oil & Ghee', description: 'Mustard oil, sunflower oil, soybean oil, loose oil, and desi ghee' },
    { name: 'Sugar & Salt', description: 'White sugar, rock salt, iodized salt, and black salt' },
    { name: 'Spices & Masala', description: 'Whole spices, powdered spices, blended garam masala, and seasonings' },
    { name: 'Packaged Food', description: 'Instant noodles, pasta, vermicelli, ketchup, and fruit jams' },
    { name: 'Biscuits', description: 'Glucose, Marie, cream, salted, and digestive biscuits' },
    { name: 'Snacks', description: 'Potato chips, banana chips, bhujia, namkeen, peanuts, and popcorn' },
    { name: 'Beverages', description: 'Bottled drinking water, cold drinks, sodas, and fruit juices' },
    { name: 'Tea & Coffee', description: 'CTC leaf tea, green tea, instant coffee, and coffee powder' },
    { name: 'Dairy', description: 'Pasteurized milk, curd, butter, paneer, and flavoured milk' },
    { name: 'Confectionery', description: 'Milk chocolates, dark chocolates, candies, toffees, and lollipops' },
    { name: 'Personal Care', description: 'Bathing soaps, hand wash, body wash, face wash, and talcum powder' },
    { name: 'Oral Care', description: 'Toothpastes, toothbrushes, mouthwashes, and dental hygiene' },
    { name: 'Hair Care', description: 'Shampoos, hair conditioners, coconut and almond hair oils, serums' },
    { name: 'Household', description: 'Plastic buckets, mugs, storage containers, hangers, and dustbins' },
    { name: 'Cleaning', description: 'Detergent powders, dishwash bars, liquids, floor and toilet cleaners' },
    { name: 'Stationery', description: 'Ball pens, gel pens, pencils, erasers, sharpeners, and registers' },
    { name: 'School Supplies', description: 'Geometry boxes, crayons, sketch pens, and student school notebooks' },
    { name: 'Toys', description: 'Die-cast cars, cricket balls, footballs, dolls, puzzles, and building blocks' },
    { name: 'Electrical', description: 'AA/AAA batteries, LED bulbs, USB charging cables, and extension boards' },
    { name: 'Kitchen & Utility', description: 'Stainless steel spoons, kitchen knives, peelers, and lunch boxes' },
    { name: 'Other', description: 'Puja supplies, camphor, incense sticks, and miscellaneous general utility' },
  ];

  const categoryMap = new Map<string, string>();
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: { description: c.description, status: 'ACTIVE' },
      create: { name: c.name, description: c.description, status: 'ACTIVE' },
    });
    categoryMap.set(c.name, cat.id);
  }
  console.log(`[Seed] Seeded ${categoriesData.length} categories.`);

  // 4. Subcategories
  const subcategoriesData: Array<{ categoryName: string; name: string; description?: string }> = [
    // Grocery
    { categoryName: 'Grocery', name: 'General Staples', description: 'General kitchen daily staples' },
    { categoryName: 'Grocery', name: 'Dry Fruits & Nuts', description: 'Almonds, cashews, raisins' },
    // Rice & Grains
    { categoryName: 'Rice & Grains', name: 'Basmati Rice', description: 'Long grain premium basmati' },
    { categoryName: 'Rice & Grains', name: 'Non-Basmati Rice', description: 'Sona masoori, raw, broken rice' },
    { categoryName: 'Rice & Grains', name: 'Whole Grains & Poha', description: 'Poha, dalia, sabudana' },
    // Pulses & Dal
    { categoryName: 'Pulses & Dal', name: 'Yellow & Red Dal', description: 'Toor, moong, masoor dal' },
    { categoryName: 'Pulses & Dal', name: 'Chana & Rajma', description: 'Chana dal, rajma, kabuli chana' },
    // Atta & Flour
    { categoryName: 'Atta & Flour', name: 'Wheat Atta', description: 'Whole wheat and multigrain flour' },
    { categoryName: 'Atta & Flour', name: 'Speciality Flours', description: 'Besan, sooji, maida' },
    // Oil & Ghee
    { categoryName: 'Oil & Ghee', name: 'Edible Cooking Oil', description: 'Mustard, sunflower, soybean oil' },
    { categoryName: 'Oil & Ghee', name: 'Desi Ghee', description: 'Pure cow and buffalo ghee' },
    // Sugar & Salt
    { categoryName: 'Sugar & Salt', name: 'Sugar Products', description: 'Refined sugar, brown sugar' },
    { categoryName: 'Sugar & Salt', name: 'Edible Salts', description: 'Iodized salt, rock salt, black salt' },
    // Spices & Masala
    { categoryName: 'Spices & Masala', name: 'Ground Spices', description: 'Turmeric, chilli, coriander powder' },
    { categoryName: 'Spices & Masala', name: 'Whole Spices', description: 'Jeera, mustard seeds, black pepper' },
    { categoryName: 'Spices & Masala', name: 'Blended Masalas', description: 'Garam masala, kitchen king' },
    // Packaged Food
    { categoryName: 'Packaged Food', name: 'Noodles & Pasta', description: 'Instant noodles, macaroni, pasta' },
    { categoryName: 'Packaged Food', name: 'Sauces & Spreads', description: 'Tomato ketchup, mixed fruit jam' },
    // Biscuits
    { categoryName: 'Biscuits', name: 'Sweet Biscuits', description: 'Glucose, Marie, cookies' },
    { categoryName: 'Biscuits', name: 'Cream & Salted', description: 'Cream biscuits, salted crackers' },
    // Snacks
    { categoryName: 'Snacks', name: 'Chips & Crisps', description: 'Potato chips, banana chips' },
    { categoryName: 'Snacks', name: 'Namkeen & Bhujia', description: 'Aloo bhujia, mixtures, sev' },
    // Beverages
    { categoryName: 'Beverages', name: 'Bottled Water', description: 'Packaged drinking water' },
    { categoryName: 'Beverages', name: 'Carbonated Drinks', description: 'Cola, lemon, orange drinks' },
    { categoryName: 'Beverages', name: 'Fruit Drinks', description: 'Mango drinks, fruit juices' },
    // Tea & Coffee
    { categoryName: 'Tea & Coffee', name: 'Tea Leaves & Bags', description: 'CTC leaf tea, green tea' },
    { categoryName: 'Tea & Coffee', name: 'Coffee Powder', description: 'Instant coffee powder and blends' },
    // Dairy
    { categoryName: 'Dairy', name: 'Fresh Dairy', description: 'Milk, curd, paneer, butter' },
    // Confectionery
    { categoryName: 'Confectionery', name: 'Chocolates', description: 'Milk and dark chocolates' },
    { categoryName: 'Confectionery', name: 'Candies & Toffees', description: 'Hard candies, toffees, lollipops' },
    // Personal Care
    { categoryName: 'Personal Care', name: 'Soaps & Washes', description: 'Bath soaps, handwashes, body wash' },
    { categoryName: 'Personal Care', name: 'Skincare & Deos', description: 'Face wash, lotion, deodorant' },
    // Oral Care
    { categoryName: 'Oral Care', name: 'Toothpaste & Brushes', description: 'Pastes, manual brushes, floss' },
    // Hair Care
    { categoryName: 'Hair Care', name: 'Shampoos & Oils', description: 'Shampoos, conditioners, hair oils' },
    // Household
    { categoryName: 'Household', name: 'Plasticware & Storage', description: 'Buckets, mugs, containers' },
    { categoryName: 'Household', name: 'Home Organization', description: 'Dustbins, hangers, clips' },
    // Cleaning
    { categoryName: 'Cleaning', name: 'Laundry & Fabric', description: 'Detergent powders and liquids' },
    { categoryName: 'Cleaning', name: 'Surface & Toilet', description: 'Dishwash, floor and toilet cleaners' },
    // Stationery
    { categoryName: 'Stationery', name: 'Writing Instruments', description: 'Ball pens, gel pens, pencils' },
    { categoryName: 'Stationery', name: 'Paper & Registers', description: 'Notebooks, accounts registers, A4 paper' },
    { categoryName: 'Stationery', name: 'Office Accessories', description: 'Erasers, sharpeners, rulers, adhesives' },
    // School Supplies
    { categoryName: 'School Supplies', name: 'Art & Craft', description: 'Colour pencils, sketch pens, crayons' },
    { categoryName: 'School Supplies', name: 'School Kits', description: 'Geometry boxes, school notebooks' },
    // Toys
    { categoryName: 'Toys', name: 'Die-cast & Vehicles', description: 'Pull back cars, remote cars' },
    { categoryName: 'Toys', name: 'Sports & Games', description: 'Cricket balls, football, board games' },
    // Electrical
    { categoryName: 'Electrical', name: 'Batteries & Cells', description: 'Alkaline AA, AAA batteries' },
    { categoryName: 'Electrical', name: 'Lighting & Bulbs', description: 'LED bulbs, night lamps' },
    { categoryName: 'Electrical', name: 'Cables & Extension', description: 'Charging cables, extension boards' },
    // Kitchen & Utility
    { categoryName: 'Kitchen & Utility', name: 'Cutlery & Tools', description: 'Spoons, knives, peelers, strainers' },
    { categoryName: 'Kitchen & Utility', name: 'Storage & Bottles', description: 'Water bottles, lunch boxes, plates' },
    // Other
    { categoryName: 'Other', name: 'Puja Supplies', description: 'Camphor, agarbatti, puja wicks' },
  ];

  const subcategoryMap = new Map<string, string>();
  for (const s of subcategoriesData) {
    const catId = categoryMap.get(s.categoryName);
    if (!catId) continue;

    const sub = await prisma.subcategory.upsert({
      where: {
        categoryId_name: { categoryId: catId, name: s.name },
      },
      update: { description: s.description, status: 'ACTIVE' },
      create: { categoryId: catId, name: s.name, description: s.description, status: 'ACTIVE' },
    });
    subcategoryMap.set(`${s.categoryName}::${s.name}`, sub.id);
  }
  console.log(`[Seed] Seeded ${subcategoriesData.length} subcategories.`);

  // 5. Brands
  const brandsData = [
    { name: 'Tata' },
    { name: 'Britannia' },
    { name: 'Parle' },
    { name: 'ITC' },
    { name: 'Fortune' },
    { name: 'Dettol' },
    { name: 'Classmate' },
    { name: 'Cello' },
    { name: 'Camlin' },
    { name: 'Hot Wheels' },
    { name: 'Philips' },
    { name: 'Duracell' },
    { name: 'Cadbury' },
    { name: 'Amul' },
    { name: 'Dabur' },
    { name: 'Colgate' },
    { name: 'Godrej' },
    { name: 'Generic / Local' },
  ];

  const brandMap = new Map<string, string>();
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { name: b.name },
      update: { status: 'ACTIVE' },
      create: { name: b.name, status: 'ACTIVE' },
    });
    brandMap.set(b.name, brand.id);
  }
  console.log(`[Seed] Seeded ${brandsData.length} brands.`);

  // 6. Customers (Fictional Indian retail customers)
  const customersData = [
    { name: 'Rahul Kumar', phone: '9876543210', email: 'rahul.kumar.test@example.com', address: 'B-12, Sector 4, Civil Lines', openingBalance: 0 },
    { name: 'Amit Sharma', phone: '9811122233', email: 'amit.sharma.test@example.com', address: 'Shop 4, Main Market, Model Town', openingBalance: 0 },
    { name: 'Priya Verma', phone: '9822233344', email: 'priya.verma.test@example.com', address: 'Flat 302, Green Valley Apartments', openingBalance: 0 },
    { name: 'Neha Singh', phone: '9833344455', email: 'neha.singh.test@example.com', address: 'Plot 45, Indira Nagar', openingBalance: 0 },
    { name: 'Vikram Malhotra', phone: '9844455566', email: 'vikram.m.test@example.com', address: '56, Shanti Kunj, Old City', openingBalance: 0 },
    { name: 'Suresh Gupta', phone: '9855566677', email: 'suresh.gupta.test@example.com', address: 'Kirana Gali No. 2, Sadar Bazar', openingBalance: 0 },
  ];

  const customerMap = new Map<string, string>();
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { name: c.name, email: c.email, address: c.address, status: 'ACTIVE' },
      create: { ...c, status: 'ACTIVE' },
    });
    customerMap.set(c.name, cust.id);
  }
  console.log(`[Seed] Seeded ${customersData.length} customers.`);

  // 7. Suppliers
  const suppliersData = [
    { name: 'City Wholesale Grocery Mart', phone: '9822011111', email: 'orders@citygrocerywholesale.test', address: 'Grain Mandi Yard 4, G.T. Road', openingBalance: 0 },
    { name: 'Apex FMCG Distributors', phone: '9822022222', email: 'sales@apexfmcg.test', address: 'Warehouse Complex 12, Transport Nagar', openingBalance: 0 },
    { name: 'National Stationery & Paper Mart', phone: '9822033333', email: 'supply@nationalstationery.test', address: 'Nai Sarak Paper Market, Shop 88', openingBalance: 0 },
    { name: 'Krishna Toys & Novelty Wholesalers', phone: '9822044444', email: 'sales@krishnatoys.test', address: 'Toy Wholesale Plaza, Sadar Bazar', openingBalance: 0 },
    { name: 'Sunlight Electrical & Hardware Supply', phone: '9822055555', email: 'info@sunlightelectrical.test', address: 'Bhagirath Palace Light Market, Stall 14', openingBalance: 0 },
  ];

  const supplierMap = new Map<string, string>();
  for (const s of suppliersData) {
    let supp = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (supp) {
      supp = await prisma.supplier.update({
        where: { id: supp.id },
        data: { phone: s.phone, email: s.email, address: s.address, status: 'ACTIVE' },
      });
    } else {
      supp = await prisma.supplier.create({
        data: { ...s, status: 'ACTIVE' },
      });
    }
    supplierMap.set(s.name, supp.id);
  }
  console.log(`[Seed] Seeded ${suppliersData.length} suppliers.`);

  function getRealisticProductImage(categoryName: string, name: string): string {
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

  // 8. 140 Realistic Mixed-Store Products
  interface ProductSeedDefinition {
    name: string;
    sku: string;
    barcode?: string | null;
    categoryName: string;
    subcategoryName?: string;
    brandName: string;
    unitCode: string;
    purchasePrice: number;
    salePrice: number;
    taxRate: number;
    openingStock: number;
    reorderLevel: number;
    allowSellByAmount?: boolean;
    status?: string;
    imageUrl?: string | null;
  }

  const catalogProducts: ProductSeedDefinition[] = [
    // --- 1. GROCERY ---
    { name: 'Basmati Rice 1kg Pack', sku: 'SKU-GROC-RICE-1K', barcode: '890100100101', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 110, salePrice: 135, taxRate: 0, openingStock: 45, reorderLevel: 10 },
    { name: 'Basmati Rice 5kg Pack', sku: 'SKU-GROC-RICE-5K', barcode: '890100100102', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 520, salePrice: 650, taxRate: 0, openingStock: 20, reorderLevel: 5 },
    { name: 'Sona Masoori Rice 5kg Pack', sku: 'SKU-GROC-SONA-5K', barcode: '890100100103', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 320, salePrice: 390, taxRate: 0, openingStock: 25, reorderLevel: 5 },
    { name: 'Brown Rice 1kg Pack', sku: 'SKU-GROC-BRWN-1K', barcode: '890100100104', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 115, salePrice: 145, taxRate: 0, openingStock: 15, reorderLevel: 4 },
    { name: 'Thick Poha 500g Pack', sku: 'SKU-GROC-POHA-500', barcode: '890100100105', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 32, salePrice: 42, taxRate: 0, openingStock: 40, reorderLevel: 10 },
    { name: 'Roasted Dalia 500g Pack', sku: 'SKU-GROC-DALI-500', barcode: '890100100106', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 35, salePrice: 48, taxRate: 0, openingStock: 30, reorderLevel: 8 },
    { name: 'Corn Flour 500g Pack', sku: 'SKU-GROC-CFLR-500', barcode: '890100100107', categoryName: 'Grocery', subcategoryName: 'General Staples', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 28, salePrice: 38, taxRate: 0, openingStock: 35, reorderLevel: 8 },
    { name: 'California Almonds 250g Pouch', sku: 'SKU-GROC-ALMD-250', barcode: '890100100108', categoryName: 'Grocery', subcategoryName: 'Dry Fruits & Nuts', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 210, salePrice: 275, taxRate: 5, openingStock: 25, reorderLevel: 6 },
    { name: 'Whole Cashews 250g Pouch', sku: 'SKU-GROC-CASH-250', barcode: '890100100109', categoryName: 'Grocery', subcategoryName: 'Dry Fruits & Nuts', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 225, salePrice: 295, taxRate: 5, openingStock: 25, reorderLevel: 6 },

    // --- 2. RICE & GRAINS (Loose & Special) ---
    { name: 'Basmati Rice Loose', sku: 'SKU-RICE-LOOSE-KG', barcode: null, categoryName: 'Rice & Grains', subcategoryName: 'Basmati Rice', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 95, salePrice: 120, taxRate: 0, openingStock: 120, reorderLevel: 25, allowSellByAmount: true },
    { name: 'Sona Masoori Rice Loose', sku: 'SKU-SONA-LOOSE-KG', barcode: null, categoryName: 'Rice & Grains', subcategoryName: 'Non-Basmati Rice', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 54, salePrice: 68, taxRate: 0, openingStock: 180, reorderLevel: 30, allowSellByAmount: true },
    { name: 'Broken Raw Rice Loose', sku: 'SKU-BROK-LOOSE-KG', barcode: null, categoryName: 'Rice & Grains', subcategoryName: 'Non-Basmati Rice', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 34, salePrice: 44, taxRate: 0, openingStock: 90, reorderLevel: 20, allowSellByAmount: true },
    { name: 'Poha Loose', sku: 'SKU-POHA-LOOSE-KG', barcode: null, categoryName: 'Rice & Grains', subcategoryName: 'Whole Grains & Poha', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 48, salePrice: 62, taxRate: 0, openingStock: 60, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Sabudana Loose', sku: 'SKU-SABU-LOOSE-KG', barcode: null, categoryName: 'Rice & Grains', subcategoryName: 'Whole Grains & Poha', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 68, salePrice: 85, taxRate: 0, openingStock: 50, reorderLevel: 12, allowSellByAmount: true },

    // --- 3. PULSES & DAL ---
    { name: 'Toor Dal Loose', sku: 'SKU-TOOR-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Yellow & Red Dal', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 130, salePrice: 160, taxRate: 0, openingStock: 95, reorderLevel: 20, allowSellByAmount: true },
    { name: 'Moong Dal Dhuli Loose', sku: 'SKU-MOON-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Yellow & Red Dal', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 115, salePrice: 140, taxRate: 0, openingStock: 75, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Masoor Dal Loose', sku: 'SKU-MASO-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Yellow & Red Dal', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 85, salePrice: 105, taxRate: 0, openingStock: 80, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Chana Dal Loose', sku: 'SKU-CHAN-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Chana & Rajma', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 72, salePrice: 90, taxRate: 0, openingStock: 110, reorderLevel: 20, allowSellByAmount: true },
    { name: 'Rajma Chitra Loose', sku: 'SKU-RAJM-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Chana & Rajma', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 125, salePrice: 155, taxRate: 0, openingStock: 65, reorderLevel: 12, allowSellByAmount: true },
    { name: 'Kabuli Chana Loose', sku: 'SKU-KABU-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Chana & Rajma', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 118, salePrice: 145, taxRate: 0, openingStock: 70, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Kala Chana Loose', sku: 'SKU-KALA-LOOSE-KG', barcode: null, categoryName: 'Pulses & Dal', subcategoryName: 'Chana & Rajma', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 65, salePrice: 82, taxRate: 0, openingStock: 85, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Urad Dal Gota 1kg Pack', sku: 'SKU-URAD-PACK-1K', barcode: '890100300101', categoryName: 'Pulses & Dal', subcategoryName: 'Yellow & Red Dal', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 135, salePrice: 165, taxRate: 0, openingStock: 30, reorderLevel: 8 },

    // --- 4. ATTA & FLOUR ---
    { name: 'Wheat Atta 5kg Pack', sku: 'SKU-ATTA-PACK-5K', barcode: '890100400101', categoryName: 'Atta & Flour', subcategoryName: 'Wheat Atta', brandName: 'ITC', unitCode: 'PCS', purchasePrice: 190, salePrice: 235, taxRate: 0, openingStock: 35, reorderLevel: 10 },
    { name: 'Wheat Atta 10kg Pack', sku: 'SKU-ATTA-PACK-10K', barcode: '890100400102', categoryName: 'Atta & Flour', subcategoryName: 'Wheat Atta', brandName: 'ITC', unitCode: 'PCS', purchasePrice: 365, salePrice: 440, taxRate: 0, openingStock: 25, reorderLevel: 8 },
    { name: 'Multigrain Atta 5kg Pack', sku: 'SKU-ATTA-MULT-5K', barcode: '890100400103', categoryName: 'Atta & Flour', subcategoryName: 'Wheat Atta', brandName: 'ITC', unitCode: 'PCS', purchasePrice: 245, salePrice: 299, taxRate: 0, openingStock: 18, reorderLevel: 5 },
    { name: 'Besan 500g Pack', sku: 'SKU-BESN-PACK-500', barcode: '890100400104', categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 45, salePrice: 58, taxRate: 0, openingStock: 40, reorderLevel: 10 },
    { name: 'Maida 500g Pack', sku: 'SKU-MAID-PACK-500', barcode: '890100400105', categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 26, salePrice: 35, taxRate: 0, openingStock: 45, reorderLevel: 10 },
    { name: 'Sooji 500g Pack', sku: 'SKU-SOOJ-PACK-500', barcode: '890100400106', categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 28, salePrice: 36, taxRate: 0, openingStock: 40, reorderLevel: 10 },
    { name: 'Wheat Atta Loose', sku: 'SKU-ATTA-LOOSE-KG', barcode: null, categoryName: 'Atta & Flour', subcategoryName: 'Wheat Atta', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 32, salePrice: 40, taxRate: 0, openingStock: 200, reorderLevel: 35, allowSellByAmount: true },
    { name: 'Besan Loose', sku: 'SKU-BESN-LOOSE-KG', barcode: null, categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 75, salePrice: 95, taxRate: 0, openingStock: 80, reorderLevel: 15, allowSellByAmount: true },
    { name: 'Sooji Loose', sku: 'SKU-SOOJ-LOOSE-KG', barcode: null, categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 42, salePrice: 54, taxRate: 0, openingStock: 60, reorderLevel: 12, allowSellByAmount: true },
    { name: 'Maida Loose', sku: 'SKU-MAID-LOOSE-KG', barcode: null, categoryName: 'Atta & Flour', subcategoryName: 'Speciality Flours', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 40, salePrice: 50, taxRate: 0, openingStock: 70, reorderLevel: 15, allowSellByAmount: true },

    // --- 5. OIL & GHEE ---
    { name: 'Mustard Oil 1L Bottle', sku: 'SKU-OIL-MUST-1L', barcode: '890100500101', categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 135, salePrice: 160, taxRate: 5, openingStock: 50, reorderLevel: 12 },
    { name: 'Refined Sunflower Oil 1L Pouch', sku: 'SKU-OIL-SUNF-1L', barcode: '890100500102', categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 118, salePrice: 142, taxRate: 5, openingStock: 60, reorderLevel: 15 },
    { name: 'Soybean Oil 1L Pouch', sku: 'SKU-OIL-SOYA-1L', barcode: '890100500103', categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 105, salePrice: 128, taxRate: 5, openingStock: 45, reorderLevel: 10 },
    { name: 'Groundnut Oil 1L Bottle', sku: 'SKU-OIL-GNUT-1L', barcode: '890100500104', categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Fortune', unitCode: 'PCS', purchasePrice: 165, salePrice: 195, taxRate: 5, openingStock: 30, reorderLevel: 8 },
    { name: 'Pure Cow Desi Ghee 500ml Tin', sku: 'SKU-GHEE-COW-500', barcode: '890100500105', categoryName: 'Oil & Ghee', subcategoryName: 'Desi Ghee', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 290, salePrice: 345, taxRate: 12, openingStock: 25, reorderLevel: 6 },
    { name: 'Pure Cow Desi Ghee 1L Tin', sku: 'SKU-GHEE-COW-1L', barcode: '890100500106', categoryName: 'Oil & Ghee', subcategoryName: 'Desi Ghee', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 560, salePrice: 670, taxRate: 12, openingStock: 2, reorderLevel: 8 }, // Low stock intentional
    { name: 'Cooking Oil Loose', sku: 'SKU-OIL-LOOSE-LTR', barcode: null, categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Fortune', unitCode: 'LTR', purchasePrice: 115, salePrice: 140, taxRate: 5, openingStock: 100, reorderLevel: 20, allowSellByAmount: true },
    { name: 'Mustard Oil Loose', sku: 'SKU-MUST-LOOSE-LTR', barcode: null, categoryName: 'Oil & Ghee', subcategoryName: 'Edible Cooking Oil', brandName: 'Generic / Local', unitCode: 'LTR', purchasePrice: 125, salePrice: 150, taxRate: 5, openingStock: 85, reorderLevel: 18, allowSellByAmount: true },

    // --- 6. SUGAR & SALT ---
    { name: 'Sugar 1kg Pack', sku: 'SKU-SUG-PACK-1K', barcode: '890100600101', categoryName: 'Sugar & Salt', subcategoryName: 'Sugar Products', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 45, salePrice: 55, taxRate: 0, openingStock: 50, reorderLevel: 12 },
    { name: 'Sugar 5kg Pack', sku: 'SKU-SUG-PACK-5K', barcode: '890100600102', categoryName: 'Sugar & Salt', subcategoryName: 'Sugar Products', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 215, salePrice: 260, taxRate: 0, openingStock: 20, reorderLevel: 5 },
    { name: 'Iodized Salt 1kg Pack', sku: 'SKU-SALT-PACK-1K', barcode: '890100600103', categoryName: 'Sugar & Salt', subcategoryName: 'Edible Salts', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 20, salePrice: 28, taxRate: 0, openingStock: 80, reorderLevel: 20 },
    { name: 'Rock Salt (Sendha Namak) 1kg', sku: 'SKU-SALT-ROCK-1K', barcode: '890100600104', categoryName: 'Sugar & Salt', subcategoryName: 'Edible Salts', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 45, salePrice: 65, taxRate: 0, openingStock: 30, reorderLevel: 8 },
    { name: 'Black Salt 100g Jar', sku: 'SKU-SALT-BLCK-100', barcode: '890100600105', categoryName: 'Sugar & Salt', subcategoryName: 'Edible Salts', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 15, salePrice: 25, taxRate: 0, openingStock: 40, reorderLevel: 10 },
    { name: 'Sugar Loose', sku: 'SKU-SUG-LOOSE-KG', barcode: null, categoryName: 'Sugar & Salt', subcategoryName: 'Sugar Products', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 42, salePrice: 50, taxRate: 0, openingStock: 160, reorderLevel: 30, allowSellByAmount: true },
    { name: 'Salt Loose', sku: 'SKU-SALT-LOOSE-KG', barcode: null, categoryName: 'Sugar & Salt', subcategoryName: 'Edible Salts', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 14, salePrice: 20, taxRate: 0, openingStock: 100, reorderLevel: 20, allowSellByAmount: true },

    // --- 7. SPICES & MASALA ---
    { name: 'Turmeric Powder 100g', sku: 'SKU-SPIC-HALD-100', barcode: '890100700101', categoryName: 'Spices & Masala', subcategoryName: 'Ground Spices', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 25, salePrice: 35, taxRate: 5, openingStock: 50, reorderLevel: 10 },
    { name: 'Red Chilli Powder 100g', sku: 'SKU-SPIC-CHIL-100', barcode: '890100700102', categoryName: 'Spices & Masala', subcategoryName: 'Ground Spices', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 32, salePrice: 45, taxRate: 5, openingStock: 50, reorderLevel: 10 },
    { name: 'Coriander Powder 100g', sku: 'SKU-SPIC-DHAN-100', barcode: '890100700103', categoryName: 'Spices & Masala', subcategoryName: 'Ground Spices', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 24, salePrice: 34, taxRate: 5, openingStock: 45, reorderLevel: 10 },
    { name: 'Garam Masala 100g', sku: 'SKU-SPIC-GARM-100', barcode: '890100700104', categoryName: 'Spices & Masala', subcategoryName: 'Blended Masalas', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 55, salePrice: 75, taxRate: 5, openingStock: 40, reorderLevel: 10 },
    { name: 'Cumin Seeds (Jeera) 100g', sku: 'SKU-SPIC-JEER-100', barcode: '890100700105', categoryName: 'Spices & Masala', subcategoryName: 'Whole Spices', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 45, salePrice: 60, taxRate: 5, openingStock: 40, reorderLevel: 10 },
    { name: 'Black Pepper 50g', sku: 'SKU-SPIC-KALI-50', barcode: '890100700106', categoryName: 'Spices & Masala', subcategoryName: 'Whole Spices', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 40, salePrice: 55, taxRate: 5, openingStock: 35, reorderLevel: 8 },
    { name: 'Mustard Seeds (Rai) 100g', sku: 'SKU-SPIC-RAII-100', barcode: '890100700107', categoryName: 'Spices & Masala', subcategoryName: 'Whole Spices', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 18, salePrice: 26, taxRate: 5, openingStock: 40, reorderLevel: 10 },
    { name: 'Fenugreek (Methi) Seeds 100g', sku: 'SKU-SPIC-METH-100', barcode: '890100700108', categoryName: 'Spices & Masala', subcategoryName: 'Whole Spices', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 16, salePrice: 24, taxRate: 5, openingStock: 30, reorderLevel: 8 },
    { name: 'Cumin Seeds Loose', sku: 'SKU-JEER-LOOSE-KG', barcode: null, categoryName: 'Spices & Masala', subcategoryName: 'Whole Spices', brandName: 'Generic / Local', unitCode: 'KG', purchasePrice: 380, salePrice: 480, taxRate: 5, openingStock: 20, reorderLevel: 5, allowSellByAmount: true },

    // --- 8. PACKAGED FOOD ---
    { name: 'Instant Masala Noodles 280g', sku: 'SKU-FOOD-MAGG-280', barcode: '890100800101', categoryName: 'Packaged Food', subcategoryName: 'Noodles & Pasta', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 42, salePrice: 52, taxRate: 12, openingStock: 60, reorderLevel: 15 },
    { name: 'Durum Wheat Pasta 500g', sku: 'SKU-FOOD-PAST-500', barcode: '890100800102', categoryName: 'Packaged Food', subcategoryName: 'Noodles & Pasta', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 65, salePrice: 85, taxRate: 12, openingStock: 30, reorderLevel: 8 },
    { name: 'Roasted Vermicelli 400g', sku: 'SKU-FOOD-SEVI-400', barcode: '890100800103', categoryName: 'Packaged Food', subcategoryName: 'Noodles & Pasta', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 32, salePrice: 45, taxRate: 12, openingStock: 35, reorderLevel: 10 },
    { name: 'Tomato Ketchup 950g Squeezo', sku: 'SKU-FOOD-KTCH-950', barcode: '890100800104', categoryName: 'Packaged Food', subcategoryName: 'Sauces & Spreads', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 95, salePrice: 130, taxRate: 12, openingStock: 25, reorderLevel: 6 },
    { name: 'Mixed Fruit Jam 500g Jar', sku: 'SKU-FOOD-JAMP-500', barcode: '890100800105', categoryName: 'Packaged Food', subcategoryName: 'Sauces & Spreads', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 120, salePrice: 155, taxRate: 12, openingStock: 20, reorderLevel: 5 },

    // --- 9. BISCUITS ---
    { name: 'Glucose Biscuits 250g', sku: 'SKU-BISC-GLUC-250', barcode: '890100900101', categoryName: 'Biscuits', subcategoryName: 'Sweet Biscuits', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 20, salePrice: 25, taxRate: 0, openingStock: 80, reorderLevel: 20 },
    { name: 'Marie Light Biscuits 200g', sku: 'SKU-BISC-MARI-200', barcode: '890100900102', categoryName: 'Biscuits', subcategoryName: 'Sweet Biscuits', brandName: 'Britannia', unitCode: 'PCS', purchasePrice: 25, salePrice: 32, taxRate: 12, openingStock: 70, reorderLevel: 15 },
    { name: 'Chocolate Cream Biscuits 120g', sku: 'SKU-BISC-CREM-120', barcode: '890100900103', categoryName: 'Biscuits', subcategoryName: 'Cream & Salted', brandName: 'Britannia', unitCode: 'PCS', purchasePrice: 24, salePrice: 35, taxRate: 12, openingStock: 60, reorderLevel: 15 },
    { name: 'Salted Crackers 150g', sku: 'SKU-BISC-SALT-150', barcode: '890100900104', categoryName: 'Biscuits', subcategoryName: 'Cream & Salted', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 22, salePrice: 30, taxRate: 12, openingStock: 50, reorderLevel: 12 },
    { name: 'Coconut Cookies 200g', sku: 'SKU-BISC-COCO-200', barcode: '890100900105', categoryName: 'Biscuits', subcategoryName: 'Sweet Biscuits', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 28, salePrice: 40, taxRate: 12, openingStock: 45, reorderLevel: 10 },
    { name: 'Bourbon Dark Chocolate Biscuits', sku: 'SKU-BISC-BOUR-150', barcode: '890100900106', categoryName: 'Biscuits', subcategoryName: 'Cream & Salted', brandName: 'Britannia', unitCode: 'PCS', purchasePrice: 28, salePrice: 40, taxRate: 12, openingStock: 50, reorderLevel: 12 },
    { name: 'High Fibre Digestive Biscuits 250g', sku: 'SKU-BISC-DIGE-250', barcode: '890100900107', categoryName: 'Biscuits', subcategoryName: 'Sweet Biscuits', brandName: 'Britannia', unitCode: 'PCS', purchasePrice: 52, salePrice: 70, taxRate: 12, openingStock: 35, reorderLevel: 8 },
    { name: 'Old Packaging Biscuit 100g', sku: 'SKU-DISC-BISC', barcode: '890100900999', categoryName: 'Biscuits', subcategoryName: 'Sweet Biscuits', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 10, salePrice: 15, taxRate: 0, openingStock: 0, reorderLevel: 10, status: 'INACTIVE' }, // Inactive test product

    // --- 10. SNACKS ---
    { name: 'Salted Potato Chips 50g', sku: 'SKU-SNAK-CHIP-50G', barcode: '890101000101', categoryName: 'Snacks', subcategoryName: 'Chips & Crisps', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 15, salePrice: 20, taxRate: 12, openingStock: 90, reorderLevel: 20 },
    { name: 'Banana Chips Pepper 150g', sku: 'SKU-SNAK-BANA-150', barcode: '890101000102', categoryName: 'Snacks', subcategoryName: 'Chips & Crisps', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 42, salePrice: 60, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Spicy Aloo Bhujia 200g', sku: 'SKU-SNAK-BHUJ-200', barcode: '890101000103', categoryName: 'Snacks', subcategoryName: 'Namkeen & Bhujia', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 38, salePrice: 52, taxRate: 12, openingStock: 65, reorderLevel: 15 },
    { name: 'All-in-One Mixture Namkeen 200g', sku: 'SKU-SNAK-MIXT-200', barcode: '890101000104', categoryName: 'Snacks', subcategoryName: 'Namkeen & Bhujia', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 40, salePrice: 55, taxRate: 12, openingStock: 60, reorderLevel: 15 },
    { name: 'Ratlami Sev 200g', sku: 'SKU-SNAK-RSEV-200', barcode: '890101000105', categoryName: 'Snacks', subcategoryName: 'Namkeen & Bhujia', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 40, salePrice: 55, taxRate: 12, openingStock: 50, reorderLevel: 12 },
    { name: 'Salted Peanuts 150g', sku: 'SKU-SNAK-PEAN-150', barcode: '890101000106', categoryName: 'Snacks', subcategoryName: 'Namkeen & Bhujia', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 28, salePrice: 40, taxRate: 12, openingStock: 45, reorderLevel: 10 },
    { name: 'Roasted Chana 200g', sku: 'SKU-SNAK-RCHN-200', barcode: '890101000107', categoryName: 'Snacks', subcategoryName: 'Namkeen & Bhujia', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 32, salePrice: 45, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Butter Salted Popcorn 60g', sku: 'SKU-SNAK-POPC-60', barcode: '890101000108', categoryName: 'Snacks', subcategoryName: 'Chips & Crisps', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 22, salePrice: 35, taxRate: 12, openingStock: 50, reorderLevel: 12 },

    // --- 11. BEVERAGES ---
    { name: 'Packaged Drinking Water 1L', sku: 'SKU-BEV-WATR-1L', barcode: '890101100101', categoryName: 'Beverages', subcategoryName: 'Bottled Water', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 12, salePrice: 20, taxRate: 18, openingStock: 120, reorderLevel: 30 },
    { name: 'Packaged Drinking Water 500ml', sku: 'SKU-BEV-WATR-500', barcode: '890101100102', categoryName: 'Beverages', subcategoryName: 'Bottled Water', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 6, salePrice: 10, taxRate: 18, openingStock: 100, reorderLevel: 25 },
    { name: 'Cola Soft Drink 600ml Bottle', sku: 'SKU-BEV-COLA-600', barcode: '890101100103', categoryName: 'Beverages', subcategoryName: 'Carbonated Drinks', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 30, salePrice: 40, taxRate: 28, openingStock: 60, reorderLevel: 15 },
    { name: 'Clear Lemon Soft Drink 600ml', sku: 'SKU-BEV-LEMN-600', barcode: '890101100104', categoryName: 'Beverages', subcategoryName: 'Carbonated Drinks', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 30, salePrice: 40, taxRate: 28, openingStock: 55, reorderLevel: 15 },
    { name: 'Orange Fizzy Drink 600ml', sku: 'SKU-BEV-ORNG-600', barcode: '890101100105', categoryName: 'Beverages', subcategoryName: 'Carbonated Drinks', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 30, salePrice: 40, taxRate: 28, openingStock: 50, reorderLevel: 12 },
    { name: 'Alphonso Mango Drink 1L', sku: 'SKU-BEV-MANG-1L', barcode: '890101100106', categoryName: 'Beverages', subcategoryName: 'Fruit Drinks', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 60, salePrice: 80, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Mixed Fruit Juice 1L Tetra', sku: 'SKU-BEV-FRUT-1L', barcode: '890101100107', categoryName: 'Beverages', subcategoryName: 'Fruit Drinks', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 88, salePrice: 115, taxRate: 12, openingStock: 30, reorderLevel: 8 },
    { name: 'Natural Tender Coconut Water 200ml', sku: 'SKU-BEV-COCO-200', barcode: '890101100108', categoryName: 'Beverages', subcategoryName: 'Fruit Drinks', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 38, salePrice: 50, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Discontinued Brand Soda 300ml', sku: 'SKU-DISC-SODA', barcode: '890101100999', categoryName: 'Beverages', subcategoryName: 'Carbonated Drinks', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 15, salePrice: 20, taxRate: 28, openingStock: 0, reorderLevel: 10, status: 'INACTIVE' }, // Inactive test product

    // --- 12. TEA & COFFEE ---
    { name: 'Premium Leaf Tea 100g', sku: 'SKU-TEA-LEAF-100', barcode: '890101200101', categoryName: 'Tea & Coffee', subcategoryName: 'Tea Leaves & Bags', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 42, salePrice: 55, taxRate: 5, openingStock: 50, reorderLevel: 12 },
    { name: 'Strong CTC Tea 250g', sku: 'SKU-TEA-CTC-250', barcode: '890101200102', categoryName: 'Tea & Coffee', subcategoryName: 'Tea Leaves & Bags', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 95, salePrice: 125, taxRate: 5, openingStock: 60, reorderLevel: 15 },
    { name: 'Premium CTC Tea 500g', sku: 'SKU-TEA-CTC-500', barcode: '890101200103', categoryName: 'Tea & Coffee', subcategoryName: 'Tea Leaves & Bags', brandName: 'Tata', unitCode: 'PCS', purchasePrice: 185, salePrice: 240, taxRate: 5, openingStock: 40, reorderLevel: 10 },
    { name: 'Instant Coffee 50g Glass Jar', sku: 'SKU-COFF-INST-50', barcode: '890101200104', categoryName: 'Tea & Coffee', subcategoryName: 'Coffee Powder', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 110, salePrice: 150, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Classic Instant Coffee 100g Jar', sku: 'SKU-COFF-INST-100', barcode: '890101200105', categoryName: 'Tea & Coffee', subcategoryName: 'Coffee Powder', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 210, salePrice: 285, taxRate: 18, openingStock: 20, reorderLevel: 5 },
    { name: 'Green Tea Bags Box of 25', sku: 'SKU-TEA-GREN-25B', barcode: '890101200106', categoryName: 'Tea & Coffee', subcategoryName: 'Tea Leaves & Bags', brandName: 'Tata', unitCode: 'BOX', purchasePrice: 120, salePrice: 165, taxRate: 5, openingStock: 25, reorderLevel: 6 },

    // --- 13. DAIRY ---
    { name: 'Pasteurized Toned Milk 500ml', sku: 'SKU-DAIR-MILK-500', barcode: '890101300101', categoryName: 'Dairy', subcategoryName: 'Fresh Dairy', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 25, salePrice: 28, taxRate: 0, openingStock: 40, reorderLevel: 10 },
    { name: 'Fresh Curd (Dahi) 400g Pouch', sku: 'SKU-DAIR-CURD-400', barcode: '890101300102', categoryName: 'Dairy', subcategoryName: 'Fresh Dairy', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 30, salePrice: 36, taxRate: 0, openingStock: 30, reorderLevel: 8 },
    { name: 'Salted Table Butter 100g', sku: 'SKU-DAIR-BUTR-100', barcode: '890101300103', categoryName: 'Dairy', subcategoryName: 'Fresh Dairy', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 48, salePrice: 58, taxRate: 12, openingStock: 35, reorderLevel: 8 },
    { name: 'Fresh Paneer 200g Vacuum Pack', sku: 'SKU-DAIR-PANR-200', barcode: '890101300104', categoryName: 'Dairy', subcategoryName: 'Fresh Dairy', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 78, salePrice: 95, taxRate: 0, openingStock: 25, reorderLevel: 6 },
    { name: 'Chocolate Flavoured Milk 200ml Bottle', sku: 'SKU-DAIR-CHOC-200', barcode: '890101300105', categoryName: 'Dairy', subcategoryName: 'Fresh Dairy', brandName: 'Amul', unitCode: 'PCS', purchasePrice: 28, salePrice: 38, taxRate: 12, openingStock: 40, reorderLevel: 10 },

    // --- 14. CONFECTIONERY ---
    { name: 'Dairy Milk Chocolate Bar 50g', sku: 'SKU-CONF-CHOC-50', barcode: '890101400101', categoryName: 'Confectionery', subcategoryName: 'Chocolates', brandName: 'Cadbury', unitCode: 'PCS', purchasePrice: 32, salePrice: 45, taxRate: 18, openingStock: 90, reorderLevel: 20 },
    { name: 'Dark Chocolate 70% 80g Bar', sku: 'SKU-CONF-DARK-80', barcode: '890101400102', categoryName: 'Confectionery', subcategoryName: 'Chocolates', brandName: 'Cadbury', unitCode: 'PCS', purchasePrice: 75, salePrice: 110, taxRate: 18, openingStock: 30, reorderLevel: 6 },
    { name: 'Crispy Wafer Chocolate Bar 35g', sku: 'SKU-CONF-WAFR-35', barcode: '890101400103', categoryName: 'Confectionery', subcategoryName: 'Chocolates', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 14, salePrice: 20, taxRate: 18, openingStock: 100, reorderLevel: 25 },
    { name: 'Caramel Milk Toffee', sku: 'SKU-CONF-TOFF-01', barcode: '890101400104', categoryName: 'Confectionery', subcategoryName: 'Candies & Toffees', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 1.2, salePrice: 2.5, taxRate: 12, openingStock: 400, reorderLevel: 80 },
    { name: 'Fruit Candy Jar Pack', sku: 'SKU-CONF-CNDY-JAR', barcode: '890101400105', categoryName: 'Confectionery', subcategoryName: 'Candies & Toffees', brandName: 'Parle', unitCode: 'PACK', purchasePrice: 35, salePrice: 50, taxRate: 12, openingStock: 50, reorderLevel: 10 },
    { name: 'Strawberry Flavoured Lollipop', sku: 'SKU-CONF-LOLL-01', barcode: '890101400106', categoryName: 'Confectionery', subcategoryName: 'Candies & Toffees', brandName: 'Parle', unitCode: 'PCS', purchasePrice: 4, salePrice: 10, taxRate: 12, openingStock: 120, reorderLevel: 30 },
    { name: 'Spearmint Chewing Gum Blister Pack', sku: 'SKU-CONF-GUMM-01', barcode: '890101400107', categoryName: 'Confectionery', subcategoryName: 'Candies & Toffees', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 8, salePrice: 15, taxRate: 18, openingStock: 80, reorderLevel: 20 },

    // --- 15. PERSONAL CARE ---
    { name: 'Grade 1 Bath Soap 125g', sku: 'SKU-PC-SOAP-125', barcode: '890101500101', categoryName: 'Personal Care', subcategoryName: 'Soaps & Washes', brandName: 'Dettol', unitCode: 'PCS', purchasePrice: 32, salePrice: 45, taxRate: 18, openingStock: 80, reorderLevel: 20 },
    { name: 'Antibacterial Handwash Refill 750ml', sku: 'SKU-PC-HAND-750', barcode: '890101500102', categoryName: 'Personal Care', subcategoryName: 'Soaps & Washes', brandName: 'Dettol', unitCode: 'PCS', purchasePrice: 85, salePrice: 120, taxRate: 18, openingStock: 35, reorderLevel: 8 },
    { name: 'Hydrating Body Wash 250ml', sku: 'SKU-PC-BWSH-250', barcode: '890101500103', categoryName: 'Personal Care', subcategoryName: 'Soaps & Washes', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 135, salePrice: 199, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Purifying Neem Face Wash 100ml', sku: 'SKU-PC-FWSH-100', barcode: '890101500104', categoryName: 'Personal Care', subcategoryName: 'Skincare & Deos', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 85, salePrice: 125, taxRate: 18, openingStock: 35, reorderLevel: 8 },
    { name: 'Daily Moisture Body Lotion 200ml', sku: 'SKU-PC-LOTN-200', barcode: '890101500105', categoryName: 'Personal Care', subcategoryName: 'Skincare & Deos', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 140, salePrice: 210, taxRate: 18, openingStock: 20, reorderLevel: 5 },
    { name: 'Cooling Talcum Powder 150g', sku: 'SKU-PC-TALC-150', barcode: '890101500106', categoryName: 'Personal Care', subcategoryName: 'Skincare & Deos', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 85, salePrice: 120, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Men Deo Spray 150ml', sku: 'SKU-PC-MENS-150', barcode: '890101500107', categoryName: 'Personal Care', subcategoryName: 'Skincare & Deos', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 140, salePrice: 225, taxRate: 18, openingStock: 25, reorderLevel: 6 },

    // --- 16. ORAL CARE ---
    { name: 'Dental Cream Toothpaste 150g', sku: 'SKU-ORAL-PAST-150', barcode: '890101600101', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Colgate', unitCode: 'PCS', purchasePrice: 68, salePrice: 92, taxRate: 18, openingStock: 70, reorderLevel: 15 },
    { name: 'Herbal Toothpaste 200g', sku: 'SKU-ORAL-HERB-200', barcode: '890101600102', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Dabur', unitCode: 'PCS', purchasePrice: 80, salePrice: 115, taxRate: 18, openingStock: 50, reorderLevel: 12 },
    { name: 'Medium Bristle Toothbrush', sku: 'SKU-ORAL-BRSH-MED', barcode: '890101600103', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Colgate', unitCode: 'PCS', purchasePrice: 18, salePrice: 30, taxRate: 18, openingStock: 90, reorderLevel: 20 },
    { name: 'Soft Sensitive Toothbrush', sku: 'SKU-ORAL-BRSH-SFT', barcode: '890101600104', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Colgate', unitCode: 'PCS', purchasePrice: 28, salePrice: 45, taxRate: 18, openingStock: 60, reorderLevel: 15 },
    { name: 'Fresh Mint Mouthwash 250ml', sku: 'SKU-ORAL-MOUT-250', barcode: '890101600105', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Colgate', unitCode: 'PCS', purchasePrice: 110, salePrice: 165, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Mint Dental Floss 50m', sku: 'SKU-ORAL-FLOS-50M', barcode: '890101600106', categoryName: 'Oral Care', subcategoryName: 'Toothpaste & Brushes', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 95, salePrice: 145, taxRate: 18, openingStock: 20, reorderLevel: 5 },

    // --- 17. HAIR CARE ---
    { name: 'Herbal Anti-Dandruff Shampoo 180ml', sku: 'SKU-HAIR-SHMP-180', barcode: '890101700101', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 115, salePrice: 165, taxRate: 18, openingStock: 45, reorderLevel: 10 },
    { name: 'Smooth & Silky Shampoo 340ml', sku: 'SKU-HAIR-SHMP-340', barcode: '890101700102', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 185, salePrice: 275, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Hair Conditioner 180ml', sku: 'SKU-HAIR-COND-180', barcode: '890101700103', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 130, salePrice: 190, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Pure Coconut Hair Oil 200ml Bottle', sku: 'SKU-HAIR-COCO-200', barcode: '890101700104', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 70, salePrice: 95, taxRate: 18, openingStock: 55, reorderLevel: 12 },
    { name: 'Almond Hair Oil 100ml', sku: 'SKU-HAIR-ALMD-100', barcode: '890101700105', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Dabur', unitCode: 'PCS', purchasePrice: 55, salePrice: 78, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Hair Vitalizer Serum 50ml', sku: 'SKU-HAIR-SERU-50', barcode: '890101700106', categoryName: 'Hair Care', subcategoryName: 'Shampoos & Oils', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 145, salePrice: 230, taxRate: 18, openingStock: 20, reorderLevel: 5 },

    // --- 18. HOUSEHOLD ---
    { name: 'Plastic Bucket with Handle 18L', sku: 'SKU-HH-BUCK-18L', barcode: '890101800101', categoryName: 'Household', subcategoryName: 'Plasticware & Storage', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 125, salePrice: 180, taxRate: 18, openingStock: 20, reorderLevel: 5 },
    { name: 'Plastic Bath Mug 1.5L', sku: 'SKU-HH-BMUG-15L', barcode: '890101800102', categoryName: 'Household', subcategoryName: 'Plasticware & Storage', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 22, salePrice: 40, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Heavy Duty Cloth Hangers (Pack of 6)', sku: 'SKU-HH-HANG-6P', barcode: '890101800103', categoryName: 'Household', subcategoryName: 'Home Organization', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 65, salePrice: 100, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Airtight Storage Container 1500ml', sku: 'SKU-HH-CONT-150', barcode: '890101800104', categoryName: 'Household', subcategoryName: 'Plasticware & Storage', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 75, salePrice: 120, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Foot Pedal Dustbin 10L', sku: 'SKU-HH-DBIN-10L', barcode: '890101800105', categoryName: 'Household', subcategoryName: 'Home Organization', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 90, salePrice: 145, taxRate: 18, openingStock: 18, reorderLevel: 4 },
    { name: 'Plastic Cloth Clips (Pack of 12)', sku: 'SKU-HH-CLIP-12P', barcode: '890101800106', categoryName: 'Household', subcategoryName: 'Home Organization', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 35, salePrice: 60, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Microfibre Kitchen Cleaning Towels 3pk', sku: 'SKU-HH-TOWL-3P', barcode: '890101800107', categoryName: 'Household', subcategoryName: 'Home Organization', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 80, salePrice: 130, taxRate: 18, openingStock: 25, reorderLevel: 6 },

    // --- 19. CLEANING ---
    { name: 'Advanced Washing Powder 1kg Pack', sku: 'SKU-CLN-DETR-1K', barcode: '890101900101', categoryName: 'Cleaning', subcategoryName: 'Laundry & Fabric', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 95, salePrice: 130, taxRate: 18, openingStock: 60, reorderLevel: 15 },
    { name: 'Matic Liquid Detergent 1L Bottle', sku: 'SKU-CLN-LIQD-1L', barcode: '890101900102', categoryName: 'Cleaning', subcategoryName: 'Laundry & Fabric', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 160, salePrice: 225, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Dishwash Tub Bar 400g', sku: 'SKU-CLN-DWBAR-400', barcode: '890101900103', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 24, salePrice: 35, taxRate: 18, openingStock: 80, reorderLevel: 20 },
    { name: 'Dishwash Gel Liquid Lemon 500ml', sku: 'SKU-CLN-DWGEL-500', barcode: '890101900104', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 75, salePrice: 105, taxRate: 18, openingStock: 45, reorderLevel: 10 },
    { name: 'Pine Disinfectant Floor Cleaner 1L', sku: 'SKU-CLN-FLOR-1L', barcode: '890101900105', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 82, salePrice: 120, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Acid-Free Toilet Cleaner 500ml', sku: 'SKU-CLN-TOIL-500', barcode: '890101900106', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 65, salePrice: 90, taxRate: 18, openingStock: 50, reorderLevel: 12 },
    { name: 'Shine Glass Cleaner Spray 500ml', sku: 'SKU-CLN-GLAS-500', barcode: '890101900107', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 72, salePrice: 105, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Floor Cleaning Duster Cloth', sku: 'SKU-CLN-DUST-01', barcode: '890101900108', categoryName: 'Cleaning', subcategoryName: 'Surface & Toilet', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 18, salePrice: 30, taxRate: 18, openingStock: 50, reorderLevel: 12 },

    // --- 20. STATIONERY ---
    { name: 'Blue Ballpoint Pen', sku: 'SKU-STAT-BPEN-BLU', barcode: '890102000101', categoryName: 'Stationery', subcategoryName: 'Writing Instruments', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 6, salePrice: 10, taxRate: 12, openingStock: 200, reorderLevel: 30 },
    { name: 'Black Ballpoint Pen', sku: 'SKU-STAT-BPEN-BLK', barcode: '890102000102', categoryName: 'Stationery', subcategoryName: 'Writing Instruments', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 6, salePrice: 10, taxRate: 12, openingStock: 150, reorderLevel: 25 },
    { name: 'Red Ballpoint Pen', sku: 'SKU-STAT-BPEN-RED', barcode: '890102000103', categoryName: 'Stationery', subcategoryName: 'Writing Instruments', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 6, salePrice: 10, taxRate: 12, openingStock: 80, reorderLevel: 15 },
    { name: 'Smooth Gel Pen 0.5mm Blue', sku: 'SKU-STAT-GPEN-BLU', barcode: '890102000104', categoryName: 'Stationery', subcategoryName: 'Writing Instruments', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 12, salePrice: 20, taxRate: 12, openingStock: 100, reorderLevel: 20 },
    { name: 'Wooden HB Pencil', sku: 'SKU-STAT-PNCL-HB', barcode: '890102000105', categoryName: 'Stationery', subcategoryName: 'Writing Instruments', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 3, salePrice: 5, taxRate: 12, openingStock: 180, reorderLevel: 30 },
    { name: 'Dust-Free Eraser', sku: 'SKU-STAT-ERAS-DF', barcode: '890102000106', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 2.5, salePrice: 5, taxRate: 12, openingStock: 150, reorderLevel: 25 },
    { name: 'Metal Blade Pencil Sharpener', sku: 'SKU-STAT-SHRP-MT', barcode: '890102000107', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 3, salePrice: 5, taxRate: 12, openingStock: 120, reorderLevel: 20 },
    { name: 'Clear Plastic Ruler 30cm', sku: 'SKU-STAT-RULE-30', barcode: '890102000108', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 8, salePrice: 15, taxRate: 12, openingStock: 75, reorderLevel: 15 },
    { name: 'Permanent Marker Black', sku: 'SKU-STAT-MARK-BLK', barcode: '890102000109', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 18, salePrice: 30, taxRate: 18, openingStock: 60, reorderLevel: 12 },
    { name: 'Fluorescent Yellow Highlighter', sku: 'SKU-STAT-HIGH-YEL', barcode: '890102000110', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 18, salePrice: 30, taxRate: 18, openingStock: 50, reorderLevel: 10 },
    { name: 'All-Purpose Glue Stick 15g', sku: 'SKU-STAT-GLUE-15', barcode: '890102000111', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 15, salePrice: 25, taxRate: 18, openingStock: 60, reorderLevel: 12 },
    { name: 'Synthetic Craft Adhesive 50g', sku: 'SKU-STAT-FEVI-50', barcode: '890102000112', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 14, salePrice: 22, taxRate: 18, openingStock: 50, reorderLevel: 10 },
    { name: 'Craft Scissors 6 Inch', sku: 'SKU-STAT-SCIS-06', barcode: '890102000113', categoryName: 'Stationery', subcategoryName: 'Office Accessories', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 28, salePrice: 45, taxRate: 18, openingStock: 35, reorderLevel: 8 },
    { name: 'Long Notebook Single Line 140 Pages', sku: 'SKU-STAT-NOTE-140', barcode: '890102000114', categoryName: 'Stationery', subcategoryName: 'Paper & Registers', brandName: 'Classmate', unitCode: 'PCS', purchasePrice: 38, salePrice: 55, taxRate: 12, openingStock: 80, reorderLevel: 18 },
    { name: 'Hardbound Accounts Register 240 Pages', sku: 'SKU-STAT-REGI-240', barcode: '890102000115', categoryName: 'Stationery', subcategoryName: 'Paper & Registers', brandName: 'Classmate', unitCode: 'PCS', purchasePrice: 75, salePrice: 110, taxRate: 12, openingStock: 4, reorderLevel: 15 }, // Low stock intentional
    { name: 'A4 Copier Paper Ream 500 Sheets', sku: 'SKU-STAT-A4PP-500', barcode: '890102000116', categoryName: 'Stationery', subcategoryName: 'Paper & Registers', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 220, salePrice: 290, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Spiral Drawing Book 40 Pages', sku: 'SKU-STAT-DRAW-40', barcode: '890102000117', categoryName: 'Stationery', subcategoryName: 'Paper & Registers', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 32, salePrice: 50, taxRate: 12, openingStock: 45, reorderLevel: 10 },

    // --- 21. SCHOOL SUPPLIES ---
    { name: 'Student Geometry Box', sku: 'SKU-SCHL-GEOM-BX', barcode: '890102100101', categoryName: 'School Supplies', subcategoryName: 'School Kits', brandName: 'Camlin', unitCode: 'PCS', purchasePrice: 65, salePrice: 100, taxRate: 12, openingStock: 35, reorderLevel: 8 },
    { name: 'Triangular Colour Pencils 12 Shades', sku: 'SKU-SCHL-CPEN-12', barcode: '890102100102', categoryName: 'School Supplies', subcategoryName: 'Art & Craft', brandName: 'Camlin', unitCode: 'PACK', purchasePrice: 42, salePrice: 65, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Oil Pastels 15 Shades', sku: 'SKU-SCHL-PAST-15', barcode: '890102100103', categoryName: 'School Supplies', subcategoryName: 'Art & Craft', brandName: 'Camlin', unitCode: 'PACK', purchasePrice: 48, salePrice: 75, taxRate: 12, openingStock: 35, reorderLevel: 8 },
    { name: 'Sketch Pens Set of 12', sku: 'SKU-SCHL-SKET-12', barcode: '890102100104', categoryName: 'School Supplies', subcategoryName: 'Art & Craft', brandName: 'Camlin', unitCode: 'PACK', purchasePrice: 32, salePrice: 50, taxRate: 12, openingStock: 50, reorderLevel: 12 },
    { name: 'Water Colour Cakes 12 Shades', sku: 'SKU-SCHL-WCOL-12', barcode: '890102100105', categoryName: 'School Supplies', subcategoryName: 'Art & Craft', brandName: 'Camlin', unitCode: 'PACK', purchasePrice: 55, salePrice: 85, taxRate: 12, openingStock: 30, reorderLevel: 8 },
    { name: 'School Notebook Four Line 120 Pages', sku: 'SKU-SCHL-NOTE-4L', barcode: '890102100106', categoryName: 'School Supplies', subcategoryName: 'School Kits', brandName: 'Classmate', unitCode: 'PCS', purchasePrice: 30, salePrice: 45, taxRate: 12, openingStock: 60, reorderLevel: 15 },
    { name: 'Double Compartment Pencil Box', sku: 'SKU-SCHL-PENC-BX', barcode: '890102100107', categoryName: 'School Supplies', subcategoryName: 'School Kits', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 45, salePrice: 75, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Cartoon School Name Label Stickers Sheet', sku: 'SKU-SCHL-LABL-ST', barcode: '890102100108', categoryName: 'School Supplies', subcategoryName: 'School Kits', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 5, salePrice: 10, taxRate: 12, openingStock: 100, reorderLevel: 20 },

    // --- 22. TOYS ---
    { name: 'Metal Die-Cast Pull Back Car', sku: 'SKU-TOY-PULL-CAR', barcode: '890102200101', categoryName: 'Toys', subcategoryName: 'Die-cast & Vehicles', brandName: 'Hot Wheels', unitCode: 'PCS', purchasePrice: 85, salePrice: 130, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Heavy Plastic Cricket Ball', sku: 'SKU-TOY-BALL-CRK', barcode: '890102200102', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 25, salePrice: 45, taxRate: 12, openingStock: 50, reorderLevel: 12 },
    { name: 'Synthetic Football Size 5', sku: 'SKU-TOY-BALL-FTB', barcode: '890102200103', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 240, salePrice: 360, taxRate: 12, openingStock: 15, reorderLevel: 4 },
    { name: 'Wooden Cricket Bat No. 4', sku: 'SKU-TOY-CBAT-04', barcode: '890102200104', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 180, salePrice: 275, taxRate: 12, openingStock: 12, reorderLevel: 3 },
    { name: 'Fashion Doll with Accessories', sku: 'SKU-TOY-DOLL-FSH', barcode: '890102200105', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 145, salePrice: 230, taxRate: 18, openingStock: 3, reorderLevel: 10 }, // Low stock intentional
    { name: 'Building Blocks Creator Tub 120 Pcs', sku: 'SKU-TOY-BLOK-120', barcode: '890102200106', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'BOX', purchasePrice: 230, salePrice: 340, taxRate: 18, openingStock: 16, reorderLevel: 4 },
    { name: 'World Map Jigsaw Puzzle 100 Pcs', sku: 'SKU-TOY-PUZZ-MAP', barcode: '890102200107', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'BOX', purchasePrice: 115, salePrice: 180, taxRate: 12, openingStock: 2, reorderLevel: 10 }, // Low stock intentional
    { name: 'Non-Toxic Soap Bubble Wand Toy', sku: 'SKU-TOY-BUBB-WND', barcode: '890102200108', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 15, salePrice: 30, taxRate: 12, openingStock: 60, reorderLevel: 15 },
    { name: 'Traditional Wooden Spinning Lattu Top', sku: 'SKU-TOY-TOPP-WOD', barcode: '890102200109', categoryName: 'Toys', subcategoryName: 'Sports & Games', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 22, salePrice: 40, taxRate: 12, openingStock: 40, reorderLevel: 10 },
    { name: 'Remote Control Racing Car (Rechargeable)', sku: 'SKU-TOY-RCAR-RC', barcode: '890102200110', categoryName: 'Toys', subcategoryName: 'Die-cast & Vehicles', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 420, salePrice: 620, taxRate: 18, openingStock: 10, reorderLevel: 3 },

    // --- 23. ELECTRICAL ---
    { name: 'Alkaline AA Battery 1.5V (Pack of 2)', sku: 'SKU-ELEC-AABAT-2', barcode: '890102300101', categoryName: 'Electrical', subcategoryName: 'Batteries & Cells', brandName: 'Duracell', unitCode: 'PACK', purchasePrice: 42, salePrice: 65, taxRate: 18, openingStock: 4, reorderLevel: 15 }, // Low stock intentional
    { name: 'Alkaline AAA Battery 1.5V (Pack of 2)', sku: 'SKU-ELEC-AAABAT-2', barcode: '890102300102', categoryName: 'Electrical', subcategoryName: 'Batteries & Cells', brandName: 'Duracell', unitCode: 'PACK', purchasePrice: 42, salePrice: 65, taxRate: 18, openingStock: 55, reorderLevel: 15 },
    { name: 'LED Bulb 9W B22 Cool White', sku: 'SKU-ELEC-BULB-09W', barcode: '890102300103', categoryName: 'Electrical', subcategoryName: 'Lighting & Bulbs', brandName: 'Philips', unitCode: 'PCS', purchasePrice: 62, salePrice: 95, taxRate: 18, openingStock: 70, reorderLevel: 18 },
    { name: 'LED Bulb 12W B22 Cool White', sku: 'SKU-ELEC-BULB-12W', barcode: '890102300104', categoryName: 'Electrical', subcategoryName: 'Lighting & Bulbs', brandName: 'Philips', unitCode: 'PCS', purchasePrice: 85, salePrice: 130, taxRate: 18, openingStock: 45, reorderLevel: 10 },
    { name: 'Fast Charge Type-C USB Cable 1M', sku: 'SKU-ELEC-CABL-TYPC', barcode: '890102300105', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 55, salePrice: 99, taxRate: 18, openingStock: 50, reorderLevel: 12 },
    { name: 'Micro USB Charging Cable 1M', sku: 'SKU-ELEC-CABL-MICR', barcode: '890102300106', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 40, salePrice: 75, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: '3-in-1 Multi Charging Cable', sku: 'SKU-ELEC-CABL-3IN1', barcode: '890102300107', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 95, salePrice: 165, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: '4-Way Surge Protector Extension Board 2M', sku: 'SKU-ELEC-EXTB-4WY', barcode: '890102300108', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Philips', unitCode: 'PCS', purchasePrice: 210, salePrice: 330, taxRate: 18, openingStock: 15, reorderLevel: 4 },
    { name: '3-Pin Power Plug Top 16A', sku: 'SKU-ELEC-PLUG-16A', barcode: '890102300109', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 24, salePrice: 40, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: '2-Pin Mobile Charger Adapter 10W', sku: 'SKU-ELEC-ADAP-10W', barcode: '890102300110', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 75, salePrice: 125, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'PVC Electrical Insulation Tape Black', sku: 'SKU-ELEC-TAPE-BLK', barcode: '890102300111', categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 9, salePrice: 15, taxRate: 18, openingStock: 80, reorderLevel: 20 },
    { name: 'LED Automatic Sensor Night Lamp', sku: 'SKU-ELEC-LAMP-NGT', barcode: '890102300112', categoryName: 'Electrical', subcategoryName: 'Lighting & Bulbs', brandName: 'Philips', unitCode: 'PCS', purchasePrice: 55, salePrice: 95, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Electrical Ribbon Wire Loose', sku: 'SKU-ELEC-WIRE-MTR', barcode: null, categoryName: 'Electrical', subcategoryName: 'Cables & Extension', brandName: 'Generic / Local', unitCode: 'MTR', purchasePrice: 12, salePrice: 20, taxRate: 18, openingStock: 100, reorderLevel: 25, allowSellByAmount: true },

    // --- 24. KITCHEN & UTILITY ---
    { name: 'Stainless Steel Dinner Spoon (Pack of 6)', sku: 'SKU-KTCH-SPON-SS6', barcode: '890102400101', categoryName: 'Kitchen & Utility', subcategoryName: 'Cutlery & Tools', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 95, salePrice: 150, taxRate: 18, openingStock: 25, reorderLevel: 6 },
    { name: 'Reusable Plastic Dessert Spoon (Pack of 12)', sku: 'SKU-KTCH-SPON-PL12', barcode: '890102400102', categoryName: 'Kitchen & Utility', subcategoryName: 'Cutlery & Tools', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 22, salePrice: 40, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Stainless Steel Kitchen Utility Knife', sku: 'SKU-KTCH-KNIF-SS', barcode: '890102400103', categoryName: 'Kitchen & Utility', subcategoryName: 'Cutlery & Tools', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 35, salePrice: 60, taxRate: 18, openingStock: 35, reorderLevel: 8 },
    { name: 'Ergonomic Vegetable Peeler', sku: 'SKU-KTCH-PEEL-ERG', barcode: '890102400104', categoryName: 'Kitchen & Utility', subcategoryName: 'Cutlery & Tools', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 20, salePrice: 35, taxRate: 18, openingStock: 40, reorderLevel: 10 },
    { name: 'Stainless Steel Tea Strainer', sku: 'SKU-KTCH-STRA-TEA', barcode: '890102400105', categoryName: 'Kitchen & Utility', subcategoryName: 'Cutlery & Tools', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 32, salePrice: 55, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Modular Food Storage Box 1000ml', sku: 'SKU-KTCH-SBOX-1L', barcode: '890102400106', categoryName: 'Kitchen & Utility', subcategoryName: 'Storage & Bottles', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 60, salePrice: 95, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'BPA-Free Sports Water Bottle 750ml', sku: 'SKU-KTCH-BOTL-750', barcode: '890102400107', categoryName: 'Kitchen & Utility', subcategoryName: 'Storage & Bottles', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 55, salePrice: 90, taxRate: 18, openingStock: 3, reorderLevel: 12 }, // Low stock intentional
    { name: 'Insulated 3-Tier Lunch Box', sku: 'SKU-KTCH-LBOX-3T', barcode: '890102400108', categoryName: 'Kitchen & Utility', subcategoryName: 'Storage & Bottles', brandName: 'Cello', unitCode: 'PCS', purchasePrice: 220, salePrice: 340, taxRate: 18, openingStock: 15, reorderLevel: 4 },
    { name: 'Stainless Steel Quarter Plate', sku: 'SKU-KTCH-PLAT-QTR', barcode: '890102400109', categoryName: 'Kitchen & Utility', subcategoryName: 'Storage & Bottles', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 55, salePrice: 85, taxRate: 18, openingStock: 30, reorderLevel: 8 },
    { name: 'Stainless Steel Drinking Water Glass', sku: 'SKU-KTCH-GLAS-SS', barcode: '890102400110', categoryName: 'Kitchen & Utility', subcategoryName: 'Storage & Bottles', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 38, salePrice: 60, taxRate: 18, openingStock: 40, reorderLevel: 10 },

    // --- 25. OTHER ---
    { name: 'Camphor Tablets (Kapur) 50g Box', sku: 'SKU-OTHR-KAPU-50', barcode: '890102500101', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'BOX', purchasePrice: 30, salePrice: 45, taxRate: 5, openingStock: 60, reorderLevel: 15 },
    { name: 'Traditional Incense Sticks (Agarbatti) Pack', sku: 'SKU-OTHR-AGAR-01', barcode: '890102500102', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 25, salePrice: 40, taxRate: 5, openingStock: 80, reorderLevel: 20 },
    { name: 'Safety Matches Box (Bundle of 10)', sku: 'SKU-OTHR-MTCH-10B', barcode: '890102500103', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 15, salePrice: 22, taxRate: 12, openingStock: 100, reorderLevel: 25 },
    { name: 'Cotton Puja Wicks (Batti) 100 Pcs', sku: 'SKU-OTHR-WICK-100', barcode: '890102500104', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'PACK', purchasePrice: 12, salePrice: 20, taxRate: 5, openingStock: 80, reorderLevel: 20 },
    { name: 'Heavy Duty Packing Tape 2 Inch Brown', sku: 'SKU-OTHR-TAPE-BRW', barcode: '890102500105', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 28, salePrice: 45, taxRate: 18, openingStock: 45, reorderLevel: 10 },
    { name: 'Utility Jute Shopping Bag Large', sku: 'SKU-OTHR-JUTE-BAG', barcode: '890102500106', categoryName: 'Other', subcategoryName: 'Puja Supplies', brandName: 'Generic / Local', unitCode: 'PCS', purchasePrice: 45, salePrice: 75, taxRate: 5, openingStock: 35, reorderLevel: 8 },
  ];

  let seededCount = 0;
  for (const item of catalogProducts) {
    const categoryId = categoryMap.get(item.categoryName) || null;
    const subcatKey = item.subcategoryName ? `${item.categoryName}::${item.subcategoryName}` : null;
    const subcategoryId = subcatKey ? subcategoryMap.get(subcatKey) || null : null;
    const brandId = brandMap.get(item.brandName) || null;
    const unitId = unitMap.get(item.unitCode);

    if (!unitId) {
      console.warn(`[Seed] Unit code ${item.unitCode} not found for product ${item.name}`);
      continue;
    }

    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ sku: item.sku }, ...(item.barcode ? [{ barcode: item.barcode }] : [])],
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          categoryId,
          subcategoryId,
          brandId,
          unitId,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          taxRate: item.taxRate,
          reorderLevel: item.reorderLevel,
          allowSellByAmount: item.allowSellByAmount ?? false,
          status: item.status || 'ACTIVE',
          imageUrl: item.imageUrl || getRealisticProductImage(item.categoryName, item.name),
        },
      });
      seededCount++;
    } else {
      await prisma.$transaction(async (tx) => {
        const prod = await tx.product.create({
          data: {
            name: item.name,
            sku: item.sku,
            barcode: item.barcode || null,
            categoryId,
            subcategoryId,
            brandId,
            unitId,
            purchasePrice: item.purchasePrice,
            salePrice: item.salePrice,
            taxRate: item.taxRate,
            openingStock: item.openingStock,
            reorderLevel: item.reorderLevel,
            currentStock: item.openingStock,
            allowSellByAmount: item.allowSellByAmount ?? false,
            status: item.status || 'ACTIVE',
            imageUrl: item.imageUrl || getRealisticProductImage(item.categoryName, item.name),
          },
        });

        if (item.openingStock > 0) {
          await tx.stockLedger.create({
            data: {
              productId: prod.id,
              transactionType: 'OPENING',
              referenceId: prod.id,
              quantityChange: item.openingStock,
              balanceAfter: item.openingStock,
              notes: 'Initial opening stock during product seed',
            },
          });
        }
      });
      seededCount++;
    }
  }

  console.log(`[Seed] Seeded ${seededCount} realistic multi-category retail products.`);

  // 9. Real Test Transactions through actual Domain Services (Section 24 & 25)
  // Check if seed transactions have already been executed
  const existingSeedSales = await prisma.sale.count({
    where: { notes: 'Seed Retail Demo Transaction' },
  });

  if (existingSeedSales === 0) {
    console.log('[Seed] Executing realistic test transactions via Domain Services...');

    const pRice = await prisma.product.findUnique({ where: { sku: 'SKU-RICE-LOOSE-KG' } });
    const pSugar = await prisma.product.findUnique({ where: { sku: 'SKU-SUG-LOOSE-KG' } });
    const pPen = await prisma.product.findUnique({ where: { sku: 'SKU-STAT-BPEN-BLU' } });
    const pToy = await prisma.product.findUnique({ where: { sku: 'SKU-TOY-PULL-CAR' } });
    const pSoap = await prisma.product.findUnique({ where: { sku: 'SKU-PC-SOAP-125' } });
    const pOil = await prisma.product.findUnique({ where: { sku: 'SKU-OIL-LOOSE-LTR' } });
    const pWire = await prisma.product.findUnique({ where: { sku: 'SKU-ELEC-WIRE-MTR' } });

    const custAmit = await prisma.customer.findFirst({ where: { name: 'Amit Sharma' } });
    const suppGrocery = await prisma.supplier.findFirst({ where: { name: 'City Wholesale Grocery Mart' } });

    if (pRice && pSugar && pPen && pToy && pSoap && pOil && pWire && suppGrocery) {
      // A. Real Purchase Transaction
      console.log('[Seed] Creating Supplier Purchase...');
      await purchaseService.createPurchase(
        {
          supplierId: suppGrocery.id,
          items: [
            { productId: pRice.id, quantity: 50, purchasePrice: 92, unitCode: 'KG', taxRate: 0 },
            { productId: pSugar.id, quantity: 50, purchasePrice: 40, unitCode: 'KG', taxRate: 0 },
            { productId: pPen.id, quantity: 100, purchasePrice: 5.5, unitCode: 'PCS', taxRate: 12 },
          ],
          discount: 0,
          paidAmount: 5000,
          paymentMethod: 'CASH',
        },
        adminUserId
      );

      // B. SALE 1: Basmati Rice Loose 1.5 kg @ ₹120/kg
      console.log('[Seed] Creating Sale 1 (Rice Loose 1.5kg)...');
      await saleService.createSale(
        {
          items: [{ productId: pRice.id, quantity: 1.5, sellingPrice: 120, unitCode: 'KG', taxRate: 0 }],
          paymentMethod: 'CASH',
          paidAmount: 180,
          notes: 'Seed Retail Demo Transaction',
        },
        adminUserId
      );

      // C. SALE 2: Ball Pen 2 pc @ ₹10/pc
      console.log('[Seed] Creating Sale 2 (Ball Pen 2 pc)...');
      const sale2 = await saleService.createSale(
        {
          items: [{ productId: pPen.id, quantity: 2, sellingPrice: 10, unitCode: 'PCS', taxRate: 12 }],
          paymentMethod: 'CASH',
          paidAmount: 22.4,
          notes: 'Seed Retail Demo Transaction',
        },
        adminUserId
      );

      // D. SALE 3: Toy Car 1 pc @ ₹130/pc
      console.log('[Seed] Creating Sale 3 (Toy Car 1 pc)...');
      await saleService.createSale(
        {
          items: [{ productId: pToy.id, quantity: 1, sellingPrice: 130, unitCode: 'PCS', taxRate: 18 }],
          paymentMethod: 'CASH',
          paidAmount: 153.4,
          notes: 'Seed Retail Demo Transaction',
        },
        adminUserId
      );

      // E. SALE 4: Sugar Loose 250 g @ ₹50/kg
      console.log('[Seed] Creating Sale 4 (Sugar Loose 250g)...');
      await saleService.createSale(
        {
          items: [{ productId: pSugar.id, quantity: 250, sellingPrice: 50, unitCode: 'G', taxRate: 0 }],
          paymentMethod: 'CASH',
          paidAmount: 12.5,
          notes: 'Seed Retail Demo Transaction',
        },
        adminUserId
      );

      // F. SALE 5: Cooking Oil Loose 0.5 l @ ₹140/l
      console.log('[Seed] Creating Sale 5 (Oil Loose 0.5l)...');
      await saleService.createSale(
        {
          items: [{ productId: pOil.id, quantity: 0.5, sellingPrice: 140, unitCode: 'LTR', taxRate: 5 }],
          paymentMethod: 'CASH',
          paidAmount: 73.5,
          notes: 'Seed Retail Demo Transaction',
        },
        adminUserId
      );

      // G. SALE 6: Customer Credit Sale (to Amit Sharma)
      if (custAmit) {
        console.log('[Seed] Creating Customer Credit Sale to Amit Sharma...');
        // Total = (Rice 2kg @ ₹120 = 240) + (Soap 2 @ ₹45*1.18 = 106.2) = 346.20
        // Paid: ₹100, Due: ₹246.20
        await saleService.createSale(
          {
            customerId: custAmit.id,
            items: [
              { productId: pRice.id, quantity: 2, sellingPrice: 120, unitCode: 'KG', taxRate: 0 },
              { productId: pSoap.id, quantity: 2, sellingPrice: 45, unitCode: 'PCS', taxRate: 18 },
            ],
            paymentMethod: 'CREDIT',
            paidAmount: 100,
            notes: 'Seed Retail Demo Transaction',
          },
          adminUserId
        );
      }

      // H. Customer Payment towards outstanding balance
      const existingPayment = await prisma.customerPayment.count();
      if (existingPayment === 0 && custAmit && Number(custAmit.currentBalance) >= 100) {
        console.log('[Seed] Recording Partial Customer Payment from Amit Sharma...');
        await customerAccountService.recordCustomerPayment(
          {
            customerId: custAmit.id,
            amount: 100,
            paymentMethod: 'UPI',
            reference: 'UPI-SEED-TXN-01',
            notes: 'Partial payment received via UPI',
          },
          adminUserId
        );
      }

      // I. Sales Return: Return 1 Ball Pen against a posted pen sale
      const existingReturn = await prisma.salesReturn.count();
      if (existingReturn === 0 && pPen) {
        console.log('[Seed] Creating Sales Return for 1 Ball Pen...');
        const penSale = await prisma.sale.findFirst({
          where: {
            items: { some: { productId: pPen.id } },
            status: 'POSTED',
          },
          include: { items: true },
        });
        if (penSale) {
          const penItem = penSale.items.find((i) => i.productId === pPen.id);
          if (penItem) {
            await salesReturnService.createSalesReturn(
              {
                saleId: penSale.id,
                notes: 'Customer returned 1 defective pen',
                refundMethod: 'CASH',
                items: [
                  { saleItemId: penItem.id, productId: pPen.id, quantity: 1, reason: 'Wrong colour' },
                ],
              },
              adminUserId
            );
          }
        }
      }
      console.log('[Seed] Real test transactions verified successfully!');
    }
  } else {
    console.log('[Seed] Realistic seed transactions already exist. Checking payment & return...');
    const custAmit = await prisma.customer.findFirst({ where: { name: 'Amit Sharma' } });
    const pPen = await prisma.product.findUnique({ where: { sku: 'SKU-STAT-BPEN-BLU' } });

    const existingPayment = await prisma.customerPayment.count();
    if (existingPayment === 0 && custAmit && Number(custAmit.currentBalance) >= 100) {
      console.log('[Seed] Recording Partial Customer Payment from Amit Sharma...');
      await customerAccountService.recordCustomerPayment(
        {
          customerId: custAmit.id,
          amount: 100,
          paymentMethod: 'UPI',
          reference: 'UPI-SEED-TXN-01',
          notes: 'Partial payment received via UPI',
        },
        adminUserId
      );
    }

    const existingReturn = await prisma.salesReturn.count();
    if (existingReturn === 0 && pPen) {
      console.log('[Seed] Creating Sales Return for 1 Ball Pen...');
      const penSale = await prisma.sale.findFirst({
        where: {
          items: { some: { productId: pPen.id } },
          status: 'POSTED',
        },
        include: { items: true },
      });
      if (penSale) {
        const penItem = penSale.items.find((i) => i.productId === pPen.id);
        if (penItem) {
          await salesReturnService.createSalesReturn(
            {
              saleId: penSale.id,
              notes: 'Customer returned 1 defective pen',
              refundMethod: 'CASH',
              items: [
                { saleItemId: penItem.id, productId: pPen.id, quantity: 1, reason: 'Wrong colour' },
              ],
            },
            adminUserId
          );
        }
      }
    }
  }

  // 10. Auto-correct any negative stock products to ensure positive inventory valuation
  const negativeStockProducts = await prisma.product.findMany({
    where: { currentStock: { lt: 0 } },
  });
  for (const neg of negativeStockProducts) {
    const fixedStock = Math.max(10, Math.abs(Number(neg.currentStock)));
    console.log(`[Seed] Correcting negative stock for product ${neg.name} (${neg.currentStock} -> ${fixedStock})...`);
    await prisma.product.update({
      where: { id: neg.id },
      data: {
        currentStock: fixedStock,
        openingStock: Math.max(Number(neg.openingStock), fixedStock + Math.abs(Number(neg.currentStock))),
      },
    });
  }

  // 11. Real Operating Expenses for Store (Today)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const existingTodayExpenses = await prisma.expense.count({
    where: {
      status: 'POSTED',
      date: { gte: todayStart, lte: todayEnd },
    },
  });

  if (existingTodayExpenses === 0) {
    console.log('[Seed] Seeding realistic operating expenses for today...');
    let catUtilities = await prisma.expenseCategory.findFirst({ where: { name: 'Utilities', status: 'ACTIVE' } });
    if (!catUtilities) {
      catUtilities = await prisma.expenseCategory.create({
        data: { name: 'Utilities', description: 'Electricity, Water, Internet', status: 'ACTIVE' },
      });
    }

    let catOffice = await prisma.expenseCategory.findFirst({ where: { name: 'Office Supplies', status: 'ACTIVE' } });
    if (!catOffice) {
      catOffice = await prisma.expenseCategory.create({
        data: { name: 'Office Supplies', description: 'Packaging and store materials', status: 'ACTIVE' },
      });
    }

    let catMisc = await prisma.expenseCategory.findFirst({ where: { name: 'Miscellaneous', status: 'ACTIVE' } });
    if (!catMisc) {
      catMisc = await prisma.expenseCategory.create({
        data: { name: 'Miscellaneous', description: 'General sundry store expenses', status: 'ACTIVE' },
      });
    }

    await expenseService.createExpense(
      {
        categoryId: catUtilities.id,
        amount: 1250,
        paymentMethod: 'CASH',
        date: new Date().toISOString(),
        description: 'Store electricity and backup inverter diesel',
        reference: 'EB-BILL-2026-SEP',
      },
      adminUserId
    );

    await expenseService.createExpense(
      {
        categoryId: catOffice.id,
        amount: 550,
        paymentMethod: 'UPI',
        date: new Date().toISOString(),
        description: 'Biodegradable carry bags and thermal receipt paper rolls',
        reference: 'UPI-PKG-4821',
      },
      adminUserId
    );

    await expenseService.createExpense(
      {
        categoryId: catMisc.id,
        amount: 240,
        paymentMethod: 'CASH',
        date: new Date().toISOString(),
        description: 'Staff daily tea, refreshments and water cans',
        reference: 'CASH-TEA-DAILY',
      },
      adminUserId
    );
    console.log('[Seed] Seeded 3 realistic operating expenses for today.');
  }

  console.log('[Seed] Complete Mixed Store Retail Catalog & Transaction initialization finished successfully!');
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedCatalog()
    .catch((e) => {
      console.error('[Seed] Error during seeding:', e);
      process.exit(1);
    });
}
