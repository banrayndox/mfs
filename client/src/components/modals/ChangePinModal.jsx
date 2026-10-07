import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IoCloseOutline, IoAlertCircleOutline } from 'react-icons/io5';
import { KeyPinColorIcon, CheckmarkSuccessColorIcon } from '../ui/FlaticonIcons.jsx';
import axios from 'axios';

export function ChangePinModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lock body scroll when modal is open to prevent underlying page scrollbar
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^\d{4}$/.test(currentPin)) {
      setError(i18n.language === 'bn' ? 'বর্তমান পিন ৪ ডিজিটের হতে হবে।' : 'Current PIN must be 4 digits.');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError(i18n.language === 'bn' ? 'নতুন পিন ৪ ডিজিটের হতে হবে।' : 'New PIN must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError(i18n.language === 'bn' ? 'নতুন পিন ও কনফার্ম পিন মেলেনি।' : 'New PIN and confirmation PIN do not match.');
      return;
    }
    if (currentPin === newPin) {
      setError(i18n.language === 'bn' ? 'নতুন পিন বর্তমান পিনের সমান হতে পারবে না।' : 'New PIN cannot be the same as current PIN.');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('guardian_token');
      const res = await axios.post(
        '/api/auth/change-pin',
        { currentPin, newPin, confirmPin },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setSuccess(
          i18n.language === 'bn'
            ? 'পিন সফলভাবে পরিবর্তন করা হয়েছে!'
            : 'PIN changed successfully!'
        );
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to change PIN';
      setError(
        i18n.language === 'bn' && msg.includes('incorrect')
          ? 'বর্তমান পিনটি সঠিক নয়।'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none !m-0 !mt-0">
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <KeyPinColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {i18n.language === 'bn' ? 'পিন পরিবর্তন' : 'Change PIN'}
              </h3>

              <p className="text-[11px] text-slate-400">
                {i18n.language === 'bn' ? 'নিরাপদ ৪-ডিজিট পিন আপডেট' : 'Secure 4-digit PIN update'}
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

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-900">
            <IoAlertCircleOutline className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900">
            <CheckmarkSuccessColorIcon className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {i18n.language === 'bn' ? 'বর্তমান পিন (Current PIN)' : 'Current PIN'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {i18n.language === 'bn' ? 'নতুন পিন (New PIN)' : 'New PIN'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {i18n.language === 'bn' ? 'নতুন পিন পুনরায় দিন (Confirm New PIN)' : 'Confirm New PIN'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
            >
              {i18n.language === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
              className="flex-1 py-2.5 rounded-2xl bg-brand-yellow hover:bg-brand-yellow/90 text-slate-900 font-bold text-xs transition-colors shadow-soft disabled:opacity-50"
            >
              {loading ? (i18n.language === 'bn' ? 'পরিবর্তন হচ্ছে...' : 'Updating...') : (i18n.language === 'bn' ? 'পরিবর্তন করুন' : 'Update PIN')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePinModal;
