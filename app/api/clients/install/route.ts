import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkClientInstalled, installClient, installInfluxDB } from "@/lib/client-installer";
import { z } from "zod";

const installSchema = z.object({
  dbType: z.enum(["MYSQL", "POSTGRES", "MONGODB", "REDIS", "CASSANDRA", "ELASTICSEARCH", "INFLUXDB", "NEO4J", "SQLITE", "H2"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can install clients
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Only admins can install clients" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { dbType } = installSchema.parse(body);

    // Check if already installed
    const checkResult = await checkClientInstalled(dbType);
    if (checkResult.installed) {
      return NextResponse.json({
        success: true,
        message: `${checkResult.command} is already installed`,
        installed: true,
      });
    }

    // Special handling for InfluxDB (binary download)
    if (dbType === "INFLUXDB") {
      const result = await installInfluxDB();
      return NextResponse.json({
        success: result.success,
        message: result.message,
        installed: result.success,
      });
    }

    // Special handling for MongoDB (requires mongodb-tools + mongosh binary)
    if (dbType === "MONGODB") {
      const { installMongoDB } = await import("@/lib/client-installer");
      const result = await installMongoDB();
      return NextResponse.json({
        success: result.success,
        message: result.message,
        installed: result.success,
      });
    }

    // Install other clients
    const result = await installClient(dbType);
    
    if (!result.canInstall) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          installed: false,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      installed: result.success,
    });
  } catch (error: any) {
    console.error("Install client error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to install client" },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbTypes = ["MYSQL", "POSTGRES", "MONGODB", "REDIS", "CASSANDRA", "ELASTICSEARCH", "INFLUXDB", "NEO4J", "SQLITE", "H2"];
    
    const status = await Promise.all(
      dbTypes.map(async (dbType) => {
        const checkResult = await checkClientInstalled(dbType);
        return {
          dbType,
          installed: checkResult.installed,
          command: checkResult.command,
        };
      })
    );

    return NextResponse.json({ clients: status });
  } catch (error: any) {
    console.error("Get client status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get client status" },
      { status: 400 }
    );
  }
}
