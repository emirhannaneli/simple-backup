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

    // Check if request body contains updated connection info (for testing with new settings)
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, use stored datasource values
    }

    // Use provided values or fall back to stored datasource values
    // This allows testing with updated connection settings while using stored password
    const conn: DatabaseConnection = {
      type: (body.type || datasource.type) as "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CASSANDRA" | "ELASTICSEARCH" | "INFLUXDB" | "NEO4J" | "SQLITE" | "H2",
      host: body.host !== undefined ? body.host : datasource.host,
      port: body.port !== undefined ? body.port : datasource.port,
      username: body.username !== undefined ? body.username : datasource.username,
      password: body.password !== undefined ? body.password : decryptedPassword, // Use provided password or stored one
      databaseName: body.databaseName !== undefined ? body.databaseName : datasource.databaseName,
      authSource: body.authSource !== undefined ? body.authSource : (datasource.authSource || undefined),
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

