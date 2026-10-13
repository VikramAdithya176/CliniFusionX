/**
 * apiClient.ts
 * Centralised fetch wrapper with:
 *  - Automatic Authorization header injection
 *  - Request timeout (AbortController)
 *  - Exponential-backoff retry on transient errors
 *  - Consistent error shape
 */

import { authHeaders, logoutUser } from './authService';

export type ApiError = Error & { status: number; detail?: string };

export function createApiError(status: number, message: string, detail?: string): ApiError {
  const err = new Error(message) as ApiError;
  err.name = 'ApiError';
  err.status = status;
  err.detail = detail;
  return err;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && err.name === 'ApiError';
}

type FetchOptions = RequestInit & {
  /** Timeout in ms. Defaults to 120 000 (2 min — enough for ML inference). */
  timeout?: number;
  /** Number of retry attempts on network/5xx failures. Defaults to 1. */
  retries?: number;
}

function getApiBase(): string {
  return (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
}

/**
 * Fetch a relative API path (e.g. '/api/v1/analyze') with auth, timeout, and retry.
 */
export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = 120_000, retries = 1, ...fetchOptions } = options;

  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;

  const headers = new Headers({
    ...authHeaders(),
    ...(fetchOptions.headers as Record<string, string> | undefined),
  });

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timerId);

      // If 401 — token expired, force logout
      if (response.status === 401) {
        logoutUser();
        window.location.href = '/login';
        throw createApiError(401, 'Session expired. Please log in again.');
      }

      // Retry on 503 / 502 / 500 (transient server errors)
      if (response.status >= 500 && attempt < retries) {
        const backoff = Math.pow(2, attempt) * 500;
        await new Promise((res) => setTimeout(res, backoff));
        lastError = createApiError(response.status, `Server error ${response.status}. Retrying…`);
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timerId);

      if (err?.name === 'AbortError') {
        throw createApiError(0, 'Request timed out. The server took too long to respond.', 'TIMEOUT');
      }

      lastError = err;

      // Retry on network failures
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 500;
        await new Promise((res) => setTimeout(res, backoff));
        continue;
      }
    }
  }

  if (isApiError(lastError)) throw lastError;
  throw createApiError(0, 'Network error. Check your connection and backend status.');
}

/**
 * POST a FormData payload (for file uploads).
 * Do NOT set Content-Type manually — the browser sets multipart boundary.
 */
export async function apiPostForm(path: string, formData: FormData, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { method: 'POST', body: formData, ...options });
}

/**
 * POST a JSON body.
 */
export async function apiPost<T>(path: string, body: T, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers as any) },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * GET a JSON endpoint.
 */
export async function apiGet(path: string, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { method: 'GET', ...options });
}
