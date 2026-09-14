import React, { useState } from 'react';
import { CheckCircle2, Download, Search, Phone, History, Calendar, Building } from 'lucide-react';
import type { Lead } from '../types';
import { api } from '../lib/api';
import { ContactActionMenu } from './ContactActionMenu';

interface ClosedDealsViewProps {
  leads: Lead[];
  onOpenDetail: (lead: Lead) => void;
  onLogCall: (lead: Lead) => void;
}

export const ClosedDealsView: React.FC<ClosedDealsViewProps> = ({
  leads,
  onOpenDetail,
  onLogCall,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.business_notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.business_info && l.business_info.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl('closed'), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header card with export button */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-stone-900">Closed Deals &amp; Matured Leads</h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Deals that successfully closed. Kept out of the daily dialer, retained with full customer history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xl font-bold text-teal-800 font-mono">{leads.length}</div>
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
              Matured Deals
            </div>
          </div>

          <button
            id="export-closed-csv-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search closed deals by client name, phone, or notes..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-700"
        />
      </div>

      {/* Deals list */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
          <CheckCircle2 className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-800">No closed deals found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No deals match your search query.'
              : 'Log calls with outcome "Closed/Matured" to move winning prospects into this ledger.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="p-5 bg-white rounded-2xl border border-stone-200 hover:border-teal-300 shadow-2xs transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <button
                    onClick={() => onOpenDetail(lead)}
                    className="text-base font-bold text-stone-900 hover:text-teal-800 text-left cursor-pointer"
                  >
                    {lead.name}
                  </button>
                  <div className="flex items-center gap-2 mt-1.5">
                    <ContactActionMenu
                      contact={{
                        name: lead.name,
                        phone: lead.phone,
                        business_notes: lead.business_notes,
                        business_info: lead.business_info,
                        source: lead.source,
                      }}
                    />
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                  <span>Closed Deal</span>
                </span>
              </div>

              {lead.business_notes && (
                <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                  <span className="font-semibold text-stone-700 mr-1">Business:</span>
                  {lead.business_notes}
                </div>
              )}

              {lead.business_info && (
                <div className="text-xs text-teal-900 bg-teal-50/70 p-2 rounded-lg border border-teal-200">
                  <span className="font-semibold text-teal-950 mr-1">Captured Customer Info:</span>
                  {lead.business_info}
                </div>
              )}

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-stone-400" />
                  <span>{lead.call_logs.length} calls to close</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLogCall(lead)}
                    className="text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
                  >
                    Log Follow-up
                  </button>
                  <button
                    onClick={() => onOpenDetail(lead)}
                    className="text-teal-800 hover:text-teal-900 font-bold underline cursor-pointer"
                  >
                    View Dossier
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
