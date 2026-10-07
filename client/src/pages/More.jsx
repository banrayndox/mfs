import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePinModal } from '../components/modals/ChangePinModal.jsx';
import { IoInformationCircleOutline } from 'react-icons/io5';
import {
  KeyPinColorIcon,
  LanguageColorIcon,
  ThemeColorIcon,
  ProfileColorIcon,
  KycColorIcon,
  LogoutColorIcon,
  FaqColorIcon,
  PwaInstallColorIcon,
} from '../components/ui/FlaticonIcons.jsx';
import { useThemeStore } from '../stores/themeStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export function More({ onOpenAuth, onLogout }) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'bn' ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('guardian_lang', nextLang);
  };

  const settingsGroups = [
    {
      title: t('more.settings'),
      items: [
        {
          id: 'pwa',
          icon: PwaInstallColorIcon,
          label: i18n.language === 'bn' ? 'অ্যাপ ইনস্টল করুন (Install App)' : 'Install App (PWA)',
          subtitle: isInstalled
            ? (i18n.language === 'bn' ? 'ডিভাইসে ইনস্টল করা আছে' : 'Installed on device')
            : (i18n.language === 'bn' ? 'হোম স্ক্রিনে সরাসরি যোগ করুন' : 'Add to home screen for offline access'),
          action: isInstalled ? null : promptInstall,
          badge: isInstalled
            ? (i18n.language === 'bn' ? 'ইনস্টলড' : 'Installed')
            : (i18n.language === 'bn' ? 'ইনস্টল' : 'Install'),
        },
        {
          id: 'pin',
          icon: KeyPinColorIcon,
          label: t('more.changePin'),
          subtitle: i18n.language === 'bn' ? 'গোপন পিন পরিবর্তন করুন' : 'Change 4-digit PIN',
          action: () => setIsChangePinOpen(true),
          badge: i18n.language === 'bn' ? 'পরিবর্তন' : 'Edit',
        },
        {
          id: 'lang',
          icon: LanguageColorIcon,
          label: t('more.language'),
          subtitle: i18n.language === 'bn' ? 'বাংলা (Bangla)' : 'English',
          action: toggleLanguage,
          badge: i18n.language === 'bn' ? 'বাং' : 'EN',
        },
        {
          id: 'theme',
          icon: ThemeColorIcon,
          label: t('more.theme'),
          subtitle: theme === 'dark' ? 'ডার্ক মোড (Dark)' : 'লাইট মোড (Light)',
          action: toggleTheme,
          badge: theme === 'dark' ? 'Dark' : 'Light',
        },
      ],
    },
    {
      title: 'অ্যাকাউন্ট সার্ভিস ও রোল (Account & Roles)',
      items: [
        /* Agent Portal entry removed from More page per requirement */
        { id: 'profile', icon: ProfileColorIcon, label: 'প্রোফাইল তথ্য (Profile)', subtitle: 'নাম, মোবাইল ও এনআইডি স্ট্যাটাস' },
        { id: 'kyc', icon: KycColorIcon, label: 'কেওয়াইসি ভেরিফিকেশন (KYC)', subtitle: 'এনআইডি / জন্ম নিবন্ধন (Demo)' },
        {
          id: 'logout',
          icon: LogoutColorIcon,
          label: 'লগআউট (Logout)',
          subtitle: 'বর্তমান সেশন থেকে বের হয়ে অন্য অ্যাকাউন্টে যান',
          action: onLogout,
          badge: 'লগআউট',
        },
      ],
    },
    {
      title: t('more.support'),
      items: [
        { id: 'faq', icon: FaqColorIcon, label: 'সহায়তা ও প্রশ্নোত্তর (FAQ)', subtitle: '২৪/৭ গ্রাহক সেবা' },
      ],
    },
  ];

  return (
    <>
      <div className="flex-1 pb-24 px-4 pt-4 space-y-5 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

      <h1 className="text-lg font-bold text-slate-900 dark:text-white px-1">
        {t('more.title')}
      </h1>

      {/* Settings Groups */}
      {settingsGroups.map((group, idx) => (
        <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
            {group.title}
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => item.action?.()}
                  className="w-full flex items-center justify-between py-3 px-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0 shadow-xs">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.badge && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-yellow text-slate-900">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Prototype Disclaimer Box */}
      <div className="bg-blue-50/70 dark:bg-slate-900/90 rounded-3xl p-4 border border-blue-200/60 dark:border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-brand-blue dark:text-brand-yellow font-bold">
          <IoInformationCircleOutline className="w-5 h-5 shrink-0" />
          <span>{t('more.about')}</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('more.disclaimer')}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-500 italic">
          "Face/fingerprint is verified by your device; upay never sees your biometrics."
        </p>
      </div>
    </div>

    {/* Change PIN Modal (rendered outside space-y-5) */}
    <ChangePinModal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} />
  </>
  );
}

export default More;

