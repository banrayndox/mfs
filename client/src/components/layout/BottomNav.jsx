import React from 'react';
import { useTranslation } from 'react-i18next';
import { IoHomeOutline, IoHome, IoWalletOutline, IoWallet, IoTimeOutline, IoTime, IoEllipsisHorizontal } from 'react-icons/io5';
import { RiRobot2Fill, RiRobot2Line } from 'react-icons/ri';

export function BottomNav({ activeTab, onTabChange, onOpenAgent }) {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'home',
      label: t('nav.home'),
      icon: IoHomeOutline,
      activeIcon: IoHome,
    },
    {
      id: 'account',
      label: t('nav.account'),
      icon: IoWalletOutline,
      activeIcon: IoWallet,
    },
    {
      id: 'agent',
      label: t('nav.aiAssistant'),
      isCenterAction: true,
    },
    {
      id: 'history',
      label: t('nav.history'),
      icon: IoTimeOutline,
      activeIcon: IoTime,
    },
    {
      id: 'more',
      label: t('nav.more'),
      icon: IoEllipsisHorizontal,
      activeIcon: IoEllipsisHorizontal,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 z-40 shadow-elevated">
      <div className="flex items-center justify-around relative">
        {tabs.map((tab) => {
          if (tab.isCenterAction) {
            return (
              <div key={tab.id} className="relative -top-5 flex flex-col items-center">
                <button
                  onClick={onOpenAgent}
                  className="w-14 h-14 rounded-full bg-brand-yellow hover:bg-brand-yellow-hover text-brand-blue flex items-center justify-center shadow-elevated border-4 border-surface-light dark:border-surface-dark transition-transform active:scale-95 group"
                  aria-label={tab.label}
                >
                  <RiRobot2Fill className="w-7 h-7 text-brand-blue group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {tab.label}
                </span>
              </div>
            );
          }

          const isActive = activeTab === tab.id;
          const Icon = isActive ? tab.activeIcon : tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
                isActive
                  ? 'text-brand-blue dark:text-brand-yellow font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
