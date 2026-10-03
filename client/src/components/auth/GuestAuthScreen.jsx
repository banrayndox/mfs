import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  IoLockClosedOutline,
  IoCallOutline,
  IoEyeOutline,
  IoEyeOffOutline,
} from 'react-icons/io5';
import {
  ProfileColorIcon,
  StorefrontColorIcon,
  GuardianColorIcon,
  LanguageColorIcon,
  ThemeColorIcon,
} from '../ui/FlaticonIcons.jsx';
import { BrandMark } from '../ui/BrandMark.jsx';
import { useThemeStore } from '../../stores/themeStore.js';
import { useAuthStore } from '../../stores/authStore.js';

export function GuestAuthScreen({ onLoginSuccess }) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { setUser } = useAuthStore();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [accountType, setAccountType] = useState('CUSTOMER'); // 'CUSTOMER' | 'AGENT' | 'CHILD'

  // Form states
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('Dhaka');
  const [parentPhone, setParentPhone] = useState('');
  const [dailyLimit, setDailyLimit] = useState('500');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'bn' ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('guardian_lang', nextLang);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim().replace(/^(\+88)/, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setError(
        i18n.language === 'bn'
          ? 'সঠিক ১১-সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)'
          : 'Please enter a valid 11-digit Bangladeshi mobile number (e.g. 01712345678)'
      );
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(
        i18n.language === 'bn'
          ? 'পিন নম্বর অবশ্যই ৪ সংখ্যার হতে হবে'
          : 'PIN must be exactly 4 digits'
      );
      return;
    }

    if (mode === 'register') {
      if (pin !== confirmPin) {
        setError(
          i18n.language === 'bn'
            ? 'পিন এবং নিশ্চিতকরণ পিন মিলছে না'
            : 'PIN and Confirm PIN do not match'
        );
        return;
      }

      if (!name.trim()) {
        setError(
          i18n.language === 'bn'
            ? 'নাম প্রদান করা আবশ্যক'
            : 'Full name is required'
        );
        return;
      }

      if (accountType === 'CHILD') {
        const cleanParent = parentPhone.trim().replace(/^(\+88)/, '');
        if (!/^01[3-9]\d{8}$/.test(cleanParent)) {
          setError(
            i18n.language === 'bn'
              ? 'অভিভাবকের সঠিক মোবাইল নম্বর প্রদান করুন'
              : 'Valid parent mobile number is required'
          );
          return;
        }
        if (cleanParent === cleanPhone) {
          setError(
            i18n.language === 'bn'
              ? 'সন্তান ও অভিভাবকের নম্বর একই হতে পারে না'
              : 'Child and parent phone cannot be identical'
          );
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
          agentProfile:
            accountType === 'AGENT'
              ? {
                  businessName: businessName.trim() || `${name.trim()} Cash Point`,
                  location: location.trim(),
                }
              : undefined,
          parentPhone: accountType === 'CHILD' ? parentPhone.trim() : undefined,
          dailyLimitPoisha: accountType === 'CHILD' ? Number(dailyLimit) * 100 : undefined,
        };

        const res = await axios.post('/api/auth/register', payload);
        const token = res.data.tokens?.accessToken;
        if (token) {
          localStorage.setItem('guardian_token', token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setUser({
          ...res.data.user,
          balancePoisha: res.data.walletBalancePoisha || 1000000,
        });
        if (onLoginSuccess) await onLoginSuccess();
      } else {
        // Login
        const res = await axios.post('/api/auth/login', { phone: cleanPhone, pin });
        const token = res.data.tokens?.accessToken;
        if (token) {
          localStorage.setItem('guardian_token', token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setUser({
          ...res.data.user,
          balancePoisha: res.data.wallet?.balancePoisha,
        });
        if (onLoginSuccess) await onLoginSuccess();
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(
        err.response?.data?.message ||
          (i18n.language === 'bn' ? 'অনুরোধ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Request failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-6 max-w-md mx-auto w-full select-none">
      {/* Top utility row: Language & Theme toggles */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={toggleLanguage}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          aria-label="Toggle Language"
        >
          <LanguageColorIcon className="w-4 h-4" />
          <span>{i18n.language === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>

        <button
          onClick={toggleTheme}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          aria-label="Toggle Theme"
        >
          <ThemeColorIcon className="w-4 h-4" />
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Brand & Welcome Hero */}
      <div className="flex flex-col items-center text-center my-6 space-y-3">
        <BrandMark size="lg" showWordmark={true} />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-xs">
          {i18n.language === 'bn'
            ? 'নিরাপদ এআই-চালিত মোবাইল আর্থিক সেবা'
            : 'Safe AI-Powered Mobile Financial Services for Bangladesh'}
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-card border border-slate-100 dark:border-slate-800">
        {/* Login / Register Tab switcher */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {i18n.language === 'bn' ? 'লগইন' : 'Login'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-soft'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {i18n.language === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Register'}
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Registration: Role selector */}
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {i18n.language === 'bn' ? 'অ্যাকাউন্টের ধরন' : 'Account Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('CUSTOMER')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    accountType === 'CUSTOMER'
                      ? 'border-brand-blue dark:border-brand-yellow bg-brand-blue/5 dark:bg-brand-yellow/10 text-brand-blue dark:text-brand-yellow'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ProfileColorIcon className="w-6 h-6 mb-1" />
                  {i18n.language === 'bn' ? 'গ্রাহক' : 'Customer'}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('AGENT')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    accountType === 'AGENT'
                      ? 'border-brand-blue dark:border-brand-yellow bg-brand-blue/5 dark:bg-brand-yellow/10 text-brand-blue dark:text-brand-yellow'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <StorefrontColorIcon className="w-6 h-6 mb-1" />
                  {i18n.language === 'bn' ? 'এজেন্ট' : 'Agent'}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('CHILD')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    accountType === 'CHILD'
                      ? 'border-brand-blue dark:border-brand-yellow bg-brand-blue/5 dark:bg-brand-yellow/10 text-brand-blue dark:text-brand-yellow'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <GuardianColorIcon className="w-6 h-6 mb-1" />
                  {i18n.language === 'bn' ? 'সন্তান' : 'Child'}
                </button>
              </div>
            </div>
          )}

          {/* Registration: Name field */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                {i18n.language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={i18n.language === 'bn' ? 'যেমন: মোহাম্মদ তামিম' : 'e.g. Mohammad Tamim'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
              />
            </div>
          )}

          {/* Phone field */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              {i18n.language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-400 text-sm font-semibold">
                +88
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
              />
              <IoCallOutline className="absolute right-3.5 top-3.5 text-slate-400 w-5 h-5" />
            </div>
          </div>

          {/* Agent-specific fields */}
          {mode === 'register' && accountType === 'AGENT' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {i18n.language === 'bn' ? 'দোকান / ব্যবসার নাম' : 'Business / Outlet Name'}
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={i18n.language === 'bn' ? 'যেমন: ভাই ভাই টেলিকম' : 'e.g. Bhai Bhai Telecom'}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {i18n.language === 'bn' ? 'এলাকা / লোকেশন' : 'Area / Location'}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Dhaka, Bangladesh"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
                />
              </div>
            </>
          )}

          {/* Child-specific fields */}
          {mode === 'register' && accountType === 'CHILD' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {i18n.language === 'bn' ? 'অভিভাবকের মোবাইল নম্বর' : 'Parent Mobile Number'}
                </label>
                <input
                  type="tel"
                  required
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {i18n.language === 'bn' ? 'দৈনিক খরচের সীমা (টাকা)' : 'Daily Spending Limit (BDT)'}
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-brand-blue"
                />
              </div>
            </>
          )}

          {/* PIN field */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              {i18n.language === 'bn' ? '৪ সংখ্যার পিন' : '4-Digit PIN'}
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                inputMode="numeric"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono tracking-widest focus:outline-none focus:border-brand-blue"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
              >
                {showPin ? <IoEyeOffOutline className="w-5 h-5" /> : <IoEyeOutline className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm PIN field (for Register) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                {i18n.language === 'bn' ? 'পিন নিশ্চিত করুন' : 'Confirm PIN'}
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                inputMode="numeric"
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono tracking-widest focus:outline-none focus:border-brand-blue"
              />
            </div>
          )}

          {/* Bonus Badge (Registration) */}
          {mode === 'register' && (
            <div className="p-3 bg-brand-yellow/15 border border-brand-yellow/30 rounded-2xl flex items-center gap-2.5">
              <span className="text-xl">🎁</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {i18n.language === 'bn'
                  ? 'নতুন অ্যাকাউন্টে তাৎক্ষণিক ৳১০,০০০ ডেমো ব্যালেন্স পাবেন!'
                  : 'Get instant ৳10,000 demo balance upon registration!'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-blue font-bold rounded-2xl shadow-soft hover:shadow-hover transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
          >
            <IoLockClosedOutline className="w-5 h-5" />
            <span>
              {loading
                ? i18n.language === 'bn'
                  ? 'প্রক্রিয়াধীন...'
                  : 'Processing...'
                : mode === 'register'
                ? i18n.language === 'bn'
                  ? 'অ্যাকাউন্ট তৈরি করুন'
                  : 'Create Account'
                : i18n.language === 'bn'
                ? 'লগইন করুন'
                : 'Login'}
            </span>
          </button>
        </form>
      </div>

      {/* Footer disclaimers */}
      <div className="text-center py-4 text-[11px] text-slate-400 dark:text-slate-500">
        <p>
          {i18n.language === 'bn'
            ? 'হ্যাকাতন প্রোটোটাইপ • সকল টাকা ও ডেটা সিমুলেটেড'
            : 'Hackathon Prototype • All money and data are simulated'}
        </p>
      </div>
    </div>
  );
}

export default GuestAuthScreen;
