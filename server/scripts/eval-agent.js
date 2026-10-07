#!/usr/bin/env node
/**
 * eval-agent.js
 * Benchmark runner for Guardian MFS AI Copilot & RAG Retrieval.
 * Executes mathematical evaluation across Bangla, Banglish, and English datasets.
 */

import { printEvaluationReport } from '../../ai/evaluation/evaluate.js';

async function main() {
  try {
    const report = await printEvaluationReport();
    if (!report || report.intentClassification.overall.accuracy < 85) {
      console.error('❌ AI Copilot intent benchmark below 85% threshold');
      process.exit(1);
    }
    console.log('✅ AI Copilot evaluation benchmark passed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ AI Copilot evaluation encountered fatal error:', err);
    process.exit(1);
  }
}

main();

