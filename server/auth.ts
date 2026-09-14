import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User, UserRole } from '../src/types';
import { DEFAULT_JWT_SECRET } from './supabaseConfig.js';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET || 'coldcall-crm-secret-jwt-key-development';
}
const BCRYPT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Hash password securely with bcrypt
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

/**
 * Compare plain text password against stored bcrypt hash
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  // If the hash is an unmigrated legacy plain string, support legacy comparison and trigger rehash
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
    return plainText === hash;
  }
  return bcrypt.compare(plainText, hash);
}

/**
 * Create a stateless signed JWT token (expires in 30 days)
 * Stateless means no server memory or Map lookup needed — runs perfectly in Vercel serverless.
 */
export function signSessionToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

/**
 * Verify and decode stateless JWT token
 */
export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
