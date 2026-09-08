import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

// =====================================================
// CREATE FINE
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Admin access required",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const boosterId = String(
      body.boosterId || ""
    ).trim();

    const reason = String(
      body.reason || ""
    ).trim();

    const amountUsd = Number(body.amountUsd);

    // =================================================
    // VALIDATION
    // =================================================

    if (!boosterId) {
      return NextResponse.json(
        {
          error: "Booster is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          error: "Fine reason is required",
        },
        {
          status: 400,
        }
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        {
          error: "Fine reason is too long",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(amountUsd) ||
      amountUsd <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Fine amount must be greater than 0",
        },
        {
          status: 400,
        }
      );
    }

    const finalAmount = Number(
      amountUsd.toFixed(2)
    );

    // =================================================
    // CHECK BOOSTER
    // =================================================

    const booster =
      await prisma.user.findFirst({
        where: {
          id: boosterId,
          role: "BOOSTER",
        },

        select: {
          id: true,
          name: true,
          active: true,
        },
      });

    if (!booster) {
      return NextResponse.json(
        {
          error: "Booster not found",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // CREATE FINE
    // =================================================

    const fine =
      await prisma.deduction.create({
        data: {
          userId: boosterId,
          reason,
          amountUsd: finalAmount,
          remainingUsd: finalAmount,
        },
      });

    return NextResponse.json(
      {
        success: true,

        fine: {
          id: fine.id,

          boosterId: fine.userId,

          boosterName: booster.name,

          reason: fine.reason,

          amountUsd: Number(
            fine.amountUsd
          ),

          createdAt: fine.createdAt,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create fine error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create fine",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE FINE
// =====================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    const session =
      await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Admin access required",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const fineId = String(
      searchParams.get("id") || ""
    ).trim();

    // =================================================
    // VALIDATION
    // =================================================

    if (!fineId) {
      return NextResponse.json(
        {
          error: "Fine ID is required",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FIND FINE
    // =================================================

    const fine =
      await prisma.deduction.findUnique({
        where: {
          id: fineId,
        },

        select: {
          id: true,
          userId: true,
          reason: true,
          amountUsd: true,
          createdAt: true,
        },
      });

    if (!fine) {
      return NextResponse.json(
        {
          error: "Fine not found",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // DELETE FINE
    // =================================================

    await prisma.deduction.delete({
      where: {
        id: fineId,
      },
    });

    return NextResponse.json({
      success: true,

      deletedFine: {
        id: fine.id,

        boosterId: fine.userId,

        reason: fine.reason,

        amountUsd: Number(
          fine.amountUsd
        ),

        createdAt:
          fine.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Delete fine error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to delete fine",
      },
      {
        status: 500,
      }
    );
  }
}