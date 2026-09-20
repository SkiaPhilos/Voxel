import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import type {
  EnhancedCallNotes,
  FollowUpComposerResult,
  FollowUpTone,
  LeadHealthAssessment,
  OutcomeTag,
  Lead,
  AdminGeminiConfig,
} from '../src/types.js';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Recommended Default - High speed, low latency, advanced reasoning', isDefault: true },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Next-gen multimodal speed & precision' },
  { id: 'gemini-3.8-pro', name: 'Gemini 3.8 Pro', description: 'Deep reasoning & complex sales synthesis' },
];

const CONFIG_FILE = path.join(process.cwd(), 'data', 'gemini-config.json');

interface GeminiStoredSettings {
  apiKey?: string;
  model: string;
  updatedAt?: string;
}

let cachedSettings: GeminiStoredSettings = loadStoredSettings();
let aiClient: GoogleGenAI | null = null;
let lastUsedApiKey: string | null = null;

function loadStoredSettings(): GeminiStoredSettings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        apiKey: parsed.apiKey || undefined,
        model: parsed.model || 'gemini-3.7-flash',
        updatedAt: parsed.updatedAt,
      };
    }
  } catch (e) {
    console.warn('Could not read gemini-config.json, using defaults:', e);
  }
  return { model: 'gemini-3.7-flash' };
}

function saveStoredSettings(settings: GeminiStoredSettings) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write gemini-config.json:', e);
  }
}

export function getActiveApiKey(): string | null {
  return cachedSettings.apiKey || process.env.GEMINI_API_KEY || null;
}

export function getActiveModel(): string {
  return cachedSettings.model || 'gemini-3.7-flash';
}

function getGenAI(): GoogleGenAI | null {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    return null;
  }
  if (!aiClient || lastUsedApiKey !== apiKey) {
    lastUsedApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 60000, // 60 seconds timeout (resilient to slow connections and high model demands)
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function getAdminGeminiConfig(): AdminGeminiConfig {
  const activeKey = getActiveApiKey();
  const hasApiKey = Boolean(activeKey);
  let keyPreview = 'Not configured';
  let source: 'admin' | 'env' | 'none' = 'none';

  if (cachedSettings.apiKey) {
    source = 'admin';
    keyPreview = maskApiKey(cachedSettings.apiKey);
  } else if (process.env.GEMINI_API_KEY) {
    source = 'env';
    keyPreview = maskApiKey(process.env.GEMINI_API_KEY);
  }

  return {
    hasApiKey,
    keyPreview,
    configured: hasApiKey,
    maskedKey: keyPreview,
    model: getActiveModel(),
    source,
    availableModels: AVAILABLE_GEMINI_MODELS,
  };
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return '••••••••';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function updateAdminGeminiConfig(payload: { apiKey?: string; model?: string }): AdminGeminiConfig {
  const newSettings: GeminiStoredSettings = {
    ...cachedSettings,
    model: payload.model && payload.model.trim() ? payload.model.trim() : (cachedSettings.model || 'gemini-3.7-flash'),
    updatedAt: new Date().toISOString(),
  };

  if (payload.apiKey !== undefined) {
    const trimmedKey = payload.apiKey.trim();
    if (trimmedKey) {
      newSettings.apiKey = trimmedKey;
    } else {
      delete newSettings.apiKey;
    }
  }

  cachedSettings = newSettings;
  saveStoredSettings(newSettings);
  // Reset client so next request picks up new key
  aiClient = null;
  lastUsedApiKey = null;

  return getAdminGeminiConfig();
}

export async function testAdminGeminiConfig(testConfig?: { apiKey?: string; model?: string }): Promise<{
  success: boolean;
  model: string;
  message: string;
  latencyMs: number;
}> {
  const apiKeyToTest = (testConfig?.apiKey && testConfig.apiKey.trim()) || getActiveApiKey();
  const modelToTest = (testConfig?.model && testConfig.model.trim()) || getActiveModel();

  if (!apiKeyToTest) {
    return {
      success: false,
      model: modelToTest,
      message: 'No API key provided or found in environment.',
      latencyMs: 0,
    };
  }

  const startTime = Date.now();
  const testAi = new GoogleGenAI({
    apiKey: apiKeyToTest,
    httpOptions: {
      timeout: 60000, // 60 seconds timeout
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  // Attempt test call with retry on 503 high demands or 429 rate limit
  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await testAi.models.generateContent({
        model: modelToTest,
        contents: 'Respond with exactly: {"status":"active","ping":"pong"}',
        config: {
          responseMimeType: 'application/json',
        },
      });

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        model: modelToTest,
        message: `Connection successful! ${modelToTest} responded in ${latencyMs}ms.`,
        latencyMs,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || '');
      const isOverloaded =
        errMsg.includes('503') ||
        errMsg.includes('high demands') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('429');

      if (attempt < 2 && isOverloaded) {
        // Wait 2 seconds before second attempt
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
  }

  const latencyMs = Date.now() - startTime;
  let userFriendlyMsg = lastError?.message || 'Connection test failed';
  if (
    userFriendlyMsg.includes('503') ||
    userFriendlyMsg.includes('high demands') ||
    userFriendlyMsg.includes('overloaded')
  ) {
    userFriendlyMsg = `Model ${modelToTest} is temporarily experiencing high demand from Google. A retry was attempted after 2s. Slow responses are normal during peaks; you can also try switching to gemini-2.5-flash.`;
  }

  return {
    success: false,
    model: modelToTest,
    message: userFriendlyMsg,
    latencyMs,
  };
}

/**
 * 1. Enhance messy shorthand call notes into structured takeaways, pain points, sentiment, and next actions
 */
export async function enhanceCallNotesWithGemini(params: {
  leadName: string;
  businessInfo?: string;
  outcomeTag: OutcomeTag;
  rawNotes: string;
  previousContext?: string;
}): Promise<EnhancedCallNotes> {
  const { leadName, businessInfo, outcomeTag, rawNotes, previousContext } = params;
  const ai = getGenAI();

  if (!ai) {
    // Robust heuristic fallback if API key is not configured
    return fallbackEnhanceCallNotes(params);
  }

  const prompt = `You are an elite B2B sales operations assistant. A cold-calling sales representative just finished a phone conversation and typed quick, messy shorthand notes.
Transform these raw shorthand notes into clean, structured CRM documentation.

Lead Name: ${leadName || 'Unknown Prospect'}
Business / Company: ${businessInfo || 'N/A'}
Call Outcome: ${outcomeTag}
Previous Interaction Context: ${previousContext || 'First known outreach'}
Raw Rep Notes:
"${rawNotes}"

Respond with a JSON object matching this exact schema:
{
  "cleanSummary": "A single crisp, professional sentence summarizing the call outcome and core conclusion (max 20 words)",
  "coreTakeaways": ["Key discussion point 1", "Key discussion point 2", "Key discussion point 3"],
  "painPoints": ["Specific business challenge, hesitation, or pain point voiced by the prospect (or 'None explicitly stated')"],
  "sentiment": "Positive" | "Neutral" | "Skeptical" | "Frustrated",
  "nextActions": ["Specific, actionable next step for the sales rep"],
  "formattedNotes": "A formatted markdown block containing a summary line, bulleted takeaways, pain points, and next actions ready to paste into the CRM log"
}`;

  try {
    const response = await ai.models.generateContent({
      model: getActiveModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text) as EnhancedCallNotes;
    // Validate fields
    return {
      cleanSummary: parsed.cleanSummary || `${outcomeTag} call logged with ${leadName}.`,
      coreTakeaways: Array.isArray(parsed.coreTakeaways) ? parsed.coreTakeaways : [rawNotes],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      sentiment: ['Positive', 'Neutral', 'Skeptical', 'Frustrated'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'Neutral',
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : ['Schedule follow-up'],
      formattedNotes: parsed.formattedNotes || formatMarkdownNotes(parsed),
    };
  } catch (error) {
    console.warn('Gemini call note enhancement failed, using local heuristic fallback:', error);
    return fallbackEnhanceCallNotes(params);
  }
}

function formatMarkdownNotes(data: Partial<EnhancedCallNotes>): string {
  const parts: string[] = [];
  if (data.cleanSummary) parts.push(`**Executive Summary:** ${data.cleanSummary}`);
  if (data.sentiment) parts.push(`**Prospect Sentiment:** ${data.sentiment}`);
  if (data.coreTakeaways && data.coreTakeaways.length > 0) {
    parts.push(`**Key Takeaways:**\n${data.coreTakeaways.map((t) => `- ${t}`).join('\n')}`);
  }
  if (data.painPoints && data.painPoints.length > 0) {
    parts.push(`**Pain Points / Hesitations:**\n${data.painPoints.map((p) => `- ${p}`).join('\n')}`);
  }
  if (data.nextActions && data.nextActions.length > 0) {
    parts.push(`**Recommended Next Steps:**\n${data.nextActions.map((a) => `- ${a}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

function fallbackEnhanceCallNotes(params: {
  leadName: string;
  businessInfo?: string;
  outcomeTag: OutcomeTag;
  rawNotes: string;
}): EnhancedCallNotes {
  const { leadName, outcomeTag, rawNotes } = params;
  const lines = rawNotes
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let sentiment: EnhancedCallNotes['sentiment'] = 'Neutral';
  if (outcomeTag === 'Interested' || outcomeTag === 'Closed/Matured') sentiment = 'Positive';
  if (outcomeTag === 'Service Denied') sentiment = 'Frustrated';
  if (outcomeTag === 'Busy' || outcomeTag === "Couldn't Connect") sentiment = 'Neutral';

  const cleanSummary = lines[0]
    ? `${outcomeTag}: ${lines[0]}`
    : `${outcomeTag} touchpoint logged with ${leadName}.`;

  const coreTakeaways = lines.length > 0 ? lines : ['Completed call touchpoint with lead.'];
  const painPoints = outcomeTag === 'Service Denied' ? ['Service not currently aligned with prospect needs.'] : [];
  const nextActions =
    outcomeTag === 'Interested' || outcomeTag === 'Call Back Later'
      ? ['Review notes and initiate scheduled follow-up outreach.']
      : ['Maintain record in cadence pipeline.'];

  const res: EnhancedCallNotes = {
    cleanSummary,
    coreTakeaways,
    painPoints,
    sentiment,
    nextActions,
    formattedNotes: '',
  };
  res.formattedNotes = formatMarkdownNotes(res);
  return res;
}

/**
 * 2. Generate contextual follow-up messages tailored to the lead, outcome, and channel (WhatsApp, Email, SMS)
 */
export async function composeFollowUpWithGemini(params: {
  leadName: string;
  businessInfo?: string;
  outcomeTag: OutcomeTag;
  callNotes?: string;
  tone?: FollowUpTone;
  agentName?: string;
}): Promise<FollowUpComposerResult> {
  const { leadName, businessInfo, outcomeTag, callNotes, tone = 'professional', agentName = 'Sales Representative' } = params;
  const ai = getGenAI();

  if (!ai) {
    return fallbackComposeFollowUp(params);
  }

  const prompt = `You are a high-performing sales copywriter for a modern B2B SaaS / service team.
Generate three tailored follow-up messages for a prospect who was just contacted.

Lead Name: ${leadName || 'Valued Contact'}
Company / Business: ${businessInfo || 'their business'}
Call Outcome: ${outcomeTag}
Tone of Voice: ${tone} (e.g. professional, warm_casual, urgent_direct, or value_focused)
Call Notes / Context: "${callNotes || 'Discussed product offering and scheduled follow-up'}"
Sender / Rep Name: ${agentName}

Provide tailored message variations for WhatsApp, Email, and SMS.
- WhatsApp: Conversational, friendly, concise, using 1-2 relevant emojis, clear value hook, and a low-friction question.
- Email: Needs a catchy, punchy Subject line, professional greeting, 2-3 short paragraphs or bullet points highlighting value, and a clear call to action.
- SMS: Ultra-crisp text (under 160 characters if possible, or 2 short punchy sentences max) that feels personal and non-spammy.

Respond with a JSON object matching this exact schema:
{
  "whatsapp": "string (full text ready to send via WhatsApp)",
  "emailSubject": "string (subject line for email)",
  "emailBody": "string (full email body text including greeting and sign-off)",
  "sms": "string (concise SMS message)"
}`;

  try {
    const response = await ai.models.generateContent({
      model: getActiveModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text) as FollowUpComposerResult;
    return {
      whatsapp: parsed.whatsapp || `Hi ${leadName}, thank you for taking the time to speak earlier! Looking forward to our next chat. - ${agentName}`,
      emailSubject: parsed.emailSubject || `Following up on our conversation — ${businessInfo || 'Voxel'}`,
      emailBody: parsed.emailBody || `Hi ${leadName},\n\nThank you for speaking with me earlier today. Following up as discussed.\n\nBest regards,\n${agentName}`,
      sms: parsed.sms || `Hi ${leadName}, thanks for chatting earlier! Following up as promised. - ${agentName}`,
    };
  } catch (error) {
    console.warn('Gemini follow-up composer failed, using local fallback:', error);
    return fallbackComposeFollowUp(params);
  }
}

function fallbackComposeFollowUp(params: {
  leadName: string;
  businessInfo?: string;
  outcomeTag: OutcomeTag;
  callNotes?: string;
  agentName?: string;
}): FollowUpComposerResult {
  const { leadName, businessInfo, outcomeTag, agentName = 'Our Team' } = params;
  const companyStr = businessInfo ? ` for ${businessInfo}` : '';

  if (outcomeTag === 'Interested') {
    return {
      whatsapp: `Hi ${leadName}! 👋 Great speaking with you earlier${companyStr}. As discussed, I've reserved time to share the overview and pricing details. Let me know if tomorrow works for a quick walkthrough!`,
      emailSubject: `Next steps for ${leadName} — Overview & Details`,
      emailBody: `Hi ${leadName},\n\nIt was a pleasure speaking with you today regarding solutions${companyStr}.\n\nAs discussed during our call, I'm following up with the key points we covered. I'd love to show you a quick 10-minute demonstration of how this will streamline your operations.\n\nLooking forward to connecting soon!\n\nBest regards,\n${agentName}`,
      sms: `Hi ${leadName}, great speaking earlier! Looking forward to sharing our details with you tomorrow. Best, ${agentName}`,
    };
  }

  if (outcomeTag === 'Call Back Later') {
    return {
      whatsapp: `Hi ${leadName}! Following up from our brief phone chat earlier. I have our next follow-up marked on my calendar. Looking forward to reconnecting! 📞`,
      emailSubject: `Following up — Connecting at a better time`,
      emailBody: `Hi ${leadName},\n\nThank you for taking my call earlier. I understand you were in the middle of something, so I've noted to reconnect with you at the time requested.\n\nIf anything urgent comes up beforehand, please don't hesitate to reply directly.\n\nBest regards,\n${agentName}`,
      sms: `Hi ${leadName}, thanks for picking up earlier! I've noted to reconnect with you at the agreed time. - ${agentName}`,
    };
  }

  return {
    whatsapp: `Hi ${leadName}! Tried reaching you earlier regarding ${businessInfo || 'our sales platform'}. When you have a moment, let me know when is best to reconnect!`,
    emailSubject: `Checking in regarding ${businessInfo || 'opportunities'}`,
    emailBody: `Hi ${leadName},\n\nI tried connecting with you earlier by phone today. I'd love to share how we can support your team${companyStr}.\n\nWhen would be a convenient time for a brief 3-minute chat?\n\nBest,\n${agentName}`,
    sms: `Hi ${leadName}, tried reaching you earlier! Would love to connect for 2 mins when you're free. - ${agentName}`,
  };
}

/**
 * 3. AI Lead Health & Churn Risk Score
 * Diagnoses lead temperature, evaluates cold decay, and recommends high-yield tactics.
 */
export async function assessLeadHealthWithGemini(params: {
  lead: Lead;
  daysCold: number;
}): Promise<LeadHealthAssessment> {
  const { lead, daysCold } = params;
  const ai = getGenAI();

  const totalLogs = lead.call_logs?.length || 0;
  const lastLog = lead.call_logs?.[0];
  const lastOutcome = lastLog?.outcome_tag || 'Never Contacted';
  const recentOutcomes = lead.call_logs?.slice(0, 4).map((c) => c.outcome_tag) || [];

  if (!ai) {
    return fallbackAssessLeadHealth(lead, daysCold);
  }

  const prompt = `You are a revenue operations data scientist analyzing a sales CRM prospect for conversion health and churn/disengagement risk.

Lead Details:
- Name: ${lead.name}
- Company / Business: ${lead.business_info || lead.business_notes || 'N/A'}
- Lead Status: ${lead.status}
- Priority: ${lead.priority}
- Days Since Last Contact Attempt: ${daysCold} days
- Total Touchpoint Count: ${totalLogs} calls
- Most Recent Outcome: ${lastOutcome}
- Recent Outcome Trend: [${recentOutcomes.join(' -> ')}]
- Latest Call Notes: "${lastLog?.full_notes || lastLog?.summary || 'No call log notes'}"
- Next Follow-Up Scheduled: ${lead.next_action_at ? 'Yes' : 'No follow-up scheduled'}

Analyze this lead and compute:
1. Health Score (0 to 100 integer, where 90+ is highly engaged, 60-89 is healthy/warm, 35-59 is cooling down, 0-34 is critically at-risk of going cold/dead).
2. Health Category: "Hot" | "Warm" | "Cooling" | "At-Risk"
3. Churn / Drop-Off Risk: "Low" | "Medium" | "High" | "Critical"
4. Risk Diagnosis: A concise 1-2 sentence explanation of why the lead holds this rating.
5. Recommended Tactic: A direct, practical tactical instruction for the sales rep's next outreach step.
6. Decay Factors: 2 to 4 bullet items identifying signals (e.g. "7 days without touch", "Unreachable twice", "High priority flag maintained").

Respond with a JSON object matching this exact schema:
{
  "healthScore": number,
  "category": "Hot" | "Warm" | "Cooling" | "At-Risk",
  "churnRisk": "Low" | "Medium" | "High" | "Critical",
  "riskDiagnosis": "string",
  "recommendedTactic": "string",
  "decayFactors": ["string", "string"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: getActiveModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text) as Partial<LeadHealthAssessment>;
    const score = typeof parsed.healthScore === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.healthScore))) : 50;

    let category: LeadHealthAssessment['category'] = 'Cooling';
    if (score >= 80) category = 'Hot';
    else if (score >= 60) category = 'Warm';
    else if (score >= 35) category = 'Cooling';
    else category = 'At-Risk';

    let churnRisk: LeadHealthAssessment['churnRisk'] = 'Medium';
    if (score >= 80) churnRisk = 'Low';
    else if (score >= 60) churnRisk = 'Medium';
    else if (score >= 35) churnRisk = 'High';
    else churnRisk = 'Critical';

    const config = getAdminGeminiConfig();
    return {
      leadId: lead.id,
      healthScore: score,
      category: parsed.category || category,
      churnRisk: parsed.churnRisk || churnRisk,
      riskDiagnosis: parsed.riskDiagnosis || `Lead has ${totalLogs} call attempts and has been untouched for ${daysCold} days.`,
      recommendedTactic: parsed.recommendedTactic || 'Initiate multi-channel outreach via WhatsApp or direct phone.',
      decayFactors: Array.isArray(parsed.decayFactors) && parsed.decayFactors.length > 0
        ? parsed.decayFactors
        : [`${daysCold} days since last contact`, `Last outcome was ${lastOutcome}`],
      assessedAt: new Date().toISOString(),
      isAiPowered: true,
      provider: 'gemini',
      modelUsed: config.model || 'gemini-2.5-flash',
    };
  } catch (error) {
    console.warn('Gemini lead health analysis failed, using local fallback:', error);
    return fallbackAssessLeadHealth(lead, daysCold);
  }
}

function fallbackAssessLeadHealth(lead: Lead, daysCold: number): LeadHealthAssessment {
  let score = 70;
  const factors: string[] = [];

  // Decay based on days cold
  if (daysCold >= 10) {
    score -= 35;
    factors.push(`${daysCold} days without contact (Critical cold decay)`);
  } else if (daysCold >= 5) {
    score -= 20;
    factors.push(`${daysCold} days since last call attempt`);
  } else if (daysCold <= 1) {
    score += 15;
    factors.push('Recently engaged (within 24 hours)');
  }

  // Outcome based adjustment
  const lastLog = lead.call_logs?.[0];
  const lastOutcome = lastLog?.outcome_tag;

  if (lastOutcome === 'Interested') {
    score += 25;
    factors.push('Positive interest expressed on last call');
  } else if (lastOutcome === 'Closed/Matured') {
    score = 95;
    factors.push('Deal closed and converted');
  } else if (lastOutcome === 'Call Back Later') {
    score += 10;
    factors.push('Follow-up scheduled with prospect agreement');
  } else if (lastOutcome === 'Busy' || lastOutcome === "Couldn't Connect") {
    score -= 15;
    factors.push('Unreached on latest attempt');
  } else if (lastOutcome === 'Service Denied') {
    score = 15;
    factors.push('Prospect formally declined service');
  }

  // Priority bonus
  if (lead.priority === 'High') {
    score += 5;
    factors.push('Designated as High Priority account');
  }

  // Bound score
  score = Math.max(5, Math.min(99, Math.round(score)));

  let category: LeadHealthAssessment['category'] = 'Cooling';
  let churnRisk: LeadHealthAssessment['churnRisk'] = 'Medium';
  let recommendedTactic = 'Follow up with a multi-touch phone call and WhatsApp summary.';

  if (score >= 80) {
    category = 'Hot';
    churnRisk = 'Low';
    recommendedTactic = 'Lock in decision-maker meeting promptly while interest is active.';
  } else if (score >= 60) {
    category = 'Warm';
    churnRisk = 'Medium';
    recommendedTactic = 'Provide relevant value proof-points and confirm scheduled call.';
  } else if (score >= 35) {
    category = 'Cooling';
    churnRisk = 'High';
    recommendedTactic = 'Re-engage via alternate communication channel (WhatsApp or Email).';
  } else {
    category = 'At-Risk';
    churnRisk = 'Critical';
    recommendedTactic = 'Execute re-activation offer or reassess account qualification.';
  }

  return {
    leadId: lead.id,
    healthScore: score,
    category,
    churnRisk,
    riskDiagnosis: `Rule-based evaluation (${daysCold} days untouched, last outcome: ${lastOutcome || 'Pending'}).`,
    recommendedTactic,
    decayFactors: factors,
    assessedAt: new Date().toISOString(),
    isAiPowered: false,
    provider: 'heuristic',
  };
}

export interface WhatsAppInquiryClassification {
  isBusinessInquiry: boolean;
  confidenceScore: number;
  inquiryCategory: 'pricing' | 'service_inquiry' | 'consultation' | 'general_question' | 'support' | 'personal_or_casual' | 'spam';
  prospectName?: string;
  extractedProductOrInterest?: string;
  summary: string;
  suggestedPriority: 'High' | 'Normal';
  isAiPowered: boolean;
  modelUsed?: string;
}

export async function classifyInboundWhatsAppMessage(params: {
  senderPhone: string;
  senderName?: string;
  messageText: string;
}): Promise<WhatsAppInquiryClassification> {
  const { senderPhone, senderName, messageText } = params;
  const apiKey = getActiveApiKey();
  const model = getActiveModel();

  if (apiKey) {
    try {
      const ai = getGenAI();
      if (ai) {
        const prompt = `You are an elite B2B/B2C Inbound Sales Lead Classifier for a CRM.
Analyze this incoming WhatsApp message received on a sales agent's number.
Determine whether it is a genuine commercial/sales inquiry OR a personal chat / spam / casual chit-chat.

Sender Phone: ${senderPhone}
Sender Name (from WhatsApp): ${senderName || 'Unknown'}
Message Text:
"${messageText}"

Respond with ONLY valid JSON:
{
  "isBusinessInquiry": boolean,
  "confidenceScore": number,
  "inquiryCategory": "pricing" | "service_inquiry" | "consultation" | "general_question" | "support" | "personal_or_casual" | "spam",
  "prospectName": string | null,
  "extractedProductOrInterest": string | null,
  "summary": string,
  "suggestedPriority": "High" | "Normal"
}

IMPORTANT RULES FOR "prospectName":
- Set "prospectName" to null unless the sender EXPLICITLY wrote their own real name inside the message text (e.g. "I am Ali" or "This is Tariq").
- NEVER hallucinate, invent, or default to generic names like "Sarah Miller", "John Doe", etc.
- If the sender didn't state their name in the text, return null (the system will automatically use the WhatsApp profile name).`;

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text);
          // Filter out any potential hallucinations like Sarah Miller
          let cleanExtractedName: string | undefined = undefined;
          if (
            parsed.prospectName &&
            typeof parsed.prospectName === 'string' &&
            !parsed.prospectName.toLowerCase().includes('sarah') &&
            !parsed.prospectName.toLowerCase().includes('john doe')
          ) {
            cleanExtractedName = parsed.prospectName.trim();
          }

          return {
            isBusinessInquiry: Boolean(parsed.isBusinessInquiry),
            confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.92,
            inquiryCategory: parsed.inquiryCategory || (parsed.isBusinessInquiry ? 'service_inquiry' : 'personal_or_casual'),
            prospectName: cleanExtractedName || senderName || undefined,
            extractedProductOrInterest: parsed.extractedProductOrInterest || undefined,
            summary: parsed.summary || 'Inbound WhatsApp message received.',
            suggestedPriority: parsed.suggestedPriority === 'High' ? 'High' : 'Normal',
            isAiPowered: true,
            modelUsed: model,
          };
        }
      }
    } catch (err) {
      console.warn('Gemini WhatsApp inquiry classification error, falling back to heuristics:', err);
    }
  }

  return classifyInboundWhatsAppHeuristic(senderPhone, senderName, messageText);
}

function classifyInboundWhatsAppHeuristic(
  senderPhone: string,
  senderName: string | undefined,
  messageText: string
): WhatsAppInquiryClassification {
  const lower = messageText.toLowerCase();

  const businessKeywords = [
    'price', 'pricing', 'cost', 'quote', 'quotation', 'rate', 'rates',
    'service', 'services', 'demo', 'package', 'packages', 'offer',
    'interested', 'inquiry', 'enquiry', 'details', 'buy', 'order', 'purchase',
    'hire', 'consultation', 'consult', 'appointment', 'schedule', 'available',
    'how much', 'catalog', 'catalogue', 'brochure', 'discount', 'deal',
    'help with', 'looking for', 'need a', 'requirement', 'features', 'commercial'
  ];

  const personalKeywords = [
    'mom', 'dad', 'bro', 'brother', 'sis', 'sister', 'wife', 'husband',
    'dinner', 'lunch', 'breakfast', 'tonight', 'party', 'home', 'sleep',
    'love you', 'miss you', 'haha', 'lol', 'rofl', 'hang out', 'movie',
    'are you free tonight', 'what are you doing'
  ];

  let businessMatches = 0;
  for (const kw of businessKeywords) {
    if (lower.includes(kw)) businessMatches++;
  }

  let personalMatches = 0;
  for (const kw of personalKeywords) {
    if (lower.includes(kw)) personalMatches++;
  }

  const isBusiness = businessMatches > 0 && personalMatches === 0;

  return {
    isBusinessInquiry: isBusiness,
    confidenceScore: isBusiness ? 0.75 : (personalMatches > 0 ? 0.85 : 0.5),
    inquiryCategory: isBusiness ? 'service_inquiry' : (personalMatches > 0 ? 'personal_or_casual' : 'general_question'),
    prospectName: senderName || undefined,
    extractedProductOrInterest: isBusiness ? 'Sales / Product Inquiry' : undefined,
    summary: isBusiness
      ? `Inbound business inquiry detected: "${messageText.slice(0, 90)}..."`
      : `Casual or personal message: "${messageText.slice(0, 90)}..."`,
    suggestedPriority: businessMatches >= 2 ? 'High' : 'Normal',
    isAiPowered: false,
    modelUsed: 'heuristic',
  };
}
