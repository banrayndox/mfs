import { create } from 'zustand';
import axios from 'axios';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  balanceVisible: false,
  balanceTimer: null,
  isBalanceLoading: false,

  /**
   * Fetch latest wallet balance directly from backend server and update state.
   */
  fetchBalance: async () => {
    try {
      set({ isBalanceLoading: true });
      const token = localStorage.getItem('guardian_token');
      if (!token) return;

      const res = await axios.get('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res?.data && typeof res.data.balancePoisha === 'number') {
        const currentUser = get().user;
        if (currentUser) {
          const updated = { ...currentUser, balancePoisha: res.data.balancePoisha };
          set({ user: updated });
          localStorage.setItem('guardian_user', JSON.stringify(updated));
        }
      }
    } catch {
      // Fail gracefully without interrupting UI
    } finally {
      set({ isBalanceLoading: false });
    }
  },

  revealBalance: () => {
    // Clear any existing timer
    const existing = get().balanceTimer;
    if (existing) clearTimeout(existing);

    // Always fetch latest server balance immediately on tap
    get().fetchBalance();

    const timer = setTimeout(() => {
      set({ balanceVisible: false, balanceTimer: null });
    }, 30000); // 30s auto-hide

    set({ balanceVisible: true, balanceTimer: timer });
  },

  hideBalance: () => {
    const existing = get().balanceTimer;
    if (existing) clearTimeout(existing);
    set({ balanceVisible: false, balanceTimer: null });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem('guardian_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('guardian_user');
    }
    set({ user, isAuthenticated: !!user });
  },

  logout: () => {
    localStorage.removeItem('guardian_token');
    localStorage.removeItem('guardian_user');
    const existing = get().balanceTimer;
    if (existing) clearTimeout(existing);
    set({ user: null, isAuthenticated: false, balanceVisible: false, balanceTimer: null });
  },
}));

export default useAuthStore;
