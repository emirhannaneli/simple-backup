import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Users can only update their own profile, or admins can update any user
    if (currentUser.id !== id && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-admins can only update username, not role
    const updateData: { username?: string; role?: string } = {};
    
    if (body.username) {
      updateData.username = body.username;
    }

    // Only admins can update role
    if (body.role && currentUser.role === "ADMIN") {
      updateData.role = body.role;
    }

    // Check if username already exists (excluding current user)
    if (updateData.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: updateData.username,
          id: { not: id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: unknown) {
    console.error("Update user error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update user" },
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

  // Only admins can delete users
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Prevent deleting yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete user error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to delete user" },
      { status: 400 }
    );
  }
}
