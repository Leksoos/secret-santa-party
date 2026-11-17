// Helper for Telegram WebApp SDK integration
export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
}

export function initTelegram() {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {
      console.warn('Telegram WebApp init error:', e);
    }
  }
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'medium') {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;

  try {
    if (type === 'success' || type === 'warning' || type === 'error') {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch (e) {
    // Ignore haptic errors on unsupported clients
  }
}
