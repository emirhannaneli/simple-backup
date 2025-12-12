import * as schedule from "node-schedule";
import { executeBackup } from "./backup-service";
import { prisma } from "./prisma";

class SchedulerService {
  private jobs: Map<string, schedule.Job> = new Map();

  async initialize() {
    console.log("Initializing scheduler...");
    await this.loadAndScheduleJobs();
  }

  async loadAndScheduleJobs() {
    // Cancel all existing scheduled jobs
    this.cancelAllJobs();

    // Load active jobs from database
    const activeJobs = await prisma.job.findMany({
      where: {
        isActive: true,
      },
      include: {
        datasource: true,
      },
    });

    // Schedule each job
    for (const job of activeJobs) {
      this.scheduleJob(job.id, job.cronExpression);
    }

    console.log(`Scheduled ${activeJobs.length} jobs`);
  }

  scheduleJob(jobId: string, cronExpression: string) {
    // Cancel existing job if any
    this.cancelJob(jobId);

    // Create new scheduled job
    const scheduledJob = schedule.scheduleJob(cronExpression, async () => {
      try {
        console.log(`Executing scheduled backup for job: ${jobId}`);
        await executeBackup(jobId);
      } catch (error) {
        console.error(`Error executing backup for job ${jobId}:`, error);
      }
    });

    if (scheduledJob) {
      this.jobs.set(jobId, scheduledJob);
      console.log(`Scheduled job ${jobId} with cron: ${cronExpression}`);
    } else {
      console.error(`Failed to schedule job ${jobId} with invalid cron: ${cronExpression}`);
    }
  }

  cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      schedule.cancelJob(job);
      this.jobs.delete(jobId);
    }
  }

  cancelAllJobs() {
    for (const [jobId, job] of this.jobs.entries()) {
      schedule.cancelJob(job);
    }
    this.jobs.clear();
  }

  async refresh() {
    await this.loadAndScheduleJobs();
  }
}

// Singleton instance
let schedulerInstance: SchedulerService | null = null;

export function getScheduler(): SchedulerService {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerService();
  }
  return schedulerInstance;
}

