import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { useSystemStore } from '../stores/systemStore.js';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket.js';

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

    // 1. Live Wallet Balance Updates
    const handleWalletBalance = (data) => {
      if (data && typeof data.balancePoisha === 'number') {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          setUser({ ...currentUser, balancePoisha: data.balancePoisha });
        }
      }
    };

    // 2. Live New Transaction (dispatched to History page)
    const handleNewTransaction = (data) => {
      if (data?.transaction) {
        window.dispatchEvent(
          new CustomEvent('mfs:transaction:new', { detail: data.transaction })
        );
      }
    };

    // 3. Live New Notification
    const handleNewNotification = (data) => {
      if (data?.notification) {
        const currentUnread = useSystemStore.getState().unreadNotifications;
        setUnreadNotifications((currentUnread || 0) + 1);

        window.dispatchEvent(
          new CustomEvent('mfs:notification:new', { detail: data.notification })
        );
      }
    };

    // 4. Live Guardian Approval Request (sent to Parent)
    const handleGuardianRequest = (data) => {
      if (data) {
        window.dispatchEvent(
          new CustomEvent('mfs:guardian:request', { detail: data })
        );
      }
    };

    // 5. Live Guardian Approval Decision (sent to Child & Parent)
    const handleGuardianDecided = (data) => {
      if (data) {
        window.dispatchEvent(
          new CustomEvent('mfs:guardian:decided', { detail: data })
        );
      }
    };

    // 6. Live Group Bill / Request Updates
    const handleGroupBillUpdate = (data) => {
      if (data?.request) {
        window.dispatchEvent(
          new CustomEvent('mfs:group_bill:update', { detail: data.request })
        );
      }
    };

    // 7. Live Savings Plan Updates
    const handleSavingsUpdate = (data) => {
      if (data?.plan) {
        window.dispatchEvent(
          new CustomEvent('mfs:savings:update', { detail: data.plan })
        );
      }
    };

    // 8. Live Micro-Savings Config Updates
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
        activeSocket.off('guardian:approval_request', handleGuardianRequest);
        activeSocket.off('guardian:approval_decided', handleGuardianDecided);
        activeSocket.off('group_bill:update', handleGroupBillUpdate);
        activeSocket.off('savings:update', handleSavingsUpdate);
        activeSocket.off('savings:config', handleSavingsConfig);
      }
    };
  }, [user?._id, user?.id, setUser, setUnreadNotifications]);
}
