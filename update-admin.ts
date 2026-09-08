import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL =
  "hessaneidmohammedx1@gmail.com";

const ADMIN_PASSWORD =
  "ChangeThisPassword123!";

async function main() {
  const passwordHash =
    await bcrypt.hash(
      ADMIN_PASSWORD,
      12
    );

  // Find all admin accounts
  const admins =
    await prisma.user.findMany({
      where: {
        role: "ADMIN",
      },
      select: {
        id: true,
        email: true,
      },
    });

  // Check if the target email already exists
  const existingUser =
    await prisma.user.findUnique({
      where: {
        email: ADMIN_EMAIL,
      },
      select: {
        id: true,
        role: true,
      },
    });

  let adminId: string;

  // Existing target user
  if (existingUser) {
    adminId = existingUser.id;

    await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        role: "ADMIN",
        active: true,
      },
    });
  } else {
    // Use existing admin if available
    if (admins.length > 0) {
      adminId = admins[0].id;

      await prisma.user.update({
        where: {
          id: adminId,
        },
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          role: "ADMIN",
          active: true,
        },
      });
    } else {
      // No admin exists -> create one
      const newAdmin =
        await prisma.user.create({
          data: {
            name: "Hessane Eid",
            email: ADMIN_EMAIL,
            passwordHash,
            role: "ADMIN",
            active: true,
          },
        });

      adminId = newAdmin.id;
    }
  }

  // Make every other admin a booster
  const otherAdmins =
    await prisma.user.findMany({
      where: {
        role: "ADMIN",
        NOT: {
          id: adminId,
        },
      },
      select: {
        id: true,
      },
    });

  if (otherAdmins.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: otherAdmins.map(
            (user) => user.id
          ),
        },
      },
      data: {
        role: "BOOSTER",
      },
    });
  }

  const admin =
    await prisma.user.findUnique({
      where: {
        id: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

  console.log("");
  console.log(
    "================================"
  );
  console.log(
    "PRIMARY ADMIN CONFIGURED"
  );
  console.log(
    "================================"
  );
  console.log(
    "Email:",
    admin?.email
  );
  console.log(
    "Role:",
    admin?.role
  );
  console.log(
    "Active:",
    admin?.active
  );
  console.log("");
  console.log(
    "Temporary password:",
    ADMIN_PASSWORD
  );
  console.log(
    "================================"
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to configure admin:"
    );
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });