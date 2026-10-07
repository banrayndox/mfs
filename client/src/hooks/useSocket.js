import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { useSystemStore } from '../stores/systemStore.js';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket.js';
import { playNotificationChime, showBrowserNotification } from '../utils/sound.js';

/**
 * Custom React hook to manage global Socket.IO connection and realtime event routing.
 */
export function useSocket() {
  const { user, setUser } = useAuthStore();
  const { setUnreadNotifications } = useSystemStore();

  useEffect(() => {
    const token = localStorage.getItem('guardian_token');
    if (!token || !user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(token);
    if (!socket) return;

    const currentUserId = user._id || user.id;

    // 1. Live Wallet Balance Updates
    const handleWalletBalance = (data) => {
      if (data && typeof data.balancePoisha === 'number') {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          setUser({ ...currentUser, balancePoisha: data.balancePoisha });
        }
      }
    };

    // 2. Live New Transaction (dispatched to History page & receiver popup)
    const handleNewTransaction = (data) => {
      if (data?.transaction) {
        const txn = data.transaction;

        // Dispatched to History page
        window.dispatchEvent(
          new CustomEvent('mfs:transaction:new', { detail: txn })
        );

        // Always sync latest balance on any transaction event
        useAuthStore.getState().fetchBalance?.();

        // Check if current user is the recipient (incoming money)
        const isRecipient =
          String(txn.recipientUserId?._id || txn.recipientUserId) === String(currentUserId) ||
          (txn.recipientPhone && txn.recipientPhone === user?.phone);

        if (isRecipient) {
          const bdt = (txn.amount / 100).toFixed(2);
          playNotificationChime();
          showBrowserNotification('টাকা প্রাপ্তি (Money Received)', {
            body: `৳${bdt} টাকা আপনার অ্যাকাউন্টে জমা হয়েছে।`,
          });
          window.dispatchEvent(
            new CustomEvent('mfs:realtime:toast', {
              detail: {
                type: 'money_received',
                title: 'টাকা প্রাপ্তি (Money Received)',
                message: `৳${bdt} টাকা আপনার ওয়ালেটে সফলভাবে জমা হয়েছে।`,
                amount: bdt,
              },
            })
          );
        }
      }
    };

    // 3. Live New Notification (with chime and toast)
    const handleNewNotification = (data) => {
      if (data?.notification) {
        const notif = data.notification;
        const currentUnread = useSystemStore.getState().unreadNotifications;
        setUnreadNotifications((currentUnread || 0) + 1);

        window.dispatchEvent(
          new CustomEvent('mfs:notification:new', { detail: notif })
        );

        // Determine toast type
        let toastType = 'info';
        if (notif.type === 'reminder') toastType = 'reminder';
        else if (notif.title?.includes('অনুরোধ') || notif.title?.includes('Request')) toastType = 'request';
        else if (notif.title?.includes('বিল') || notif.title?.includes('Bill')) toastType = 'bill_split';
        else if (notif.title?.includes('অভিভাবক') || notif.title?.includes('Guardian')) toastType = 'guardian';
        else if (notif.title?.includes('প্রাপ্তি') || notif.title?.includes('Received')) toastType = 'money_received';

        playNotificationChime();
        showBrowserNotification(notif.title, { body: notif.body });
        window.dispatchEvent(
          new CustomEvent('mfs:realtime:toast', {
            detail: {
              type: toastType,
              title: notif.title,
              message: notif.body,
            },
          })
        );
      }
    };

    // 4. Live Reminder Due Event
    const handleReminderDue = (data) => {
      if (data) {
        const currentUnread = useSystemStore.getState().unreadNotifications;
        setUnreadNotifications((currentUnread || 0) + 1);

        window.dispatchEvent(
          new CustomEvent('mfs:reminder:due', { detail: data })
        );

        const title = data.reminder?.title || data.notification?.title || 'রিমাইন্ডার সময় হয়েছে!';
        const message = data.reminder?.title
          ? `নির্ধারিত রিমাইন্ডার: "${data.reminder.title}"`
          : (data.notification?.body || 'আপনার রিমাইন্ডারের সময় হয়েছে।');

        playNotificationChime();
        showBrowserNotification('⏰ রিমাইন্ডার (Reminder Due)', { body: title });
        window.dispatchEvent(
          new CustomEvent('mfs:realtime:toast', {
            detail: {
              type: 'reminder',
              title: '⏰ রিমাইন্ডার (Reminder Due)',
              message,
              amount: data.reminder?.amount ? data.reminder.amount.toFixed(2) : undefined,
            },
          })
        );
      }
    };

    // 5. Live Guardian Approval Request (sent to Parent)
    const handleGuardianRequest = (data) => {
      if (data) {
        window.dispatchEvent(
          new CustomEvent('mfs:guardian:request', { detail: data })
        );
        playNotificationChime();
        window.dispatchEvent(
          new CustomEvent('mfs:realtime:toast', {
            detail: {
              type: 'guardian',
              title: '🛡️ অভিভাবক অনুমোদন প্রয়োজন (Approval Required)',
              message: `সন্তান অ্যাকাউন্টের লেনদেন অনুমোদনের জন্য অপেক্ষারত।`,
            },
          })
        );
      }
    };

    // 6. Live Guardian Approval Decision (sent to Child & Parent)
    const handleGuardianDecided = (data) => {
      if (data) {
        window.dispatchEvent(
          new CustomEvent('mfs:guardian:decided', { detail: data })
        );
        playNotificationChime();
        useAuthStore.getState().fetchBalance?.();
      }
    };

    // 7. Live Group Bill / Request Updates
    const handleGroupBillUpdate = (data) => {
      if (data?.request) {
        window.dispatchEvent(
          new CustomEvent('mfs:group_bill:update', { detail: data.request })
        );
        useAuthStore.getState().fetchBalance?.();
      }
    };

    // 8. Live Savings Plan Updates
    const handleSavingsUpdate = (data) => {
      if (data?.plan) {
        window.dispatchEvent(
          new CustomEvent('mfs:savings:update', { detail: data.plan })
        );
        useAuthStore.getState().fetchBalance?.();
      }
    };

    // 9. Live Micro-Savings Config Updates
    const handleSavingsConfig = (data) => {
      if (data?.microSavings) {
        window.dispatchEvent(
          new CustomEvent('mfs:savings:config', { detail: data.microSavings })
        );
      }
    };

    // Attach listeners
    socket.on('wallet:balance', handleWalletBalance);
    socket.on('transaction:new', handleNewTransaction);
    socket.on('notification:new', handleNewNotification);
    socket.on('reminder:due', handleReminderDue);
    socket.on('guardian:approval_request', handleGuardianRequest);
    socket.on('guardian:approval_decided', handleGuardianDecided);
    socket.on('group_bill:update', handleGroupBillUpdate);
    socket.on('savings:update', handleSavingsUpdate);
    socket.on('savings:config', handleSavingsConfig);

    return () => {
      const activeSocket = getSocket();
      if (activeSocket) {
        activeSocket.off('wallet:balance', handleWalletBalance);
        activeSocket.off('transaction:new', handleNewTransaction);
        activeSocket.off('notification:new', handleNewNotification);
        activeSocket.off('reminder:due', handleReminderDue);
        activeSocket.off('guardian:approval_request', handleGuardianRequest);
        activeSocket.off('guardian:approval_decided', handleGuardianDecided);
        activeSocket.off('group_bill:update', handleGroupBillUpdate);
        activeSocket.off('savings:update', handleSavingsUpdate);
        activeSocket.off('savings:config', handleSavingsConfig);
      }
    };
  }, [user?._id, user?.id, user?.phone, setUser, setUnreadNotifications]);
}

export default useSocket;
