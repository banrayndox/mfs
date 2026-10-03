import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IoAddOutline,
  IoTrashOutline,
  IoAlertCircleOutline,
  IoShieldCheckmark,
} from 'react-icons/io5';
import {
  GuardianColorIcon,
  SavingsColorIcon,
  SpeedometerColorIcon,
  AddMoneyColorIcon,
} from '../components/ui/FlaticonIcons.jsx';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';
import { formatCurrency } from '../utils/formatters.js';

export function Account() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [activeSegment, setActiveSegment] = useState('daily'); // 'daily' | 'monthly'

  // Linked Accounts State
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [institutionName, setInstitutionName] = useState('Sonali Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState(user?.name || '');
  const [accountType, setAccountType] = useState('bank');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchLinkedAccounts = async () => {
    try {
      setLoadingLinked(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.get('/api/wallet/linked-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setLinkedAccounts(res.data.linkedAccounts || []);
      }
    } catch {
      // Fallback
      setLinkedAccounts([]);
    } finally {
      setLoadingLinked(false);
    }
  };

  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setAddError('');

    const cleanAcc = (accountNumber || '').trim().replace(/[\s-]/g, '');
    if (!cleanAcc || cleanAcc.length < 4) {
      setAddError(i18n.language === 'bn' ? 'অ্যাকাউন্ট নম্বর কমপক্ষে ৪ ডিজিট হতে হবে।' : 'Account number must be at least 4 digits.');
      return;
    }

    try {
      setAddLoading(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.post(
        '/api/wallet/linked-accounts',
        {
          institutionName,
          accountNumber: cleanAcc,
          accountType,
          holderName: holderName.trim() || user?.name,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setLinkedAccounts((prev) => [res.data.linkedAccount, ...prev]);
        setAccountNumber('');
        setIsAddOpen(false);
      }
    } catch (err) {
      setAddError(err.response?.data?.message || err.message || 'Failed to link account');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveAccount = async (id) => {
    try {
      const token = localStorage.getItem('guardian_token');
      await axios.delete(`/api/wallet/linked-accounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLinkedAccounts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      console.error('Failed to unlink account:', err);
    }
  };


  return (
    <div className="flex-1 pb-24 px-4 pt-4 space-y-4">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white px-1">
        {t('account.title')}
      </h1>

      {/* Child Guardian Protection Card */}
      {user?.accountType === 'CHILD' && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-slate-900 dark:to-slate-800 rounded-3xl p-4 shadow-soft border border-amber-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GuardianColorIcon className="w-6 h-6" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {i18n.language === 'bn' ? 'অভিভাবক নিয়ন্ত্রণ ও সুরক্ষা' : 'Guardian Protection & Controls'}
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {i18n.language === 'bn' ? 'সুরক্ষিত (Enabled)' : 'Enabled'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-amber-100 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                {i18n.language === 'bn' ? 'অভিভাবক (Guardian)' : 'Parent / Guardian'}
              </span>
              <p className="font-bold text-slate-900 dark:text-white">
                {user.guardian?.name || (i18n.language === 'bn' ? 'সংযুক্ত নেই' : 'Not linked')}
              </p>
              {user.guardian?.phone && (
                <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  {user.guardian.phone}
                </p>
              )}
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-amber-100 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                {i18n.language === 'bn' ? 'নিয়ন্ত্রণ মোড (Mode)' : 'Control Mode'}
              </span>
              <p className="font-bold text-amber-700 dark:text-brand-yellow">
                {user.guardian?.controlMode === 'LIMITED'
                  ? (i18n.language === 'bn' ? 'সীমিত খরচ' : 'Limited')
                  : user.guardian?.controlMode === 'UPDATES_ONLY'
                  ? (i18n.language === 'bn' ? 'শুধুমাত্র আপডেট' : 'Updates Only')
                  : (i18n.language === 'bn' ? 'অনুমোদন প্রয়োজন' : 'Approval Required')}
              </p>
              {user.guardian?.dailyLimitPoisha && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  {i18n.language === 'bn' ? 'দৈনিক সীমা: ' : 'Daily Limit: '}
                  ৳{(user.guardian.dailyLimitPoisha / 100).toFixed(0)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Primary Wallet Card */}
      <div className="bg-gradient-to-br from-brand-blue to-blue-900 text-white rounded-3xl p-5 shadow-elevated relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
          <IoShieldCheckmark className="w-36 h-36" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
            {t('account.primaryWallet')}
          </span>
          <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <p className="text-2xl font-black mb-1">
          {formatCurrency(user?.balancePoisha, i18n.language)}
        </p>
        <p className="text-xs opacity-75 font-mono">ID: {user?.phone || '01712345678'}</p>
      </div>

      {/* Savings Wallet Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SavingsColorIcon className="w-9 h-9 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('account.savingsWallet')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">১টি সক্রিয় লক্ষ্য (1 Active Goal)</p>
          </div>
        </div>
        <p className="text-sm font-bold text-teal-600 dark:text-teal-400">
          ৳ ১০,০০০.০০
        </p>
      </div>

      {/* Limits & Usage Section with Segmented Control */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SpeedometerColorIcon className="w-6 h-6 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('account.limitsAndUsage')}
            </h3>
          </div>

          {/* Segmented Control */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full">
            <button
              onClick={() => setActiveSegment('daily')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeSegment === 'daily'
                  ? 'bg-brand-yellow text-slate-900 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('account.daily')}
            </button>
            <button
              onClick={() => setActiveSegment('monthly')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeSegment === 'monthly'
                  ? 'bg-brand-yellow text-slate-900 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('account.monthly')}
            </button>
          </div>
        </div>

        {/* Progress Bar 1: Send Money Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">সেন্ড মানি সীমা (Send Money)</span>
            <span className="text-slate-500 font-mono">৳ ২,৫০০ / ৳ ৫০,০০০</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue dark:bg-brand-yellow rounded-full w-[5%]"></div>
          </div>
          <p className="text-[10px] text-slate-400 text-right">১ / ৫০ বার ব্যবহৃত</p>
        </div>

        {/* Progress Bar 2: Cash Out Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">ক্যাশ আউট সীমা (Cash Out)</span>
            <span className="text-slate-500 font-mono">৳ ০ / ৳ ৩০,০০০</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-yellow rounded-full w-[0%]"></div>
          </div>
          <p className="text-[10px] text-slate-400 text-right">০ / ৫০ বার ব্যবহৃত</p>
        </div>
      </div>

      {/* Dynamic Linked Accounts (MongoDB backed) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AddMoneyColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('account.linkedAccounts')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {i18n.language === 'bn' ? 'সংযুক্ত ব্যাংক ও কার্ড তালিকা' : 'Manage linked banks and cards'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAddOpen(!isAddOpen);
              setAddError('');
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-yellow hover:bg-brand-yellow/90 text-slate-900 transition-colors shadow-xs"
          >
            <IoAddOutline className="w-4 h-4" />
            <span>{isAddOpen ? (i18n.language === 'bn' ? 'বন্ধ করুন' : 'Close') : (i18n.language === 'bn' ? '+ যুক্ত করুন' : '+ Add')}</span>
          </button>
        </div>

        {/* Add Account Form */}
        {isAddOpen && (
          <form onSubmit={handleAddAccount} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              {i18n.language === 'bn' ? 'নতুন অ্যাকাউন্ট সংযুক্ত করুন' : 'Add New Linked Account'}
            </h4>

            {addError && (
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900">
                <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {i18n.language === 'bn' ? 'ব্যাংক বা প্রতিষ্ঠানের নাম' : 'Bank / Institution'}
                </label>
                <select
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="Sonali Bank">Sonali Bank PLC</option>
                  <option value="Dutch-Bangla Bank">Dutch-Bangla Bank (DBBL)</option>
                  <option value="BRAC Bank">BRAC Bank</option>
                  <option value="City Bank">City Bank PLC</option>
                  <option value="Islami Bank Bangladesh">Islami Bank Bangladesh</option>
                  <option value="Eastern Bank">Eastern Bank PLC</option>
                  <option value="Mutual Trust Bank">Mutual Trust Bank</option>
                  <option value="bKash / Nagad Wallet">bKash / Nagad Wallet</option>
                  <option value="Visa / Mastercard">Visa / Mastercard</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {i18n.language === 'bn' ? 'অ্যাকাউন্ট / কার্ড নম্বর' : 'Account / Card Number'}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 10423456789"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-mono"
                >
                </input>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {i18n.language === 'bn' ? 'অ্যাকাউন্টের ধরন' : 'Account Type'}
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="bank">{i18n.language === 'bn' ? 'ব্যাংক অ্যাকাউন্ট' : 'Bank Account'}</option>
                  <option value="card">{i18n.language === 'bn' ? 'ডেবিট / ক্রেডিট কার্ড' : 'Debit/Credit Card'}</option>
                  <option value="mfs">{i18n.language === 'bn' ? 'এমএফএস ওয়ালেট' : 'MFS Wallet'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {i18n.language === 'bn' ? 'অ্যাকাউন্টধারীর নাম' : 'Holder Name'}
                </label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder={user?.name || 'Full Name'}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={addLoading || !accountNumber}
                className="px-4 py-1.5 rounded-xl bg-brand-yellow text-slate-900 text-xs font-bold shadow-xs hover:bg-brand-yellow/90 disabled:opacity-50"
              >
                {addLoading ? (i18n.language === 'bn' ? 'সংযুক্ত হচ্ছে...' : 'Linking...') : (i18n.language === 'bn' ? 'সংযুক্ত করুন' : 'Link Account')}
              </button>
            </div>
          </form>
        )}

        {/* Linked Accounts List */}
        <div className="space-y-2">
          {loadingLinked ? (
            <p className="text-xs text-slate-400 py-3 text-center">{i18n.language === 'bn' ? 'লোড হচ্ছে...' : 'Loading accounts...'}</p>
          ) : linkedAccounts.length === 0 ? (
            <div className="text-center py-4 px-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {i18n.language === 'bn' ? 'কোনো ব্যাংক অ্যাকাউন্ট সংযুক্ত নেই।' : 'No linked bank accounts found.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {i18n.language === 'bn' ? 'উপরের "+ যুক্ত করুন" বাটনে ক্লিক করে অ্যাকাউন্ট যুক্ত করুন।' : 'Tap "+ Add" above to link a bank or card.'}
              </p>
            </div>
          ) : (
            linkedAccounts.map((acc) => {
              const masked = acc.accountNumber.length > 4
                ? `****${acc.accountNumber.slice(-4)}`
                : acc.accountNumber;
              return (
                <div
                  key={acc._id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100/60 dark:bg-blue-950 text-brand-blue dark:text-yellow-400 flex items-center justify-center font-bold text-xs">
                      {acc.institutionName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {acc.institutionName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {acc.accountType.toUpperCase()} • {masked} {acc.holderName ? `(${acc.holderName})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded-full">
                      {i18n.language === 'bn' ? 'সংযুক্ত' : 'Linked'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAccount(acc._id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title={i18n.language === 'bn' ? 'অ্যাকাউন্ট বিচ্ছিন্ন করুন' : 'Unlink account'}
                    >
                      <IoTrashOutline className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default Account;
