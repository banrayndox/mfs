import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  IoCloseOutline,
  IoFlashOutline,
  IoAlarmOutline,
  IoAddCircleOutline,
  IoLockClosedOutline,
  IoAlertCircleOutline,
} from 'react-icons/io5';
import { ScheduledRulesColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { formatCurrency } from '../../utils/formatters.js';

export function ScheduledRulesModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('schedules'); // 'schedules' | 'rules' | 'reminders'
  const [schedules, setSchedules] = useState([]);
  const [rules, setRules] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states: Schedule
  const [schedType, setSchedType] = useState('send_money');
  const [schedRecipient, setSchedRecipient] = useState('');
  const [schedAmount, setSchedAmount] = useState('');
  const [schedFreq, setSchedFreq] = useState('one_time');
  const [schedDate, setSchedDate] = useState('');
  const [schedPin, setSchedPin] = useState('');

  // Form states: Rule
  const [ruleTriggerMin, setRuleTriggerMin] = useState('1000');
  const [ruleActionType, setRuleActionType] = useState('pay_bill');
  const [ruleBiller, setRuleBiller] = useState('DPDC');
  const [ruleAccountNo, setRuleAccountNo] = useState('442109');
  const [ruleAmount, setRuleAmount] = useState('500');
  const [rulePin, setRulePin] = useState('');

  // Form states: Reminder
  const [remTitle, setRemTitle] = useState('');
  const [remDueAt, setRemDueAt] = useState('');
  const [remAmount, setRemAmount] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setShowAddForm(false);
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const [sRes, rRes, remRes] = await Promise.all([
        axios.get('/api/schedules'),
        axios.get('/api/schedules/rules'),
        axios.get('/api/schedules/reminders'),
      ]);
      setSchedules(sRes.data.schedules || []);
      setRules(rRes.data.rules || []);
      setReminders(remRes.data.reminders || []);
    } catch (err) {}
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const bdtAmount = parseFloat(schedAmount) || 0;
      const amountPoisha = Math.round(bdtAmount * 100);

      // 1. Prepare Schedule on backend -> creates PendingAction with canonical actionHash
      const prepRes = await axios.post('/api/schedules/prepare', {
        actionType: schedType,
        frequency: schedFreq,
        actionPayload: {
          recipientPhone: schedType === 'send_money' ? schedRecipient.trim() : undefined,
          billerId: schedType === 'pay_bill' ? 'DPDC' : undefined,
          accountNo: schedType === 'pay_bill' ? '442109' : undefined,
          amountPoisha,
        },
        nextRunAt: schedDate ? new Date(schedDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        mandate: {
          maxAmountPerRun: amountPoisha,
          dailyCap: amountPoisha * 2,
        },
      });

      const { actionId, actionHash } = prepRes.data.pendingAction;

      // 2. T2 Step-Up with the exact server-generated canonical actionHash
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin: schedPin,
        actionHash,
      });
      const token = stepUpRes.data.stepUpToken;

      // 3. Confirm Schedule with actionId and the exact same canonical actionHash
      await axios.post(
        '/api/schedules/confirm',
        { actionId },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': actionHash,
          },
        }
      );

      setSuccessMsg('শিডিউল সফলভাবে তৈরি হয়েছে (Schedule created successfully)');
      setShowAddForm(false);
      setSchedPin('');
      setSchedAmount('');
      setSchedRecipient('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'শিডিউল তৈরি ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const bdtAmount = parseFloat(ruleAmount) || 0;
      const minAmountPoisha = Math.round((parseFloat(ruleTriggerMin) || 0) * 100);
      const actionAmountPoisha = Math.round(bdtAmount * 100);

      // 1. Prepare Rule on backend -> creates PendingAction with canonical actionHash
      const prepRes = await axios.post('/api/schedules/rules/prepare', {
        trigger: {
          type: 'wallet_credit',
          minAmount: minAmountPoisha,
        },
        action: {
          type: ruleActionType,
          amount: actionAmountPoisha,
          billerId: ruleBiller,
          billAccountNo: ruleAccountNo,
        },
        mandate: {
          maxAmountPerRun: actionAmountPoisha,
          dailyCap: actionAmountPoisha * 2,
        },
      });

      const { actionId, actionHash } = prepRes.data.pendingAction;

      // 2. T2 Step-Up with the exact server-generated canonical actionHash
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin: rulePin,
        actionHash,
      });
      const token = stepUpRes.data.stepUpToken;

      // 3. Confirm Rule with actionId and the exact same canonical actionHash
      await axios.post(
        '/api/schedules/rules/confirm',
        { actionId },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': actionHash,
          },
        }
      );

      setSuccessMsg('শর্তযুক্ত রুল সফলভাবে সংরক্ষিত হয়েছে (Rule created successfully)');
      setShowAddForm(false);
      setRulePin('');
      setRuleAmount('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'রুল তৈরি ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };


  const handleCreateReminder = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const bdtAmount = parseFloat(remAmount) || 0;
      await axios.post('/api/schedules/reminders', {
        title: remTitle.trim(),
        dueAt: remDueAt ? new Date(remDueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        amount: Math.round(bdtAmount * 100),
      });

      setSuccessMsg('রিমাইন্ডার সফলভাবে সংরক্ষিত হয়েছে (Reminder created successfully)');
      setShowAddForm(false);
      setRemTitle('');
      setRemAmount('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'রিমাইন্ডার তৈরি ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <ScheduledRulesColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">শিডিউল ও রুলস (Automations)</h3>
              <p className="text-[11px] text-slate-400">সময়ভিত্তিক লেনদেন, শর্তযুক্ত রুলস ও রিমাইন্ডার</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold gap-1">
          <button
            onClick={() => {
              setTab('schedules');
              setShowAddForm(false);
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              tab === 'schedules' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            শিডিউল ({schedules.length})
          </button>
          <button
            onClick={() => {
              setTab('rules');
              setShowAddForm(false);
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              tab === 'rules' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            শর্তযুক্ত রুল ({rules.length})
          </button>
          <button
            onClick={() => {
              setTab('reminders');
              setShowAddForm(false);
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              tab === 'reminders' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            রিমাইন্ডার ({reminders.length})
          </button>
        </div>

        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <CheckmarkSuccessColorIcon className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5">
            <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Toggle Add Form Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-bold text-brand-blue dark:text-brand-yellow hover:underline flex items-center gap-1"
          >
            <IoAddCircleOutline className="w-4 h-4" />
            <span>{showAddForm ? 'তালিকায় ফিরে যান' : '+ নতুন তৈরি করুন'}</span>
          </button>
        </div>

        {/* 1. SCHEDULES TAB */}
        {tab === 'schedules' && (
          <div>
            {showAddForm ? (
              <form onSubmit={handleCreateSchedule} className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">নতুন শিডিউল পেমেন্ট নির্ধারণ</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">অ্যাকশন টাইপ</label>
                  <select
                    value={schedType}
                    onChange={(e) => setSchedType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  >
                    <option value="send_money">সেন্ড মানি (Send Money)</option>
                    <option value="pay_bill">বিদ্যুৎ বিল (Pay Bill)</option>
                  </select>
                </div>

                {schedType === 'send_money' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">প্রাপকের মোবাইল নম্বর</label>
                    <input
                      type="tel"
                      value={schedRecipient}
                      onChange={(e) => setSchedRecipient(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      required
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">পরিমাণ (BDT)</label>
                  <input
                    type="number"
                    value={schedAmount}
                    onChange={(e) => setSchedAmount(e.target.value)}
                    placeholder="500"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">পৌনঃপুনিকতা (Frequency)</label>
                  <select
                    value={schedFreq}
                    onChange={(e) => setSchedFreq(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs"
                  >
                    <option value="one_time">একবার (One-Time)</option>
                    <option value="recurring_daily">প্রতিদিন (Daily)</option>
                    <option value="recurring_weekly">প্রতি সপ্তাহে (Weekly)</option>
                    <option value="recurring_monthly">প্রতি মাসে (Monthly)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">পরবর্তী রান করার সময়</label>
                  <input
                    type="datetime-local"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">৪-সংখ্যার পিন (PIN for T2 Step-Up)</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={schedPin}
                    onChange={(e) => setSchedPin(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold text-center tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || schedPin.length !== 4}
                  className="w-full py-2 rounded-xl bg-brand-yellow text-slate-900 font-bold text-xs hover:bg-brand-yellow-hover"
                >
                  {loading ? 'প্রসেসিং...' : 'শিডিউল কনফার্ম করুন'}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {schedules.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    কোনো সক্রিয় শিডিউল নেই। নতুন শিডিউল তৈরি করতে উপরের বাটনে ক্লিক করুন অথবা এআই সহকারীকে বলুন।
                  </div>
                ) : (
                  schedules.map((s) => (
                    <div
                      key={s._id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{s.actionType}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {s.frequency || 'one_time'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        পরিমাণ: ৳{((s.mandate?.maxAmountPerRun || 0) / 100).toFixed(2)} | পরবর্তী রান:{' '}
                        {new Date(s.nextRunAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. RULES TAB */}
        {tab === 'rules' && (
          <div>
            {showAddForm ? (
              <form onSubmit={handleCreateRule} className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">নতুন শর্তযুক্ত রুল (WHEN - THEN)</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    শর্ত: ওয়ালেটে টাকা জমার ন্যূনতম সীমা (WHEN Wallet Receives &gt;= BDT)
                  </label>
                  <input
                    type="number"
                    value={ruleTriggerMin}
                    onChange={(e) => setRuleTriggerMin(e.target.value)}
                    placeholder="1000"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    অ্যাকশন: স্বয়ংক্রিয় কার্যকারিতা (THEN Action)
                  </label>
                  <select
                    value={ruleActionType}
                    onChange={(e) => setRuleActionType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  >
                    <option value="pay_bill">বিদ্যুৎ বিল পরিশোধ (Pay Bill)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">বিলারের নাম ও অ্যাকাউন্ট</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ruleBiller}
                      readOnly
                      className="w-1/3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-600 text-xs font-bold text-center"
                    />
                    <input
                      type="text"
                      value={ruleAccountNo}
                      onChange={(e) => setRuleAccountNo(e.target.value)}
                      placeholder="A/C No"
                      required
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">পরিশোধের পরিমাণ (BDT)</label>
                  <input
                    type="number"
                    value={ruleAmount}
                    onChange={(e) => setRuleAmount(e.target.value)}
                    placeholder="500"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">৪-সংখ্যার পিন (PIN for T2 Step-Up)</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={rulePin}
                    onChange={(e) => setRulePin(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold text-center tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || rulePin.length !== 4}
                  className="w-full py-2 rounded-xl bg-brand-yellow text-slate-900 font-bold text-xs hover:bg-brand-yellow-hover"
                >
                  {loading ? 'প্রসেসিং...' : 'শর্তযুক্ত রুল সংরক্ষণ করুন'}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {rules.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    কোনো রুলস সক্রিয় নেই। "নতুন তৈরি করুন" বাটনে ক্লিক করে রুল তৈরি করতে পারেন।
                  </div>
                ) : (
                  rules.map((r) => (
                    <div
                      key={r._id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          WHEN জমা &gt;= ৳{((r.trigger?.minAmount || 0) / 100).toFixed(2)}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {r.action?.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        THEN: {r.action?.billerId} বিল পরিশোধ ৳{((r.action?.amount || 0) / 100).toFixed(2)} (A/C: {r.action?.billAccountNo || '442109'})
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. REMINDERS TAB */}
        {tab === 'reminders' && (
          <div>
            {showAddForm ? (
              <form onSubmit={handleCreateReminder} className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">নতুন রিমাইন্ডার নির্ধারণ</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">রিমাইন্ডার শিরোনাম</label>
                  <input
                    type="text"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder="e.g. বিদ্যুৎ বিল দেওয়ার শেষ তারিখ"
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">তারিখ ও সময়</label>
                  <input
                    type="datetime-local"
                    value={remDueAt}
                    onChange={(e) => setRemDueAt(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">সম্ভাব্য পরিমাণ (ঐচ্ছিক BDT)</label>
                  <input
                    type="number"
                    value={remAmount}
                    onChange={(e) => setRemAmount(e.target.value)}
                    placeholder="1200"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !remTitle.trim()}
                  className="w-full py-2 rounded-xl bg-brand-yellow text-slate-900 font-bold text-xs hover:bg-brand-yellow-hover"
                >
                  {loading ? 'প্রসেসিং...' : 'রিমাইন্ডার সংরক্ষণ করুন'}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {reminders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    কোনো রিমাইন্ডার নেই। "নতুন তৈরি করুন" বাটনে ক্লিক করে বা এআইকে বলে রিমাইন্ডার যোগ করুন।
                  </div>
                ) : (
                  reminders.map((rem) => (
                    <div
                      key={rem._id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <IoAlarmOutline className="w-3.5 h-3.5 text-purple-600" />
                          <span>{rem.title}</span>
                        </p>
                        {rem.amount && (
                          <span className="text-[11px] font-bold text-brand-blue dark:text-brand-yellow">
                            ৳{(rem.amount / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        নির্ধারিত সময়: {new Date(rem.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduledRulesModal;
