import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  balanceVisible: false,
  balanceTimer: null,

  revealBalance: () => {
    // Clear any existing timer
    const existing = get().balanceTimer;
    if (existing) clearTimeout(existing);

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

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
