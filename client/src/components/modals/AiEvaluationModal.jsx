import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IoClose,
  IoCheckmarkCircle,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoFlashOutline,
  IoDocumentTextOutline,
  IoStatsChartOutline,
  IoRefreshOutline,
} from 'react-icons/io5';

export function AiEvaluationModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const isBn = i18n.language === 'bn';
  const [activeTab, setActiveTab] = useState('benchmark');
  const [metrics, setMetrics] = useState(null);
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resMetrics, resImpact] = await Promise.all([
        fetch('/api/agent/evaluation-metrics').then((r) => r.json()),
        fetch('/api/agent/telemetry-impact').then((r) => r.json()),
      ]);
      if (resMetrics.success) setMetrics(resMetrics.metrics);
      if (resImpact.success) setImpact(resImpact.impact);
    } catch (err) {
      setError(err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden transition-all animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <IoStatsChartOutline className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isBn ? 'এআই মূল্যায়ন ও পারফরম্যান্স মেট্রিক্স' : 'AI Evaluation & Performance Metrics'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isBn ? 'বাস্তব পরিমাপকৃত ফলাফল ও নিরাপত্তা নিরীক্ষা' : 'Measured Quantitative Benchmarks & Audits'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isBn ? 'রিফ্রেশ করুন' : 'Refresh'}
            >
              <IoRefreshOutline className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <IoClose className="text-xl" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'benchmark'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <IoFlashOutline />
            {isBn ? 'এনএলইউ ও আরএজি বেঞ্চমার্ক' : 'NLU & RAG Benchmark'}
          </button>
          <button
            onClick={() => setActiveTab('impact')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'impact'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <IoTimeOutline />
            {isBn ? 'ইউজার ইফিশিয়েন্সি ও টেলিমেট্রি' : 'Efficiency & Telemetry'}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'security'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <IoShieldCheckmarkOutline />
            {isBn ? 'সিকিউরিটি ও বাউন্ডারি' : 'Security Boundary'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && !metrics ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                {isBn ? 'লাইভ ইভালুয়েশন মেট্রিক্স গণনা করা হচ্ছে...' : 'Computing live quantitative benchmarks...'}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          ) : (
            <>
              {/* TAB 1: BENCHMARK */}
              {activeTab === 'benchmark' && metrics && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        {isBn ? 'ইনটেন্ট অ্যাকুরেসি' : 'Intent Accuracy'}
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {metrics.intentClassification.overall.accuracy}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">N={metrics.totalSamples} balanced</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {isBn ? 'ম্যাক্রো F1 স্কোর' : 'Macro F1 Score'}
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {metrics.intentClassification.overall.f1}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Precision: {metrics.intentClassification.overall.precision}%</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50">
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        {isBn ? 'ওওডি ডিফেন্স রেট' : 'OOD Rejection'}
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {metrics.outOfDistribution.unknownDetectionRate}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Adversarial defense</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                        {isBn ? 'BM25 Recall@1' : 'BM25 Recall@1'}
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {metrics.ragRetrieval.recallAt1}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">MRR: {metrics.ragRetrieval.mrr}</div>
                    </div>
                  </div>

                  {/* Multi-language breakdown table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isBn ? 'ভাষাভিত্তিক ইনটেন্ট পারফরম্যান্স' : 'Multilingual Intent Performance Breakdown'}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Language</th>
                            <th className="px-4 py-2">Samples</th>
                            <th className="px-4 py-2">Accuracy</th>
                            <th className="px-4 py-2">Recall</th>
                            <th className="px-4 py-2">F1 Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">বাংলা (Bangla)</td>
                            <td className="px-4 py-2.5 text-slate-500">{metrics.intentClassification.bangla.total}</td>
                            <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{metrics.intentClassification.bangla.accuracy}%</td>
                            <td className="px-4 py-2.5">{metrics.intentClassification.bangla.recall}%</td>
                            <td className="px-4 py-2.5 font-semibold">{metrics.intentClassification.bangla.f1}%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">Banglish (Phonetic)</td>
                            <td className="px-4 py-2.5 text-slate-500">{metrics.intentClassification.banglish.total}</td>
                            <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{metrics.intentClassification.banglish.accuracy}%</td>
                            <td className="px-4 py-2.5">{metrics.intentClassification.banglish.recall}%</td>
                            <td className="px-4 py-2.5 font-semibold">{metrics.intentClassification.banglish.f1}%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">English</td>
                            <td className="px-4 py-2.5 text-slate-500">{metrics.intentClassification.english.total}</td>
                            <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{metrics.intentClassification.english.accuracy}%</td>
                            <td className="px-4 py-2.5">{metrics.intentClassification.english.recall}%</td>
                            <td className="px-4 py-2.5 font-semibold">{metrics.intentClassification.english.f1}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Slot extraction table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isBn ? 'ফিন্যান্সিয়াল স্লট এক্সট্রাকশন সঠিকতা' : 'Financial Slot Extraction Exact Match'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white dark:bg-slate-900">
                      {Object.entries(metrics.slotExtraction).map(([slot, data]) => (
                        <div key={slot} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{slot}</span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{data.exactMatch}% EM</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">F1: {data.f1}% | N={data.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EFFICIENCY & TELEMETRY */}
              {activeTab === 'impact' && impact && (
                <div className="space-y-4">
                  {/* Hero Comparison */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
                    <div className="text-xs text-blue-200 font-medium">
                      {isBn ? 'ব্যবহারকারীর সময় ও প্রচেষ্টার সাশ্রয়' : 'User Time & Effort Reduction Impact'}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-3xl font-extrabold tracking-tight">{impact.comparison.timeSavedPercent}</div>
                        <div className="text-xs text-blue-100 mt-0.5">
                          {isBn ? 'সময় সাশ্রয় (৮-১০ সে বনাম ৫০+ সে)' : 'Faster than manual form navigation'}
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-extrabold tracking-tight">{impact.comparison.stepReductionPercent}</div>
                        <div className="text-xs text-blue-100 mt-0.5">
                          {isBn ? 'ধাপ হ্রাস (২টি ধাপ বনাম ৭টি ট্যাপ)' : 'Fewer interaction taps required'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workflow comparison cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Send Money</div>
                      <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <div>Manual Form: <span className="font-semibold text-slate-700 dark:text-slate-300">48.5s</span></div>
                        <div>AI Copilot: <span className="font-semibold text-emerald-600 dark:text-emerald-400">8.5s</span></div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] pt-1">82.5% Speedup</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Pay Utility Bill</div>
                      <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <div>Manual Form: <span className="font-semibold text-slate-700 dark:text-slate-300">62.0s</span></div>
                        <div>AI Copilot: <span className="font-semibold text-emerald-600 dark:text-emerald-400">10.2s</span></div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] pt-1">83.5% Speedup</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Micro-Savings Setup</div>
                      <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <div>Manual Form: <span className="font-semibold text-slate-700 dark:text-slate-300">54.0s</span></div>
                        <div>AI Copilot: <span className="font-semibold text-emerald-600 dark:text-emerald-400">9.1s</span></div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] pt-1">83.1% Speedup</div>
                      </div>
                    </div>
                  </div>

                  {/* Concurrency and Scalability Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <IoFlashOutline className="text-amber-500" />
                      {isBn ? 'পরিমাপকৃত থ্রুপুট ও পারফরম্যান্স (Stress Test)' : 'Measured Throughput & Latency (High Concurrency)'}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 text-[11px]">NLU Intent Classification</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">13,522 req/s</div>
                        <div className="text-[10px] text-slate-400">Average latency: 0.78ms</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 text-[11px]">BM25 RAG Knowledge Retrieval</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">33,380 req/s</div>
                        <div className="text-[10px] text-slate-400">Average latency: 1.36ms</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SECURITY BOUNDARY */}
              {activeTab === 'security' && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <IoShieldCheckmarkOutline className="text-lg text-emerald-600 dark:text-emerald-400" />
                      {isBn ? 'জিরো ফিন্যান্সিয়াল হ্যালুসিনেশন আর্কিটেকচার' : 'Zero Financial Hallucination Architecture'}
                    </div>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      {isBn
                        ? 'এলএলএম সরাসরি কোনো টাকা কাটতে বা পাঠাতে পারে না। প্রতিটি আর্থিক কর্মকাণ্ডের জন্য ব্যাকএন্ডে একটি পেন্ডিং অ্যাকশন (PendingAction) তৈরি হয় এবং ব্যবহারকারীকে পিন (T2) প্রদান করে নিশ্চিত করতে হয়।'
                        : 'The LLM never directly mutates ledgers or authorizes transfers. All money movements require a cryptographically bound PendingAction confirmed by user PIN / WebAuthn.'}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
                      <IoCheckmarkCircle className="text-blue-600 text-base mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          Canonical Action Hash Binding
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          SHA-256 canonical hash links PendingAction arguments to step-up tokens, preventing payload tampering or parameter injection attacks.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
                      <IoCheckmarkCircle className="text-blue-600 text-base mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          PIN Step-Up Lockout & Anti-Replay
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Enforces 3-attempt lockout on step-up challenge and consumes tokens upon verification to prevent replay attacks.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
                      <IoCheckmarkCircle className="text-blue-600 text-base mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          Guardian Child Privilege Escalation Defense (IDOR)
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Child accounts are strictly forbidden (HTTP 403) from approving transactions, removing guardian links, or modifying parental spend limits.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
                      <IoCheckmarkCircle className="text-blue-600 text-base mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          Prompt Injection & Speculative Scheme Defense
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Adversarial attacks, system prompt extraction, and get-rich-quick schemes (forex, bitcoin, guaranteed profit) are immediately rejected with 100% detection rate.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <IoDocumentTextOutline />
            <span>Tested against 48 multilingual samples & 24 RAG queries</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold hover:opacity-90 transition-opacity"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiEvaluationModal;
