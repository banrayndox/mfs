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

// Word-to-number dictionary for Bengali, English, and Banglish numbers
const WORD_NUMBER_MAP = [
  // Banglish / Romanized compound numbers
  { regex: /(?:ek\s*lakh|1\s*lakh|one\s*lakh|এক\s*লাখ|1\s*লাখ)/gi, value: 100000 },
  { regex: /(?:ponchash\s*(?:hazar|hajar)|fifty\s*thousand|পঞ্চাশ\s*হাজার)/gi, value: 50000 },
  { regex: /(?:bish\s*(?:hazar|hajar)|twenty\s*thousand|বিশ\s*হাজার)/gi, value: 20000 },
  { regex: /(?:ponero\s*(?:hazar|hajar)|fifteen\s*thousand|পনেরো\s*হাজার)/gi, value: 15000 },
  { regex: /(?:dosh\s*(?:hazar|hajar)|ten\s*thousand|দশ\s*হাজার)/gi, value: 10000 },
  { regex: /(?:pach\s*(?:hazar|hajar)|five\s*thousand|পাঁচ\s*হাজার)/gi, value: 5000 },
  { regex: /(?:char\s*(?:hazar|hajar)|four\s*thousand|চার\s*হাজার)/gi, value: 4000 },
  { regex: /(?:tin\s*(?:hazar|hajar)|three\s*thousand|তিন\s*হাজার)/gi, value: 3000 },
  { regex: /(?:dui\s*(?:hazar|hajar)|two\s*thousand|দুই\s*হাজার)/gi, value: 2000 },
  { regex: /(?:ek\s*(?:hazar|hajar)|one\s*thousand|এক\s*হাজার)/gi, value: 1000 },

  // Hundreds in Bangla, English, Banglish
  { regex: /(?:shada\s*charsho|সাড়ে\s*চারশো|সাড়ে\s*চার\s*শত)/gi, value: 450 },
  { regex: /(?:shada\s*tinsho|সাড়ে\s*তিনশো|সাড়ে\s*তিন\s*শত)/gi, value: 350 },
  { regex: /(?:araisho|adaisho|আড়াইশো|আড়াই\s*শত)/gi, value: 250 },
  { regex: /(?:dersho|দেড়শো|দেড়\s*শত)/gi, value: 150 },

  { regex: /(?:noysho|nine\s*hundred|নয়শো|নয়\s*শত)/gi, value: 900 },
  { regex: /(?:aatsho|eight\s*hundred|আটশো|আট\s*শত)/gi, value: 800 },
  { regex: /(?:shaatsho|seven\s*hundred|সাতশো|সাত\s*শত)/gi, value: 700 },
  { regex: /(?:choysho|six\s*hundred|ছয়শো|ছয়\s*শত)/gi, value: 600 },
  { regex: /(?:pachsho|five\s*hundred|পাঁচশো|পাঁচ\s*শত|পাঁচ\s*শ)/gi, value: 500 },
  { regex: /(?:charsho|four\s*hundred|চারশো|চার\s*শত)/gi, value: 400 },
  { regex: /(?:tinsho|three\s*hundred|তিনশো|তিন\s*শত)/gi, value: 300 },
  { regex: /(?:duisho|two\s*hundred|দুইশো|দুই\s*শত|দু\s*শো)/gi, value: 200 },
  { regex: /(?:eksho|one\s*hundred|একশো|এক\s*শত)/gi, value: 100 },

  // Standalone words
  { regex: /\b(?:hazar|hajar|হাজার)\b/gi, value: 1000 },
  { regex: /\b(?:ponchash|pochash|fifty|পঞ্চাশ)\b/gi, value: 50 },
  { regex: /\b(?:chollish|forty|চল্লিশ)\b/gi, value: 40 },
  { regex: /\b(?:trish|thirty|ত্রিশ)\b/gi, value: 30 },
  { regex: /\b(?:bish|kuri|twenty|বিশ)\b/gi, value: 20 },
  { regex: /\b(?:dosh|ten|দশ)\b/gi, value: 10 },
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

  // Handle number + k (e.g. '5k' -> '5000', '2.5k' -> '2500')
  result = result.replace(/([0-9]+(?:\.[0-9]+)?)\s*k(?![a-zA-Z0-9_\u0980-\u09FF])/gi, (_m, num) => {
    return ` ${Math.round(parseFloat(num) * 1000)} `;
  });

  // Handle number + হাজার / hazar / thousand
  result = result.replace(/([0-9]+)\s*(?:হাজার|hazar|hajar|thousand)(?![a-zA-Z0-9_\u0980-\u09FF])/gi, (_m, num) => {
    return ` ${parseInt(num, 10) * 1000} `;
  });

  // Handle number + লাখ / lakh
  result = result.replace(/([0-9]+)\s*(?:লাখ|lakh|lac)(?![a-zA-Z0-9_\u0980-\u09FF])/gi, (_m, num) => {
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

  // 0. Unicode NFC normalization and Bengali character allograph unification
  let normalized = text.normalize('NFC').replace(/য়/g, 'য়');

  // 1. Bengali digits -> Western digits
  normalized = convertBengaliDigits(normalized);

  // 2. Number words and multipliers -> digits
  normalized = convertNumberWords(normalized);

  // 3. Normalize currency markers: ৳, টাকা, tk, taka -> standard spacing
  normalized = normalized.replace(/৳\s*([0-9]+)/g, '$1 taka');
  normalized = normalized.replace(/(?:tk|bdt)\s*([0-9]+)/gi, '$1 taka');
  normalized = normalized.replace(/([0-9]+)\s*(?:টাকা|টাকার|টাকায়|tk|taka|bdt|\/-)/gi, '$1 taka');

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

/**
 * Extracts key financial slots from user utterances across Bangla, Banglish, and English.
 * Supports: amount, recipient, frequency, category, biller, percentage, targetAmount.
 * @param {string} text
 * @returns {object} Extracted slots
 */
export function extractFinancialSlots(text) {
  if (!text || typeof text !== 'string') return {};

  const normalized = normalizeInput(text);
  const lower = normalized.toLowerCase();
  const slots = {};

  // 1. Amount Extraction
  const poisha = extractAmountInPoisha(text);
  if (poisha !== null) {
    slots.amountPoisha = poisha;
    slots.amount = poisha / 100;
  }

  // 2. Recipient / Counterparty Extraction (Phone number or relationship alias)
  const phoneMatch = normalized.match(/(?:\+?88)?(01[3-9][0-9]{8})/);
  if (phoneMatch) {
    slots.recipient = phoneMatch[1];
    slots.recipientPhone = phoneMatch[1];
  } else {
    // Relationship / Named recipient tokens in Bangla, English, Banglish
    const recipientKeywords = [
      { pattern: /(?:আমার\s*মেয়ে|মেয়েকে|meye\s*ke|daughter)/i, value: 'daughter' },
      { pattern: /(?:আমার\s*ছেলে|ছেলেকে|chele\s*ke|son)/i, value: 'son' },
      { pattern: /(?:আম্মু|মাকে|ammu|ma|mother|mom)/i, value: 'mother' },
      { pattern: /(?:আব্বু|বাবাকে|abbu|baba|father|dad)/i, value: 'father' },
      { pattern: /(?:বোন|bon|sister)/i, value: 'sister' },
      { pattern: /(?:ভাই|bhai|brother)/i, value: 'brother' },
      { pattern: /(?:বন্ধু|bondhu|friend)/i, value: 'friend' },
      { pattern: /(?:স্ত্রী|bou|wife)/i, value: 'wife' },
    ];
    for (const r of recipientKeywords) {
      if (r.pattern.test(normalized)) {
        slots.recipient = r.value;
        slots.recipientLabel = r.value;
        break;
      }
    }
  }

  // 3. Frequency Extraction
  if (/(?:প্রতিদিন|daily|every\s*day|protidin)/i.test(lower)) {
    slots.frequency = 'daily';
  } else if (/(?:সাপ্তাহিক|weekly|every\s*week|shoptahik|shukrobar|shonibar|শুক্রবার)/i.test(lower)) {
    slots.frequency = 'weekly';
  } else if (/(?:মাসিক|monthly|every\s*month|mashik|protimaash|shob\s*mashe|প্রতি\s*মাসে)/i.test(lower)) {
    slots.frequency = 'monthly';
  }

  // 4. Biller / Utility Provider Extraction
  if (lower.includes('desco') || lower.includes('ডেসকো')) {
    slots.biller = 'DESCO';
  } else if (lower.includes('dpdc') || lower.includes('ডিপিডিসি')) {
    slots.biller = 'DPDC';
  } else if (lower.includes('wasa') || lower.includes('ওয়াসা') || lower.includes('ওয়াসা')) {
    slots.biller = 'WASA';
  } else if (lower.includes('titas') || lower.includes('তিতাস')) {
    slots.biller = 'TITAS';
  } else if (lower.includes('nesco') || lower.includes('নেসকো')) {
    slots.biller = 'NESCO';
  } else if (lower.includes('carnival') || lower.includes('কার্নিভাল')) {
    slots.biller = 'CARNIVAL';
  } else if (/(?:বিদ্যুৎ|electricity|current|biddut)/i.test(lower)) {
    slots.biller = 'DPDC';
  } else if (/(?:পানি|water|pani)/i.test(lower)) {
    slots.biller = 'WASA';
  } else if (/(?:গ্যাস|gas)/i.test(lower)) {
    slots.biller = 'TITAS';
  } else if (/(?:ইন্টারনেট|internet)/i.test(lower)) {
    slots.biller = 'CARNIVAL';
  }

  // 5. Category Extraction
  const categories = [
    { pattern: /(?:খাবার|food|restaurant|khabar|lunch|dinner|breakfast)/i, value: 'food' },
    { pattern: /(?:শপিং|shopping|cloth|dress|market)/i, value: 'shopping' },
    { pattern: /(?:মুদি|grocery|bazar|kachabazar)/i, value: 'groceries' },
    { pattern: /(?:বিল|bill|utility)/i, value: 'bills' },
    { pattern: /(?:চিকিৎসা|medicine|doctor|hospital|osukh)/i, value: 'health' },
    { pattern: /(?:শিক্ষা|education|school|college|tuition)/i, value: 'education' },
    { pattern: /(?:ভ্রমণ|travel|transport|uber|pathao|rickshaw|bus)/i, value: 'transport' },
  ];
  for (const c of categories) {
    if (c.pattern.test(lower)) {
      slots.category = c.value;
      break;
    }
  }

  // 6. Percentage Extraction
  const pctMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:%|percent|শতাংশ|shatangsho)/i);
  if (pctMatch) {
    slots.percentage = parseFloat(pctMatch[1]);
  }

  // 7. Savings Target Goal
  const targetMatch = normalized.match(/(?:for\s+a\s+|for\s+|জন্য\s+|target\s+)([a-zA-Z\u0980-\u09FF\s]{3,20}?)(?:\s*(?:kinbo|kinte|buy|korte|$))/i);
  if (targetMatch && !slots.category) {
    slots.targetDescription = targetMatch[1].trim();
  }

  return slots;
}

export default {
  convertBengaliDigits,
  convertNumberWords,
  normalizeInput,
  extractAmountInPoisha,
  extractFinancialSlots,
};
