import React, { useState } from 'react';
import { X, UserPlus, Phone, User, Building, Compass, Flame, AlertCircle } from 'lucide-react';
import type { Priority } from '../types';
import { CountryCodeSelector } from './CountryCodeSelector';
import { getDefaultCountry, normalizePhoneToE164, Country } from '../lib/countries';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPhones: string[];
  onSubmit: (leadData: {
    phone: string;
    name: string;
    business_notes: string;
    source: string;
    priority: Priority;
  }) => Promise<void>;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  existingPhones,
  onSubmit,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(getDefaultCountry());
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [businessNotes, setBusinessNotes] = useState('');
  const [source, setSource] = useState('Cold Outreach');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanPhone = (p: string) => p.replace(/[^0-9+]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    // Smart normalize with selected country code
    const normalized = normalizePhoneToE164(phone, selectedCountry.dialCode);
    const cleanedDigits = normalized.replace(/\D/g, '');

    const duplicate = existingPhones.some((p) => {
      const existingNormalized = normalizePhoneToE164(p, selectedCountry.dialCode).replace(/\D/g, '');
      return existingNormalized === cleanedDigits;
    });

    if (duplicate) {
      setError(`A lead with phone number ${phone} (${normalized}) already exists in your CRM.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        phone: normalized,
        name: name.trim() || 'Unnamed Prospect',
        business_notes: businessNotes.trim(),
        source: source.trim(),
        priority,
      });
      // reset & close
      setPhone('');
      setName('');
      setBusinessNotes('');
      setSource('Cold Outreach');
      setPriority('Normal');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-6 bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Add New Cold Lead</h3>
              <p className="text-xs text-stone-500">Capture lead info from phone outreach</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Phone Number (Required & Unique) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Phone Number <span className="text-rose-500">* (Unique)</span>
              </label>
              <span className="text-[11px] text-stone-500">
                Country: <strong className="text-stone-700">{selectedCountry.name}</strong>
              </span>
            </div>
            <div className="flex rounded-xl shadow-2xs border border-stone-300 bg-white focus-within:ring-2 focus-within:ring-amber-700 focus-within:border-amber-700 overflow-hidden">
              <CountryCodeSelector
                id="new-lead-country-selector"
                value={selectedCountry.dialCode}
                onChange={(c) => setSelectedCountry(c)}
                variant="input-prefix"
              />
              <input
                id="new-lead-phone-input"
                type="tel"
                required
                autoFocus
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={selectedCountry.dialCode === '+92' ? '0323 1234567 or 3231234567' : 'Enter mobile phone number'}
                className="w-full px-3 py-2 bg-transparent text-stone-900 text-sm focus:outline-hidden font-mono"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              Domestic &apos;0&apos; (e.g. 0323...) is automatically converted to international {selectedCountry.dialCode} for WhatsApp and calls.
            </p>
          </div>

          {/* Contact / Owner Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
              Contact / Prospect Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="new-lead-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Miller (Owner)"
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
              />
            </div>
          </div>

          {/* Business Details & Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
              Business Name &amp; Notes
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
              <textarea
                id="new-lead-business-input"
                rows={2}
                value={businessNotes}
                onChange={(e) => setBusinessNotes(e.target.value)}
                placeholder="e.g. Miller Plumbing & HVAC - 8 service vans, looking to automate dispatch"
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs resize-y"
              />
            </div>
          </div>

          {/* Source & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                Lead Source
              </label>
              <div className="relative">
                <Compass className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="new-lead-source-input"
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Cold List Q3, Chamber of Commerce"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                Initial Priority
              </label>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setPriority('Normal')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    priority === 'Normal'
                      ? 'bg-stone-800 text-white border-stone-800 font-semibold'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('High')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    priority === 'High'
                      ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                      : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>High</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-create-lead-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Save to Pipeline</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
