import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IoCloseOutline } from 'react-icons/io5';
import { PayBillColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function PayBillModal({ isOpen, onClose, onSuccess, initialBiller = 'DPDC', initialAmount = '' }) {
  const { user, setUser } = useAuthStore();
  const [billerId, setBillerId] = useState(initialBiller);
  const [accountNo, setAccountNo] = useState('1002345678');
  const [amount, setAmount] = useState(initialAmount || '1450');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (initialBiller) setBillerId(initialBiller);
    if (initialAmount) setAmount(initialAmount);
  }, [initialBiller, initialAmount, isOpen]);

  if (!isOpen) return null;

  const billers = [
    { id: 'DPDC', name: 'DPDC (বিদ্যুৎ)', type: 'Electricity' },
    { id: 'DESCO', name: 'DESCO (বিদ্যুৎ)', type: 'Electricity' },
    { id: 'TITAS', name: 'তিতাস গ্যাস (Gas)', type: 'Gas' },
    { id: 'WASA', name: 'ঢাকা ওয়াসা (Water)', type: 'Water' },
    { id: 'CARNIVAL', name: 'কার্নিভাল ইন্টারনেট (Net)', type: 'Internet' },
  ];

  const bdtAmount = parseFloat(amount) || 0;

  const handlePayBill = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const stepUpRes = await axios.post('/api/auth/step-up', {
        pin,
        actionHash: `bill-${bdtAmount * 100}`,
      });

      const token = stepUpRes.data.stepUpToken;

      const billRes = await axios.post(
        '/api/wallet/bill',
        {
          billerId,
          accountNo,
          amountPoisha: bdtAmount * 100,
          idempotencyKey: `ui-bill-${Date.now()}`,
        },
        {
          headers: {
            'x-step-up-token': token,
            'x-action-hash': `bill-${bdtAmount * 100}`,
          },
        }
      );

      setSuccessData(billRes.data.transaction);
      if (user) {
        setUser({ ...user, balancePoisha: user.balancePoisha - bdtAmount * 100 });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Bill payment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <PayBillColorIcon className="w-8 h-8 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">পে বিল (Pay Utility Bill)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {successData ? (
          <div className="text-center py-6 space-y-3">
            <CheckmarkSuccessColorIcon className="w-14 h-14 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">বিল পরিশোধ সম্পন্ন হয়েছে!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {billerId} - হিসাব নম্বর {accountNo}-এ ৳{bdtAmount.toFixed(2)} পরিশোধিত হয়েছে।
            </p>
            <div className="bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-slate-700">
              💡 এআই টিপ: বিল রসিদ সফলভাবে সংরক্ষণ করা হয়েছে। পরের মাসের জন্য স্বয়ংক্রিয় শিডিউল চালু রাখতে পারেন।
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
          <form onSubmit={handlePayBill} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                প্রতিষ্ঠান / বিলার (Select Biller)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {billers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBillerId(b.id)}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                      billerId === b.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p>{b.name}</p>
                    <span className="text-[10px] text-slate-400 block font-normal">{b.type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                গ্রাহক / হিসাব নম্বর (Account / Bill Number)
              </label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="Account number"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                বিলের পরিমাণ (Amount in BDT)
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

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পিন নম্বর (4-Digit PIN)
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-center tracking-widest text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !accountNo || !amount || pin.length !== 4}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : `৳${bdtAmount.toFixed(2)} পে বিল নিশ্চিত করুন`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default PayBillModal;
