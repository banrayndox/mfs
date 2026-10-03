import React, { useState } from 'react';
import axios from 'axios';
import { IoCloseOutline } from 'react-icons/io5';
import { RechargeColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function RechargeModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuthStore();
  const [phone, setPhone] = useState(user?.phone || '');
  const [operator, setOperator] = useState('Grameenphone');
  const [simType, setSimType] = useState('prepaid');
  const [amount, setAmount] = useState('50');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  if (!isOpen) return null;

  const operators = [
    { id: 'Grameenphone', name: 'গ্রামীনফোন (GP)', color: 'bg-blue-600 text-white' },
    { id: 'Banglalink', name: 'বাংলালিংক (BL)', color: 'bg-orange-500 text-white' },
    { id: 'Robi', name: 'রবি (Robi)', color: 'bg-red-600 text-white' },
    { id: 'Airtel', name: 'এয়ারটেল (Airtel)', color: 'bg-rose-500 text-white' },
    { id: 'Teletalk', name: 'টেলিটক (Teletalk)', color: 'bg-emerald-600 text-white' },
  ];

  const quickAmounts = [20, 50, 100, 200, 500];
  const bdtAmount = parseFloat(amount) || 0;

  const handleRecharge = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash: `recharge-${bdtAmount * 100}`,
      });

      const token = stepUpRes.data.stepUpToken;

      const rechargeRes = await axios.post(
        '/api/wallet/recharge',
        {
          phone,
          operator,
          amountPoisha: bdtAmount * 100,
          idempotencyKey: `ui-recharge-${Date.now()}`,
        },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': `recharge-${bdtAmount * 100}`,
          },
        }
      );

      setSuccessData(rechargeRes.data.transaction);
      if (user) {
        setUser({ ...user, balancePoisha: user.balancePoisha - bdtAmount * 100 });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Recharge failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <RechargeColorIcon className="w-8 h-8 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">মোবাইল রিচার্জ (Mobile Recharge)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {successData ? (
          <div className="text-center py-6 space-y-3">
            <CheckmarkSuccessColorIcon className="w-14 h-14 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">রিচার্জ সফল হয়েছে!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {phone} নম্বরে ৳{bdtAmount.toFixed(2)} ({operator}) সফলভাবে রিচার্জ হয়েছে।
            </p>
            <div className="bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-slate-700">
              💡 এআই টিপ: আপনি চাইলে এই নম্বরের জন্য অটো-রিচার্জ বা নিয়মিত রিমাইন্ডার সেট করে রাখতে পারেন।
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
          <form onSubmit={handleRecharge} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                মোবাইল নম্বর (Phone Number)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                অপারেটর (Select Operator)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {operators.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperator(op.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      operator === op.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পরিমাণ (Amount in BDT)
              </label>
              <div className="flex gap-1.5 mb-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(q.toString())}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${
                      amount === q.toString()
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ৳{q}
                  </button>
                ))}
              </div>
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

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পিন নম্বর (4-Digit PIN)
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                name="recharge-pin"
                id="recharge-txn-pin"
                data-lpignore="true"
                data-1p-ignore="true"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-center tracking-widest text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phone || !amount || pin.length !== 4}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : `৳${bdtAmount.toFixed(2)} রিচার্জ করুন`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default RechargeModal;
