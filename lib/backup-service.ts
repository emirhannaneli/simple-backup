import { promises as fs } from "fs";
import path from "path";
import { decrypt } from "./encryption";
import {
  executeBackupCommand,
  getFileExtension,
  type DatabaseConnection,
} from "./database-commands";
import { triggerWebhooks } from "./webhook-service";
import { formatBytes } from "./format";
import { prisma } from "./prisma";

// Ensure BACKUP_BASE_PATH is set to /data/backups (default for Docker)
// This can be overridden via environment variable or Docker secrets
const BACKUP_BASE_PATH = process.env.BACKUP_BASE_PATH || "/data/backups";

// Log backup path on module load (only in development or if explicitly enabled)
if (process.env.NODE_ENV === "development" || process.env.LOG_BACKUP_PATH === "true") {
  console.log(`📦 Backup base path: ${BACKUP_BASE_PATH}`);
}

export async function ensureBackupDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function executeBackup(jobId: string): Promise<void> {
  const startTime = Date.now();

  // Fetch job with datasource
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { datasource: true },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!job.isActive) {
    throw new Error(`Job is not active: ${jobId}`);
  }

  // Update job status to RUNNING
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  let backupRecord;
  let filePath = "";
  let filename = "";

  try {
    // Decrypt datasource password
    const decryptedPassword = decrypt(job.datasource.passwordEncrypted);

    // Prepare connection info
    const conn: DatabaseConnection = {
      type: job.datasource.type as DatabaseConnection["type"],
      host: job.datasource.host || undefined,
      port: job.datasource.port || undefined,
      username: job.datasource.username || undefined,
      password: decryptedPassword || undefined,
      databaseName: job.datasource.databaseName,
    };

    // Create job-specific directory: BACKUP_BASE_PATH/{destinationPath}
    // Use the destinationPath from job configuration
    // Ensure BACKUP_BASE_PATH is /data/backups (or configured path)
    const backupBasePath = BACKUP_BASE_PATH || "/data/backups";
    
    // Sanitize destinationPath to make it filesystem-safe
    // Remove leading/trailing slashes and normalize path separators
    let sanitizedPath = job.destinationPath.trim().replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
    
    // Replace invalid characters with underscores
    sanitizedPath = sanitizedPath.replace(/[<>:"|?*\x00-\x1f]/g, "_");
    
    // If destinationPath is empty or invalid, use job ID as fallback
    if (!sanitizedPath || sanitizedPath.length === 0) {
      sanitizedPath = `job-${job.id}`;
    }
    
    // Build full backup directory path
    const jobBackupDir = path.join(backupBasePath, sanitizedPath);
    
    // Ensure backup base directory exists first
    await ensureBackupDirectory(backupBasePath);
    // Then ensure job-specific directory exists (recursive for nested paths)
    await ensureBackupDirectory(jobBackupDir);
    
    console.log(`📦 Creating backup in: ${jobBackupDir}`);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = getFileExtension(job.datasource.type as DatabaseConnection["type"]);
    filename = `${job.title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${extension}`;
    filePath = path.join(jobBackupDir, filename);

    // Create backup record
    backupRecord = await prisma.backup.create({
      data: {
        jobId: job.id,
        filename,
        filePath,
        size: BigInt(0),
        status: "FAILED", // Will update on success
        durationMs: 0,
      },
    });

    // Execute backup command
    const result = await executeBackupCommand(conn, filePath);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Check if file was created and get size
    let fileSize = BigInt(0);
    try {
      const stats = await fs.stat(filePath);
      fileSize = BigInt(stats.size);
    } catch {
      // File doesn't exist, backup failed
    }

    // Check if backup was successful
    const isSuccess = fileSize > 0 && result.stderr === "";

    // Update backup record
    await prisma.backup.update({
      where: { id: backupRecord.id },
      data: {
        status: isSuccess ? "SUCCESS" : "FAILED",
        size: fileSize,
        durationMs,
        errorMessage: isSuccess ? null : result.stderr || "Backup failed",
      },
    });

    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: isSuccess ? "IDLE" : "ERROR",
      },
    });

    // Trigger webhooks
    if (isSuccess) {
      await triggerWebhooks("JOB_SUCCESS", job.id, job.title, {
        file: filename,
        size: formatBytes(fileSize),
      });
    } else {
      await triggerWebhooks("JOB_FAILURE", job.id, job.title, {
        error: result.stderr || "Backup failed",
      });
    }
  } catch (error: unknown) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "ERROR" },
    });

    // Update backup record if it exists
    if (backupRecord) {
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: "FAILED",
          durationMs,
          errorMessage: (error as { message?: string }).message || "Unknown error",
        },
      });
    } else {
      // Create failed backup record
      await prisma.backup.create({
        data: {
          jobId: job.id,
          filename: filename || "unknown",
          filePath: filePath || "",
          size: BigInt(0),
          status: "FAILED",
          durationMs,
          errorMessage: (error as { message?: string }).message || "Unknown error",
        },
      });
    }

    // Trigger failure webhook
    await triggerWebhooks("JOB_FAILURE", job.id, job.title, {
      error: (error as { message?: string }).message || "Unknown error",
    });

    throw error;
  }
}

