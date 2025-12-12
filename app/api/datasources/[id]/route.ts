import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { datasourceSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";
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
  const datasource = await prisma.datasource.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  if (!datasource) {
    return NextResponse.json({ error: "Datasource not found" }, { status: 404 });
  }

  // Don't return encrypted password
  const { passwordEncrypted: _, ...result } = datasource;

  return NextResponse.json({ datasource: result });
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
    const validated = datasourceSchema.parse(body);

    // Encrypt password before storing
    const passwordEncrypted = encrypt(validated.password);

    const datasource = await prisma.datasource.update({
      where: { id },
      data: {
        name: validated.name,
        type: validated.type,
        host: validated.host,
        port: validated.port,
        username: validated.username,
        passwordEncrypted,
        databaseName: validated.databaseName,
      },
    });

    // Don't return encrypted password
    const { passwordEncrypted: _, ...result } = datasource;

    return NextResponse.json({ datasource: result });
  } catch (error: any) {
    console.error("Update datasource error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update datasource" },
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

    // Check if datasource has jobs
    const datasource = await prisma.datasource.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    if (!datasource) {
      return NextResponse.json({ error: "Datasource not found" }, { status: 404 });
    }

    if (datasource._count.jobs > 0) {
      return NextResponse.json(
        { error: "Cannot delete datasource with existing jobs" },
        { status: 400 }
      );
    }

    await prisma.datasource.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete datasource error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete datasource" },
      { status: 400 }
    );
  }
}

