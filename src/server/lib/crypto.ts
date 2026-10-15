import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM. SECRETS_KEY = 32 bytes em base64 (ex.: openssl rand -base64 32).
const getKey = (): Buffer => {
  const raw = process.env.SECRETS_KEY;
  if (!raw) throw new Error("SECRETS_KEY não configurada");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SECRETS_KEY deve ter 32 bytes (base64)");
  return key;
};

export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

export const decryptSecret = (payload: string): string => {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};
