#!/usr/bin/env node
/**
 * load-test.js
 * High-concurrency load testing benchmark for Guardian MFS AI & Financial Engine.
 * Tests:
 * 1. AI Copilot Semantic Intent Classification & Normalization under concurrency (100 & 500 tasks)
 * 2. BM25 RAG Knowledge Retrieval under concurrency (100 & 500 tasks)
 * Reports: Mean Latency, P50, P95, P99, Throughput (req/s), and error rates.
 */

import { performance } from 'perf_hooks';
import { planIntent } from '../src/services/copilot/intentPlanner.js';
import { retrieveKnowledge } from '../src/services/rag.service.js';

function computePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { p50, p95, p99 };
}

async function benchmarkTask({ name, fn, totalRequests, concurrency }) {
  console.log(`\n⏳ Running ${name}: ${totalRequests} requests (Concurrency: ${concurrency})...`);
  const latencies = [];
  let successful = 0;
  let failed = 0;

  const startTime = performance.now();
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < totalRequests) {
      const idx = currentIndex++;
      if (idx >= totalRequests) break;
      const t0 = performance.now();
      try {
        await fn();
        successful++;
      } catch (e) {
        failed++;
        if (failed === 1) console.error('Caught error in worker:', e);
      }
      const t1 = performance.now();
      latencies.push(t1 - t0);
    }
  }


  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = (performance.now() - startTime) / 1000;
  const throughput = Math.round(successful / totalTimeSec);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const { p50, p95, p99 } = computePercentiles(latencies);

  console.log(`------------------------------------------------------------`);
  console.log(`📊 Results for ${name}:`);
  console.log(`• Total Completed:   ${successful}/${totalRequests} (${failed} failed)`);
  console.log(`• Total Duration:    ${totalTimeSec.toFixed(2)}s`);
  console.log(`• Throughput (RPS):  ${throughput} req/sec`);
  console.log(`• Average Latency:   ${avgLatency} ms`);
  console.log(`• P50 Latency:       ${p50.toFixed(2)} ms`);
  console.log(`• P95 Latency:       ${p95.toFixed(2)} ms`);
  console.log(`• P99 Latency:       ${p99.toFixed(2)} ms`);
  console.log(`------------------------------------------------------------`);

  return { throughput, avgLatency, p50, p95, p99, failed };
}

async function main() {
  console.log('============================================================');
  console.log('🚀 GUARDIAN MFS — HIGH-CONCURRENCY SCALABILITY BENCHMARK');
  console.log('============================================================');

  const samplePrompts = [
    '500 taka send koro Rahim ke',
    'বিদ্যুৎ বিল দিতে চাই ১২০০ টাকা',
    'আমার ব্যালেন্স কত আছে?',
    'ক্যাশ আউট করতে কত ফি কাটে?',
    'save 2% from all transactions',
  ];

  // 1. Copilot Intent Planning Benchmark (100 concurrent)
  await benchmarkTask({
    name: 'AI Intent Planner (Concurrency: 25, Requests: 100)',
    fn: async () => {
      const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
      return planIntent({ text: prompt, language: 'bn' });
    },
    totalRequests: 100,
    concurrency: 25,
  });

  // 2. BM25 RAG Knowledge Retrieval Benchmark (Concurrency: 50, Requests: 250)
  await benchmarkTask({
    name: 'BM25 Knowledge Retriever (Concurrency: 50, Requests: 250)',
    fn: async () => {
      return retrieveKnowledge({ query: 'ক্যাশ আউট চার্জ এবং লিমিট কত', topK: 3 });
    },
    totalRequests: 250,
    concurrency: 50,
  });

  // 3. Peak Concurrency Stress Test (Concurrency: 100, Requests: 500)
  const stress = await benchmarkTask({
    name: 'Stress Test: Intent + RAG Pipeline (Concurrency: 100, Requests: 500)',
    fn: async () => {
      const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
      const planned = await planIntent({ text: prompt, language: 'bn' });
      if (planned.intent === 'knowledge') {
        await retrieveKnowledge({ query: prompt, topK: 2 });
      }
    },
    totalRequests: 500,
    concurrency: 100,
  });

  if (stress.failed > 0) {
    console.error(`❌ Load test encountered ${stress.failed} failures.`);
    process.exit(1);
  }

  console.log('\n✅ All scalability load tests completed successfully with 0 failures.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
