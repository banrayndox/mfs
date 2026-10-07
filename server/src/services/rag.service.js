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
 * Handles Bangla and English script and n-grams.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  // Generate bigrams for stronger phrasal match in Bangla/English
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}_${words[i + 1]}`);
  }

  return [...words, ...bigrams];
}

/**
 * Compute BM25 scores for corpus.
 */
class BM25Retriever {
  constructor(docs = []) {
    this.docs = docs;
    this.docCount = docs.length;
    this.avgDocLen = 0;
    this.docLengths = [];
    this.docTermFreqs = [];
    this.docFreqs = {};
    this.k1 = 1.5;
    this.b = 0.75;

    this._index();
  }

  _index() {
    if (this.docCount === 0) return;
    let totalLen = 0;

    this.docs.forEach((doc, idx) => {
      const text = [
        ...(doc.keywords || []),
        doc.titleBn,
        doc.titleEn,
        doc.contentBn,
        doc.contentEn,
      ].join(' ');

      const tokens = tokenize(text);
      this.docLengths[idx] = tokens.length;
      totalLen += tokens.length;

      const tf = {};
      const uniqueTokens = new Set(tokens);
      for (const t of tokens) {
        tf[t] = (tf[t] || 0) + 1;
      }
      this.docTermFreqs[idx] = tf;

      for (const t of uniqueTokens) {
        this.docFreqs[t] = (this.docFreqs[t] || 0) + 1;
      }
    });

    this.avgDocLen = totalLen / Math.max(1, this.docCount);
  }

  scoreQuery(query, docIdx) {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return 0;

    let score = 0;
    const docLen = this.docLengths[docIdx] || 1;
    const tfMap = this.docTermFreqs[docIdx] || {};

    for (const term of qTokens) {
      if (!this.docFreqs[term]) continue;

      const df = this.docFreqs[term];
      // Robertson-Sparck Jones IDF
      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
      const tf = tfMap[term] || 0;

      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));

      score += idf * (numerator / denominator);
    }

    return score;
  }
}

let bm25 = new BM25Retriever(documents);

/**
 * Retrieve the most relevant official documentation snippet for a natural language query.
 * Strictly used for documentation, policies, guides, and FAQs.
 * NEVER used for live user balances or transaction records.
 *
 * @param {string} query
 * @param {{ language?: 'bn' | 'en', topK?: number, minScore?: number, category?: string }} options
 * @returns {Array<{ id: string, category: string, title: string, content: string, score: number }>}
 */
export function retrieveKnowledge(queryArg, optionsArg = {}) {
  let query = queryArg;
  let options = optionsArg;

  if (typeof queryArg === 'object' && queryArg !== null && queryArg.query) {
    query = queryArg.query;
    options = queryArg;
  }

  const { language = 'bn', topK = 1, minScore = 0.15, category = null } = options;
  if (!query || typeof query !== 'string' || documents.length === 0) return [];


  // Filter docs if category is provided
  let candidateDocs = documents;
  if (category) {
    candidateDocs = documents.filter((d) => d.category.toLowerCase() === category.toLowerCase());
  }
  if (candidateDocs.length === 0) return [];

  const lowerQuery = query.toLowerCase();


  const scoredDocs = candidateDocs.map((doc) => {
    const originalIdx = documents.indexOf(doc);
    let score = bm25.scoreQuery(query, originalIdx);

    // Boost for exact keyword or title overlap
    const hasKeyword = (doc.keywords || []).some((kw) => lowerQuery.includes(kw.toLowerCase()));
    if (hasKeyword) {
      score += 2.0;
    }

    const titleEn = (doc.titleEn || '').toLowerCase();
    const titleBn = (doc.titleBn || '').toLowerCase();
    if (lowerQuery.includes(titleEn) || lowerQuery.includes(titleBn)) {
      score += 3.0;
    }

    // Normalized score between 0 and 1
    const normalizedScore = Math.min(1.0, score / 10.0);

    return {
      id: doc.id,
      category: doc.category,
      title: language === 'bn' ? doc.titleBn : doc.titleEn,
      content: language === 'bn' ? doc.contentBn : doc.contentEn,
      score: Number(normalizedScore.toFixed(4)),
      rawScore: score,
    };
  });

  return scoredDocs
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Evaluates RAG retrieval performance against a labelled dataset.
 * Computes Recall@1, Recall@3, Recall@5, and MRR (Mean Reciprocal Rank).
 *
 * @param {Array<{ query: string, expectedDocId: string, category?: string }>} evalDataset
 * @returns {{ recallAt1: number, recallAt3: number, recallAt5: number, mrr: number, totalQueries: number }}
 */
export function evaluateRag(evalDataset) {
  if (!evalDataset || evalDataset.length === 0) {
    return { recallAt1: 0, recallAt3: 0, recallAt5: 0, mrr: 0, totalQueries: 0 };
  }

  let hitsAt1 = 0;
  let hitsAt3 = 0;
  let hitsAt5 = 0;
  let totalReciprocalRank = 0;

  for (const item of evalDataset) {
    const results = retrieveKnowledge(item.query, { topK: 5, minScore: 0.05, category: item.category });
    const rankIndex = results.findIndex((r) => r.id === item.expectedDocId);

    if (rankIndex === 0) {
      hitsAt1 += 1;
    }
    if (rankIndex >= 0 && rankIndex < 3) {
      hitsAt3 += 1;
    }
    if (rankIndex >= 0 && rankIndex < 5) {
      hitsAt5 += 1;
    }

    if (rankIndex >= 0) {
      totalReciprocalRank += 1 / (rankIndex + 1);
    }
  }

  const N = evalDataset.length;
  return {
    recallAt1: Number(((hitsAt1 / N) * 100).toFixed(2)),
    recallAt3: Number(((hitsAt3 / N) * 100).toFixed(2)),
    recallAt5: Number(((hitsAt5 / N) * 100).toFixed(2)),
    mrr: Number((totalReciprocalRank / N).toFixed(4)),
    totalQueries: N,
  };
}

export default {
  retrieveKnowledge,
  evaluateRag,
};
