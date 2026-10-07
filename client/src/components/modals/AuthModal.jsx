import React, { useState } from 'react';
import axios from 'axios';
import {
  IoCloseOutline,
  IoLockClosedOutline,
  IoCallOutline,
} from 'react-icons/io5';
import {
  ProfileColorIcon,
  StorefrontColorIcon,
  GuardianColorIcon,
  SwitchAccountColorIcon,
} from '../ui/FlaticonIcons.jsx';
import { useAuthStore } from '../../stores/authStore.js';

export function AuthModal({ isOpen, onClose }) {
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState('register'); // 'register' | 'login' | 'switch'
  const [accountType, setAccountType] = useState('CUSTOMER'); // 'CUSTOMER' | 'AGENT' | 'CHILD'

  // Form states
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('Dhaka');
  const [parentPhone, setParentPhone] = useState('');
  const [dailyLimit, setDailyLimit] = useState('500');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-flight validation
    const cleanPhone = phone.trim().replace(/^(\+88)/, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setError('সঠিক ১১-সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('পিন নম্বর অবশ্যই ৪ সংখ্যার হতে হবে (PIN must be exactly 4 digits)');
      return;
    }

    if (mode === 'register') {
      if (pin !== confirmPin) {
        setError('পিন এবং নিশ্চিতকরণ পিন মিলছে না (PIN and Confirm PIN do not match)');
        return;
      }

      if (!name.trim()) {
        setError('নাম প্রদান করা আবশ্যক (Name is required)');
        return;
      }

      if (accountType === 'CHILD') {
        const cleanParent = parentPhone.trim().replace(/^(\+88)/, '');
        if (!/^01[3-9]\d{8}$/.test(cleanParent)) {
          setError('অভিভাবকের সঠিক মোবাইল নম্বর প্রদান করুন (Valid parent phone is required)');
          return;
        }
        if (cleanParent === cleanPhone) {
          setError('সন্তান ও অভিভাবকের নম্বর একই হতে পারে না (Child and Parent phones cannot be the same)');
          return;
        }
      }
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const payload = {
          phone: cleanPhone,
          pin,
          name: name.trim(),
          accountType,
          agentProfile: accountType === 'AGENT' ? { businessName: businessName.trim() || `${name.trim()} Cash Point`, location: location.trim() } : undefined,
          parentPhone: accountType === 'CHILD' ? parentPhone.trim() : undefined,
          dailyLimitPoisha: accountType === 'CHILD' ? Number(dailyLimit) * 100 : undefined,
        };

        const res = await axios.post('/api/auth/register', payload);
        setUser({
          ...res.data.user,
          balancePoisha: res.data.walletBalancePoisha,
        });
        localStorage.setItem('guardian_token', res.data.tokens.accessToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.tokens.accessToken}`;
        onClose();
      } else {
        // Login or Switch
        const res = await axios.post('/api/auth/login', { phone: cleanPhone, pin });
        setUser({
          ...res.data.user,
          balancePoisha: res.data.walletBalancePoisha,
        });
        localStorage.setItem('guardian_token', res.data.tokens.accessToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.tokens.accessToken}`;
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full text-xs font-bold">
            <button
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                mode === 'register' ? 'bg-brand-yellow text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              নিবন্ধন (Register)
            </button>
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                mode === 'login' ? 'bg-brand-yellow text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              লগইন (Login)
            </button>
            <button
              onClick={() => {
                setMode('switch');
                setError('');
              }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                mode === 'switch' ? 'bg-brand-yellow text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              স্যুইচ (Switch)
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <IoCloseOutline className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Demo float banner */}
        <div className="bg-amber-50 dark:bg-slate-800/80 p-2.5 rounded-2xl border border-amber-200/60 dark:border-slate-700 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between">
          <span className="font-semibold">🎁 ডেমো ব্যালেন্স (Initial Float):</span>
          <span className="font-black font-mono">৳১০,০০০ (৳10,000 BDT)</span>
        </div>

        {mode === 'switch' && (
          <div className="bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-2xl border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <SwitchAccountColorIcon className="w-5 h-5 shrink-0" />
            <span>অন্য একটি নিবন্ধিত অ্যাকাউন্টের মোবাইল নম্বর এবং পিন দিয়ে লগইন করুন।</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              {/* Account Type Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  অ্যাকাউন্ট টাইপ (Account Type)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAccountType('CUSTOMER')}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'CUSTOMER'
                        ? 'bg-blue-50 dark:bg-blue-950 border-brand-blue text-brand-blue dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <ProfileColorIcon className="w-6 h-6 mb-0.5" />
                    <span>গ্রাহক</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('AGENT')}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'AGENT'
                        ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <StorefrontColorIcon className="w-6 h-6 mb-0.5" />
                    <span>এজেন্ট</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('CHILD')}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'CHILD'
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <GuardianColorIcon className="w-6 h-6 mb-0.5" />
                    <span>শিশু (Child)</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {accountType === 'AGENT'
                    ? 'এজেন্ট বা পরিচালকের নাম (Agent / Owner Name)'
                    : accountType === 'CHILD'
                    ? 'সন্তানের নাম (Child Full Name)'
                    : 'আপনার পুরো নাম (Full Name)'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rakib Hassan"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              {/* Agent Specific Fields */}
              {accountType === 'AGENT' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      ব্যবসা / দোকানের নাম (Business / Shop Name)
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Rahim Telecom & Cash Point"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      ঠিকানা বা এলাকা (Location / Address)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Mirpur, Dhaka"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </>
              )}

              {/* Child Specific Fields */}
              {accountType === 'CHILD' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      অভিভাবকের মোবাইল নম্বর (Registered Parent Phone)
                    </label>
                    <input
                      type="tel"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      * অভিভাবকের অ্যাকাউন্টটি পূর্বে নিবন্ধিত থাকতে হবে।
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      দৈনিক খরচের সীমা (Daily Spending Limit in BDT)
                    </label>
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      min="100"
                      max="5000"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Phone Number */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {mode === 'register' && accountType === 'CHILD'
                ? 'সন্তানের মোবাইল নম্বর (Child Phone Number)'
                : 'মোবাইল নম্বর (Mobile Number)'}
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                required
                className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <IoCallOutline className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* PIN */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              ৪-সংখ্যার পিন নম্বর (4-Digit PIN)
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue tracking-widest text-lg font-bold"
              />
              <IoLockClosedOutline className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Confirm PIN for Registration */}
          {mode === 'register' && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                পিন নিশ্চিত করুন (Confirm 4-Digit PIN)
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue tracking-widest text-lg font-bold"
                />
                <IoLockClosedOutline className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-brand-yellow text-slate-900 font-bold hover:bg-brand-yellow-hover disabled:opacity-50 transition-all shadow-sm mt-2"
          >
            {loading
              ? 'প্রসেসিং হচ্ছে...'
              : mode === 'register'
              ? 'নিবন্ধন সম্পন্ন করুন (Register)'
              : mode === 'switch'
              ? 'অন্য অ্যাকাউন্টে প্রবেশ করুন (Switch Account)'
              : 'লগইন করুন (Login)'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
