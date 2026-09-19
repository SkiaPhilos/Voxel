import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Trash2,
  Phone,
  Mail,
  ShoppingBag,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { PotentialCustomer, User } from '../types';
import { api } from '../lib/api';
import { formatPhoneForDialer } from '../lib/contactUtils';

interface PotentialCustomersViewProps {
  currentUser: User;
  onCustomerCreated?: () => void;
}

export const PotentialCustomersView: React.FC<PotentialCustomersViewProps> = ({
  currentUser,
  onCustomerCreated,
}) => {
  const [customers, setCustomers] = useState<PotentialCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Customer Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState('Website Inquiry');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCustomers = async (searchQuery?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getPotentialCustomers(searchQuery);
      setCustomers(res.customers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load potential customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newInterest.trim()) {
      setModalError('Name, phone number, and product interest are required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await api.createPotentialCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        product_interest: newInterest.trim(),
        email: newEmail.trim() || undefined,
        source: newSource.trim() || undefined,
      });

      setCustomers((prev) => [res.customer, ...prev]);
      onCustomerCreated?.();
      setIsModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewInterest('');
      setNewEmail('');
      setNewSource('Website Inquiry');
      setSuccess(`Added "${res.customer.name}" to potential customers.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete potential customer record for "${name}"?`)) return;
    try {
      await api.deletePotentialCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setSuccess(`Deleted record for "${name}".`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    }
  };

  const exportUrl = api.getPotentialCustomersExportCsvUrl();

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">Potential Customers</h1>
              <p className="text-xs text-stone-500">
                Lightweight, searchable directory of prospect interests &amp; inquiries.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={exportUrl}
            download
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Download CSV export with formula injection sanitization"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Prospect</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospects by name, phone, product interest, email..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-[#FAF8F5] text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700/50"
          />
        </div>

        <button
          onClick={() => fetchCustomers(search)}
          disabled={isLoading}
          className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh list"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Records Count */}
      <div className="flex items-center justify-between px-1 text-xs text-stone-500">
        <span>Showing <strong className="text-stone-800">{customers.length}</strong> potential customers</span>
      </div>

      {/* Customers Table / Grid */}
      {isLoading && customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-xs text-stone-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-700" />
          Loading prospects...
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-300">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-stone-800 mb-1">No Potential Customers Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
            {search ? 'No records match your search criteria.' : 'Start recording prospect inquiries and product interests here.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Add First Prospect
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Customer / Contact</th>
                  <th className="px-4 py-3.5">Product Interest</th>
                  <th className="px-4 py-3.5">Source</th>
                  <th className="px-4 py-3.5">Logged Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-stone-900">{customer.name}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-500">
                        <a
                          href={`tel:${formatPhoneForDialer(customer.phone)}`}
                          className="flex items-center gap-1 font-mono hover:text-amber-800 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{customer.phone}</span>
                        </a>
                        {customer.email && (
                          <a
                            href={`mailto:${customer.email}`}
                            className="flex items-center gap-1 hover:text-amber-800 transition-colors truncate max-w-[160px]"
                          >
                            <Mail className="w-3 h-3 text-stone-400" />
                            <span>{customer.email}</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg inline-block">
                        {customer.product_interest}
                      </div>
                      {customer.notes && (
                        <div className="text-[11px] text-stone-500 mt-1 line-clamp-1">{customer.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold uppercase tracking-wider">
                        {customer.source || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-500 font-mono text-[11px]">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete customer record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Prospect Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold text-sm">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-stone-900 text-sm">Add Potential Customer</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              {modalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199"
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Product / Service Interest <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="e.g. Enterprise CRM, Annual Maintenance, Inbound Package"
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Source / Channel
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="Website Inquiry">Website Inquiry</option>
                    <option value="Cold Call Outbound">Cold Call Outbound</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Exhibition/Event">Exhibition/Event</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
