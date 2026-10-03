import { create } from 'zustand';

export const useSystemStore = create((set) => ({
  isMockAi: true,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  unreadNotifications: 2,
  setMockAi: (isMock) => set({ isMockAi: isMock }),
  setOffline: (isOffline) => set({ isOffline }),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
}));
