// src/lib/contactUtils.ts
// Utility for exporting leads directly to native phone Contacts via vCard 3.0 or Web Share API

export interface ContactInfo {
  name: string;
  phone: string;
  business_notes?: string;
  business_info?: string;
  source?: string;
}

/**
 * Format a phone number cleanly for tel: and vCard
 */
export function formatPhoneForDialer(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Generates a compliant vCard 3.0 string for import into iOS / Android Contacts
 */
export function generateVCardString(contact: ContactInfo): string {
  const cleanPhone = formatPhoneForDialer(contact.phone);
  const fullName = contact.name.trim();
  const org = (contact.business_info || contact.source || 'ColdCall Prospect').trim();
  const note = (contact.business_notes || '').replace(/\r?\n/g, '\\n').trim();

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fullName}`,
    `N:${fullName};;;;`,
    `TEL;TYPE=CELL,VOICE:${cleanPhone}`,
    org ? `ORG:${org}` : '',
    note ? `NOTE:${note}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Saves lead contact directly to phone Contacts:
 * 1. Tries Web Share API with a .vcf file (on iOS Safari / Android Chrome this opens the Contacts "Add Contact" sheet directly)
 * 2. Falls back to downloading the .vcf file (tapping the downloaded .vcf automatically opens Contacts on Android/iOS/Mac/Windows)
 */
export async function saveLeadToContacts(contact: ContactInfo): Promise<{ success: boolean; method: 'share' | 'download' }> {
  const vcard = generateVCardString(contact);
  const fileName = `${contact.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_contact.vcf`;

  // 1. Try Web Share API with file if supported on mobile
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([vcard], fileName, { type: 'text/vcard' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Add ${contact.name} to Contacts`,
          text: `Contact card for ${contact.name} (${contact.phone})`,
        });
        return { success: true, method: 'share' };
      }
    } catch (shareErr: any) {
      // If user aborted/cancelled share sheet, return silently
      if (shareErr.name === 'AbortError') {
        return { success: false, method: 'share' };
      }
      console.warn('Web Share file failed, falling back to download:', shareErr);
    }
  }

  // 2. Direct Blob download fallback
  try {
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, method: 'download' };
  } catch (err) {
    console.error('Failed to trigger vCard download:', err);
    return { success: false, method: 'download' };
  }
}
