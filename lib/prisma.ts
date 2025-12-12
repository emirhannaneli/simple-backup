import { PrismaClient } from "@prisma/client";
import "./env-loader"; // Load Docker secrets

// Set default DATABASE_URL if not provided
// Entrypoint script or env-loader should set this in Docker
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/system.db";
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️  WARNING: DATABASE_URL is not set in production! Using default: file:./prisma/system.db");
  }
}

// Create a singleton PrismaClient instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Get DATABASE_URL with default fallback
// Entrypoint script or env-loader should set this in Docker
const databaseUrl = process.env.DATABASE_URL || "file:./prisma/system.db";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

