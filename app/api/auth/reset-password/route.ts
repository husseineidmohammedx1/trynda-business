import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ADMIN_EMAIL =
  "hessaneidmohammedx1@gmail.com";

function hashCode(code: string) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const email = String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

    const code = String(
      body.code || ""
    ).trim();

    const password = String(
      body.password || ""
    );

    if (email !== ADMIN_EMAIL) {
      return NextResponse.json(
        {
          error:
            "Invalid reset request.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          error:
            "Reset code must be 6 digits.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      await prisma.user.findUnique({
        where: {
          email: ADMIN_EMAIL,
        },
        select: {
          id: true,
          role: true,
          active: true,
        },
      });

    if (
      !admin ||
      admin.role !== "ADMIN" ||
      !admin.active
    ) {
      return NextResponse.json(
        {
          error:
            "Admin account not found.",
        },
        {
          status: 404,
        }
      );
    }

    const tokenHash =
      hashCode(code);

    const resetToken =
      await prisma.passwordResetToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (
      !resetToken ||
      resetToken.userId !== admin.id ||
      resetToken.usedAt
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid reset code.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      resetToken.expiresAt.getTime() <
      Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Reset code has expired.",
        },
        {
          status: 400,
        }
      );
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: admin.id,
        },
        data: {
          passwordHash,
        },
      }),

      prisma.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),

      prisma.passwordResetToken.deleteMany({
        where: {
          userId: admin.id,
          id: {
            not: resetToken.id,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message:
        "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to reset password.",
      },
      {
        status: 500,
      }
    );
  }
}