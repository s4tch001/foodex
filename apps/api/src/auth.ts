import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

// These constants define the cookie name and the maximum lifetime of the demo session.
const SESSION_NAME = 'foodex_session';
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

// The demo scope uses a signed cookie payload instead of a server-side session store.
function signature(value: string, secret: string) {
  // Sign the encoded payload so clients cannot change the email or expiry timestamp.
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function readCookie(request: Request, name: string) {
  // Read one named cookie without adding a full cookie-parser dependency.
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** Issues the short-lived signed cookie used by the single demo account. */
export function issueDemoSession(response: Response, email: string, secret: string) {
  // Store only the minimum session data needed to identify the configured demo user.
  const payload = Buffer.from(
    JSON.stringify({ email, expiresAt: Date.now() + MAX_AGE_MS }),
  ).toString('base64url');
  // HttpOnly keeps the token unavailable to browser JavaScript.
  response.cookie(SESSION_NAME, `${payload}.${signature(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

/** Clears the demo session using the same security attributes used when it was issued. */
export function clearDemoSession(response: Response) {
  // Expire the cookie using the same path and security options used when it was issued.
  response.clearCookie(SESSION_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/** Verifies the cookie signature, configured identity, and expiry without trusting client state. */
export function hasValidDemoSession(request: Request, expectedEmail: string, secret: string) {
  // Validate signature, payload shape, configured identity, and expiration on every request.
  const token = readCookie(request, SESSION_NAME);
  if (!token) return false;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return false;
  const expectedSignature = signature(payload, secret);
  // Constant-time comparison avoids leaking partial signature matches.
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))
  )
    return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      email?: string;
      expiresAt?: number;
    };
    return (
      session.email === expectedEmail &&
      typeof session.expiresAt === 'number' &&
      session.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
