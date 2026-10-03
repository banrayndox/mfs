import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  IoCloseOutline,
  IoPersonAddOutline,
  IoCheckmarkOutline,
  IoCloseCircleOutline,
  IoTrashOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { GuardianColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { GuardianApprovalModal } from './GuardianApprovalModal.jsx';

export function GuardianModal({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedTxnForApproval, setSelectedTxnForApproval] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childPhone, setChildPhone] = useState('');
  const [dailyLimit, setDailyLimit] = useState('500');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadData = async () => {
    try {
      const [statusRes, pendingRes] = await Promise.all([
        axios.get('/api/guardians/status'),
        axios.get('/api/guardians/pending-approvals'),
      ]);
      setStatus(statusRes.data);
      setPendingApprovals(pendingRes.data?.pendingApprovals || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMsg('');
      setErr('');
      loadData();
    }
  }, [isOpen]);

  // Realtime Socket.IO guardian request and decision updates
  useEffect(() => {
    const handleGuardianEvents = () => {
      loadData();
    };

    window.addEventListener('mfs:guardian:request', handleGuardianEvents);
    window.addEventListener('mfs:guardian:decided', handleGuardianEvents);

    return () => {
      window.removeEventListener('mfs:guardian:request', handleGuardianEvents);
      window.removeEventListener('mfs:guardian:decided', handleGuardianEvents);
    };
  }, []);

  if (!isOpen) return null;

  const handleCreateChild = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      await axios.post('/api/guardians/child', {
        name: childName.trim(),
        phone: childPhone.trim(),
        dob: '2012-05-15',
        birthCertificateNumber: '20121234567890123',
        pin: '1234',
        dailyLimitPoisha: Number(dailyLimit) * 100,
      });

      setMsg(`শিশু অ্যাকাউন্ট (${childName}) সফলভাবে যুক্ত হয়েছে!`);
      setShowAddChild(false);
      setChildName('');
      setChildPhone('');
      await loadData();
    } catch (error) {
      setErr(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMode = async (childUserId, mode, newLimitPoisha) => {
    setActionLoading(true);
    setErr('');
    setMsg('');
    try {
      await axios.put(`/api/guardians/children/${childUserId}/mode`, {
        controlMode: mode,
        dailyLimitPoisha: newLimitPoisha !== undefined ? newLimitPoisha : undefined,
      });
      setMsg(
        mode === 'APPROVAL_REQUIRED'
          ? 'মোড আপডেট: অনুমোদন আবশ্যক সক্রিয়।'
          : mode === 'LIMITED'
          ? 'মোড আপডেট: দৈনিক খরচের সীমা কার্যকর।'
          : 'মোড আপডেট: শুধুমাত্র নোটিফিকেশন আপডেট সক্রিয়।'
      );
      await loadData();
    } catch (error) {
      setErr(error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveChild = async (childUserId, childName) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${childName || 'এই সন্তান'}"-কে অভিভাবকত্ব থেকে অপসারণ করতে চান? সন্তান অ্যাকাউন্ট সংরক্ষিত থাকবে।`)) {
      return;
    }

    setActionLoading(true);
    setErr('');
    setMsg('');
    try {
      await axios.post(`/api/guardians/children/${childUserId}/remove`);
      setMsg(`সন্তানের অভিভাবকত্ব সফলভাবে প্রত্যাহার করা হয়েছে।`);
      await loadData();
    } catch (error) {
      setErr(error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectApproval = async (txnId) => {
    setActionLoading(true);
    setErr('');
    setMsg('');
    try {
      await axios.post(
        `/api/guardians/approvals/${txnId}/decide`,
        { decision: 'reject' }
      );
      setMsg('লেনদেনটি বাতিল করা হয়েছে।');
      await loadData();
    } catch (error) {
      setErr(error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-modal p-5 border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <GuardianColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">অভিভাবক মোড (Guardian Mode)</h3>
              <p className="text-[11px] text-slate-400">সন্তান ও পরিবারের সদস্যদের আর্থিক সুরক্ষা নিয়ন্ত্রণ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IoCloseOutline className="w-6 h-6" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {msg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900 shrink-0">
            <CheckmarkSuccessColorIcon className="w-5 h-5 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {err && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-900 shrink-0">
            <IoCloseCircleOutline className="w-5 h-5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Policy Overview banner */}
          <div className="bg-amber-50/70 dark:bg-slate-800/80 p-3 rounded-2xl border border-amber-200/60 dark:border-slate-700 space-y-1 text-xs text-amber-950 dark:text-amber-300">
            <p className="font-bold flex items-center gap-1.5">
              <span>🛡️ ৩টি নিয়ন্ত্রণ মোড (3 Control Modes)</span>
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              <strong>১. অনুমোদন আবশ্যক:</strong> সন্তানের সকল লেনদেন অভিভাবকের সম্মতির অপেক্ষায় থাকবে।<br />
              <strong>২. খরচের সীমা:</strong> নির্ধারিত দৈনিক সীমা অতিক্রম করলে লেনদেন ব্লক হবে।<br />
              <strong>৩. শুধু আপডেট:</strong> লেনদেন সরাসরি সম্পন্ন হবে এবং আপনি তাৎক্ষণিক নোটিফিকেশন পাবেন।
            </p>
          </div>

          {/* Pending Approvals Section */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-2.5 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  অনুমোদনের অপেক্ষায় লেনদেন ({pendingApprovals.length})
                </span>
              </div>

              <div className="space-y-2">
                {pendingApprovals.map((appr) => (
                  <div
                    key={appr.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 shadow-xs space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {appr.sender?.name} ({appr.sender?.phone})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          প্রাপক: {appr.recipient?.name || appr.recipient?.phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono block">
                          ৳{(appr.amountPoisha / 100).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(appr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-slate-900/60 p-2 rounded-lg leading-tight border border-amber-100 dark:border-slate-800">
                      ⚠️ {appr.reason}
                    </p>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRejectApproval(appr.id)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 transition-all"
                      >
                        বাতিল (Reject)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTxnForApproval(appr)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                      >
                        <IoCheckmarkOutline className="w-3.5 h-3.5" /> অনুমোদন (Approve)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Child Form or List */}
          {showAddChild ? (
            <form onSubmit={handleCreateChild} className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">নতুন চাইল্ড অ্যাকাউন্ট তৈরি করুন</h4>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">সন্তানের নাম (Name)</label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="যেমন: আবির হাসান"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">মোবাইল নম্বর (Phone)</label>
                <input
                  type="tel"
                  value={childPhone}
                  onChange={(e) => setChildPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">দৈনিক খরচের সীমা (টাকা)</label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min="50"
                  max="10000"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-brand-yellow text-xs font-bold text-slate-900 hover:bg-brand-yellow/90"
                >
                  {loading ? 'যুক্ত হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold uppercase text-slate-400">সংযুক্ত সন্তান প্রোফাইল</span>
                <button
                  onClick={() => setShowAddChild(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-blue text-white hover:bg-brand-blue/90 flex items-center gap-1 shadow-soft"
                >
                  <IoPersonAddOutline className="w-3.5 h-3.5" /> + চাইল্ড যুক্ত করুন
                </button>
              </div>

              {!status?.children || status.children.length === 0 ? (
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 text-center border border-slate-200 dark:border-slate-700">
                  এখনও কোনো সন্তান যুক্ত নেই। ওপরের বাটন চেপে যুক্ত করতে পারেন।
                </div>
              ) : (
                <div className="space-y-3">
                  {status.children.map((child) => {
                    const childData = child.childUserId || {};
                    const childUserId = childData._id || child.childUserId;
                    const currentMode = child.controlMode || 'APPROVAL_REQUIRED';
                    const currentLimit = child.dailyLimitPoisha ? child.dailyLimitPoisha / 100 : 500;

                    return (
                      <div
                        key={child._id}
                        className="p-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-3 shadow-soft"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {childData.name || 'সন্তান (Child)'}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">
                              নম্বর: {childData.phone || 'N/A'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveChild(childUserId, childData.name)}
                            disabled={actionLoading}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="সন্তান সরান (Remove Child)"
                          >
                            <IoTrashOutline className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 3 Control Modes Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                            নিয়ন্ত্রণ মোড (Control Mode):
                          </label>
                          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateMode(childUserId, 'APPROVAL_REQUIRED')}
                              disabled={actionLoading}
                              className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center leading-tight ${
                                currentMode === 'APPROVAL_REQUIRED'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-2 border-amber-400'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              অনুমোদন আবশ্যক
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMode(childUserId, 'LIMITED')}
                              disabled={actionLoading}
                              className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center leading-tight ${
                                currentMode === 'LIMITED'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border-2 border-blue-400'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              দৈনিক সীমা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMode(childUserId, 'UPDATES_ONLY')}
                              disabled={actionLoading}
                              className={`py-1.5 px-1 rounded-xl font-bold transition-all text-center leading-tight ${
                                currentMode === 'UPDATES_ONLY'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-2 border-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              শুধু আপডেট
                            </button>
                          </div>
                        </div>

                        {/* Daily Limit display / adjust if LIMITED */}
                        {currentMode === 'LIMITED' && (
                          <div className="p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">
                              দৈনিক খরচের সীমা:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-blue-700 dark:text-blue-300">
                                ৳{currentLimit}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newLim = prompt('নতুন দৈনিক সীমা লিখুন (টাকায়):', currentLimit.toString());
                                  if (newLim && !isNaN(Number(newLim))) {
                                    handleUpdateMode(childUserId, 'LIMITED', Number(newLim) * 100);
                                  }
                                }}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                              >
                                পরিবর্তন
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Styled Guardian Approval Modal */}
      <GuardianApprovalModal
        isOpen={!!selectedTxnForApproval}
        transaction={selectedTxnForApproval}
        onClose={() => setSelectedTxnForApproval(null)}
        onSuccess={() => {
          setSelectedTxnForApproval(null);
          setMsg('লেনদেনটি সফলভাবে অনুমোদন করা হয়েছে!');
          loadData();
        }}
      />
    </div>
  );
}

export default GuardianModal;
