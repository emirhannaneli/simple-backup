import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("Encryption", () => {
  it("should encrypt and decrypt correctly", () => {
    const text = "Hello, World!";
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(text);
    expect(encrypted).not.toBe(text);
  });

  it("should produce different encrypted output for the same text (randomness)", () => {
    const text = "Same text";
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(text);
    expect(decrypt(encrypted2)).toBe(text);
  });

  it("should handle multi-line strings", () => {
    const text = "Line 1\nLine 2\nLine 3";
    const encrypted = encrypt(text);
    expect(decrypt(encrypted)).toBe(text);
  });

  it("should throw error for invalid encrypted format", () => {
    expect(() => decrypt("invalid:format")).toThrow();
  });
});
