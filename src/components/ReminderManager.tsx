import React, { useEffect } from 'react';
import type { Lead, User } from '../types';
import { isDueNowOrOverdue } from '../lib/dateUtils';
import { api } from '../lib/api';

interface ReminderManagerProps {
  leads: Lead[];
  currentUser: User | null;
  notificationPermission: NotificationPermission;
  onDueReminder: (lead: Lead) => void;
}

export const ReminderManager: React.FC<ReminderManagerProps> = ({
  leads,
  currentUser,
  notificationPermission,
  onDueReminder,
}) => {
  useEffect(() => {
    if (!currentUser) return;

    const checkDueLeads = () => {
      leads.forEach((lead) => {
        // Only active / follow-up scheduled leads
        if (lead.status !== 'Active' && lead.status !== 'Follow-up Scheduled') return;
        if (!lead.next_action_at) return;

        if (isDueNowOrOverdue(lead.next_action_at)) {
          const scheduledTimestamp = new Date(lead.next_action_at).getTime();

          // Check if DB already stamped this follow-up as notified
          const isDbNotified =
            lead.last_notified_at &&
            new Date(lead.last_notified_at).getTime() >= scheduledTimestamp;

          // Check localStorage for client-side popups to avoid duplicate alerts on page refresh
          const storageKey = `crm_notified_${lead.id}_${scheduledTimestamp}`;
          const isClientNotified = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true';

          if (isDbNotified && isClientNotified) {
            // Already processed by server cron and acknowledged on client
            return;
          }

          // Mark as notified in localStorage right away
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(storageKey, 'true');
            } catch {
              // ignore quota
            }
          }

          // 1. In-app UI banner (only if not seen on client yet)
          if (!isClientNotified) {
            onDueReminder(lead);

            // 2. HTML5 Browser Notification popup (secondary convenience while tab is open)
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification(`ColdCall CRM: Follow-Up Due!`, {
                  body: `Time to call ${lead.name} (${lead.phone}). Click to open CRM.`,
                  icon: '/favicon.ico',
                  tag: lead.id,
                });
              } catch (e) {
                console.warn('Could not fire browser notification', e);
              }
            }
          }

          // 3. Email notification: only dispatch if DB has not already notified this lead!
          if (!isDbNotified) {
            api
              .testEmailReminder(lead.id, lead.name, lead.next_action_at)
              .catch((err) => console.warn('Email dispatch notice', err));
          }
        }
      });
    };

    // Check immediately on mount or lead updates
    checkDueLeads();

    // Re-check periodically every 30 seconds
    const interval = setInterval(checkDueLeads, 30000);
    return () => clearInterval(interval);
  }, [leads, currentUser, notificationPermission, onDueReminder]);

  return null;
};
