import type { Lead } from '../types';

export const PRESET_QA_QUESTIONS = [
  'Location / Address: ?',
  'Number of Daily Parcels: ?',
  'Current Courier Service Provider: ?',
  'Primary Business / Industry: ?',
  'Average Parcel Weight / Size: ?',
  'Current Pain Point / Delivery Issues: ?',
  'Preferred Delivery Speed / SLA: ?',
  'COD Remittance Frequency: ?',
  'Cash Flow / Daily COD Value: ?',
  'Return / RTO (Return to Origin) %: ?',
  'Preferred Bank for COD Transfer: ?',
  'Number of Warehouses / Dispatch Centers: ?',
  'Daily Pickup Timing & Frequency: ?',
  'Flyers & Packaging Material Needed: ?',
  'Key Decision Maker & Direct Phone: ?',
  'Expected Onboarding / Trial Date: ?',
];

export function escapeCsvField(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '""';
  let text = String(str).trim();
  // Prevent CSV Formula Injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  text = text.replace(/"/g, '""');
  return `"${text}"`;
}

export function getLeadAnswerForQuestion(lead: Lead, question: string): string {
  if (!lead) return '';
  const qaData = lead.qa_data || {};
  // 1. Direct key match
  if (qaData[question] !== undefined && qaData[question] !== null && String(qaData[question]).trim()) {
    return String(qaData[question]).trim();
  }
  // 2. Normalized key match
  const normTarget = question.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase();
  for (const [key, val] of Object.entries(qaData)) {
    const normKey = key.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase();
    if (normKey === normTarget && val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  // 3. Search qa_entries
  if (Array.isArray(lead.qa_entries)) {
    const entry = lead.qa_entries.find((e) => {
      if (!e || !e.question) return false;
      const normE = e.question.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase();
      return normE === normTarget;
    });
    if (entry && entry.answer && String(entry.answer).trim()) {
      return String(entry.answer).trim();
    }
  }
  return '';
}

export function collectAllDynamicQAQuestions(leads: Lead[]): {
  presetQuestions: string[];
  customQuestions: string[];
  allQuestions: string[];
} {
  const customQuestionsSet = new Set<string>();
  const normalizedPresets = new Set(
    PRESET_QA_QUESTIONS.map((q) => q.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase())
  );

  leads.forEach((lead) => {
    // From qa_data
    if (lead.qa_data && typeof lead.qa_data === 'object') {
      Object.keys(lead.qa_data).forEach((rawQ) => {
        const norm = rawQ.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase();
        if (norm && !normalizedPresets.has(norm)) {
          customQuestionsSet.add(rawQ.trim());
        }
      });
    }
    // From qa_entries
    if (Array.isArray(lead.qa_entries)) {
      lead.qa_entries.forEach((e) => {
        if (e && e.question) {
          const norm = e.question.replace(/: \?$/, '').replace(/\?$/, '').trim().toLowerCase();
          if (norm && !normalizedPresets.has(norm)) {
            customQuestionsSet.add(e.question.trim());
          }
        }
      });
    }
  });

  const customQuestions = Array.from(customQuestionsSet);
  return {
    presetQuestions: PRESET_QA_QUESTIONS,
    customQuestions,
    allQuestions: [...PRESET_QA_QUESTIONS, ...customQuestions],
  };
}

export function generateLeadsCsv(leads: Lead[], filenamePrefix = 'leads_export'): void {
  const { allQuestions } = collectAllDynamicQAQuestions(leads);

  const baseHeaders = [
    'Lead ID',
    'Name',
    'Phone Number',
    'Email',
    'Status',
    'Priority',
    'Assigned Agent',
    'Source',
    'Created At',
    'Last Updated',
    'Total Calls',
    'Base Notes',
    'All Call Logs',
  ];

  // Questions as columns at the end
  const headers = [...baseHeaders, ...allQuestions];

  const rows = leads.map((lead) => {
    const concatenatedNotes = [
      lead.business_notes ? `[Base Notes]: ${lead.business_notes}` : '',
      ...(lead.call_logs || []).map(
        (c) =>
          `[${c.timestamp} - ${c.outcome_tag}]: ${c.summary} | ${c.full_notes || ''}`
      ),
    ]
      .filter(Boolean)
      .join('\n---\n');

    const baseValues = [
      escapeCsvField(lead.id),
      escapeCsvField(lead.name),
      escapeCsvField(lead.phone),
      escapeCsvField(lead.email || ''),
      escapeCsvField(lead.status),
      escapeCsvField(lead.priority),
      escapeCsvField(lead.assigned_to_name || lead.assigned_to || ''),
      escapeCsvField(lead.source),
      escapeCsvField(lead.created_at),
      escapeCsvField(lead.updated_at),
      escapeCsvField(lead.call_logs ? lead.call_logs.length : 0),
      escapeCsvField(lead.business_notes || ''),
      escapeCsvField(concatenatedNotes),
    ];

    const qaValues = allQuestions.map((q) => {
      const answer = getLeadAnswerForQuestion(lead, q);
      return escapeCsvField(answer);
    });

    return [...baseValues, ...qaValues].join(',');
  });

  const csvContent = [headers.map(escapeCsvField).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
