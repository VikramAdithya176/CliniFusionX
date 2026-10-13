/**
 * authService.ts
 * Server-backed authentication using Bearer tokens from /api/v1/auth/login.
 * Also supports real Firebase Google Sign-In via loginWithGoogleFirebase().
 */
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  avatarUrl?: string;
}

const AUTH_USER_KEY = 'clini_auth_user';
const AUTH_TOKEN_KEY = 'clini_auth_token';

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/** Alias for getToken — prefer this name in new code. */
export const getAuthToken = getToken;

function getApiBase(): string {
  return (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
}

/**
 * Returns Authorization header object if a token exists, otherwise empty.
 * Use this in every fetch call: `headers: authHeaders()`
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Session helpers ───────────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
  return !!getToken() && !!localStorage.getItem(AUTH_USER_KEY);
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted storage — clear it
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  return null;
}

function _persistSession(token: string, user: AuthUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function logoutUser(): void {
  const token = getToken();
  // Fire-and-forget server-side logout (token invalidation)
  if (token) {
    fetch(`${getApiBase()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {/* ignore network errors on logout */});
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// ── Login & Registration methods ──────────────────────────────────────────────

/**
 * Register a new user profile against the backend. Returns the AuthUser on success.
 */
export async function registerUser(
  username: string,
  password: string,
  name?: string,
  role?: string,
  department?: string
): Promise<AuthUser> {
  const apiBase = getApiBase();

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        password,
        name: name?.trim() || undefined,
        role: role?.trim() || undefined,
        department: department?.trim() || undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Registration request timed out. Check your backend connection.');
    }
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  if (!response.ok) {
    let detail = 'Registration failed.';
    try {
      const body = await response.json();
      detail = body?.detail || detail;
    } catch {/* ignore parse error */}
    throw new Error(detail);
  }

  const data = await response.json();
  const user: AuthUser = {
    id: data.user.id,
    name: data.user.name,
    role: data.user.role,
    department: data.user.department,
  };

  _persistSession(data.token, user);
  return user;
}

/**
 * Authenticate against the backend. Returns the AuthUser on success.
 * Throws an Error with a user-friendly message on failure.
 */
export async function loginUser(username: string, password: string): Promise<AuthUser> {
  const apiBase = getApiBase();

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Login request timed out. Check your backend connection in Settings.');
    }
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  if (!response.ok) {
    let detail = 'Invalid username or password.';
    try {
      const body = await response.json();
      detail = body?.detail || detail;
    } catch {/* ignore parse error */}
    throw new Error(detail);
  }

  const data = await response.json();
  const user: AuthUser = {
    id: data.user.id,
    name: data.user.name,
    role: data.user.role,
    department: data.user.department,
  };

  _persistSession(data.token, user);
  return user;
}

/**
 * Guest login — authenticates as the 'guest' user using the default password.
 */
export async function loginAsGuest(): Promise<AuthUser> {
  return loginUser('guest', 'guest');
}

/**
 * Simulate Google login — in production this would go through OAuth.
 * For now it creates a session via the backend login endpoint with a
 * deterministic username derived from the email.
 */
export async function loginWithGoogle(name: string, email: string, _avatarUrl?: string): Promise<AuthUser> {
  // Fall back to guest credentials — in a real app this would use OAuth token exchange
  const user = await loginAsGuest();
  // Override display name client-side (no backend persistence yet)
  let displayName = name.trim() || 'Google Clinician';
  if (!displayName.toLowerCase().startsWith('dr.') && displayName.toLowerCase() !== 'guest') {
    displayName = `Dr. ${displayName}`;
  }
  const enriched: AuthUser = { ...user, name: displayName, email: email.trim() };
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(enriched));
  return enriched;
}

// ── Kept for backward compat (some components still import this) ──────────────
export const DEFAULT_CLINICIAN: AuthUser = {
  id: 'guest',
  name: 'Guest',
  role: 'Attending Clinician',
  department: 'Thoracic Radiology & AI Clinical Intelligence',
  avatarUrl: '',
};

// ── Real Firebase Google Sign-In ──────────────────────────────────────────────

/**
 * Opens the real Google OAuth popup via Firebase Authentication.
 * On success, sends the Firebase ID token to the backend which verifies it
 * using firebase-admin and returns our own session token.
 */
export async function loginWithGoogleFirebase(): Promise<AuthUser> {
  // 1. Trigger real Google popup via Firebase
  let result;
  try {
    result = await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    // User closed the popup or browser blocked it
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled. Please try again.');
    }
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked by the browser. Please allow popups for this site and try again.');
    }
    throw new Error(err?.message || 'Google sign-in failed. Please try again.');
  }

  const firebaseUser = result.user;
  const idToken = await firebaseUser.getIdToken();

  const apiBase = getApiBase();

  // 2. Exchange the Firebase ID token with our backend for a session token
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  if (!response.ok) {
    let detail = 'Google sign-in failed on the server.';
    try {
      const body = await response.json();
      detail = body?.detail || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  const data = await response.json();
  const user: AuthUser = {
    id:         data.user.id,
    name:       data.user.name,
    role:       data.user.role,
    department: data.user.department,
    email:      data.user.email,
    avatarUrl:  firebaseUser.photoURL ?? undefined,
  };

  _persistSession(data.token, user);
  return user;
}
