import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "./api-key-service";
import { prisma } from "./prisma";

const API_KEY_PREFIX = "sbk_";

export async function validateApiKey(request: NextRequest): Promise<{ valid: boolean; error?: string }> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return { valid: false, error: "API key is required" };
  }

  // Extract prefix from API key for optimization
  // API keys start with "sbk_" prefix
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: "Invalid API key format" };
  }

  // Extract the first 8 characters after prefix to match against stored prefix
  const keyPart = apiKey.slice(API_KEY_PREFIX.length);
  if (keyPart.length < 8) {
    return { valid: false, error: "Invalid API key format" };
  }
  
  const prefixToMatch = `${API_KEY_PREFIX}${keyPart.slice(0, 8)}...`;

  // Filter keys by prefix first to reduce the number of hash verifications
  // This significantly improves performance when there are many API keys
  const matchingKeys = await prisma.apiKey.findMany({
    where: {
      prefix: prefixToMatch,
    },
  });

  // If no keys match the prefix, return early
  if (matchingKeys.length === 0) {
    return { valid: false, error: "Invalid API key" };
  }

  // Verify hash for keys with matching prefix
  for (const keyRecord of matchingKeys) {
    const isValid = await verifyApiKey(apiKey, keyRecord.keyHash);
    if (isValid) {
      // Update lastUsedAt
      await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      });
      return { valid: true };
    }
  }

  return { valid: false, error: "Invalid API key" };
}

