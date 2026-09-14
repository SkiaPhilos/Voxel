import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type {
  Lead,
  CallLog,
  OutcomeTag,
  LeadStatus,
  Priority,
  User,
  UserRole,
  PotentialCustomer,
  PinnedComment,
  PinnedCommentStatus,
  NewsletterLog,
} from '../src/types';
import { hashPassword } from './auth.js';
import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_SERVICE_ROLE_KEY,
  DEFAULT_SUPABASE_ANON_KEY,
} from './supabaseConfig.js';

// Supabase environment variables & dynamic client initialization for serverless
let supabaseClient: SupabaseClient | null = null;

export interface SupabaseEnvInfo {
  url: string;
  key: string;
  urlSource: string;
  keySource: string;
  detectedEnvKeys: string[];
}

export function resolveSupabaseCredentials(): SupabaseEnvInfo {
  const env = process.env;
  const detectedEnvKeys = Object.keys(env).filter((k) => {
    const u = k.toUpperCase();
    return u.includes('SUPABASE') || u.includes('POSTGRES_URL');
  });

  // 1. Resolve URL
  let url = '';
  let urlSource = '';

  const potentialUrlKeys = [
    'SUPABASE_URL',
    'SUPABASE_PROJECT_URL',
    'SUPABASE_REST_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'SUPABASE_DATABASE_URL',
  ];

  for (const k of potentialUrlKeys) {
    if (env[k] && typeof env[k] === 'string' && env[k]!.trim()) {
      url = env[k]!.trim();
      urlSource = k;
      break;
    }
  }

  // Fallback: search any env var whose name includes SUPABASE and URL
  if (!url) {
    for (const k of Object.keys(env)) {
      const upper = k.toUpperCase();
      if (upper.includes('SUPABASE') && upper.includes('URL') && env[k] && typeof env[k] === 'string') {
        const val = env[k]!.trim();
        if (val) {
          url = val;
          urlSource = k;
          break;
        }
      }
    }
  }

  // Fallback to committed server configuration
  if (!url && DEFAULT_SUPABASE_URL) {
    url = DEFAULT_SUPABASE_URL.trim();
    urlSource = 'server-config';
  }

  // Clean URL: strip quotes, trailing slashes, ensure protocol
  if (url) {
    url = url.replace(/^["'`]+|["'`]+$/g, '').trim();
    url = url.replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
  }

  // 2. Resolve Key
  let key = '';
  let keySource = '';

  const potentialKeyKeys = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_KEY',
    'SUPABASE_KEY',
    'SUPABASE_API_KEY',
  ];

  for (const k of potentialKeyKeys) {
    if (env[k] && typeof env[k] === 'string' && env[k]!.trim()) {
      key = env[k]!.trim();
      keySource = k;
      break;
    }
  }

  // Fallback: search any env var whose name includes SUPABASE and key/secret/role/anon/publishable
  if (!key) {
    for (const k of Object.keys(env)) {
      const upper = k.toUpperCase();
      if (
        upper.includes('SUPABASE') &&
        (upper.includes('KEY') ||
          upper.includes('SECRET') ||
          upper.includes('ROLE') ||
          upper.includes('ANON') ||
          upper.includes('PUBLISHABLE')) &&
        env[k] &&
        typeof env[k] === 'string'
      ) {
        const val = env[k]!.trim();
        if (val) {
          key = val;
          keySource = k;
          break;
        }
      }
    }
  }

  // Fallback to committed server configuration
  if (!key && (DEFAULT_SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_ANON_KEY)) {
    key = (DEFAULT_SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
    keySource = 'server-config';
  }

  // Clean Key: strip quotes and whitespace
  if (key) {
    key = key.replace(/^["'`]+|["'`]+$/g, '').trim();
  }

  return { url, key, urlSource, keySource, detectedEnvKeys };
}

export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('could not find the table')
  );
}

export function isPermissionError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '').toLowerCase();
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security') ||
    msg.includes('rls')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, urlSource, keySource } = resolveSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log(`✅ Connected to Supabase PostgreSQL database (URL source: ${urlSource}, Key source: ${keySource})`);
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  }
  return supabaseClient;
}

// Eager initialize if env vars are present on boot
getSupabaseClient();

export function isUsingSupabase(): boolean {
  return getSupabaseClient() !== null;
}

export async function checkDatabaseStatus(): Promise<{
  connected: boolean;
  type: 'supabase' | 'local';
  tablesExist: boolean;
  userCount?: number;
  leadCount?: number;
  message: string;
  diagnostics?: {
    isVercel: boolean;
    hasUrl: boolean;
    hasKey: boolean;
    urlSource?: string | null;
    keySource?: string | null;
    detectedSupabaseEnvKeys: string[];
    hint?: string;
  };
}> {
  const creds = resolveSupabaseCredentials();
  const client = getSupabaseClient();
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (!client) {
    let advice = '';
    if (creds.detectedEnvKeys.length === 0) {
      advice = isVercel
        ? 'No SUPABASE environment variables were passed to this Vercel deployment. Make sure you set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY under Vercel Project Settings (ensure Production is selected), and trigger a Redeploy.'
        : 'Operating with temporary local store. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to switch to Supabase.';
    } else {
      advice = `Found env keys [${creds.detectedEnvKeys.join(', ')}], but ${!creds.url ? 'missing valid URL' : ''} ${!creds.key ? 'missing valid Key' : ''}. Check format and redeploy.`;
    }

    return {
      connected: false,
      type: 'local',
      tablesExist: false,
      userCount: localStore.users.length,
      leadCount: localStore.leads.length,
      message: advice,
      diagnostics: {
        isVercel,
        hasUrl: Boolean(creds.url),
        hasKey: Boolean(creds.key),
        urlSource: creds.urlSource || null,
        keySource: creds.keySource || null,
        detectedSupabaseEnvKeys: creds.detectedEnvKeys,
        hint: isVercel
          ? 'CRITICAL: In Vercel, adding environment variables does NOT update existing deployments. You must go to Deployments -> ... -> Redeploy.'
          : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
      },
    };
  }

  try {
    const { data: userData, error: userError } = await client.from('users').select('id').limit(1);
    if (userError) {
      if (isTableMissingError(userError)) {
        return {
          connected: true,
          type: 'supabase',
          tablesExist: false,
          message: "Supabase is connected, but database tables ('users', 'leads', 'call_logs') have not been created yet. Please execute the SQL in 'supabase-schema.sql' in your Supabase SQL Editor.",
          diagnostics: {
            isVercel,
            hasUrl: true,
            hasKey: true,
            urlSource: creds.urlSource,
            keySource: creds.keySource,
            detectedSupabaseEnvKeys: creds.detectedEnvKeys,
          },
        };
      }
      if (isPermissionError(userError)) {
        return {
          connected: true,
          type: 'supabase',
          tablesExist: true,
          message: "Supabase connected, but Permission Denied (RLS is active). Please execute 'supabase-schema.sql' to disable RLS or add SUPABASE_SERVICE_ROLE_KEY to environment variables.",
          diagnostics: {
            isVercel,
            hasUrl: true,
            hasKey: true,
            urlSource: creds.urlSource,
            keySource: creds.keySource,
            detectedSupabaseEnvKeys: creds.detectedEnvKeys,
          },
        };
      }
      return {
        connected: false,
        type: 'supabase',
        tablesExist: false,
        message: `Supabase error: ${userError.message} (${userError.code})`,
        diagnostics: {
          isVercel,
          hasUrl: true,
          hasKey: true,
          urlSource: creds.urlSource,
          keySource: creds.keySource,
          detectedSupabaseEnvKeys: creds.detectedEnvKeys,
        },
      };
    }

    const { count: userCount } = await client.from('users').select('*', { count: 'exact', head: true });
    const { count: leadCount } = await client.from('leads').select('*', { count: 'exact', head: true });

    return {
      connected: true,
      type: 'supabase',
      tablesExist: true,
      userCount: userCount ?? (userData ? userData.length : 0),
      leadCount: leadCount ?? 0,
      message: 'Supabase PostgreSQL is connected and all tables are verified reachable.',
      diagnostics: {
        isVercel,
        hasUrl: true,
        hasKey: true,
        urlSource: creds.urlSource,
        keySource: creds.keySource,
        detectedSupabaseEnvKeys: creds.detectedEnvKeys,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      type: 'supabase',
      tablesExist: false,
      message: err.message || 'Unknown database connection error',
      diagnostics: {
        isVercel,
        hasUrl: true,
        hasKey: true,
        urlSource: creds.urlSource,
        keySource: creds.keySource,
        detectedSupabaseEnvKeys: creds.detectedEnvKeys,
      },
    };
  }
}

// Count total registered users in the database
export async function countUsers(): Promise<number> {
  const client = getSupabaseClient();
  if (client) {
    const { count, error } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) {
      if (isTableMissingError(error)) {
        return 0;
      }
      if (isPermissionError(error)) {
        throw new Error("Supabase Permission Denied: Please run 'supabase-schema.sql' or provide SUPABASE_SERVICE_ROLE_KEY.");
      }
      throw error;
    }
    return count ?? 0;
  }
  return localStore.users.length;
}

// -----------------------------------------------------------------------------
// LOCAL FALLBACK STORE DEFINITION (Used if Supabase credentials are not configured)
// -----------------------------------------------------------------------------
interface LocalStoreData {
  users: Array<User & { passwordHash: string }>;
  leads: Lead[];
  call_logs: Array<CallLog & { lead_id: string }>;
  sentNotifications: Array<{
    id: string;
    leadId: string;
    leadName: string;
    userEmail: string;
    type: 'browser' | 'email' | 'push' | 'reassignment';
    timestamp: string;
    status: 'sent' | 'simulated';
  }>;
  pushSubscriptions?: Array<{
    id: string;
    userId?: string | null;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
    createdAt: string;
  }>;
  passwordResetOtps?: Array<{
    id: string;
    email: string;
    otp: string;
    expiresAt: string;
    used: boolean;
    createdAt: string;
  }>;
  potentialCustomers?: PotentialCustomer[];
  pinnedComments?: PinnedComment[];
  newsletterLogs?: NewsletterLog[];
}

function resolveDataDir(): string {
  if (
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY
  ) {
    return path.join(os.tmpdir(), 'coldcrm_data');
  }
  try {
    const cwdData = path.join(process.cwd(), 'data');
    if (!fs.existsSync(cwdData)) {
      fs.mkdirSync(cwdData, { recursive: true });
    }
    const testFile = path.join(cwdData, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return cwdData;
  } catch {
    return path.join(os.tmpdir(), 'coldcrm_data');
  }
}

const DATA_DIR = resolveDataDir();
const STORE_FILE = path.join(DATA_DIR, 'crm_store.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Gracefully ignored on read-only environments
}

let localStore: LocalStoreData = initLocalStore();

function initLocalStore(): LocalStoreData {
  // Empty production default store: 0 users, 0 leads, 0 call logs
  const defaultData: LocalStoreData = {
    users: [],
    leads: [],
    call_logs: [],
    sentNotifications: [],
    pushSubscriptions: [],
    passwordResetOtps: [],
    potentialCustomers: [],
    pinnedComments: [],
    newsletterLogs: [],
  };

  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.call_logs) {
        parsed.call_logs = [];
        (parsed.leads || []).forEach((l: any) => {
          if (Array.isArray(l.call_logs)) {
            l.call_logs.forEach((c: any) => {
              parsed.call_logs.push({ ...c, lead_id: l.id });
            });
          }
        });
      }
      if (!parsed.pushSubscriptions) {
        parsed.pushSubscriptions = [];
      }
      if (!parsed.passwordResetOtps) {
        parsed.passwordResetOtps = [];
      }
      if (!parsed.potentialCustomers) {
        parsed.potentialCustomers = [];
      }
      if (!parsed.pinnedComments) {
        parsed.pinnedComments = [];
      }
      if (!parsed.newsletterLogs) {
        parsed.newsletterLogs = [];
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse local store file, initializing clean empty store', err);
  }

  try {
    saveLocalStore(defaultData);
  } catch {
    // Non-fatal
  }
  return defaultData;
}

function saveLocalStore(data: LocalStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal on serverless where Supabase is the primary store
  }
}

// Helper to clean phone numbers
export function cleanPhone(p: string): string {
  return p.replace(/[^0-9+]/g, '');
}

// -----------------------------------------------------------------------------
// USER OPERATIONS
// -----------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const normalized = email.trim().toLowerCase();
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .maybeSingle();

    if (error) {
      console.error('Supabase findUserByEmail error:', error);
      if (isTableMissingError(error)) {
        throw new Error("Supabase database tables are not created yet. Please execute the SQL in 'supabase-schema.sql' in your Supabase SQL Editor.");
      }
      if (isPermissionError(error)) {
        throw new Error("Supabase Permission Denied: Please execute 'supabase-schema.sql' to disable RLS or provide SUPABASE_SERVICE_ROLE_KEY.");
      }
      throw error;
    }
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: (data.role || 'agent') as UserRole,
      avatarUrl: data.avatar_url || undefined,
      managerId: data.manager_id || undefined,
      firstLoginAt: data.first_login_at || undefined,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at || undefined,
    };
  }

  // Local fallback
  const found = localStore.users.find((u) => u.email.toLowerCase() === normalized);
  return found || null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: (data.role || 'agent') as UserRole,
      avatarUrl: data.avatar_url || undefined,
      managerId: data.manager_id || undefined,
      firstLoginAt: data.first_login_at || undefined,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at || undefined,
    };
  }

  const u = localStore.users.find((user) => user.id === id);
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl,
    managerId: u.managerId,
    firstLoginAt: u.firstLoginAt,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

export async function findUserByIdWithPassword(id: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  managerId?: string | null;
  firstLoginAt?: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
} | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: (data.role || 'agent') as UserRole,
      avatarUrl: data.avatar_url || undefined,
      managerId: data.manager_id || undefined,
      firstLoginAt: data.first_login_at || undefined,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at || undefined,
    };
  }

  const u = localStore.users.find((user) => user.id === id);
  if (!u) return null;
  return { ...u };
}

export async function listUsers(): Promise<User[]> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const userMap = new Map((data || []).map((u: any) => [u.id, u.name]));
    return (data || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: (u.role || 'agent') as UserRole,
      avatarUrl: u.avatar_url || undefined,
      managerId: u.manager_id || undefined,
      managerName: u.manager_id ? userMap.get(u.manager_id) || null : null,
      firstLoginAt: u.first_login_at || undefined,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at || undefined,
    }));
  }

  const userMap = new Map(localStore.users.map((u) => [u.id, u.name]));
  return localStore.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl,
    managerId: u.managerId,
    managerName: u.managerId ? userMap.get(u.managerId) || null : null,
    firstLoginAt: u.firstLoginAt,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));
}

export async function createUser(params: {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  managerId?: string | null;
}): Promise<User> {
  const normalized = params.email.trim().toLowerCase();
  const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    const payload: any = {
      id,
      email: normalized,
      name: params.name,
      role: params.role,
      password_hash: params.passwordHash,
      created_at: nowIso,
    };
    if (params.managerId) {
      payload.manager_id = params.managerId;
    }

    try {
      const { data, error } = await supabaseClient
        .from('users')
        .insert([payload])
        .select('*')
        .single();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role as UserRole,
          avatarUrl: data.avatar_url || undefined,
          managerId: data.manager_id || undefined,
          firstLoginAt: data.first_login_at || undefined,
          createdAt: data.created_at,
        };
      }
    } catch {
      // Retry without manager_id if column not created yet
      delete payload.manager_id;
      const { data, error } = await supabaseClient
        .from('users')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as UserRole,
        avatarUrl: data.avatar_url || undefined,
        managerId: undefined,
        createdAt: data.created_at,
      };
    }
  }

  const newUser = {
    id,
    email: normalized,
    name: params.name,
    role: params.role,
    managerId: params.managerId || null,
    passwordHash: params.passwordHash,
    createdAt: nowIso,
  };
  localStore.users.push(newUser);
  saveLocalStore(localStore);

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
    managerId: newUser.managerId,
    createdAt: newUser.createdAt,
  };
}

export async function updateUser(
  id: string,
  updates: {
    passwordHash?: string;
    role?: UserRole;
    name?: string;
    avatarUrl?: string | null;
    managerId?: string | null;
    firstLoginAt?: string;
    lastLoginAt?: string;
  }
): Promise<void> {
  if (supabaseClient) {
    const payload: any = {};
    if (updates.passwordHash) payload.password_hash = updates.passwordHash;
    if (updates.role) payload.role = updates.role;
    if (updates.name) payload.name = updates.name;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.managerId !== undefined) payload.manager_id = updates.managerId;
    if (updates.firstLoginAt) payload.first_login_at = updates.firstLoginAt;
    if (updates.lastLoginAt) payload.last_login_at = updates.lastLoginAt;

    try {
      const { error } = await supabaseClient.from('users').update(payload).eq('id', id);
      if (!error) return;
      // If error might be missing column (like avatar_url, manager_id, first_login_at)
      if (payload.avatar_url !== undefined || payload.manager_id !== undefined || payload.first_login_at !== undefined) {
        const safePayload: any = { ...payload };
        delete safePayload.avatar_url;
        delete safePayload.manager_id;
        delete safePayload.first_login_at;
        if (Object.keys(safePayload).length > 0) {
          await supabaseClient.from('users').update(safePayload).eq('id', id);
        }
      }
    } catch {
      // Fallback
    }
  }

  const u = localStore.users.find((user) => user.id === id);
  if (u) {
    if (updates.passwordHash) u.passwordHash = updates.passwordHash;
    if (updates.role) u.role = updates.role;
    if (updates.name) u.name = updates.name;
    if (updates.avatarUrl !== undefined) u.avatarUrl = updates.avatarUrl;
    if (updates.managerId !== undefined) u.managerId = updates.managerId;
    if (updates.firstLoginAt) u.firstLoginAt = updates.firstLoginAt;
    if (updates.lastLoginAt) u.lastLoginAt = updates.lastLoginAt;
    saveLocalStore(localStore);
  }
}

export async function deleteUser(id: string): Promise<void> {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('users').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  const idx = localStore.users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    localStore.users.splice(idx, 1);
    saveLocalStore(localStore);
  }
}

// -----------------------------------------------------------------------------
// LEADS & RELATIONAL CALL LOGS OPERATIONS
// -----------------------------------------------------------------------------

export async function getLeads(params?: {
  view?: string;
  search?: string;
  userId?: string;
  userRole?: UserRole;
  reviewingAgentId?: string;
  filter?: string;
}): Promise<Lead[]> {
  if (supabaseClient) {
    let query = supabaseClient.from('leads').select('*, call_logs(*)');

    if (params?.view === 'active') {
      query = query.in('status', ['Active', 'Follow-up Scheduled']);
    } else if (params?.view === 'closed') {
      query = query.eq('status', 'Matured (Closed)');
    } else if (params?.view === 'archive') {
      query = query.in('status', ['Service Denied', 'Archived']);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,business_notes.ilike.%${q}%,business_info.ilike.%${q}%`);
    }

    // Sort order: High priority first, then updated_at DESC
    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const allUsers = await listUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

    let leads: Lead[] = (data || []).map((row) => {
      // Sort call logs descending by timestamp
      const logs: CallLog[] = (row.call_logs || [])
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map((c: any) => ({
          id: c.id,
          timestamp: c.timestamp,
          summary: c.summary,
          full_notes: c.full_notes || '',
          outcome_tag: c.outcome_tag as OutcomeTag,
          business_info: c.business_info || undefined,
          logged_by: c.logged_by || undefined,
          logged_by_name: c.logged_by_name || (c.logged_by ? userMap.get(c.logged_by) : undefined),
        }));

      return {
        id: row.id,
        phone: row.phone,
        name: row.name,
        business_notes: row.business_notes || '',
        source: row.source || undefined,
        email: row.email || undefined,
        status: row.status as LeadStatus,
        priority: row.priority as Priority,
        next_action_at: row.next_action_at,
        last_notified_at: row.last_notified_at,
        business_info: row.business_info || '',
        archived_at: row.archived_at,
        archive_reason: row.archive_reason,
        assigned_to: row.assigned_to || undefined,
        assigned_to_name: row.assigned_to_name || (row.assigned_to ? userMap.get(row.assigned_to) : undefined),
        original_owner_id: row.original_owner_id || undefined,
        original_owner_name: row.original_owner_name || (row.original_owner_id ? userMap.get(row.original_owner_id) : undefined),
        reassigned_at: row.reassigned_at || undefined,
        reassigned_by: row.reassigned_by || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        call_logs: logs,
      };
    });

    // Apply role-based scoping
    if (params?.reviewingAgentId) {
      leads = leads.filter((l) => l.assigned_to === params.reviewingAgentId);
    } else if ((params?.userRole === 'admin' || params?.userRole === 'manager') && params.userId) {
      if (params.filter === 'team' || params.filter === 'all') {
        // Team filter explicitly requested
        if (params.userRole === 'manager') {
          const teamUsers = await listUsers();
          const teamIds = new Set(
            teamUsers
              .filter((u) => u.id === params.userId || u.managerId === params.userId)
              .map((u) => u.id)
          );
          leads = leads.filter((l) => l.assigned_to && teamIds.has(l.assigned_to));
        }
      } else {
        // By default on main pipeline, managers and admins only see their own leads
        leads = leads.filter((l) => l.assigned_to === params.userId);
      }
    } else if (params?.userRole === 'agent' && params.userId) {
      if (params.filter === 'reassigned') {
        leads = leads.filter((l) => l.original_owner_id === params.userId && l.assigned_to !== params.userId);
      } else {
        leads = leads.filter((l) => l.assigned_to === params.userId);
      }
    }

    return leads;
  }

  // Local fallback
  let list = localStore.leads.map((lead) => {
    // Populate relational call logs
    const logs = localStore.call_logs
      .filter((c) => c.lead_id === lead.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      ...lead,
      call_logs: logs,
    };
  });

  if (params?.view === 'active') {
    list = list.filter((l) => l.status === 'Active' || l.status === 'Follow-up Scheduled');
  } else if (params?.view === 'closed') {
    list = list.filter((l) => l.status === 'Matured (Closed)');
  } else if (params?.view === 'archive') {
    list = list.filter((l) => l.status === 'Service Denied' || l.status === 'Archived');
  }

  if (params?.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    list = list.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        l.business_notes.toLowerCase().includes(q) ||
        (l.business_info && l.business_info.toLowerCase().includes(q))
    );
  }

  // Apply role-based scoping for local fallback
  if (params?.reviewingAgentId) {
    list = list.filter((l) => l.assigned_to === params.reviewingAgentId);
  } else if ((params?.userRole === 'admin' || params?.userRole === 'manager') && params.userId) {
    if (params.filter === 'team' || params.filter === 'all') {
      if (params.userRole === 'manager') {
        const teamUsers = await listUsers();
        const teamIds = new Set(
          teamUsers
            .filter((u) => u.id === params.userId || u.managerId === params.userId)
            .map((u) => u.id)
        );
        list = list.filter((l) => l.assigned_to && teamIds.has(l.assigned_to));
      }
    } else {
      list = list.filter((l) => l.assigned_to === params.userId);
    }
  } else if (params?.userRole === 'agent' && params.userId) {
    if (params.filter === 'reassigned') {
      list = list.filter((l) => l.original_owner_id === params.userId && l.assigned_to !== params.userId);
    } else {
      list = list.filter((l) => l.assigned_to === params.userId);
    }
  }

  list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return list;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('leads')
      .select('*, call_logs(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const allUsers = await listUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

    const logs: CallLog[] = (data.call_logs || [])
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((c: any) => ({
        id: c.id,
        timestamp: c.timestamp,
        summary: c.summary,
        full_notes: c.full_notes || '',
        outcome_tag: c.outcome_tag as OutcomeTag,
        business_info: c.business_info || undefined,
        logged_by: c.logged_by || undefined,
        logged_by_name: c.logged_by_name || (c.logged_by ? userMap.get(c.logged_by) : undefined),
      }));

    return {
      id: data.id,
      phone: data.phone,
      name: data.name,
      business_notes: data.business_notes || '',
      source: data.source || undefined,
      email: data.email || undefined,
      status: data.status as LeadStatus,
      priority: data.priority as Priority,
      next_action_at: data.next_action_at,
      last_notified_at: data.last_notified_at,
      business_info: data.business_info || '',
      archived_at: data.archived_at,
      archive_reason: data.archive_reason,
      assigned_to: data.assigned_to || undefined,
      assigned_to_name: data.assigned_to_name || (data.assigned_to ? userMap.get(data.assigned_to) : undefined),
      original_owner_id: data.original_owner_id || undefined,
      original_owner_name: data.original_owner_name || (data.original_owner_id ? userMap.get(data.original_owner_id) : undefined),
      reassigned_at: data.reassigned_at || undefined,
      reassigned_by: data.reassigned_by || undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
      call_logs: logs,
    };
  }

  const lead = localStore.leads.find((l) => l.id === id);
  if (!lead) return null;
  const logs = localStore.call_logs
    .filter((c) => c.lead_id === lead.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { ...lead, call_logs: logs };
}

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const normPhone = cleanPhone(phone);
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('leads')
      .select('id, phone, name')
      .maybeSingle();

    // Query all to match cleaned phone digits
    const { data: allLeads } = await supabaseClient.from('leads').select('id, phone, name');
    const matched = (allLeads || []).find((l) => cleanPhone(l.phone) === normPhone);
    if (!matched) return null;
    return getLeadById(matched.id);
  }

  const found = localStore.leads.find((l) => cleanPhone(l.phone) === normPhone);
  if (!found) return null;
  return getLeadById(found.id);
}

export async function createLead(params: {
  phone: string;
  name: string;
  business_notes?: string;
  source?: string;
  email?: string;
  priority?: Priority;
  assignedTo?: string | null;
}): Promise<Lead> {
  const id = 'lead_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    const payload: any = {
      id,
      phone: params.phone.trim(),
      name: params.name?.trim() || 'Unnamed Lead',
      business_notes: params.business_notes?.trim() || '',
      source: params.source?.trim() || '',
      email: params.email?.trim() || null,
      status: 'Active',
      priority: params.priority === 'High' ? 'High' : 'Normal',
      next_action_at: null,
      last_notified_at: null,
      business_info: '',
      created_at: nowIso,
      updated_at: nowIso,
    };
    if (params.assignedTo) {
      payload.assigned_to = params.assignedTo;
    }

    try {
      const { data, error } = await supabaseClient
        .from('leads')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          phone: data.phone,
          name: data.name,
          business_notes: data.business_notes || '',
          source: data.source || undefined,
          email: data.email || undefined,
          status: data.status as LeadStatus,
          priority: data.priority as Priority,
          next_action_at: data.next_action_at,
          last_notified_at: data.last_notified_at,
          business_info: data.business_info || '',
          archived_at: data.archived_at,
          archive_reason: data.archive_reason,
          assigned_to: data.assigned_to || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
          call_logs: [],
        };
      }
    } catch {
      // Retry without assigned_to if column doesn't exist yet
      delete payload.assigned_to;
      const { data, error } = await supabaseClient
        .from('leads')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        phone: data.phone,
        name: data.name,
        business_notes: data.business_notes || '',
        source: data.source || undefined,
        email: data.email || undefined,
        status: data.status as LeadStatus,
        priority: data.priority as Priority,
        next_action_at: data.next_action_at,
        last_notified_at: data.last_notified_at,
        business_info: data.business_info || '',
        archived_at: data.archived_at,
        archive_reason: data.archive_reason,
        created_at: data.created_at,
        updated_at: data.updated_at,
        call_logs: [],
      };
    }
  }

  const newLead: Lead = {
    id,
    phone: params.phone.trim(),
    name: params.name?.trim() || 'Unnamed Lead',
    business_notes: params.business_notes?.trim() || '',
    source: params.source?.trim() || '',
    email: params.email?.trim() || undefined,
    created_at: nowIso,
    updated_at: nowIso,
    status: 'Active',
    priority: params.priority === 'High' ? 'High' : 'Normal',
    next_action_at: null,
    last_notified_at: null,
    assigned_to: params.assignedTo || undefined,
    call_logs: [],
    business_info: '',
  };

  localStore.leads.unshift(newLead);
  saveLocalStore(localStore);
  return newLead;
}

export async function updateLead(
  id: string,
  updates: Partial<Omit<Lead, 'id' | 'call_logs' | 'created_at'>>
): Promise<Lead> {
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    const payload: any = { updated_at: nowIso };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.phone !== undefined) payload.phone = updates.phone.trim();
    if (updates.email !== undefined) payload.email = updates.email.trim();
    if (updates.business_notes !== undefined) payload.business_notes = updates.business_notes.trim();
    if (updates.source !== undefined) payload.source = updates.source.trim();
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.next_action_at !== undefined) payload.next_action_at = updates.next_action_at;
    if (updates.last_notified_at !== undefined) payload.last_notified_at = updates.last_notified_at;
    if (updates.business_info !== undefined) payload.business_info = updates.business_info;
    if (updates.archived_at !== undefined) payload.archived_at = updates.archived_at;
    if (updates.archive_reason !== undefined) payload.archive_reason = updates.archive_reason;
    if (updates.assigned_to !== undefined) payload.assigned_to = updates.assigned_to;
    if (updates.original_owner_id !== undefined) payload.original_owner_id = updates.original_owner_id;
    if (updates.reassigned_at !== undefined) payload.reassigned_at = updates.reassigned_at;
    if (updates.reassigned_by !== undefined) payload.reassigned_by = updates.reassigned_by;

    try {
      const { error } = await supabaseClient.from('leads').update(payload).eq('id', id);
      if (!error) {
        const updated = await getLeadById(id);
        if (updated) return updated;
      }
    } catch {
      // ignore
    }
  }

  const lead = localStore.leads.find((l) => l.id === id);
  if (!lead) throw new Error('Lead not found');

  if (updates.name !== undefined) lead.name = updates.name.trim();
  if (updates.phone !== undefined) lead.phone = updates.phone.trim();
  if (updates.email !== undefined) lead.email = updates.email.trim() || undefined;
  if (updates.business_notes !== undefined) lead.business_notes = updates.business_notes.trim();
  if (updates.source !== undefined) lead.source = updates.source.trim();
  if (updates.priority !== undefined) lead.priority = updates.priority;
  if (updates.status !== undefined) lead.status = updates.status;
  if (updates.next_action_at !== undefined) lead.next_action_at = updates.next_action_at;
  if (updates.last_notified_at !== undefined) lead.last_notified_at = updates.last_notified_at;
  if (updates.business_info !== undefined) lead.business_info = updates.business_info;
  if (updates.archived_at !== undefined) lead.archived_at = updates.archived_at;
  if (updates.archive_reason !== undefined) lead.archive_reason = updates.archive_reason;
  if (updates.assigned_to !== undefined) lead.assigned_to = updates.assigned_to;
  if (updates.original_owner_id !== undefined) lead.original_owner_id = updates.original_owner_id;
  if (updates.reassigned_at !== undefined) lead.reassigned_at = updates.reassigned_at;
  if (updates.reassigned_by !== undefined) lead.reassigned_by = updates.reassigned_by;
  lead.updated_at = nowIso;

  saveLocalStore(localStore);
  const full = await getLeadById(id);
  return full!;
}

export async function addCallLog(params: {
  leadId: string;
  summary: string;
  full_notes: string;
  outcome_tag: OutcomeTag;
  business_info?: string;
  logged_by?: string;
  logged_by_name?: string;
}): Promise<CallLog> {
  const id = 'call_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    const payload: any = {
      id,
      lead_id: params.leadId,
      timestamp: nowIso,
      summary: params.summary.trim(),
      full_notes: params.full_notes.trim(),
      outcome_tag: params.outcome_tag,
      business_info: params.business_info?.trim() || null,
      logged_by: params.logged_by || null,
      created_at: nowIso,
    };
    if (params.logged_by_name) {
      payload.logged_by_name = params.logged_by_name;
    }

    try {
      let { data, error } = await supabaseClient
        .from('call_logs')
        .insert([payload])
        .select()
        .single();

      if (error && payload.logged_by_name) {
        delete payload.logged_by_name;
        const retry = await supabaseClient
          .from('call_logs')
          .insert([payload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        return {
          id: data.id,
          timestamp: data.timestamp,
          summary: data.summary,
          full_notes: data.full_notes || '',
          outcome_tag: data.outcome_tag as OutcomeTag,
          business_info: data.business_info || undefined,
          logged_by: data.logged_by || undefined,
          logged_by_name: data.logged_by_name || params.logged_by_name,
        };
      }
    } catch {
      // fallback to localStore
    }
  }

  const log: CallLog & { lead_id: string } = {
    id,
    lead_id: params.leadId,
    timestamp: nowIso,
    summary: params.summary.trim(),
    full_notes: params.full_notes.trim(),
    outcome_tag: params.outcome_tag,
    business_info: params.business_info?.trim() || undefined,
    logged_by: params.logged_by,
    logged_by_name: params.logged_by_name,
  };

  localStore.call_logs.unshift(log);
  saveLocalStore(localStore);
  return {
    id: log.id,
    timestamp: log.timestamp,
    summary: log.summary,
    full_notes: log.full_notes,
    outcome_tag: log.outcome_tag,
    business_info: log.business_info,
    logged_by: log.logged_by,
    logged_by_name: log.logged_by_name,
  };
}

// -----------------------------------------------------------------------------
// CRON & DUE FOLLOW-UP REMINDER OPERATIONS
// -----------------------------------------------------------------------------

/**
 * Find leads due for follow-up right now or overdue that have NOT already been notified
 * for this specific follow-up window (last_notified_at is null OR last_notified_at < next_action_at)
 */
export async function getDueFollowUps(): Promise<Lead[]> {
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    // Query active leads with next_action_at <= now
    const { data, error } = await supabaseClient
      .from('leads')
      .select('*, call_logs(*)')
      .in('status', ['Active', 'Follow-up Scheduled'])
      .not('next_action_at', 'is', null)
      .lte('next_action_at', nowIso);

    if (error) {
      console.error('Error fetching due follow ups from Supabase:', error);
      return [];
    }

    return (data || [])
      .filter((row) => {
        // Only return if not already notified for this due window
        if (!row.last_notified_at) return true;
        return new Date(row.last_notified_at).getTime() < new Date(row.next_action_at).getTime();
      })
      .map((row) => ({
        id: row.id,
        phone: row.phone,
        name: row.name,
        business_notes: row.business_notes || '',
        source: row.source || undefined,
        status: row.status as LeadStatus,
        priority: row.priority as Priority,
        next_action_at: row.next_action_at,
        last_notified_at: row.last_notified_at,
        business_info: row.business_info || '',
        archived_at: row.archived_at,
        archive_reason: row.archive_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        call_logs: [],
      }));
  }

  // Local fallback
  return localStore.leads.filter((lead) => {
    if (lead.status !== 'Active' && lead.status !== 'Follow-up Scheduled') return false;
    if (!lead.next_action_at) return false;
    const dueTime = new Date(lead.next_action_at).getTime();
    if (dueTime > Date.now()) return false;

    // Check last_notified_at to prevent duplicate notification
    if (lead.last_notified_at) {
      const notifiedTime = new Date(lead.last_notified_at).getTime();
      if (notifiedTime >= dueTime) return false;
    }

    return true;
  });
}

/**
 * Stamp last_notified_at timestamp on the lead record
 */
export async function markLeadNotified(leadId: string, timestamp: string = new Date().toISOString()): Promise<void> {
  if (supabaseClient) {
    await supabaseClient
      .from('leads')
      .update({ last_notified_at: timestamp })
      .eq('id', leadId);
    return;
  }

  const lead = localStore.leads.find((l) => l.id === leadId);
  if (lead) {
    lead.last_notified_at = timestamp;
    saveLocalStore(localStore);
  }
}

/**
 * Log notification dispatch for audit and status
 */
export async function logNotification(params: {
  leadId: string;
  leadName: string;
  userEmail: string;
  type: 'email' | 'browser' | 'push' | 'reassignment';
  status: 'sent' | 'simulated';
}): Promise<void> {
  const id = 'notif_' + Date.now().toString(36);
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    await supabaseClient.from('notifications_log').insert([
      {
        id,
        lead_id: params.leadId,
        lead_name: params.leadName,
        recipient_email: params.userEmail,
        type: params.type,
        status: params.status,
        dispatched_at: nowIso,
      },
    ]);
    return;
  }

  localStore.sentNotifications.push({
    id,
    leadId: params.leadId,
    leadName: params.leadName,
    userEmail: params.userEmail,
    type: params.type,
    timestamp: nowIso,
    status: params.status,
  });
  saveLocalStore(localStore);
}

// -----------------------------------------------------------------------------
// PUSH SUBSCRIPTIONS & OTP CLOUD STORAGE SYNC
// -----------------------------------------------------------------------------

const CRM_STORAGE_BUCKET = 'crm_storage';
let noticedPushTableMissing = false;
let noticedOtpTableMissing = false;

async function ensureStorageBucket(bucketName: string = CRM_STORAGE_BUCKET, isPublic: boolean = false): Promise<boolean> {
  if (!supabaseClient) return false;
  try {
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    const exists = (buckets || []).some((b: any) => b.id === bucketName || b.name === bucketName);
    if (!exists) {
      await supabaseClient.storage.createBucket(bucketName, { public: isPublic });
    }
    return true;
  } catch {
    return false;
  }
}

async function readFromCloudStorage<T>(fileName: string): Promise<T | null> {
  if (!supabaseClient) return null;
  try {
    await ensureStorageBucket();
    const { data, error } = await supabaseClient.storage.from(CRM_STORAGE_BUCKET).download(fileName);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeToCloudStorage<T>(fileName: string, content: T): Promise<boolean> {
  if (!supabaseClient) return false;
  try {
    await ensureStorageBucket();
    const str = JSON.stringify(content, null, 2);
    const { error } = await supabaseClient.storage.from(CRM_STORAGE_BUCKET).upload(fileName, str, {
      contentType: 'application/json',
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// PUSH SUBSCRIPTIONS PERSISTENCE (Web Push PWA)
// -----------------------------------------------------------------------------

export interface PushSubscriptionItem {
  id: string;
  userId?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  createdAt: string;
}

export async function savePushSubscription(sub: {
  userId?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  const id = 'psub_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  let tableUpsertSucceeded = false;
  if (supabaseClient) {
    try {
      // Upsert by endpoint into PostgreSQL table if available
      const { error } = await supabaseClient.from('push_subscriptions').upsert(
        {
          endpoint: sub.endpoint,
          user_id: sub.userId || null,
          p256dh: sub.p256dh,
          auth: sub.auth,
          user_agent: sub.userAgent || null,
          created_at: nowIso,
        },
        { onConflict: 'endpoint' }
      );
      if (!error) {
        tableUpsertSucceeded = true;
      } else if (!isTableMissingError(error)) {
        console.warn('Supabase push_subscriptions upsert note:', error.message);
      } else if (!noticedPushTableMissing) {
        noticedPushTableMissing = true;
        console.log("ℹ️ 'push_subscriptions' table not in schema cache; synchronizing via Supabase Cloud Storage.");
      }
    } catch {
      // Fallback to cloud storage & local
    }
  }

  // Update in-memory store
  if (!localStore.pushSubscriptions) {
    localStore.pushSubscriptions = [];
  }
  const existingIdx = localStore.pushSubscriptions.findIndex((s) => s.endpoint === sub.endpoint);
  if (existingIdx !== -1) {
    localStore.pushSubscriptions[existingIdx] = {
      ...localStore.pushSubscriptions[existingIdx],
      userId: sub.userId || localStore.pushSubscriptions[existingIdx].userId,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent || localStore.pushSubscriptions[existingIdx].userAgent,
    };
  } else {
    localStore.pushSubscriptions.push({
      id,
      userId: sub.userId || null,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent || null,
      createdAt: nowIso,
    });
  }
  saveLocalStore(localStore);

  // If PostgreSQL table is not present, sync to Supabase Cloud Storage so all server instances & devices share it!
  if (!tableUpsertSucceeded && supabaseClient) {
    try {
      const cloudSubs = (await readFromCloudStorage<PushSubscriptionItem[]>('push_subscriptions.json')) || [];
      const remoteIdx = cloudSubs.findIndex((s) => s.endpoint === sub.endpoint);
      if (remoteIdx !== -1) {
        cloudSubs[remoteIdx] = {
          ...cloudSubs[remoteIdx],
          userId: sub.userId || cloudSubs[remoteIdx].userId,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: sub.userAgent || cloudSubs[remoteIdx].userAgent,
        };
      } else {
        cloudSubs.push({
          id,
          userId: sub.userId || null,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: sub.userAgent || null,
          createdAt: nowIso,
        });
      }
      await writeToCloudStorage('push_subscriptions.json', cloudSubs);
    } catch {
      // local store already saved
    }
  }
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
    } catch {
      // ignore
    }
    try {
      const cloudSubs = await readFromCloudStorage<PushSubscriptionItem[]>('push_subscriptions.json');
      if (cloudSubs) {
        const remaining = cloudSubs.filter((s) => s.endpoint !== endpoint);
        await writeToCloudStorage('push_subscriptions.json', remaining);
      }
    } catch {
      // ignore
    }
  }

  if (localStore.pushSubscriptions) {
    localStore.pushSubscriptions = localStore.pushSubscriptions.filter(
      (s) => s.endpoint !== endpoint
    );
    saveLocalStore(localStore);
  }
}

export async function getPushSubscriptions(userId?: string): Promise<
  Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userId?: string | null;
  }>
> {
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('push_subscriptions').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        return data.map((d: any) => ({
          endpoint: d.endpoint,
          keys: {
            p256dh: d.p256dh,
            auth: d.auth,
          },
          userId: d.user_id,
        }));
      }

      // If table is missing, retrieve from Supabase Cloud Storage
      if (isTableMissingError(error)) {
        const cloudSubs = await readFromCloudStorage<PushSubscriptionItem[]>('push_subscriptions.json');
        if (cloudSubs && Array.isArray(cloudSubs) && cloudSubs.length > 0) {
          // Sync into local memory store
          cloudSubs.forEach((cs) => {
            if (!localStore.pushSubscriptions.some((ls) => ls.endpoint === cs.endpoint)) {
              localStore.pushSubscriptions.push(cs);
            }
          });
          const filtered = userId ? cloudSubs.filter((s) => s.userId === userId) : cloudSubs;
          return filtered.map((s) => ({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
            userId: s.userId,
          }));
        }
      }
    } catch {
      // Fall through to local memory
    }
  }

  const subs = localStore.pushSubscriptions || [];
  const filtered = userId ? subs.filter((s) => s.userId === userId) : subs;
  return filtered.map((s) => ({
    endpoint: s.endpoint,
    keys: {
      p256dh: s.p256dh,
      auth: s.auth,
    },
    userId: s.userId,
  }));
}

// -----------------------------------------------------------------------------
// PASSWORD RESET OTP PERSISTENCE
// -----------------------------------------------------------------------------

export async function createPasswordResetOtp(
  email: string,
  otp: string,
  expiresInMinutes: number = 15
): Promise<{ id: string; email: string; otp: string; expiresAt: string }> {
  const id = 'otp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  let tableInsertSucceeded = false;
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('password_reset_otps').insert([
        {
          id,
          email: normalizedEmail,
          otp,
          expires_at: expiresAt,
          used: false,
          created_at: now.toISOString(),
        },
      ]);
      if (!error) {
        tableInsertSucceeded = true;
        return { id, email: normalizedEmail, otp, expiresAt };
      } else if (!isTableMissingError(error)) {
        console.warn('Supabase password_reset_otps insert note:', error.message);
      } else if (!noticedOtpTableMissing) {
        noticedOtpTableMissing = true;
        console.log("ℹ️ 'password_reset_otps' table not in schema cache; synchronizing via Supabase Cloud Storage.");
      }
    } catch {
      // Fallback
    }
  }

  if (!localStore.passwordResetOtps) {
    localStore.passwordResetOtps = [];
  }
  // Remove older active OTPs for same email to avoid confusion
  localStore.passwordResetOtps = localStore.passwordResetOtps.filter(
    (o) => o.email !== normalizedEmail || o.used
  );

  const newOtpRecord = {
    id,
    email: normalizedEmail,
    otp,
    expiresAt,
    used: false,
    createdAt: now.toISOString(),
  };

  localStore.passwordResetOtps.push(newOtpRecord);
  saveLocalStore(localStore);

  // Sync to Cloud Storage if table missing
  if (!tableInsertSucceeded && supabaseClient) {
    try {
      const cloudOtps = (await readFromCloudStorage<any[]>('password_reset_otps.json')) || [];
      const filtered = cloudOtps.filter((o: any) => o.email !== normalizedEmail || o.used);
      filtered.push(newOtpRecord);
      await writeToCloudStorage('password_reset_otps.json', filtered);
    } catch {
      // Local fallback saved
    }
  }

  return { id, email: normalizedEmail, otp, expiresAt };
}

export async function verifyPasswordResetOtp(
  email: string,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();
  const now = new Date();

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('password_reset_otps')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('otp', cleanOtp)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const record = data[0];
        if (new Date(record.expires_at) < now) {
          return { valid: false, reason: 'Reset code has expired. Please request a new one.' };
        }
        return { valid: true };
      }

      if (isTableMissingError(error)) {
        const cloudOtps = await readFromCloudStorage<any[]>('password_reset_otps.json');
        if (cloudOtps && Array.isArray(cloudOtps)) {
          const match = cloudOtps
            .filter((o: any) => o.email === normalizedEmail && o.otp === cleanOtp && !o.used)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          if (match) {
            if (new Date(match.expiresAt) < now) {
              return { valid: false, reason: 'Reset code has expired. Please request a new one.' };
            }
            return { valid: true };
          }
        }
      }
    } catch {
      // check local
    }
  }

  const list = localStore.passwordResetOtps || [];
  const match = list
    .filter((o) => o.email === normalizedEmail && o.otp === cleanOtp && !o.used)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!match) {
    return { valid: false, reason: 'Invalid reset code. Please check your email and try again.' };
  }

  if (new Date(match.expiresAt) < now) {
    return { valid: false, reason: 'Reset code has expired. Please request a new one.' };
  }

  return { valid: true };
}

export async function consumePasswordResetOtp(email: string, otp: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('password_reset_otps')
        .update({ used: true })
        .eq('email', normalizedEmail)
        .eq('otp', cleanOtp);
    } catch {
      // ignore
    }
    try {
      const cloudOtps = await readFromCloudStorage<any[]>('password_reset_otps.json');
      if (cloudOtps && Array.isArray(cloudOtps)) {
        cloudOtps.forEach((o: any) => {
          if (o.email === normalizedEmail && o.otp === cleanOtp) {
            o.used = true;
          }
        });
        await writeToCloudStorage('password_reset_otps.json', cloudOtps);
      }
    } catch {
      // ignore
    }
  }

  if (localStore.passwordResetOtps) {
    localStore.passwordResetOtps.forEach((o) => {
      if (o.email === normalizedEmail && o.otp === cleanOtp) {
        o.used = true;
      }
    });
    saveLocalStore(localStore);
  }
}

// -----------------------------------------------------------------------------
// PHASE 2: CUSTOM PROFILE PICTURES (STORAGE & AVATAR)
// -----------------------------------------------------------------------------

export async function saveUserAvatar(
  userId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `avatar-${userId}-${Date.now()}.${ext}`;

  // Try Supabase Storage first
  if (supabaseClient) {
    try {
      await ensureStorageBucket('avatars', true);
      const { error: uploadErr } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
        if (pubData && pubData.publicUrl) {
          const avatarUrl = pubData.publicUrl;
          await updateUser(userId, { avatarUrl });
          return avatarUrl;
        }
      }
    } catch {
      // ignore & proceed to data URI / local fallback
    }
  }

  // Fallback: Base64 data URL stored directly
  const base64 = buffer.toString('base64');
  const avatarUrl = `data:${mimeType};base64,${base64}`;
  await updateUser(userId, { avatarUrl });
  return avatarUrl;
}

export async function removeUserAvatar(userId: string): Promise<void> {
  await updateUser(userId, { avatarUrl: null });
}

// -----------------------------------------------------------------------------
// PHASE 2: LEAD REASSIGNMENT
// -----------------------------------------------------------------------------

export async function reassignLead(params: {
  leadId: string;
  newOwnerId: string;
  reassignedById: string;
}): Promise<Lead> {
  const currentLead = await getLeadById(params.leadId);
  if (!currentLead) throw new Error('Lead not found');

  const newOwner = await findUserById(params.newOwnerId);
  if (!newOwner) throw new Error('New owner user not found');

  const nowIso = new Date().toISOString();
  // If original_owner_id is not set, set it to current assigned_to
  const originalOwnerId = currentLead.original_owner_id || currentLead.assigned_to || undefined;
  const originalOwner = originalOwnerId ? await findUserById(originalOwnerId) : null;

  return await updateLead(params.leadId, {
    assigned_to: params.newOwnerId,
    assigned_to_name: newOwner.name,
    original_owner_id: originalOwnerId,
    original_owner_name: originalOwner?.name || undefined,
    reassigned_at: nowIso,
    reassigned_by: params.reassignedById,
  });
}

// -----------------------------------------------------------------------------
// PHASE 2: POTENTIAL CUSTOMERS
// -----------------------------------------------------------------------------

export async function listPotentialCustomers(search?: string): Promise<PotentialCustomer[]> {
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('potential_customers').select('*').order('created_at', { ascending: false });
      if (search && search.trim()) {
        const q = search.trim();
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,product_interest.ilike.%${q}%,notes.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          product_interest: d.product_interest || d.interest || '',
          notes: d.notes || undefined,
          email: d.email || undefined,
          source: d.source || undefined,
          created_by: d.created_by || undefined,
          created_by_name: d.created_by_name || undefined,
          createdAt: d.created_at,
          created_at: d.created_at,
          updatedAt: d.updated_at,
          updated_at: d.updated_at,
        }));
      }
    } catch {
      // ignore
    }
  }

  let list = [...(localStore.potentialCustomers || [])];
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.product_interest.toLowerCase().includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list;
}

export async function createPotentialCustomer(params: {
  name: string;
  phone: string;
  product_interest?: string;
  interest?: string;
  notes?: string;
  email?: string;
  source?: string;
  created_by?: string;
  created_by_name?: string;
  createdBy?: string;
  createdByName?: string;
}): Promise<PotentialCustomer> {
  const id = 'pc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();
  const productInterest = (params.product_interest || params.interest || '').trim();
  const createdBy = params.created_by || params.createdBy;
  const createdByName = params.created_by_name || params.createdByName;

  const customer: PotentialCustomer = {
    id,
    name: params.name.trim(),
    phone: params.phone.trim(),
    product_interest: productInterest,
    notes: params.notes?.trim() || undefined,
    email: params.email?.trim() || undefined,
    source: params.source?.trim() || undefined,
    created_by: createdBy,
    created_by_name: createdByName,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('potential_customers')
        .insert([
          {
            id,
            name: customer.name,
            phone: customer.phone,
            product_interest: customer.product_interest,
            notes: customer.notes || null,
            email: customer.email || null,
            source: customer.source || null,
            created_by: customer.created_by || null,
            created_by_name: customer.created_by_name || null,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          phone: data.phone,
          product_interest: data.product_interest || customer.product_interest,
          notes: data.notes || undefined,
          email: data.email || undefined,
          source: data.source || undefined,
          created_by: data.created_by || undefined,
          created_by_name: data.created_by_name || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }
    } catch {
      // fallback
    }
  }

  if (!localStore.potentialCustomers) localStore.potentialCustomers = [];
  localStore.potentialCustomers.unshift(customer);
  saveLocalStore(localStore);
  return customer;
}

export async function deletePotentialCustomer(id: string): Promise<void> {
  if (supabaseClient) {
    try {
      await supabaseClient.from('potential_customers').delete().eq('id', id);
    } catch {
      // ignore
    }
  }

  if (localStore.potentialCustomers) {
    localStore.potentialCustomers = localStore.potentialCustomers.filter((c) => c.id !== id);
    saveLocalStore(localStore);
  }
}

// -----------------------------------------------------------------------------
// PHASE 2: PINNED COMMENTS
// -----------------------------------------------------------------------------

export async function listPinnedComments(params?: {
  leadId?: string;
  callLogId?: string;
  authorId?: string;
  agentId?: string;
  targetAgentId?: string;
}): Promise<PinnedComment[]> {
  const filterLeadId = params?.leadId;
  const filterCallLogId = params?.callLogId;
  const filterAuthorId = params?.authorId;
  const filterAgentId = params?.agentId || params?.targetAgentId;

  if (supabaseClient) {
    try {
      let query = supabaseClient.from('pinned_comments').select('*').order('created_at', { ascending: false });
      if (filterLeadId) {
        query = query.eq('lead_id', filterLeadId);
        if (filterCallLogId) query = query.eq('call_log_id', filterCallLogId);
      } else {
        if (filterCallLogId) query = query.eq('call_log_id', filterCallLogId);
        if (filterAuthorId) query = query.eq('author_id', filterAuthorId);
        if (filterAgentId) {
          const { data: agentLeads } = await supabaseClient
            .from('leads')
            .select('id')
            .eq('assigned_to', filterAgentId);
          const agentLeadIds = (agentLeads || []).map((l: any) => l.id);
          if (agentLeadIds.length > 0) {
            query = query.or(`agent_id.eq.${filterAgentId},lead_id.in.(${agentLeadIds.join(',')})`);
          } else {
            query = query.eq('agent_id', filterAgentId);
          }
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          target_type: d.target_type || (d.call_log_id ? 'call_log' : 'lead'),
          lead_id: d.lead_id,
          lead_name: d.lead_name || undefined,
          lead_phone: d.lead_phone || undefined,
          call_log_id: d.call_log_id || undefined,
          call_log_snippet: d.call_log_snippet || undefined,
          author_id: d.author_id,
          author_name: d.author_name,
          author_avatar_url: d.author_avatar_url || undefined,
          agent_id: d.agent_id || undefined,
          agent_name: d.agent_name || undefined,
          content: d.content || d.comment_text || '',
          status: (d.status || 'unacknowledged') as PinnedCommentStatus,
          acknowledged_at: d.acknowledged_at || undefined,
          done_at: d.done_at || d.resolved_at || undefined,
          created_at: d.created_at,
        }));
      }
    } catch {
      // fallback
    }
  }

  let list = [...(localStore.pinnedComments || [])];
  if (filterLeadId) {
    list = list.filter((c) => c.lead_id === filterLeadId);
    if (filterCallLogId) list = list.filter((c) => c.call_log_id === filterCallLogId);
  } else {
    if (filterCallLogId) list = list.filter((c) => c.call_log_id === filterCallLogId);
    if (filterAuthorId) list = list.filter((c) => c.author_id === filterAuthorId);
    if (filterAgentId) {
      const agentLeadIds = new Set(
        localStore.leads.filter((l) => l.assigned_to === filterAgentId).map((l) => l.id)
      );
      list = list.filter((c) => c.agent_id === filterAgentId || (c.lead_id && agentLeadIds.has(c.lead_id)));
    }
  }

  // Hydrate lead and agent names if missing
  for (const c of list) {
    if (c.lead_id && (!c.lead_name || !c.lead_phone)) {
      const targetLead = localStore.leads.find((l) => l.id === c.lead_id);
      if (targetLead) {
        c.lead_name = c.lead_name || targetLead.name;
        c.lead_phone = c.lead_phone || targetLead.phone;
      }
    }
    if (c.agent_id && !c.agent_name) {
      const targetUser = localStore.users.find((u) => u.id === c.agent_id);
      if (targetUser) {
        c.agent_name = targetUser.name;
      }
    }
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list;
}

export async function createPinnedComment(params: {
  lead_id?: string;
  leadId?: string;
  lead_name?: string;
  leadName?: string;
  lead_phone?: string;
  leadPhone?: string;
  call_log_id?: string;
  callLogId?: string;
  call_log_snippet?: string;
  callLogSnippet?: string;
  author_id?: string;
  authorId?: string;
  author_name?: string;
  authorName?: string;
  author_avatar_url?: string;
  authorAvatarUrl?: string;
  agent_id?: string;
  agentId?: string;
  agent_name?: string;
  agentName?: string;
  targetAgentId?: string;
  content?: string;
  commentText?: string;
}): Promise<PinnedComment> {
  const id = 'pin_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();
  const leadId = params.lead_id || params.leadId || '';
  const callLogId = params.call_log_id || params.callLogId;
  const authorId = params.author_id || params.authorId || '';
  const authorName = params.author_name || params.authorName || 'Manager';
  const authorAvatarUrl = params.author_avatar_url || params.authorAvatarUrl;
  const agentId = params.agent_id || params.agentId || params.targetAgentId;
  const content = (params.content || params.commentText || '').trim();

  let leadName = params.lead_name || params.leadName;
  let leadPhone = params.lead_phone || params.leadPhone;
  let callLogSnippet = params.call_log_snippet || params.callLogSnippet;
  let agentName = params.agent_name || params.agentName;

  if (leadId && (!leadName || !leadPhone)) {
    const lead = await getLeadById(leadId);
    if (lead) {
      leadName = leadName || lead.name;
      leadPhone = leadPhone || lead.phone;
      if (callLogId && !callLogSnippet) {
        const foundLog = lead.call_logs.find((c) => c.id === callLogId);
        if (foundLog) {
          callLogSnippet = foundLog.summary || foundLog.full_notes?.slice(0, 100);
        }
      }
    }
  }

  if (agentId && !agentName) {
    const users = await listUsers();
    const targetAgent = users.find((u) => u.id === agentId);
    if (targetAgent) {
      agentName = targetAgent.name;
    }
  }

  const comment: PinnedComment = {
    id,
    target_type: callLogId ? 'call_log' : 'lead',
    lead_id: leadId,
    lead_name: leadName,
    lead_phone: leadPhone,
    call_log_id: callLogId,
    call_log_snippet: callLogSnippet,
    author_id: authorId,
    author_name: authorName,
    author_avatar_url: authorAvatarUrl,
    agent_id: agentId,
    agent_name: agentName,
    content,
    status: 'unacknowledged',
    created_at: nowIso,
  };

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('pinned_comments')
        .insert([
          {
            id,
            target_type: comment.target_type,
            lead_id: comment.lead_id,
            call_log_id: comment.call_log_id || null,
            author_id: comment.author_id,
            author_name: comment.author_name,
            author_avatar_url: comment.author_avatar_url || null,
            agent_id: comment.agent_id || null,
            content: comment.content,
            status: 'unacknowledged',
            created_at: nowIso,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          target_type: data.target_type || comment.target_type,
          lead_id: data.lead_id,
          lead_name: comment.lead_name,
          lead_phone: comment.lead_phone,
          call_log_id: data.call_log_id || undefined,
          call_log_snippet: comment.call_log_snippet,
          author_id: data.author_id,
          author_name: data.author_name,
          author_avatar_url: data.author_avatar_url || undefined,
          agent_id: data.agent_id || undefined,
          agent_name: comment.agent_name,
          content: data.content,
          status: data.status as PinnedCommentStatus,
          acknowledged_at: data.acknowledged_at || undefined,
          done_at: data.done_at || undefined,
          created_at: data.created_at,
        };
      }
    } catch {
      // fallback
    }
  }

  if (!localStore.pinnedComments) localStore.pinnedComments = [];
  localStore.pinnedComments.unshift(comment);
  saveLocalStore(localStore);
  return comment;
}

export async function updatePinnedCommentStatus(
  id: string,
  status: PinnedCommentStatus
): Promise<PinnedComment> {
  const nowIso = new Date().toISOString();

  if (supabaseClient) {
    try {
      const payload: any = { status };
      if (status === 'acknowledged') {
        payload.acknowledged_at = nowIso;
      } else if (status === 'done') {
        payload.done_at = nowIso;
        payload.acknowledged_at = nowIso;
      }

      const { data, error } = await supabaseClient
        .from('pinned_comments')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        if (localStore.pinnedComments) {
          const found = localStore.pinnedComments.find((c) => c.id === id);
          if (found) {
            found.status = status;
            found.acknowledged_at = data.acknowledged_at;
            found.done_at = data.done_at;
          }
        }
        return {
          id: data.id,
          target_type: data.target_type || (data.call_log_id ? 'call_log' : 'lead'),
          lead_id: data.lead_id,
          call_log_id: data.call_log_id || undefined,
          author_id: data.author_id,
          author_name: data.author_name,
          author_avatar_url: data.author_avatar_url || undefined,
          agent_id: data.agent_id || undefined,
          content: data.content,
          status: data.status as PinnedCommentStatus,
          acknowledged_at: data.acknowledged_at || undefined,
          done_at: data.done_at || undefined,
          created_at: data.created_at,
        };
      }
    } catch {
      // fallback
    }
  }

  if (!localStore.pinnedComments) localStore.pinnedComments = [];
  const found = localStore.pinnedComments.find((c) => c.id === id);
  if (found) {
    found.status = status;
    if (status === 'acknowledged') {
      found.acknowledged_at = found.acknowledged_at || nowIso;
    } else if (status === 'done') {
      found.done_at = nowIso;
      found.acknowledged_at = found.acknowledged_at || nowIso;
    }
    saveLocalStore(localStore);
    return found;
  }
  throw new Error('Pinned comment not found');
}

// -----------------------------------------------------------------------------
// PHASE 2: NEWSLETTER LOGS
// -----------------------------------------------------------------------------

export async function listNewsletterLogs(): Promise<NewsletterLog[]> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('newsletter_logs')
        .select('*')
        .order('sent_at', { ascending: false });

      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          subject: d.subject,
          message: d.message || d.body_html || '',
          recipient_count: d.recipient_count || d.recipients_count || 0,
          recipient_type: d.recipient_type || d.recipient_category || 'all_active',
          recipients: d.recipients || [],
          sent_by: d.sent_by || undefined,
          sent_by_name: d.sent_by_name || undefined,
          sent_at: d.sent_at,
          status: d.status as 'sent' | 'partial' | 'failed' | 'simulated',
          error_message: d.error_message || undefined,
        }));
      }
    } catch {
      // fallback
    }
  }

  const list = [...(localStore.newsletterLogs || [])];
  list.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  return list;
}

export async function createNewsletterLog(params: {
  subject: string;
  message: string;
  recipient_count: number;
  recipient_type: string;
  recipients?: Array<{ name: string; email?: string; phone?: string }>;
  status: 'sent' | 'partial' | 'failed' | 'simulated';
  error_message?: string;
  sent_by?: string;
  sent_by_name?: string;
}): Promise<NewsletterLog> {
  const id = 'news_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  const log: NewsletterLog = {
    id,
    subject: params.subject.trim(),
    message: params.message,
    recipient_count: params.recipient_count,
    recipient_type: params.recipient_type,
    recipients: params.recipients || [],
    status: params.status,
    error_message: params.error_message,
    sent_by: params.sent_by,
    sent_by_name: params.sent_by_name,
    sent_at: nowIso,
  };

  if (supabaseClient) {
    try {
      await supabaseClient.from('newsletter_logs').insert([
        {
          id,
          subject: log.subject,
          message: log.message,
          recipient_count: log.recipient_count,
          recipient_type: log.recipient_type,
          recipients: log.recipients,
          status: log.status,
          error_message: log.error_message || null,
          sent_by: log.sent_by || null,
          sent_by_name: log.sent_by_name || null,
          sent_at: nowIso,
        },
      ]);
      return log;
    } catch {
      // fallback
    }
  }

  if (!localStore.newsletterLogs) localStore.newsletterLogs = [];
  localStore.newsletterLogs.unshift(log);
  saveLocalStore(localStore);
  return log;
}

export async function flushUserData(userIds: string[]): Promise<{
  success: boolean;
  deletedLeadsCount: number;
  deletedCallLogsCount: number;
  deletedDirectivesCount: number;
}> {
  if (!userIds || userIds.length === 0) {
    return { success: true, deletedLeadsCount: 0, deletedCallLogsCount: 0, deletedDirectivesCount: 0 };
  }

  let deletedLeadsCount = 0;
  let deletedCallLogsCount = 0;
  let deletedDirectivesCount = 0;

  if (supabaseClient) {
    try {
      const { data: leadsToDelete } = await supabaseClient
        .from('leads')
        .select('id')
        .or(`assigned_to.in.(${userIds.join(',')}),original_owner_id.in.(${userIds.join(',')})`);

      const leadIds = (leadsToDelete || []).map((l: any) => l.id);

      let pinQuery = supabaseClient.from('pinned_comments').delete();
      if (leadIds.length > 0) {
        pinQuery = pinQuery.or(`lead_id.in.(${leadIds.join(',')}),agent_id.in.(${userIds.join(',')})`);
      } else {
        pinQuery = pinQuery.in('agent_id', userIds);
      }
      const pinRes = await pinQuery.select('id');
      deletedDirectivesCount = pinRes.data?.length || 0;

      let logQuery = supabaseClient.from('call_logs').delete();
      if (leadIds.length > 0) {
        logQuery = logQuery.or(`lead_id.in.(${leadIds.join(',')}),logged_by.in.(${userIds.join(',')})`);
      } else {
        logQuery = logQuery.in('logged_by', userIds);
      }
      const logRes = await logQuery.select('id');
      deletedCallLogsCount = logRes.data?.length || 0;

      if (leadIds.length > 0) {
        const leadRes = await supabaseClient.from('leads').delete().in('id', leadIds).select('id');
        deletedLeadsCount = leadRes.data?.length || 0;
      }
    } catch (err) {
      console.error('Error in flushUserData:', err);
    }
  }

  const userSet = new Set(userIds);
  const leadsToRemove = localStore.leads.filter(
    (l) => userSet.has(l.assigned_to || '') || userSet.has(l.original_owner_id || '')
  );
  const leadIdSet = new Set(leadsToRemove.map((l) => l.id));

  deletedLeadsCount = Math.max(deletedLeadsCount, leadsToRemove.length);

  localStore.leads = localStore.leads.filter((l) => !leadIdSet.has(l.id));
  localStore.call_logs = (localStore.call_logs || []).filter(
    (c) => !leadIdSet.has(c.lead_id) && !userSet.has(c.logged_by || '')
  );
  localStore.pinnedComments = (localStore.pinnedComments || []).filter(
    (p) => !leadIdSet.has(p.lead_id) && !userSet.has(p.agent_id || '')
  );
  saveLocalStore(localStore);

  return {
    success: true,
    deletedLeadsCount,
    deletedCallLogsCount,
    deletedDirectivesCount,
  };
}
