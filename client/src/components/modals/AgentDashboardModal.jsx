import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IoCloseOutline } from 'react-icons/io5';
import { StorefrontColorIcon, CashOutColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function AgentDashboardModal({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      axios
        .get('/api/agents/dashboard')
        .then((res) => {
          setData(res.data.dashboard);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto overflow-x-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <StorefrontColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">এজেন্ট ড্যাশবোর্ড (Agent Portal)</h3>
              <p className="text-[11px] text-slate-500 font-mono">{data?.agentId || 'Agent'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Agent Wallet Balance Banner */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-3xl p-5 shadow-soft relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider font-semibold opacity-90">
            এজেন্ট সংগ্রহ ব্যালেন্স (Agent Settlement Wallet)
          </p>
          <p className="text-2xl font-black mt-1">
            {formatCurrency(data?.walletBalancePoisha || user?.balancePoisha, 'bn')}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs opacity-90">
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            <span>স্ট্যাটাস: সক্রিয় (Active Demo Agent)</span>
          </div>
        </div>

        {/* Today's Cash Out Performance */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500">আজকের ক্যাশ আউট (Count)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {data?.todayStats?.count || 0} টি
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500">মোট ক্যাশ সংগ্রহ (Volume)</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatCurrency(data?.todayStats?.volumePoisha || 0, 'bn')}
            </p>
          </div>
        </div>

        {/* Today's Settlement Log */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            আজকের ক্যাশ আউট তালিকা (Today's Collections)
          </h4>

          {(!data?.todayTransactions || data.todayTransactions.length === 0) ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
              আজকে এখনও কোনো গ্রাহক ক্যাশ আউট করেননি। (No cash-outs yet today)
            </div>
          ) : (
            <div className="space-y-2">
              {data.todayTransactions.map((tx) => (
                <div
                  key={tx.txnId}
                  className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <CashOutColorIcon className="w-8 h-8 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{tx.customerName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{tx.customerPhone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">
                      +{formatCurrency(tx.amountPoisha, 'bn')}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentDashboardModal;
