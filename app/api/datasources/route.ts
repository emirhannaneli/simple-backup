import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { datasourceSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { checkClientInstalled, installClient } from "@/lib/client-installer";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const datasources = await prisma.datasource.findMany({
    include: {
      _count: {
        select: {
          jobs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ datasources });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = datasourceSchema.parse(body);

    // Check if client is installed (for logging/warning purposes only)
    // Skip for SQLite as it's usually pre-installed
    // SECURITY: We do NOT install packages at runtime - they must be in Dockerfile
    if (validated.type !== "SQLITE") {
      const clientCheck = await checkClientInstalled(validated.type);
      
      if (!clientCheck.installed) {
        // Only check, do not attempt installation for security reasons
        const installResult = await installClient(validated.type);
        
        // Log warning but continue - datasource will be created
        // Backups will fail until client is installed via Dockerfile rebuild
        console.warn(`⚠️  Client for ${validated.type} is not installed: ${installResult.message}`);
        console.warn(`⚠️  Datasource will be created, but backups will fail until client is installed.`);
      } else {
        console.log(`✅ Client for ${validated.type} is already installed`);
      }
    }

    // Encrypt password before storing (only if provided)
    const passwordEncrypted = validated.password ? encrypt(validated.password) : "";

    const datasource = await prisma.datasource.create({
      data: {
        name: validated.name,
        type: validated.type,
        host: validated.host || "",
        port: validated.port || 0,
        username: validated.username || "",
        passwordEncrypted,
        databaseName: validated.databaseName,
        authSource: validated.authSource || "",
      },
    });

    // Don't return encrypted password
    const { passwordEncrypted: _, ...result } = datasource;

    return NextResponse.json({ datasource: result }, { status: 201 });
  } catch (error: any) {
    console.error("Create datasource error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create datasource" },
      { status: 400 }
    );
  }
}

