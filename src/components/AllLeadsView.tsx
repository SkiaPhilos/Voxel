import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  Calendar,
  Flame,
  PhoneCall,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import type { Lead, Priority, PinnedComment, User } from '../types';
import { LeadCard } from './LeadCard';
import { StickyDirectiveFloatingLayer } from './StickyDirectiveIndicator';
import { generateLeadsCsv } from '../lib/csvExportUtils';

interface AllLeadsViewProps {
  leads: Lead[];
  onLogCall: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
  onTogglePriority: (lead: Lead) => void;
  onOpenNewLeadModal: () => void;
  onOpenCsvImportModal?: () => void;
  currentUser?: User | null;
  pinnedComments?: PinnedComment[];
  onCommentStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  onRequestAssistance?: (lead: Lead) => void;
  onOpenQA?: (lead: Lead) => void;
}

export const AllLeadsView: React.FC<AllLeadsViewProps> = ({
  leads,
  onLogCall,
  onOpenDetail,
  onTogglePriority,
  onOpenNewLeadModal,
  onOpenCsvImportModal,
  currentUser,
  pinnedComments,
  onCommentStatusUpdated,
  onRequestAssistance,
  onOpenQA,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // Filter & sort logic
  const filteredAndSortedLeads = useMemo(() => {
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let result = leads.filter((lead) => {
      // 1. Status filter
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false;
      }

      // 2. Priority filter
      if (priorityFilter !== 'all' && lead.priority !== priorityFilter) {
        return false;
      }

      // 3. Date range filter
      if (dateRangeFilter !== 'all') {
        const leadCreatedTime = new Date(lead.created_at).getTime();
        const ageMs = now - leadCreatedTime;

        if (dateRangeFilter === 'today' && ageMs > oneDayMs) {
          return false;
        }
        if (dateRangeFilter === '7days' && ageMs > 7 * oneDayMs) {
          return false;
        }
        if (dateRangeFilter === '30days' && ageMs > 30 * oneDayMs) {
          return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lead.name.toLowerCase().includes(q);
        const matchesPhone = lead.phone.toLowerCase().includes(q);
        const matchesNotes = (lead.business_notes || '').toLowerCase().includes(q);
        const matchesBiz = (lead.business_info || '').toLowerCase().includes(q);
        const matchesSource = (lead.source || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesNotes && !matchesBiz && !matchesSource) {
          return false;
        }
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        if (a.priority === 'High' && b.priority !== 'High') return -1;
        if (a.priority !== 'High' && b.priority === 'High') return 1;
        // tie-breaker: newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      // Default: newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [leads, searchQuery, statusFilter, priorityFilter, dateRangeFilter, sortBy]);

  // Export filtered leads to CSV with dynamic QA columns at the end
  const handleExportFilteredCsv = () => {
    if (filteredAndSortedLeads.length === 0) return;
    generateLeadsCsv(filteredAndSortedLeads, 'coldcall_crm_all_leads_export');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dateRangeFilter !== 'all' ||
    sortBy !== 'newest';

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateRangeFilter('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Metric Header */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">All Leads Directory</h2>
              <p className="text-xs text-stone-500">
                Complete database of all leads across active, closed, and archived stages
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xl font-bold text-stone-900 font-mono">
              {filteredAndSortedLeads.length}
              <span className="text-xs font-normal text-stone-400 font-sans ml-1">
                / {leads.length}
              </span>
            </div>
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
              Matching Leads
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCsvImportModal && (
              <button
                id="import-all-leads-csv-btn"
                onClick={onOpenCsvImportModal}
                title="Bulk import leads from CSV spreadsheet"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
                <span>Import CSV</span>
              </button>
            )}

            <button
              id="export-all-leads-csv-btn"
              onClick={handleExportFilteredCsv}
              disabled={filteredAndSortedLeads.length === 0}
              title="Download CSV of all currently filtered leads"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({filteredAndSortedLeads.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Control Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="all-leads-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all leads by name, phone number, notes, source, or captured business info..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
          />
        </div>

        {/* Filters and Sorters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Lead Status
            </label>
            <select
              id="filter-all-leads-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Statuses ({leads.length})</option>
              <option value="Active">Active</option>
              <option value="Follow-up Scheduled">Follow-up Scheduled</option>
              <option value="Matured (Closed)">Matured (Closed)</option>
              <option value="Service Denied">Service Denied</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Priority Level
            </label>
            <select
              id="filter-all-leads-priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="High">High Priority Only</option>
              <option value="Normal">Normal Priority Only</option>
            </select>
          </div>

          {/* Date Added Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Date Added Range
            </label>
            <select
              id="filter-all-leads-date"
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Added Today (Last 24h)</option>
              <option value="7days">Added Last 7 Days</option>
              <option value="30days">Added Last 30 Days</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Sort Order
            </label>
            <select
              id="sort-all-leads"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="newest">Newest First (Default)</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">High Priority First</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Pill */}
        {hasActiveFilters && (
          <div className="pt-2 flex items-center justify-between border-t border-stone-100 text-xs text-stone-500">
            <span>
              Showing <strong>{filteredAndSortedLeads.length}</strong> of {leads.length} leads
            </span>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-amber-800 hover:text-amber-900 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Leads List */}
      {filteredAndSortedLeads.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-200">
          <Layers className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-800">No leads match your criteria</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status filter, or date range, or add a new lead to the CRM.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={onOpenNewLeadModal}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              + Add New Lead
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredAndSortedLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              currentUser={currentUser}
              pinnedComments={pinnedComments?.filter((c) => c.lead_id === lead.id)}
              onCommentStatusUpdated={onCommentStatusUpdated}
              onLogCall={onLogCall}
              onOpenDetail={onOpenDetail}
              onTogglePriority={onTogglePriority}
              onRequestAssistance={onRequestAssistance}
              onOpenQA={onOpenQA}
            />
          ))}
        </div>
      )}

      {/* Smooth Sticky Note Attached & Docking Indicator Layer */}
      {pinnedComments && pinnedComments.length > 0 && (
        <StickyDirectiveFloatingLayer
          pinnedComments={pinnedComments}
          currentUser={currentUser}
          onStatusUpdated={onCommentStatusUpdated}
        />
      )}
    </div>
  );
};
