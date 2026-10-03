import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgePath = path.join(__dirname, '../knowledge/mfs_knowledge.json');

let documents = [];

try {
  if (fs.existsSync(knowledgePath)) {
    const raw = fs.readFileSync(knowledgePath, 'utf8');
    documents = JSON.parse(raw);
    logger.info({ count: documents.length }, 'RAG knowledge base loaded successfully');
  }
} catch (err) {
  logger.error({ err }, 'Failed to load RAG knowledge base');
}

/**
 * Tokenize string into lowercase alphanumeric and unicode words.
 * Handles Bangla and English script.
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Compute Term Frequency map for a token list.
 */
function computeTf(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  return tf;
}

/**
 * Calculate cosine similarity between query TF and document TF.
 */
function calculateSimilarity(queryTf, docTf) {
  let dotProduct = 0;
  let queryNorm = 0;
  let docNorm = 0;

  for (const [term, qCount] of Object.entries(queryTf)) {
    queryNorm += qCount * qCount;
    if (docTf[term]) {
      dotProduct += qCount * docTf[term];
    }
  }

  for (const dCount of Object.values(docTf)) {
    docNorm += dCount * dCount;
  }

  if (queryNorm === 0 || docNorm === 0) return 0;
  return dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
}

/**
 * Retrieve the most relevant official documentation snippet for a natural language query.
 * Strictly used for documentation, policies, guides, and FAQs.
 * NEVER used for live user balances or transaction records.
 *
 * @param {string} query
 * @param {{ language?: 'bn' | 'en', topK?: number, minScore?: number }} options
 * @returns {Array<{ id: string, title: string, content: string, score: number }>}
 */
export function retrieveKnowledge(query, { language = 'bn', topK = 1, minScore = 0.12 } = {}) {
  if (!query || documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const queryTf = computeTf(queryTokens);

  const scoredDocs = documents.map((doc) => {
    // Combine keywords, title, and content for document vector
    const docText = [
      ...(doc.keywords || []),
      doc.titleBn,
      doc.titleEn,
      doc.contentBn,
      doc.contentEn,
    ].join(' ');

    const docTokens = tokenize(docText);
    const docTf = computeTf(docTokens);

    let similarity = calculateSimilarity(queryTf, docTf);

    // Boost if any exact keyword is found
    const hasKeyword = (doc.keywords || []).some((kw) => query.toLowerCase().includes(kw.toLowerCase()));
    if (hasKeyword) {
      similarity += 0.25;
    }

    return {
      id: doc.id,
      category: doc.category,
      title: language === 'bn' ? doc.titleBn : doc.titleEn,
      content: language === 'bn' ? doc.contentBn : doc.contentEn,
      score: similarity,
    };
  });

  return scoredDocs
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export default {
  retrieveKnowledge,
};
