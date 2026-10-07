/**
 * Plays a pleasant financial notification chime using Web Audio API (zero external assets).
 * Gracefully handles blocked audio contexts and user interaction policies.
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Note 1 (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Note 2 (B5 - 987.77 Hz, pleasant interval)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // Audio context unavailable or blocked by browser policy
  }
}

/**
 * Show a browser Web Notification if permission is granted.
 * @param {string} title
 * @param {{ body?: string, icon?: string }} options
 */
export function showBrowserNotification(title, options = {}) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: options.body || '',
        icon: options.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
      });
    }
  } catch {
    // Notifications unavailable
  }
}
