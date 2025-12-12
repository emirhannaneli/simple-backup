import crypto from "crypto";
import { hash, verify } from "argon2";

const PREFIX = "sbk_";
const KEY_LENGTH = 32;

export interface GeneratedApiKey {
  fullKey: string;
  prefix: string;
  hash: string;
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  // Generate random 32 character key
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  const randomString = randomBytes.toString("base64url").slice(0, KEY_LENGTH);
  
  const fullKey = `${PREFIX}${randomString}`;
  const prefix = `${PREFIX}${randomString.slice(0, 8)}...`;
  const keyHash = await hash(fullKey);
  
  return {
    fullKey,
    prefix,
    hash: keyHash,
  };
}

export async function verifyApiKey(providedKey: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, providedKey);
  } catch {
    return false;
  }
}

export function extractPrefix(fullKey: string): string {
  if (!fullKey.startsWith(PREFIX)) {
    return "invalid";
  }
  const keyPart = fullKey.slice(PREFIX.length);
  return `${PREFIX}${keyPart.slice(0, 8)}...`;
}

