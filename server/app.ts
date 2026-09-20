import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import type { Lead, OutcomeTag, Priority, User, UserRole, PotentialCustomer, PinnedComment, PinnedCommentStatus } from '../src/types';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  getLeads,
  getLeadById,
  findLeadByPhone,
  createLead,
  updateLead,
  addCallLog,
  getDueFollowUps,
  markLeadNotified,
  logNotification,
  cleanPhone,
  isPhoneMatch,
  isUsingSupabase,
  checkDatabaseStatus,
  countUsers,
  findUserByIdWithPassword,
  savePushSubscription,
  deletePushSubscription,
  getPushSubscriptions,
  createPasswordResetOtp,
  verifyPasswordResetOtp,
  consumePasswordResetOtp,
  saveUserAvatar,
  removeUserAvatar,
  reassignLead,
  listPotentialCustomers,
  createPotentialCustomer,
  deletePotentialCustomer,
  listPinnedComments,
  createPinnedComment,
  updatePinnedCommentStatus,
  deletePinnedComment,
  listNewsletterLogs,
  createNewsletterLog,
  flushUserData,
  bulkCheckLeadDuplicates,
  bulkImportLeads,
  getObjectionCards,
  createObjectionCard,
  updateObjectionCard,
  deleteObjectionCard,
  resetDefaultObjectionCards,
  getCallScripts,
  createCallScript,
  updateCallScript,
  deleteCallScript,
  resetDefaultCallScripts,
  getCadenceConfig,
  updateCadenceConfig,
  resetCadenceConfig,
  listAssistanceTickets,
  createAssistanceTicket,
  acceptAssistanceTicket,
  cancelAssistanceTicket,
} from './db.js';
import {
  hashPassword,
  comparePassword,
  signSessionToken,
  verifySessionToken,
} from './auth.js';
import {
  DEFAULT_RESEND_API_KEY,
  DEFAULT_CRON_SECRET,
} from './supabaseConfig.js';
import {
  getVapidPublicKey,
  sendWebPush,
} from './webPush.js';
import {
  enhanceCallNotesWithGemini,
  composeFollowUpWithGemini,
  assessLeadHealthWithGemini,
  getAdminGeminiConfig,
  updateAdminGeminiConfig,
  testAdminGeminiConfig,
  classifyInboundWhatsAppMessage,
} from './gemini.js';

dotenv.config();

function getResendApiKey(): string | null {
  return (process.env.RESEND_API_KEY || DEFAULT_RESEND_API_KEY || '').trim() || null;
}

function getCronSecret(): string | null {
  return (process.env.CRON_SECRET || DEFAULT_CRON_SECRET || '').trim() || null;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Serve service worker with explicit JS mime type and Service-Worker-Allowed header
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(process.cwd(), 'public', 'sw.js'));
});

// Serve web app manifest
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.resolve(process.cwd(), 'public', 'manifest.json'));
});

// Serve public static assets (icons, images, manifest)
app.use(express.static(path.resolve(process.cwd(), 'public')));

// ==========================================
// AUTHENTICATION & ROLE MIDDLEWARE
// ==========================================

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  try {
    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }
    (req as any).user = user;
    next();
  } catch (err) {
    console.error('requireAuth database lookup error:', err);
    return res.status(500).json({ error: 'Authentication verification failed' });
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as User;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

function requireManagerOrAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as User;
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return res.status(403).json({ error: 'Manager or Admin privileges required' });
  }
  next();
}

// System Status / Health
app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDatabaseStatus();
  res.json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/database/status', async (req, res) => {
  const dbStatus = await checkDatabaseStatus();
  res.json(dbStatus);
});

// ==========================================
// AUTH & USER ENDPOINTS
// ==========================================

function getDatabaseErrorMessage(err: any): { status: number; message: string } | null {
  if (!err) return null;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '').toLowerCase();
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('could not find the table')
  ) {
    return {
      status: 503,
      message: "Supabase database tables are not created yet. Please execute the SQL in 'supabase-schema.sql' in your Supabase SQL Editor.",
    };
  }
  if (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security') ||
    msg.includes('rls')
  ) {
    return {
      status: 403,
      message: "Supabase Permission Denied: Please execute 'supabase-schema.sql' to disable RLS, or configure SUPABASE_SERVICE_ROLE_KEY in your environment variables.",
    };
  }
  return null;
}

// Check if initial admin setup is required (zero users in database)
app.get('/api/auth/setup-status', async (req, res) => {
  try {
    const userCount = await countUsers();
    res.json({
      isSetupComplete: userCount > 0,
      userCount,
    });
  } catch (err: any) {
    console.error('setup-status error:', err);
    const dbErr = getDatabaseErrorMessage(err);
    if (dbErr) {
      return res.status(dbErr.status).json({ error: dbErr.message });
    }
    res.status(500).json({ error: err?.message || 'Failed to verify setup status' });
  }
});

// Setup First Master Administrator account (only permitted when 0 users exist)
app.post('/api/auth/setup-first-admin', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid work email is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const userCount = await countUsers();
    if (userCount > 0) {
      return res.status(403).json({
        error: 'System setup has already been completed. An administrator account already exists.',
      });
    }

    const passwordHash = await hashPassword(password);
    const newAdmin = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'admin',
      passwordHash,
    });

    const nowIso = new Date().toISOString();
    const safeUser: User = {
      id: newAdmin.id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: 'admin',
      createdAt: newAdmin.createdAt || nowIso,
      lastLoginAt: nowIso,
    };

    const token = signSessionToken(safeUser);

    return res.json({
      user: safeUser,
      token,
      message: 'Master Admin account initialized successfully.',
    });
  } catch (err: any) {
    console.error('setup-first-admin error:', err);
    const dbErr = getDatabaseErrorMessage(err);
    if (dbErr) {
      return res.status(dbErr.status).json({ error: dbErr.message });
    }
    return res.status(500).json({ error: err.message || 'Failed to create initial admin account' });
  }
});

// 1. Step 1: Check if email exists in system
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({
        exists: false,
        message: "You don't have access.",
      });
    }

    return res.json({
      exists: true,
      name: user.name,
      email: user.email,
    });
  } catch (err: any) {
    console.error('check-email error:', err);
    const dbErr = getDatabaseErrorMessage(err);
    if (dbErr) {
      return res.status(dbErr.status).json({ error: dbErr.message });
    }
    return res.status(500).json({ error: err?.message || 'Failed to verify email' });
  }
});

// 2. Step 2: Login with password using bcrypt verification & stateless JWT
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(403).json({ error: "You don't have access." });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // Update lastLoginAt and firstLoginAt if not set yet
    const nowIso = new Date().toISOString();
    const updates: any = { lastLoginAt: nowIso };
    if (!user.firstLoginAt) {
      updates.firstLoginAt = nowIso;
    }
    await updateUser(user.id, updates);

    const safeUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      managerId: user.managerId,
      firstLoginAt: user.firstLoginAt || nowIso,
      createdAt: user.createdAt,
      lastLoginAt: nowIso,
    };

    // Stateless JWT generation
    const token = signSessionToken(safeUser);

    return res.json({
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('login error:', err);
    const dbErr = getDatabaseErrorMessage(err);
    if (dbErr) {
      return res.status(dbErr.status).json({ error: dbErr.message });
    }
    return res.status(500).json({ error: err?.message || 'Login verification failed' });
  }
});

// 3. Request Password Reset OTP via Email
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        error: "No authorized CRM account found for this email address.",
      });
    }

    // Generate random 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await createPasswordResetOtp(normalizedEmail, otp, 15);

    const resendApiKey = getResendApiKey();
    let emailDispatched = false;

    if (resendApiKey) {
      try {
        const mailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ColdCall CRM <onboarding@resend.dev>',
            to: normalizedEmail,
            subject: `Your ColdCall CRM Password Reset Code: ${otp}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1c1917; background-color: #fbf9f5; border-radius: 12px; border: 1px solid #e7e5e4;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <div style="display: inline-block; background-color: #b45309; color: #ffffff; padding: 8px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    ColdCall CRM
                  </div>
                </div>
                <h2 style="color: #1c1917; font-size: 20px; margin-top: 0; margin-bottom: 12px; text-align: center;">Account Password Reset</h2>
                <p style="color: #44403c; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                  Hello <strong>${user.name}</strong>,<br/>
                  We received a request to reset your password. Enter this verification code to complete your password reset:
                </p>
                <div style="background-color: #ffffff; border: 2px dashed #b45309; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
                  <span style="font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: 800; color: #b45309;">${otp}</span>
                </div>
                <p style="color: #78716c; font-size: 13px; line-height: 1.5; margin-top: 20px;">
                  This code expires in <strong>15 minutes</strong>. If you did not request this code, your account is safe and you can discard this email.
                </p>
              </div>
            `,
          }),
        });

        const mailData = await mailResponse.json();
        if (mailResponse.ok) {
          emailDispatched = true;
        } else {
          console.warn('Resend OTP email response:', mailData);
        }
      } catch (mailErr) {
        console.error('Failed to send reset email via Resend:', mailErr);
      }
    }

    return res.json({
      success: true,
      message: 'Password reset code sent to your email address.',
      email: normalizedEmail,
      emailDispatched,
      devOtpHint: !resendApiKey ? otp : undefined,
    });
  } catch (err: any) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process password reset request.' });
  }
});

// 4. Verify Password Reset OTP and Set New Password
app.post('/api/auth/verify-reset-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  try {
    const check = await verifyPasswordResetOtp(normalizedEmail, cleanOtp);
    if (!check.valid) {
      return res.status(400).json({ error: check.reason || 'Invalid or expired code.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    await updateUser(user.id, { passwordHash, lastLoginAt: nowIso });
    await consumePasswordResetOtp(normalizedEmail, cleanOtp);

    const safeUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: nowIso,
    };

    const token = signSessionToken(safeUser);

    return res.json({
      success: true,
      user: safeUser,
      token,
      message: 'Password has been successfully updated.',
    });
  } catch (err: any) {
    console.error('verify-reset-otp error:', err);
    return res.status(500).json({ error: err.message || 'Failed to reset password.' });
  }
});

// Current user profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user as User;
  res.json({ user });
});

// Update own profile (name, password with current password verification)
app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  const currentUser = (req as any).user as User;
  const { name, currentPassword, newPassword } = req.body;

  try {
    const updates: any = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const userWithPwd = await findUserByIdWithPassword(currentUser.id);
      if (!userWithPwd) {
        return res.status(404).json({ error: 'User record not found' });
      }

      const isValid = await comparePassword(currentPassword, userWithPwd.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      updates.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await updateUser(currentUser.id, updates);
    const updated = await findUserById(currentUser.id);

    res.json({ success: true, user: updated, message: 'Profile updated successfully' });
  } catch (err: any) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile avatar (Base64 data or multipart, cropped, max 2MB, JPG/PNG)
app.post('/api/auth/profile/avatar', requireAuth, async (req, res) => {
  const currentUser = (req as any).user as User;
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Image data is required' });
  }

  const cleanMime = (mimeType || 'image/jpeg').toLowerCase();
  if (!cleanMime.includes('jpeg') && !cleanMime.includes('jpg') && !cleanMime.includes('png') && !cleanMime.includes('webp')) {
    return res.status(400).json({ error: 'Only JPG and PNG images are supported' });
  }

  try {
    const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    // 2MB validation
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Profile photo must be 2MB or smaller' });
    }

    const avatarUrl = await saveUserAvatar(currentUser.id, buffer, cleanMime);
    const updated = await findUserById(currentUser.id);

    res.json({
      success: true,
      avatarUrl,
      user: updated,
      message: 'Profile photo updated successfully',
    });
  } catch (err: any) {
    console.error('upload avatar error:', err);
    res.status(500).json({ error: 'Failed to save profile photo' });
  }
});

// Remove profile avatar (revert to initials)
app.delete('/api/auth/profile/avatar', requireAuth, async (req, res) => {
  const currentUser = (req as any).user as User;
  try {
    await removeUserAvatar(currentUser.id);
    const updated = await findUserById(currentUser.id);
    res.json({
      success: true,
      user: updated,
      message: 'Profile photo removed',
    });
  } catch (err: any) {
    console.error('remove avatar error:', err);
    res.status(500).json({ error: 'Failed to remove profile photo' });
  }
});

// Logout (stateless - client drops token)
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

// List users (Admin only)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err: any) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch user list' });
  }
});

// Admin grants access (creates user credentials with bcrypt hash)
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already has access' });
    }

    const passwordHash = await hashPassword(password);
    const validRoles = ['admin', 'manager', 'agent'];
    const userRole = (validRoles.includes(role) ? role : 'agent') as UserRole;
    const userName = name?.trim() || email.split('@')[0];

    const newUser = await createUser({
      email,
      name: userName,
      role: userRole,
      passwordHash,
      managerId: req.body.managerId || null,
    });

    res.status(201).json({ user: newUser, message: 'Access successfully granted' });
  } catch (err: any) {
    console.error('createUser error:', err);
    res.status(500).json({ error: err?.message || 'Failed to create user account' });
  }
});

// Admin deletes user access
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentAdmin = (req as any).user as User;
  if (currentAdmin.id === id) {
    return res.status(400).json({ error: 'Cannot revoke access for your own active admin account' });
  }

  try {
    await deleteUser(id);
    res.json({ success: true, message: 'User access revoked' });
  } catch (err: any) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Failed to revoke user access' });
  }
});

// Admin updates user
app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password, role, name, managerId } = req.body;

  try {
    const updates: any = {};
    if (password) {
      updates.passwordHash = await hashPassword(password);
    }
    if (role && (role === 'admin' || role === 'manager' || role === 'agent')) {
      updates.role = role as UserRole;
    }
    if (name) {
      updates.name = name.trim();
    }
    if (managerId !== undefined) {
      updates.managerId = managerId || null;
    }

    await updateUser(id, updates);
    const updated = await findUserById(id);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('updateUser error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/admin/flush-user-data', requireAuth, requireAdmin, async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'User IDs array is required' });
  }

  try {
    const result = await flushUserData(userIds);
    res.json({
      success: true,
      deletedLeadsCount: result.deletedLeadsCount,
      deletedCallLogsCount: result.deletedCallLogsCount,
      deletedDirectivesCount: result.deletedDirectivesCount,
    });
  } catch (err: any) {
    console.error('flushUserData error:', err);
    res.status(500).json({ error: 'Failed to flush user data' });
  }
});

// ==========================================
// LEADS API
// ==========================================

// Get leads (role-scoped)
app.get('/api/leads', requireAuth, async (req, res) => {
  const { view, search, reviewingAgentId, filter } = req.query;
  const currentUser = (req as any).user as User;

  try {
    const leads = await getLeads({
      view: view as string,
      search: search as string,
      filter: filter as string,
      reviewingAgentId: reviewingAgentId as string,
      userId: currentUser.id,
      userRole: currentUser.role,
    });
    res.json({ leads });
  } catch (err: any) {
    console.error('getLeads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead
app.get('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ lead });
  } catch (err: any) {
    console.error('getLeadById error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead
app.post('/api/leads', requireAuth, async (req, res) => {
  const { phone, name, business_notes, source, email, priority, assignedTo } = req.body;

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const currentUser = (req as any).user as User;

  try {
    const duplicate = await findLeadByPhone(phone);
    if (duplicate) {
      return res.status(409).json({
        error: `A lead with phone number ${phone} already exists (${duplicate.name})`,
        lead: duplicate,
      });
    }

    let targetAssignee = currentUser.id;
    if (currentUser.role === 'admin' && assignedTo) {
      targetAssignee = assignedTo;
    } else if (currentUser.role === 'manager' && assignedTo) {
      const teamUsers = await listUsers();
      const valid = teamUsers.some((u) => u.id === assignedTo && (u.id === currentUser.id || u.managerId === currentUser.id));
      if (valid) targetAssignee = assignedTo;
    }

    const newLead = await createLead({
      phone,
      name,
      business_notes,
      source,
      email: email?.trim() || undefined,
      priority,
      assignedTo: targetAssignee,
    });

    res.status(201).json({ lead: newLead });
  } catch (err: any) {
    console.error('createLead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Pre-flight check duplicate leads for CSV import
app.post('/api/leads/check-duplicates', requireAuth, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads must be an array' });
    }

    const checkResult = await bulkCheckLeadDuplicates(leads);
    res.json(checkResult);
  } catch (err: any) {
    console.error('check-duplicates error:', err);
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
});

// Bulk import leads from CSV / Wizard
app.post('/api/leads/bulk-import', requireAuth, async (req, res) => {
  try {
    const { leads, duplicateHandling = 'skip', defaultAssignee, roundRobinUserIds } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'No leads provided for import' });
    }

    const currentUser = (req as any).user as User;

    // Security & permission checks for assignee
    let safeDefaultAssignee: string | null = null;
    let safeRoundRobinIds: string[] = [];

    if (currentUser.role === 'admin') {
      safeDefaultAssignee = defaultAssignee || null;
      if (Array.isArray(roundRobinUserIds)) {
        safeRoundRobinIds = roundRobinUserIds;
      }
    } else if (currentUser.role === 'manager') {
      const teamUsers = await listUsers();
      const validSubordinateIds = new Set(
        teamUsers
          .filter((u) => u.id === currentUser.id || u.managerId === currentUser.id)
          .map((u) => u.id)
      );

      if (defaultAssignee && validSubordinateIds.has(defaultAssignee)) {
        safeDefaultAssignee = defaultAssignee;
      }
      if (Array.isArray(roundRobinUserIds)) {
        safeRoundRobinIds = roundRobinUserIds.filter((id) => validSubordinateIds.has(id));
      }
    } else {
      // Agents can only import to themselves
      safeDefaultAssignee = currentUser.id;
      safeRoundRobinIds = [];
    }

    const result = await bulkImportLeads(leads, {
      duplicateHandling,
      defaultAssignee: safeDefaultAssignee,
      roundRobinUserIds: safeRoundRobinIds,
      importedById: currentUser.id,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('bulk-import error:', err);
    res.status(500).json({ error: 'Failed to execute bulk import: ' + err.message });
  }
});

// Update lead details
app.patch('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { name, phone, business_notes, source, email, priority, next_action_at, status, business_info } = req.body;

    if (phone && cleanPhone(phone) !== cleanPhone(lead.phone)) {
      const duplicate = await findLeadByPhone(phone);
      if (duplicate && duplicate.id !== lead.id) {
        return res.status(409).json({ error: 'Another lead already uses this phone number' });
      }
    }

    const updated = await updateLead(lead.id, {
      name,
      phone,
      business_notes,
      source,
      email: email !== undefined ? email.trim() || undefined : undefined,
      priority,
      next_action_at,
      status,
      business_info,
    });

    res.json({ lead: updated });
  } catch (err: any) {
    console.error('updateLead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Reassign lead to another agent (Manager or Admin only)
app.post('/api/leads/:id/reassign', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { newOwnerId } = req.body;
  if (!newOwnerId) {
    return res.status(400).json({ error: 'New owner ID is required' });
  }

  const currentUser = (req as any).user as User;

  try {
    const targetLead = await getLeadById(req.params.id);
    if (!targetLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (currentUser.role === 'manager') {
      const targetUser = await findUserById(newOwnerId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }
      if (targetUser.id !== currentUser.id && targetUser.managerId !== currentUser.id) {
        return res.status(403).json({ error: 'You can only reassign leads to members of your own team' });
      }
    }

    const previousOwnerId = targetLead.assigned_to;
    const previousOwner = previousOwnerId ? await findUserById(previousOwnerId) : null;
    const newOwner = await findUserById(newOwnerId);

    const updated = await reassignLead({
      leadId: req.params.id,
      newOwnerId,
      reassignedById: currentUser.id,
    });

    if (previousOwner && previousOwner.id !== newOwnerId) {
      await logNotification({
        leadId: targetLead.id,
        leadName: targetLead.name,
        userEmail: previousOwner.email,
        type: 'reassignment',
        status: 'sent',
      });
      try {
        const pushSubs = await getPushSubscriptions();
        for (const sub of pushSubs) {
          await sendWebPush(sub, {
            title: `Lead Reassigned: ${targetLead.name}`,
            body: `Lead ${targetLead.name} was reassigned to ${newOwner?.name || 'another agent'} by ${currentUser.name}.`,
            tag: `reassign-${targetLead.id}`,
            url: `/?leadId=${targetLead.id}`,
          });
        }
      } catch {
        // push notification fallback
      }
    }

    res.json({
      success: true,
      lead: updated,
      message: 'Lead successfully reassigned',
    });
  } catch (err: any) {
    console.error('reassign lead error:', err);
    res.status(500).json({ error: err?.message || 'Failed to reassign lead' });
  }
});

// Log a call attempt on a lead (Relational write to call_logs table)
app.post('/api/leads/:id/calls', requireAuth, async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const user = (req as any).user as User;

    // Disabled call logging if lead was reassigned away from this agent
    if (user.role === 'agent' && lead.assigned_to && lead.assigned_to !== user.id) {
      return res.status(403).json({
        error: 'This lead has been reassigned to another agent. Call logging is disabled for past assignees.',
      });
    }

    const { outcome_tag, summary, full_notes, next_action_at, business_info, priority, audio_url, audio_duration, audio_name } = req.body;

    if (!outcome_tag) {
      return res.status(400).json({ error: 'Outcome tag is required' });
    }

    const nowIso = new Date().toISOString();

    // 1. Relational insert into call_logs table with foreign key lead_id
    const newLog = await addCallLog({
      leadId: lead.id,
      summary: summary?.trim() || `Call logged: ${outcome_tag}`,
      full_notes: full_notes?.trim() || '',
      outcome_tag: outcome_tag as OutcomeTag,
      business_info: business_info?.trim() || undefined,
      logged_by: user.id,
      logged_by_name: user.name || user.email,
      audio_url: audio_url || null,
      audio_duration: typeof audio_duration === 'number' ? audio_duration : null,
      audio_name: audio_name || null,
    });

    // 2. Prepare lead updates
    const updates: any = {};
    if (priority) {
      updates.priority = priority;
    }

    if (business_info && business_info.trim()) {
      updates.business_info = lead.business_info
        ? `${lead.business_info}\n• [${new Date().toLocaleDateString()}] ${business_info.trim()}`
        : `• [${new Date().toLocaleDateString()}] ${business_info.trim()}`;
    }

    // Handle outcome-specific status updates
    if (outcome_tag === 'Closed/Matured') {
      updates.status = 'Matured (Closed)';
      updates.next_action_at = null;
    } else if (outcome_tag === 'Service Denied') {
      updates.status = 'Service Denied';
      updates.next_action_at = null;
      updates.archived_at = nowIso;
      updates.archive_reason = summary?.trim() || 'Marked as Service Denied during call';
    } else {
      if (next_action_at) {
        updates.next_action_at = next_action_at;
        updates.status = 'Follow-up Scheduled';
      } else if (lead.status === 'Follow-up Scheduled' && !next_action_at) {
        updates.status = 'Active';
        updates.next_action_at = null;
      }
    }

    const updatedLead = await updateLead(lead.id, updates);
    res.json({ lead: updatedLead, log: newLog });
  } catch (err: any) {
    console.error('logCall error:', err);
    res.status(500).json({ error: 'Failed to record call log' });
  }
});

// Manual archive/unarchive
app.post('/api/leads/:id/archive', requireAuth, async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { archive, reason } = req.body;
    const nowIso = new Date().toISOString();

    const updates: any = {};
    if (archive === false) {
      updates.status = 'Active';
      updates.archived_at = null;
      updates.archive_reason = null;
    } else {
      updates.status = 'Archived';
      updates.archived_at = nowIso;
      updates.archive_reason = reason || 'Manually archived';
      updates.next_action_at = null;
    }

    const updatedLead = await updateLead(lead.id, updates);
    res.json({ lead: updatedLead });
  } catch (err: any) {
    console.error('archiveLead error:', err);
    res.status(500).json({ error: 'Failed to update archive status' });
  }
});

// ==========================================
// STANDARDIZED PROFESSIONAL CSV EXPORT & SANITIZATION
// ==========================================

function sanitizeAndEscapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  // Prevent CSV Formula Injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Standardize carriage returns to standard newline
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Escape double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

function formatIsoTimestamp(val: string | number | Date | undefined | null): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toISOString();
  } catch {
    return String(val);
  }
}

// Professional Leads CSV Export
app.get('/api/leads/export/csv', requireAuth, async (req, res) => {
  const { type } = req.query; // 'closed', 'archived', or 'all'
  const currentUser = (req as any).user as User;

  try {
    let targetLeads = await getLeads({
      userId: currentUser.id,
      userRole: currentUser.role,
    });

    if (type === 'closed') {
      targetLeads = targetLeads.filter((l) => l.status === 'Matured (Closed)');
    } else if (type === 'archived') {
      targetLeads = targetLeads.filter((l) => l.status === 'Service Denied' || l.status === 'Archived');
    } else if (type === 'all') {
      targetLeads = targetLeads;
    } else {
      targetLeads = targetLeads.filter(
        (l) => l.status === 'Matured (Closed)' || l.status === 'Service Denied' || l.status === 'Archived'
      );
    }

    const headers = [
      'Lead ID',
      'Name',
      'Phone Number',
      'Email',
      'Status',
      'Priority',
      'Assigned Agent ID',
      'Original Creator ID',
      'Source',
      'Created At (ISO)',
      'Last Updated (ISO)',
      'Reassigned At (ISO)',
      'Total Calls Logged',
      'Business Info',
      'All Notes & Full Call Logs',
    ];

    const rows = targetLeads.map((lead) => {
      const concatenatedNotes = [
        lead.business_notes ? `[Base Notes]: ${lead.business_notes}` : '',
        ...(lead.call_logs || []).map(
          (c) =>
            `[${formatIsoTimestamp(c.timestamp)} - ${c.outcome_tag} by ${c.logged_by_name || c.logged_by || 'Agent'}]: ${c.summary} | ${c.full_notes} ${
              c.business_info ? `(Biz Info: ${c.business_info})` : ''
            }`
        ),
      ]
        .filter(Boolean)
        .join('\n---\n');

      return [
        sanitizeAndEscapeCsv(lead.id),
        sanitizeAndEscapeCsv(lead.name),
        sanitizeAndEscapeCsv(lead.phone),
        sanitizeAndEscapeCsv(lead.email || ''),
        sanitizeAndEscapeCsv(lead.status),
        sanitizeAndEscapeCsv(lead.priority),
        sanitizeAndEscapeCsv(lead.assigned_to || ''),
        sanitizeAndEscapeCsv((lead as any).created_by || lead.assigned_to_name || ''),
        sanitizeAndEscapeCsv(lead.source),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.created_at)),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.updated_at)),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.reassigned_at)),
        sanitizeAndEscapeCsv((lead.call_logs || []).length),
        sanitizeAndEscapeCsv(lead.business_info || ''),
        sanitizeAndEscapeCsv(concatenatedNotes),
      ].join(',');
    });

    const csvContent = [headers.map(sanitizeAndEscapeCsv).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads_export_${type || 'all'}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('exportCsv error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Professional Potential Customers CSV Export
app.get('/api/potential-customers/export/csv', requireAuth, async (req, res) => {
  try {
    const customers = await listPotentialCustomers();
    const headers = [
      'Customer ID',
      'Name',
      'Phone Number',
      'Email',
      'Interest Description',
      'Source',
      'Created At (ISO)',
      'Updated At (ISO)',
    ];

    const rows = customers.map((c) => [
      sanitizeAndEscapeCsv(c.id),
      sanitizeAndEscapeCsv(c.name),
      sanitizeAndEscapeCsv(c.phone),
      sanitizeAndEscapeCsv(c.email || ''),
      sanitizeAndEscapeCsv(c.product_interest || (c as any).interest || ''),
      sanitizeAndEscapeCsv(c.source || ''),
      sanitizeAndEscapeCsv(formatIsoTimestamp(c.created_at)),
      sanitizeAndEscapeCsv(formatIsoTimestamp(c.updated_at)),
    ].join(','));

    const csvContent = [headers.map(sanitizeAndEscapeCsv).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="potential_customers_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('potential customers export error:', err);
    res.status(500).json({ error: 'Failed to export potential customers CSV' });
  }
});

// Admin Export All System Data (All Leads across all Agents, Managers, and Admins)
app.get('/api/admin/export/all-data/csv', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Unrestricted getLeads across all users and roles
    const allLeads = await getLeads({ filter: 'all' });
    const allUsers = await listUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const headers = [
      'Lead ID',
      'Name',
      'Phone Number',
      'Email',
      'Status',
      'Priority',
      'Assigned User Name',
      'Assigned User Email',
      'Assigned User Role',
      'Reporting Manager ID',
      'Original Creator',
      'Source',
      'Created At (ISO)',
      'Last Updated (ISO)',
      'Next Follow-up Due (ISO)',
      'Total Calls Logged',
      'Business Info',
      'All Notes & Full Call Logs',
    ];

    const rows = allLeads.map((lead) => {
      const assignedUser = lead.assigned_to ? userMap.get(lead.assigned_to) : null;
      const creatorUser = lead.original_owner_id ? userMap.get(lead.original_owner_id) : null;

      const concatenatedNotes = [
        lead.business_notes ? `[Base Notes]: ${lead.business_notes}` : '',
        ...(lead.call_logs || []).map(
          (c) =>
            `[${formatIsoTimestamp(c.timestamp)} - ${c.outcome_tag} by ${c.logged_by_name || (c.logged_by ? userMap.get(c.logged_by)?.name : '') || 'Agent'}]: ${c.summary} | ${c.full_notes} ${
              c.business_info ? `(Biz Info: ${c.business_info})` : ''
            }`
        ),
      ]
        .filter(Boolean)
        .join('\n---\n');

      return [
        sanitizeAndEscapeCsv(lead.id),
        sanitizeAndEscapeCsv(lead.name),
        sanitizeAndEscapeCsv(lead.phone),
        sanitizeAndEscapeCsv(lead.email || ''),
        sanitizeAndEscapeCsv(lead.status),
        sanitizeAndEscapeCsv(lead.priority),
        sanitizeAndEscapeCsv(assignedUser ? assignedUser.name : (lead.assigned_to_name || 'Unassigned')),
        sanitizeAndEscapeCsv(assignedUser ? assignedUser.email : ''),
        sanitizeAndEscapeCsv(assignedUser ? assignedUser.role : ''),
        sanitizeAndEscapeCsv(assignedUser?.managerId || ''),
        sanitizeAndEscapeCsv(creatorUser ? `${creatorUser.name} (${creatorUser.role})` : (lead.original_owner_id || '')),
        sanitizeAndEscapeCsv(lead.source || ''),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.created_at)),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.updated_at)),
        sanitizeAndEscapeCsv(formatIsoTimestamp(lead.next_action_at)),
        sanitizeAndEscapeCsv((lead.call_logs || []).length),
        sanitizeAndEscapeCsv(lead.business_info || ''),
        sanitizeAndEscapeCsv(concatenatedNotes),
      ].join(',');
    });

    const csvContent = [headers.map(sanitizeAndEscapeCsv).join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="coldcall_crm_all_users_data_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('All users data export error:', err);
    res.status(500).json({ error: 'Failed to export all system data' });
  }
});

// ==========================================
// POTENTIAL CUSTOMERS API
// ==========================================

app.get('/api/potential-customers', requireAuth, async (req, res) => {
  const { search } = req.query;
  try {
    const customers = await listPotentialCustomers(search as string);
    res.json({ customers });
  } catch (err: any) {
    console.error('listPotentialCustomers error:', err);
    res.status(500).json({ error: 'Failed to fetch potential customers' });
  }
});

app.post('/api/potential-customers', requireAuth, async (req, res) => {
  const { name, phone, email, interest, product_interest, source } = req.body;
  const interestVal = (product_interest || interest || '').trim();
  if (!name || !phone || !interestVal) {
    return res.status(400).json({ error: 'Name, phone number, and interest are required' });
  }

  const currentUser = (req as any).user as User;

  try {
    const customer = await createPotentialCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      product_interest: interestVal,
      source: source ? source.trim() : undefined,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });
    res.status(201).json({ customer });
  } catch (err: any) {
    console.error('createPotentialCustomer error:', err);
    res.status(500).json({ error: 'Failed to save potential customer' });
  }
});

app.delete('/api/potential-customers/:id', requireAuth, async (req, res) => {
  try {
    await deletePotentialCustomer(req.params.id);
    res.json({ success: true, message: 'Customer record deleted' });
  } catch (err: any) {
    console.error('deletePotentialCustomer error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ==========================================
// PINNED COMMENTS API (Manager-to-Agent communication)
// ==========================================

app.get('/api/pinned-comments', requireAuth, async (req, res) => {
  const { leadId, targetUserId, agentId, status, authorId } = req.query;
  const currentUser = (req as any).user as User;

  try {
    let filterAgentId = (targetUserId || agentId) as string | undefined;
    let filterAuthorId: string | undefined = undefined;

    if (currentUser.role === 'agent') {
      if (!leadId) {
        filterAgentId = currentUser.id;
      }
    } else if (currentUser.role === 'manager') {
      if (authorId === 'all') {
        filterAuthorId = undefined;
      } else if (authorId === 'me' || (!authorId && !filterAgentId && !leadId)) {
        filterAuthorId = currentUser.id;
      } else if (authorId) {
        filterAuthorId = authorId as string;
      }
    } else if (currentUser.role === 'admin') {
      if (authorId === 'me') {
        filterAuthorId = currentUser.id;
      } else if (authorId && authorId !== 'all') {
        filterAuthorId = authorId as string;
      }
    }

    const comments = await listPinnedComments({
      leadId: leadId as string,
      agentId: filterAgentId,
      authorId: filterAuthorId,
    });
    let result = comments;
    if (status) {
      result = result.filter((c) => c.status === status);
    }
    res.json({ comments: result });
  } catch (err: any) {
    console.error('listPinnedComments error:', err);
    res.status(500).json({ error: 'Failed to fetch pinned comments' });
  }
});

app.post('/api/pinned-comments', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { leadId, callLogId, targetUserId, agentId, comment, content, leadName, leadPhone, callLogSnippet, agentName } = req.body;
  const message = (comment || content || '').trim();
  if (!message) {
    return res.status(400).json({ error: 'Comment message is required' });
  }

  const currentUser = (req as any).user as User;
  let targetAgentId = targetUserId || agentId;

  let finalLeadName = leadName;
  let finalLeadPhone = leadPhone;
  let finalCallSnippet = callLogSnippet;
  let finalAgentName = agentName;

  if (leadId) {
    const targetLead = await getLeadById(leadId);
    if (targetLead) {
      finalLeadName = finalLeadName || targetLead.name;
      finalLeadPhone = finalLeadPhone || targetLead.phone;
      finalAgentName = finalAgentName || targetLead.assigned_to_name;
      if (!targetAgentId && targetLead.assigned_to) {
        targetAgentId = targetLead.assigned_to;
      }
      if (callLogId && !finalCallSnippet) {
        const cl = targetLead.call_logs?.find((c) => c.id === callLogId);
        if (cl) {
          finalCallSnippet = cl.summary || cl.outcome_tag;
        }
      }
    }
  }

  if (!targetAgentId) {
    return res.status(400).json({ error: 'A specific target agent must be selected for pinned comments' });
  }

  try {
    const pinned = await createPinnedComment({
      lead_id: leadId || undefined,
      lead_name: finalLeadName,
      lead_phone: finalLeadPhone,
      call_log_id: callLogId || undefined,
      call_log_snippet: finalCallSnippet,
      agent_id: targetAgentId,
      agent_name: finalAgentName,
      author_id: currentUser.id,
      author_name: currentUser.name,
      author_avatar_url: currentUser.avatarUrl || undefined,
      content: message,
    });
    res.status(201).json({ comment: pinned });
  } catch (err: any) {
    console.error('createPinnedComment error:', err);
    res.status(500).json({ error: 'Failed to pin comment' });
  }
});

app.patch('/api/pinned-comments/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  let normalizedStatus: PinnedCommentStatus = 'unacknowledged';
  if (status === 'done' || status === 'resolved') normalizedStatus = 'done';
  else if (status === 'acknowledged') normalizedStatus = 'acknowledged';
  else normalizedStatus = 'unacknowledged';

  try {
    const updated = await updatePinnedCommentStatus(req.params.id, normalizedStatus);
    res.json({ comment: updated });
  } catch (err: any) {
    console.error('updatePinnedCommentStatus error:', err);
    res.status(500).json({ error: 'Failed to update pinned comment' });
  }
});

app.delete('/api/pinned-comments/:id', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    await deletePinnedComment(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('deletePinnedComment error:', err);
    res.status(500).json({ error: 'Failed to delete pinned comment' });
  }
});

// ==========================================
// ASSISTANCE TICKETS API (Colleague Lead Takeover Requests)
// ==========================================

app.get('/api/assistance-tickets', requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const { scope, status, leadId } = req.query;

    let tickets = await listAssistanceTickets({
      status: (status as any) || undefined,
      leadId: leadId ? String(leadId) : undefined,
    });

    if (scope === 'incoming') {
      // Tickets requested by other agents that this user can take over
      tickets = tickets.filter(
        (t) =>
          t.requested_by_id !== currentUser.id &&
          (!t.target_agent_id || t.target_agent_id === currentUser.id || t.target_agent_id === currentUser.email)
      );
    } else if (scope === 'outgoing' || scope === 'my') {
      // Tickets requested by current user
      tickets = tickets.filter((t) => t.requested_by_id === currentUser.id);
    }

    res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('listAssistanceTickets error:', err);
    res.status(500).json({ error: 'Failed to fetch assistance tickets' });
  }
});

app.post('/api/assistance-tickets', requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const { leadId, reason, reasonLabel, notes, targetAgentId, targetAgentName } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'A reason for requesting assistance is required' });
    }

    const ticket = await createAssistanceTicket({
      leadId,
      requestedBy: currentUser,
      reason,
      reasonLabel,
      notes: notes || '',
      targetAgentId,
      targetAgentName,
    });

    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    console.error('createAssistanceTicket error:', err);
    res.status(500).json({ error: err?.message || 'Failed to create assistance ticket' });
  }
});

app.post('/api/assistance-tickets/:id/accept', requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const result = await acceptAssistanceTicket({
      ticketId: req.params.id,
      acceptingUser: currentUser,
    });

    res.json({
      success: true,
      ticket: result.ticket,
      lead: result.lead,
      message: `Lead successfully reassigned to you. You are now the assigned agent for ${result.lead.name}.`,
    });
  } catch (err: any) {
    console.error('acceptAssistanceTicket error:', err);
    res.status(500).json({ error: err?.message || 'Failed to accept assistance ticket' });
  }
});

app.post('/api/assistance-tickets/:id/cancel', requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const ticket = await cancelAssistanceTicket({
      ticketId: req.params.id,
      cancellingUserId: currentUser.id,
    });

    res.json({ success: true, ticket });
  } catch (err: any) {
    console.error('cancelAssistanceTicket error:', err);
    res.status(500).json({ error: err?.message || 'Failed to cancel assistance ticket' });
  }
});

// ==========================================
// MANAGER DASHBOARD & PERFORMANCE INTEGRITY SCORING
// ==========================================

export function calculatePerformanceScore(user: User, leadsLoggedCount: number, now = new Date()) {
  const firstLoginIso = user.firstLoginAt || user.createdAt;
  if (!firstLoginIso) {
    return {
      inGracePeriod: true,
      calendarDaysElapsed: 0,
      gracePeriodDaysLeft: 14,
      workingDaysDenominator: 0,
      dailyAverage: 0,
      isFlaggedLowVolume: false,
      statusLabel: 'In Grace Period (14 days remaining)',
    };
  }

  const firstLogin = new Date(firstLoginIso);
  const diffMs = now.getTime() - firstLogin.getTime();
  const calendarDaysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // 14-day grace period: first 14 calendar days completely excluded
  if (calendarDaysElapsed < 14) {
    const daysLeft = 14 - calendarDaysElapsed;
    return {
      inGracePeriod: true,
      calendarDaysElapsed,
      gracePeriodDaysLeft: daysLeft,
      workingDaysDenominator: 0,
      dailyAverage: 0,
      isFlaggedLowVolume: false,
      statusLabel: `Grace Period (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`,
    };
  }

  // Day 15 onwards: count working days elapsed between (firstLogin + 14 days) and now
  const gracePeriodEndDate = new Date(firstLogin.getTime() + 14 * 24 * 60 * 60 * 1000);
  let workingDays = 0;
  let cur = new Date(gracePeriodEndDate);
  cur.setDate(cur.getDate() + 1);

  while (cur <= now) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Exclude Sunday (0) and Saturday (6)
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  const workingDaysDenominator = Math.max(1, workingDays);
  const dailyAverage = Number((leadsLoggedCount / workingDaysDenominator).toFixed(2));
  const isFlaggedLowVolume = dailyAverage < 3.0;

  return {
    inGracePeriod: false,
    calendarDaysElapsed,
    gracePeriodDaysLeft: 0,
    workingDaysDenominator,
    dailyAverage,
    isFlaggedLowVolume,
    statusLabel: isFlaggedLowVolume ? 'Low Volume Alert (<3/day)' : 'Healthy Performance',
  };
}

// Get team members for this manager or admin
app.get('/api/manager/team', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const currentUser = (req as any).user as User;

  try {
    const allUsers = await listUsers();
    let team: User[] = [];

    if (currentUser.role === 'admin') {
      team = allUsers;
    } else {
      // Manager sees themselves + agents assigned to their managerId
      team = allUsers.filter((u) => u.id === currentUser.id || u.managerId === currentUser.id);
    }

    res.json({ team, teamMembers: team });
  } catch (err: any) {
    console.error('get manager team error:', err);
    res.status(500).json({ error: 'Failed to fetch manager team' });
  }
});

// Get team colleagues for collaboration & takeover requests (any authenticated user)
app.get('/api/colleagues', requireAuth, async (req, res) => {
  try {
    const allUsers = await listUsers();
    const colleagues = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl,
      managerId: u.managerId,
    }));
    res.json({ colleagues, teamMembers: colleagues });
  } catch (err: any) {
    console.error('getColleagues error:', err);
    res.status(500).json({ error: 'Failed to fetch colleagues' });
  }
});

// Newsletter recipient statistics upfront
app.get('/api/newsletter/recipient-stats', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const customers = await listPotentialCustomers();
    const leads = await getLeads();
    const activeLeads = leads.filter((l) => l.status === 'Active' || l.status === 'Follow-up Scheduled');
    const closedLeads = leads.filter((l) => l.status === 'Matured (Closed)');

    const countWithEmail = (items: { email?: string; business_notes?: string; business_info?: string }[]) =>
      items.filter((item) => {
        if (item.email && item.email.includes('@')) return true;
        const noteText = (item.business_notes || '') + ' ' + (item.business_info || '');
        return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(noteText);
      }).length;

    res.json({
      stats: {
        potential_customers: {
          total: customers.length,
          withEmail: customers.filter((c) => c.email && c.email.includes('@')).length,
        },
        active_leads: {
          total: activeLeads.length,
          withEmail: countWithEmail(activeLeads),
        },
        closed_leads: {
          total: closedLeads.length,
          withEmail: countWithEmail(closedLeads),
        },
        all_leads: {
          total: leads.length,
          withEmail: countWithEmail(leads),
        },
      },
    });
  } catch (err: any) {
    console.error('recipient-stats error:', err);
    res.status(500).json({ error: 'Failed to compute recipient statistics' });
  }
});

// Manager Dashboard stats & integrity reports
app.get('/api/manager/dashboard-stats', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const currentUser = (req as any).user as User;

  try {
    const allUsers = await listUsers();
    const teamMembers = currentUser.role === 'admin'
      ? allUsers
      : allUsers.filter((u) => u.id === currentUser.id || u.managerId === currentUser.id);

    const teamUserIds = new Set(teamMembers.map((u) => u.id));

    // Fetch team leads
    const allLeads = await getLeads({
      userId: currentUser.id,
      userRole: currentUser.role,
      filter: 'team',
    });

    const teamLeads = currentUser.role === 'admin'
      ? allLeads
      : allLeads.filter((l) => !l.assigned_to || teamUserIds.has(l.assigned_to));

    // Compute metrics per team member
    const memberStats = teamMembers.map((member) => {
      const memberLeads = teamLeads.filter((l) => l.assigned_to === member.id || (l as any).created_by === member.id);
      const leadsCount = memberLeads.length;
      let totalCalls = 0;
      let closedCount = 0;
      let activeCount = 0;
      let latestActivityTimestamp = member.lastLoginAt ? new Date(member.lastLoginAt).getTime() : new Date(member.createdAt).getTime();

      for (const lead of memberLeads) {
        if (lead.status === 'Matured (Closed)') closedCount++;
        else if (lead.status === 'Active' || lead.status === 'Follow-up Scheduled') activeCount++;

        const leadUpdated = new Date(lead.updated_at || lead.created_at).getTime();
        if (leadUpdated > latestActivityTimestamp) latestActivityTimestamp = leadUpdated;

        if (Array.isArray(lead.call_logs)) {
          for (const c of lead.call_logs) {
            if (c.logged_by === member.id || c.logged_by === member.email) {
              totalCalls++;
              const callTime = new Date(c.timestamp).getTime();
              if (callTime > latestActivityTimestamp) latestActivityTimestamp = callTime;
            }
          }
        }
      }

      const score = calculatePerformanceScore(member, leadsCount);

      return {
        user: member,
        leadsCount,
        activeCount,
        closedCount,
        totalCalls,
        lastActivityAt: new Date(latestActivityTimestamp).toISOString(),
        performance: score,
      };
    });

    const totalTeamLeads = teamLeads.length;
    const maturedCount = teamLeads.filter((l) => l.status === 'Matured (Closed)').length;
    const activeCount = teamLeads.filter((l) => l.status === 'Active' || l.status === 'Follow-up Scheduled').length;
    const deniedCount = teamLeads.filter((l) => l.status === 'Service Denied').length;
    const flaggedCount = memberStats.filter((m) => m.performance.isFlaggedLowVolume).length;

    res.json({
      summary: {
        totalTeamLeads,
        maturedCount,
        activeCount,
        deniedCount,
        teamSize: teamMembers.length,
        flaggedCount,
      },
      members: memberStats,
    });
  } catch (err: any) {
    console.error('manager dashboard-stats error:', err);
    res.status(500).json({ error: 'Failed to compute manager statistics' });
  }
});

// ==========================================
// NEWSLETTER EMAIL BLAST API (Resend)
// ==========================================

app.get('/api/newsletter/logs', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const logs = await listNewsletterLogs();
    res.json({ logs });
  } catch (err: any) {
    console.error('listNewsletterLogs error:', err);
    res.status(500).json({ error: 'Failed to fetch newsletter logs' });
  }
});

app.post('/api/newsletter/send', requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { subject, bodyHtml, recipientCategory } = req.body;
  if (!subject || !bodyHtml || !recipientCategory) {
    return res.status(400).json({ error: 'Subject, body HTML, and recipient category are required' });
  }

  const currentUser = (req as any).user as User;

  try {
    // Collect recipient emails based on category
    const emailRecipients: { email: string; name?: string }[] = [];

    if (recipientCategory === 'potential_customers') {
      const customers = await listPotentialCustomers();
      customers.forEach((c) => {
        if (c.email && c.email.includes('@')) {
          emailRecipients.push({ email: c.email.trim(), name: c.name });
        }
      });
    } else if (recipientCategory === 'team_agents') {
      const users = await listUsers();
      users.forEach((u) => {
        if (u.email && u.email.includes('@')) {
          emailRecipients.push({ email: u.email.trim(), name: u.name });
        }
      });
    } else {
      // leads category (closed or all)
      const leads = await getLeads();
      const targetLeads = recipientCategory === 'closed_leads'
        ? leads.filter((l) => l.status === 'Matured (Closed)')
        : leads;

      // Extract emails from lead.email or notes or lead info if present
      targetLeads.forEach((l) => {
        if (l.email && l.email.includes('@')) {
          emailRecipients.push({ email: l.email.trim(), name: l.name });
        } else {
          const emailMatch = (l.business_notes + ' ' + (l.business_info || '')).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            emailRecipients.push({ email: emailMatch[0].toLowerCase(), name: l.name });
          }
        }
      });
    }

    // Deduplicate emails
    const uniqueEmails = Array.from(new Set(emailRecipients.map((r) => r.email.toLowerCase())));
    const recipientCount = Math.max(uniqueEmails.length, 1);

    const resendApiKey = getResendApiKey();
    let dispatchStatus: 'sent' | 'failed' | 'simulated' = 'simulated';
    let errorMessage: string | null = null;

    if (resendApiKey && uniqueEmails.length > 0) {
      try {
        // Send via Resend batch or individual
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ColdCall CRM <newsletter@resend.dev>',
            to: uniqueEmails.slice(0, 50), // Standard safe batch
            subject: subject.trim(),
            html: bodyHtml,
          }),
        });

        if (response.ok) {
          dispatchStatus = 'sent';
        } else {
          const errData = await response.json();
          console.warn('Resend returned error for newsletter:', errData);
          errorMessage = errData.message || 'Resend API returned error';
        }
      } catch (err: any) {
        console.warn('Resend API invocation error for newsletter:', err);
        errorMessage = err.message;
      }
    }

    const log = await createNewsletterLog({
      subject: subject.trim(),
      message: bodyHtml,
      recipient_count: recipientCount,
      recipient_type: recipientCategory,
      sent_by: currentUser.id,
      sent_by_name: currentUser.name,
      status: dispatchStatus,
      error_message: errorMessage || undefined,
    });

    res.json({
      success: true,
      log,
      recipientCount,
      status: dispatchStatus,
      message: dispatchStatus === 'sent'
        ? `Newsletter successfully dispatched to ${recipientCount} recipients.`
        : `Newsletter logged (${dispatchStatus}): ${errorMessage || `${recipientCount} recipients targeted`}.`,
    });
  } catch (err: any) {
    console.error('send newsletter error:', err);
    res.status(500).json({ error: 'Failed to process newsletter dispatch' });
  }
});

// ==========================================
// VERCEL CRON & DUE FOLLOW-UP NOTIFICATIONS
// ==========================================

/**
 * Server-side Scheduled Cron Endpoint: /api/cron/check-reminders
 * Triggered by Vercel Cron or external scheduler (cron-job.org, Upstash, GitHub Actions)
 * Secured with CRON_SECRET authorization header
 */
app.all('/api/cron/check-reminders', async (req, res) => {
  // Verify Vercel Cron Secret if configured
  const expectedSecret = getCronSecret();
  if (expectedSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron invocation' });
    }
  }

  try {
    const dueLeads = await getDueFollowUps();
    const resendApiKey = getResendApiKey();
    const adminUser = (await listUsers()).find((u) => u.role === 'admin');
    const defaultRecipient = adminUser?.email || 'admin@coldcrm.internal';

    const processed = [];

    for (const lead of dueLeads) {
      const nowIso = new Date().toISOString();
      let sentSuccess = false;

      // Determine recipient: find last call logger or fallback to admin
      const recipient = lead.call_logs[0]?.logged_by || defaultRecipient;

      if (resendApiKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ColdCall CRM <reminders@resend.dev>',
              to: recipient,
              subject: `⏰ Scheduled Follow-Up Due: ${lead.name}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #292524; background: #faf8f5;">
                  <h2 style="color: #b45309;">Follow-Up Due Alert</h2>
                  <p>A scheduled cold call with <strong>${lead.name}</strong> (${lead.phone}) is due right now.</p>
                  <p style="background: #ffffff; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px;">
                    <strong>Lead Name:</strong> ${lead.name}<br/>
                    <strong>Phone:</strong> <a href="tel:${lead.phone}">${lead.phone}</a><br/>
                    <strong>Notes:</strong> ${lead.business_notes || 'None'}<br/>
                    <strong>Scheduled Time:</strong> ${lead.next_action_at ? new Date(lead.next_action_at).toLocaleString() : 'Now'}
                  </p>
                  <p>Log in to your ColdCall CRM dashboard to dial and update call history.</p>
                </div>
              `,
            }),
          });
          sentSuccess = true;
          await logNotification({
            leadId: lead.id,
            leadName: lead.name,
            userEmail: recipient,
            type: 'email',
            status: 'sent',
          });
        } catch (mailErr) {
          console.warn('Resend mail error for lead', lead.id, mailErr);
        }
      } else {
        // Fallback simulation log
        await logNotification({
          leadId: lead.id,
          leadName: lead.name,
          userEmail: recipient,
          type: 'email',
          status: 'simulated',
        });
        sentSuccess = true;
      }

      // Also trigger Web Push notifications to active devices
      try {
        const pushSubs = await getPushSubscriptions();
        for (const sub of pushSubs) {
          const pushRes = await sendWebPush(sub, {
            title: `⏰ Follow-Up Due: ${lead.name}`,
            body: `Scheduled call with ${lead.name} (${lead.phone}) is due right now.`,
            tag: `due-${lead.id}`,
            url: `/?leadId=${lead.id}`,
          });

          if (pushRes.statusCode === 410 || pushRes.statusCode === 404) {
            await deletePushSubscription(sub.endpoint);
          }
        }
      } catch (pushErr) {
        console.warn('Cron push notification notice:', pushErr);
      }

      // CRITICAL: Stamp last_notified_at in DB so this lead is NEVER notified again
      // for this follow-up event, resolving the duplicate-on-refresh bug permanently.
      await markLeadNotified(lead.id, nowIso);

      processed.push({
        leadId: lead.id,
        name: lead.name,
        notifiedTo: recipient,
        delivered: sentSuccess,
      });
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      dueCount: dueLeads.length,
      processed,
    });
  } catch (err: any) {
    console.error('cron check-reminders error:', err);
    return res.status(500).json({ error: 'Failed to process scheduled reminders' });
  }
});

// Test email notification endpoint
app.post('/api/notifications/test-email', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  const { leadId, leadName, followUpTime } = req.body;

  const resendApiKey = getResendApiKey();

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ColdCall CRM <reminders@resend.dev>',
          to: user.email,
          subject: `⏰ Scheduled Follow-Up Due: ${leadName || 'Lead'}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #292524;">
              <h2 style="color: #b45309;">Follow-Up Due Alert</h2>
              <p>Hi <strong>${user.name}</strong>,</p>
              <p>Your scheduled sales call with <strong>${leadName || 'your prospect'}</strong> is due for follow-up.</p>
              <p style="background: #fbf9f5; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px;">
                <strong>Scheduled Time:</strong> ${followUpTime ? new Date(followUpTime).toLocaleString() : 'Now'}<br/>
                <strong>Status:</strong> Overdue / Due Now
              </p>
              <p>Log in to your ColdCall CRM dashboard to dial and log the call outcome.</p>
            </div>
          `,
        }),
      });

      const resendData = await response.json();
      if (!response.ok) {
        console.warn('Resend returned error status:', response.status, resendData);
        return res.status(response.status).json({
          error: resendData.message || 'Failed to dispatch email via Resend',
          details: resendData,
        });
      }

      await logNotification({
        leadId: leadId || 'test',
        leadName: leadName || 'Test Lead',
        userEmail: user.email,
        type: 'email',
        status: 'sent',
      });

      if (leadId) {
        await markLeadNotified(leadId);
      }

      return res.json({
        success: true,
        provider: 'resend',
        recipient: user.email,
        details: resendData,
      });
    } catch (err: any) {
      console.warn('Resend API call failed, falling back to simulated dispatch', err);
    }
  }

  // Fallback simulation
  await logNotification({
    leadId: leadId || 'test',
    leadName: leadName || 'Prospect Follow-up',
    userEmail: user.email,
    type: 'email',
    status: 'simulated',
  });

  if (leadId) {
    await markLeadNotified(leadId);
  }

  return res.json({
    success: true,
    provider: 'simulated',
    recipient: user.email,
    message: `Follow-up reminder email successfully dispatched to ${user.email}`,
  });
});

// ==============================================================================
// WEB PUSH NOTIFICATION API (PWA Mobile & Desktop Push)
// ==============================================================================

// 1. Get VAPID Public Key for client subscription
app.get('/api/notifications/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  res.json({ publicKey });
});

// 2. Register Web Push subscription
app.post('/api/notifications/push-subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription payload' });
  }

  // Attempt to link with authenticated user if present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifySessionToken(authHeader.substring(7));
    if (payload?.userId) {
      userId = payload.userId;
    }
  }

  const userAgent = (req.headers['user-agent'] as string) || null;

  try {
    await savePushSubscription({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });
    return res.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err: any) {
    console.error('push-subscribe error:', err);
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// 3. Unsubscribe endpoint
app.post('/api/notifications/push-unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Subscription endpoint is required' });
  }

  try {
    await deletePushSubscription(endpoint);
    return res.json({ success: true, message: 'Unsubscribed from push alerts' });
  } catch (err: any) {
    console.error('push-unsubscribe error:', err);
    return res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

// 4. Test Web Push notification dispatch
app.post('/api/notifications/test-push', async (req, res) => {
  const { endpoint, keys } = req.body;

  let targetSubscriptions = [];

  // If client provided active subscription keys directly, register immediately
  if (endpoint && keys?.p256dh && keys?.auth) {
    let currentUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifySessionToken(authHeader.substring(7));
      currentUserId = payload?.userId || null;
    }
    await savePushSubscription({
      userId: currentUserId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: (req.headers['user-agent'] as string) || null,
    });
    targetSubscriptions.push({ endpoint, keys, userId: currentUserId });
  } else if (endpoint) {
    const all = await getPushSubscriptions();
    const match = all.find((s) => s.endpoint === endpoint);
    if (match) {
      targetSubscriptions.push(match);
    } else {
      // Endpoint provided with fallback keys
      targetSubscriptions.push({
        endpoint,
        keys: req.body.keys || { p256dh: '', auth: '' },
      });
    }
  } else {
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifySessionToken(authHeader.substring(7));
      userId = payload?.userId;
    }
    targetSubscriptions = await getPushSubscriptions(userId);
    if (targetSubscriptions.length === 0) {
      targetSubscriptions = await getPushSubscriptions();
    }
  }

  if (targetSubscriptions.length === 0) {
    return res.status(404).json({
      error: 'No push subscription found for this device. Please tap "Enable Notifications" first.',
    });
  }

  let sentCount = 0;
  let lastError = '';
  for (const sub of targetSubscriptions) {
    const pushRes = await sendWebPush(sub, {
      title: '🔔 ColdCall CRM Alert Active',
      body: 'Web Push is enabled on this device! You will receive lock-screen reminders when calls are due.',
      tag: 'test-notification',
      url: '/',
    });

    if (pushRes.success) {
      sentCount++;
    } else {
      lastError = pushRes.error || 'Push delivery rejected';
      if (pushRes.statusCode === 410 || pushRes.statusCode === 404) {
        await deletePushSubscription(sub.endpoint);
      }
    }
  }

  return res.json({
    success: sentCount > 0,
    sentCount,
    totalAttempted: targetSubscriptions.length,
    message: sentCount > 0
      ? 'Test push notification dispatched to your device!'
      : (lastError || 'Failed to deliver push notification.'),
  });
});

// ==========================================
// OBJECTION CARDS & CALL SCRIPTS API
// ==========================================

// GET /api/objection-cards - List all objection battle cards
app.get('/api/objection-cards', requireAuth, async (req, res) => {
  try {
    const cards = await getObjectionCards();
    return res.json({ cards });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch objection cards' });
  }
});

// POST /api/objection-cards - Create a new battle card (Admin or Manager)
app.post('/api/objection-cards', requireAuth, async (req, res) => {
  try {
    const { category, objection, rebuttal, talking_points, follow_up_question } = req.body;
    if (!objection || !rebuttal) {
      return res.status(400).json({ error: 'Objection and rebuttal are required' });
    }
    const card = await createObjectionCard({
      category: category || 'general',
      objection,
      rebuttal,
      talking_points: Array.isArray(talking_points) ? talking_points : undefined,
      follow_up_question,
    });
    return res.status(201).json({ card });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create objection card' });
  }
});

// PUT /api/objection-cards/:id - Update an objection card
app.put('/api/objection-cards/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const card = await updateObjectionCard(id, updates);
    return res.json({ card });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update objection card' });
  }
});

// DELETE /api/objection-cards/:id - Delete an objection card
app.delete('/api/objection-cards/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteObjectionCard(id);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete objection card' });
  }
});

// POST /api/objection-cards/reset - Reset to factory defaults
app.post('/api/objection-cards/reset', requireAuth, async (req, res) => {
  try {
    const cards = await resetDefaultObjectionCards();
    return res.json({ cards, message: 'Objection battle cards reset to default repository' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset objection cards' });
  }
});

// GET /api/call-scripts - List all call scripts
app.get('/api/call-scripts', requireAuth, async (req, res) => {
  try {
    const scripts = await getCallScripts();
    return res.json({ scripts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch call scripts' });
  }
});

// POST /api/call-scripts - Create a call script
app.post('/api/call-scripts', requireAuth, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Script title and content are required' });
    }
    const script = await createCallScript({
      title,
      category: category || 'custom',
      content,
    });
    return res.status(201).json({ script });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create call script' });
  }
});

// PUT /api/call-scripts/:id - Update a call script
app.put('/api/call-scripts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const script = await updateCallScript(id, updates);
    return res.json({ script });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update call script' });
  }
});

// DELETE /api/call-scripts/:id - Delete a call script
app.delete('/api/call-scripts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteCallScript(id);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete call script' });
  }
});

// POST /api/call-scripts/reset - Reset to factory defaults
app.post('/api/call-scripts/reset', requireAuth, async (req, res) => {
  try {
    const scripts = await resetDefaultCallScripts();
    return res.json({ scripts, message: 'Call scripts reset to default repository' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset call scripts' });
  }
});

// ==========================================
// QUICK-OUTCOME CADENCE API ROUTES
// ==========================================

// GET /api/cadence - Retrieve current outcome cadence rules
app.get('/api/cadence', requireAuth, async (req, res) => {
  try {
    const config = await getCadenceConfig();
    return res.json({ cadence: config });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch cadence configuration' });
  }
});

// PUT /api/cadence - Update cadence configuration (Manager or Admin)
app.put('/api/cadence', requireAuth, async (req, res) => {
  const currentUser = (req as any).user as User;
  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers and admins can configure outcome cadences' });
  }

  try {
    const { cadence } = req.body;
    if (!cadence || typeof cadence !== 'object') {
      return res.status(400).json({ error: 'Invalid cadence configuration payload' });
    }
    const updated = await updateCadenceConfig(cadence);
    return res.json({ cadence: updated, message: 'Outcome cadences updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update cadence configuration' });
  }
});

// POST /api/cadence/reset - Reset cadence configuration to defaults (Manager or Admin)
app.post('/api/cadence/reset', requireAuth, async (req, res) => {
  const currentUser = (req as any).user as User;
  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers and admins can reset outcome cadences' });
  }

  try {
    const reset = await resetCadenceConfig();
    return res.json({ cadence: reset, message: 'Outcome cadences reset to factory presets' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset cadence configuration' });
  }
});

// ==========================================
// GEMINI AI INTEGRATION API ROUTES
// ==========================================

// POST /api/ai/enhance-call-notes - Transform messy shorthand into structured CRM notes
app.post('/api/ai/enhance-call-notes', requireAuth, async (req, res) => {
  try {
    const { leadName, businessInfo, outcomeTag, rawNotes, previousContext } = req.body;
    if (!rawNotes || typeof rawNotes !== 'string' || !rawNotes.trim()) {
      return res.status(400).json({ error: 'Call notes content is required to structure with AI' });
    }

    const enhanced = await enhanceCallNotesWithGemini({
      leadName: leadName || 'Prospect',
      businessInfo,
      outcomeTag: outcomeTag || 'Interested',
      rawNotes: rawNotes.trim(),
      previousContext,
    });

    return res.json({ enhanced });
  } catch (err: any) {
    console.error('Failed to enhance call notes with AI:', err);
    return res.status(500).json({ error: err.message || 'AI note structuring failed' });
  }
});

// POST /api/ai/compose-followup - Smart WhatsApp, Email, & SMS message generator
app.post('/api/ai/compose-followup', requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const { leadName, businessInfo, outcomeTag, callNotes, tone, agentName } = req.body;

    const messages = await composeFollowUpWithGemini({
      leadName: leadName || 'Prospect',
      businessInfo,
      outcomeTag: outcomeTag || 'Interested',
      callNotes,
      tone: tone || 'professional',
      agentName: agentName || currentUser?.name || 'Sales Representative',
    });

    return res.json({ messages });
  } catch (err: any) {
    console.error('Failed to compose follow-up message with AI:', err);
    return res.status(500).json({ error: err.message || 'AI follow-up composition failed' });
  }
});

// POST /api/ai/lead-health - Analyze account temperature and churn risk
app.post('/api/ai/lead-health', requireAuth, async (req, res) => {
  try {
    const { leadId, lead: providedLead, daysCold: providedDaysCold } = req.body;

    let targetLead: Lead | null = null;
    let daysCold = typeof providedDaysCold === 'number' ? providedDaysCold : 0;

    if (leadId) {
      targetLead = await getLeadById(leadId);
      if (!targetLead) {
        return res.status(404).json({ error: 'Lead not found for health assessment' });
      }
      // Compute days since last touch
      const lastTouchDate = targetLead.call_logs?.[0]?.timestamp || targetLead.updated_at || targetLead.created_at;
      daysCold = Math.max(0, Math.floor((Date.now() - new Date(lastTouchDate).getTime()) / (1000 * 60 * 60 * 24)));
    } else if (providedLead) {
      targetLead = providedLead;
    }

    if (!targetLead) {
      return res.status(400).json({ error: 'Either leadId or lead object is required' });
    }

    const health = await assessLeadHealthWithGemini({
      lead: targetLead,
      daysCold,
    });

    // Optionally update lead in db if leadId provided
    if (leadId && targetLead) {
      await updateLead(leadId, { ai_health: health } as any).catch((e) => {
        console.warn('Could not persist ai_health on lead record:', e);
      });
    }

    return res.json({ health });
  } catch (err: any) {
    console.error('Failed to compute lead health with AI:', err);
    return res.status(500).json({ error: err.message || 'AI lead health analysis failed' });
  }
});

// ====================================================
// ADMIN GEMINI AI & MODEL CONFIGURATION ENDPOINTS
// ====================================================

// GET /api/admin/gemini-config (Admin only)
app.get('/api/admin/gemini-config', requireAuth, requireAdmin, (req, res) => {
  try {
    const config = getAdminGeminiConfig();
    return res.json({ config });
  } catch (err: any) {
    console.error('Failed to get Gemini config:', err);
    return res.status(500).json({ error: err.message || 'Failed to retrieve Gemini config' });
  }
});

// POST /api/admin/gemini-config (Admin only)
app.post('/api/admin/gemini-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { apiKey, model, verify = true } = req.body;
    const config = updateAdminGeminiConfig({ apiKey, model });

    let verification = null;
    if (verify && config.configured) {
      verification = await testAdminGeminiConfig({ model: config.model });
    }

    return res.json({
      config,
      verification,
      message: verification?.success
        ? `Gemini settings saved and verified! Connected to ${config.model} (${verification.latencyMs}ms).`
        : verification
        ? `Settings saved, but Google API verification failed: ${verification.message}`
        : 'Gemini settings saved successfully! New configuration is now active.',
    });
  } catch (err: any) {
    console.error('Failed to update Gemini config:', err);
    return res.status(500).json({ error: err.message || 'Failed to update Gemini config' });
  }
});

// POST /api/admin/gemini-test (Admin only)
app.post('/api/admin/gemini-test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    const result = await testAdminGeminiConfig({ apiKey, model });
    return res.json(result);
  } catch (err: any) {
    console.error('Failed to test Gemini config:', err);
    return res.status(500).json({ error: err.message || 'Gemini connection test failed' });
  }
});

// ====================================================
// CATEGORY 3: MANAGER LIVE LEADERBOARD & ACTIVITY FEED
// ====================================================

// GET /api/manager/leaderboard - Real-time scoreboard with daily dials, connects, meetings, directive completions
app.get('/api/manager/leaderboard', requireAuth, async (req, res) => {
  try {
    const period = (req.query.period as string) || 'today';
    const users = await listUsers();
    const allLeads = await getLeads({ filter: 'all' });
    const allDirectives = await listPinnedComments({});

    // Filter date boundaries based on period
    const now = new Date();
    let since = new Date(0); // all time default

    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      since = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    const sinceTime = since.getTime();

    // Build leaderboard user map
    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set(u.id, {
        userId: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
        avatarUrl: (u as any).avatarUrl || (u as any).avatar_url,
        dialsCount: 0,
        connectsCount: 0,
        meetingsCount: 0,
        closedCount: 0,
        directivesCompleted: 0,
        score: 0,
      });
    }

    // Activity feed collection
    const activityFeed: any[] = [];

    // Tally calls and populate activity feed
    for (const lead of allLeads) {
      if (!lead.call_logs) continue;
      for (const call of lead.call_logs) {
        const callTime = new Date(call.timestamp).getTime();
        const repId = call.logged_by || lead.assigned_to;

        if (callTime >= sinceTime && repId && userMap.has(repId)) {
          const member = userMap.get(repId)!;
          member.dialsCount += 1;

          const isConnect = !['Busy', "Couldn't Connect", 'No Answer'].includes(call.outcome_tag);
          if (isConnect) member.connectsCount += 1;

          if (['Interested', 'Call Back Later'].includes(call.outcome_tag)) {
            member.meetingsCount += 1;
          }
          if (call.outcome_tag === 'Closed/Matured') {
            member.closedCount += 1;
          }
        }

        // Add to activity feed (keep last 30 days or period)
        if (callTime >= (period === 'all' ? Date.now() - 30 * 86400000 : sinceTime)) {
          activityFeed.push({
            id: call.id,
            type: call.outcome_tag === 'Closed/Matured' ? 'closed_deal' : 'call',
            userId: repId || 'unknown',
            userName: call.logged_by_name || 'Team Rep',
            leadId: lead.id,
            leadName: lead.name,
            outcomeTag: call.outcome_tag,
            summary: call.summary,
            timestamp: call.timestamp,
            audioUrl: call.audio_url || null,
            audioDuration: call.audio_duration || null,
          });
        }
      }
    }

    // Tally completed directives
    for (const dir of allDirectives) {
      if (dir.status === 'done' && dir.agent_id && userMap.has(dir.agent_id)) {
        const doneTime = dir.done_at ? new Date(dir.done_at).getTime() : new Date(dir.created_at).getTime();
        if (doneTime >= sinceTime) {
          const member = userMap.get(dir.agent_id)!;
          member.directivesCompleted += 1;

          activityFeed.push({
            id: 'dir_' + dir.id,
            type: 'directive_completed',
            userId: dir.agent_id,
            userName: dir.agent_name || member.name,
            leadId: dir.lead_id || undefined,
            leadName: dir.lead_name || 'Account',
            summary: `Completed directive: "${dir.content.slice(0, 80)}"`,
            timestamp: dir.done_at || dir.created_at,
          });
        }
      }
    }

    // Compute composite gamification scores
    const leaderboard = Array.from(userMap.values()).map((m) => {
      const score =
        m.dialsCount * 1 +
        m.connectsCount * 3 +
        m.meetingsCount * 6 +
        m.closedCount * 15 +
        m.directivesCompleted * 8;
      return { ...m, score };
    });

    // Sort descending by score, then dials
    leaderboard.sort((a, b) => b.score - a.score || b.dialsCount - a.dialsCount);

    // Assign rank
    leaderboard.forEach((m, idx) => {
      m.rank = idx + 1;
    });

    // Sort activity feed newest first, limit 60
    activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const topFeed = activityFeed.slice(0, 60);

    const totals = {
      totalDials: leaderboard.reduce((acc, m) => acc + m.dialsCount, 0),
      totalConnects: leaderboard.reduce((acc, m) => acc + m.connectsCount, 0),
      totalMeetings: leaderboard.reduce((acc, m) => acc + m.meetingsCount, 0),
      totalClosed: leaderboard.reduce((acc, m) => acc + m.closedCount, 0),
    };

    return res.json({
      period,
      leaderboard,
      activityFeed: topFeed,
      totals,
    });
  } catch (err: any) {
    console.error('Leaderboard calculation failed:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch leaderboard' });
  }
});

// ==========================================
// WHATSAPP INBOUND WEBHOOK & AI CLASSIFICATION
// ==========================================

interface ParsedInboundWhatsApp {
  senderPhone: string;
  senderName?: string;
  messageText: string;
  agentId?: string;
  messageId?: string;
  timestamp?: string;
}

function extractWhatsAppPayload(body: any, params: any, query: any): ParsedInboundWhatsApp | null {
  if (!body) return null;

  // 1. Direct CRM payload format
  if (body.senderPhone && body.messageText) {
    return {
      senderPhone: String(body.senderPhone).replace(/[^\d+]/g, ''),
      senderName: body.senderName ? String(body.senderName).trim() : undefined,
      messageText: String(body.messageText).trim(),
      agentId: body.agentId || params.agentId || query.agent_id || undefined,
      messageId: body.messageId,
      timestamp: body.timestamp || new Date().toISOString(),
    };
  }

  // 2. Evolution API / Baileys format
  const data = body.data || body;
  const key = data.key || body.key;

  // Ignore outgoing messages sent from the WhatsApp account itself
  if (key?.fromMe === true || data?.fromMe === true || body?.fromMe === true) {
    return null;
  }

  const rawJid = key?.remoteJid || body.from || body.phone;

  if (rawJid && typeof rawJid === 'string' && !rawJid.includes('@g.us')) {
    // Exclude group chats (@g.us) to only process direct 1-on-1 customer chats
    const cleanDigits = rawJid.replace('@s.whatsapp.net', '').replace(/[^\d+]/g, '');
    const normalizedDigits = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;
    const messageObj = data.message || body.message;
    const text =
      messageObj?.conversation ||
      messageObj?.extendedTextMessage?.text ||
      messageObj?.imageMessage?.caption ||
      data.body ||
      body.body ||
      '';

    if (cleanDigits && text) {
      return {
        senderPhone: normalizedDigits,
        senderName: data.pushName || body.pushName || key?.pushName || body.senderName || undefined,
        messageText: String(text).trim(),
        agentId: params.agentId || query.agent_id || body.instance || undefined,
        messageId: key?.id || body.id,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return null;
}

async function handleInboundWhatsAppMessage(parsed: ParsedInboundWhatsApp) {
  const cleanedDigits = parsed.senderPhone.replace(/[^\d+]/g, '');
  const normalizedPhone = cleanedDigits.startsWith('+') ? cleanedDigits : `+${cleanedDigits}`;

  // 1. Deduplication check against existing Leads
  const existingLead = await findLeadByPhone(normalizedPhone);
  if (existingLead) {
    const logNote = `[Inbound WhatsApp]: "${parsed.messageText}"`;
    await addCallLog({
      leadId: existingLead.id,
      summary: 'Inbound WhatsApp message received',
      full_notes: logNote,
      outcome_tag: 'Other',
      logged_by: existingLead.assigned_to || 'system',
      logged_by_name: existingLead.assigned_to_name || 'WhatsApp Bridge',
    });

    return {
      action: 'existing_lead_updated',
      leadId: existingLead.id,
      leadName: existingLead.name,
      deduplicated: true,
      message: 'Phone number already exists in CRM. Inbound message was appended to call logs.',
    };
  }

  // 2. Check Potential Customers list
  const customers = await listPotentialCustomers();
  const existingCustomer = customers.find((c) => isPhoneMatch(c.phone, normalizedPhone));
  if (existingCustomer) {
    return {
      action: 'existing_customer_matched',
      customerId: existingCustomer.id,
      customerName: existingCustomer.name,
      deduplicated: true,
      message: 'Phone number matches a known Potential Customer record.',
    };
  }

  // 3. Not in DB -> Run Silent Gemini AI Inquiry Classifier
  const classification = await classifyInboundWhatsAppMessage({
    senderPhone: normalizedPhone,
    senderName: parsed.senderName,
    messageText: parsed.messageText,
  });

  // 4. Decision: If Business Inquiry -> Create Lead!
  if (classification.isBusinessInquiry) {
    let targetAgent: User | null = null;
    if (parsed.agentId) {
      targetAgent = (await findUserById(parsed.agentId)) || null;
    }

    // Prioritize sender's real WhatsApp profile name (e.g. from Baileys pushName),
    // then explicit name extracted from message, else fallback to formatted phone
    const leadName =
      (parsed.senderName && parsed.senderName.trim() && parsed.senderName !== 'Unknown')
        ? parsed.senderName.trim()
        : (classification.prospectName && classification.prospectName.trim())
          ? classification.prospectName.trim()
          : `WhatsApp Prospect (${normalizedPhone.slice(-4)})`;

    const leadNotes = `${classification.summary}\n\n[Initial Inbound WhatsApp Message]:\n"${parsed.messageText}"`;

    const newLead = await createLead({
      name: leadName,
      phone: normalizedPhone,
      business_notes: leadNotes,
      priority: classification.suggestedPriority || 'Normal',
      source: 'WhatsApp Inbound',
      assignedTo: targetAgent ? targetAgent.id : undefined,
    });

    return {
      action: 'lead_created',
      leadId: newLead.id,
      leadName: newLead.name,
      deduplicated: false,
      assignedTo: targetAgent ? targetAgent.name : 'Unassigned Pool',
      classification,
      message: `AI identified as genuine ${classification.inquiryCategory} inquiry. New Lead created automatically!`,
    };
  }

  // 5. If Personal / Spam / Casual -> Filter out
  return {
    action: 'filtered_personal_or_spam',
    deduplicated: false,
    classification,
    message: `Message evaluated as ${classification.inquiryCategory} (${classification.summary}). Filtered out from CRM leads.`,
  };
}

// Inbound webhook receiver (supports both universal /api/webhooks/whatsapp and per-agent /api/webhooks/whatsapp/:agentId)
app.post(['/api/webhooks/whatsapp', '/api/webhooks/whatsapp/:agentId'], async (req, res) => {
  try {
    const parsed = extractWhatsAppPayload(req.body, req.params, req.query);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid WhatsApp webhook payload. Expected senderPhone & messageText, or Evolution API messages.upsert format.',
      });
    }

    const result = await handleInboundWhatsAppMessage(parsed);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('WhatsApp webhook processing error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process WhatsApp webhook' });
  }
});

// Inbound webhook simulation for testing from UI
app.post('/api/webhooks/whatsapp/simulate', async (req, res) => {
  try {
    const { senderPhone, senderName, messageText, agentId } = req.body;
    if (!senderPhone || !messageText) {
      return res.status(400).json({ error: 'senderPhone and messageText are required.' });
    }

    const parsed: ParsedInboundWhatsApp = {
      senderPhone: String(senderPhone).trim(),
      senderName: senderName ? String(senderName).trim() : undefined,
      messageText: String(messageText).trim(),
      agentId: agentId || undefined,
      timestamp: new Date().toISOString(),
    };

    const result = await handleInboundWhatsAppMessage(parsed);
    return res.json({ success: true, simulated: true, ...result });
  } catch (err: any) {
    console.error('WhatsApp webhook simulation error:', err);
    return res.status(500).json({ error: err?.message || 'Simulation failed' });
  }
});

// Webhook documentation & info endpoint
app.get('/api/webhooks/whatsapp/info', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  return res.json({
    service: 'ColdCall CRM WhatsApp Webhook Engine',
    universalEndpoint: `${baseUrl}/api/webhooks/whatsapp`,
    agentEndpointTemplate: `${baseUrl}/api/webhooks/whatsapp/:agentId`,
    supportedPayloads: [
      {
        format: 'Direct JSON',
        schema: {
          senderPhone: '+15551234567',
          senderName: 'John Doe',
          messageText: 'Hello, what are your rates for commercial cleaning?',
          agentId: 'optional_agent_id',
        },
      },
      {
        format: 'Evolution API / Baileys webhook',
        event: 'messages.upsert',
      },
    ],
  });
});

// Health check endpoints for Vercel and monitoring
app.get(['/api', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'ColdCall CRM API', timestamp: new Date().toISOString() });
});

// Root error handler to guarantee clean JSON errors and prevent function crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
});

// ==========================================
// VITE OR STATIC ASSETS MIDDLEWARE
// ==========================================

export default app;
