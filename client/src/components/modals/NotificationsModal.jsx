import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  IoCloseOutline,
  IoCheckmarkDoneOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';
import {
  NotificationBellColorIcon,
  GuardianColorIcon,
  SecurityAlertColorIcon,
  RemindersColorIcon,
  SendMoneyColorIcon,
  AiCopilotColorIcon,
} from '../ui/FlaticonIcons.jsx';
import { useSystemStore } from '../../stores/systemStore.js';
import { GuardianApprovalModal } from './GuardianApprovalModal.jsx';

export function NotificationsModal({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const { setUnreadNotifications } = useSystemStore();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTxnForApproval, setSelectedTxnForApproval] = useState(null);
  const [selectedActionType, setSelectedActionType] = useState('approve');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [decidedMap, setDecidedMap] = useState({});

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/safety/notifications');
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadNotifications(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('বিজ্ঞপ্তি লোড করতে সমস্যা হয়েছে (Failed to load notifications)');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApproval = async (item, action = 'approve') => {
    setSelectedActionType(action);
    const txnId = item.metadata?.txnId;
    if (!txnId) return;

    if (!item.isRead) {
      markAsRead(item._id);
    }

    try {
      setApprovalLoading(true);
      setError('');
      const res = await axios.get(`/api/guardians/approvals/${txnId}`);
      if (res.data?.approval) {
        if (res.data.approval.status !== 'awaiting_guardian') {
          setError(
            i18n.language === 'bn'
              ? 'এই লেনদেনটি ইতোমধ্যে প্রক্রিয়া করা হয়েছে।'
              : 'This transaction has already been processed.'
          );
          return;
        }
        setSelectedTxnForApproval(res.data.approval);
      }
    } catch (err) {
      // Fallback to searching pending approvals list
      try {
        const pendingRes = await axios.get('/api/guardians/pending-approvals');
        const match = pendingRes.data?.pendingApprovals?.find((p) => p.id === txnId);
        if (match) {
          setSelectedTxnForApproval(match);
          return;
        }
      } catch (_) {}

      setError(
        err.response?.data?.message ||
          (i18n.language === 'bn'
            ? 'অনুমোদনের তথ্য পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে।'
            : 'Approval details not found or expired.')
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Realtime Socket.IO notification reception
  useEffect(() => {
    const handleNewNotification = (event) => {
      const newNotif = event.detail;
      if (!newNotif) return;
      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev];
      });
    };

    const handleGuardianDecided = (event) => {
      const decided = event.detail;
      if (!decided?.txnId) return;
      setDecidedMap((prev) => ({
        ...prev,
        [decided.txnId]: decided.decision === 'approve' ? 'approved' : 'rejected',
      }));
      if (
        selectedTxnForApproval &&
        (selectedTxnForApproval._id === decided.txnId || selectedTxnForApproval.id === decided.txnId)
      ) {
        setSelectedTxnForApproval(null);
      }
      fetchNotifications();
    };

    window.addEventListener('mfs:notification:new', handleNewNotification);
    window.addEventListener('mfs:guardian:decided', handleGuardianDecided);

    return () => {
      window.removeEventListener('mfs:notification:new', handleNewNotification);
      window.removeEventListener('mfs:guardian:decided', handleGuardianDecided);
    };
  }, [selectedTxnForApproval]);

  const markAsRead = async (id) => {
    try {
      await axios.post(`/api/safety/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post('/api/safety/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifications(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'guardian_request':
      case 'guardian_approval':
      case 'guardian_decision':
        return <GuardianColorIcon className="w-5 h-5" />;
      case 'security_alert':
        return <SecurityAlertColorIcon className="w-5 h-5" />;
      case 'copilot':
      case 'ai_copilot':
        return <AiCopilotColorIcon className="w-5 h-5" />;
      case 'scheduled_due':
      case 'reminder':
        return <RemindersColorIcon className="w-5 h-5" />;
      case 'transaction':
      default:
        return <SendMoneyColorIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-modal border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <NotificationBellColorIcon className="w-8 h-8 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {i18n.language === 'bn' ? 'বিজ্ঞপ্তি সমূহ' : 'Notifications'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {i18n.language === 'bn' ? 'আপনার অ্যাকাউন্টের সাম্প্রতিক আপডেট' : 'Recent activity on your account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <IoCloseOutline className="w-6 h-6" />
          </button>
        </div>

        {/* Mark All Read button */}
        {notifications.some((n) => !n.isRead) && (
          <div className="py-2.5 px-1 flex justify-end shrink-0">
            <button
              onClick={markAllAsRead}
              className="text-xs font-bold text-brand-blue dark:text-brand-yellow hover:underline flex items-center gap-1"
            >
              <IoCheckmarkDoneOutline className="w-4 h-4" />
              <span>{i18n.language === 'bn' ? 'সব পঠিত হিসেবে চিহ্নিত করুন' : 'Mark all as read'}</span>
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
              বিজ্ঞপ্তি লোড হচ্ছে...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 text-xs rounded-xl font-medium">
              {error}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                <NotificationBellColorIcon className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {i18n.language === 'bn' ? 'কোনো নতুন বিজ্ঞপ্তি নেই' : 'No notifications'}
              </p>
              <p className="text-xs text-slate-400">
                {i18n.language === 'bn'
                  ? 'লেনদেন বা সুরক্ষার তথ্য এখানে প্রদর্শিত হবে।'
                  : 'Transactions and safety alerts will appear here.'}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                onClick={() => {
                  if (!item.isRead) markAsRead(item._id);
                  if (item.type === 'guardian_request' && item.metadata?.txnId) {
                    handleOpenApproval(item);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  !item.isRead
                    ? 'bg-amber-50/50 dark:bg-slate-800/80 border-amber-200 dark:border-amber-900/50 shadow-xs'
                    : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h3>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-yellow shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.body}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(item.createdAt).toLocaleString(
                          i18n.language === 'bn' ? 'bn-BD' : 'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }
                        )}
                      </span>

                      {item.type === 'guardian_request' && item.metadata?.txnId && (
                        <div>
                          {decidedMap[item.metadata.txnId] === 'approved' ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                              {i18n.language === 'bn' ? 'অনুমোদিত' : 'Approved'}
                            </span>
                          ) : decidedMap[item.metadata.txnId] === 'rejected' ? (
                            <span className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                              {i18n.language === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenApproval(item, 'approve');
                                }}
                                disabled={approvalLoading}
                                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
                              >
                                <IoShieldCheckmarkOutline className="w-3.5 h-3.5" />
                                <span>{i18n.language === 'bn' ? 'অনুমোদন' : 'Approve'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenApproval(item, 'reject');
                                }}
                                disabled={approvalLoading}
                                className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
                              >
                                <IoCloseOutline className="w-3.5 h-3.5" />
                                <span>{i18n.language === 'bn' ? 'প্রত্যাখ্যান' : 'Reject'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {i18n.language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>

      {/* Styled Guardian Approval Modal */}
      <GuardianApprovalModal
        isOpen={!!selectedTxnForApproval}
        transaction={selectedTxnForApproval}
        actionType={selectedActionType}
        onClose={() => setSelectedTxnForApproval(null)}
        onSuccess={() => {
          setSelectedTxnForApproval(null);
          fetchNotifications();
        }}
      />
    </div>
  );
}

export default NotificationsModal;
