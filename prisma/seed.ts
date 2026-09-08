import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@tryndabussines.com";
  const password = "P33n6CKD23DT3$!@&*";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: Role.ADMIN,
      active: true,
      name: "Hussein",
    },
    create: {
      name: "Hussein",
      email,
      passwordHash,
      role: Role.ADMIN,
      active: true,
    },
  });

  console.log(`Admin created: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });