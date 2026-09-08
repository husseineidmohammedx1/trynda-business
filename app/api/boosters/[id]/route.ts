import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifySession } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("session")?.value;

  if (!token) {
    return null;
  }

  const session = await verifySession(token);

  if (!session || session.role !== "ADMIN") {
    return null;
  }

  return session;
}

// Update booster
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const booster = await prisma.user.findFirst({
      where: {
        id: params.id,
        role: "BOOSTER",
      },
    });

    if (!booster) {
      return NextResponse.json(
        { error: "Booster not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const data: {
      name?: string;
      email?: string;
      passwordHash?: string;
      active?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }

      data.name = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email)
        .trim()
        .toLowerCase();

      if (!email) {
        return NextResponse.json(
          { error: "Email cannot be empty" },
          { status: 400 }
        );
      }

      const existingUser =
        await prisma.user.findFirst({
          where: {
            email,
            NOT: {
              id: params.id,
            },
          },
        });

      if (existingUser) {
        return NextResponse.json(
          {
            error:
              "This email is already in use",
          },
          { status: 409 }
        );
      }

      data.email = email;
    }

    if (body.password !== undefined) {
      const password = String(body.password);

      if (password.length < 8) {
        return NextResponse.json(
          {
            error:
              "Password must be at least 8 characters",
          },
          { status: 400 }
        );
      }

      data.passwordHash =
        await bcrypt.hash(password, 12);
    }

    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400 }
      );
    }

    const updatedBooster =
      await prisma.user.update({
        where: {
          id: params.id,
        },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
              deductions: true,
            },
          },
        },
      });

    return NextResponse.json(
      updatedBooster
    );
  } catch (error) {
    console.error(
      "Update booster error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update booster",
      },
      { status: 500 }
    );
  }
}