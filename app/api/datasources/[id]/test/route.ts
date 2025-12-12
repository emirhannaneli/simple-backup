import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { testConnection, type DatabaseConnection } from "@/lib/database-commands";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const datasource = await prisma.datasource.findUnique({
      where: { id },
    });

    if (!datasource) {
      return NextResponse.json({ error: "Datasource not found" }, { status: 404 });
    }

    // Decrypt password
    const decryptedPassword = decrypt(datasource.passwordEncrypted);

    // Prepare connection info
    const conn: DatabaseConnection = {
      type: datasource.type as "MYSQL" | "POSTGRES" | "MONGODB",
      host: datasource.host,
      port: datasource.port,
      username: datasource.username,
      password: decryptedPassword,
      databaseName: datasource.databaseName,
    };

    // Test connection
    const result = await testConnection(conn);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Test connection error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Connection test failed" },
      { status: 400 }
    );
  }
}

