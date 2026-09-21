import { AppSettingsDTO } from '../../../shared/types';

/**
 * Centralized currency formatting utility for RS Inventory – Solo.
 * Strictly respects configured currency symbol, decimal places, separators, and symbol position.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  settings?: AppSettingsDTO | null
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  const safeNum = isNaN(num) ? 0 : num;

  const symbol = settings?.currency?.symbol || settings?.company?.currencySymbol || '₹';
  const decimals = settings?.currency?.decimalPlaces ?? 2;
  const thousandSep = settings?.currency?.thousandSeparator ?? ',';
  const decimalSep = settings?.currency?.decimalSeparator ?? '.';
  const position = settings?.currency?.symbolPosition ?? 'prefix';

  // Format fixed decimals
  const isNegative = safeNum < 0;
  const fixed = Math.abs(safeNum).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Group thousands
  const regex = /\B(?=(\d{3})+(?!\d))/g;
  const formattedInt = intPart.replace(regex, thousandSep);

  const formattedNum = decimals > 0 ? `${formattedInt}${decimalSep}${decPart}` : formattedInt;
  const sign = isNegative ? '-' : '';

  if (position === 'suffix') {
    return `${sign}${formattedNum} ${symbol}`;
  }
  return `${sign}${symbol}${formattedNum}`;
}
