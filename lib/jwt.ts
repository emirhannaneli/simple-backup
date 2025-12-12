import { jwtVerify } from "jose";

function getSecretKey() {
  const secretKey = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";
  
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    console.warn("⚠️  WARNING: JWT_SECRET is not set in production! Using default secret (INSECURE).");
  }
  
  return new TextEncoder().encode(secretKey);
}

export async function verifyToken(token: string): Promise<{ userId: string; username: string; role: string; mustChangePassword?: boolean } | null> {
  try {
    const encodedKey = getSecretKey();
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });

    return payload as { userId: string; username: string; role: string; mustChangePassword?: boolean };
  } catch {
    return null;
  }
}

