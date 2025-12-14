import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { webhookSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhooks = await prisma.webhook.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // Parse events, headers, payload, and jobIds JSON
  const webhooksWithParsedData = webhooks.map((webhook: { events: string; jobIds?: string | null; headers?: string | null; payload?: string | null; [key: string]: any }) => ({
    ...webhook,
    events: JSON.parse(webhook.events),
    jobIds: webhook.jobIds ? JSON.parse(webhook.jobIds) : null,
    headers: webhook.headers ? JSON.parse(webhook.headers) : undefined,
    payload: webhook.payload || null,
  }));

  return NextResponse.json({ webhooks: webhooksWithParsedData });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = webhookSchema.parse(body);

    const webhook = await prisma.webhook.create({
      data: {
        name: validated.name,
        url: validated.url,
        method: validated.method,
        events: JSON.stringify(validated.events),
        jobIds: validated.jobIds && validated.jobIds.length > 0 ? JSON.stringify(validated.jobIds) : null,
        headers: validated.headers ? JSON.stringify(validated.headers) : null,
        payload: validated.payload && validated.payload.trim() !== "" ? validated.payload : null,
        isActive: validated.isActive,
      },
    });

    return NextResponse.json(
      {
        webhook: {
          ...webhook,
          events: JSON.parse(webhook.events),
          jobIds: webhook.jobIds ? JSON.parse(webhook.jobIds) : null,
          headers: webhook.headers ? JSON.parse(webhook.headers) : undefined,
          payload: webhook.payload || null,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create webhook" },
      { status: 400 }
    );
  }
}

