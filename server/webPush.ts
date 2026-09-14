// server/webPush.ts
import webpush from 'web-push';
import {
  DEFAULT_VAPID_PUBLIC_KEY,
  DEFAULT_VAPID_PRIVATE_KEY,
  DEFAULT_VAPID_SUBJECT,
} from './supabaseConfig.js';

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() || DEFAULT_VAPID_PUBLIC_KEY;
}

export function getVapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() || DEFAULT_VAPID_PRIVATE_KEY;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
}

let isInitialized = false;

export function ensureWebPushInitialized(): boolean {
  if (isInitialized) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const subject = getVapidSubject();

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn('Failed to configure webpush VAPID details:', err);
      return false;
    }
  }
  return false;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
}

export async function sendWebPush(
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  payload: PushNotificationPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const ready = ensureWebPushInitialized();
  if (!ready) {
    return { success: false, error: 'Web Push VAPID credentials not configured' };
  }

  try {
    const res = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true, statusCode: res.statusCode };
  } catch (err: any) {
    const statusCode = err.statusCode || err.status;
    return {
      success: false,
      statusCode,
      error: err.message || 'Push dispatch failed',
    };
  }
}
