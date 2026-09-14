import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  ExternalLink,
  ShieldCheck,
  Info,
  Clock,
  Share,
} from 'lucide-react';
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  extractSubscriptionPayload,
} from '../lib/pushManager';
import { api } from '../lib/api';

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribedChange?: (isSubscribed: boolean) => void;
}

export const PushNotificationModal: React.FC<PushNotificationModalProps> = ({
  isOpen,
  onClose,
  onSubscribedChange,
}) => {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Check iOS device detection
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  const checkStatus = async () => {
    const isSupp = isPushSupported();
    setSupported(isSupp);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    if (isSupp) {
      const sub = await getExistingSubscription();
      const hasSub = Boolean(sub);
      setIsSubscribed(hasSub);
      if (onSubscribedChange) onSubscribedChange(hasSub);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setStatusMessage(null);
    }
  }, [isOpen]);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setIsSubscribed(true);
        setPermission('granted');
        if (onSubscribedChange) onSubscribedChange(true);
        setStatusMessage({
          type: 'success',
          text: 'Push notifications successfully activated! Lock-screen alerts will wake your device when follow-ups are due.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Could not activate push notifications.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error subscribing to notifications.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await unsubscribeFromPushNotifications();
      if (res.success) {
        setIsSubscribed(false);
        if (onSubscribedChange) onSubscribedChange(false);
        setStatusMessage({
          type: 'info',
          text: 'Push notifications disabled on this device.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to unsubscribe.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error disabling notifications.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const sub = await getExistingSubscription();
      const payload = extractSubscriptionPayload(sub);
      const res = await api.testPushNotification(payload || sub);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Test push notification dispatched! Check your notification tray or phone lock screen.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Push dispatch failed.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to dispatch test notification.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-[#FDFBF7] w-full max-w-lg rounded-2xl shadow-xl border border-stone-200 overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Mobile &amp; Web Push Notifications</h2>
              <p className="text-xs text-stone-500">Lock-screen &amp; background follow-up alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-4">
          {/* Answer to user's question: "Does it work when browser is closed?" */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">
                Does push notification work even when the browser is closed?
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                <strong>Yes.</strong> Web Push uses the background Service Worker and your device operating system&apos;s push service. Notifications will wake up your phone lock screen, notification drawer, and desktop even when you close the browser tab.
              </p>
            </div>
          </div>

          {/* Status Box */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">Browser / PWA Push Support:</span>
              <span className="font-semibold flex items-center gap-1.5">
                {supported ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Supported</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700">Not Available in current view</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">Device Lock-Screen Alerts:</span>
              <span className="font-semibold flex items-center gap-1.5">
                {isSubscribed ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-700">Active on this device</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-stone-300" />
                    <span className="text-stone-600">Not enabled</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">Browser Permission:</span>
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                {permission}
              </span>
            </div>
          </div>

          {/* Feedback message banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 animate-in fade-in duration-150 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-900'
                  : 'bg-stone-100 border border-stone-200 text-stone-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* iOS Safari Tip */}
          {isIOS && !isStandalone && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-start gap-2.5">
              <Share className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sky-900">iPhone / iPad Instructions</p>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  iOS requires adding the app to your Home Screen to allow lock-screen push alerts:
                  <br />
                  1. Tap the <strong>Share</strong> icon in Safari (the square with an up arrow).
                  <br />
                  2. Tap <strong>&quot;Add to Home Screen&quot;</strong>.
                  <br />
                  3. Launch ColdCall CRM from your home screen and enable notifications.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            {!isSubscribed ? (
              <button
                id="enable-push-notifications-btn"
                type="button"
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>Enable Lock-Screen Notifications</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  id="send-test-push-btn"
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={isTesting}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isTesting ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Test Lock-Screen Alert</span>
                    </>
                  )}
                </button>
                <button
                  id="disable-push-notifications-btn"
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={isLoading}
                  className="w-full sm:w-auto py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-600 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Disable
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-5 pt-3 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-400">
          <span>VAPID Web Push Protocol (Option A)</span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
