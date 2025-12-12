import { hash, verify } from "argon2";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { verifyToken } from "./jwt";
import { prisma } from "./prisma";

function getSecretKey() {
  const secretKey = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";
  
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    console.warn("⚠️  WARNING: JWT_SECRET is not set in production! Using default secret (INSECURE).");
  }
  
  return new TextEncoder().encode(secretKey);
}

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await verify(hashedPassword, password);
  } catch {
    return false;
  }
}

export async function signToken(payload: { userId: string; username: string; role: string; mustChangePassword?: boolean }): Promise<string> {
  const encodedKey = getSecretKey();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  return token;
}

// verifyToken moved to lib/jwt.ts for Edge runtime compatibility

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  return user;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}

