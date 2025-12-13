import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jobSchema } from "@/lib/validations";
import { getScheduler } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    include: {
      datasource: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      _count: {
        select: {
          backups: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = jobSchema.parse(body);

    const job = await prisma.job.create({
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

    // Refresh scheduler if job is active
    if (validated.isActive) {
      const scheduler = getScheduler();
      await scheduler.refresh();
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: any) {
    console.error("Create job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create job" },
      { status: 400 }
    );
  }
}

