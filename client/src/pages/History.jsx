import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  IoSparklesOutline,
  IoShieldCheckmarkOutline,
  IoAlertCircleOutline,
  IoRefreshOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import {
  CashOutColorIcon,
  SendMoneyColorIcon,
  GuardianColorIcon,
  RemindersColorIcon,
} from '../components/ui/FlaticonIcons.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { useAuthStore } from '../stores/authStore.js';

export function History() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'in' | 'out'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/wallet/history?filter=${filter}`);
      if (res.data?.transactions) {
        setTransactions(res.data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch transaction history:', err);
      setError(
        i18n.language === 'bn'
          ? 'লেনদেনের ইতিহাস লোড করতে ব্যর্থ হয়েছে।'
          : 'Failed to load transaction history.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  // Realtime Socket.IO transaction prepending
  useEffect(() => {
    const handleNewTxn = (event) => {
      const raw = event.detail;
      if (!raw) return;

      const isRecipient =
        (user?._id && (raw.recipientUserId === user._id || raw.recipientUserId?._id === user._id)) ||
        (user?.phone && raw.metadata?.recipientPhone === user.phone);

      const normalizedTxn = {
        id: raw.id || raw._id,
        _id: raw._id || raw.id,
        type: raw.type,
        channel: raw.channel,
        status: raw.status || 'settled',
        amountPoisha: raw.amountPoisha ?? raw.amount ?? 0,
        feePoisha: raw.feePoisha ?? raw.fee ?? 0,
        totalPoisha: raw.totalPoisha ?? raw.total ?? (raw.amountPoisha ?? raw.amount ?? 0),
        direction: raw.direction || (isRecipient ? 'in' : 'out'),
        sender: raw.sender || {
          name: raw.metadata?.senderName || 'Sender',
          phone: raw.metadata?.senderPhone,
        },
        recipient: raw.recipient || {
          name: raw.metadata?.recipientName || 'Recipient',
          phone: raw.metadata?.recipientPhone,
        },
        createdAt: raw.createdAt || new Date().toISOString(),
        metadata: raw.metadata,
      };

      // Filter check
      if (filter === 'in' && normalizedTxn.direction !== 'in') return;
      if (filter === 'out' && normalizedTxn.direction !== 'out') return;

      setTransactions((prev) => {
        if (prev.some((t) => t._id === normalizedTxn._id || (t.id && t.id === normalizedTxn.id))) {
          return prev;
        }
        return [normalizedTxn, ...prev];
      });
    };

    window.addEventListener('mfs:transaction:new', handleNewTxn);
    return () => {
      window.removeEventListener('mfs:transaction:new', handleNewTxn);
    };
  }, [user, filter]);

  const getTitleAndSubtitle = (tx) => {
    const isBn = i18n.language === 'bn';

    switch (tx.type) {
      case 'initial_credit':
        return {
          title: isBn ? 'স্বাগতম বোনাস (Welcome Bonus)' : 'Welcome Bonus Credit',
          subtitle: isBn ? 'অ্যাকাউন্ট খোলার উপহার' : 'Registration Gift',
        };
      case 'send':
        if (tx.direction === 'in') {
          return {
            title: isBn ? 'টাকা গ্রহণ (Money Received)' : 'Money Received',
            subtitle: tx.sender ? `${tx.sender.name || ''} (${tx.sender.phone || ''})` : 'MFS Transfer',
          };
        }
        return {
          title: isBn ? 'সেন্ড মানি (Send Money)' : 'Send Money',
          subtitle: tx.recipient ? `${tx.recipient.name || ''} (${tx.recipient.phone || ''})` : 'MFS Transfer',
        };
      case 'cash_out':
        return {
          title: isBn ? 'ক্যাশ আউট (Cash Out)' : 'Cash Out',
          subtitle: tx.recipient?.name || (isBn ? 'এজেন্ট পয়েন্ট' : 'Agent Point'),
        };
      case 'recharge':
        return {
          title: isBn ? 'মোবাইল রিচার্জ (Mobile Recharge)' : 'Mobile Recharge',
          subtitle: `${tx.metadata?.targetPhone || ''} (${tx.metadata?.operator || 'Mobile'})`,
        };
      case 'bill':
        return {
          title: `${tx.metadata?.billerId || 'Utility'} ${isBn ? 'বিল পরিশোধ' : 'Bill'}`,
          subtitle: `${isBn ? 'গ্রাহক নং' : 'A/C'}: ${tx.metadata?.accountNo || '442109'}`,
        };
      case 'add_money':
        return {
          title: isBn ? 'টাকা যোগ (Add Money)' : 'Add Money',
          subtitle: tx.metadata?.bankName || (isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'),
        };
      case 'group_bill':
      case 'split_bill':
        return {
          title: isBn ? 'গ্রুপ বিল শেয়ার (Group Bill)' : 'Group Bill Payment',
          subtitle: tx.metadata?.title || (isBn ? 'শেয়ার বিল পরিশোধ' : 'Bill Share'),
        };
      default:
        return {
          title: tx.type.replace('_', ' ').toUpperCase(),
          subtitle: tx.channel === 'agent' ? 'AI Copilot' : 'Transaction',
        };
    }
  };

  return (
    <div className="flex-1 pb-24 px-4 pt-4 space-y-4 select-none no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('history.title')}
          </h1>
          <p className="text-xs text-slate-400">
            {i18n.language === 'bn' ? 'সরাসরি ডাটাবেস থেকে প্রাপ্ত লেনদেন' : 'Real transactions from MongoDB'}
          </p>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={fetchHistory}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            title="Refresh"
            aria-label="Refresh transactions"
          >
            <IoRefreshOutline className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full text-xs font-semibold overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {['all', 'in', 'out'].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1 rounded-full transition-all capitalize whitespace-nowrap ${
                  filter === mode
                    ? 'bg-brand-yellow text-slate-900 font-bold shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t(`history.filter${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && transactions.length === 0 && (
        <div className="py-20 text-center space-y-2">
          <div className="w-10 h-10 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-400">
            {i18n.language === 'bn' ? 'লেনদেনের তথ্য লোড হচ্ছে...' : 'Loading transactions...'}
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs rounded-2xl border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && transactions.length === 0 && !error && (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-soft">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
            <RemindersColorIcon className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {i18n.language === 'bn' ? 'কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found'}
          </p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {i18n.language === 'bn'
              ? 'সেন্ড মানি, ক্যাশ আউট, রিচার্জ বা বিল পেমেন্ট করলে এখানে সংরক্ষিত হবে।'
              : 'Completed transactions will be recorded here.'}
          </p>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-3">
        {transactions.map((tx) => {
          const { title, subtitle } = getTitleAndSubtitle(tx);
          const isIncome = tx.direction === 'in';
          const isPending = tx.status === 'awaiting_guardian';
          const isFailed = tx.status === 'failed';

          return (
            <div
              key={tx.id}
              className={`bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border transition-all space-y-3 ${
                isPending
                  ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/20'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                      isPending
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                        : isFailed
                        ? 'bg-red-100 dark:bg-red-950 text-red-600'
                        : isIncome
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                    }`}
                  >
                    {isPending ? (
                      <GuardianColorIcon className="w-6 h-6" />
                    ) : isIncome ? (
                      <CashOutColorIcon className="w-6 h-6" />
                    ) : (
                      <SendMoneyColorIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`text-sm font-black ${
                      isPending
                        ? 'text-amber-600'
                        : isIncome
                        ? 'text-emerald-600'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {isIncome ? '+ ' : '- '}
                    {formatCurrency(tx.amountPoisha, i18n.language)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString(
                      i18n.language === 'bn' ? 'bn-BD' : 'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }
                    )}
                  </p>
                </div>
              </div>

              {/* Status & Fee Details */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800/80 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {isPending ? (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <IoAlertCircleOutline className="w-3.5 h-3.5" />
                      {i18n.language === 'bn'
                        ? 'অভিভাবকের অনুমোদনের অপেক্ষায়'
                        : 'Awaiting Guardian Approval'}
                    </span>
                  ) : isFailed ? (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 flex items-center gap-1">
                      {i18n.language === 'bn' ? 'ব্যর্থ' : 'Failed'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center gap-1">
                      <IoShieldCheckmarkOutline className="w-3 h-3" />
                      {i18n.language === 'bn' ? 'সফল ও নিশ্চিত' : 'Settled & Verified'}
                    </span>
                  )}
                  {tx.channel === 'agent' && (
                    <span className="px-2 py-0.5 rounded-full bg-brand-yellow/20 text-brand-blue dark:text-brand-yellow font-bold">
                      AI Copilot
                    </span>
                  )}
                </div>

                {tx.feePoisha > 0 && (
                  <span className="text-slate-400">
                    {i18n.language === 'bn' ? 'ফি: ' : 'Fee: '}
                    {formatCurrency(tx.feePoisha, i18n.language)}
                  </span>
                )}
              </div>

              {/* AI Tip (if generated) */}
              {tx.aiTip && (
                <div className="bg-amber-50/70 dark:bg-slate-800/80 rounded-2xl p-2.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/40 flex items-start gap-2">
                  <IoSparklesOutline className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold leading-relaxed">
                      {i18n.language === 'bn' ? tx.aiTip.tipBn : tx.aiTip.tipEn}
                    </p>
                    {(tx.aiTip.explanationBn || tx.aiTip.explanationEn) && (
                      <p className="text-[11px] opacity-80 mt-1">
                        {i18n.language === 'bn'
                          ? tx.aiTip.explanationBn
                          : tx.aiTip.explanationEn}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default History;
