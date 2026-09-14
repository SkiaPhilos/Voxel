import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Eye,
  RefreshCw,
  Sparkles,
  HelpCircle,
  FileText,
} from 'lucide-react';
import type { NewsletterLog, User } from '../types';
import { api } from '../lib/api';

interface NewsletterViewProps {
  currentUser: User;
}

export const NewsletterView: React.FC<NewsletterViewProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<NewsletterLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [recipientCategory, setRecipientCategory] = useState<'potential_customers' | 'closed_leads' | 'all_leads'>('potential_customers');
  const [bodyHtml, setBodyHtml] = useState(
    '<h2>Special Service Update &amp; Insights</h2>\n<p>Dear Valued Contact,</p>\n<p>We are reaching out with an exclusive update regarding our latest offerings and dedicated service packages tailored to your requirements.</p>\n<p>Feel free to reply directly to this message or schedule a quick discovery call at your earliest convenience.</p>\n<p>Warm regards,<br /><strong>The Team</strong></p>'
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getNewsletterLogs();
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load newsletter history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !bodyHtml.trim()) {
      setError('Subject and email message content are required.');
      return;
    }

    if (!confirm(`Dispatch newsletter "${subject.trim()}" to selected recipient group?`)) {
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.sendNewsletter({
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        recipientCategory,
      });

      setSuccess(res.message);
      if (res.log) {
        setLogs((prev) => [res.log, ...prev]);
      } else {
        fetchLogs();
      }
      setSubject('');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch newsletter');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-stone-900 tracking-tight">Newsletter &amp; Email Dispatch</h1>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                  Resend Integration
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Dispatch curated email campaigns and updates directly to prospect groups.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="self-start sm:self-auto p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh newsletter dispatch logs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Dispatch Composer */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-700" />
            <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Compose Campaign
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isPreviewOpen ? 'Hide Preview' : 'Show HTML Preview'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSendNewsletter} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Campaign Subject Line <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exclusive Spring Update & Dedicated Inbound Solutions"
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Target Recipient Group <span className="text-rose-500">*</span>
              </label>
              <select
                value={recipientCategory}
                onChange={(e) => setRecipientCategory(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              >
                <option value="potential_customers">Potential Customers (Inquiries)</option>
                <option value="closed_leads">Closed Deals / Matured Clients</option>
                <option value="all_leads">All CRM Leads (Active &amp; Pipeline)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
              Email Content (HTML or Plain Text) <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={8}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {isPreviewOpen && (
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                Live Email Rendering Preview
              </div>
              <div
                className="prose prose-sm max-w-none p-4 bg-white rounded-lg border border-stone-200 text-stone-800"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <span className="text-[11px] text-stone-400">
              Powered by Resend API. Automatic fallback logging if API key is not configured.
            </span>

            <button
              type="submit"
              disabled={isSending || !subject.trim()}
              className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Dispatching...' : 'Dispatch Newsletter'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Dispatch History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Dispatch Logs &amp; Audit Trail
            </h2>
          </div>
          <span className="text-[11px] text-stone-500">
            Total Dispatches: <strong>{logs.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Target Audience</th>
                <th className="px-4 py-3 text-center">Recipients</th>
                <th className="px-4 py-3">Dispatched By</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    No newsletter dispatches recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-stone-900">{log.subject}</div>
                      {log.error_message && (
                        <div className="text-[10px] text-rose-600 mt-0.5 font-mono">{log.error_message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700">
                        {log.recipient_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono text-stone-800">
                      {log.recipient_count}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {log.sent_by_name || 'System'}
                    </td>
                    <td className="px-4 py-3 text-stone-500 font-mono text-[11px]">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'simulated'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
