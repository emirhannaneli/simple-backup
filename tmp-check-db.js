const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ds = await prisma.datasource.findMany();
  console.log(JSON.stringify(ds, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
