import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IoChevronForwardOutline,
  IoFlashOutline,
} from 'react-icons/io5';
import {
  SendMoneyColorIcon,
  RechargeColorIcon,
  CashOutColorIcon,
  PayBillColorIcon,
  AddMoneyColorIcon,
  SavingsColorIcon,
  RequestMoneyColorIcon,
  GuardianColorIcon,
  RemindersColorIcon,
  ScheduledRulesColorIcon,
  GroupBillColorIcon,
} from '../components/ui/FlaticonIcons.jsx';
import { useAuthStore } from '../stores/authStore.js';

export function Home({ onSelectService, onSelectSafety, onOpenAgent }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const primaryServices = [
    { id: 'send', label: t('services.sendMoney'), icon: SendMoneyColorIcon },
    { id: 'recharge', label: t('services.mobileRecharge'), icon: RechargeColorIcon },
    { id: 'cashout', label: t('services.cashOut'), icon: CashOutColorIcon },
    { id: 'paybill', label: t('services.payBill'), icon: PayBillColorIcon },
    { id: 'addmoney', label: t('services.addMoney'), icon: AddMoneyColorIcon },
    { id: 'savings', label: t('services.savings'), icon: SavingsColorIcon },
    // { id: 'transfer', label: t('services.fundTransfer'), icon: IoSwapHorizontalOutline },
    { id: 'request', label: t('services.requestMoney'), icon: RequestMoneyColorIcon },
    // { id: 'payment', label: t('services.makePayment'), icon: IoQrCodeOutline },
  ];

  const safetyItems = [
    { id: 'guardian', label: t('safety.guardianMode'), icon: GuardianColorIcon },
    // checkMessage hidden from New Features as requested
    { id: 'reminders', label: t('safety.reminders'), icon: RemindersColorIcon },
    // Duplicate AI Copilot removed from safety section; persistent AI Copilot is in the bottom navigation bar
    // { id: 'aiAssistant', label: t('safety.aiAssistant'), icon: RiRobot2Line, action: onOpenAgent },
    { id: 'scheduledRules', label: t('safety.scheduledRules'), icon: ScheduledRulesColorIcon },
    { id: 'groupBill', label: t('safety.groupBill'), icon: GroupBillColorIcon },
  ].filter((item) => {
    // Hide Guardian Mode for Child accounts
    if (user?.accountType === 'CHILD' && item.id === 'guardian') {
      return false;
    }
    return true;
  });

  return (
    <div className="flex-1 pb-24 px-4 pt-3 space-y-5">
      {/* 4-Column Icon Grid: Primary Financial Services */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
          {t('home.servicesTitle')}
        </h2>
        <div className="grid grid-cols-4 gap-y-4 gap-x-2">
          {primaryServices.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectService?.(item.id)}
                className="flex flex-col items-center justify-center p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all text-center group"
              >
                <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <Icon className="w-9 h-9" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Safety & AI Section */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-soft border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-blue dark:bg-brand-yellow"></span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {t('home.safetyTitle')}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-y-4 gap-x-2">
          {safetyItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => item.action ? item.action() : onSelectSafety?.(item.id)}
                className="flex flex-col items-center justify-center p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all text-center group"
              >
                <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <Icon className="w-8 h-8" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Smart Reminders & AI Tips Card Preview */}
      <section className="bg-gradient-to-br from-amber-50 to-yellow-50/60 dark:from-slate-900 dark:to-slate-800/80 rounded-3xl p-4 shadow-soft border border-yellow-200/60 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IoFlashOutline className="w-4 h-4 text-amber-600 dark:text-brand-yellow" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('home.remindersTitle')}
            </h3>
          </div>
          <button
            onClick={() => onSelectSafety?.('reminders')}
            className="text-xs font-bold text-brand-blue dark:text-brand-yellow hover:underline flex items-center"
          >
            {t('home.viewAll')} <IoChevronForwardOutline className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        {/* Demo reminder item */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 shadow-sm border border-yellow-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <PayBillColorIcon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">বিদ্যুৎ বিল (Electricity Bill)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">DPDC • মেয়াদ: আগামীকাল (Due: Tomorrow)</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 dark:text-white">৳ ১,৪৫০.০০</p>
            <button
              onClick={() => onSelectService?.('paybill_dpdc')}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-yellow text-slate-900 hover:bg-brand-yellow-hover mt-0.5 shadow-xs transition-all active:scale-95"
            >
              পে করুন
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
