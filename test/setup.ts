import { beforeAll, afterAll, expect, vi } from "vitest";

// Mock environment variables for testing
// Note: NODE_ENV is set to 'test' by Vitest automatically.
// We avoid direct assignment here to prevent TypeScript errors during Next.js builds.
process.env.ENCRYPTION_KEY = "test-encryption-key-must-be-32-chars-long-123456";
process.env.DATABASE_URL = "file:./prisma/test.db";

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global teardown
});
