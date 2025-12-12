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

const BACKUP_BASE_PATH = process.env.BACKUP_BASE_PATH || "./backups";

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
      type: job.datasource.type as "MYSQL" | "POSTGRES" | "MONGODB",
      host: job.datasource.host,
      port: job.datasource.port,
      username: job.datasource.username,
      password: decryptedPassword,
      databaseName: job.datasource.databaseName,
    };

    // Ensure destination directory exists
    await ensureBackupDirectory(job.destinationPath);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = getFileExtension(job.datasource.type as "MYSQL" | "POSTGRES" | "MONGODB");
    filename = `${job.title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${extension}`;
    filePath = path.join(job.destinationPath, filename);

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

