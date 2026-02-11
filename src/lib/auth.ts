/**
 * Authentication Library
 *
 * JWT token management and password hashing for R5 SaaS.
 * Used by auth API routes and middleware.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

// ============================================================================
// Constants
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'r5-dev-secret-change-in-production';
const COOKIE_NAME = 'r5_token';
const TOKEN_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

// ============================================================================
// Types
// ============================================================================

export interface JwtPayload {
  userId: string;
  email: string;
  orgId: string;
  role: 'owner' | 'admin' | 'manager';
}

export interface AuthSession {
  userId: string;
  email: string;
  orgId: string;
  role: 'owner' | 'admin' | 'manager';
}

// ============================================================================
// Password Hashing
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// JWT
// ============================================================================

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

// ============================================================================
// Cookie Management
// ============================================================================

export function setAuthCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

export function getAuthCookie(): string | null {
  const cookieStore = cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export function clearAuthCookie() {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

// ============================================================================
// Session Helper (for API routes)
// ============================================================================

/**
 * Get current auth session from cookie.
 * Returns null if not authenticated.
 */
export function getSession(): AuthSession | null {
  const token = getAuthCookie();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    email: payload.email,
    orgId: payload.orgId,
    role: payload.role,
  };
}

/**
 * Require authenticated session. Returns session or throws.
 */
export function requireSession(): AuthSession {
  const session = getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Require specific role(s). Returns session or throws.
 */
export function requireRole(...roles: Array<'owner' | 'admin' | 'manager'>): AuthSession {
  const session = requireSession();
  if (!roles.includes(session.role)) {
    throw new Error('Forbidden');
  }
  return session;
}

/**
 * Check if user has access to a specific store.
 * Owner/admin: access to all org stores.
 * Manager: only stores in member_store_access.
 */
export function isOwnerOrAdmin(session: AuthSession): boolean {
  return session.role === 'owner' || session.role === 'admin';
}
