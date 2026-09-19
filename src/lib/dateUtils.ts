import type { Lead, OutcomeCadenceRule } from '../types';

export function isDueNowOrOverdue(nextActionAt: string | null | undefined): boolean {
  if (!nextActionAt) return false;
  const target = new Date(nextActionAt).getTime();
  const now = Date.now();
  // Due now if in the past or due within the next 10 minutes
  return target <= now + 10 * 60 * 1000;
}

export function isDueToday(nextActionAt: string | null | undefined): boolean {
  if (!nextActionAt) return false;
  const target = new Date(nextActionAt);
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

export function isStaleLead(lead: Lead): boolean {
  // Stale if status is Active or Follow-up Scheduled and haven't had a call in 5+ days
  if (lead.status !== 'Active' && lead.status !== 'Follow-up Scheduled') {
    return false;
  }

  const latestCallTime =
    lead.call_logs && lead.call_logs.length > 0
      ? new Date(lead.call_logs[0].timestamp).getTime()
      : new Date(lead.created_at).getTime();

  const diffDays = (Date.now() - latestCallTime) / (1000 * 60 * 60 * 24);
  return diffDays >= 5;
}

export function getDaysSinceLastTouch(lead: Lead): number {
  const latestCallTime =
    lead.call_logs && lead.call_logs.length > 0
      ? new Date(lead.call_logs[0].timestamp).getTime()
      : new Date(lead.created_at).getTime();

  const diffDays = Math.floor((Date.now() - latestCallTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function formatFriendlyTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Not scheduled';
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (60 * 1000));
  const diffHours = Math.round(diffMs / (3600 * 1000));

  if (diffMs < 0) {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) {
      return `Overdue by ${absMins}m`;
    }
    const absHours = Math.abs(diffHours);
    if (absHours < 24) {
      return `Overdue by ${absHours}h`;
    }
    const absDays = Math.round(absHours / 24);
    return `Overdue by ${absDays}d`;
  }

  if (diffMins <= 5) {
    return 'Due right now';
  }

  if (diffMins < 60) {
    return `In ${diffMins} mins`;
  }

  const isToday =
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    target.getDate() === tomorrow.getDate() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getFullYear() === tomorrow.getFullYear();

  const timeStr = target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }

  return `${target.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export function getQuickPresets() {
  const now = new Date();

  // Preset 1: +2 Hours
  const plus2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Preset 2: Tomorrow 10 AM
  const tomorrow10Am = new Date(now);
  tomorrow10Am.setDate(tomorrow10Am.getDate() + 1);
  tomorrow10Am.setHours(10, 0, 0, 0);

  // Preset 3: In 2 Days 10 AM
  const in2Days10Am = new Date(now);
  in2Days10Am.setDate(in2Days10Am.getDate() + 2);
  in2Days10Am.setHours(10, 0, 0, 0);

  // Preset 4: Next Monday 10 AM
  const nextMonday = new Date(now);
  const day = nextMonday.getDay();
  const daysUntilMonday = ((1 + 7 - day) % 7) || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(10, 0, 0, 0);

  return [
    { label: '+2 hours', value: plus2Hours.toISOString(), preview: plus2Hours.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
    { label: 'Tomorrow 10am', value: tomorrow10Am.toISOString(), preview: 'Tomorrow 10:00 AM' },
    { label: 'In 2 days', value: in2Days10Am.toISOString(), preview: in2Days10Am.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) },
    { label: 'Next Monday', value: nextMonday.toISOString(), preview: nextMonday.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
  ];
}

// Convert ISO string to HTML <input type="datetime-local"> format YYYY-MM-DDTHH:mm
export function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(localStr: string): string | null {
  if (!localStr) return null;
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Computes an automated next action follow-up ISO timestamp based on an outcome cadence rule.
 */
export function computeCadenceFollowUpDate(rule: OutcomeCadenceRule): string | null {
  if (rule.delayValue === 0) return null;

  const now = new Date();
  const target = new Date(now);

  if (rule.delayUnit === 'hours') {
    target.setTime(target.getTime() + rule.delayValue * 60 * 60 * 1000);
  } else {
    // delay in days
    target.setDate(target.getDate() + rule.delayValue);
  }

  // If a preferred business hour was set (e.g. 10 AM)
  if (typeof rule.preferredHour === 'number' && rule.preferredHour >= 0 && rule.preferredHour <= 23) {
    target.setHours(rule.preferredHour, 0, 0, 0);
    // If the resulting time has already elapsed today, bump by 24h
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
  }

  return target.toISOString();
}

