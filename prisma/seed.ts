import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding database...");

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existingAdmin) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  // Create default admin user
  const passwordHash = await hashPassword("admin");
  
  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Default admin user created:");
  console.log("Username: admin");
  console.log("Password: admin");
  console.log("Please change the password after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

