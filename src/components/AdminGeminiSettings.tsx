import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  RefreshCw,
  Send,
  Zap,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AdminGeminiConfig } from '../types';

export const AdminGeminiSettings: React.FC = () => {
  const [config, setConfig] = useState<AdminGeminiConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.7-flash');
  const [showKey, setShowKey] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.getAdminGeminiConfig();
      setConfig(res.config);
      setSelectedModel(res.config.model || 'gemini-3.7-flash');
    } catch (err: any) {
      console.error('Failed to fetch Gemini config:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to load Gemini configuration.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setTestResult(null);

    try {
      const res = await api.updateAdminGeminiConfig({
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        model: selectedModel,
        verify: true,
      });

      setConfig(res.config);
      setApiKeyInput(''); // Clear input after successful save

      if (res.verification) {
        setTestResult({
          success: res.verification.success,
          latencyMs: res.verification.latencyMs,
          message: res.verification.message,
        });
      }

      setStatusMessage({
        type: res.verification && !res.verification.success ? 'error' : 'success',
        text: res.message || 'Gemini configuration successfully saved and verified!',
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to save Gemini configuration.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage(null);

    try {
      const res = await api.testAdminGeminiConfig({
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        model: selectedModel,
      });

      setTestResult({
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.message,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Verified! Google Gemini responded in ${res.latencyMs}ms using ${res.model}.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Connection test failed: ${res.message}`,
        });
      }
    } catch (err: any) {
      console.error('Test connection error:', err);
      setTestResult({
        success: false,
        message: err?.message || 'Connection test failed. Please verify API key.',
      });
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Connection test failed. Please verify API key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const modelOptions = [
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      tag: 'Default & Recommended',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: 'Ultra-low latency, lightning-quick responses. Ideal for rapid call notes structuring, live smart WhatsApp generation, and dialer workflows.',
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      tag: 'Next-Gen Flash',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      description: 'High-speed reasoning with increased nuance for multi-touch follow-up writing and deep context parsing.',
    },
    {
      id: 'gemini-3.8-pro',
      name: 'Gemini 3.8 Pro',
      tag: 'Deep Reasoning',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      description: 'Maximum analytic capability for complex enterprise accounts, high-stakes objection handling, and exhaustive churn diagnostics.',
    },
  ];

  if (isLoading) {
    return (
      <div className="py-16 text-center text-stone-500 text-xs flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-700" />
        <span>Loading Gemini configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 shadow-xs flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
            Admin Controlled AI Hub
          </h4>
          <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
            Configure the Gemini API key once here. The backend automatically shares this single key with all sales reps and managers. Team members instantly gain access to <strong>Enhance with AI</strong> notes, <strong>Smart WhatsApp/Email composer</strong>, and <strong>Lead Health Scores</strong> without ever exposing or requiring individual keys.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>
              {testResult.success ? 'Gemini API connection test passed!' : 'Connection test failed:'}{' '}
              {testResult.message}
            </span>
          </div>
          {testResult.latencyMs && (
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
              {testResult.latencyMs}ms
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gemini API Key Field */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>Gemini API Key</span>
            </label>
            {config?.configured ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                Active &amp; Configured ({config.maskedKey})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3 h-3" />
                No Key Configured
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={config?.configured ? `Leave blank to keep active key (${config.maskedKey})` : 'AIzaSy... (Paste Gemini API Key)'}
                className="w-full px-3.5 py-2.5 pr-10 text-xs font-mono rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-stone-900"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || (!config?.configured && !apiKeyInput.trim())}
              title="Test connection with Google Gemini"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-800 text-xs font-bold border border-stone-200 transition-colors cursor-pointer shrink-0"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-600" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-700" />
              )}
              <span className="hidden sm:inline">Test Connection</span>
            </button>
          </div>

          <p className="text-[11px] text-stone-500 flex items-center gap-1">
            <Info className="w-3 h-3 text-stone-400 shrink-0" />
            <span>
              Saving will automatically verify the API key with Google. Keys are securely stored in server memory and masked.
            </span>
          </p>
        </div>

        {/* Model Selection */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-700" />
              <span>Active Gemini Model</span>
            </label>
            <span className="text-[11px] text-stone-500">
              Selected: <code className="font-mono text-amber-800 font-bold">{selectedModel}</code>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {modelOptions.map((opt) => {
              const isSelected = selectedModel === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedModel(opt.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/20'
                      : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-bold text-stone-900">{opt.name}</span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${opt.badgeClass}`}
                      >
                        {opt.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-normal">{opt.description}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px]">
                    <span className="font-mono text-stone-400">{opt.id}</span>
                    <span
                      className={`font-bold ${
                        isSelected ? 'text-amber-800 font-extrabold' : 'text-stone-400'
                      }`}
                    >
                      {isSelected ? '● Active' : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || (!config?.configured && !apiKeyInput.trim())}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 text-xs font-bold border border-stone-300 transition-colors cursor-pointer"
          >
            {isTesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-600" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-700" />
            )}
            <span>Test API Connection</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Verifying & Saving...' : 'Save & Verify Connection'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
