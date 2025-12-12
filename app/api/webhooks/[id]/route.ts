import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { webhookSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";

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
    const validated = webhookSchema.parse(body);

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        url: validated.url,
        method: validated.method,
        events: JSON.stringify(validated.events),
        isActive: validated.isActive,
      },
    });

    return NextResponse.json({
      webhook: {
        ...webhook,
        events: JSON.parse(webhook.events),
      },
    });
  } catch (error: any) {
    console.error("Update webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update webhook" },
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

    await prisma.webhook.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete webhook" },
      { status: 400 }
    );
  }
}

