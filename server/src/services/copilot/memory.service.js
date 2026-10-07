/**
 * @file memory.service.js
 * Comprehensive Long-Term & Conversational Memory Service for Guardian MFS AI Copilot.
 * Manages user preferences, contact aliases, utility accounts, financial goals,
 * contextual facts, and persistent multi-turn chat history.
 */

import { FinancialMemory, CopilotMessage, User, SavingsPlan } from '../../models/index.js';
import { normalizeBdPhone, resolveRecipient } from './entityResolver.js';
import { extractAmountInPoisha } from './inputNormalizer.js';
import logger from '../../utils/logger.js';

/**
 * Common kinship & relationship terms in English, Bangla, and Banglish.
 */
const RELATIONSHIP_TERMS = {
  brother: ['brother', 'bro', 'bhai', 'ভাই', 'ভাইয়া', 'ভাইকে'],
  sister: ['sister', 'sis', 'bon', 'আপু', 'বোন', 'বোনকে', 'আপুকে'],
  father: ['father', 'dad', 'baba', 'বাবা', 'আব্বু', 'বাবাকে', 'আব্বুকে'],
  mother: ['mother', 'mom', 'ma', 'মা', 'আম্মু', 'মাকে', 'আম্মুকে'],
  wife: ['wife', 'bou', 'স্ত্রী', 'বউ', 'ওয়াইফ', 'স্ত্রীকে'],
  husband: ['husband', 'shami', 'স্বামী', 'হাজব্যান্ড', 'স্বামীকে'],
  friend: ['friend', 'dost', 'bondhu', 'বন্ধু', 'দোস্ত', 'বন্ধুকে'],
  landlord: ['landlord', 'bariwala', 'বাড়িওয়ালা', 'বাড়িওয়ালী', 'বাড়িওয়ালাকে'],
  colleague: ['colleague', 'shohokormi', 'সহকর্মী', 'অফিসের সহকর্মী'],
  son: ['son', 'chele', 'ছেলে', 'পুত্র', 'ছেলেকে'],
  daughter: ['daughter', 'meye', 'মেয়ে', 'কন্যা', 'মেয়েকে'],
};

/**
 * Common utility biller keywords.
 */
const UTILITY_BILLERS = {
  DESCO: ['desco', 'ডেসকো', 'বিদ্যুৎ', 'electricity'],
  DPDC: ['dpdc', 'ডিপিডিসি'],
  NESCO: ['nesco', 'নেসকো'],
  WASA: ['wasa', 'ওয়াসা', 'পানি', 'water'],
  TITAS: ['titas', 'তিতাস', 'গ্যাস', 'gas'],
  BTCL: ['btcl', 'বিটিসিএল', 'telephone', 'ফোন'],
};

/**
 * Get or initialize user's FinancialMemory document.
 * @param {string} userId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function getOrCreateFinancialMemory(userId) {
  let memory = await FinancialMemory.findOne({ userId });
  if (!memory) {
    memory = await FinancialMemory.create({
      userId,
      microSavings: {
        enabled: false,
        paused: false,
        mode: 'percentage',
        percentage: 2,
        roundUpUnit: 10000,
        thresholdMinPoisha: 50000,
        autoDeductOnSpend: true,
      },
      guardianAlerts: {
        enabled: true,
        warnOnNewRecipient: true,
        warnOnUnusualAmount: true,
        warnOnUnusualHours: true,
      },
      financialGoals: [],
      userContextNotes: [],
      contactAliases: [],
      utilityAccounts: [],
      financialPreferences: {
        monthlyBudgetPoisha: 0,
        minimumSafetyBufferPoisha: 0,
      },
    });
  }
  return memory;
}

/**
 * Remember a custom fact, contact relationship, utility account, or preference.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.fact - Raw natural language text e.g. "Remember that Karim is my brother"
 * @param {string} [params.category]
 * @param {string} [params.key]
 * @param {string} [params.value]
 * @returns {Promise<{ success: boolean, factItem: object, category: string, summaryBn: string, summaryEn: string }>}
 */
export async function rememberFact({ userId, fact, category, key, value }) {
  if (!userId || !fact || typeof fact !== 'string') {
    throw new Error('userId and fact string are required.');
  }

  const memory = await getOrCreateFinancialMemory(userId);
  const cleanFact = fact.trim();
  const lower = cleanFact.toLowerCase();

  let detectedCategory = category || 'general';
  let detectedKey = key || null;
  let detectedValue = value || null;

  // 1. Detect Relationship / Contact Alias
  // Examples: "Karim is my brother", "Remember Rakib is my brother", "01710000002 is my brother", "রহিম আমার ভাই"
  let relationshipFound = null;
  for (const [relKey, synonyms] of Object.entries(RELATIONSHIP_TERMS)) {
    if (synonyms.some((syn) => lower.includes(syn))) {
      relationshipFound = relKey;
      break;
    }
  }

  if (relationshipFound) {
    detectedCategory = 'relationship';
    detectedKey = relationshipFound;

    // Extract target name or phone
    // e.g. "Karim is my brother" -> "Karim", "রহিম আমার ভাই" -> "রহিম"
    const relMatch =
      cleanFact.match(/(?:remember\s+(?:that\s+)?)?([a-zA-Z\u0980-\u09FF\d+]+)\s+(?:is\s+my|আমার|হলো|amar)\s+/i) ||
      cleanFact.match(/(?:is\s+my|হলো|আমার)\s+[a-zA-Z\u0980-\u09FF]+\s*([a-zA-Z\u0980-\u09FF\d+]+)/i) ||
      cleanFact.match(/([a-zA-Z\u0980-\u09FF\d+]+)\s+(?:আমার|amar)\s+/iu);

    let targetIdentifier = relMatch ? relMatch[1].trim() : null;

    if (!targetIdentifier) {
      // Look for phone
      const phoneMatch = cleanFact.match(/01[3-9]\d{8}/);
      if (phoneMatch) targetIdentifier = phoneMatch[0];
    }

    if (targetIdentifier) {
      detectedValue = targetIdentifier;
      const phone = normalizeBdPhone(targetIdentifier);
      let matchedUser = null;

      if (phone) {
        matchedUser = await User.findOne({ phone, status: 'active' });
      } else {
        const resolved = await resolveRecipient(targetIdentifier, userId);
        if (resolved?.user) matchedUser = resolved.user;
      }

      // Store or update contact alias
      memory.contactAliases = (memory.contactAliases || []).filter(
        (a) => a.alias !== relationshipFound && a.alias !== relationshipFound.toLowerCase()
      );

      memory.contactAliases.push({
        alias: relationshipFound.toLowerCase(),
        name: matchedUser ? matchedUser.name : targetIdentifier,
        phone: matchedUser ? matchedUser.phone : (phone || ''),
        relationship: relationshipFound,
        createdAt: new Date(),
      });
    }
  }

  // 2. Detect Utility Account (e.g. "DESCO meter number is 442109", "বিদ্যুৎ বিল নম্বর ৪৪২১০৯")
  let billerFound = null;
  for (const [biller, synonyms] of Object.entries(UTILITY_BILLERS)) {
    if (synonyms.some((syn) => lower.includes(syn))) {
      billerFound = biller;
      break;
    }
  }

  const accountMatch = cleanFact.match(/(?:number|no|meter|account|নম্বর|মিটার|অ্যাকাউন্ট)?\s*(?:is|হলো|:)?\s*([0-9]{4,12})/i);
  if (billerFound && accountMatch) {
    detectedCategory = 'utility';
    detectedKey = billerFound;
    detectedValue = accountMatch[1];

    memory.utilityAccounts = (memory.utilityAccounts || []).filter((u) => u.billerId !== billerFound);
    memory.utilityAccounts.push({
      billerId: billerFound,
      accountNo: accountMatch[1],
      nickname: `${billerFound} Account`,
      createdAt: new Date(),
    });
  }

  // 3. Detect Budget or Safety Buffer
  // Examples: "My monthly budget is 25000", "Keep 2000 in my wallet"
  if (lower.includes('budget') || lower.includes('বাজেট')) {
    const amtPoisha = extractAmountInPoisha(cleanFact);
    if (amtPoisha) {
      detectedCategory = 'budget';
      detectedKey = 'monthly_budget';
      detectedValue = String(amtPoisha);
      if (!memory.financialPreferences) memory.financialPreferences = {};
      memory.financialPreferences.monthlyBudgetPoisha = amtPoisha;
    }
  } else if (lower.includes('buffer') || lower.includes('keep at least') || lower.includes('কমপক্ষে')) {
    const amtPoisha = extractAmountInPoisha(cleanFact);
    if (amtPoisha) {
      detectedCategory = 'safety';
      detectedKey = 'safety_buffer';
      detectedValue = String(amtPoisha);
      if (!memory.financialPreferences) memory.financialPreferences = {};
      memory.financialPreferences.minimumSafetyBufferPoisha = amtPoisha;
    }
  }

  // Append to userContextNotes (avoid exact duplicates)
  memory.userContextNotes = (memory.userContextNotes || []).filter(
    (n) => n.fact.toLowerCase() !== cleanFact.toLowerCase()
  );

  const noteItem = {
    fact: cleanFact,
    category: detectedCategory,
    key: detectedKey,
    value: detectedValue,
    createdAt: new Date(),
  };

  memory.userContextNotes.push(noteItem);
  await memory.save();

  logger.info({ userId, category: detectedCategory, fact: cleanFact }, 'Copilot stored new user financial memory');

  const summaryBn = `📝 মনে রাখা হয়েছে: "${cleanFact}"।`;
  const summaryEn = `📝 Noted and remembered: "${cleanFact}".`;

  return {
    success: true,
    factItem: noteItem,
    category: detectedCategory,
    summaryBn,
    summaryEn,
  };
}

/**
 * Recall remembered facts, goals, contact aliases, and utility accounts.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.query]
 * @param {string} [params.category]
 * @returns {Promise<{ notes: object[], aliases: object[], utilities: object[], goals: object[], preferences: object, summaryBn: string, summaryEn: string }>}
 */
export async function recallMemories({ userId, query, category }) {
  const memory = await getOrCreateFinancialMemory(userId);

  let notes = memory.userContextNotes || [];
  let aliases = memory.contactAliases || [];
  let utilities = memory.utilityAccounts || [];
  let goals = memory.financialGoals || [];

  if (category) {
    notes = notes.filter((n) => n.category === category);
  }

  if (query && typeof query === 'string') {
    const qLower = query.toLowerCase().trim();
    notes = notes.filter(
      (n) =>
        n.fact.toLowerCase().includes(qLower) ||
        (n.key && n.key.toLowerCase().includes(qLower)) ||
        (n.value && n.value.toLowerCase().includes(qLower))
    );
    aliases = aliases.filter(
      (a) =>
        a.alias.toLowerCase().includes(qLower) ||
        (a.name && a.name.toLowerCase().includes(qLower)) ||
        (a.relationship && a.relationship.toLowerCase().includes(qLower))
    );
    utilities = utilities.filter(
      (u) =>
        u.billerId.toLowerCase().includes(qLower) ||
        u.accountNo.includes(qLower) ||
        (u.nickname && u.nickname.toLowerCase().includes(qLower))
    );
    goals = goals.filter(
      (g) =>
        g.keyword.toLowerCase().includes(qLower) ||
        g.title.toLowerCase().includes(qLower)
    );
  }

  // Format summaries
  const linesBn = [];
  const linesEn = [];

  if (aliases.length > 0) {
    linesBn.push('👥 পরিচিত ও সম্পর্ক (Aliases):');
    linesEn.push('👥 Contact Relationships:');
    for (const a of aliases) {
      linesBn.push(`• ${a.relationship}: ${a.name} (${a.phone || 'নম্বর সংরক্ষিত নেই'})`);
      linesEn.push(`• ${a.relationship}: ${a.name} (${a.phone || 'No phone'})`);
    }
  }

  if (utilities.length > 0) {
    linesBn.push('💡 বিদ্যুৎ ও পরিষেবা অ্যাকাউন্ট (Utilities):');
    linesEn.push('💡 Saved Utility Accounts:');
    for (const u of utilities) {
      linesBn.push(`• ${u.billerId}: ${u.accountNo} (${u.nickname || 'বিল'})`);
      linesEn.push(`• ${u.billerId}: ${u.accountNo} (${u.nickname || 'Bill'})`);
    }
  }

  if (goals.length > 0) {
    linesBn.push('🎯 সঞ্চয় লক্ষ্য (Financial Goals):');
    linesEn.push('🎯 Financial Goals:');
    for (const g of goals) {
      linesBn.push(`• ${g.title}: ৳${(g.targetPoisha / 100).toLocaleString()}`);
      linesEn.push(`• ${g.title}: ৳${(g.targetPoisha / 100).toLocaleString()}`);
    }
  }

  if (notes.length > 0) {
    linesBn.push('📝 সংরক্ষিত নোট ও তথ্য (Notes):');
    linesEn.push('📝 Saved Personal Notes:');
    for (const n of notes) {
      linesBn.push(`• ${n.fact}`);
      linesEn.push(`• ${n.fact}`);
    }
  }

  const isEmpty = linesBn.length === 0;
  const summaryBn = isEmpty
    ? 'আপনার সম্পর্কে কোনো সংরক্ষিত তথ্য পাওয়া যায়নি। আপনি বলতে পারেন: "Remember that Karim is my brother" বা "Remember my electricity account is 442109"।'
    : linesBn.join('\n');
  const summaryEn = isEmpty
    ? 'No remembered facts found. You can say: "Remember that Karim is my brother" or "Remember my electricity account is 442109".'
    : linesEn.join('\n');

  return {
    notes,
    contextNotes: notes,
    aliases,
    contactAliases: aliases,
    utilities,
    utilityAccounts: utilities,
    goals,
    financialGoals: goals,
    totalCount: notes.length + aliases.length + utilities.length + goals.length,
    preferences: memory.financialPreferences || {},
    summaryBn,
    summaryEn,
  };
}

/**
 * Forget/delete a specific remembered fact or clear memory matching query.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.factId]
 * @param {string} [params.query]
 * @returns {Promise<{ success: boolean, removedCount: number, summaryBn: string, summaryEn: string, messageBn: string, messageEn: string }>}
 */
export async function forgetFact({ userId, factId, query }) {
  const memory = await getOrCreateFinancialMemory(userId);
  let removedCount = 0;

  if (factId) {
    const initNotes = memory.userContextNotes.length;
    memory.userContextNotes = memory.userContextNotes.filter((n) => n._id.toString() !== factId);
    removedCount += initNotes - memory.userContextNotes.length;

    memory.contactAliases = (memory.contactAliases || []).filter((a) => a._id?.toString() !== factId);
    memory.utilityAccounts = (memory.utilityAccounts || []).filter((u) => u._id?.toString() !== factId);
  } else if (query) {
    const qLower = query.toLowerCase().trim();
    const words = qLower.split(/[\s,.\?!;:]+/).filter(Boolean);

    const initNotes = memory.userContextNotes.length;
    memory.userContextNotes = memory.userContextNotes.filter((n) => {
      const fLower = n.fact.toLowerCase();
      const match =
        fLower.includes(qLower) ||
        qLower.includes(fLower) ||
        (n.key && qLower.includes(n.key.toLowerCase()));
      return !match;
    });
    removedCount += initNotes - memory.userContextNotes.length;

    const initAliases = memory.contactAliases.length;
    memory.contactAliases = (memory.contactAliases || []).filter((a) => {
      const aLower = a.alias.toLowerCase();
      const nLower = (a.name || '').toLowerCase();
      const match =
        aLower.includes(qLower) ||
        nLower.includes(qLower) ||
        qLower.includes(aLower) ||
        qLower.includes(nLower) ||
        words.includes(aLower) ||
        words.includes(nLower);
      return !match;
    });
    removedCount += initAliases - memory.contactAliases.length;

    const initUtils = memory.utilityAccounts.length;
    memory.utilityAccounts = (memory.utilityAccounts || []).filter((u) => {
      const bLower = u.billerId.toLowerCase();
      const acc = u.accountNo;
      const match =
        bLower.includes(qLower) ||
        qLower.includes(bLower) ||
        acc.includes(qLower) ||
        qLower.includes(acc) ||
        words.includes(bLower) ||
        words.includes(acc);
      return !match;
    });
    removedCount += initUtils - memory.utilityAccounts.length;
  }

  await memory.save();

  const msgBn = removedCount > 0 ? '🗑️ তথ্যটি মেমরি থেকে সফলভাবে মুছে ফেলা হয়েছে।' : 'মুছে ফেলার মতো কোনো তথ্য পাওয়া যায়নি।';
  const msgEn = removedCount > 0 ? '🗑️ Information removed from memory successfully.' : 'No matching information found to remove.';

  return {
    success: true,
    removedCount,
    summaryBn: msgBn,
    summaryEn: msgEn,
    messageBn: msgBn,
    messageEn: msgEn,
  };
}

/**
 * Clears all personal notes, aliases, and utility accounts for user.
 * @param {Object} params
 * @param {string} params.userId
 * @returns {Promise<{ success: boolean, summaryBn: string, summaryEn: string, messageBn: string, messageEn: string }>}
 */
export async function clearUserMemory({ userId }) {
  const memory = await getOrCreateFinancialMemory(userId);
  memory.userContextNotes = [];
  memory.contactAliases = [];
  memory.utilityAccounts = [];
  await memory.save();

  const msgBn = '🗑️ আপনার সংরক্ষিত সকল ব্যক্তিগত মেমোরি ও তথ্য সফলভাবে মুছে ফেলা হয়েছে।';
  const msgEn = '🗑️ All personal memory notes and aliases cleared successfully.';

  return {
    success: true,
    summaryBn: msgBn,
    summaryEn: msgEn,
    messageBn: msgBn,
    messageEn: msgEn,
  };
}

/**
 * Resolves a contact alias from user memory.
 * e.g. "brother" / "bhai" / "ভাই" -> resolves to Rakib / 01710000002
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.aliasQuery
 * @returns {Promise<{ phone: string, name: string, user?: object }|null>}
 */
export async function resolveAliasRecipient({ userId, aliasQuery }) {
  if (!userId || !aliasQuery) return null;
  const memory = await FinancialMemory.findOne({ userId });
  if (!memory || !memory.contactAliases || memory.contactAliases.length === 0) return null;

  const qLower = aliasQuery.toLowerCase().trim();
  const words = qLower.split(/[\s,.\?!;:\(\)]+/).filter(Boolean);
  const cleanTokens = words.map((w) =>
    w.replace(/(?:-?ke|-?কে|-?re|-?রে|-?te|-?তে|-?er|-?এর|-?e|-?এ)$/i, '').trim()
  );

  // Find alias matching query or synonym
  for (const aliasItem of memory.contactAliases) {
    const aliasKey = aliasItem.alias.toLowerCase();
    const synonyms = RELATIONSHIP_TERMS[aliasKey] || [aliasKey];

    const isMatch =
      aliasKey === qLower ||
      words.includes(aliasKey) ||
      cleanTokens.includes(aliasKey) ||
      synonyms.some((s) => {
        const sLower = s.toLowerCase();
        if (sLower === qLower || words.includes(sLower) || cleanTokens.includes(sLower)) {
          return true;
        }
        if (sLower.includes(' ') && qLower.includes(sLower)) {
          return true;
        }
        return false;
      }) ||
      (aliasItem.name && (
        aliasItem.name.toLowerCase() === qLower ||
        words.includes(aliasItem.name.toLowerCase()) ||
        cleanTokens.includes(aliasItem.name.toLowerCase())
      ));

    if (isMatch) {
      let matchedUser = null;
      if (aliasItem.phone) {
        matchedUser = await User.findOne({ phone: aliasItem.phone, status: 'active' });
      }
      if (!matchedUser && aliasItem.name) {
        matchedUser = await User.findOne({
          _id: { $ne: userId },
          name: { $regex: new RegExp(`^${aliasItem.name}$`, 'i') },
          status: 'active',
        });
      }

      return {
        phone: matchedUser ? matchedUser.phone : aliasItem.phone,
        name: matchedUser ? matchedUser.name : aliasItem.name,
        relationship: aliasItem.relationship,
        user: matchedUser || null,
      };
    }
  }

  return null;
}

/**
 * Resolves utility account number from user memory.
 * e.g. "desco" -> "442109"
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.billerQuery
 * @returns {Promise<{ billerId: string, accountNo: string }|null>}
 */
export async function resolveUtilityAccount({ userId, billerQuery }) {
  if (!userId || !billerQuery) return null;
  const memory = await FinancialMemory.findOne({ userId });
  if (!memory || !memory.utilityAccounts || memory.utilityAccounts.length === 0) return null;

  const qLower = billerQuery.toLowerCase().trim();

  for (const acc of memory.utilityAccounts) {
    const biller = acc.billerId.toLowerCase();
    const synonyms = UTILITY_BILLERS[acc.billerId] || [biller];
    if (biller === qLower || synonyms.some((s) => qLower.includes(s))) {
      return { billerId: acc.billerId, accountNo: acc.accountNo };
    }
  }

  // If only 1 utility account exists and query mentions bill, return it
  if (memory.utilityAccounts.length === 1 && (qLower.includes('bill') || qLower.includes('বিল'))) {
    return {
      billerId: memory.utilityAccounts[0].billerId,
      accountNo: memory.utilityAccounts[0].accountNo,
    };
  }

  return null;
}

/**
 * Persist conversation message into MongoDB.
 * @param {Object} params
 */
export async function saveConversationMessage({
  userId,
  sender,
  text,
  language = 'bn',
  intent = null,
  tool = null,
  metadata = null,
  pendingAction = null,
  clientAction = null,
}) {
  if (!userId || !sender || !text) return null;
  try {
    return await CopilotMessage.create({
      userId,
      sender,
      text,
      language,
      intent,
      tool,
      metadata,
      pendingAction: pendingAction ? { actionId: pendingAction.actionId, tool: pendingAction.tool, preview: pendingAction.preview } : null,
      clientAction,
    });
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Failed to persist CopilotMessage');
    return null;
  }
}

/**
 * Get recent conversation history for user.
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} [params.limit=40]
 * @returns {Promise<Array<object>>}
 */
export async function getConversationHistory({ userId, limit = 40 }) {
  if (!userId) return [];
  const messages = await CopilotMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse().map((m) => ({
    id: m._id.toString(),
    sender: m.sender,
    text: m.text,
    language: m.language,
    intent: m.intent,
    tool: m.tool,
    pendingAction: m.pendingAction,
    clientAction: m.clientAction,
    createdAt: m.createdAt,
  }));
}

/**
 * Clear conversation history for user.
 * @param {Object} params
 * @param {string} params.userId
 */
export async function clearConversationHistory({ userId }) {
  if (!userId) return { success: false };
  await CopilotMessage.deleteMany({ userId });
  return { success: true };
}

/**
 * Build a concise natural language memory summary for LLM prompt context injection.
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getMemoryContextSummary(userId) {
  const memory = await FinancialMemory.findOne({ userId }).lean();
  if (!memory) return '';

  const parts = [];
  if (memory.contactAliases?.length) {
    const list = memory.contactAliases.map((a) => `${a.relationship}: ${a.name} (${a.phone})`).join(', ');
    parts.push(`Known contacts: ${list}`);
  }
  if (memory.utilityAccounts?.length) {
    const list = memory.utilityAccounts.map((u) => `${u.billerId} account: ${u.accountNo}`).join(', ');
    parts.push(`Saved bills: ${list}`);
  }
  if (memory.financialGoals?.length) {
    const list = memory.financialGoals.map((g) => `${g.title} (৳${g.targetPoisha / 100})`).join(', ');
    parts.push(`Active goals: ${list}`);
  }
  if (memory.userContextNotes?.length) {
    const list = memory.userContextNotes.slice(-3).map((n) => n.fact).join('; ');
    parts.push(`User notes: ${list}`);
  }

  return parts.join(' | ');
}

export default {
  getOrCreateFinancialMemory,
  rememberFact,
  recallMemories,
  forgetFact,
  clearUserMemory,
  resolveAliasRecipient,
  resolveUtilityAccount,
  saveConversationMessage,
  getConversationHistory,
  clearConversationHistory,
  getMemoryContextSummary,
};
