import { WeighingScaleSettings } from '../types';

export type UnitCategory = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH';

export interface UnitMetadata {
  code: string;
  name: string;
  category: UnitCategory;
  allowDecimal: boolean;
  precision: number;
  conversionFactor: number; // Factor to multiply by to convert to base unit
  baseUnitCode: string;
}

/**
 * Standard unit metadata catalogue.
 * Authoritative registry for RS Inventory Solo unit classification, conversion factors, and precision.
 */
export const STANDARD_UNITS: Record<string, UnitMetadata> = {
  // --- WEIGHT ---
  KG: {
    code: 'KG',
    name: 'Kilogram',
    category: 'WEIGHT',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 1,
    baseUnitCode: 'KG',
  },
  G: {
    code: 'G',
    name: 'Gram',
    category: 'WEIGHT',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 0.001,
    baseUnitCode: 'KG',
  },
  MG: {
    code: 'MG',
    name: 'Milligram',
    category: 'WEIGHT',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 0.000001,
    baseUnitCode: 'KG',
  },

  // --- VOLUME ---
  LTR: {
    code: 'LTR',
    name: 'Liter',
    category: 'VOLUME',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 1,
    baseUnitCode: 'LTR',
  },
  L: {
    code: 'L',
    name: 'Liter',
    category: 'VOLUME',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 1,
    baseUnitCode: 'LTR',
  },
  ML: {
    code: 'ML',
    name: 'Milliliter',
    category: 'VOLUME',
    allowDecimal: true,
    precision: 3,
    conversionFactor: 0.001,
    baseUnitCode: 'LTR',
  },

  // --- LENGTH ---
  MTR: {
    code: 'MTR',
    name: 'Meter',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 1,
    baseUnitCode: 'MTR',
  },
  M: {
    code: 'M',
    name: 'Meter',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 1,
    baseUnitCode: 'MTR',
  },
  CM: {
    code: 'CM',
    name: 'Centimeter',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 0.01,
    baseUnitCode: 'MTR',
  },
  MM: {
    code: 'MM',
    name: 'Millimeter',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 0.001,
    baseUnitCode: 'MTR',
  },
  INCH: {
    code: 'INCH',
    name: 'Inch',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 0.0254,
    baseUnitCode: 'MTR',
  },
  FOOT: {
    code: 'FOOT',
    name: 'Foot',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 0.3048,
    baseUnitCode: 'MTR',
  },
  YARD: {
    code: 'YARD',
    name: 'Yard',
    category: 'LENGTH',
    allowDecimal: true,
    precision: 2,
    conversionFactor: 0.9144,
    baseUnitCode: 'MTR',
  },

  // --- COUNT / PIECE ---
  PCS: {
    code: 'PCS',
    name: 'Piece',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  PC: {
    code: 'PC',
    name: 'Piece',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  PIECE: {
    code: 'PIECE',
    name: 'Piece',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  BOX: {
    code: 'BOX',
    name: 'Box',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  PACK: {
    code: 'PACK',
    name: 'Pack',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  CASE: {
    code: 'CASE',
    name: 'Case',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: 'PCS',
  },
  DOZEN: {
    code: 'DOZEN',
    name: 'Dozen',
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 12,
    baseUnitCode: 'PCS',
  },
};

/**
 * Normalizes unit code string for lookup.
 */
export function normalizeUnitCode(code?: string | null): string {
  if (!code) return 'PCS';
  return code.trim().toUpperCase();
}

/**
 * Resolves unit metadata from registry or returns sensible defaults.
 */
export function getUnitMetadata(code?: string | null): UnitMetadata {
  const normalized = normalizeUnitCode(code);
  if (STANDARD_UNITS[normalized]) {
    return STANDARD_UNITS[normalized];
  }
  // Fallback for custom units
  return {
    code: normalized,
    name: normalized,
    category: 'COUNT',
    allowDecimal: false,
    precision: 0,
    conversionFactor: 1,
    baseUnitCode: normalized,
  };
}

/**
 * Rounds quantity deterministically using EPSILON compensation.
 * Prevents IEEE-754 binary floating point jitter like 48.400000000000006.
 */
export function roundQuantity(val: number, precision = 4): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
    return 0;
  }
  const factor = Math.pow(10, precision);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Rounds monetary amounts deterministically to 2 decimal places (or configured precision).
 */
export function roundMoney(amount: number, precision = 2): number {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return 0;
  }
  const factor = Math.pow(10, precision);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/**
 * Validates a quantity against business constraints and unit classification.
 */
export function validateQuantity(
  quantity: number,
  options?: {
    allowDecimal?: boolean;
    precision?: number;
    unitCode?: string;
    maxQuantity?: number;
  }
): { valid: boolean; error?: string } {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return { valid: false, error: 'Quantity must be a valid number (NaN received).' };
  }

  if (!isFinite(quantity)) {
    return { valid: false, error: 'Quantity must be a finite number (Infinity received).' };
  }

  if (quantity <= 0) {
    return { valid: false, error: 'Quantity must be greater than zero.' };
  }

  if (options?.maxQuantity && quantity > options.maxQuantity) {
    return { valid: false, error: `Quantity cannot exceed maximum allowed limit of ${options.maxQuantity}.` };
  }

  const unitMeta = options?.unitCode ? getUnitMetadata(options.unitCode) : null;
  const allowDecimal = options?.allowDecimal ?? unitMeta?.allowDecimal ?? false;
  const precision = options?.precision ?? unitMeta?.precision ?? (allowDecimal ? 4 : 0);

  if (!allowDecimal && !Number.isInteger(quantity)) {
    const unitName = unitMeta?.name || 'Pieces';
    return {
      valid: false,
      error: `Decimal/fractional quantities are not permitted for ${unitName} (${unitMeta?.code || 'COUNT'}). Please enter a whole integer.`,
    };
  }

  if (allowDecimal && precision >= 0) {
    // Check if fractional part exceeds allowed precision
    const rounded = roundQuantity(quantity, precision);
    const diff = Math.abs(quantity - rounded);
    if (diff > 1e-9) {
      return {
        valid: false,
        error: `Quantity precision exceeds maximum allowed limit of ${precision} decimal places.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Compares two quantities with an epsilon tolerance (1e-6).
 * Returns -1 if q1 < q2, 1 if q1 > q2, and 0 if equal.
 */
export function compareQuantities(q1: number, q2: number, precision = 4): number {
  const rounded1 = roundQuantity(q1, precision);
  const rounded2 = roundQuantity(q2, precision);
  const diff = rounded1 - rounded2;

  if (Math.abs(diff) < 1e-6) {
    return 0;
  }
  return diff > 0 ? 1 : -1;
}

/**
 * Converts a quantity from one unit to another within the same category.
 * Throws an Error if units belong to different categories (e.g. WEIGHT to COUNT).
 */
export function convertQuantity(quantity: number, fromUnitCode: string, toUnitCode: string): number {
  const fromMeta = getUnitMetadata(fromUnitCode);
  const toMeta = getUnitMetadata(toUnitCode);

  if (fromMeta.category !== toMeta.category) {
    throw new Error(
      `Incompatible unit conversion: Cannot convert between ${fromMeta.category} (${fromMeta.code}) and ${toMeta.category} (${toMeta.code}).`
    );
  }

  if (fromMeta.code === toMeta.code) {
    return quantity;
  }

  // Convert to category base unit first, then into target unit
  const inBase = quantity * fromMeta.conversionFactor;
  const inTarget = inBase / toMeta.conversionFactor;

  return roundQuantity(inTarget, toMeta.precision);
}

/**
 * Normalizes quantity to its category's base unit.
 * Example: 100g -> 0.1kg; 250g -> 0.25kg; 1.5kg -> 1.5kg; 1000ml -> 1l.
 */
export function normalizeQuantity(
  quantity: number,
  fromUnitCode: string,
  targetBaseUnitCode?: string
): number {
  const fromMeta = getUnitMetadata(fromUnitCode);
  const targetCode = targetBaseUnitCode ? normalizeUnitCode(targetBaseUnitCode) : fromMeta.baseUnitCode;
  return convertQuantity(quantity, fromUnitCode, targetCode);
}

/**
 * Calculates loose quantity from a given monetary amount ("Sell by Amount").
 * Example: Customer asks for ₹100 of rice at ₹120/kg -> 100 / 120 = 0.8333... -> 0.833 kg
 */
export function calculateSellByAmount(amount: number, unitPrice: number, precision = 3): number {
  if (amount <= 0 || unitPrice <= 0) {
    return 0;
  }
  const rawQty = amount / unitPrice;
  return roundQuantity(rawQty, precision);
}

/**
 * Formats a numeric quantity with proper decimal precision and unit label.
 * Example: formatQuantity(1.5, 'KG') -> "1.500 KG" or "1.5 KG"
 */
export function formatQuantity(quantity: number, unitCode?: string, precision?: number): string {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return `0 ${unitCode || ''}`.trim();
  }

  const meta = unitCode ? getUnitMetadata(unitCode) : null;
  const unitLabel = meta?.code || unitCode || '';
  const decimalPlaces = precision !== undefined ? precision : meta?.precision ?? (Number.isInteger(quantity) ? 0 : 3);

  // If integer and no precision specified, format as integer
  if (precision === undefined && Number.isInteger(quantity)) {
    return unitLabel ? `${quantity} ${unitLabel}` : `${quantity}`;
  }

  // Format with fixed decimals if decimal places > 0
  const formatted = quantity.toFixed(decimalPlaces);
  // Strip trailing zeros if wanted, or retain for standard weight
  const cleanNum = decimalPlaces > 0 ? formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : formatted;

  return unitLabel ? `${cleanNum} ${unitLabel}` : cleanNum;
}

/**
 * Formats unit selling price with unit code.
 * Example: formatUnitPrice(120, 'KG') -> "₹120.00 / KG"
 */
export function formatUnitPrice(unitPrice: number, unitCode?: string, currencySymbol = '₹'): string {
  const safePrice = roundMoney(unitPrice);
  const unit = unitCode ? getUnitMetadata(unitCode).code : 'unit';
  return `${currencySymbol}${safePrice.toFixed(2)} / ${unit}`;
}

/**
 * Weighing Scale Barcode Parser.
 * Embedded barcode flow: Scale -> Barcode -> PLU & Weight/Price -> Product match -> Cart quantity.
 */
export function parseScaleBarcode(
  barcode: string,
  settings: WeighingScaleSettings
): {
  valid: boolean;
  plu?: string;
  value?: number;
  embeddedValue?: 'WEIGHT' | 'TOTAL_PRICE';
  error?: string;
} {
  if (!settings || !settings.enabled) {
    return { valid: false, error: 'Weighing scale is disabled in settings' };
  }

  const prefix = settings.prefix || '20';
  if (!barcode.startsWith(prefix)) {
    return { valid: false, error: `Barcode does not match scale prefix "${prefix}"` };
  }

  try {
    let offset = prefix.length;
    const pluDigits = settings.pluDigits || 5;
    const plu = barcode.slice(offset, offset + pluDigits);
    offset += pluDigits + (settings.digitsToSkip || 0);

    const valueDigits = settings.valueDigits || 5;
    const rawVal = barcode.slice(offset, offset + valueDigits);
    const valueDecimals = settings.valueDecimals !== undefined ? settings.valueDecimals : 3;
    const divisor = Math.pow(10, valueDecimals);
    const parsedVal = parseInt(rawVal, 10) / divisor;

    if (isNaN(parsedVal) || parsedVal <= 0) {
      return { valid: false, error: 'Failed to extract valid numeric weight/price from scale barcode' };
    }

    return {
      valid: true,
      plu,
      value: roundQuantity(parsedVal, valueDecimals),
      embeddedValue: settings.embeddedValue || 'WEIGHT',
    };
  } catch (err: any) {
    return { valid: false, error: `Scale barcode parse error: ${err?.message || 'Invalid barcode structure'}` };
  }
}
