import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jobSchema } from "@/lib/validations";
import { getScheduler } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      datasource: true,
      backups: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Convert BigInt to string for JSON serialization
  const serializedJob = {
    ...job,
    backups: job.backups.map(backup => ({
      ...backup,
      size: backup.size.toString(),
    })),
  };

  return NextResponse.json({ job: serializedJob });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = jobSchema.parse(body);

    const job = await prisma.job.update({
      where: { id },
      data: {
        title: validated.title,
        datasourceId: validated.datasourceId,
        cronExpression: validated.cronExpression,
        destinationPath: validated.destinationPath,
        timezone: validated.timezone || "UTC",
        isActive: validated.isActive,
      },
      include: {
        datasource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Refresh scheduler
    const scheduler = getScheduler();
    await scheduler.refresh();

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("Update job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update job" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Cancel scheduled job
    const scheduler = getScheduler();
    scheduler.cancelJob(id);

    await prisma.job.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete job" },
      { status: 400 }
    );
  }
}

