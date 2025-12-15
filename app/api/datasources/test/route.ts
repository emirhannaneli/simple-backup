import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { testConnection, type DatabaseConnection } from "@/lib/database-commands";
import { datasourceSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = datasourceSchema.parse(body);

    // Prepare connection info
    const conn: DatabaseConnection = {
      type: validated.type,
      host: validated.host,
      port: validated.port,
      username: validated.username,
      password: validated.password,
      databaseName: validated.databaseName,
    };

    // Test connection
    const result = await testConnection(conn);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Test connection error:", error);
    
    // Handle validation errors
    if (error.issues) {
      return NextResponse.json(
        { success: false, error: "Invalid form data: " + error.issues.map((i: any) => i.message).join(", ") },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || "Connection test failed" },
      { status: 400 }
    );
  }
}



