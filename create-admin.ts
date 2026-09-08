import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@tryndabusiness.com";
  const password = "Admin123456";
  const name = "Trynda Admin";

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  const existingAdmin =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existingAdmin) {
    console.log("Admin already exists.");
    return;
  }

  const admin =
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        active: true,
        balanceUsd: 0,
        totalEarnedUsd: 0,
        totalPaidUsd: 0,
      },
    });

  console.log(
    "Admin created successfully:"
  );

  console.log({
    id: admin.id,
    name: admin.name,
    email: admin.email,
  });
}

main()
  .catch((error) => {
    console.error(
      "Failed to create admin:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });