import React, { useState } from 'react';
import axios from 'axios';
import { IoCloseOutline } from 'react-icons/io5';
import { AddMoneyColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function AddMoneyModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuthStore();
  const [sourceType, setSourceType] = useState('bank'); // 'bank' | 'card'
  const [bankName, setBankName] = useState('Sonali Bank Demo');
  const [accountNo, setAccountNo] = useState('02010023456');
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  if (!isOpen) return null;

  const banks = [
    { id: 'Sonali Bank Demo', name: 'সোনালী ব্যাংক (Sonali Bank)' },
    { id: 'BRAC Bank Demo', name: 'ব্র্যাক ব্যাংক (BRAC Bank)' },
    { id: 'City Bank Demo', name: 'সিটি ব্যাংক (City Bank)' },
    { id: 'Eastern Bank Demo', name: 'ইস্টার্ন ব্যাংক (EBL)' },
    { id: 'Visa Card Demo', name: 'ভিসা কার্ড (Visa Card)' },
    { id: 'Mastercard Demo', name: 'মাস্টারকার্ড (Mastercard)' },
  ];

  const quickAmounts = [500, 1000, 2000, 5000, 10000];
  const bdtAmount = parseFloat(amount) || 0;

  const handleAddMoney = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/wallet/addmoney', {
        bankName,
        accountNo,
        amountPoisha: bdtAmount * 100,
        idempotencyKey: `ui-addmoney-${Date.now()}`,
      });

      setSuccessData(res.data.transaction);
      if (user) {
        setUser({ ...user, balancePoisha: (user.balancePoisha || 0) + bdtAmount * 100 });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Add money failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <AddMoneyColorIcon className="w-8 h-8 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">অ্যাড মানি (Add Money)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {successData ? (
          <div className="text-center py-6 space-y-3">
            <CheckmarkSuccessColorIcon className="w-14 h-14 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">টাকা যোগ সফল হয়েছে!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {bankName} থেকে আপনার ওয়ালেটে ৳{bdtAmount.toFixed(2)} সফলভাবে যোগ হয়েছে।
            </p>
            <div className="bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-slate-700">
              💡 এআই টিপ: ওয়ালেটে টাকা যুক্ত হওয়ায় আপনার শর্তযুক্ত রুলস (Rules) পরীক্ষা করা হয়েছে।
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
          <form onSubmit={handleAddMoney} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                উৎস নির্বাচন করুন (Bank / Card)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {banks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBankName(b.id)}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                      bankName === b.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="truncate">{b.name}</p>
                    <span className="text-[10px] text-slate-400 block font-normal">সিমুলেটেড উৎস</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                অ্যাকাউন্ট / কার্ড নম্বর (Account / Card Number)
              </label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="Account / Card Number"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                টাকার পরিমাণ (Amount in BDT)
              </label>
              <div className="flex gap-1.5 mb-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(q.toString())}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${
                      amount === q.toString()
                        ? 'bg-purple-600 text-white border-purple-600'
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
                min="50"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : `৳${bdtAmount.toFixed(2)} অ্যাড মানি নিশ্চিত করুন`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddMoneyModal;
