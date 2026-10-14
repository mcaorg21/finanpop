import bcrypt from "bcrypt";

const BCRYPT_PREFIX = /^\$2[aby]\$/;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Verifies a password against a stored value. Supports legacy plaintext rows
 * (pre-hash migration) by falling back to a direct comparison — callers should
 * rehash and persist the result when `legacy` comes back true.
 */
export async function verifyPassword(
  plain: string,
  stored: string
): Promise<{ valid: boolean; legacy: boolean }> {
  if (BCRYPT_PREFIX.test(stored)) {
    return { valid: await bcrypt.compare(plain, stored), legacy: false };
  }
  return { valid: plain === stored, legacy: true };
}
