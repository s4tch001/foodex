// Use the configured API origin in production and the local API during development.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Calls the Express API and includes the signed HttpOnly demo-session cookie.
 */
export function apiRequest(path: string, init?: RequestInit) {
  // Always include credentials because the API authenticates with an HttpOnly cookie.
  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}
