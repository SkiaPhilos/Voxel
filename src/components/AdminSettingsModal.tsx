import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  KeyRound,
  Trash2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Users,
  Send,
  X,
  Lock,
  Database,
  RefreshCw,
  BellRing,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import type { User, UserRole } from '../types';
import { api } from '../lib/api';
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  extractSubscriptionPayload,
} from '../lib/pushManager';

interface AdminSettingsModalProps {
  currentUser: User;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onDataFlushed?: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  currentUser,
  isModal = false,
  isOpen = false,
  onClose,
  onDataFlushed,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Database Connection Status
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    type: 'supabase' | 'local';
    tablesExist: boolean;
    userCount?: number;
    leadCount?: number;
    message: string;
    diagnostics?: any;
  } | null>(null);
  const [isLoadingDbStatus, setIsLoadingDbStatus] = useState(false);

  // Grant Access Form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('agent');
  const [newManagerId, setNewManagerId] = useState<string>('');
  const [selectedAgentIdsForManager, setSelectedAgentIdsForManager] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset inline state
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Test Email Notification state
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Web Push states
  const [isPushSupportedDev, setIsPushSupportedDev] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  // Flush Data state
  const [selectedUserIdsForFlush, setSelectedUserIdsForFlush] = useState<string[]>([]);
  const [isFlushConfirmOpen, setIsFlushConfirmOpen] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  // Download All Data state
  const [isDownloadingAllData, setIsDownloadingAllData] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  const handleDownloadAllData = async () => {
    setIsDownloadingAllData(true);
    setDownloadMessage(null);
    try {
      await api.downloadAllDataCsv();
      setDownloadMessage('All system data exported successfully! CSV download started.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download system data');
    } finally {
      setIsDownloadingAllData(false);
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIdsForFlush((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedUserIdsForFlush.length === users.length) {
      setSelectedUserIdsForFlush([]);
    } else {
      setSelectedUserIdsForFlush(users.map((u) => u.id));
    }
  };

  const handleFlushData = async () => {
    if (selectedUserIdsForFlush.length === 0) return;
    setIsFlushing(true);
    try {
      const res = await api.flushUserData(selectedUserIdsForFlush);
      setFlushMessage(`Successfully flushed data: ${res.deletedLeadsCount} lead(s) permanently removed.`);
      setSelectedUserIdsForFlush([]);
      setIsFlushConfirmOpen(false);
      fetchDbStatus();
      fetchUsers();
      onDataFlushed?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to flush user data');
      setIsFlushConfirmOpen(false);
    } finally {
      setIsFlushing(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchDbStatus = async () => {
    setIsLoadingDbStatus(true);
    try {
      const status = await api.getDatabaseStatus();
      setDbStatus(status);
    } catch (err: any) {
      console.error('Failed to load database status', err);
    } finally {
      setIsLoadingDbStatus(false);
    }
  };

  const checkPush = async () => {
    const supp = isPushSupported();
    setIsPushSupportedDev(supp);
    if (supp) {
      const sub = await getExistingSubscription();
      setIsPushSubscribed(Boolean(sub));
    }
  };

  useEffect(() => {
    if (!isModal || isOpen) {
      fetchUsers();
      fetchDbStatus();
      checkPush();
    }
  }, [isModal, isOpen]);

  const handleTogglePush = async () => {
    setIsUpdatingPush(true);
    setPushStatusMsg(null);
    try {
      if (isPushSubscribed) {
        const res = await unsubscribeFromPushNotifications();
        if (res.success) {
          setIsPushSubscribed(false);
          setPushStatusMsg('Push notifications disabled on this device.');
        } else {
          setPushStatusMsg(res.error || 'Failed to disable push.');
        }
      } else {
        const res = await subscribeToPushNotifications();
        if (res.success) {
          setIsPushSubscribed(true);
          setPushStatusMsg('Push notifications activated! Alerts will wake your device even with browser closed.');
        } else {
          setPushStatusMsg(res.error || 'Could not activate push notifications.');
        }
      }
    } catch (err: any) {
      setPushStatusMsg(err?.message || 'Push update failed.');
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handleTestPushAlert = async () => {
    setIsSendingTestPush(true);
    setPushStatusMsg(null);
    try {
      const sub = await getExistingSubscription();
      const payload = extractSubscriptionPayload(sub);
      const res = await api.testPushNotification(payload || sub);
      setPushStatusMsg(res.message || 'Push notification dispatched successfully!');
    } catch (err: any) {
      setPushStatusMsg(err?.message || 'Failed to dispatch push test.');
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.grantAccess({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        name: newName.trim() || undefined,
        role: newRole,
        managerId: newRole === 'agent' && newManagerId ? newManagerId : null,
      });

      // If created as manager and agents were assigned to report to this manager
      if (newRole === 'manager' && selectedAgentIdsForManager.length > 0) {
        for (const agentId of selectedAgentIdsForManager) {
          try {
            await api.updateUser(agentId, { managerId: res.user.id });
          } catch {
            // continue updating remaining
          }
        }
      }

      setSuccessMessage(
        `Credentials generated! ${res.user.email} (${res.user.role.toUpperCase()}) can now log in.`
      );
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('agent');
      setNewManagerId('');
      setSelectedAgentIdsForManager([]);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to grant access');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAccess = async (userId: string, email: string) => {
    if (!window.confirm(`Revoke access for ${email}? They will no longer be able to log in.`)) {
      return;
    }

    try {
      await api.revokeAccess(userId);
      setSuccessMessage(`Access revoked for ${email}`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke access');
    }
  };

  const handleRoleChange = async (userId: string, newRoleVal: UserRole) => {
    try {
      await api.updateUser(userId, { role: newRoleVal });
      setActionMessage(`User role updated to ${newRoleVal.toUpperCase()}.`);
      setTimeout(() => setActionMessage(null), 3500);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user role');
    }
  };

  const handleManagerChange = async (userId: string, targetManagerId: string) => {
    try {
      await api.updateUser(userId, { managerId: targetManagerId || null });
      setActionMessage('Reporting manager updated successfully.');
      setTimeout(() => setActionMessage(null), 3500);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update manager assignment');
    }
  };

  const handleSaveResetPassword = async (userId: string) => {
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setIsResetting(true);
    try {
      await api.updateUser(userId, { password: resetPasswordVal });
      setActionMessage('Password has been successfully updated/reset!');
      setResettingUserId(null);
      setResetPasswordVal('');
      setTimeout(() => setActionMessage(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleTestEmailAlert = async () => {
    setIsSendingTestEmail(true);
    setEmailStatus(null);
    try {
      const res = await api.testEmailReminder(
        'test_notification',
        'Direct Alert Verification',
        new Date(Date.now() + 10 * 60 * 1000).toISOString()
      );
      setEmailStatus(
        res.delivered
          ? `Alert dispatched to ${res.recipient}!`
          : `Dispatch logged. Configured recipient: ${res.recipient}`
      );
    } catch (err: any) {
      setEmailStatus(`Test delivery failed: ${err.message}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const managerUsers = users.filter((u) => u.role === 'manager' || u.role === 'admin');
  const agentUsers = users.filter((u) => u.role === 'agent');

  const content = (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Admin Control Panel</h2>
              <p className="text-xs text-stone-500">
                User credential provisioning, team assignment, roles &amp; notifications
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-700" />
            <span>Admin: {currentUser.name}</span>
          </span>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Database Connection & Persistence Status */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-stone-700" />
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Database &amp; Data Persistence
            </h3>
          </div>
          <button
            onClick={fetchDbStatus}
            disabled={isLoadingDbStatus}
            className="px-3 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Check database connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbStatus ? 'animate-spin' : ''}`} />
            <span>{isLoadingDbStatus ? 'Checking...' : 'Refresh Status'}</span>
          </button>
        </div>

        {dbStatus ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  dbStatus.connected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    dbStatus.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                />
                {dbStatus.connected ? 'Cloud Database: Connected' : 'Local Database Storage'}
              </span>

              <span className="text-xs px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium">
                System: Operational
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-stone-500 pt-1">
              <span>
                Active Users: <strong className="text-stone-800">{dbStatus.userCount ?? users.length}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Total Leads: <strong className="text-stone-800">{dbStatus.leadCount ?? 0}</strong>
              </span>
            </div>

            {/* System Wide Data Export */}
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download All Data</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Export complete system dataset of all users (Admins, Managers, and Agents) into a comprehensive CSV.
                </p>
              </div>
              <button
                type="button"
                id="download-all-data-db-btn"
                onClick={handleDownloadAllData}
                disabled={isDownloadingAllData}
                className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${isDownloadingAllData ? 'animate-bounce' : ''}`} />
                <span>{isDownloadingAllData ? 'Exporting CSV...' : 'Download All Data'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-400 py-2">Loading system status...</div>
        )}
      </div>

      {/* Grant Access Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-4 h-4 text-amber-700" />
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            Grant User Access (Create Login Credentials)
          </h3>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Create login credentials for Agents, Managers / SPOCs, or Administrators.
        </p>

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleGrantAccess} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="grant-email-input"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Initial Password <span className="text-rose-500">*</span>
                <span className="text-[11px] text-stone-500 font-normal ml-1.5">(min 6 characters)</span>
              </label>
              <input
                id="grant-password-input"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create secure password"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Full Name
              </label>
              <input
                id="grant-name-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Liam Parker"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                System Role <span className="text-rose-500">*</span>
              </label>
              <select
                id="grant-role-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-medium"
              >
                <option value="agent">Agent (Dialer, Active Leads &amp; Assignments)</option>
                <option value="manager">Manager / SPOC (Team Management &amp; Agent Review)</option>
                <option value="admin">Admin (Full Access &amp; Control Panel)</option>
              </select>
            </div>
          </div>

          {/* Conditional Assignment Options based on Role */}
          {newRole === 'agent' && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
              <label className="block text-xs font-semibold text-stone-800">
                Reporting Manager / SPOC (Optional)
              </label>
              <select
                value={newManagerId}
                onChange={(e) => setNewManagerId(e.target.value)}
                className="w-full sm:w-80 px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              >
                <option value="">-- None (Direct / Unassigned) --</option>
                {managerUsers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role === 'admin' ? 'Admin' : 'Manager'}) - {m.email}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-stone-500">
                Assigning a manager gives that manager full visibility to review this agent&apos;s leads and pin comments.
              </p>
            </div>
          )}

          {newRole === 'manager' && agentUsers.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
              <label className="block text-xs font-semibold text-amber-950">
                Assign Agents to Report to this Manager (Optional)
              </label>
              <p className="text-[11px] text-amber-800">
                Select existing agents who will be placed on this manager&apos;s team:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-40 overflow-y-auto">
                {agentUsers.map((a) => {
                  const isChecked = selectedAgentIdsForManager.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white border border-stone-200 text-xs cursor-pointer hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgentIdsForManager((prev) => [...prev, a.id]);
                          } else {
                            setSelectedAgentIdsForManager((prev) => prev.filter((id) => id !== a.id));
                          }
                        }}
                        className="rounded text-amber-700 focus:ring-amber-700"
                      />
                      <div className="truncate">
                        <span className="font-semibold text-stone-900 block truncate">{a.name}</span>
                        <span className="text-[10px] text-stone-500 block truncate">{a.email}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              id="grant-access-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating account...' : 'Grant Access'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Authorized Users Table & Management */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Authorized Team Members ({users.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="download-all-data-team-btn"
              onClick={handleDownloadAllData}
              disabled={isDownloadingAllData}
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download all data of all users (Admins, Managers, Agents) as CSV"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingAllData ? 'animate-bounce' : ''}`} />
              <span>{isDownloadingAllData ? 'Exporting...' : 'Download All Data'}</span>
            </button>

            {selectedUserIdsForFlush.length > 0 && (
              <button
                type="button"
                onClick={() => setIsFlushConfirmOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Flush Data ({selectedUserIdsForFlush.length})</span>
              </button>
            )}
          </div>
        </div>

        {downloadMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {flushMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{flushMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFlushMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isLoadingUsers ? (
          <div className="p-6 text-center text-xs text-stone-400">Loading user accounts...</div>
        ) : (
          <div className="divide-y divide-stone-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-stone-400 border-b border-stone-200">
                  <th className="py-2.5 pl-2 pr-1 w-8">
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selectedUserIdsForFlush.length === users.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-stone-300 text-amber-700 focus:ring-amber-700 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="py-2.5 font-semibold">User</th>
                  <th className="py-2.5 font-semibold">Role</th>
                  <th className="py-2.5 font-semibold">Reporting Manager</th>
                  <th className="py-2.5 font-semibold">Joined</th>
                  <th className="py-2.5 font-semibold">Last Active</th>
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => {
                  const assignedAgentsCount = users.filter((a) => a.managerId === u.id).length;
                  return (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-stone-50/60">
                        <td className="py-3 pl-2 pr-1">
                          <input
                            type="checkbox"
                            checked={selectedUserIdsForFlush.includes(u.id)}
                            onChange={() => handleToggleSelectUser(u.id)}
                            className="rounded border-stone-300 text-amber-700 focus:ring-amber-700 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-stone-900">{u.name}</div>
                          <div className="text-[11px] text-stone-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3">
                          <select
                            value={u.role}
                            disabled={u.id === currentUser.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 disabled:opacity-60 cursor-pointer"
                          >
                            <option value="agent">Agent</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 pr-3">
                          {u.role === 'agent' ? (
                            <select
                              value={u.managerId || ''}
                              onChange={(e) => handleManagerChange(u.id, e.target.value)}
                              className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 max-w-[170px] truncate cursor-pointer"
                            >
                              <option value="">-- No Manager --</option>
                              {managerUsers
                                .filter((m) => m.id !== u.id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.role})
                                  </option>
                                ))}
                            </select>
                          ) : u.role === 'manager' ? (
                            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {assignedAgentsCount} {assignedAgentsCount === 1 ? 'agent' : 'agents'} assigned
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-400 font-medium">System Admin</span>
                          )}
                        </td>
                        <td className="py-3 text-stone-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-stone-500">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                if (resettingUserId === u.id) {
                                  setResettingUserId(null);
                                } else {
                                  setResettingUserId(u.id);
                                  setResetPasswordVal('');
                                }
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Reset password for this user"
                            >
                              <KeyRound className="w-3 h-3 text-stone-500" />
                              <span>Reset Pwd</span>
                            </button>

                            {u.id !== currentUser.id ? (
                              <button
                                id={`revoke-user-${u.id}`}
                                onClick={() => handleRevokeAccess(u.id, u.email)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Revoke access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-400 italic px-1">You</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline password reset row */}
                      {resettingUserId === u.id && (
                        <tr className="bg-amber-50/50">
                          <td colSpan={7} className="p-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                                <span className="text-xs font-semibold text-stone-800">
                                  Set new password for {u.name} ({u.email}):
                                </span>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                  type="password"
                                  value={resetPasswordVal}
                                  onChange={(e) => setResetPasswordVal(e.target.value)}
                                  placeholder="Enter new password"
                                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono w-full sm:w-48"
                                />
                                <button
                                  onClick={() => handleSaveResetPassword(u.id)}
                                  disabled={isResetting || !resetPasswordVal}
                                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                                >
                                  {isResetting ? 'Saving...' : 'Save New Password'}
                                </button>
                                <button
                                  onClick={() => setResettingUserId(null)}
                                  className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Follow-Up Notification Configuration Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Follow-Up Email Notification Service
            </h3>
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          When scheduled follow-up calls become due, the system dispatches automated alert emails to notify assigned personnel.
        </p>

        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-stone-800">
              Configured Recipient: <span className="font-mono text-amber-900">{currentUser.email}</span>
            </div>
            <div className="text-[11px] text-stone-500">
              Template: &quot;⏰ Scheduled Follow-Up Due: [Lead Name]&quot; with call context and contact details.
            </div>
            {emailStatus && (
              <div className="text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 mt-2">
                {emailStatus}
              </div>
            )}
          </div>

          <button
            id="send-test-email-btn"
            type="button"
            onClick={handleTestEmailAlert}
            disabled={isSendingTestEmail}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingTestEmail ? 'Dispatching...' : 'Send Test Due Alert'}</span>
          </button>
        </div>
      </div>

      {/* Web & Mobile Push Notification Configuration Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Mobile &amp; Web Push Notification Service
            </h3>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Push Alerts
          </span>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Delivers lock-screen and banner push alerts to mobile phones and desktop browsers when follow-up calls are due or leads are reassigned.
        </p>

        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-stone-800 flex items-center gap-2">
                <span>Push Service on this Device:</span>
                {isPushSubscribed ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active &bull; Receiving alerts</span>
                  </span>
                ) : (
                  <span className="text-stone-500 font-normal">Not enabled on this browser</span>
                )}
              </div>
              <p className="text-[11px] text-stone-500">
                Enables immediate background alerts on your workstation or mobile device.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={isUpdatingPush}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                  isPushSubscribed
                    ? 'border border-stone-300 text-stone-700 hover:bg-stone-100'
                    : 'bg-amber-700 hover:bg-amber-800 text-white'
                }`}
              >
                {isUpdatingPush
                  ? 'Updating...'
                  : isPushSubscribed
                  ? 'Disable on this Device'
                  : 'Enable Push on this Device'}
              </button>

              {isPushSubscribed && (
                <button
                  type="button"
                  onClick={handleTestPushAlert}
                  disabled={isSendingTestPush}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTestPush ? 'Sending...' : 'Test Push Alert'}</span>
                </button>
              )}
            </div>
          </div>

          {pushStatusMsg && (
            <div className="text-xs font-medium text-amber-900 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
              {pushStatusMsg}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Flush Data */}
      {isFlushConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Permanently Flush User Data?</h3>
                <p className="text-xs text-stone-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete all leads, set follow-up timers, call logs, and directives
              for the selected {selectedUserIdsForFlush.length} user(s)?
            </p>
            <div className="max-h-36 overflow-y-auto mb-5 p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
              {users
                .filter((u) => selectedUserIdsForFlush.includes(u.id))
                .map((u) => (
                  <div key={u.id} className="text-xs text-stone-800 flex items-center justify-between">
                    <span className="font-semibold">{u.name}</span>
                    <span className="text-stone-400 font-mono text-[11px]">{u.email}</span>
                  </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isFlushing}
                onClick={() => setIsFlushConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isFlushing}
                onClick={handleFlushData}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFlushing ? 'Flushing data...' : 'Yes, Permanently Flush'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    if (!isOpen) return null;
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        <div className="relative bg-[#FDFBF7] w-full max-w-4xl rounded-2xl shadow-xl border border-stone-200 overflow-hidden max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
