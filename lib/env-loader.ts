/**
 * Load environment variables from Docker secrets (files) or regular env vars
 * Docker secrets are mounted as files in /run/secrets/
 * This is a fallback in case entrypoint script doesn't set them
 */
export function loadEnvSecrets() {
  // Only run in Node.js runtime (not Edge)
  if (typeof require === "undefined") {
    return;
  }

  try {
    const fs = require("fs");

    // Load secrets from Docker secrets or environment variables
    // Docker secrets are mounted at /run/secrets/ by default
    if (!process.env.DATABASE_URL) {
      try {
        if (fs.existsSync("/run/secrets/DATABASE_URL")) {
          process.env.DATABASE_URL = fs.readFileSync("/run/secrets/DATABASE_URL", "utf8").trim();
        } else if (process.env.DATABASE_URL_FILE && fs.existsSync(process.env.DATABASE_URL_FILE)) {
          process.env.DATABASE_URL = fs.readFileSync(process.env.DATABASE_URL_FILE, "utf8").trim();
        }
      } catch (error) {
        // Fall through to default
      }
    }

    if (!process.env.JWT_SECRET) {
      try {
        if (fs.existsSync("/run/secrets/JWT_SECRET")) {
          process.env.JWT_SECRET = fs.readFileSync("/run/secrets/JWT_SECRET", "utf8").trim();
        } else if (process.env.JWT_SECRET_FILE && fs.existsSync(process.env.JWT_SECRET_FILE)) {
          process.env.JWT_SECRET = fs.readFileSync(process.env.JWT_SECRET_FILE, "utf8").trim();
        }
      } catch (error) {
        // Fall through to default
      }
    }

    if (!process.env.ENCRYPTION_KEY) {
      try {
        if (fs.existsSync("/run/secrets/ENCRYPTION_KEY")) {
          process.env.ENCRYPTION_KEY = fs.readFileSync("/run/secrets/ENCRYPTION_KEY", "utf8").trim();
        } else if (process.env.ENCRYPTION_KEY_FILE && fs.existsSync(process.env.ENCRYPTION_KEY_FILE)) {
          process.env.ENCRYPTION_KEY = fs.readFileSync(process.env.ENCRYPTION_KEY_FILE, "utf8").trim();
        }
      } catch (error) {
        // Fall through to default
      }
    }

    if (!process.env.BACKUP_BASE_PATH) {
      try {
        if (fs.existsSync("/run/secrets/BACKUP_BASE_PATH")) {
          process.env.BACKUP_BASE_PATH = fs.readFileSync("/run/secrets/BACKUP_BASE_PATH", "utf8").trim();
        } else if (process.env.BACKUP_BASE_PATH_FILE && fs.existsSync(process.env.BACKUP_BASE_PATH_FILE)) {
          process.env.BACKUP_BASE_PATH = fs.readFileSync(process.env.BACKUP_BASE_PATH_FILE, "utf8").trim();
        } else {
          // Default to /data/backups (Docker standard path)
          process.env.BACKUP_BASE_PATH = "/data/backups";
        }
      } catch (error) {
        // Fall through to default
        process.env.BACKUP_BASE_PATH = "/data/backups";
      }
    }
  } catch (error) {
    // Ignore errors in Edge runtime or if fs is not available
  }
}

// Load secrets on module import (only in Node.js runtime, not Edge)
try {
  loadEnvSecrets();
} catch (error) {
  // Ignore errors
}
