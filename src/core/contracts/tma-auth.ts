/**
 * TMA Auth Contracts
 *
 * POST /api/telegram/auth/verify
 * POST /api/telegram/auth/login
 */

// --- Verify ---

export interface VerifyRequest {
  initData?: string;
  devUserId?: string;
}

export interface TmaStoreItem {
  id: string;
  name: string;
  marketplace?: string;
}

export interface VerifyResponse {
  valid: boolean;
  userId: string | null;
  stores: TmaStoreItem[];
  error?: string;
}

// --- Login ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  displayName: string;
  role: string;
  stores: Array<{ id: string; name: string }>;
}
