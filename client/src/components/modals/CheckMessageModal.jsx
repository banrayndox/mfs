import React, { useState } from 'react';
import axios from 'axios';
import { IoCloseOutline, IoWarning } from 'react-icons/io5';
import {
  CheckMessageColorIcon,
  SecurityAlertColorIcon,
  CheckmarkSuccessColorIcon,
} from '../ui/FlaticonIcons.jsx';

export function CheckMessageModal({ isOpen, onClose }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const sampleScams = [
    'অভিনন্দন! আপনি গ্রামীণফোনের লটারিতে ২৫ লাখ টাকা জিতেছেন। টাকা পেতে আপনার পিন ও ওটিপি এখনই পাঠান।',
    'জরুরি নোটিশ: আপনার উপায় অ্যাকাউন্ট আজ রাত ১২টায় বন্ধ হয়ে যাবে। চালু রাখতে এই লিংকে ক্লিক করে পাসওয়ার্ড দিন।',
    'Dear Customer, your electricity bill of 1450 BDT has been received. Thank you.',
  ];

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);

    try {
      const res = await axios.post('/api/safety/check-message', { message: text });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <CheckMessageColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">বার্তা পরীক্ষা (Scam & Fraud Shield)</h3>
              <p className="text-[11px] text-slate-400">এআই প্রতারণা ও ফিশিং শনাক্তকারী</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              সন্দেহজনক মেসেজটি পেস্ট করুন (Paste Message)
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="এখানে সন্দেহজনক এসএমএস বা মেসেজ পেস্ট করুন..."
              required
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          {/* Quick Samples */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">নমুনা মেসেজ পরীক্ষা করুন:</span>
            <div className="flex flex-wrap gap-1.5">
              {sampleScams.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText(s)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-brand-yellow hover:text-slate-900 transition-colors truncate max-w-[200px]"
                >
                  নমুনা #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? 'এআই বিশ্লেষণ চলছে...' : 'নিরাপত্তা যাচাই করুন (Analyze Message)'}
          </button>
        </form>

        {result && (
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">ফলাফল (Assessment):</span>
              {result.label === 'scam' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1.5">
                  <SecurityAlertColorIcon className="w-4 h-4" /> ঝুঁকিপূর্ণ স্ক্যাম ({result.score}%)
                </span>
              ) : result.label === 'suspicious' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <IoWarning className="w-4 h-4 text-amber-600" /> সন্দেহজনক ({result.score}%)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                  <CheckmarkSuccessColorIcon className="w-4 h-4" /> আপাত নিরাপদ ({result.score}%)
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
              {result.explanationBn}
            </p>

            {result.reasons && result.reasons.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[11px] font-bold text-slate-400 uppercase">শনাক্তকৃত ঝুঁকি কারণসমূহ:</p>
                {result.reasons.map((r, i) => (
                  <div key={i} className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
                    <span>•</span>
                    <span>{r.bn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckMessageModal;
