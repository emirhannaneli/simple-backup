import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiKeySchema } from "@/lib/validations";
import { generateApiKey } from "@/lib/api-key-service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKeys = await prisma.apiKey.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ apiKeys });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = apiKeySchema.parse(body);

    const { fullKey, prefix, hash } = await generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name: validated.name,
        keyHash: hash,
        prefix,
      },
    });

    // Return the full key only once (client should save it)
    return NextResponse.json(
      {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          createdAt: apiKey.createdAt,
        },
        fullKey, // Only returned on creation
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create API key" },
      { status: 400 }
    );
  }
}

