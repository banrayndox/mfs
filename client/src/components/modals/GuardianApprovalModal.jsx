import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  IoCloseOutline,
  IoKeyOutline,
  IoAlertCircleOutline,
  IoCheckmarkOutline,
} from 'react-icons/io5';
import { GuardianColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';

/**
 * GuardianApprovalModal
 * 
 * Styled modal for Guardian PIN verification and transaction approval.
 * Never uses window.prompt or native dialogs.
 * PIN is handled securely in password mode, never logged or stored.
 */
export function GuardianApprovalModal({ isOpen, onClose, transaction, onSuccess, actionType = 'approve' }) {
  const { i18n } = useTranslation();
  const [pin, setPin] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef(null);

  // Lock background body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setPin('');
      setRejectReason('');
      setError('');
      setSuccess('');
      setIsSubmitting(false);
      // Auto-focus PIN field
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while in flight
    setPin('');
    setError('');
    setSuccess('');
    onClose();
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (isSubmitting || pin.length !== 4) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const txnId = transaction.id || transaction._id;
    const actionHash = `guardian-approve-${txnId}`;

    try {
      // Step 1: Step-up authentication using PIN and canonical actionHash
      const stepRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash,
      });

      const stepUpToken = stepRes.data?.stepUpToken;
      if (!stepUpToken) {
        throw new Error(
          i18n.language === 'bn'
            ? 'স্টেপ-আপ ভেরিফিকেশন ব্যর্থ হয়েছে।'
            : 'Step-up verification failed.'
        );
      }

      // Step 2: Guardian approval with token and actionHash headers
      const decideRes = await axios.post(
        `/api/guardians/approvals/${txnId}/decide`,
        { decision: 'approve' },
        {
          headers: {
            'x-step-up-token': stepUpToken,
            'x-action-hash': actionHash,
          },
        }
      );

      setSuccess(
        i18n.language === 'bn'
          ? 'লেনদেনটি সফলভাবে অনুমোদন করা হয়েছে!'
          : 'Transaction approved and settled successfully!'
      );
      setPin('');

      // Notify parent & close after brief celebration feedback
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(decideRes.data);
        }
        handleClose();
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Approval failed';
      let localizedMsg = msg;

      if (msg.includes('Invalid PIN') || msg.includes('incorrect') || err.response?.status === 401) {
        localizedMsg = i18n.language === 'bn' ? 'ভুল পিন দিয়েছেন (Invalid PIN)' : 'Invalid PIN entered. Please try again.';
      } else if (msg.includes('expired')) {
        localizedMsg = i18n.language === 'bn' ? 'ভেরিফিকেশন টোকেনের মেয়াদ শেষ হয়েছে।' : 'Step-up token expired. Please try again.';
      } else if (msg.includes('insufficient')) {
        localizedMsg = i18n.language === 'bn' ? 'প্রেরকের ওয়ালেটে অপর্যাপ্ত ব্যালেন্স।' : 'Sender wallet has insufficient balance.';
      }

      setError(localizedMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (isSubmitting || pin.length !== 4) {
      setError(
        i18n.language === 'bn'
          ? 'প্রত্যাখ্যানের জন্য ৪ সংখ্যার পিন দিন।'
          : 'Please enter 4-digit PIN to reject.'
      );
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const txnId = transaction.id || transaction._id;
    const actionHash = `guardian-reject-${txnId}`;

    try {
      const stepRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash,
      });

      const stepUpToken = stepRes.data?.stepUpToken;
      if (!stepUpToken) {
        throw new Error(
          i18n.language === 'bn'
            ? 'স্টেপ-আপ ভেরিফিকেশন ব্যর্থ হয়েছে।'
            : 'Step-up verification failed.'
        );
      }

      const decideRes = await axios.post(
        `/api/guardians/approvals/${txnId}/decide`,
        { decision: 'reject', reason: rejectReason },
        {
          headers: {
            'x-step-up-token': stepUpToken,
            'x-action-hash': actionHash,
          },
        }
      );

      setSuccess(
        i18n.language === 'bn'
          ? 'লেনদেনটি প্রত্যাখ্যান ও বাতিল করা হয়েছে।'
          : 'Transaction rejected successfully!'
      );
      setPin('');

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(decideRes.data);
        }
        handleClose();
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Rejection failed';
      let localizedMsg = msg;
      if (msg.includes('Invalid PIN') || err.response?.status === 401) {
        localizedMsg = i18n.language === 'bn' ? 'ভুল পিন দিয়েছেন (Invalid PIN)' : 'Invalid PIN entered.';
      }
      setError(localizedMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountDisplay = (
    transaction.amountPoisha !== undefined
      ? (transaction.amountPoisha / 100).toFixed(2)
      : transaction.amount !== undefined
      ? (transaction.amount / 100).toFixed(2)
      : '0.00'
  );

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none !m-0 !mt-0 animate-fade-in">
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <GuardianColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {actionType === 'reject'
                  ? (i18n.language === 'bn' ? 'লেনদেন প্রত্যাখ্যান' : 'Reject Transaction')
                  : (i18n.language === 'bn' ? 'লেনদেন অনুমোদন' : 'Approve Transaction')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {i18n.language === 'bn' ? 'অভিভাবক পিন ভেরিফিকেশন' : 'Guardian PIN Verification'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <IoCloseOutline className="w-6 h-6" />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {i18n.language === 'bn' ? 'লেনদেন বিবরণ' : 'Summary'}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              ৳{amountDisplay}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {i18n.language === 'bn' ? 'প্রেরক (সন্তান / ওয়ার্ড):' : 'Sender (Child):'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                {transaction.sender?.name || 'Child'} {transaction.sender?.phone ? `(${transaction.sender.phone})` : ''}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {i18n.language === 'bn' ? 'প্রাপক:' : 'Recipient:'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                {transaction.recipient?.name || transaction.recipient?.phone || 'Recipient'}
                {transaction.recipient?.name && transaction.recipient?.phone ? ` (${transaction.recipient.phone})` : ''}
              </span>
            </div>

            {transaction.reason && (
              <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                <span className="font-bold">⚠️ {i18n.language === 'bn' ? 'কারণ: ' : 'Reason: '}</span>
                <span>{transaction.reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-900 animate-shake">
            <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Feedback */}
        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900">
            <CheckmarkSuccessColorIcon className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleApprove} className="space-y-4">
          {actionType === 'reject' && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {i18n.language === 'bn' ? 'প্রত্যাখ্যানের কারণ (ঐচ্ছিক)' : 'Reason for Rejection (Optional)'}
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={i18n.language === 'bn' ? 'যেমন: অপ্রয়োজনীয় খরচ' : 'e.g. Unnecessary expense'}
                disabled={isSubmitting || !!success}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 text-center">
              {i18n.language === 'bn'
                ? 'অনুমোদন বা প্রত্যাখ্যানের জন্য পিন দিন'
                : 'Enter Guardian PIN to Approve / Reject'}
            </label>
            <div className="relative">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                autoComplete="one-time-code"
                name="guardian-pin"
                data-lpignore="true"
                disabled={isSubmitting || !!success}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-amber-500 transition-all disabled:opacity-50"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 pointer-events-none">
                <IoKeyOutline className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1">
              {i18n.language === 'bn' ? '৪ সংখ্যার গোপন পিন' : '4-digit secret PIN'}
            </p>
          </div>

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors disabled:opacity-50"
            >
              {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            {actionType === 'reject' ? (
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting || pin.length !== 4 || !!success}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-soft disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>{i18n.language === 'bn' ? 'প্রত্যাখ্যান হচ্ছে...' : 'Rejecting...'}</span>
                ) : (
                  <>
                    <IoCloseOutline className="w-4 h-4" />
                    <span>{i18n.language === 'bn' ? 'প্রত্যাখ্যান নিশ্চিত করুন' : 'Confirm Reject'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || pin.length !== 4 || !!success}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-soft disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>{i18n.language === 'bn' ? 'অনুমোদন হচ্ছে...' : 'Approving...'}</span>
                ) : (
                  <>
                    <IoCheckmarkOutline className="w-4 h-4" />
                    <span>{i18n.language === 'bn' ? 'অনুমোদন করুন' : 'Approve'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default GuardianApprovalModal;
