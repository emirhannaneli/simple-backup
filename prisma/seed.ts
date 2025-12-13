import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding database...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL || "not set");

  try {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: "admin" },
    });

    if (existingAdmin) {
      console.log("✓ Admin user already exists, skipping seed.");
      return;
    }

    // Create default admin user
    console.log("Creating admin user...");
    const passwordHash = await hashPassword("admin");
    
    const user = await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        role: "ADMIN",
      },
    });

    console.log("✓ Default admin user created successfully:");
    console.log("  Username: admin");
    console.log("  Password: admin");
    console.log("  User ID:", user.id);
    console.log("⚠ Please change the password after first login!");
  } catch (error) {
    console.error("✗ Error during seed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

