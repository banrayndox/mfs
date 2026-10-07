import React, { useState, useEffect } from 'react';
import { IoCloseOutline, IoCheckmarkCircle, IoTimeOutline, IoWalletOutline, IoShieldCheckmarkOutline, IoReceiptOutline } from 'react-icons/io5';

/**
 * Global Real-time Notification Banner for in-app popups (Money Received, Reminders, Requests, Bill Splits).
 */
export function RealtimeToastBanner() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const toastData = e.detail;
      if (!toastData) return;

      const id = toastData.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast = {
        id,
        title: toastData.title || 'বিজ্ঞপ্তি (Notification)',
        message: toastData.message || toastData.body || '',
        type: toastData.type || 'info', // 'money_received' | 'reminder' | 'request' | 'bill_split' | 'guardian' | 'info'
        amount: toastData.amount,
        createdAt: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 2)]); // Keep at most 3 active toasts

      // Auto dismiss after 6.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6500);
    };

    window.addEventListener('mfs:realtime:toast', handleToastEvent);
    return () => {
      window.removeEventListener('mfs:realtime:toast', handleToastEvent);
    };
  }, []);

  if (toasts.length === 0) return null;

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'money_received':
        return <IoCheckmarkCircle className="w-5 h-5 text-emerald-500" />;
      case 'reminder':
        return <IoTimeOutline className="w-5 h-5 text-amber-500" />;
      case 'guardian':
        return <IoShieldCheckmarkOutline className="w-5 h-5 text-blue-500" />;
      case 'bill_split':
      case 'request':
        return <IoReceiptOutline className="w-5 h-5 text-indigo-500" />;
      default:
        return <IoWalletOutline className="w-5 h-5 text-brand-yellow" />;
    }
  };

  return (
    <div className="fixed top-3 left-0 right-0 z-50 px-4 pointer-events-none flex flex-col items-center gap-2 max-w-md mx-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3.5 flex items-start justify-between gap-3 transition-all animate-in slide-in-from-top-3 duration-200 backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
          role="alert"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
              {getIcon(toast.type)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {toast.title}
                </h4>
                {toast.amount && (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                    ৳{toast.amount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                {toast.message}
              </p>
            </div>
          </div>

          <button
            onClick={() => dismissToast(toast.id)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Dismiss notification"
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default RealtimeToastBanner;
