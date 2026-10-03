import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IoCloseOutline,
  IoShieldCheckmark,
  IoAddOutline,
  IoAlertCircleOutline,
  IoCalendarOutline,
  IoTrendingUpOutline,
  IoRepeatOutline,
  IoPauseOutline,
  IoPlayOutline,
  IoPowerOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoFlashOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5';
import { SavingsColorIcon } from '../ui/FlaticonIcons.jsx';
import axios from 'axios';
import { useAuthStore } from '../../stores/authStore.js';

export function SavingsModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState('auto_savings'); // 'auto_savings' | 'savings' | 'dps'
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Micro-Savings Configuration State (from /api/wallet/savings/config)
  const [microConfig, setMicroConfig] = useState({
    enabled: false,
    paused: false,
    mode: 'percentage',
    percentage: 2,
    roundUpUnit: 10000,
    thresholdMinPoisha: 50000,
    targetPlanId: null,
    totalSavedPoisha: 0,
    savingsCount: 0,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Live Interactive Preview State
  const [previewSampleAmount, setPreviewSampleAmount] = useState('463');

  // Deposit State
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [depositAmount, setDepositAmount] = useState('500');
  const [depositLoading, setDepositLoading] = useState(false);

  // Create Custom Plan State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState('savings'); // 'savings' | 'dps'
  const [customTitle, setCustomTitle] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const [customInstallment, setCustomInstallment] = useState('');
  const [customFrequency, setCustomFrequency] = useState('monthly');
  const [customMonths, setCustomMonths] = useState('12');
  const [customInterest, setCustomInterest] = useState('7.5');
  const [customAutoDebit, setCustomAutoDebit] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Plan State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editInstallment, setEditInstallment] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Action Feedback
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch Plans and Micro-Savings Config
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('guardian_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [plansRes, configRes] = await Promise.all([
        axios.get('/api/wallet/savings-plans', { headers }).catch(() => ({ data: {} })),
        axios.get('/api/wallet/savings/config', { headers }).catch(() => ({ data: {} })),
      ]);

      if (plansRes.data?.success) {
        setPlans(plansRes.data.savingsPlans || []);
      }

      if (configRes.data?.success && configRes.data.microSavings) {
        setMicroConfig({
          ...configRes.data.microSavings,
          targetPlanId: configRes.data.microSavings.targetPlanId || (plansRes.data?.savingsPlans?.[0]?._id ?? null),
        });
      }
    } catch (err) {
      console.error('Failed to load savings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setFeedbackMsg('');
      setErrorMsg('');
      setIsDepositOpen(false);
      setIsCreateOpen(false);
      setIsEditOpen(false);
    }
  }, [isOpen]);

  // Realtime Socket.IO Listeners
  useEffect(() => {
    const handleSavingsUpdate = (event) => {
      const updatedPlan = event.detail;
      if (!updatedPlan) return;
      setPlans((prev) => {
        const index = prev.findIndex((p) => p._id === updatedPlan._id);
        if (index === -1) return [updatedPlan, ...prev];
        const next = [...prev];
        next[index] = updatedPlan;
        return next;
      });
    };

    const handleConfigUpdate = (event) => {
      const updatedConfig = event.detail;
      if (!updatedConfig) return;
      setMicroConfig((prev) => ({
        ...prev,
        ...updatedConfig,
      }));
    };

    window.addEventListener('mfs:savings:update', handleSavingsUpdate);
    window.addEventListener('mfs:savings:config', handleConfigUpdate);

    return () => {
      window.removeEventListener('mfs:savings:update', handleSavingsUpdate);
      window.removeEventListener('mfs:savings:config', handleConfigUpdate);
    };
  }, []);

  if (!isOpen) return null;

  // Save Micro-Savings Configuration
  const handleSaveMicroConfig = async (overrideParams = {}) => {
    setErrorMsg('');
    setFeedbackMsg('');
    setSavingConfig(true);

    try {
      const token = localStorage.getItem('guardian_token');
      const payload = {
        ...microConfig,
        ...overrideParams,
      };

      const res = await axios.post('/api/wallet/savings/config', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setMicroConfig(res.data.microSavings);
        setFeedbackMsg(
          i18n.language === 'bn'
            ? 'স্বয়ংক্রিয় মাইক্রো-সঞ্চয় কনফিগারেশন সংরক্ষিত হয়েছে!'
            : 'Automatic micro-savings configuration saved successfully!'
        );
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Quick Pause / Resume
  const handleTogglePause = async () => {
    const newPaused = !microConfig.paused;
    await handleSaveMicroConfig({ paused: newPaused, enabled: true });
  };

  // Master Enable / Disable
  const handleToggleEnable = async () => {
    const newEnabled = !microConfig.enabled;
    await handleSaveMicroConfig({ enabled: newEnabled, paused: false });
  };

  // Handle Deposit
  const handleDeposit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFeedbackMsg('');

    const num = parseFloat(depositAmount) || 0;
    const poisha = Math.round(num * 100);

    if (num <= 0) {
      setErrorMsg(i18n.language === 'bn' ? 'সঠিক টাকার পরিমাণ দিন।' : 'Enter a valid amount.');
      return;
    }

    if ((user?.balancePoisha || 0) < poisha) {
      setErrorMsg(
        i18n.language === 'bn'
          ? 'অপর্যাপ্ত ব্যালেন্স (Insufficient Balance in primary wallet)'
          : 'Insufficient balance in primary wallet.'
      );
      return;
    }

    try {
      setDepositLoading(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.post(
        `/api/wallet/savings-plans/${selectedPlan._id}/deposit`,
        { amountPoisha: poisha },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        if (user && res.data.newWalletBalancePoisha !== undefined) {
          setUser({ ...user, balancePoisha: res.data.newWalletBalancePoisha });
        }
        setPlans((prev) =>
          prev.map((p) => (p._id === selectedPlan._id ? res.data.updatedPlan : p))
        );
        setFeedbackMsg(
          i18n.language === 'bn'
            ? `সফলভাবে ৳${num.toLocaleString()} সঞ্চয় ফান্ডের জমা হয়েছে!`
            : `Successfully deposited ৳${num.toLocaleString()}!`
        );
        setIsDepositOpen(false);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Deposit failed');
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle Create Plan
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFeedbackMsg('');

    if (!customTitle.trim()) {
      setErrorMsg(i18n.language === 'bn' ? 'পরিকল্পনার শিরোনাম দিন।' : 'Enter a plan title.');
      return;
    }

    const targetNum = parseFloat(customTarget) || 0;
    if (targetNum <= 0) {
      setErrorMsg(i18n.language === 'bn' ? 'টার্গেট পরিমাণ দিন।' : 'Enter target amount.');
      return;
    }

    const installmentNum = parseFloat(customInstallment) || 0;
    const monthsNum = parseInt(customMonths, 10) || 12;
    const interestNum = parseFloat(customInterest) || 0;

    try {
      setCreateLoading(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.post(
        '/api/wallet/savings-plans',
        {
          planType: createType,
          title: customTitle.trim(),
          targetAmountPoisha: Math.round(targetNum * 100),
          installmentAmountPoisha: Math.round(installmentNum * 100),
          frequency: customFrequency,
          durationMonths: monthsNum,
          interestRatePercent: interestNum,
          autoDebit: customAutoDebit,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setPlans((prev) => [res.data.savingsPlan, ...prev]);
        setActiveTab(createType);
        setFeedbackMsg(
          i18n.language === 'bn'
            ? `নতুন ${createType === 'dps' ? 'ডিপিএস স্কিম' : 'সঞ্চয় লক্ষ্য'} সফলভাবে তৈরি হয়েছে!`
            : `New ${createType === 'dps' ? 'DPS scheme' : 'savings goal'} created successfully!`
        );
        setIsCreateOpen(false);
        setCustomTitle('');
        setCustomTarget('');
        setCustomInstallment('');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to create plan');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Edit Plan
  const handleEditPlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    setErrorMsg('');
    setFeedbackMsg('');

    const targetNum = parseFloat(editTarget) || 0;
    if (targetNum <= 0) {
      setErrorMsg(i18n.language === 'bn' ? 'টার্গেট পরিমাণ শূন্যের বেশি হতে হবে।' : 'Target must be greater than zero.');
      return;
    }

    try {
      setEditLoading(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.patch(
        `/api/wallet/savings-plans/${editingPlan._id}`,
        {
          title: editTitle.trim(),
          targetAmountPoisha: Math.round(targetNum * 100),
          installmentAmountPoisha: Math.round((parseFloat(editInstallment) || 0) * 100),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setPlans((prev) =>
          prev.map((p) => (p._id === editingPlan._id ? res.data.savingsPlan : p))
        );
        setFeedbackMsg(
          i18n.language === 'bn' ? 'সঞ্চয় লক্ষ্য সফলভাবে আপডেট হয়েছে!' : 'Savings plan updated successfully!'
        );
        setIsEditOpen(false);
        setEditingPlan(null);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update plan');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete/Cancel Plan
  const handleDeletePlan = async (plan) => {
    if (!window.confirm(
      i18n.language === 'bn'
        ? `আপনি কি নিশ্চিত যে "${plan.title}" বাতিল করতে চান? জমাকৃত টাকা ওয়ালেটে ফেরত আসবে।`
        : `Are you sure you want to cancel "${plan.title}"? Any accumulated balance will be refunded to your primary wallet.`
    )) {
      return;
    }

    try {
      const token = localStorage.getItem('guardian_token');
      const res = await axios.delete(`/api/wallet/savings-plans/${plan._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setPlans((prev) => prev.filter((p) => p._id !== plan._id));
        setFeedbackMsg(res.data.message);
        // Refresh balance if refund occurred
        if (res.data.refundedPoisha > 0 && user) {
          setUser({ ...user, balancePoisha: (user.balancePoisha || 0) + res.data.refundedPoisha });
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to cancel plan');
    }
  };

  // Preview Calculations matching backend math
  const sampleNum = parseFloat(previewSampleAmount) || 0;
  const samplePoisha = Math.round(sampleNum * 100);

  // Mode A: Percentage
  const previewPercentageSavedPoisha =
    samplePoisha > 0 && microConfig.percentage > 0
      ? Math.round((samplePoisha * microConfig.percentage) / 100)
      : 0;
  const previewPercentageBdt = (previewPercentageSavedPoisha / 100).toFixed(2);

  // Mode B: Round-Up
  const unit = microConfig.roundUpUnit || 10000;
  const rem = samplePoisha % unit;
  const previewRoundUpSavedPoisha = samplePoisha > 0 && rem > 0 ? unit - rem : 0;
  const previewRoundUpBdt = (previewRoundUpSavedPoisha / 100).toFixed(2);
  const previewRoundUpTargetBdt = ((samplePoisha + previewRoundUpSavedPoisha) / 100).toFixed(2);

  // Mode C: Threshold
  const threshPoisha = microConfig.thresholdMinPoisha || 50000;
  const previewThresholdSavedPoisha =
    samplePoisha > threshPoisha ? previewRoundUpSavedPoisha : 0;
  const previewThresholdBdt = (previewThresholdSavedPoisha / 100).toFixed(2);

  const filteredPlans = plans.filter((p) => p.planType === activeTab && p.status !== 'cancelled');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 select-none">
      <div className="w-full max-w-[500px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] flex flex-col no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <SavingsColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {i18n.language === 'bn' ? 'সঞ্চয় ও ডিপিএস (Savings & DPS)' : 'Savings & DPS'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {i18n.language === 'bn'
                  ? 'ম্যানুয়াল কাস্টমাইজেশন ও স্বয়ংক্রিয় সঞ্চয়'
                  : 'Manual customization & auto micro-savings'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <IoCloseOutline className="w-6 h-6" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {feedbackMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900 shrink-0">
            <IoShieldCheckmark className="w-5 h-5 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-900 shrink-0">
            <IoAlertCircleOutline className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Switcher: 3 Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold shrink-0 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('auto_savings');
              setIsCreateOpen(false);
              setIsDepositOpen(false);
              setIsEditOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'auto_savings'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500'
            }`}
          >
            <IoFlashOutline className="w-3.5 h-3.5" />
            <span>{i18n.language === 'bn' ? 'অটো-সেভিংস' : 'Auto-Savings'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('savings');
              setIsCreateOpen(false);
              setIsDepositOpen(false);
              setIsEditOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'savings'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500'
            }`}
          >
            {i18n.language === 'bn' ? 'সঞ্চয় লক্ষ্য' : 'Savings Goals'}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('dps');
              setIsCreateOpen(false);
              setIsDepositOpen(false);
              setIsEditOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'dps'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500'
            }`}
          >
            {i18n.language === 'bn' ? 'ডিপিএস স্কিম' : 'DPS Schemes'}
          </button>
        </div>

        {/* Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* ==================================================== */}
          {/* TAB 1: AUTO MICRO-SAVINGS MANUAL CUSTOMIZATION       */}
          {/* ==================================================== */}
          {activeTab === 'auto_savings' && (
            <div className="space-y-4">
              {/* Status Header Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {i18n.language === 'bn' ? 'বর্তমান অবস্থা:' : 'Current Status:'}
                    </span>
                    {microConfig.enabled ? (
                      microConfig.paused ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          ⏸️ {i18n.language === 'bn' ? 'স্থগিত (PAUSED)' : 'PAUSED'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          ✅ {i18n.language === 'bn' ? 'সক্রিয় (ACTIVE)' : 'ACTIVE'}
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        ⛔ {i18n.language === 'bn' ? 'বন্ধ (DISABLED)' : 'DISABLED'}
                      </span>
                    )}
                  </div>

                  {/* Master Enable/Disable Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleEnable}
                    disabled={savingConfig}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                      microConfig.enabled
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <IoPowerOutline className="w-3.5 h-3.5" />
                    <span>
                      {microConfig.enabled
                        ? (i18n.language === 'bn' ? 'বন্ধ করুন' : 'Disable')
                        : (i18n.language === 'bn' ? 'চালু করুন' : 'Enable')}
                    </span>
                  </button>
                </div>

                {/* Pause / Resume Controls if Enabled */}
                {microConfig.enabled && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] text-slate-500">
                      {microConfig.paused
                        ? (i18n.language === 'bn'
                            ? 'সঞ্চয় সাময়িক স্থগিত আছে। লেনদেনে টাকা কাটা হবে না।'
                            : 'Savings is paused. Transactions will not deduct auto-savings.')
                        : (i18n.language === 'bn'
                            ? 'সঞ্চয় সক্রিয় আছে। প্রতিটি লেনদেনে স্বয়ংক্রিয়ভাবে জমা হবে।'
                            : 'Savings is active and deducting automatically on transactions.')}
                    </p>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      disabled={savingConfig}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                        microConfig.paused
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                      }`}
                    >
                      {microConfig.paused ? <IoPlayOutline className="w-3.5 h-3.5" /> : <IoPauseOutline className="w-3.5 h-3.5" />}
                      <span>
                        {microConfig.paused
                          ? (i18n.language === 'bn' ? 'চালু করুন' : 'Resume')
                          : (i18n.language === 'bn' ? 'স্থগিত করুন' : 'Pause')}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Customization Cards */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {i18n.language === 'bn' ? 'সঞ্চয় পদ্ধতি নির্বাচন ও কনফিগারেশন' : 'Savings Method & Configuration'}
                </span>

                {/* Mode Option 1: Percentage Savings */}
                <div
                  onClick={() => setMicroConfig({ ...microConfig, mode: 'percentage' })}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    microConfig.mode === 'percentage'
                      ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="savingsMode"
                        checked={microConfig.mode === 'percentage'}
                        onChange={() => setMicroConfig({ ...microConfig, mode: 'percentage' })}
                        className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {i18n.language === 'bn' ? '১. শতাংশ সঞ্চয় (Percentage Savings)' : '1. Percentage-based Savings'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                      {microConfig.percentage}%
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 pl-6">
                    {i18n.language === 'bn'
                      ? 'প্রতিটি লেনদেন থেকে নির্বাচিত শতাংশ টাকা স্বয়ংক্রিয়ভাবে সঞ্চয় তহবিলে জমা হবে।'
                      : 'Automatically saves a selected percentage from every outgoing transaction.'}
                  </p>

                  {/* Percentage Presets & Custom Input */}
                  {microConfig.mode === 'percentage' && (
                    <div className="pl-6 pt-1 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[1, 2, 5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMicroConfig({ ...microConfig, percentage: pct });
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                              microConfig.percentage === pct
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-[11px] font-semibold text-slate-500">
                          {i18n.language === 'bn' ? 'কাস্টম শতাংশ (১-২৫%):' : 'Custom % (1-25%):'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="25"
                          value={microConfig.percentage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setMicroConfig({ ...microConfig, percentage: Math.min(25, Math.max(1, val)) });
                          }}
                          className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Option 2: Round-Up Savings */}
                <div
                  onClick={() => setMicroConfig({ ...microConfig, mode: 'round_up' })}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    microConfig.mode === 'round_up'
                      ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="savingsMode"
                        checked={microConfig.mode === 'round_up'}
                        onChange={() => setMicroConfig({ ...microConfig, mode: 'round_up' })}
                        className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {i18n.language === 'bn' ? '২. রাউন্ড-আপ সঞ্চয় (Round-Up Savings)' : '2. Round-Up Savings'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                      নিকটতম ৳{(microConfig.roundUpUnit || 10000) / 100}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 pl-6">
                    {i18n.language === 'bn'
                      ? 'দৈনন্দিন খরচের খুচরা অংশ পূর্ণ সংখ্যায় রাউন্ড করে অতিরিক্ত অংশটি সঞ্চয় তহবিলে জমা হয়।'
                      : 'Rounds transactions up to the nearest round figure and sweeps the difference to savings.'}
                  </p>

                  {/* Round-up Unit Selector */}
                  {microConfig.mode === 'round_up' && (
                    <div className="pl-6 pt-1 flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: '৳১০ (নিকটতম ১০)', unit: 1000 },
                        { label: '৳৫০ (নিকটতম ৫০)', unit: 5000 },
                        { label: '৳১০০ (নিকটতম ১০০)', unit: 10000 },
                      ].map((item) => (
                        <button
                          key={item.unit}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMicroConfig({ ...microConfig, roundUpUnit: item.unit });
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                            microConfig.roundUpUnit === item.unit
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mode Option 3: Threshold Savings */}
                <div
                  onClick={() => setMicroConfig({ ...microConfig, mode: 'threshold' })}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    microConfig.mode === 'threshold'
                      ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="savingsMode"
                        checked={microConfig.mode === 'threshold'}
                        onChange={() => setMicroConfig({ ...microConfig, mode: 'threshold' })}
                        className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {i18n.language === 'bn' ? '৩. থ্রেশহোল্ড সঞ্চয় (Threshold Savings)' : '3. Threshold-based Savings'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                      &gt; ৳{(microConfig.thresholdMinPoisha || 50000) / 100}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 pl-6">
                    {i18n.language === 'bn'
                      ? 'খরচ যখন নির্ধারিত থ্রেশহোল্ডের বেশি হবে, কেবল তখনই অতিরিক্ত অংশ রাউন্ড করে সঞ্চয় হবে।'
                      : 'Only triggers savings when spending exceeds your minimum threshold amount.'}
                  </p>
                </div>
              </div>

              {/* Target Savings Plan Destination */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {i18n.language === 'bn' ? 'সঞ্চয় জমার গন্তব্য (Target Goal)' : 'Target Savings Goal Destination'}
                </label>
                <select
                  value={microConfig.targetPlanId || ''}
                  onChange={(e) => setMicroConfig({ ...microConfig, targetPlanId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  {plans
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title} (বর্তমান: ৳{(p.currentAmountPoisha / 100).toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              {/* Live Interactive Calculation Preview */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <IoFlashOutline className="w-4 h-4 text-amber-600" />
                    <span>{i18n.language === 'bn' ? 'হিসাবের লাইভ পূর্বরূপ (Preview)' : 'Live Calculation Preview'}</span>
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-amber-800 dark:text-amber-300">{i18n.language === 'bn' ? 'নমুনা খরচ:' : 'Sample:'} ৳</span>
                    <input
                      type="number"
                      value={previewSampleAmount}
                      onChange={(e) => setPreviewSampleAmount(e.target.value)}
                      className="w-16 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-bold font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/60 text-xs space-y-1.5">
                  {microConfig.mode === 'percentage' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{i18n.language === 'bn' ? 'খরচের পরিমাণ:' : 'Spend Amount:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">৳{sampleNum.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-teal-600 dark:text-teal-400 font-bold">
                        <span>{i18n.language === 'bn' ? `সঞ্চয় (${microConfig.percentage}%):` : `Saved (${microConfig.percentage}%):`}</span>
                        <span className="font-mono">+৳{previewPercentageBdt}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {i18n.language === 'bn'
                          ? `৳${sampleNum} লেনদেনে ${microConfig.percentage}% হিসেবে ৳${previewPercentageBdt} আপনার সঞ্চয় ফান্ডের জমা হবে।`
                          : `Spending ৳${sampleNum} automatically saves ৳${previewPercentageBdt} into your fund.`}
                      </p>
                    </>
                  )}

                  {microConfig.mode === 'round_up' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{i18n.language === 'bn' ? 'খরচের পরিমাণ:' : 'Spend Amount:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">৳{sampleNum.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{i18n.language === 'bn' ? 'রাউন্ড-আপ টার্গেট:' : 'Round-Up Target:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">৳{previewRoundUpTargetBdt}</span>
                      </div>
                      <div className="flex justify-between text-teal-600 dark:text-teal-400 font-bold">
                        <span>{i18n.language === 'bn' ? 'স্বয়ংক্রিয় সঞ্চয়:' : 'Spare Change Saved:'}</span>
                        <span className="font-mono">+৳{previewRoundUpBdt}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {i18n.language === 'bn'
                          ? `৳${sampleNum} খরচ করলে নিকটতম ৳${previewRoundUpTargetBdt} ধরে ৳${previewRoundUpBdt} সঞ্চয় হবে।`
                          : `Spending ৳${sampleNum} rounds to ৳${previewRoundUpTargetBdt}, sweeping ৳${previewRoundUpBdt} to savings.`}
                      </p>
                    </>
                  )}

                  {microConfig.mode === 'threshold' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{i18n.language === 'bn' ? 'থ্রেশহোল্ড সীমা:' : 'Threshold Limit:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">৳{(threshPoisha / 100).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-teal-600 dark:text-teal-400 font-bold">
                        <span>{i18n.language === 'bn' ? 'স্বয়ংক্রিয় সঞ্চয়:' : 'Saved:'}</span>
                        <span className="font-mono">+৳{previewThresholdBdt}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Accumulated Stats Bar */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400">{i18n.language === 'bn' ? 'মোট অটো-সঞ্চয়' : 'Total Auto-Saved'}</p>
                  <p className="text-sm font-bold font-mono text-teal-600 dark:text-teal-400">
                    ৳{((microConfig.totalSavedPoisha || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400">{i18n.language === 'bn' ? 'সঞ্চয়ের সংখ্যা' : 'Savings Count'}</p>
                  <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    {microConfig.savingsCount || 0} {i18n.language === 'bn' ? 'বার' : 'times'}
                  </p>
                </div>
              </div>

              {/* Save Configuration Button */}
              <button
                type="button"
                onClick={() => handleSaveMicroConfig({ enabled: true })}
                disabled={savingConfig}
                className="w-full py-3 rounded-2xl bg-brand-yellow hover:bg-brand-yellow/90 text-slate-900 font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <IoCheckmarkCircle className="w-4 h-4" />
                <span>
                  {savingConfig
                    ? (i18n.language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                    : (i18n.language === 'bn' ? 'কনফিগারেশন সংরক্ষণ করুন' : 'Save Configuration')}
                </span>
              </button>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2 & 3: SAVINGS GOALS & DPS SCHEMES               */}
          {/* ==================================================== */}
          {(activeTab === 'savings' || activeTab === 'dps') && (
            <div className="space-y-3.5">
              {/* Action Buttons to open Create Modal */}
              {!isCreateOpen && !isDepositOpen && !isEditOpen && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    {activeTab === 'savings'
                      ? (i18n.language === 'bn' ? 'আপনার সঞ্চয়সমূহ' : 'Your Savings Goals')
                      : (i18n.language === 'bn' ? 'আপনার ডিপিএস স্কিমসমূহ' : 'Your Active DPS Schemes')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateType(activeTab);
                      setIsCreateOpen(true);
                      setIsDepositOpen(false);
                      setIsEditOpen(false);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-yellow hover:bg-brand-yellow/90 text-slate-900 transition-colors shadow-xs"
                  >
                    <IoAddOutline className="w-4 h-4" />
                    <span>
                      {activeTab === 'savings'
                        ? (i18n.language === 'bn' ? '+ কাস্টম সঞ্চয়' : '+ Custom Savings')
                        : (i18n.language === 'bn' ? '+ কাস্টম ডিপিএস' : '+ Custom DPS')}
                    </span>
                  </button>
                </div>
              )}

              {/* Form: Deposit */}
              {isDepositOpen && selectedPlan && (
                <form onSubmit={handleDeposit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedPlan.title}-এ জমা দিন
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      {i18n.language === 'bn' ? 'টার্গেট: ' : 'Target: '}৳{(selectedPlan.targetAmountPoisha / 100).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                      {i18n.language === 'bn' ? 'জমার পরিমাণ (BDT)' : 'Deposit Amount (BDT)'}
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="50"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-bold focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsDepositOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={depositLoading || !depositAmount}
                      className="flex-1 py-2 rounded-xl bg-brand-yellow text-xs font-bold text-slate-900 hover:bg-brand-yellow-hover disabled:opacity-50"
                    >
                      {depositLoading
                        ? (i18n.language === 'bn' ? 'জমা হচ্ছে...' : 'Processing...')
                        : (i18n.language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm Deposit')}
                    </button>
                  </div>
                </form>
              )}

              {/* Form: Edit Plan */}
              {isEditOpen && editingPlan && (
                <form onSubmit={handleEditPlan} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {i18n.language === 'bn' ? 'সঞ্চয় লক্ষ্য সম্পাদনা করুন' : 'Edit Savings Goal'}
                    </h4>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {i18n.language === 'bn' ? 'শিরোনাম' : 'Title'}
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {i18n.language === 'bn' ? 'টার্গেট (BDT)' : 'Target (BDT)'}
                      </label>
                      <input
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {i18n.language === 'bn' ? 'কিস্তি (BDT)' : 'Installment'}
                      </label>
                      <input
                        type="number"
                        value={editInstallment}
                        onChange={(e) => setEditInstallment(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-1 py-2 rounded-xl bg-brand-yellow text-xs font-bold text-slate-900 hover:bg-brand-yellow-hover disabled:opacity-50"
                    >
                      {editLoading
                        ? (i18n.language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                        : (i18n.language === 'bn' ? 'আপডেট করুন' : 'Update Goal')}
                    </button>
                  </div>
                </form>
              )}

              {/* Form: Create Custom Plan */}
              {isCreateOpen && (
                <form onSubmit={handleCreatePlan} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-3.5 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {createType === 'dps'
                        ? (i18n.language === 'bn' ? 'নতুন কাস্টম ডিপিএস স্কিম কনফিগার' : 'Configure Custom DPS Scheme')
                        : (i18n.language === 'bn' ? 'নতুন কাস্টম সঞ্চয় লক্ষ্য কনফিগার' : 'Configure Custom Savings Goal')}
                    </h4>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {createType === 'dps'
                        ? (i18n.language === 'bn' ? 'ডিপিএস স্কিমের নাম' : 'DPS Scheme Title')
                        : (i18n.language === 'bn' ? 'সঞ্চয় লক্ষ্যের নাম' : 'Savings Goal Title')}
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={createType === 'dps' ? 'যেমন: ভবিষ্যত সঞ্চয় ডিপিএস' : 'যেমন: বাইক ফান্ড, জরুরি সঞ্চয়'}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {createType === 'dps'
                          ? (i18n.language === 'bn' ? 'মাসিক কিস্তি (BDT)' : 'Monthly Deposit (BDT)')
                          : (i18n.language === 'bn' ? 'কিস্তি / সঞ্চয় (BDT)' : 'Contribution (BDT)')}
                      </label>
                      <input
                        type="number"
                        value={customInstallment}
                        onChange={(e) => {
                          setCustomInstallment(e.target.value);
                          if (createType === 'dps') {
                            const ins = parseFloat(e.target.value) || 0;
                            const m = parseInt(customMonths, 10) || 12;
                            const r = parseFloat(customInterest) || 7.5;
                            const total = ins * m * (1 + (r * m) / 2400);
                            setCustomTarget(Math.round(total).toString());
                          }
                        }}
                        placeholder="1000"
                        min="0"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {i18n.language === 'bn' ? 'টার্গেট পরিমাণ (BDT)' : 'Target Amount (BDT)'}
                      </label>
                      <input
                        type="number"
                        value={customTarget}
                        onChange={(e) => setCustomTarget(e.target.value)}
                        placeholder="25000"
                        min="500"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {i18n.language === 'bn' ? 'মেয়াদ (মাস)' : 'Duration (Months)'}
                      </label>
                      <select
                        value={customMonths}
                        onChange={(e) => {
                          setCustomMonths(e.target.value);
                          if (createType === 'dps' && customInstallment) {
                            const ins = parseFloat(customInstallment) || 0;
                            const m = parseInt(e.target.value, 10) || 12;
                            const r = parseFloat(customInterest) || 7.5;
                            const total = ins * m * (1 + (r * m) / 2400);
                            setCustomTarget(Math.round(total).toString());
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="3">৩ মাস (3 Months)</option>
                        <option value="6">৬ মাস (6 Months)</option>
                        <option value="12">১২ মাস / ১ বছর (1 Year)</option>
                        <option value="24">২৪ মাস / ২ বছর (2 Years)</option>
                        <option value="36">৩৬ মাস / ৩ বছর (3 Years)</option>
                        <option value="60">৬০ মাস / ৫ বছর (5 Years)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {createType === 'dps'
                          ? (i18n.language === 'bn' ? 'মুনাফার হার (%)' : 'Interest Rate (%)')
                          : (i18n.language === 'bn' ? 'ফ্রিকোয়েন্সি' : 'Frequency')}
                      </label>
                      {createType === 'dps' ? (
                        <input
                          type="number"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          step="0.1"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                        />
                      ) : (
                        <select
                          value={customFrequency}
                          onChange={(e) => setCustomFrequency(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold"
                        >
                          <option value="monthly">মাসিক (Monthly)</option>
                          <option value="weekly">সাপ্তাহিক (Weekly)</option>
                          <option value="daily">দৈনিক (Daily)</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading || !customTitle || !customTarget}
                      className="flex-1 py-2 rounded-xl bg-brand-yellow text-xs font-bold text-slate-900 hover:bg-brand-yellow-hover disabled:opacity-50"
                    >
                      {createLoading
                        ? (i18n.language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                        : (i18n.language === 'bn' ? 'প্ল্যান তৈরি করুন' : 'Create Plan')}
                    </button>
                  </div>
                </form>
              )}

              {/* List of Goals / Schemes */}
              {loading ? (
                <p className="text-xs text-center py-6 text-slate-400">
                  {i18n.language === 'bn' ? 'প্ল্যানসমূহ লোড হচ্ছে...' : 'Loading plans...'}
                </p>
              ) : filteredPlans.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {activeTab === 'savings'
                      ? (i18n.language === 'bn' ? 'কোনো সঞ্চয় লক্ষ্য পাওয়া যায়নি।' : 'No savings goals found.')
                      : (i18n.language === 'bn' ? 'কোনো ডিপিএস স্কিম পাওয়া যায়নি।' : 'No DPS schemes found.')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {i18n.language === 'bn'
                      ? 'উপরের "+ কাস্টম" বাটনে ক্লিক করে নিজের মতো কনফিগার করুন।'
                      : 'Tap "+ Custom" above to configure your personalized plan.'}
                  </p>
                </div>
              ) : (
                filteredPlans.map((plan) => {
                  const currentBdt = plan.currentAmountPoisha / 100;
                  const targetBdt = plan.targetAmountPoisha / 100;
                  const progress = Math.min(100, Math.round((currentBdt / targetBdt) * 100));
                  const remainingBdt = Math.max(0, targetBdt - currentBdt);

                  return (
                    <div
                      key={plan._id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm space-y-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{plan.title}</span>
                            {plan.planType === 'dps' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                DPS {plan.interestRatePercent}%
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <IoCalendarOutline className="w-3 h-3" />
                              {plan.durationMonths} {i18n.language === 'bn' ? 'মাস' : 'Months'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <IoRepeatOutline className="w-3 h-3" />
                              {plan.frequency}
                            </span>
                          </div>
                        </div>

                        {/* Card Action Controls: Deposit, Edit, Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlan(plan);
                              setDepositAmount(
                                plan.installmentAmountPoisha > 0
                                  ? (plan.installmentAmountPoisha / 100).toString()
                                  : '500'
                              );
                              setIsDepositOpen(true);
                              setIsCreateOpen(false);
                              setIsEditOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs"
                          >
                            + {i18n.language === 'bn' ? 'জমা' : 'Deposit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPlan(plan);
                              setEditTitle(plan.title);
                              setEditTarget((plan.targetAmountPoisha / 100).toString());
                              setEditInstallment(((plan.installmentAmountPoisha || 0) / 100).toString());
                              setIsEditOpen(true);
                              setIsCreateOpen(false);
                              setIsDepositOpen(false);
                            }}
                            title="Edit Goal"
                            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                          >
                            <IoPencilOutline className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(plan)}
                            title="Cancel / Delete"
                            className="p-1 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600"
                          >
                            <IoTrashOutline className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            plan.planType === 'dps' ? 'bg-amber-500' : 'bg-teal-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-teal-600 dark:text-teal-400 font-mono">
                          ৳{currentBdt.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                          <span>
                            {i18n.language === 'bn' ? 'বাকি: ' : 'Remaining: '}৳{remainingBdt.toLocaleString()}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <IoTrendingUpOutline className="w-3 h-3" />
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SavingsModal;
