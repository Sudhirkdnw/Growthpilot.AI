import { ProductImportRow } from '../../../shared/types';

/**
 * Escapes a cell value for RFC 4180 CSV format.
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports data rows to CSV file and triggers automatic browser download.
 * Includes UTF-8 BOM so Microsoft Excel correctly displays Hindi/Unicode characters.
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, any>[],
  columns: { key: string; label: string }[]
): void {
  const headerLine = columns.map((col) => escapeCsvCell(col.label)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key] ?? '')).join(',')
  );

  // UTF-8 BOM (\uFEFF) ensures Excel reads UTF-8 correctly
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a clean, ready-to-use sample CSV template for products.
 */
export function downloadSampleCsvTemplate(): void {
  const headers = [
    'Product Name*',
    'SKU (or leave AUTO)',
    'Barcode',
    'Sale Price*',
    'Cost Price',
    'MRP',
    'Category',
    'Brand',
    'Unit (e.g. PCS, KG)',
    'Tax Rate (%)',
    'Opening Stock',
    'Reorder Alert Level',
    'Status (ACTIVE/INACTIVE)',
    'Image URL',
  ];

  const sampleRows = [
    [
      'Basmati Rice 1kg',
      'RICE-001',
      '8901030012345',
      '120.00',
      '95.00',
      '130.00',
      'Groceries',
      'Fortune',
      'KG',
      '5',
      '50',
      '10',
      'ACTIVE',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c',
    ],
    [
      'Coca Cola 750ml',
      'COLA-750',
      '8901764012221',
      '40.00',
      '32.00',
      '40.00',
      'Beverages',
      'Coca-Cola',
      'PCS',
      '12',
      '100',
      '20',
      'ACTIVE',
      '',
    ],
    [
      'Parle-G Biscuit 100g',
      'PARLE-G-100',
      '8901719114002',
      '10.00',
      '8.50',
      '10.00',
      'Snacks',
      'Parle',
      'PCS',
      '0',
      '150',
      '25',
      'ACTIVE',
      '',
    ],
  ];

  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = sampleRows.map((r) => r.map(escapeCsvCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'sample_products_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust RFC 4180 CSV parser supporting multiline fields, escaped quotes (""), and varied line endings.
 */
export function parseCsv(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ''); // Strip BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // skip next quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n of \r\n
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += char;
      }
    }
  }

  // Push remainder
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Flexible header alias mappings.
 */
const HEADER_ALIASES: Record<keyof ProductImportRow, string[]> = {
  name: ['product name', 'productname', 'name', 'item name', 'itemname', 'title'],
  sku: ['sku', 'product code', 'productcode', 'item code', 'itemcode', 'code'],
  barcode: ['barcode', 'bar code', 'upc', 'ean', 'isbn'],
  salePrice: ['sale price', 'saleprice', 'selling price', 'sellingprice', 'price', 'rate', 'sp'],
  purchasePrice: ['cost price', 'costprice', 'purchase price', 'purchaseprice', 'buy price', 'cost', 'cp'],
  mrp: ['mrp', 'maximum retail price', 'retail price'],
  categoryName: ['category', 'category name', 'categoryname', 'group'],
  brandName: ['brand', 'brand name', 'brandname', 'make', 'company'],
  unitCode: ['unit', 'unit name', 'uom', 'measure', 'measurement unit'],
  taxRate: ['tax rate', 'taxrate', 'tax', 'tax %', 'gst', 'gst %', 'vat'],
  openingStock: ['opening stock', 'openingstock', 'stock', 'qty', 'quantity', 'initial stock'],
  reorderLevel: ['reorder level', 'reorderlevel', 'min stock', 'alert level', 'reorder'],
  status: ['status', 'active', 'state'],
  imageUrl: ['image', 'image url', 'imageurl', 'photo', 'picture', 'photo url', 'link'],
};

/**
 * Normalizes CSV rows into structured ProductImportRow objects with intelligent column matching.
 */
export function normalizeProductRows(
  csvRows: string[][]
): { products: ProductImportRow[]; headers: string[]; unmappedColumns: string[] } {
  if (!csvRows || csvRows.length < 2) {
    return { products: [], headers: [], unmappedColumns: [] };
  }

  const rawHeaders = csvRows[0].map((h) => h.trim());
  const headerMap = new Map<number, keyof ProductImportRow>();
  const unmappedColumns: string[] = [];

  rawHeaders.forEach((rawHeader, colIndex) => {
    const cleanHeader = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matchedKey: keyof ProductImportRow | null = null;

    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (
        aliases.some(
          (alias) => alias.replace(/[^a-z0-9]/g, '') === cleanHeader
        )
      ) {
        matchedKey = key as keyof ProductImportRow;
        break;
      }
    }

    if (matchedKey) {
      headerMap.set(colIndex, matchedKey);
    } else {
      unmappedColumns.push(rawHeader);
    }
  });

  const products: ProductImportRow[] = [];

  for (let r = 1; r < csvRows.length; r++) {
    const row = csvRows[r];
    if (row.length === 0 || row.every((c) => !c.trim())) continue; // skip blank rows

    const product: any = {};

    headerMap.forEach((key, colIndex) => {
      const val = row[colIndex] ?? '';
      if (key === 'salePrice' || key === 'purchasePrice' || key === 'mrp' || key === 'taxRate' || key === 'openingStock' || key === 'reorderLevel') {
        const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
        product[key] = isNaN(num) ? undefined : num;
      } else if (key === 'status') {
        const s = val.toUpperCase().trim();
        product[key] = s === 'INACTIVE' || s === 'NO' || s === 'FALSE' ? 'INACTIVE' : 'ACTIVE';
      } else {
        product[key] = val.trim();
      }
    });

    products.push(product as ProductImportRow);
  }

  return { products, headers: rawHeaders, unmappedColumns };
}
