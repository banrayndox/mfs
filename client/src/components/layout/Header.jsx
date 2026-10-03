import React from 'react';
import { useTranslation } from 'react-i18next';
import { IoNotificationsOutline, IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { BrandMark } from '../ui/BrandMark.jsx';
import { useAuthStore } from '../../stores/authStore.js';
import { useThemeStore } from '../../stores/themeStore.js';
import { useSystemStore } from '../../stores/systemStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function Header({ onOpenNotifications, onOpenAuth, onOpenAgentDashboard, onLogout }) {
  const { t, i18n } = useTranslation();
  const { user, balanceVisible, revealBalance, hideBalance, isBalanceLoading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isMockAi, unreadNotifications } = useSystemStore();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'bn' ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('guardian_lang', nextLang);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-brand-yellow dark:bg-slate-900 border-b border-yellow-400 dark:border-slate-800 text-slate-900 dark:text-white pt-4 pb-5 px-4 rounded-b-3xl shadow-soft transition-colors duration-200">
      {/* Top Bar: Brand, Language Toggle, Theme Toggle, Notifications */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <BrandMark size="sm" showWordmark={true} />

        <div className="flex items-center gap-1.5">
          {/* AI badge commented out per requirement */}
          {/*
          {isMockAi ? (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
              title="Groq API key not provided. Running in deterministic mock AI mode."
            >
              {t('header.mockMode')}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              {t('header.liveMode')}
            </span>
          )}
          */}

          {/* Language Toggle (Bangla / English) */}
          <button
            onClick={toggleLanguage}
            className="px-2.5 py-1 text-xs font-bold rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label={`Change language to ${i18n.language === 'bn' ? 'English' : 'Bangla'}`}
          >
            {i18n.language === 'bn' ? 'EN' : 'বাং'}
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Toggle light and dark mode"
          >
            {theme === 'dark' ? (
              <IoSunnyOutline className="w-4 h-4 text-brand-yellow" />
            ) : (
              <IoMoonOutline className="w-4 h-4 text-slate-800" />
            )}
          </button>

          {/* Notification Bell with Badge */}
          <button
            onClick={onOpenNotifications}
            className="p-2 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors relative flex items-center justify-center"
            aria-label={t('header.notifications')}
          >
            <IoNotificationsOutline className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 border-2 border-brand-yellow dark:border-slate-900 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* User Info & Balance Bar */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/10">
        <div>
          {user ? (
            <>
              {/* Guardian info removed from Header, now displayed only in Account page */}
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {user.name}
                </h1>
                {user.accountType === 'AGENT' ? (
                  <button
                    onClick={onOpenAgentDashboard}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs"
                  >
                    এজেন্ট পোর্টাল
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-slate-800 dark:text-slate-300">
                    {user.accountType === 'CHILD' ? 'শিশু (Child)' : 'গ্রাহক'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-700 dark:text-slate-400 font-mono">
                  {user.phone}
                </p>
              </div>
            </>
          ) : (
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                অতিথি (Guest)
              </h1>
              <button
                onClick={onOpenAuth}
                className="text-xs text-blue-700 dark:text-yellow-400 font-bold hover:underline"
              >
                লগইন / নতুন অ্যাকাউন্ট নিবন্ধন করুন
              </button>
            </div>
          )}
        </div>

        {/* Balance Blue Pill Button */}
        <div>
          {user ? (
            balanceVisible ? (
              <button
                onClick={hideBalance}
                className="px-4 py-1.5 rounded-full bg-brand-blue text-white text-sm font-bold shadow hover:bg-brand-blue-hover transition-all flex items-center gap-1.5"
              >
                {isBalanceLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin shrink-0"></span>
                ) : null}
                <span>{formatCurrency(user.balancePoisha, i18n.language)}</span>
              </button>
            ) : (
              <button
                onClick={revealBalance}
                className="px-4 py-1.5 rounded-full bg-brand-blue text-white text-xs font-semibold shadow hover:bg-brand-blue-hover transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse"></span>
                <span>{t('header.tapForBalance')}</span>
              </button>
            )
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-full bg-brand-blue text-white text-xs font-bold shadow hover:bg-brand-blue-hover transition-all"
            >
              লগইন করুন
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
