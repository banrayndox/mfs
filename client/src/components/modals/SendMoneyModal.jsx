import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  IoCloseOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
} from 'react-icons/io5';
import { SendMoneyColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function SendMoneyModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuthStore();
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setRecipientPhone('');
      setRecipientName('');
      setRecipientChecking(false);
      setRecipientError('');
      setAmount('');
      setPin('');
      setError('');
      setSuccessData(null);
    }
  }, [isOpen]);

  // Real-time recipient lookup when 11 digits entered
  useEffect(() => {
    const clean = recipientPhone.trim().replace(/^(\+88)/, '');
    if (clean.length === 11) {
      if (user && clean === user.phone) {
        setRecipientError('নিজের নম্বরে টাকা পাঠানো সম্ভব নয় (Cannot send to own number)');
        setRecipientName('');
        return;
      }
      setRecipientChecking(true);
      setRecipientError('');
      axios
        .get(`/api/wallet/lookup-recipient/${clean}`)
        .then((res) => {
          setRecipientName(res.data.recipient.name);
          setRecipientError('');
        })
        .catch((err) => {
          setRecipientName('');
          setRecipientError(err.response?.data?.message || 'Invalid account / Account not found');
        })
        .finally(() => {
          setRecipientChecking(false);
        });
    } else {
      setRecipientName('');
      setRecipientError('');
    }
  }, [recipientPhone, user]);

  if (!isOpen) return null;

  const bdtAmount = parseFloat(amount) || 0;
  const fee = bdtAmount > 1000 ? 5 : 0;
  const total = bdtAmount + fee;

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');

    const cleanRecipient = recipientPhone.trim().replace(/^(\+88)/, '');
    if (!recipientName && !recipientError) {
      // Re-verify recipient before step-up
      try {
        const verifyRes = await axios.get(`/api/wallet/lookup-recipient/${cleanRecipient}`);
        setRecipientName(verifyRes.data.recipient.name);
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid account / Account not found');
        return;
      }
    }

    if (recipientError) {
      setError(recipientError);
      return;
    }

    setLoading(true);

    try {
      // 1. Get Step-Up Token (T2)
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash: `send-${Math.round(bdtAmount * 100)}`,
      });

      const token = stepUpRes.data.stepUpToken;

      // 2. Execute Send Money
      const sendRes = await axios.post(
        '/api/wallet/send',
        {
          recipientPhone: cleanRecipient,
          amountPoisha: Math.round(bdtAmount * 100),
          idempotencyKey: `ui-send-${Date.now()}`,
        },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': `send-${Math.round(bdtAmount * 100)}`,
          },
        }
      );

      setSuccessData(sendRes.data.transaction);
      // Update local wallet balance
      if (user) {
        setUser({ ...user, balancePoisha: user.balancePoisha - Math.round(total * 100) });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <SendMoneyColorIcon className="w-8 h-8 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">সেন্ড মানি (Send Money)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {successData ? (
          <div className="text-center py-6 space-y-3">
            <CheckmarkSuccessColorIcon className="w-14 h-14 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">টাকা পাঠানো সফল হয়েছে!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ৳{bdtAmount.toFixed(2)} সফলভাবে {recipientName ? `${recipientName} (${recipientPhone})` : recipientPhone}-এ স্থানান্তরিত হয়েছে।
            </p>
            <div className="bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-slate-700">
              💡 এআই অডিট: সিমুলেটেড লেজার এন্ট্রি সফল। আইডি: {successData._id?.slice(-8) || 'TXN-OK'}
            </div>
            <button
              onClick={() => {
                setSuccessData(null);
                onClose();
              }}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover"
            >
              সম্পন্ন (Done)
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900 flex items-center gap-1.5">
                <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                প্রাপকের মোবাইল নম্বর (Recipient Number)
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                required
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border text-sm font-mono focus:outline-none focus:ring-2 ${
                  recipientError
                    ? 'border-rose-400 focus:ring-rose-400'
                    : recipientName
                    ? 'border-emerald-400 focus:ring-emerald-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-brand-blue'
                }`}
              />

              {/* Recipient Status / Verification */}
              {recipientChecking && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  অ্যাকাউন্ট যাচাই করা হচ্ছে...
                </p>
              )}
              {recipientName && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold flex items-center gap-1">
                  <IoCheckmarkCircle className="w-3.5 h-3.5" />
                  প্রাপক: {recipientName} (যাচাইকৃত গ্রাহক)
                </p>
              )}
              {recipientError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold flex items-center gap-1">
                  <IoAlertCircleOutline className="w-3.5 h-3.5" />
                  {recipientError}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পরিমাণ (Amount in BDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-bold"
              />
            </div>

            {/* Fee summary */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>সার্ভিস চার্জ (Fee):</span>
                <span>৳{fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1">
                <span>সর্বমোট কর্তন (Total):</span>
                <span>৳{total.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পিন নম্বর (4-Digit PIN)
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                disabled={!!recipientError}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-center tracking-widest text-lg disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !recipientPhone || !amount || pin.length !== 4 || !!recipientError}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : `৳${total.toFixed(2)} পাঠান (Send)`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SendMoneyModal;
