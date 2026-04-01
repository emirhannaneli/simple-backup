import { describe, it, expect } from "vitest";
import { generateApiKey, verifyApiKey, extractPrefix } from "./api-key-service";

describe("API Key Service", () => {
  it("should generate a valid API key with prefix", async () => {
    const apiKey = await generateApiKey();
    
    expect(apiKey.fullKey).toMatch(/^sbk_[a-zA-Z0-9_-]{32}/);
    expect(apiKey.prefix).toMatch(/^sbk_[a-zA-Z0-9_-]{8}\.\.\./);
    expect(apiKey.hash).toBeDefined();
  });

  it("should verify a correct API key", async () => {
    const { fullKey, hash } = await generateApiKey();
    const isValid = await verifyApiKey(fullKey, hash);
    expect(isValid).toBe(true);
  });

  it("should fail verification for an incorrect API key", async () => {
    const { hash } = await generateApiKey();
    const isValid = await verifyApiKey("sbk_invalid_key_12345678901234567890", hash);
    expect(isValid).toBe(false);
  });

  it("should extract prefix correctly from a full key", () => {
    const fullKey = "sbk_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    const prefix = extractPrefix(fullKey);
    expect(prefix).toBe("sbk_ABCDEFGH...");
  });

  it("should return invalid for key with wrong prefix", () => {
    const fullKey = "wrong_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    const prefix = extractPrefix(fullKey);
    expect(prefix).toBe("invalid");
  });
});
