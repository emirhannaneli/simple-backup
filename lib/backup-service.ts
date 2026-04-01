import { promises as fs } from "fs";
import path from "path";
import { decrypt } from "./encryption";
import {
  executeBackupCommand,
  getFileExtension,
  getMissingBackupConnectionFields,
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

  // Fetch job with datasources
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      datasources: {
        include: {
          datasource: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!job.isActive) {
    throw new Error(`Job is not active: ${jobId}`);
  }

  if (!job.datasources || job.datasources.length === 0) {
    throw new Error(`Job has no datasources: ${jobId}`);
  }

  // Update job status to RUNNING
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  // Create job-specific directory: BACKUP_BASE_PATH/{destinationPath}
  const backupBasePath = BACKUP_BASE_PATH || "/data/backups";
  let sanitizedPath = job.destinationPath.trim().replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
  sanitizedPath = sanitizedPath.replace(/[<>:"|?*\x00-\x1f]/g, "_");
  if (!sanitizedPath || sanitizedPath.length === 0) {
    sanitizedPath = `job-${job.id}`;
  }
  const jobBackupDir = path.join(backupBasePath, sanitizedPath);
  await ensureBackupDirectory(backupBasePath);
  await ensureBackupDirectory(jobBackupDir);
  console.log(`📦 Creating backups in: ${jobBackupDir}`);

  // Backup each datasource
  const backupResults: Array<{ success: boolean; datasourceName: string; filename?: string; error?: string }> = [];
  let allSuccess = true;
  let anySuccess = false;

  for (const jobDatasource of job.datasources) {
    const datasource = jobDatasource.datasource;
    const datasourceStartTime = Date.now();
    let backupRecord;
    let filePath = "";
    let filename = "";

    try {
      console.log(`📦 Starting backup for datasource: ${datasource.name} (${datasource.type})`);

      // Decrypt datasource password
      const decryptedPassword = decrypt(datasource.passwordEncrypted);

      // Prepare connection info
      const conn: DatabaseConnection = {
        type: datasource.type as DatabaseConnection["type"],
        host: datasource.host || undefined,
        port: datasource.port || undefined,
        username: datasource.username || undefined,
        password: decryptedPassword || undefined,
        databaseName: datasource.databaseName,
        authSource: datasource.authSource || undefined,
      };

      const missingFields = getMissingBackupConnectionFields(conn);
      if (missingFields.length > 0) {
        throw new Error(
          `Datasource "${datasource.name}": missing connection field(s): ${missingFields.join(", ")}`
        );
      }

      // Generate filename with datasource name
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extension = getFileExtension(datasource.type as DatabaseConnection["type"]);
      const safeDatasourceName = datasource.name.replace(/[^a-zA-Z0-9]/g, "_");
      filename = `${job.title.replace(/[^a-zA-Z0-9]/g, "_")}_${safeDatasourceName}_${timestamp}.${extension}`;
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

      const datasourceEndTime = Date.now();
      const datasourceDurationMs = datasourceEndTime - datasourceStartTime;

      // Check if file was created and get size
      let fileSize = BigInt(0);
      try {
        const stats = await fs.stat(filePath);
        fileSize = BigInt(stats.size);
      } catch {
        // File doesn't exist, backup failed
      }

      // Success = process exited 0 and output file is non-empty. Do not require stderr to be empty:
      // mongodump (and many CLI tools) write normal progress to stderr.
      const isSuccess = fileSize > 0 && !result.failed;
      const errorMessage = isSuccess
        ? null
        : result.failed
          ? (result.stderr || "Backup command failed")
          : "Backup produced an empty output file";

      // Update backup record
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: isSuccess ? "SUCCESS" : "FAILED",
          size: fileSize,
          durationMs: datasourceDurationMs,
          errorMessage,
        },
      });

      if (isSuccess) {
        anySuccess = true;
        backupResults.push({
          success: true,
          datasourceName: datasource.name,
          filename,
        });
        console.log(`✅ Backup successful for datasource: ${datasource.name} (${formatBytes(fileSize)})`);
      } else {
        allSuccess = false;
        backupResults.push({
          success: false,
          datasourceName: datasource.name,
          error: errorMessage || "Backup failed",
        });
        console.error(`❌ Backup failed for datasource: ${datasource.name} - ${errorMessage || "Unknown error"}`);
      }
    } catch (error: unknown) {
      allSuccess = false;
      const datasourceEndTime = Date.now();
      const datasourceDurationMs = datasourceEndTime - datasourceStartTime;

      backupResults.push({
        success: false,
        datasourceName: datasource.name,
        error: (error as { message?: string }).message || "Unknown error",
      });

      // Update backup record if it exists
      if (backupRecord) {
        await prisma.backup.update({
          where: { id: backupRecord.id },
          data: {
            status: "FAILED",
            durationMs: datasourceDurationMs,
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
            durationMs: datasourceDurationMs,
            errorMessage: (error as { message?: string }).message || "Unknown error",
          },
        });
      }

      console.error(`❌ Error backing up datasource ${datasource.name}:`, error);
    }
  }

  const endTime = Date.now();
  const totalDurationMs = endTime - startTime;

  // Update job status based on results
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: allSuccess ? "IDLE" : anySuccess ? "IDLE" : "ERROR", // If any succeeded, mark as IDLE
    },
  });

  // Trigger webhooks
  try {
    if (allSuccess) {
      console.log(`🔔 Triggering JOB_SUCCESS webhook for job ${job.id} (all datasources backed up)`);
      const successFiles = backupResults.filter(r => r.success && r.filename).map(r => r.filename!);
      await triggerWebhooks("JOB_SUCCESS", job.id, job.title, {
        file: successFiles.length > 0 ? successFiles.join(", ") : null,
        size: null, // Multiple files, size not applicable
      });
    } else if (anySuccess) {
      console.log(`🔔 Triggering JOB_SUCCESS webhook for job ${job.id} (partial success)`);
      const successFiles = backupResults.filter(r => r.success && r.filename).map(r => r.filename!);
      await triggerWebhooks("JOB_SUCCESS", job.id, job.title, {
        file: successFiles.length > 0 ? successFiles.join(", ") : null,
        size: null,
      });
    } else {
      console.log(`🔔 Triggering JOB_FAILURE webhook for job ${job.id} (all datasources failed)`);
      const errors = backupResults.filter(r => !r.success).map(r => `${r.datasourceName}: ${r.error || "Unknown error"}`).join("; ");
      await triggerWebhooks("JOB_FAILURE", job.id, job.title, {
        error: errors || "All backups failed",
      });
    }
  } catch (webhookError) {
    console.error(`❌ Error triggering webhooks for job ${job.id}:`, webhookError);
    // Don't throw - webhook errors shouldn't fail the backup
  }

  // If all failed, throw error
  if (!anySuccess) {
    throw new Error(`All backups failed for job ${jobId}`);
  }
}
