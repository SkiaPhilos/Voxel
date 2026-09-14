import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Calendar,
  Building,
  History,
  Plus,
  Flame,
  Archive,
  Edit2,
  Check,
  Tag,
  Clock,
  User,
  Compass,
  UserPlus,
  MessageSquare,
  Copy,
  Pin,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import type { Lead, OutcomeTag, Priority, User as UserType, PinnedComment } from '../types';
import { formatFriendlyTime } from '../lib/dateUtils';
import { saveLeadToContacts, formatPhoneForDialer } from '../lib/contactUtils';
import { UserAvatar } from './UserAvatar';
import { api } from '../lib/api';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLogCall: (lead: Lead) => void;
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  onArchiveLead: (id: string, archive: boolean, reason?: string) => Promise<void>;
  currentUser?: UserType | null;
  onOpenReassign?: (lead: Lead) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onLogCall,
  onUpdateLead,
  onArchiveLead,
  currentUser,
  onOpenReassign,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editBizInfo, setEditBizInfo] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('Normal');
  const [isSaving, setIsSaving] = useState(false);
  const [savedToContacts, setSavedToContacts] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Pinned Comments state
  const [pinnedComments, setPinnedComments] = useState<PinnedComment[]>([]);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [newPinText, setNewPinText] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  useEffect(() => {
    if (lead?.id && isOpen) {
      api.getPinnedComments({ leadId: lead.id })
        .then((res) => {
          const comments = res.comments || [];
          setPinnedComments(comments);
          // When an Agent opens the lead, automatically mark unacknowledged directives as acknowledged
          if (currentUser?.role === 'agent') {
            const unacked = comments.filter(
              (c) => c.status === 'unacknowledged' && (c.agent_id === currentUser.id || !c.agent_id)
            );
            unacked.forEach((c) => {
              api.updatePinnedCommentStatus(c.id, 'acknowledged')
                .then((updated) => {
                  setPinnedComments((prev) => prev.map((p) => (p.id === c.id ? updated.comment : p)));
                })
                .catch(() => {});
            });
          }
        })
        .catch(() => setPinnedComments([]));
    }
  }, [lead?.id, isOpen, currentUser?.role, currentUser?.id]);

  if (!isOpen || !lead) return null;

  const handleUpdatePinStatus = async (commentId: string, status: 'acknowledged' | 'done') => {
    try {
      const res = await api.updatePinnedCommentStatus(commentId, status);
      setPinnedComments((prev) => prev.map((c) => (c.id === commentId ? res.comment : c)));
    } catch (err) {
      console.error('Failed to update comment status', err);
    }
  };

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinText.trim() || !lead) return;
    setIsSubmittingPin(true);
    try {
      const res = await api.createPinnedComment({
        leadId: lead.id,
        agentId: lead.assigned_to || undefined,
        comment: newPinText.trim(),
      });
      setPinnedComments((prev) => [res.comment, ...prev]);
      setNewPinText('');
      setIsAddingPin(false);
    } catch (err) {
      console.error('Failed to pin comment', err);
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleSaveContact = async () => {
    const res = await saveLeadToContacts({
      name: lead.name,
      phone: lead.phone,
      business_notes: lead.business_notes,
      business_info: lead.business_info,
      source: lead.source,
    });
    if (res.success) {
      setSavedToContacts(true);
      setTimeout(() => setSavedToContacts(false), 2500);
    }
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const startEditing = () => {
    setEditName(lead.name);
    setEditPhone(lead.phone);
    setEditNotes(lead.business_notes || '');
    setEditSource(lead.source || '');
    setEditBizInfo(lead.business_info || '');
    setEditPriority(lead.priority || 'Normal');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await onUpdateLead(lead.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        business_notes: editNotes.trim(),
        source: editSource.trim(),
        business_info: editBizInfo.trim(),
        priority: editPriority,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update lead', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isArchived = lead.status === 'Service Denied' || lead.status === 'Archived';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl h-full bg-[#FAF8F5] border-l border-stone-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Top bar */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500">
              Lead Dossier
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium">
              {lead.status}
            </span>
            {lead.priority === 'High' && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold flex items-center gap-0.5">
                <Flame className="w-3 h-3 text-amber-600" />
                <span>High Priority</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Lead Header Card */}
          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs">
            {!isEditing ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">{lead.name}</h2>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <a
                        href={`tel:${lead.phone}`}
                        className="font-mono text-stone-700 hover:text-amber-700 font-medium flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5 text-amber-700" />
                        <span>{lead.phone}</span>
                      </a>
                      {lead.source && (
                        <span className="text-stone-500 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-stone-400" />
                          <span>{lead.source}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && onOpenReassign && (
                      <button
                        onClick={() => onOpenReassign(lead)}
                        className="p-2 rounded-lg text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 border border-amber-200 transition-colors cursor-pointer"
                        title="Reassign lead to another agent"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Reassign</span>
                      </button>
                    )}
                    <button
                      onClick={startEditing}
                      className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1 border border-stone-200 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onLogCall(lead)}
                      className="px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Log Call</span>
                    </button>
                  </div>
                </div>

                {/* Business details */}
                {lead.business_notes && (
                  <div className="pt-3 border-t border-stone-100 text-xs text-stone-700">
                    <span className="font-semibold text-stone-800 block mb-0.5">Business &amp; Operation Notes:</span>
                    <p className="whitespace-pre-wrap">{lead.business_notes}</p>
                  </div>
                )}

                {/* Next scheduled action */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>Follow-up Action:</span>
                  </span>
                  <span className="font-semibold text-stone-800">
                    {formatFriendlyTime(lead.next_action_at)}
                  </span>
                </div>
              </div>
            ) : (
              /* Inline Edit Mode */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Lead Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Phone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Business Notes</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Source</label>
                    <input
                      type="text"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as Priority)}
                      className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-4 py-1.5 text-xs font-bold bg-amber-700 text-white rounded-lg hover:bg-amber-800 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Call & Phone Contacts Action Bar */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-700" />
                <span>Call &amp; Phone Contacts</span>
              </span>
              <span className="text-[11px] font-mono text-stone-500">{lead.phone}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                id="drawer-call-btn"
                href={`tel:${formatPhoneForDialer(lead.phone)}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors"
                title="Open Phone Dialer"
              >
                <Phone className="w-4 h-4" />
                <span>Call Now</span>
              </a>

              <button
                id="drawer-save-contact-btn"
                onClick={handleSaveContact}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  savedToContacts
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300 shadow-2xs'
                }`}
                title="Save lead into Phone Contacts book (vCard)"
              >
                {savedToContacts ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4 text-amber-700" />}
                <span>{savedToContacts ? 'Added to Contacts!' : 'Save to Contacts'}</span>
              </button>

              <a
                href={`sms:${formatPhoneForDialer(lead.phone)}`}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 shadow-2xs text-xs font-semibold transition-colors"
                title="Send SMS message"
              >
                <MessageSquare className="w-3.5 h-3.5 text-stone-500" />
                <span>SMS</span>
              </a>

              <button
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 shadow-2xs text-xs font-semibold transition-colors cursor-pointer"
                title="Copy phone number"
              >
                {copiedPhone ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pinned Directives & Manager Comments */}
          <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Pinned Manager Directives ({pinnedComments.length})
                </h3>
              </div>
              {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && !isAddingPin && (
                <button
                  onClick={() => setIsAddingPin(true)}
                  className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pin Directive</span>
                </button>
              )}
            </div>

            {/* Quick Add Form for Manager/Admin */}
            {isAddingPin && (
              <form onSubmit={handleAddPin} className="p-3 bg-white rounded-xl border border-stone-200 space-y-2.5">
                <textarea
                  required
                  rows={2}
                  value={newPinText}
                  onChange={(e) => setNewPinText(e.target.value)}
                  placeholder="Enter manager directive or special instruction for this lead..."
                  className="w-full p-2 text-xs border border-stone-300 rounded-lg text-stone-900 focus:ring-2 focus:ring-amber-700 focus:outline-hidden"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPin(false);
                      setNewPinText('');
                    }}
                    className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPin || !newPinText.trim()}
                    className="px-3 py-1 bg-amber-700 text-white rounded-lg text-xs font-bold hover:bg-amber-800 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPin ? 'Pinning...' : 'Post Directive'}
                  </button>
                </div>
              </form>
            )}

            {pinnedComments.length === 0 ? (
              <p className="text-xs text-stone-500 italic">No pinned directives on this lead.</p>
            ) : (
              <div className="space-y-2">
                {pinnedComments.map((pc) => (
                  <div
                    key={pc.id}
                    className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <UserAvatar
                          avatarUrl={pc.author_avatar_url}
                          name={pc.author_name}
                          size="xs"
                        />
                        <span className="text-xs font-bold text-stone-900">{pc.author_name}</span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(pc.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          pc.status === 'done'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pc.status === 'acknowledged'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {pc.status}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 whitespace-pre-wrap">{pc.content}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px]">
                      <div className="text-stone-400 text-[10px]">
                        {pc.status === 'acknowledged' && pc.acknowledged_at && (
                          <span>Ack'd {new Date(pc.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {pc.status === 'done' && <span>Resolved</span>}
                      </div>

                      {pc.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => handleUpdatePinStatus(pc.id, 'done')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                            currentUser?.role === 'agent'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{currentUser?.role === 'agent' ? 'Mark Done' : 'Manager Override: Mark Done'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Structured Business Info Block */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Structured Business &amp; Customer Info
                </h3>
              </div>
            </div>
            <p className="text-xs text-stone-500 mb-2.5">
              Accumulated company data, pain points, budget, and decision-maker structure.
            </p>
            {lead.business_info ? (
              <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl text-xs text-stone-700 whitespace-pre-wrap font-mono">
                {lead.business_info}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">No structured business info logged yet.</p>
            )}
          </div>

          {/* Call History Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-700" />
                <span>Full Call History ({lead.call_logs.length})</span>
              </h3>
              <button
                onClick={() => onLogCall(lead)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log New Call</span>
              </button>
            </div>

            {lead.call_logs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-stone-200">
                <Phone className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs text-stone-500 font-medium">No calls made yet.</p>
                <button
                  onClick={() => onLogCall(lead)}
                  className="mt-3 px-3 py-1.5 text-xs font-bold bg-amber-700 text-white rounded-lg hover:bg-amber-800 cursor-pointer"
                >
                  Log First Call
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {lead.call_logs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                        {log.outcome_tag}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-stone-900">{log.summary}</div>

                    {log.full_notes && (
                      <p className="text-xs text-stone-600 bg-[#FBF9F5] p-2.5 rounded-lg border border-stone-200/60 whitespace-pre-wrap">
                        {log.full_notes}
                      </p>
                    )}

                    {log.business_info && (
                      <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 flex items-start gap-1.5">
                        <span className="font-bold shrink-0">Captured Info:</span>
                        <span>{log.business_info}</span>
                      </div>
                    )}

                    {log.logged_by && (
                      <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-stone-500">
                        <span className="text-stone-400">Logged by:</span>
                        <UserAvatar name={log.logged_by} size="xs" />
                        <span className="font-semibold text-stone-700">{log.logged_by}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer controls: Archive / Restore */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between text-xs">
            <span className="text-stone-400">
              Lead ID: <span className="font-mono">{lead.id}</span>
            </span>
            {isArchived ? (
              <button
                onClick={() => onArchiveLead(lead.id, false)}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 font-semibold cursor-pointer"
              >
                Restore to Active Leads
              </button>
            ) : (
              <button
                onClick={() => onArchiveLead(lead.id, true, 'Manually archived from dossier')}
                className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive Lead</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
