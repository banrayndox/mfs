/**
 * Format poisha into BDT currency string
 * @param {number} poisha - Integer poisha
 * @param {string} locale - 'bn' or 'en'
 * @returns {string} Formatted BDT string e.g. ৳ ২,৫৪০.০০ or ৳ 2,540.00
 */
export function formatCurrency(poisha, locale = 'bn') {
  const bdt = (poisha || 0) / 100;
  const localeString = locale === 'bn' ? 'bn-BD' : 'en-BD';
  const formattedNumber = new Intl.NumberFormat(localeString, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bdt);

  return `৳ ${formattedNumber}`;
}

/**
 * Format plain numbers using locale digits
 * @param {number} num 
 * @param {string} locale 
 * @returns {string}
 */
export function formatNumber(num, locale = 'bn') {
  const localeString = locale === 'bn' ? 'bn-BD' : 'en-BD';
  return new Intl.NumberFormat(localeString).format(num);
}
