import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createReadStream, existsSync, statSync } from "fs";
import { prisma } from "@/lib/prisma";

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    sql: "application/sql",
    archive: "application/x-tar",
    rdb: "application/octet-stream",
    "tar.gz": "application/gzip",
    json: "application/json",
    backup: "application/octet-stream",
    dump: "application/octet-stream",
    db: "application/x-sqlite3",
  };
  return contentTypes[ext || ""] || "application/octet-stream";
}

/**
 * Escape filename for Content-Disposition header
 */
function escapeFilename(filename: string): string {
  // Replace special characters with underscores for safe filename
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

    // Check if file exists
    if (!existsSync(backup.filePath)) {
      return NextResponse.json(
        { error: "Backup file not found on disk" },
        { status: 404 }
      );
    }

    // Get file stats for Content-Length header
    let fileSize: number;
    try {
      const stats = statSync(backup.filePath);
      fileSize = stats.size;
    } catch (error) {
      console.error("Error getting file stats:", error);
      return NextResponse.json(
        { error: "Failed to read backup file" },
        { status: 500 }
      );
    }

    // Create read stream
    const stream = createReadStream(backup.filePath);

    // Escape filename for safe download
    const safeFilename = escapeFilename(backup.filename);

    // Return file as download with proper headers
    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": getContentType(backup.filename),
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(backup.filename)}`,
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error: any) {
    console.error("Download backup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download backup" },
      { status: 500 }
    );
  }
}

