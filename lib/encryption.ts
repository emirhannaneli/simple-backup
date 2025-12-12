import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32; // Salt length for PBKDF2
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

function getEncryptionKey(salt: Buffer): Buffer {
  const key = process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production-32-chars";
  
  if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_KEY) {
    console.warn("⚠️  WARNING: ENCRYPTION_KEY is not set in production! Using default key (INSECURE).");
  }
  
  // If key is hex string (64 chars = 32 bytes), convert it directly
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  
  // Otherwise, derive key from string using PBKDF2 with provided salt
  return crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

export function encrypt(text: string): string {
  // Generate random salt for this encryption
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  // Format: salt:iv:tag:encrypted
  return salt.toString("hex") + ":" + iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  
  // Support both old format (3 parts: iv:tag:encrypted) and new format (4 parts: salt:iv:tag:encrypted)
  let salt: Buffer;
  let iv: Buffer;
  let tag: Buffer;
  let encrypted: string;
  
  if (parts.length === 3) {
    // Old format - no salt, use empty salt (backward compatibility)
    salt = Buffer.alloc(SALT_LENGTH, 0); // Zero-filled salt for old format
    iv = Buffer.from(parts[0], "hex");
    tag = Buffer.from(parts[1], "hex");
    encrypted = parts[2];
  } else if (parts.length === 4) {
    // New format - with salt
    salt = Buffer.from(parts[0], "hex");
    iv = Buffer.from(parts[1], "hex");
    tag = Buffer.from(parts[2], "hex");
    encrypted = parts[3];
  } else {
    throw new Error("Invalid encrypted text format");
  }
  
  const key = getEncryptionKey(salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

