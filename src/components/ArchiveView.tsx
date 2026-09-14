import React, { useState } from 'react';
import { Archive, Download, Search, Filter, Phone, RotateCcw, AlertOctagon } from 'lucide-react';
import type { Lead } from '../types';
import { api } from '../lib/api';
import { ContactActionMenu } from './ContactActionMenu';

interface ArchiveViewProps {
  leads: Lead[];
  onOpenDetail: (lead: Lead) => void;
  onRestoreLead: (id: string) => Promise<void>;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  leads,
  onOpenDetail,
  onRestoreLead,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Service Denied' | 'Archived' | 'Matured (Closed)'>('all');
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');

  const filtered = leads
    .filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.business_notes.toLowerCase().includes(q) ||
        (l.business_info && l.business_info.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const timeA = new Date(a.archived_at || a.updated_at).getTime();
      const timeB = new Date(b.archived_at || b.updated_at).getTime();
      return dateSort === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl('archived'), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Archive Header */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-700 text-white flex items-center justify-center shadow-xs">
              <Archive className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-stone-900">Archive &amp; Inactive Repository</h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Cold outreach contacts with "Service Denied" or manually archived. Completely silenced from daily reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xl font-bold text-stone-800 font-mono">{leads.length}</div>
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
              Archived Leads
            </div>
          </div>

          <button
            id="export-archive-csv-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Archive CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and search control bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search archived leads by name, phone, reason..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-stone-700"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-xs focus:outline-hidden"
          >
            <option value="all">All Archive Statuses</option>
            <option value="Service Denied">Service Denied</option>
            <option value="Archived">Manually Archived</option>
            <option value="Matured (Closed)">Closed / Matured</option>
          </select>

          {/* Date sort */}
          <select
            value={dateSort}
            onChange={(e) => setDateSort(e.target.value as any)}
            className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-xs focus:outline-hidden"
          >
            <option value="newest">Recently Archived</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Archive Leads List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
          <Archive className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-800">No archived leads</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'No records match your filters.'
              : 'Calls marked as "Service Denied" or archived will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="p-4 bg-white rounded-xl border border-stone-200 hover:border-stone-300 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onOpenDetail(lead)}
                    className="font-bold text-stone-900 text-sm hover:text-amber-800 text-left cursor-pointer"
                  >
                    {lead.name}
                  </button>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      lead.status === 'Service Denied'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : lead.status === 'Matured (Closed)'
                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {lead.status === 'Service Denied' && <AlertOctagon className="w-3 h-3 text-rose-600" />}
                    <span>{lead.status}</span>
                  </span>

                  <ContactActionMenu
                    contact={{
                      name: lead.name,
                      phone: lead.phone,
                      business_notes: lead.business_notes,
                      business_info: lead.business_info,
                      source: lead.source,
                    }}
                    size="sm"
                  />
                </div>

                {lead.business_notes && (
                  <p className="text-xs text-stone-600 line-clamp-1">{lead.business_notes}</p>
                )}

                {lead.archive_reason && (
                  <p className="text-[11px] text-rose-700 font-medium">
                    Reason: {lead.archive_reason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
                  {new Date(lead.archived_at || lead.updated_at).toLocaleDateString()}
                </span>

                <button
                  onClick={() => onOpenDetail(lead)}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                >
                  View Dossier
                </button>

                <button
                  onClick={() => onRestoreLead(lead.id)}
                  title="Restore to active calling list"
                  className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
