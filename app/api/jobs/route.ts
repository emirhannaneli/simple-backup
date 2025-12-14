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
      datasources: {
        include: {
          datasource: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
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

  // Transform datasources to match old format for backward compatibility
  const jobsWithDatasource = jobs.map(job => ({
    ...job,
    datasource: job.datasources[0]?.datasource || null, // First datasource for backward compatibility
  }));

  return NextResponse.json({ jobs: jobsWithDatasource });
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
        cronExpression: validated.cronExpression,
        destinationPath: validated.destinationPath,
        timezone: validated.timezone || "UTC",
        isActive: validated.isActive,
        datasources: {
          create: validated.datasourceIds.map(datasourceId => ({
            datasourceId,
          })),
        },
      },
      include: {
        datasources: {
          include: {
            datasource: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    // Transform for backward compatibility
    const jobWithDatasource = {
      ...job,
      datasource: job.datasources[0]?.datasource || null,
    };

    // Refresh scheduler if job is active
    if (validated.isActive) {
      const scheduler = getScheduler();
      await scheduler.refresh();
    }

    return NextResponse.json({ job: jobWithDatasource }, { status: 201 });
  } catch (error: any) {
    console.error("Create job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create job" },
      { status: 400 }
    );
  }
}

