import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// ── PWA Service Worker Registration ──────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Notify user that new content is available
      console.log('[PWA] New content available, refreshing…');
      // Auto-update (or show a toast prompt – auto is better for LIS reliability)
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline');
    },
    onRegistered(registration) {
      console.log('[PWA] Service Worker registered:', registration);

      // Check for updates every 30 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration failed:', error);
    },
  });
}

// ── Request notification permission early ────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  // Wait for a user interaction before requesting
  const requestOnInteraction = () => {
    Notification.requestPermission().then((permission) => {
      console.log('[Notifications] Permission:', permission);
    });
    document.removeEventListener('click', requestOnInteraction);
  };
  document.addEventListener('click', requestOnInteraction, { once: true });
}

createRoot(document.getElementById("root")!).render(<App />);
