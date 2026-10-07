/**
 * @file entityResolver.js
 * Deterministic Entity & Contact Resolver.
 * Resolves contacts, beneficiaries, agents, and recipients from the database.
 * Detects ambiguous contacts or missing phone numbers.
 */

import { User } from '../../models/index.js';
import { resolveAliasRecipient } from './memory.service.js';

/**
 * Normalizes phone numbers to standard 11-digit Bangladeshi format (01XXXXXXXXX).
 * @param {string} phone
 * @returns {string|null}
 */
export function normalizeBdPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const clean = phone.trim().replace(/^(\+880|880)/, '0').replace(/[^0-9]/g, '');
  if (/^01[3-9]\d{8}$/.test(clean)) {
    return clean;
  }
  return null;
}

export const BN_TO_EN_NAMES = {
  'রাকিব': 'rakib',
  'কানজিল': 'kanjil',
  'রহিম': 'rahim',
  'করিম': 'karim',
  'নাবিলা': 'nabila',
  'সাকিব': 'sakib',
  'হাসান': 'hasan',
  'আরিফ': 'arif',
  'তানভীর': 'tanvir',
  'তানভির': 'tanvir',
  'আফরিন': 'afrin',
  'সুমাইয়া': 'sumaiya',
  'কবির': 'kabir',
  'জাহিদ': 'zahid',
  'সাদিয়া': 'sadia',
};

/**
 * Deterministically resolves a recipient from query text or phone.
 * @param {string} recipientQuery
 * @param {string} senderUserId
 * @returns {Promise<{ resolved: boolean, user?: object, ambiguous?: boolean, matches?: object[], notFound?: boolean, query: string }>}
 */
export async function resolveRecipient(recipientQuery, senderUserId) {
  if (!recipientQuery || typeof recipientQuery !== 'string') {
    return { resolved: false, notFound: true, query: '' };
  }

  let cleanQuery = recipientQuery.trim().replace(/^(to|send to|কাকে|কে|পাঠাও)\s+/i, '');
  cleanQuery = cleanQuery.replace(/(?:-?ke|-?কে|-?re|-?রে|-?te|-?তে|-?er|-?এর|-?e|-?এ)$/i, '').trim();

  // 1. Direct phone number check
  const phone = normalizeBdPhone(cleanQuery);
  if (phone) {
    const user = await User.findOne({ phone }).select('_id phone name accountType status');
    if (user) {
      return { resolved: true, user, query: cleanQuery };
    }
    // Return phone as valid external recipient if format is valid BD mobile
    return {
      resolved: true,
      user: { phone, name: phone, _id: null, isUnregistered: true },
      query: cleanQuery,
    };
  }

  // 2. Search registered users in database
  // Exclude self (sender)
  const transliterated = BN_TO_EN_NAMES[cleanQuery] || BN_TO_EN_NAMES[cleanQuery.toLowerCase()];
  const candidates = [cleanQuery];
  if (transliterated) candidates.push(transliterated);

  const prefixConditions = candidates.map((c) => ({
    name: { $regex: new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
  }));

  const matches = await User.find({
    _id: { $ne: senderUserId },
    $or: prefixConditions,
    status: { $in: ['active', 'ACTIVE'] },
  })
    .select('_id phone name accountType')
    .limit(5);

  if (matches.length === 1) {
    return { resolved: true, user: matches[0], query: cleanQuery };
  }

  if (matches.length > 1) {
    return {
      resolved: false,
      ambiguous: true,
      matches,
      query: cleanQuery,
    };
  }

  // Try substring search if prefix search yielded 0
  const subConditions = candidates.map((c) => ({
    name: { $regex: c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  }));

  const subMatches = await User.find({
    _id: { $ne: senderUserId },
    $or: subConditions,
    status: { $in: ['active', 'ACTIVE'] },
  })
    .select('_id phone name accountType')
    .limit(5);

  if (subMatches.length === 1) {
    return { resolved: true, user: subMatches[0], query: cleanQuery };
  }

  if (subMatches.length > 1) {
    return {
      resolved: false,
      ambiguous: true,
      matches: subMatches,
      query: cleanQuery,
    };
  }

  // 3. Check User Memory Contact Aliases (e.g. "brother", "bhai", "ভাই", "landlord")
  if (senderUserId) {
    const aliasMatch = await resolveAliasRecipient({ userId: senderUserId, aliasQuery: cleanQuery });
    if (aliasMatch && (aliasMatch.user || aliasMatch.phone)) {
      const userObj = aliasMatch.user || {
        _id: null,
        name: aliasMatch.name,
        phone: aliasMatch.phone,
        accountType: 'CUSTOMER',
      };
      return { resolved: true, user: userObj, query: cleanQuery, alias: aliasMatch.relationship };
    }
  }

  return { resolved: false, notFound: true, query: cleanQuery };
}

/**
 * Resolves multiple recipients for group bills.
 * @param {string[]} participantNamesOrPhones
 * @param {string} senderUserId
 * @returns {Promise<{ resolved: Array<{ user: object, original: string }>, missing: string[], ambiguous: Array<{ query: string, matches: object[] }> }>}
 */
export async function resolveMultipleParticipants(participantNamesOrPhones, senderUserId) {
  const resolved = [];
  const missing = [];
  const ambiguous = [];

  for (const item of participantNamesOrPhones) {
    const res = await resolveRecipient(item, senderUserId);
    if (res.resolved) {
      resolved.push({ user: res.user, original: item });
    } else if (res.ambiguous) {
      ambiguous.push({ query: item, matches: res.matches });
    } else {
      missing.push(item);
    }
  }

  return { resolved, missing, ambiguous };
}

export default {
  normalizeBdPhone,
  resolveRecipient,
  resolveMultipleParticipants,
};
