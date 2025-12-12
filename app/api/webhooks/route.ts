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

  // Parse events JSON
  const webhooksWithParsedEvents = webhooks.map((webhook: { events: string; [key: string]: any }) => ({
    ...webhook,
    events: JSON.parse(webhook.events),
  }));

  return NextResponse.json({ webhooks: webhooksWithParsedEvents });
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
        url: validated.url,
        method: validated.method,
        events: JSON.stringify(validated.events),
        isActive: validated.isActive,
      },
    });

    return NextResponse.json(
      {
        webhook: {
          ...webhook,
          events: JSON.parse(webhook.events),
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

