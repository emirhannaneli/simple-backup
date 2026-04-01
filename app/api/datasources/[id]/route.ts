import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { datasourceSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
    
    // Get existing datasource to check current password
    const existingDatasource = await prisma.datasource.findUnique({
      where: { id },
    });
    
    if (!existingDatasource) {
      return NextResponse.json({ error: "Datasource not found" }, { status: 404 });
    }
    
    // For updates, password is optional (empty string means keep existing)
    // Create a modified schema that allows empty password for updates
    // We need to recreate the schema without the password refine
    const updateSchema = z.object({
      name: z.string().min(1, "Name is required"),
      type: z.enum(["MYSQL", "POSTGRES", "MONGODB", "REDIS", "CASSANDRA", "ELASTICSEARCH", "INFLUXDB", "NEO4J", "SQLITE", "H2"]),
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      username: z.string().optional(),
      password: z.string().optional(), // Always optional for updates
      databaseName: z.string().min(1, "Database name/path is required"),
      authSource: z.string().optional(),
    }).refine((data) => {
      // SQLite and H2 (file-based) don't require host/port
      if (data.type === "SQLITE") {
        return true;
      }
      if (data.type === "H2" && data.databaseName?.startsWith("jdbc:h2:file:")) {
        return true;
      }
      if (data.type === "REDIS") {
        return data.host && data.port;
      }
      return data.host && data.port;
    }, {
      message: "Host and port are required for this database type",
      path: ["host"],
    }).refine((data) => {
      // Most databases require username, except Redis (optional) and SQLite (not applicable)
      if (data.type === "SQLITE" || data.type === "REDIS") {
        return true;
      }
      if (data.type === "H2" && data.databaseName?.startsWith("jdbc:h2:file:")) {
        return true;
      }
      return !!data.username;
    }, {
      message: "Username is required for this database type",
      path: ["username"],
    });
    // Note: Password validation is intentionally omitted for updates
    
    const validated = updateSchema.parse(body);

    // Encrypt password before storing (only if provided and not empty)
    // If password is not in body or is empty string, keep existing password
    const passwordEncrypted = (validated.password !== undefined && validated.password !== null && validated.password !== "") 
      ? encrypt(validated.password) 
      : undefined;

    // Build update data object, only including fields that are provided
    const updateData: any = {
      name: validated.name,
      type: validated.type,
      databaseName: validated.databaseName,
      authSource: validated.authSource || "",
    };

    // Only update optional fields if they are provided
    if (validated.host !== undefined) {
      updateData.host = validated.host;
    }
    if (validated.port !== undefined) {
      updateData.port = validated.port;
    }
    if (validated.username !== undefined) {
      updateData.username = validated.username;
    }
    // Only update password if a new one was provided
    // If passwordEncrypted is undefined, password field is not included in updateData
    // This means Prisma will not update the password field, keeping the existing one
    if (passwordEncrypted !== undefined) {
      updateData.passwordEncrypted = passwordEncrypted;
    }

    const datasource = await prisma.datasource.update({
      where: { id },
      data: updateData,
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

