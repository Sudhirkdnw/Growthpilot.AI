/**
 * Centralized utility to convert numeric amounts into words.
 * Standard format for financial receipts and invoices (Indian / International Rupee format).
 * Example: 12450.50 -> "Rupees Twelve Thousand Four Hundred Fifty and Fifty Paise Only"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const unit = n % 10;
    return TENS[Math.floor(n / 10)] + (unit ? ' ' + ONES[unit] : '');
  }
  const remainder = n % 100;
  return (
    ONES[Math.floor(n / 100)] +
    ' Hundred' +
    (remainder ? ' ' + convertLessThanThousand(remainder) : '')
  );
}

/**
 * Converts a positive integer into words using the Indian numbering scale (Crore, Lakh, Thousand, Hundred).
 */
function convertIntegerToWords(num: number): string {
  if (num === 0) return 'Zero';

  let result = '';
  let n = Math.floor(num);

  // Crores (1,00,00,000)
  const crores = Math.floor(n / 10000000);
  if (crores > 0) {
    result += convertIntegerToWords(crores) + ' Crore ';
    n %= 10000000;
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(n / 100000);
  if (lakhs > 0) {
    result += convertLessThanThousand(lakhs) + ' Lakh ';
    n %= 100000;
  }

  // Thousands (1,000)
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    result += convertLessThanThousand(thousands) + ' Thousand ';
    n %= 1000;
  }

  // Hundreds & remaining
  if (n > 0) {
    result += convertLessThanThousand(n);
  }

  return result.trim();
}

/**
 * Converts a currency amount (with optional decimal paise/cents) into words.
 *
 * @param amount - The numerical amount to format
 * @param currencyName - e.g. "Rupees", "Dollars", etc. Default "Rupees"
 * @param fractionName - e.g. "Paise", "Cents", etc. Default "Paise"
 */
export function amountToWords(
  amount: number,
  currencyName: string = 'Rupees',
  fractionName: string = 'Paise'
): string {
  if (isNaN(amount)) return 'Zero ' + currencyName + ' Only';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const integerPart = Math.floor(absAmount);
  // Round to 2 decimal places for cents/paise
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  const integerWords = convertIntegerToWords(integerPart);

  let result = (isNegative ? 'Minus ' : '') + currencyName + ' ' + integerWords;

  if (decimalPart > 0) {
    const decimalWords = convertLessThanThousand(decimalPart);
    result += ' and ' + decimalWords + ' ' + fractionName;
  }

  result += ' Only';

  // Capitalize neatly and remove any double spaces
  return result.replace(/\s+/g, ' ').trim();
}
