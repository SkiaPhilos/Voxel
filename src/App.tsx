import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  PhoneCall,
  Flame,
  CheckCircle2,
  Bell,
  Clock,
  Calendar,
  X,
  RefreshCw,
  SlidersHorizontal,
  Menu,
  Users,
} from 'lucide-react';
import type { Lead, User, OutcomeTag, Priority, PinnedComment } from './types';
import { api, setStoredToken } from './lib/api';
import { Sidebar, type AppView } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { LeadCard } from './components/LeadCard';
import { DueTodaySection } from './components/DueTodaySection';
import { StaleLeadsSection } from './components/StaleLeadsSection';
import { LogCallModal } from './components/LogCallModal';
import { NewLeadModal } from './components/NewLeadModal';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { AllLeadsView } from './components/AllLeadsView';
import { ClosedDealsView } from './components/ClosedDealsView';
import { ArchiveView } from './components/ArchiveView';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { PushNotificationModal } from './components/PushNotificationModal';
import { ReminderManager } from './components/ReminderManager';
import { PotentialCustomersView } from './components/PotentialCustomersView';
import { ManagerDashboardView } from './components/ManagerDashboardView';
import { NewsletterView } from './components/NewsletterView';
import { ReassignLeadModal } from './components/ReassignLeadModal';
import { StickyDirectiveFloatingLayer } from './components/StickyDirectiveIndicator';
import { isDueNowOrOverdue, isStaleLead } from './lib/dateUtils';
import { getExistingSubscription } from './lib/pushManager';

const PINNED_STORAGE_KEY = 'coldcrm_sidebar_pinned';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // View navigation: AppView
  const [currentView, setCurrentView] = useState<AppView>('active');
  const [potentialCustomersCount, setPotentialCustomersCount] = useState<number>(0);

  // Sidebar pinned & mobile state
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PINNED_STORAGE_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Leads dataset
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Directives / Pinned comments
  const [pinnedComments, setPinnedComments] = useState<PinnedComment[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [priorityOnly, setPriorityOnly] = useState(false);

  // Modals & Panels
  const [activeCallModalLead, setActiveCallModalLead] = useState<Lead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [selectedDetailLead, setSelectedDetailLead] = useState<Lead | null>(null);
  const [leadToReassign, setLeadToReassign] = useState<Lead | null>(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isPushActive, setIsPushActive] = useState(false);

  // Browser Notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // In-app alert banner
  const [dueAlertLead, setDueAlertLead] = useState<Lead | null>(null);

  // Check Web Push subscription on mount
  useEffect(() => {
    getExistingSubscription()
      .then((sub) => {
        if (sub) setIsPushActive(true);
      })
      .catch(() => {});
  }, []);

  const handleToggleSidebarPin = () => {
    const next = !isSidebarPinned;
    setIsSidebarPinned(next);
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  // 1. Initial Authentication Check
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await api.getMe();
        setCurrentUser(res.user);
      } catch (err) {
        // No valid session, clear token and reset state
        await api.logout().catch(() => {});
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    }
    checkSession();
  }, []);

  // 2. Fetch Leads
  const fetchLeads = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingLeads(true);
    try {
      const res = await api.getLeads();
      setLeads(res.leads);
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      setIsLoadingLeads(false);
    }
  }, [currentUser]);

  const fetchPinnedComments = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getPinnedComments();
      setPinnedComments(res.comments || []);
    } catch {
      setPinnedComments([]);
    }
  }, [currentUser]);

  const handleCommentStatusUpdated = (commentId: string, newStatus: 'acknowledged' | 'done') => {
    setPinnedComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status: newStatus } : c))
    );
  };

  useEffect(() => {
    if (currentUser) {
      fetchLeads();
      fetchPinnedComments();
      api.getPotentialCustomers()
        .then((res) => setPotentialCustomersCount(res.customers?.length || 0))
        .catch(() => {});
    }
  }, [currentUser, fetchLeads, fetchPinnedComments]);

  // Request browser notification permission
  const [alertFeedbackMsg, setAlertFeedbackMsg] = useState<string | null>(null);

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setAlertFeedbackMsg('Notifications not supported by this browser.');
      setTimeout(() => setAlertFeedbackMsg(null), 4000);
      return;
    }

    // Check if inside an iframe where Notification.requestPermission() is blocked
    const isInIframe = window.self !== window.top;

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        setAlertFeedbackMsg('Desktop alerts enabled!');
        try {
          new Notification('Voxel: Alerts Enabled', {
            body: 'You will receive notifications here when a lead follow-up is due.',
            icon: '/favicon.ico',
          });
        } catch {
          // ignore popup errors
        }
      } else if (permission === 'denied') {
        setAlertFeedbackMsg('Alerts blocked in browser settings.');
      } else {
        if (isInIframe) {
          setAlertFeedbackMsg('Open in new tab to enable browser alerts.');
        } else {
          setAlertFeedbackMsg('Alert prompt dismissed.');
        }
      }
    } catch (err) {
      console.warn('Notification permission request error', err);
      if (isInIframe) {
        setAlertFeedbackMsg('Open in new tab to enable browser alerts.');
      } else {
        setAlertFeedbackMsg('Could not request notification permission.');
      }
    }
    setTimeout(() => setAlertFeedbackMsg(null), 4500);
  };

  // Logout handler
  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentView('active');
    setIsAdminModalOpen(false);
    setIsProfileModalOpen(false);
    setActiveCallModalLead(null);
    setIsNewLeadModalOpen(false);
    setSelectedDetailLead(null);
  };

  // Toggle priority handler
  const handleTogglePriority = async (lead: Lead) => {
    const newPriority: Priority = lead.priority === 'High' ? 'Normal' : 'High';
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, priority: newPriority } : l))
    );
    if (selectedDetailLead?.id === lead.id) {
      setSelectedDetailLead((prev) => (prev ? { ...prev, priority: newPriority } : null));
    }

    try {
      await api.updateLead(lead.id, { priority: newPriority });
    } catch (err) {
      console.error('Failed to update priority', err);
      fetchLeads();
    }
  };

  // Update lead details
  const handleUpdateLead = async (id: string, data: Partial<Lead>) => {
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...data, updated_at: new Date().toISOString() } : l))
    );
    if (selectedDetailLead?.id === id) {
      setSelectedDetailLead((prev) => (prev ? { ...prev, ...data } : null));
    }

    try {
      const res = await api.updateLead(id, data);
      setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
      if (selectedDetailLead?.id === id) {
        setSelectedDetailLead(res.lead);
      }
    } catch (err) {
      console.error('Failed to update lead', err);
      fetchLeads();
      throw err;
    }
  };

  // Log Call Attempt with instant optimistic UI
  const handleSaveCall = async (callData: {
    outcome_tag: OutcomeTag;
    summary: string;
    full_notes: string;
    next_action_at?: string | null;
    business_info?: string;
    priority?: Priority;
  }) => {
    if (!activeCallModalLead) return;
    const targetId = activeCallModalLead.id;
    const nowIso = new Date().toISOString();

    // Optimistic update
    const optimisticLog = {
      id: 'call_opt_' + Date.now(),
      timestamp: nowIso,
      summary: callData.summary,
      full_notes: callData.full_notes,
      outcome_tag: callData.outcome_tag,
      business_info: callData.business_info,
      logged_by: currentUser?.email,
    };

    let newStatus = activeCallModalLead.status;
    let newArchivedAt = activeCallModalLead.archived_at;
    let newNextAction = callData.next_action_at;

    if (callData.outcome_tag === 'Closed/Matured') {
      newStatus = 'Matured (Closed)';
      newNextAction = null;
    } else if (callData.outcome_tag === 'Service Denied') {
      newStatus = 'Service Denied';
      newNextAction = null;
      newArchivedAt = nowIso;
    } else if (callData.next_action_at) {
      newStatus = 'Follow-up Scheduled';
    }

    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== targetId) return l;
        return {
          ...l,
          status: newStatus,
          priority: callData.priority || l.priority,
          next_action_at: newNextAction || null,
          archived_at: newArchivedAt,
          updated_at: nowIso,
          call_logs: [optimisticLog, ...l.call_logs],
        };
      })
    );

    // Also update detail drawer if open
    if (selectedDetailLead?.id === targetId) {
      setSelectedDetailLead((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              priority: callData.priority || prev.priority,
              next_action_at: newNextAction || null,
              archived_at: newArchivedAt,
              updated_at: nowIso,
              call_logs: [optimisticLog, ...prev.call_logs],
            }
          : null
      );
    }

    // Dismiss any active due alert for this lead
    if (dueAlertLead?.id === targetId) {
      setDueAlertLead(null);
    }

    try {
      const res = await api.logCall(targetId, callData);
      setLeads((prev) => prev.map((l) => (l.id === targetId ? res.lead : l)));
      if (selectedDetailLead?.id === targetId) {
        setSelectedDetailLead(res.lead);
      }
    } catch (err) {
      console.error('Failed to save call', err);
      fetchLeads();
      throw err;
    }
  };

  // Add new lead
  const handleCreateLead = async (leadData: {
    phone: string;
    name: string;
    business_notes: string;
    source: string;
    priority: Priority;
  }) => {
    try {
      const res = await api.createLead(leadData);
      setLeads((prev) => [res.lead, ...prev]);
      setCurrentView('active');
    } catch (err) {
      console.error('Failed to create lead', err);
      throw err;
    }
  };

  // Archive or unarchive lead
  const handleArchiveLead = async (id: string, archive: boolean, reason?: string) => {
    try {
      const res = await api.archiveLead(id, archive, reason);
      setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
      if (selectedDetailLead?.id === id) {
        setSelectedDetailLead(res.lead);
      }
    } catch (err) {
      console.error('Failed to archive lead', err);
      fetchLeads();
    }
  };

  // Categorize leads for dashboard views
  const {
    activeLeads,
    closedLeads,
    archivedLeads,
    dueNowLeads,
    staleLeads,
  } = useMemo(() => {
    const active: Lead[] = [];
    const closed: Lead[] = [];
    const archived: Lead[] = [];
    const dueNow: Lead[] = [];
    const stale: Lead[] = [];

    leads.forEach((l) => {
      if (l.status === 'Matured (Closed)') {
        closed.push(l);
      } else if (l.status === 'Service Denied' || l.status === 'Archived') {
        archived.push(l);
      } else {
        // Active & Follow-up Scheduled
        active.push(l);

        if (isDueNowOrOverdue(l.next_action_at)) {
          dueNow.push(l);
        } else if (isStaleLead(l)) {
          stale.push(l);
        }
      }
    });

    // Requirement:
    // "List/card view of all ACTIVE leads, sorted by priority first, then most recently updated/added on top ('latest stay on top')."
    active.sort((a, b) => {
      // 1. Priority: High first
      if (a.priority === 'High' && b.priority !== 'High') return -1;
      if (a.priority !== 'High' && b.priority === 'High') return 1;
      // 2. Latest stay on top (most recently updated/added)
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });

    return {
      activeLeads: active,
      closedLeads: closed,
      archivedLeads: archived,
      dueNowLeads: dueNow,
      staleLeads: stale,
    };
  }, [leads]);

  // Filtered active leads for main list
  const filteredActiveLeads = useMemo(() => {
    return activeLeads.filter((lead) => {
      if (priorityOnly && lead.priority !== 'High') return false;
      if (outcomeFilter !== 'all') {
        const lastOutcome = lead.call_logs?.[0]?.outcome_tag;
        if (lastOutcome !== outcomeFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.business_notes.toLowerCase().includes(q) ||
        (lead.business_info && lead.business_info.toLowerCase().includes(q))
      );
    });
  }, [activeLeads, searchQuery, outcomeFilter, priorityOnly]);

  const existingPhoneNumbers = useMemo(() => leads.map((l) => l.phone), [leads]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center animate-bounce">
            <PhoneCall className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-stone-500 font-mono tracking-wider uppercase">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col font-sans">
      {/* Background Follow-up Reminder Dispatcher */}
      <ReminderManager
        leads={leads}
        currentUser={currentUser}
        notificationPermission={notificationPermission}
        onDueReminder={(lead) => setDueAlertLead(lead)}
      />

      {/* Login Screen Modal if unauthenticated */}
      {!currentUser && (
        <LoginModal
          onSuccess={(user) => {
            setCurrentUser(user);
          }}
        />
      )}

      {/* Main App Layout */}
      {currentUser && (
        <div className="flex min-h-screen">
          {/* Collapsible Left Sidebar */}
          <Sidebar
            currentView={currentView}
            onSelectView={(v) => setCurrentView(v)}
            activeLeadsCount={activeLeads.length}
            allLeadsCount={leads.length}
            closedLeadsCount={closedLeads.length}
            archivedLeadsCount={archivedLeads.length}
            potentialCustomersCount={potentialCustomersCount}
            dueNowCount={dueNowLeads.length}
            pendingDirectivesCount={pinnedComments.filter((c) => c.status !== 'done').length}
            user={currentUser}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenAdminSettings={() => setIsAdminModalOpen(true)}
            onOpenPushModal={() => setIsPushModalOpen(true)}
            onLogout={handleLogout}
            isMobileOpen={isMobileSidebarOpen}
            setIsMobileOpen={setIsMobileSidebarOpen}
            isPinned={isSidebarPinned}
            onTogglePin={handleToggleSidebarPin}
          />

          {/* Main Content Area (adapts to sidebar width on desktop) */}
          <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out
              ${isSidebarPinned ? 'lg:pl-64' : 'lg:pl-18'}
            `}
          >
            {/* Top Content Bar: Mobile Hamburger, View Heading, Alerts Toggle & Prominent + New Lead Button */}
            <header className="sticky top-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-sm border-b border-stone-200/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Hamburger Trigger */}
                <button
                  id="mobile-sidebar-toggle-btn"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  title="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-stone-900 truncate">
                      {currentView === 'active' && 'Active Call Pipeline'}
                      {currentView === 'all-leads' && 'All Leads Directory'}
                      {currentView === 'closed' && 'Closed Deals & Matured Leads'}
                      {currentView === 'archive' && 'Archived & Denied Leads'}
                      {currentView === 'potential-customers' && 'Potential Customers Directory'}
                      {currentView === 'manager' && 'Group Manager Oversight & Command'}
                      {currentView === 'directives' && 'Assigned Directives & Tasks Ledger'}
                      {currentView === 'newsletter' && 'Newsletter & Email Dispatch'}
                    </h1>
                    {currentView === 'active' && dueNowLeads.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>{dueNowLeads.length} Due</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 hidden sm:block truncate">
                    {currentView === 'active' && `${activeLeads.length} active prospects • ${dueNowLeads.length} follow-ups due now`}
                    {currentView === 'all-leads' && `Complete ledger of all ${leads.length} leads across all stages`}
                    {currentView === 'closed' && `${closedLeads.length} accounts closed and matured`}
                    {currentView === 'archive' && `${archivedLeads.length} leads removed from active pipeline`}
                    {currentView === 'potential-customers' && `${potentialCustomersCount} prospect inquiries & product interests recorded`}
                    {currentView === 'manager' && 'Supervision, integrity metrics, lead reassignment & team directives'}
                    {currentView === 'directives' && 'Track directives you wrote on leads and check agent completion status'}
                    {currentView === 'newsletter' && 'Email campaigns powered by Resend API integration'}
                  </p>
                </div>
              </div>

              {/* Right actions: Alerts Toggle & Prominent + New Lead Button */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Browser & Push Notification Status / Modal Trigger */}
                {alertFeedbackMsg ? (
                  <span className="text-[11px] font-medium text-amber-900 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
                    {alertFeedbackMsg}
                  </span>
                ) : isPushActive || notificationPermission === 'granted' ? (
                  <button
                    id="push-alerts-active-btn"
                    onClick={() => setIsPushModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Lock-screen push alerts are active on this device. Tap to test or manage."
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">Push Alerts Active</span>
                    <span className="sm:hidden">Alerts On</span>
                  </button>
                ) : (
                  <button
                    id="enable-browser-alerts-btn"
                    onClick={() => setIsPushModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    title="Enable lock-screen mobile & web push alerts"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
                    <span className="hidden sm:inline">Enable Push Alerts</span>
                    <span className="sm:hidden">Push Alerts</span>
                  </button>
                )}

                {/* Prominent + New Lead Button */}
                <button
                  id="primary-add-lead-btn"
                  onClick={() => setIsNewLeadModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Lead</span>
                </button>
              </div>
            </header>

            {/* In-app Due Follow-up Banner Alert */}
            {dueAlertLead && (
              <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-medium">
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-pulse shrink-0" />
                    <span>
                      <strong>Follow-up Due Right Now:</strong> {dueAlertLead.name} ({dueAlertLead.phone})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${dueAlertLead.phone}`}
                      className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 rounded-md text-white text-xs font-bold transition-colors"
                    >
                      Dial Lead
                    </a>
                    <button
                      onClick={() => {
                        setActiveCallModalLead(dueAlertLead);
                      }}
                      className="px-2.5 py-1 bg-white text-amber-900 hover:bg-amber-50 rounded-md text-xs font-bold transition-colors cursor-pointer"
                    >
                      Log Outcome
                    </button>
                    <button
                      onClick={() => setDueAlertLead(null)}
                      className="p-1 text-amber-200 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Body */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 sm:pb-8">
            {/* VIEW 1: ACTIVE LEADS DASHBOARD (DEFAULT VIEW) */}
            {currentView === 'active' && (
              <div className="space-y-6">
                {/* 1. DUE TODAY / OVERDUE SECTION (Pops to the top) */}
                <DueTodaySection
                  leads={dueNowLeads}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                />

                {/* 2. STALE — CHECK BACK IN REMINDER SECTION */}
                <StaleLeadsSection
                  leads={staleLeads}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                />

                {/* 3. ACTIVE LEADS PIPELINE HEADER & CONTROLS */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-stone-900">
                        Active Call Pipeline ({activeLeads.length})
                      </h2>
                      <p className="text-xs text-stone-500">
                        Prioritized list of daily cold leads. High priority and latest touches stay on top.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Priority toggle button */}
                      <button
                        id="filter-priority-btn"
                        onClick={() => setPriorityOnly(!priorityOnly)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          priorityOnly
                            ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <Flame className={`w-3.5 h-3.5 ${priorityOnly ? 'text-amber-600' : 'text-stone-400'}`} />
                        <span>High Priority Only</span>
                      </button>

                      {/* Refresh button */}
                      <button
                        onClick={fetchLeads}
                        disabled={isLoadingLeads}
                        title="Refresh leads"
                        className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeads ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Search and Outcome Filter Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="sm:col-span-2 relative">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="leads-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search leads by name, phone, notes, or business details..."
                        className="w-full pl-10 pr-4 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                      />
                    </div>

                    <div>
                      <select
                        id="leads-outcome-filter"
                        value={outcomeFilter}
                        onChange={(e) => setOutcomeFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-700 text-xs focus:outline-hidden cursor-pointer"
                      >
                        <option value="all">All Outcome Tags</option>
                        <option value="Interested">Interested</option>
                        <option value="Call Back Later">Call Back Later</option>
                        <option value="Busy">Line Busy</option>
                        <option value="Couldn't Connect">Couldn't Connect</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. ACTIVE LEADS CARDS LIST */}
                {filteredActiveLeads.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-200">
                    <PhoneCall className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-800">No active leads match</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                      {searchQuery || priorityOnly || outcomeFilter !== 'all'
                        ? 'Try clearing your search query or filters.'
                        : 'Your active dial list is empty. Click "New Lead" to add ~10 daily targets.'}
                    </p>
                    <button
                      onClick={() => setIsNewLeadModalOpen(true)}
                      className="mt-4 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      + Add New Cold Lead
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {filteredActiveLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        currentUser={currentUser}
                        pinnedComments={pinnedComments.filter((c) => c.lead_id === lead.id)}
                        onCommentStatusUpdated={handleCommentStatusUpdated}
                        onLogCall={(l) => setActiveCallModalLead(l)}
                        onOpenDetail={(l) => setSelectedDetailLead(l)}
                        onTogglePriority={(l) => handleTogglePriority(l)}
                      />
                    ))}
                  </div>
                )}

                {/* Smooth Sticky Note Attached & Docking Indicator Layer */}
                <StickyDirectiveFloatingLayer
                  pinnedComments={pinnedComments}
                  currentUser={currentUser}
                  onStatusUpdated={handleCommentStatusUpdated}
                />
              </div>
            )}

              {/* VIEW 2: NEW ALL LEADS DIRECTORY */}
              {currentView === 'all-leads' && (
                <AllLeadsView
                  leads={leads}
                  currentUser={currentUser}
                  pinnedComments={pinnedComments}
                  onCommentStatusUpdated={handleCommentStatusUpdated}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                  onTogglePriority={(lead) => handleTogglePriority(lead)}
                  onOpenNewLeadModal={() => setIsNewLeadModalOpen(true)}
                />
              )}

              {/* VIEW 3: CLOSED DEALS VIEW */}
              {currentView === 'closed' && (
                <ClosedDealsView
                  leads={closedLeads}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                />
              )}

              {/* VIEW 4: ARCHIVE & SERVICE DENIED VIEW */}
              {currentView === 'archive' && (
                <ArchiveView
                  leads={archivedLeads}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                  onRestoreLead={(id) => handleArchiveLead(id, false)}
                />
              )}

              {/* VIEW 5: POTENTIAL CUSTOMERS DIRECTORY */}
              {currentView === 'potential-customers' && (
                <PotentialCustomersView
                  currentUser={currentUser}
                  onCustomerCreated={() => {
                    setPotentialCustomersCount((prev) => prev + 1);
                  }}
                />
              )}

              {/* VIEW 6: GROUP MANAGER DASHBOARD & ASSIGNED DIRECTIVES */}
              {(currentView === 'manager' || currentView === 'directives') && (currentUser.role === 'manager' || currentUser.role === 'admin') && (
                <ManagerDashboardView
                  currentUser={currentUser}
                  leads={leads}
                  initialTab={currentView === 'directives' ? 'directives' : 'team'}
                  onLeadUpdated={(updatedLead) => {
                    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
                    if (selectedDetailLead?.id === updatedLead.id) {
                      setSelectedDetailLead(updatedLead);
                    }
                  }}
                  onSelectLead={(lead) => setSelectedDetailLead(lead)}
                  onOpenLeadDetail={(lead) => setSelectedDetailLead(lead)}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onTogglePriority={handleTogglePriority}
                />
              )}

              {/* VIEW 7: NEWSLETTER DISPATCH */}
              {currentView === 'newsletter' && (currentUser.role === 'manager' || currentUser.role === 'admin') && (
                <NewsletterView currentUser={currentUser} />
              )}
            </main>

            {/* Mobile Bottom Navigation Bar (Visible exclusively on mobile screens) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md border-t border-stone-200/90 px-3 py-1.5 flex items-center justify-around shadow-lg">
              <button
                id="mobile-nav-pipeline-btn"
                onClick={() => {
                  setCurrentView('active');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                  currentView === 'active' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <PhoneCall className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Pipeline</span>
              </button>

              <button
                id="mobile-nav-due-btn"
                onClick={() => {
                  setCurrentView('active');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                  dueNowLeads.length > 0 ? 'text-amber-900 font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Clock className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Due ({dueNowLeads.length})</span>
                {dueNowLeads.length > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                )}
              </button>

              {/* Quick Center Add Button */}
              <button
                id="mobile-nav-add-btn"
                onClick={() => setIsNewLeadModalOpen(true)}
                className="flex items-center justify-center -mt-5 w-12 h-12 rounded-full bg-amber-700 hover:bg-amber-800 text-white shadow-md active:scale-95 transition-all cursor-pointer border-2 border-white"
                title="Add New Lead"
              >
                <Plus className="w-6 h-6" />
              </button>

              <button
                id="mobile-nav-all-leads-btn"
                onClick={() => {
                  setCurrentView('all-leads');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                  currentView === 'all-leads' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Users className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">All Leads</span>
              </button>

              <button
                id="mobile-nav-menu-btn"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer text-stone-500 hover:text-stone-800"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Menu</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {currentUser && isProfileModalOpen && (
        <ProfileModal
          user={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onUserUpdated={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* ADMIN SETTINGS MODAL */}
      {currentUser && currentUser.role === 'admin' && isAdminModalOpen && (
        <AdminSettingsModal
          currentUser={currentUser}
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onDataFlushed={() => {
            fetchLeads();
            fetchPinnedComments();
          }}
          isModal={true}
        />
      )}

      {/* QUICK LOG CALL MODAL */}
      {activeCallModalLead && (
        <LogCallModal
          lead={activeCallModalLead}
          isOpen={Boolean(activeCallModalLead)}
          onClose={() => setActiveCallModalLead(null)}
          onSave={handleSaveCall}
        />
      )}

      {/* NEW LEAD MODAL */}
      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        existingPhones={existingPhoneNumbers}
        onSubmit={handleCreateLead}
      />

      {/* LEAD DETAIL SLIDE-OVER DRAWER */}
      <LeadDetailDrawer
        lead={selectedDetailLead}
        isOpen={Boolean(selectedDetailLead)}
        onClose={() => setSelectedDetailLead(null)}
        onLogCall={(lead) => setActiveCallModalLead(lead)}
        onUpdateLead={handleUpdateLead}
        onArchiveLead={handleArchiveLead}
        currentUser={currentUser}
        onOpenReassign={(lead) => {
          setLeadToReassign(lead);
          setIsReassignModalOpen(true);
        }}
      />

      {/* REASSIGN LEAD MODAL (Available throughout app for Managers & Admins) */}
      {currentUser && (
        <ReassignLeadModal
          isOpen={isReassignModalOpen}
          onClose={() => {
            setIsReassignModalOpen(false);
            setLeadToReassign(null);
          }}
          lead={leadToReassign}
          currentUser={currentUser}
          onReassigned={(updatedLead) => {
            setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
            if (selectedDetailLead?.id === updatedLead.id) {
              setSelectedDetailLead(updatedLead);
            }
          }}
        />
      )}

      {/* WEB & MOBILE PUSH NOTIFICATION MODAL */}
      <PushNotificationModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        onSubscribedChange={(active) => setIsPushActive(active)}
      />
    </div>
  );
}
