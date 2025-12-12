import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Execute backup asynchronously
    executeBackup(id).catch((error) => {
      console.error(`Error executing backup for job ${id}:`, error);
    });

    return NextResponse.json({
      message: "Backup started",
      jobId: id,
    });
  } catch (error: any) {
    console.error("Run job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start backup" },
      { status: 400 }
    );
  }
}

