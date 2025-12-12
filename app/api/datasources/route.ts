import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { datasourceSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

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

    // Encrypt password before storing
    const passwordEncrypted = encrypt(validated.password);

    const datasource = await prisma.datasource.create({
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

    return NextResponse.json({ datasource: result }, { status: 201 });
  } catch (error: any) {
    console.error("Create datasource error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create datasource" },
      { status: 400 }
    );
  }
}

