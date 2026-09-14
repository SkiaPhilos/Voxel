// src/lib/pushManager.ts
import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.');
  }

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // Wait for the worker to be active
  if (reg.installing || reg.waiting) {
    await new Promise<void>((resolve) => {
      const targetWorker = reg!.installing || reg!.waiting;
      if (!targetWorker) return resolve();
      targetWorker.addEventListener('statechange', () => {
        if (targetWorker.state === 'activated') {
          resolve();
        }
      });
      // Safety timeout after 2 seconds
      setTimeout(resolve, 2000);
    });
  }

  return navigator.serviceWorker.ready;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await getOrRegisterServiceWorker();
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('Failed to check existing push subscription:', err);
    return null;
  }
}

export function extractSubscriptionPayload(subscription: PushSubscription | null): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} | null {
  if (!subscription) return null;

  const raw = typeof subscription.toJSON === 'function' ? subscription.toJSON() : (subscription as any);
  let p256dh = raw?.keys?.p256dh || '';
  let auth = raw?.keys?.auth || '';

  // Mobile WebKit / Chromium fallback if keys were not populated by toJSON()
  if (!p256dh && typeof subscription.getKey === 'function') {
    try {
      p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
    } catch {
      // ignore
    }
  }

  if (!auth && typeof subscription.getKey === 'function') {
    try {
      auth = arrayBufferToBase64(subscription.getKey('auth'));
    } catch {
      // ignore
    }
  }

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
  };
}

export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      error:
        'Push notifications are not available in this browser. On iPhone/iPad (iOS 16.4+), open in Safari, tap the Share icon, and select "Add to Home Screen" to enable Web Push.',
    };
  }

  try {
    // Request permission (handles both modern Promise and older mobile callback APIs)
    let permission: NotificationPermission = Notification.permission;
    if (permission !== 'granted') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = await new Promise((resolve) => {
          Notification.requestPermission((p) => resolve(p));
        });
      }
    }

    if (permission !== 'granted') {
      return {
        success: false,
        error:
          permission === 'denied'
            ? 'Notifications were blocked in site settings. Please tap the lock/tune icon in your browser URL bar and allow notifications.'
            : 'Notification permission was not granted.',
      };
    }

    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey) {
      return { success: false, error: 'Push server key not available' };
    }

    const reg = await getOrRegisterServiceWorker();
    let subscription = await reg.pushManager.getSubscription();
    const targetServerKey = urlBase64ToUint8Array(publicKey);

    // If subscription already exists, check if its applicationServerKey matches current VAPID key
    if (subscription) {
      try {
        const rawExistingKey = subscription.options?.applicationServerKey;
        let isMatch = false;
        if (rawExistingKey) {
          const existingBytes = new Uint8Array(rawExistingKey);
          if (existingBytes.length === targetServerKey.length) {
            isMatch = existingBytes.every((b, idx) => b === targetServerKey[idx]);
          }
        }
        // If key mismatched or expired, unsubscribe and re-subscribe cleanly
        if (!isMatch) {
          await subscription.unsubscribe();
          subscription = null;
        }
      } catch (checkErr) {
        console.warn('Subscription key check note:', checkErr);
      }
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: targetServerKey,
      });
    }

    const payload = extractSubscriptionPayload(subscription);
    if (!payload?.endpoint || !payload.keys.p256dh || !payload.keys.auth) {
      return {
        success: false,
        error: 'Device generated incomplete push credentials. Please retry.',
      };
    }

    await api.savePushSubscription(payload);

    return {
      success: true,
      subscription,
    };
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    return {
      success: false,
      error: err?.message || 'Could not activate push notifications on this device.',
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isPushSupported()) return { success: true };

  try {
    const reg = await getOrRegisterServiceWorker();
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.removePushSubscription(endpoint);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Push unsubscribe error:', err);
    return { success: false, error: err?.message };
  }
}
