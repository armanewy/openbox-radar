import crypto from 'node:crypto';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateToken() {
  // url-safe, no padding
  return crypto.randomBytes(32).toString('base64url');
}

export function tokenExpiry(minutes = 15) {
  return new Date(Date.now() + minutes * 60_000);
}

export function isValidEmail(email: string) {
  // simple sanity check; replace with stricter validation if you want
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
