import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key-middleware";
import { executeBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Validate API key
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "Invalid API key" },
      { status: 401 }
    );
  }

  try {
    const { jobId } = await params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.isActive) {
      return NextResponse.json(
        { error: "Job is not active" },
        { status: 400 }
      );
    }

    // Execute backup asynchronously
    executeBackup(jobId).catch((error) => {
      console.error(`Error executing backup for job ${jobId}:`, error);
    });

    return NextResponse.json({
      message: "Backup started",
      jobId,
    });
  } catch (error: any) {
    console.error("Trigger backup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start backup" },
      { status: 400 }
    );
  }
}

