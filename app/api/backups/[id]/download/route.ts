import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createReadStream, existsSync } from "fs";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    if (!existsSync(backup.filePath)) {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 }
      );
    }

    // Create read stream
    const stream = createReadStream(backup.filePath);

    // Return file as download
    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Download backup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download backup" },
      { status: 400 }
    );
  }
}

