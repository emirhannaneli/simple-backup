import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { userSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can view users
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can create users
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = userSchema.parse(body);

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(validated.password);

    const newUser = await prisma.user.create({
      data: {
        username: validated.username,
        passwordHash,
        role: validated.role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 400 }
    );
  }
}

