import crypto from 'node:crypto';

/**
 * Generate a secure random reset token (64-char hex string)
 * and its hashed version for DB storage.
 */
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
}

/**
 * Hash a raw token for comparison with DB-stored hash.
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
