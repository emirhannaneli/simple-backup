import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  const backups = await prisma.backup.findMany({
    where: jobId ? { jobId } : undefined,
    include: {
      job: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  // Convert BigInt to string for JSON serialization
  const serializedBackups = backups.map(backup => ({
    ...backup,
    size: backup.size.toString(),
  }));

  return NextResponse.json({ backups: serializedBackups });
}

