import { NextResponse } from "next/server";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(validated.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if user is using default password ("admin")
    const isDefaultPassword = await verifyPassword("admin", user.passwordHash);

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: isDefaultPassword && user.role === "ADMIN",
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

