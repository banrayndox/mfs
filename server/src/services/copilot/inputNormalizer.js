/**
 * @file inputNormalizer.js
 * Normalizes user text and voice STT inputs across Bangla, English, and Banglish.
 * Converts Bangla numerals and number words to standard integer amounts.
 */

// Bengali digit map to Western ASCII digits
const BN_DIGIT_MAP = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

// Word-to-number dictionary for Bengali and English numbers
const WORD_NUMBER_MAP = [
  // Compound / Large numbers first
  { regex: /(?:এক\s*লাখ|1\s*লাখ|one\s*lakh)/gi, value: 100000 },
  { regex: /(?:পঞ্চাশ\s*হাজার|fifty\s*thousand)/gi, value: 50000 },
  { regex: /(?:বিশ\s*হাজার|twenty\s*thousand)/gi, value: 20000 },
  { regex: /(?:পনেরো\s*হাজার|fifteen\s*thousand)/gi, value: 15000 },
  { regex: /(?:দশ\s*হাজার|ten\s*thousand)/gi, value: 10000 },
  { regex: /(?:পাঁচ\s*হাজার|five\s*thousand)/gi, value: 5000 },
  { regex: /(?:চার\s*হাজার|four\s*thousand)/gi, value: 4000 },
  { regex: /(?:তিন\s*হাজার|three\s*thousand)/gi, value: 3000 },
  { regex: /(?:দুই\s*হাজার|two\s*thousand)/gi, value: 2000 },
  { regex: /(?:এক\s*হাজার|one\s*thousand)/gi, value: 1000 },

  // Hundreds
  { regex: /(?:সাড়ে\s*চারশো|সাড়ে\s*চার\s*শত)/gi, value: 450 },
  { regex: /(?:সাড়ে\s*তিনশো|সাড়ে\s*তিন\s*শত)/gi, value: 350 },
  { regex: /(?:আড়াইশো|আড়াই\s*শত)/gi, value: 250 },
  { regex: /(?:দেড়শো|দেড়\s*শত)/gi, value: 150 },

  { regex: /(?:নয়শো|নয়\s*শত|nine\s*hundred)/gi, value: 900 },
  { regex: /(?:আটশো|আট\s*শত|eight\s*hundred)/gi, value: 800 },
  { regex: /(?:সাতশো|সাত\s*শত|seven\s*hundred)/gi, value: 700 },
  { regex: /(?:ছয়শো|ছয়\s*শত|six\s*hundred)/gi, value: 600 },
  { regex: /(?:পাঁচশো|পাঁচ\s*শত|পাঁচ\s*শ|five\s*hundred)/gi, value: 500 },
  { regex: /(?:চারশো|চার\s*শত|four\s*hundred)/gi, value: 400 },
  { regex: /(?:তিনশো|তিন\s*শত|three\s*hundred)/gi, value: 300 },
  { regex: /(?:দুইশো|দুই\s*শত|দু\s*শো|two\s*hundred)/gi, value: 200 },
  { regex: /(?:একশো|এক\s*শত|one\s*hundred)/gi, value: 100 },

  // Standalone words
  { regex: /\b(?:হাজার)\b/gi, value: 1000 },
  { regex: /(?:পঞ্চাশ|fifty)/gi, value: 50 },
  { regex: /(?:চল্লিশ|forty)/gi, value: 40 },
  { regex: /(?:ত্রিশ|thirty)/gi, value: 30 },
  { regex: /(?:বিশ|twenty)/gi, value: 20 },
  { regex: /(?:দশ|ten)/gi, value: 10 },
];

/**
 * Replaces Bengali digits with Western digits (e.g. ৫০০ -> 500).
 * @param {string} text
 * @returns {string}
 */
export function convertBengaliDigits(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[০-৯]/g, (match) => BN_DIGIT_MAP[match] || match);
}

/**
 * Replaces textual number words (e.g. 'পাঁচশো', 'one thousand', '৫০ হাজার') with numeric digits.
 * @param {string} text
 * @returns {string}
 */
export function convertNumberWords(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  // Handle number + হাজার / thousand (e.g. '50 হাজার' -> '50000', '10 thousand' -> '10000')
  result = result.replace(/([0-9]+)\s*(?:হাজার|thousand)(?![a-zA-Z0-9_\u0980-\u09FF])/gi, (_m, num) => {
    return ` ${parseInt(num, 10) * 1000} `;
  });

  // Handle number + লাখ / lakh (e.g. '2 লাখ' -> '200000')
  result = result.replace(/([0-9]+)\s*(?:লাখ|lakh)(?![a-zA-Z0-9_\u0980-\u09FF])/gi, (_m, num) => {
    return ` ${parseInt(num, 10) * 100000} `;
  });

  for (const item of WORD_NUMBER_MAP) {
    result = result.replace(item.regex, ` ${item.value} `);
  }
  return result;
}

/**
 * Fully normalizes text for semantic processing:
 * 1. Converts Bengali digits to Western ASCII digits.
 * 2. Converts textual number words (Bangla and English) to digits.
 * 3. Normalizes whitespace and common currency labels.
 * @param {string} text
 * @returns {string}
 */
export function normalizeInput(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Bengali digits -> Western digits
  let normalized = convertBengaliDigits(text);

  // 2. Number words -> digits
  normalized = convertNumberWords(normalized);

  // 3. Normalize currency markers: ৳, টাকা, tk, taka -> standard spacing
  normalized = normalized.replace(/৳\s*([0-9]+)/g, '$1 taka');
  normalized = normalized.replace(/([0-9]+)\s*(?:টাকা|টাকার|টাকায়|tk|taka|bdt)/gi, '$1 taka');

  // 4. Clean extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extracts explicit BDT amounts in poisha (integer minor units).
 * Ignores clock times (e.g. '8 PM', '8:00 AM') and phone numbers.
 * @param {string} text
 * @returns {number|null} Amount in poisha, or null if none found
 */
export function extractAmountInPoisha(text) {
  if (!text || typeof text !== 'string') return null;

  const normalized = normalizeInput(text);

  // Pattern A: explicitly followed or preceded by currency marker (taka, ৳, tk)
  const currencyMatch =
    normalized.match(/(?:taka|tk|৳|bdt)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i) ||
    normalized.match(/([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(?:taka|tk|৳|bdt)/i);

  if (currencyMatch) {
    const rawNum = parseFloat(currencyMatch[1].replace(/,/g, ''));
    if (!isNaN(rawNum) && rawNum > 0) {
      return Math.round(rawNum * 100);
    }
  }

  // Pattern B: standalone number that is NOT a phone number (11 digits) or time (e.g. '8 pm')
  // Filter out time tokens like '8 PM', '10 AM', '12:30'
  const textWithoutTime = normalized.replace(
    /\b[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm|এএম|পিএম|সকাল|সন্ধ্যা|রাত|দুপুর)\b/gi,
    ''
  );
  // Filter out 11-digit Bangladeshi mobile numbers
  const textWithoutPhones = textWithoutTime.replace(/\b(?:01[3-9][0-9]{8}|\+8801[3-9][0-9]{8})\b/g, '');

  // Match numbers
  const matches = [...textWithoutPhones.matchAll(/\b([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\b/g)];
  for (const m of matches) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    // Reasonable transaction amount: between 1 and 500,000 BDT
    if (!isNaN(num) && num > 0 && num <= 500000) {
      return Math.round(num * 100);
    }
  }

  return null;
}

export default {
  convertBengaliDigits,
  convertNumberWords,
  normalizeInput,
  extractAmountInPoisha,
};
