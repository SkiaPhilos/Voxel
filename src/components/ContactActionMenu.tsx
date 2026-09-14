// src/components/ContactActionMenu.tsx
import React, { useState } from 'react';
import { Phone, UserPlus, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';
import { saveLeadToContacts, formatPhoneForDialer } from '../lib/contactUtils';
import type { ContactInfo } from '../lib/contactUtils';

interface ContactActionMenuProps {
  contact: ContactInfo;
  className?: string;
  showPhoneLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ContactActionMenu: React.FC<ContactActionMenuProps> = ({
  contact,
  className = '',
  showPhoneLabel = true,
  size = 'sm',
}) => {
  const [copied, setCopied] = useState(false);
  const [savedContact, setSavedContact] = useState(false);
  const cleanPhone = formatPhoneForDialer(contact.phone);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveContact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const res = await saveLeadToContacts(contact);
    if (res.success) {
      setSavedContact(true);
      setTimeout(() => setSavedContact(false), 2500);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Direct Native Call / Dial link */}
      <a
        id={`quick-dial-${cleanPhone}`}
        href={`tel:${cleanPhone}`}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-lg transition-colors border ${
          size === 'sm'
            ? 'px-2.5 py-1.5 text-xs bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-700 border-stone-200'
            : 'px-3.5 py-2 text-xs bg-amber-700 hover:bg-amber-800 text-white border-amber-700 font-bold shadow-xs'
        }`}
        title="Tap to Call on Phone"
      >
        <Phone className={size === 'sm' ? 'w-3.5 h-3.5 text-amber-700' : 'w-4 h-4 text-white'} />
        {showPhoneLabel && <span>{contact.phone}</span>}
      </a>

      {/* Save to Phone Contacts Button */}
      <button
        type="button"
        onClick={handleSaveContact}
        className={`inline-flex items-center gap-1 rounded-lg transition-colors border cursor-pointer ${
          savedContact
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
        } ${size === 'sm' ? 'p-1.5 text-xs' : 'px-3 py-2 text-xs font-semibold'}`}
        title="Save lead into Phone Contacts (vCard)"
      >
        {savedContact ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            {size === 'md' && <span>Saved to Contacts</span>}
          </>
        ) : (
          <>
            <UserPlus className="w-3.5 h-3.5 text-stone-600" />
            {size === 'md' && <span>Add to Contacts</span>}
          </>
        )}
      </button>

      {/* Quick SMS button for mobile */}
      <a
        href={`sms:${cleanPhone}`}
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-200 transition-colors hidden sm:inline-flex"
        title="Send SMS message"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </a>

      {/* Copy phone button */}
      <button
        type="button"
        onClick={handleCopyPhone}
        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-200 transition-colors cursor-pointer"
        title="Copy phone number"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
