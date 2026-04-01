import { beforeAll, afterAll, expect, vi } from "vitest";

// Mock environment variables for testing
process.env.ENCRYPTION_KEY = "test-encryption-key-must-be-32-chars-long-123456";
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.NODE_ENV = "test";

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global teardown
});
