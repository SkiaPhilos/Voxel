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
  FileSpreadsheet,
  MessageCircle,
  Sparkles,
  ArrowUpRight,
  Target,
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
import { CsvImportWizardModal } from './components/CsvImportWizardModal';
import { PowerDialerModal } from './components/PowerDialerModal';
import { StickyDirectiveFloatingLayer } from './components/StickyDirectiveIndicator';
import { AssignedDirectivesView } from './components/AssignedDirectivesView';
import { AskAssistanceView } from './components/AskAssistanceView';
import { AskAssistanceModal } from './components/AskAssistanceModal';
import { LeadQAModal } from './components/LeadQAModal';
import { CollectedDataView } from './components/CollectedDataView';
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
  const [whatsappOnly, setWhatsappOnly] = useState(false);

  // Modals & Panels
  const [activeCallModalLead, setActiveCallModalLead] = useState<Lead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [selectedDetailLead, setSelectedDetailLead] = useState<Lead | null>(null);
  const [leadToReassign, setLeadToReassign] = useState<Lead | null>(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isPushActive, setIsPushActive] = useState(false);

  // Assistance Tickets state
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [isAskAssistanceModalOpen, setIsAskAssistanceModalOpen] = useState(false);
  const [assistanceModalLead, setAssistanceModalLead] = useState<Lead | null>(null);

  // Lead Qualification Q&A Modal state
  const [qaModalLead, setQaModalLead] = useState<Lead | null>(null);

  // Power Dialer state
  const [isPowerDialerOpen, setIsPowerDialerOpen] = useState(false);
  const [powerDialerQueue, setPowerDialerQueue] = useState<Lead[]>([]);
  const [powerDialerTitle, setPowerDialerTitle] = useState('Calling Queue');

  // Browser Notification state safely initialized for mobile devices & PWAs
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && typeof Notification?.permission === 'string') {
        return Notification.permission;
      }
    } catch {
      // Ignored for restricted mobile webviews / iOS Safari
    }
    return 'default';
  });

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
  const fetchLeads = useCallback(async (isSilentParam?: boolean | React.MouseEvent) => {
    const isSilent = typeof isSilentParam === 'boolean' ? isSilentParam : false;
    if (!currentUser) return;
    if (!isSilent) setIsLoadingLeads(true);
    try {
      const res = await api.getLeads();
      setLeads(res.leads);
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      if (!isSilent) setIsLoadingLeads(false);
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

  const fetchPendingTickets = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getAssistanceTickets({ status: 'pending', scope: 'all' });
      const count = (res.tickets || []).filter(
        (t) =>
          t.requested_by_id !== currentUser.id &&
          (!t.target_agent_id || t.target_agent_id === currentUser.id || t.target_agent_id === currentUser.email)
      ).length;
      setPendingTicketsCount(count);
    } catch {
      setPendingTicketsCount(0);
    }
  }, [currentUser]);

  // Non-aggressive 2-minute auto-refresh poll so new incoming WhatsApp leads and updates appear automatically without manual refresh
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      fetchLeads(true);
      fetchPinnedComments();
      fetchPendingTickets();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [currentUser, fetchLeads, fetchPinnedComments, fetchPendingTickets]);

  const handleCommentStatusUpdated = (commentId: string, newStatus: 'acknowledged' | 'done') => {
    setPinnedComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status: newStatus } : c))
    );
  };

  useEffect(() => {
    if (currentUser) {
      fetchLeads();
      fetchPinnedComments();
      fetchPendingTickets();
      api.getPotentialCustomers()
        .then((res) => setPotentialCustomersCount(res.customers?.length || 0))
        .catch(() => {});

      api.getColleagues()
        .then((res) => {
          if (res.colleagues && res.colleagues.length > 0) {
            setTeamMembers(res.colleagues);
          }
        })
        .catch(() => {
          if (currentUser.role === 'admin' || currentUser.role === 'manager') {
            api.getManagerTeam()
              .then((res) => setTeamMembers(res.teamMembers || res.team || []))
              .catch(() => setTeamMembers([currentUser]));
          } else {
            setTeamMembers([currentUser]);
          }
        });
    }
  }, [currentUser, fetchLeads, fetchPinnedComments, fetchPendingTickets]);

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
    audio_url?: string | null;
    audio_duration?: number | null;
    audio_name?: string | null;
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
      audio_url: callData.audio_url || undefined,
      audio_duration: callData.audio_duration || undefined,
      audio_name: callData.audio_name || undefined,
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

  // Launch Power Dialer rapid calling session
  const handleStartPowerDialer = (leadsToCall: Lead[], title: string = 'Calling Queue') => {
    if (!leadsToCall || leadsToCall.length === 0) return;
    setPowerDialerQueue(leadsToCall);
    setPowerDialerTitle(title);
    setIsPowerDialerOpen(true);
  };

  // Dedicated call logger for Power Dialer session
  const handleSaveCallFromDialer = async (
    targetId: string,
    callData: {
      outcome_tag: OutcomeTag;
      summary: string;
      full_notes: string;
      next_action_at?: string | null;
      business_info?: string;
      priority?: Priority;
      audio_url?: string | null;
      audio_duration?: number | null;
      audio_name?: string | null;
    }
  ) => {
    const targetLead = leads.find((l) => l.id === targetId);
    const nowIso = new Date().toISOString();

    const optimisticLog = {
      id: 'call_opt_' + Date.now(),
      timestamp: nowIso,
      summary: callData.summary,
      full_notes: callData.full_notes,
      outcome_tag: callData.outcome_tag,
      business_info: callData.business_info,
      logged_by: currentUser?.email,
      audio_url: callData.audio_url || undefined,
      audio_duration: callData.audio_duration || undefined,
      audio_name: callData.audio_name || undefined,
    };

    let newStatus = targetLead ? targetLead.status : 'Follow-up Scheduled';
    let newArchivedAt = targetLead ? targetLead.archived_at : undefined;
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
      console.error('Failed to log call in dialer', err);
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

  // Open Lead Qualification Q&A Sets modal
  const handleOpenQA = (lead: Lead) => {
    setQaModalLead(lead);
  };

  // Called when LeadQAModal saves updated qualification sets
  const handleQASaveSuccess = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    if (selectedDetailLead?.id === updatedLead.id) {
      setSelectedDetailLead(updatedLead);
    }
    setQaModalLead(null);
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

  const collectedDataCount = useMemo(() => {
    return leads.filter((l) => l.qa_data && Object.keys(l.qa_data).length > 0).length;
  }, [leads]);

  // Filtered active leads for main list
  const filteredActiveLeads = useMemo(() => {
    return activeLeads.filter((lead) => {
      if (priorityOnly && lead.priority !== 'High') return false;
      if (whatsappOnly) {
        const isWhatsApp =
          lead.source === 'WhatsApp Inbound' ||
          lead.business_notes?.toLowerCase().includes('whatsapp') ||
          (lead.business_info && lead.business_info.toLowerCase().includes('whatsapp')) ||
          (lead.business_info && lead.business_info.toLowerCase().includes('screenshot')) ||
          lead.call_logs?.some(
            (l) =>
              l.summary?.toLowerCase().includes('whatsapp') ||
              l.full_notes?.toLowerCase().includes('whatsapp')
          );
        if (!isWhatsApp) return false;
      }
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
  }, [activeLeads, searchQuery, outcomeFilter, priorityOnly, whatsappOnly]);

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
            collectedDataCount={collectedDataCount}
            closedLeadsCount={closedLeads.length}
            archivedLeadsCount={archivedLeads.length}
            potentialCustomersCount={potentialCustomersCount}
            dueNowCount={dueNowLeads.length}
            pendingDirectivesCount={pinnedComments.filter((c) => c.status !== 'done').length}
            pendingTicketsCount={pendingTicketsCount}
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
            <header className="sticky top-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-sm border-b border-stone-200/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {/* Mobile Hamburger Trigger */}
                <button
                  id="mobile-sidebar-toggle-btn"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer shrink-0"
                  title="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-stone-900 truncate">
                      {currentView === 'active' && 'Active Call Pipeline'}
                      {currentView === 'all-leads' && 'All Leads Directory'}
                      {currentView === 'collected-data' && 'Collected Data & Lead Q&A'}
                      {currentView === 'closed' && 'Closed Deals & Matured Leads'}
                      {currentView === 'archive' && 'Archived & Denied Leads'}
                      {currentView === 'potential-customers' && 'Potential Customers Directory'}
                      {currentView === 'manager' && 'Group Manager Oversight & Command'}
                      {currentView === 'directives' && 'Tickets & Directives Ledger'}
                      {currentView === 'ask-assistance' && 'Request Help & Assistance'}
                      {currentView === 'newsletter' && 'Newsletter & Email Dispatch'}
                    </h1>
                    {currentView === 'active' && dueNowLeads.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse shrink-0">
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
                    {currentView === 'directives' && 'Directives on leads and takeover tickets from fellow agents'}
                    {currentView === 'ask-assistance' && 'Request a colleague to take over a lead or assist with outreach'}
                    {currentView === 'newsletter' && 'Email campaigns powered by Resend API integration'}
                  </p>
                </div>
              </div>

              {/* Right actions: Alerts Toggle & Prominent + New Lead Button */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                {/* Browser & Push Notification Status / Modal Trigger */}
                {alertFeedbackMsg ? (
                  <span className="text-[11px] font-medium text-amber-900 bg-amber-100/90 border border-amber-300/80 px-2 py-1 rounded-lg animate-in fade-in duration-150 truncate max-w-[120px] sm:max-w-none">
                    {alertFeedbackMsg}
                  </span>
                ) : isPushActive || notificationPermission === 'granted' ? (
                  <button
                    id="push-alerts-active-btn"
                    onClick={() => setIsPushModalOpen(true)}
                    className="flex items-center justify-center p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Lock-screen push alerts are active on this device. Tap to test or manage."
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden md:inline ml-1.5">Push Alerts Active</span>
                    <span className="hidden sm:inline md:hidden ml-1.5">Alerts On</span>
                  </button>
                ) : (
                  <button
                    id="enable-browser-alerts-btn"
                    onClick={() => setIsPushModalOpen(true)}
                    className="flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    title="Enable lock-screen mobile & web push alerts"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
                    <span className="hidden sm:inline ml-1.5">Push Alerts</span>
                  </button>
                )}

                {/* Power Dialer Header Quick Trigger (desktop/tablet; on mobile reps have it inside pipeline card) */}
                <button
                  id="header-power-dialer-btn"
                  onClick={() =>
                    handleStartPowerDialer(
                      dueNowLeads.length > 0 ? dueNowLeads : filteredActiveLeads,
                      dueNowLeads.length > 0 ? 'Due Today Calling Session' : 'Active Pipeline Calling Session'
                    )
                  }
                  disabled={filteredActiveLeads.length === 0 && dueNowLeads.length === 0}
                  title="Launch rapid continuous calling mode"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                  <span>Power Dialer</span>
                </button>

                {/* Import CSV Button */}
                <button
                  id="header-import-csv-btn"
                  onClick={() => setIsCsvImportModalOpen(true)}
                  title="Bulk import leads from CSV spreadsheet"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
                  <span>Import CSV</span>
                </button>

                {/* Prominent + New Lead Button */}
                <button
                  id="primary-add-lead-btn"
                  onClick={() => setIsNewLeadModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title="Create a new Lead"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden xs:inline">New Lead</span>
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
                  onStartPowerDialer={(leads) => handleStartPowerDialer(leads, 'Due Today Calling Session')}
                />

                {/* 2. STALE — CHECK BACK IN REMINDER SECTION */}
                <StaleLeadsSection
                  leads={staleLeads}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                  onStartPowerDialer={(leads) => handleStartPowerDialer(leads, 'Stale Leads Follow-Up')}
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
                      {/* Power Dialer Start Button */}
                      <button
                        id="start-pipeline-power-dialer-btn"
                        onClick={() => handleStartPowerDialer(filteredActiveLeads, 'Active Pipeline Calling Session')}
                        disabled={filteredActiveLeads.length === 0}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        title="Launch continuous rapid calling mode for this list"
                      >
                        <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                        <span>Power Dialer ({filteredActiveLeads.length})</span>
                      </button>

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
                        <span>High Priority</span>
                      </button>

                      {/* WhatsApp Inbound filter button */}
                      <button
                        id="filter-whatsapp-btn"
                        onClick={() => setWhatsappOnly(!whatsappOnly)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          whatsappOnly
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                        title="Filter leads originating from WhatsApp Inbound or with inbound messages"
                      >
                        <MessageCircle className={`w-3.5 h-3.5 ${whatsappOnly ? 'text-emerald-700 fill-emerald-600/30' : 'text-stone-400'}`} />
                        <span>WhatsApp</span>
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
                  searchQuery || priorityOnly || whatsappOnly || outcomeFilter !== 'all' ? (
                    /* Filtered out empty state */
                    <div className="p-10 text-center bg-white rounded-2xl border border-stone-200 shadow-2xs">
                      <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
                        <Search className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-stone-800">No leads match your active filters</h3>
                      <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        Try adjusting your search keywords, priority toggle, or outcome filters to see other prospects.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setPriorityOnly(false);
                          setWhatsappOnly(false);
                          setOutcomeFilter('all');
                        }}
                        className="mt-4 px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    /* Engaging 'Get Started' Hero Graphic & Prompt */
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-stone-50 border border-amber-200/80 p-6 sm:p-10 text-center shadow-xs">
                      {/* Decorative ambient elements */}
                      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 rounded-full bg-orange-400/10 blur-2xl pointer-events-none" />

                      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
                        {/* High-Fidelity Custom Illustrative SVG Graphic */}
                        <div className="relative mb-6">
                          <svg
                            className="w-48 sm:w-56 h-auto drop-shadow-sm select-none"
                            viewBox="0 0 320 220"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <defs>
                              <linearGradient id="warmBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FEF3C7" />
                                <stop offset="100%" stopColor="#FDE68A" />
                              </linearGradient>
                              <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#FFFFFF" />
                                <stop offset="100%" stopColor="#F9FAFB" />
                              </linearGradient>
                              <linearGradient id="radarWave" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#B45309" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#D97706" stopOpacity="0.02" />
                              </linearGradient>
                              <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
                                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#78350F" floodOpacity="0.08" />
                              </filter>
                            </defs>

                            {/* Outer radar / outreach ripples */}
                            <circle cx="160" cy="110" r="95" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.7" />
                            <circle cx="160" cy="110" r="75" fill="url(#radarWave)" />
                            <circle cx="160" cy="110" r="70" stroke="#FBBF24" strokeWidth="1.5" opacity="0.6" />

                            {/* Floating mini target badge on top right */}
                            <g transform="translate(230, 30)">
                              <rect width="64" height="28" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" filter="url(#cardShadow)" />
                              <circle cx="15" cy="14" r="5" fill="#10B981" />
                              <rect x="26" y="10" width="26" height="4" rx="2" fill="#9CA3AF" />
                              <rect x="26" y="16" width="16" height="3" rx="1.5" fill="#D1D5DB" />
                            </g>

                            {/* Floating WhatsApp / Inbound inquiry notification card on left */}
                            <g transform="translate(24, 52)">
                              <rect width="76" height="36" rx="10" fill="#FFFFFF" stroke="#BBF7D0" strokeWidth="1" filter="url(#cardShadow)" />
                              <circle cx="18" cy="18" r="8" fill="#10B981" />
                              {/* WhatsApp phone/chat mark */}
                              <path d="M15 16.5C15 18 16.5 19.5 18 19.5C19 19.5 20.5 18.5 20.5 17.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                              <rect x="32" y="12" width="34" height="4" rx="2" fill="#374151" />
                              <rect x="32" y="19" width="24" height="3" rx="1.5" fill="#9CA3AF" />
                            </g>

                            {/* Central Dialing Console / Phone Tablet Base */}
                            <g filter="url(#cardShadow)">
                              <rect x="100" y="32" width="120" height="154" rx="20" fill="#1F2937" />
                              <rect x="105" y="37" width="110" height="144" rx="16" fill="url(#screenGrad)" />
                            </g>

                            {/* Speaker slit & camera */}
                            <rect x="145" y="44" width="30" height="3" rx="1.5" fill="#D1D5DB" />
                            <circle cx="182" cy="45.5" r="1.5" fill="#9CA3AF" />

                            {/* Screen Card: Pipeline Target */}
                            <g transform="translate(116, 58)">
                              <rect width="88" height="54" rx="8" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1" />
                              <circle cx="20" cy="20" r="10" fill="#B45309" />
                              {/* Head silhouette */}
                              <circle cx="20" cy="17" r="4" fill="#FFFFFF" />
                              <path d="M14 26C14 23 17 22 20 22C23 22 26 23 26 26" fill="#FFFFFF" />
                              <rect x="36" y="14" width="40" height="4" rx="2" fill="#92400E" />
                              <rect x="36" y="21" width="28" height="3" rx="1.5" fill="#D97706" />

                              {/* Progress bar */}
                              <rect x="12" y="38" width="64" height="4" rx="2" fill="#FDE68A" />
                              <rect x="12" y="38" width="40" height="4" rx="2" fill="#B45309" />
                            </g>

                            {/* Big Glowing Primary Dial CTA on screen */}
                            <g transform="translate(132, 126)">
                              <circle cx="28" cy="28" r="24" fill="#B45309" />
                              <circle cx="28" cy="28" r="28" stroke="#B45309" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
                              {/* Phone receiver icon */}
                              <path
                                d="M23.5 21C23 21 21.5 21.8 21.5 23C21.5 24.5 23 27 25 29C27 31 29.5 32.5 31 32.5C32.2 32.5 33 31 33 30.5L30.8 28.3C30.4 27.9 29.7 28 29.3 28.4L28.6 29.1C28.2 28.9 26.5 27.5 26 26.8L26.7 26.1C27.1 25.7 27.2 25 26.8 24.6L24.6 22.4C24.3 22.1 23.9 21.9 23.5 21Z"
                                fill="#FFFFFF"
                              />
                            </g>

                            {/* Decorative spark stars */}
                            <path d="M80 30L82 35L87 37L82 39L80 44L78 39L73 37L78 35L80 30Z" fill="#F59E0B" />
                            <path d="M246 160L247.5 164L251.5 165.5L247.5 167L246 171L244.5 167L240.5 165.5L244.5 164L246 160Z" fill="#F59E0B" />
                          </svg>

                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white border border-amber-300 shadow-xs flex items-center gap-1.5 text-[11px] font-bold text-amber-900 whitespace-nowrap">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
                            <span>Pipeline Ready for Calls</span>
                          </div>
                        </div>

                        {/* Heading & Subtitle */}
                        <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
                          Your Active Dial Queue is Clear
                        </h3>
                        <p className="text-xs sm:text-sm text-stone-600 mt-2 max-w-md leading-relaxed">
                          Fuel your cold call cadence. Add high-intent targets individually, or import a fresh batch of contacts from a CSV or spreadsheet to start dialing immediately.
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-6 w-full">
                          <button
                            id="empty-state-new-lead-btn"
                            onClick={() => setIsNewLeadModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer transform hover:-translate-y-0.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add First Cold Lead</span>
                          </button>

                          <button
                            id="empty-state-import-csv-btn"
                            onClick={() => setIsCsvImportModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-800 border border-stone-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                            <span>Import CSV Contacts</span>
                          </button>

                          {potentialCustomersCount > 0 && (
                            <button
                              id="empty-state-inbound-btn"
                              onClick={() => setCurrentView('potential-customers')}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-700 fill-emerald-600/30" />
                              <span>View {potentialCustomersCount} Inbound Inquiries</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Quick Tips */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-8 w-full text-left pt-6 border-t border-amber-200/60">
                          <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-stone-200/60">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] mb-0.5">
                              <Target className="w-3.5 h-3.5 text-amber-600" />
                              <span>1. Daily Targets</span>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Aim for ~10 to 15 fresh outreach dials per day to keep momentum high.
                            </p>
                          </div>

                          <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-stone-200/60">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] mb-0.5">
                              <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
                              <span>2. Power Dialer</span>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Launch rapid back-to-back dialing with in-app objection rebuttals and quick timers.
                            </p>
                          </div>

                          <div className="p-3 bg-white/70 backdrop-blur-xs rounded-xl border border-stone-200/60">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] mb-0.5">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>3. WhatsApp Follow-Up</span>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Send instant AI-personalized WhatsApp or SMS notes right after each call.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
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
                        onRequestAssistance={(l) => {
                          setAssistanceModalLead(l);
                          setIsAskAssistanceModalOpen(true);
                        }}
                        onOpenQA={handleOpenQA}
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
                  onOpenCsvImportModal={() => setIsCsvImportModalOpen(true)}
                  onRequestAssistance={(l) => {
                    setAssistanceModalLead(l);
                    setIsAskAssistanceModalOpen(true);
                  }}
                  onOpenQA={handleOpenQA}
                />
              )}

              {/* VIEW 2B: COLLECTED DATA & LEAD QUALIFICATION Q&A WORKSPACE */}
              {currentView === 'collected-data' && (
                <CollectedDataView
                  leads={leads}
                  currentUser={currentUser}
                  onOpenQA={handleOpenQA}
                  onOpenDetail={(lead) => setSelectedDetailLead(lead)}
                  onLogCall={(lead) => setActiveCallModalLead(lead)}
                  onLeadUpdated={(updatedLead) => {
                    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
                    if (selectedDetailLead?.id === updatedLead.id) {
                      setSelectedDetailLead(updatedLead);
                    }
                  }}
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

              {/* VIEW 6: GROUP MANAGER DASHBOARD (FOR MANAGERS & ADMINS) */}
              {currentView === 'manager' && (currentUser.role === 'manager' || currentUser.role === 'admin') && (
                <ManagerDashboardView
                  currentUser={currentUser}
                  leads={leads}
                  initialTab="team"
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

              {/* VIEW 6B: TICKETS & DIRECTIVES HUB (FOR ALL AGENTS, MANAGERS, ADMINS) */}
              {currentView === 'directives' && (
                <AssignedDirectivesView
                  currentUser={currentUser}
                  leads={leads}
                  teamMembers={teamMembers}
                  onSelectLead={(lead) => setSelectedDetailLead(lead)}
                  onOpenLeadDetail={(lead) => setSelectedDetailLead(lead)}
                  onLeadReassigned={(reassignedLead) => {
                    setLeads((prev) =>
                      prev.map((l) => (l.id === reassignedLead.id ? reassignedLead : l))
                    );
                    if (selectedDetailLead?.id === reassignedLead.id) {
                      setSelectedDetailLead(reassignedLead);
                    }
                    fetchPendingTickets();
                  }}
                />
              )}

              {/* VIEW 6C: ASK ASSISTANCE / ISSUE TAKEOVER TICKETS */}
              {currentView === 'ask-assistance' && (
                <AskAssistanceView
                  currentUser={currentUser}
                  leads={leads}
                  teamMembers={teamMembers}
                  onOpenNewTicketModal={(preselectedLead) => {
                    setAssistanceModalLead(preselectedLead || null);
                    setIsAskAssistanceModalOpen(true);
                  }}
                  onLeadUpdated={(updatedLead) => {
                    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
                    if (selectedDetailLead?.id === updatedLead.id) {
                      setSelectedDetailLead(updatedLead);
                    }
                  }}
                  onOpenLeadDetail={(lead) => setSelectedDetailLead(lead)}
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
      {selectedDetailLead && (
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
          onRequestAssistance={(lead) => {
            setAssistanceModalLead(lead);
            setIsAskAssistanceModalOpen(true);
          }}
          onOpenQA={handleOpenQA}
        />
      )}

      {/* LEAD QUALIFICATION Q&A MODAL POP-UP */}
      <LeadQAModal
        isOpen={Boolean(qaModalLead)}
        onClose={() => setQaModalLead(null)}
        lead={qaModalLead}
        currentUser={currentUser}
        onSaveSuccess={handleQASaveSuccess}
      />

      {/* ASK ASSISTANCE / REQUEST TAKEOVER MODAL */}
      {currentUser && (
        <AskAssistanceModal
          isOpen={isAskAssistanceModalOpen}
          onClose={() => {
            setIsAskAssistanceModalOpen(false);
            setAssistanceModalLead(null);
          }}
          currentUser={currentUser}
          initialLead={assistanceModalLead}
          availableLeads={leads}
          teamMembers={teamMembers}
          onTicketCreated={() => {
            fetchPendingTickets();
          }}
        />
      )}

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

      {/* CSV SPREADSHEET IMPORT & DEDUPLICATION WIZARD */}
      <CsvImportWizardModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        currentUser={currentUser}
        teamMembers={teamMembers}
        onImportComplete={() => {
          fetchLeads();
        }}
      />

      {/* POWER DIALER RAPID CALLING HUD */}
      {isPowerDialerOpen && powerDialerQueue.length > 0 && (
        <PowerDialerModal
          isOpen={isPowerDialerOpen}
          queue={powerDialerQueue}
          queueTitle={powerDialerTitle}
          onClose={() => {
            setIsPowerDialerOpen(false);
            setPowerDialerQueue([]);
          }}
          onSaveCall={handleSaveCallFromDialer}
        />
      )}
    </div>
  );
}
