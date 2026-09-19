import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Download,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { User, Priority } from '../types';
import { api } from '../lib/api';

interface CsvImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  teamMembers?: User[];
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'config' | 'review' | 'importing' | 'completed';
type DuplicateHandling = 'skip' | 'overwrite' | 'import_as_duplicate';

interface FieldMapping {
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  source: string;
  priority: string;
}

// Robust RFC-4180 compliant CSV line parser
function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  // Normalize line breaks
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\t') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

export const CsvImportWizardModal: React.FC<CsvImportWizardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  teamMembers = [],
  onImportComplete,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Mapping
  const [mapping, setMapping] = useState<FieldMapping>({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
    source: '',
    priority: '',
  });

  // Config options
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('skip');
  const [assignmentMode, setAssignmentMode] = useState<'self' | 'specific' | 'round_robin' | 'unassigned'>(
    currentUser?.role === 'admin' || currentUser?.role === 'manager' ? 'round_robin' : 'self'
  );
  const [specificAssigneeId, setSpecificAssigneeId] = useState<string>(currentUser?.id || '');
  const [roundRobinIds, setRoundRobinIds] = useState<string[]>([]);

  // Pre-flight check results
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    totalIncoming: number;
    duplicateCount: number;
    cleanCount: number;
    duplicates: Array<{
      rowIndex: number;
      matchedBy: 'phone' | 'email';
      incoming: { name?: string; phone: string; email?: string; company?: string };
      existing: { id: string; name: string; phone: string; email?: string; status: string; assigned_to_name?: string; business_info?: string };
    }>;
  } | null>(null);

  // Import execution & result
  const [importProgress, setImportProgress] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-initialize round robin IDs when team members are available
  React.useEffect(() => {
    if (teamMembers.length > 0 && roundRobinIds.length === 0) {
      const activeAgents = teamMembers.filter((m) => m.role === 'agent');
      if (activeAgents.length > 0) {
        setRoundRobinIds(activeAgents.map((m) => m.id));
      } else {
        setRoundRobinIds(teamMembers.map((m) => m.id));
      }
    }
  }, [teamMembers]);

  if (!isOpen) return null;

  // Auto-detect columns heuristics
  const autoMapHeaders = (detectedHeaders: string[]) => {
    const newMapping: FieldMapping = {
      name: '',
      phone: '',
      email: '',
      company: '',
      notes: '',
      source: '',
      priority: '',
    };

    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    detectedHeaders.forEach((h) => {
      const normalized = clean(h);
      if (!newMapping.phone && (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('tel') || normalized === 'cell' || normalized === 'number')) {
        newMapping.phone = h;
      } else if (!newMapping.name && (normalized.includes('name') || normalized.includes('contact') || normalized.includes('client') || normalized === 'lead')) {
        newMapping.name = h;
      } else if (!newMapping.email && (normalized.includes('email') || normalized.includes('mail'))) {
        newMapping.email = h;
      } else if (!newMapping.company && (normalized.includes('company') || normalized.includes('business') || normalized.includes('org') || normalized.includes('account'))) {
        newMapping.company = h;
      } else if (!newMapping.notes && (normalized.includes('note') || normalized.includes('desc') || normalized.includes('comment') || normalized.includes('remark') || normalized.includes('detail'))) {
        newMapping.notes = h;
      } else if (!newMapping.source && (normalized.includes('source') || normalized.includes('campaign') || normalized.includes('channel'))) {
        newMapping.source = h;
      } else if (!newMapping.priority && (normalized.includes('prior') || normalized.includes('urgenc') || normalized.includes('level'))) {
        newMapping.priority = h;
      }
    });

    setMapping(newMapping);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const processFile = (inputFile: File) => {
    setFile(inputFile);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim().length === 0) {
          setErrorMessage('The selected file appears to be completely empty.');
          return;
        }

        const rows = parseCsvRows(text);
        if (rows.length < 2) {
          setErrorMessage('The CSV must contain at least a header row and one lead record.');
          return;
        }

        const detectedHeaders = rows[0];
        const dataRows = rows.slice(1);

        setHeaders(detectedHeaders);
        setParsedRows(dataRows);
        autoMapHeaders(detectedHeaders);
        setStep('mapping');
      } catch (err: any) {
        setErrorMessage('Failed to parse file. Please ensure it is a valid CSV or TSV file: ' + err.message);
      }
    };
    reader.readAsText(inputFile);
  };

  const downloadSampleCsv = () => {
    const sampleHeaders = 'Name,Phone,Email,Company,Notes,Source,Priority';
    const sampleRows = [
      '"Sarah Jenkins","+1 415 555 0192","sarah@acmecorp.com","Acme Logistics","Expressed interest in cold calling software via web webinar","LinkedIn Outreach","High"',
      '"Michael Torres","+1 212 555 0834","m.torres@bluewave.io","BlueWave Media","Inbound inquiry about multi-channel dialing","Cold Outreach","Normal"',
      '"Elena Rostova","+1 312 555 4920","elena@apexhealth.org","Apex Health","Follow up next week with customized enterprise pitch","Industry Directory","Normal"',
    ].join('\n');

    const csvContent = `${sampleHeaders}\n${sampleRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'voxel_sample_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Build mapped leads from parsed rows
  const getMappedLeads = () => {
    const phoneIdx = headers.indexOf(mapping.phone);
    const nameIdx = headers.indexOf(mapping.name);
    const emailIdx = headers.indexOf(mapping.email);
    const companyIdx = headers.indexOf(mapping.company);
    const notesIdx = headers.indexOf(mapping.notes);
    const sourceIdx = headers.indexOf(mapping.source);
    const priorityIdx = headers.indexOf(mapping.priority);

    return parsedRows
      .map((row) => {
        const phone = phoneIdx !== -1 ? row[phoneIdx] || '' : '';
        const name = nameIdx !== -1 ? row[nameIdx] || '' : 'Unnamed Lead';
        const email = emailIdx !== -1 ? row[emailIdx] || '' : '';
        const company = companyIdx !== -1 ? row[companyIdx] || '' : '';
        const notes = notesIdx !== -1 ? row[notesIdx] || '' : '';
        const source = sourceIdx !== -1 ? row[sourceIdx] || '' : 'CSV Import';
        let priority: Priority = 'Normal';
        if (priorityIdx !== -1) {
          const rawP = (row[priorityIdx] || '').toLowerCase();
          if (rawP.includes('high') || rawP.includes('urgent') || rawP.includes('hot') || rawP === '1') {
            priority = 'High';
          }
        }

        return {
          phone: phone.trim(),
          name: name.trim() || 'Unnamed Lead',
          email: email.trim() || undefined,
          business_info: company.trim() || undefined,
          business_notes: notes.trim() || '',
          source: source.trim() || 'CSV Import',
          priority,
        };
      })
      .filter((l) => l.phone.length > 0);
  };

  // Run duplicate check pre-flight before final confirmation
  const handleProceedToReview = async () => {
    const leads = getMappedLeads();
    if (leads.length === 0) {
      setErrorMessage('No valid leads found with phone numbers. Please map the Phone column.');
      return;
    }

    setIsCheckingDuplicates(true);
    setErrorMessage(null);

    try {
      const result = await api.checkLeadDuplicates(
        leads.map((l) => ({
          phone: l.phone,
          email: l.email,
          name: l.name,
          company: l.business_info,
        }))
      );
      setCheckResult(result);
      setStep('review');
    } catch (err: any) {
      setErrorMessage('Failed to check database duplicates: ' + err.message);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Execute the import
  const handleExecuteImport = async () => {
    const leads = getMappedLeads();
    setStep('importing');
    setErrorMessage(null);

    let defaultAssignee: string | null = null;
    let roundRobinUserIds: string[] = [];

    if (assignmentMode === 'self') {
      defaultAssignee = currentUser?.id || null;
    } else if (assignmentMode === 'specific') {
      defaultAssignee = specificAssigneeId || currentUser?.id || null;
    } else if (assignmentMode === 'round_robin') {
      roundRobinUserIds = roundRobinIds;
    }

    try {
      const res = await api.bulkImportLeads({
        leads,
        duplicateHandling,
        defaultAssignee,
        roundRobinUserIds,
      });

      setImportProgress({
        total: res.totalProcessed,
        created: res.createdCount,
        updated: res.updatedCount,
        skipped: res.skippedCount,
        errors: res.errors || [],
      });
      setStep('completed');
    } catch (err: any) {
      setErrorMessage('Bulk import encountered an error: ' + err.message);
      setStep('review');
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setHeaders([]);
    setCheckResult(null);
    setImportProgress(null);
    setErrorMessage(null);
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Lead Import Wizard</h2>
              <p className="text-xs text-stone-500">
                Bulk upload, column mapping, intelligent deduplication & assignment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleCsv}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Sample CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-stone-100/60 border-b border-stone-200 flex items-center justify-between text-xs overflow-x-auto gap-2">
          {[
            { key: 'upload', label: '1. Upload CSV' },
            { key: 'mapping', label: '2. Column Mapping' },
            { key: 'config', label: '3. Rules & Assign' },
            { key: 'review', label: '4. Deduplication Preview' },
            { key: 'completed', label: '5. Complete' },
          ].map((s, idx) => {
            const isCurrent = step === s.key;
            const isPassed =
              (s.key === 'upload' && step !== 'upload') ||
              (s.key === 'mapping' && (step === 'config' || step === 'review' || step === 'importing' || step === 'completed')) ||
              (s.key === 'config' && (step === 'review' || step === 'importing' || step === 'completed')) ||
              (s.key === 'review' && (step === 'importing' || step === 'completed')) ||
              (s.key === 'completed' && step === 'completed');

            return (
              <div
                key={s.key}
                className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${
                  isCurrent
                    ? 'text-amber-800 font-bold'
                    : isPassed
                    ? 'text-emerald-700'
                    : 'text-stone-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isCurrent
                      ? 'bg-amber-700 text-white'
                      : isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {isPassed ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Error:</strong> {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-amber-600 rounded-2xl p-10 text-center cursor-pointer transition-colors bg-stone-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .tsv, text/csv, text/tab-separated-values, text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3.5 shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-stone-800">
                  Click to select or drag and drop your spreadsheet
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm">
                  Supports standard CSV and TSV formats exported from Excel, Google Sheets, ZoomInfo, Apollo, or Salesforce.
                </p>
                <div className="mt-4 px-3 py-1 rounded-full bg-stone-200/80 text-[11px] font-medium text-stone-700">
                  Required column: Phone number
                </div>
              </div>

              {/* Sample Helper Box */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-stone-700 space-y-1">
                  <div className="font-semibold text-stone-900">Need a starter template?</div>
                  <p className="text-stone-600">
                    Download our ready-made CSV template with pre-formatted headers (Name, Phone, Email, Company, Notes, Source, Priority).
                  </p>
                  <button
                    onClick={downloadSampleCsv}
                    className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-900 font-bold underline mt-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Download Voxel Starter CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Map Spreadsheet Columns</h3>
                  <p className="text-xs text-stone-500">
                    Found <strong>{headers.length}</strong> columns and <strong>{parsedRows.length}</strong> lead rows in <em>{file?.name}</em>
                  </p>
                </div>
                <button
                  onClick={() => autoMapHeaders(headers)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Re-detect Fields
                </button>
              </div>

              {/* Mapping Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone (Required) */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      Phone Number <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">Required</span>
                  </div>
                  <select
                    value={mapping.phone}
                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                  {!mapping.phone && (
                    <p className="text-[11px] text-rose-600">Please choose the column containing phone numbers.</p>
                  )}
                </div>

                {/* Name */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <label className="text-xs font-bold text-stone-900 block">Lead / Contact Name</label>
                  <select
                    value={mapping.name}
                    onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- None (Defaults to "Unnamed Lead") --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <label className="text-xs font-bold text-stone-900 block">Email Address</label>
                  <select
                    value={mapping.email}
                    onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- Skip / None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Company / Business Info */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <label className="text-xs font-bold text-stone-900 block">Company / Business Info</label>
                  <select
                    value={mapping.company}
                    onChange={(e) => setMapping({ ...mapping, company: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- Skip / None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <label className="text-xs font-bold text-stone-900 block">Notes / Initial Briefing</label>
                  <select
                    value={mapping.notes}
                    onChange={(e) => setMapping({ ...mapping, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- Skip / None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
                  <label className="text-xs font-bold text-stone-900 block">Lead Source / Campaign</label>
                  <select
                    value={mapping.source}
                    onChange={(e) => setMapping({ ...mapping, source: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  >
                    <option value="">-- Default to "CSV Import" --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {parsedRows[0] ? `(e.g. "${parsedRows[0][headers.indexOf(h)] || ''}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Preview Table of 3 rows */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span>Live Preview (First 3 Records)</span>
                </div>
                <div className="border border-stone-200 rounded-xl overflow-x-auto bg-stone-50/30">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100/70 font-semibold text-stone-700">
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/70 text-stone-700">
                      {parsedRows.slice(0, 3).map((row, idx) => {
                        const phone = mapping.phone ? row[headers.indexOf(mapping.phone)] || '—' : '—';
                        const name = mapping.name ? row[headers.indexOf(mapping.name)] || 'Unnamed Lead' : 'Unnamed Lead';
                        const email = mapping.email ? row[headers.indexOf(mapping.email)] || '—' : '—';
                        const company = mapping.company ? row[headers.indexOf(mapping.company)] || '—' : '—';
                        const notes = mapping.notes ? row[headers.indexOf(mapping.notes)] || '—' : '—';

                        return (
                          <tr key={idx} className="hover:bg-white transition-colors">
                            <td className="p-2.5 font-medium text-stone-900">{name}</td>
                            <td className="p-2.5 font-mono text-stone-800">{phone}</td>
                            <td className="p-2.5 text-stone-500">{email}</td>
                            <td className="p-2.5 text-stone-600">{company}</td>
                            <td className="p-2.5 text-stone-500 truncate max-w-xs">{notes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIGURATION (RULES & ASSIGNMENT) */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* Duplicate Handling Strategy */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  1. Duplicate Detection Strategy
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    onClick={() => setDuplicateHandling('skip')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      duplicateHandling === 'skip'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-stone-900">Skip Duplicates</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            duplicateHandling === 'skip'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {duplicateHandling === 'skip' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        Recommended. Keeps your CRM clean by ignoring leads whose phone number or email already exists.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-emerald-700">Safe & Non-Destructive</span>
                  </label>

                  <label
                    onClick={() => setDuplicateHandling('overwrite')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      duplicateHandling === 'overwrite'
                        ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-stone-900">Update / Merge</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            duplicateHandling === 'overwrite'
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {duplicateHandling === 'overwrite' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        Merges new company details, email, and appends imported notes to the existing lead record.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-amber-700">Enriches Existing Leads</span>
                  </label>

                  <label
                    onClick={() => setDuplicateHandling('import_as_duplicate')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      duplicateHandling === 'import_as_duplicate'
                        ? 'border-stone-800 bg-stone-100 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-stone-900">Import Anyway</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            duplicateHandling === 'import_as_duplicate'
                              ? 'border-stone-800 bg-stone-800 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {duplicateHandling === 'import_as_duplicate' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        Creates a distinct new lead record even if the phone or contact is already logged in the CRM.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-semibold text-stone-600">Creates Duplicate Entries</span>
                  </label>
                </div>
              </div>

              {/* Lead Assignment */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-700" />
                  <span>2. Lead Assignment</span>
                </div>

                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') ? (
                  <div className="space-y-3 bg-stone-50/70 p-4 rounded-xl border border-stone-200">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignmentMode('round_robin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          assignmentMode === 'round_robin'
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Round-Robin Across Team
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentMode('specific')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          assignmentMode === 'specific'
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Specific Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentMode('self')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          assignmentMode === 'self'
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Assign to Me ({currentUser?.name})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentMode('unassigned')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          assignmentMode === 'unassigned'
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Unassigned Pool
                      </button>
                    </div>

                    {assignmentMode === 'round_robin' && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-stone-200 text-xs">
                        <div className="font-semibold text-stone-800">
                          Select team members included in the round-robin distribution:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {teamMembers.map((member) => {
                            const isChecked = roundRobinIds.includes(member.id);
                            return (
                              <label
                                key={member.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-stone-200 cursor-pointer hover:bg-stone-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRoundRobinIds([...roundRobinIds, member.id]);
                                    } else {
                                      setRoundRobinIds(roundRobinIds.filter((id) => id !== member.id));
                                    }
                                  }}
                                  className="rounded text-amber-700 focus:ring-amber-700"
                                />
                                <span className="font-medium text-stone-900">{member.name}</span>
                                <span className="text-[10px] text-stone-400 capitalize">({member.role})</span>
                              </label>
                            );
                          })}
                        </div>
                        {roundRobinIds.length === 0 && (
                          <p className="text-rose-600 text-[11px]">Please select at least one agent for round-robin.</p>
                        )}
                      </div>
                    )}

                    {assignmentMode === 'specific' && (
                      <div className="mt-3 space-y-1.5 pt-2 border-t border-stone-200">
                        <label className="text-xs font-semibold text-stone-800">Assign all imported leads to:</label>
                        <select
                          value={specificAssigneeId}
                          onChange={(e) => setSpecificAssigneeId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                        >
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role}) - {m.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700">
                    Imported leads will be automatically assigned to your personal pipeline (<strong>{currentUser?.name}</strong>).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & DEDUPLICATION PREVIEW */}
          {step === 'review' && checkResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Pre-Import Duplicate Analysis</h3>
                  <p className="text-xs text-stone-500">
                    Voxel checked your <strong>{checkResult.totalIncoming}</strong> incoming records against existing CRM database leads.
                  </p>
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Clean Leads</div>
                  <div className="text-xl font-bold text-emerald-700 font-mono mt-0.5">
                    {checkResult.cleanCount}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-1">Ready to create as new leads</div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Duplicates Found</div>
                  <div className="text-xl font-bold text-amber-700 font-mono mt-0.5">
                    {checkResult.duplicateCount}
                  </div>
                  <div className="text-[10px] text-amber-600 mt-1">
                    Strategy: <strong>{duplicateHandling}</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-stone-600 tracking-wider">Target Assignment</div>
                  <div className="text-xs font-bold text-stone-900 mt-1 capitalize">
                    {assignmentMode === 'round_robin'
                      ? `Round Robin (${roundRobinIds.length} agents)`
                      : assignmentMode === 'specific'
                      ? teamMembers.find((m) => m.id === specificAssigneeId)?.name || 'Specific Agent'
                      : assignmentMode === 'self'
                      ? currentUser?.name || 'Self'
                      : 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">Ready for calling queue</div>
                </div>
              </div>

              {/* Duplicates List */}
              {checkResult.duplicateCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Duplicate Conflicts Breakdown ({checkResult.duplicates.length})</span>
                    </span>
                    <span className="text-stone-500 text-[11px]">
                      Action: {duplicateHandling === 'skip' ? 'Will be skipped' : duplicateHandling === 'overwrite' ? 'Will merge into existing' : 'Will create duplicate record'}
                    </span>
                  </div>

                  <div className="border border-stone-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-stone-200 bg-stone-50/40 text-xs">
                    {checkResult.duplicates.map((dup, idx) => (
                      <div key={idx} className="p-3 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-stone-900 flex items-center gap-2">
                            <span>{dup.incoming.name || 'Unnamed Lead'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
                              Matched via {dup.matchedBy}
                            </span>
                          </div>
                          <div className="text-stone-500 text-[11px]">
                            Phone: <strong className="text-stone-700">{dup.incoming.phone}</strong>
                            {dup.incoming.email && <span> &bull; Email: {dup.incoming.email}</span>}
                          </div>
                        </div>

                        <div className="text-right sm:border-l sm:border-stone-200 sm:pl-3 text-[11px] text-stone-500">
                          <div>Existing: <strong className="text-stone-800">{dup.existing.name}</strong></div>
                          <div>Status: <span className="capitalize text-stone-700">{dup.existing.status}</span> ({dup.existing.assigned_to_name || 'Unassigned'})</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No duplicate phone numbers or emails were detected! All {checkResult.totalIncoming} records are clean.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: IMPORTING IN PROGRESS */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-3 border-amber-700 border-t-transparent animate-spin mx-auto" />
              <h3 className="text-base font-bold text-stone-900">Importing leads into Voxel CRM...</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Validating phone formats, assigning reps, and updating database pipelines. Please wait.
              </p>
            </div>
          )}

          {/* STEP 6: COMPLETED */}
          {step === 'completed' && importProgress && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">Lead Import Successful!</h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Your prospect list has been processed and is now available in your active pipelines and calling queues.
                </p>
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-2xl font-bold text-emerald-700 font-mono">
                    {importProgress.created}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800 mt-1">Leads Created</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-2xl font-bold text-amber-700 font-mono">
                    {importProgress.updated}
                  </div>
                  <div className="text-xs font-semibold text-amber-800 mt-1">Leads Merged/Updated</div>
                </div>
                <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 text-center">
                  <div className="text-2xl font-bold text-stone-700 font-mono">
                    {importProgress.skipped}
                  </div>
                  <div className="text-xs font-semibold text-stone-600 mt-1">Duplicates Skipped</div>
                </div>
              </div>

              {/* Errors report if any */}
              {importProgress.errors && importProgress.errors.length > 0 && (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 text-xs">
                  <div className="font-semibold text-stone-800">Skipped Row Warnings:</div>
                  <ul className="list-disc pl-5 text-[11px] text-stone-600 max-h-24 overflow-y-auto space-y-0.5">
                    {importProgress.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div>
            {step !== 'upload' && step !== 'importing' && step !== 'completed' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'mapping') setStep('upload');
                  else if (step === 'config') setStep('mapping');
                  else if (step === 'review') setStep('config');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200/70 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('config')}
                disabled={!mapping.phone}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>Next: Assignment & Rules</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'config' && (
              <button
                type="button"
                onClick={handleProceedToReview}
                disabled={isCheckingDuplicates || (assignmentMode === 'round_robin' && roundRobinIds.length === 0)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isCheckingDuplicates ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Duplicates...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Check Duplicates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}

            {step === 'review' && (
              <button
                type="button"
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Execute Import ({checkResult?.cleanCount || 0} New)</span>
              </button>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={() => {
                  onImportComplete();
                  onClose();
                  handleReset();
                }}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>Done & View Leads</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
