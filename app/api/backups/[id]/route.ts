import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";

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

    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    // Delete physical file
    try {
      await fs.unlink(backup.filePath);
    } catch (error) {
      // File might not exist, continue with database deletion
      console.warn(`File not found: ${backup.filePath}`);
    }

    // Delete database record
    await prisma.backup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete backup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete backup" },
      { status: 400 }
    );
  }
}

