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

function serializeBooster(booster: any) {
  const completedOrders = Array.isArray(
    booster.orders
  )
    ? booster.orders.filter(
        (order: any) =>
          order.status === "COMPLETED"
      )
    : [];

  const calculatedTotalEarned =
    completedOrders.reduce(
      (sum: number, order: any) =>
        sum +
        Number(
          order.boosterAmountUsd ?? 0
        ),
      0
    );

  return {
    id: booster.id,
    name: booster.name,
    email: booster.email,
    profileImageUrl: booster.profileImageUrl,
    active: booster.active,
    createdAt: booster.createdAt,

    platformFeePercent: Number(
      booster.platformFeePercent ?? 7
    ),

    extraPenaltyPercent: Number(
      booster.extraPenaltyPercent ?? 0
    ),

    balanceUsd: Number(
      booster.balanceUsd ?? 0
    ),

    totalEarnedUsd: Number(
      booster.orders
        ? calculatedTotalEarned
        : booster.totalEarnedUsd ?? 0
    ),

    totalPaidUsd: Number(
      booster.totalPaidUsd ?? 0
    ),

    ordersCount:
      booster._count?.orders ?? 0,

    paymentsCount:
      booster._count?.payments ?? 0,
  };
}

// =====================================================
// GET ALL BOOSTERS
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const boosters =
      await prisma.user.findMany({
        where: {
          role: "BOOSTER",
        },

        select: {
          id: true,
          name: true,
          email: true,
          profileImageUrl: true,
          active: true,
          createdAt: true,

          platformFeePercent: true,
          extraPenaltyPercent: true,

          balanceUsd: true,
          totalEarnedUsd: true,
          totalPaidUsd: true,

          _count: {
            select: {
              orders: true,
              payments: true,
            },
          },

          orders: {
            select: {
              status: true,
              boosterAmountUsd: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return NextResponse.json(
      boosters.map(serializeBooster)
    );
  } catch (error) {
    console.error(
      "Get boosters error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load boosters",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// CREATE BOOSTER
// =====================================================

export async function POST(
  request: NextRequest
) {
  try {
    const session =
      await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const name = String(
      body.name || ""
    ).trim();

    const email = String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body.password || ""
    );

    const platformFeePercent =
      body.platformFeePercent ===
      undefined
        ? 7
        : Number(
            body.platformFeePercent
          );

    const extraPenaltyPercent =
      body.extraPenaltyPercent ===
      undefined
        ? 0
        : Number(
            body.extraPenaltyPercent
          );

    // =================================================
    // VALIDATION
    // =================================================

    if (!name) {
      return NextResponse.json(
        {
          error: "Name is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Email is required",
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
            "Password must be at least 8 characters",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        platformFeePercent
      ) ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Platform fee must be between 0 and 100",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        extraPenaltyPercent
      ) ||
      extraPenaltyPercent < 0 ||
      extraPenaltyPercent > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Extra penalty must be between 0 and 100",
        },
        {
          status: 400,
        }
      );
    }

    if (
      platformFeePercent +
        extraPenaltyPercent >
      100
    ) {
      return NextResponse.json(
        {
          error:
            "Platform fee and extra penalty cannot exceed 100% combined",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CHECK EMAIL
    // =================================================

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists",
        },
        {
          status: 409,
        }
      );
    }

    // =================================================
    // HASH PASSWORD
    // =================================================

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    // =================================================
    // CREATE BOOSTER
    // =================================================

    const booster =
      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,

          role: "BOOSTER",
          active: true,

          platformFeePercent,
          extraPenaltyPercent,

          balanceUsd: 0,
          totalEarnedUsd: 0,
          totalPaidUsd: 0,
        },

        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          createdAt: true,

          platformFeePercent: true,
          extraPenaltyPercent: true,

          balanceUsd: true,
          totalEarnedUsd: true,
          totalPaidUsd: true,

          _count: {
            select: {
              orders: true,
              payments: true,
            },
          },
        },
      });

    return NextResponse.json(
      serializeBooster(booster),
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create booster error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create booster",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH BOOSTER
//
// action = edit
// action = toggle
// =====================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    const session =
      await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const boosterId = String(
      body.boosterId || ""
    ).trim();

    const action = String(
      body.action || "toggle"
    ).trim();

    if (!boosterId) {
      return NextResponse.json(
        {
          error:
            "Booster ID is required",
        },
        {
          status: 400,
        }
      );
    }

    const booster =
      await prisma.user.findFirst({
        where: {
          id: boosterId,
          role: "BOOSTER",
        },

        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          createdAt: true,

          platformFeePercent: true,
          extraPenaltyPercent: true,

          balanceUsd: true,
          totalEarnedUsd: true,
          totalPaidUsd: true,

          _count: {
            select: {
              orders: true,
              payments: true,
            },
          },
        },
      });

    if (!booster) {
      return NextResponse.json(
        {
          error:
            "Booster not found",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // EDIT
    // =================================================

    if (action === "edit") {
      const name = String(
        body.name ??
          booster.name
      ).trim();

      const email = String(
        body.email ??
          booster.email
      )
        .trim()
        .toLowerCase();

      const platformFeePercent =
        body.platformFeePercent ===
        undefined
          ? Number(
              booster.platformFeePercent ??
                7
            )
          : Number(
              body.platformFeePercent
            );

      const extraPenaltyPercent =
        body.extraPenaltyPercent ===
        undefined
          ? Number(
              booster.extraPenaltyPercent ??
                0
            )
          : Number(
              body.extraPenaltyPercent
            );

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Name is required",
          },
          {
            status: 400,
          }
        );
      }

      if (!email) {
        return NextResponse.json(
          {
            error:
              "Email is required",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(
          platformFeePercent
        ) ||
        platformFeePercent < 0 ||
        platformFeePercent > 100
      ) {
        return NextResponse.json(
          {
            error:
              "Platform fee must be between 0 and 100",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(
          extraPenaltyPercent
        ) ||
        extraPenaltyPercent < 0 ||
        extraPenaltyPercent > 100
      ) {
        return NextResponse.json(
          {
            error:
              "Extra penalty must be between 0 and 100",
          },
          {
            status: 400,
          }
        );
      }

      if (
        platformFeePercent +
          extraPenaltyPercent >
        100
      ) {
        return NextResponse.json(
          {
            error:
              "Platform fee and extra penalty cannot exceed 100% combined",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // CHECK EMAIL
      // =================================================

      const emailOwner =
        await prisma.user.findFirst({
          where: {
            email,
            NOT: {
              id: boosterId,
            },
          },

          select: {
            id: true,
          },
        });

      if (emailOwner) {
        return NextResponse.json(
          {
            error:
              "Another user already uses this email",
          },
          {
            status: 409,
          }
        );
      }

      // =================================================
      // UPDATE
      // =================================================

      const updated =
        await prisma.user.update({
          where: {
            id: boosterId,
          },

          data: {
            name,
            email,
            platformFeePercent,
            extraPenaltyPercent,
          },

          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            createdAt: true,

            platformFeePercent: true,
            extraPenaltyPercent: true,

            balanceUsd: true,
            totalEarnedUsd: true,
            totalPaidUsd: true,

            _count: {
              select: {
                orders: true,
                payments: true,
              },
            },
          },
        });

      return NextResponse.json({
        success: true,
        booster:
          serializeBooster(
            updated
          ),
      });
    }

    // =================================================
    // TOGGLE
    // =================================================

    const updated =
      await prisma.user.update({
        where: {
          id: boosterId,
        },

        data: {
          active: !booster.active,
        },

        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          createdAt: true,

          platformFeePercent: true,
          extraPenaltyPercent: true,

          balanceUsd: true,
          totalEarnedUsd: true,
          totalPaidUsd: true,

          _count: {
            select: {
              orders: true,
              payments: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,
      booster:
        serializeBooster(
          updated
        ),
    });
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
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// CHANGE PASSWORD
// =====================================================

export async function PUT(
  request: NextRequest
) {
  try {
    const session =
      await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const boosterId = String(
      body.boosterId || ""
    ).trim();

    const password = String(
      body.password || ""
    );

    if (!boosterId) {
      return NextResponse.json(
        {
          error:
            "Booster ID is required",
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
            "Password must be at least 8 characters",
        },
        {
          status: 400,
        }
      );
    }

    const booster =
      await prisma.user.findFirst({
        where: {
          id: boosterId,
          role: "BOOSTER",
        },

        select: {
          id: true,
        },
      });

    if (!booster) {
      return NextResponse.json(
        {
          error:
            "Booster not found",
        },
        {
          status: 404,
        }
      );
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    await prisma.user.update({
      where: {
        id: boosterId,
      },

      data: {
        passwordHash,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Booster password changed successfully",
    });
  } catch (error) {
    console.error(
      "Change booster password error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to change booster password",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE BOOSTER
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
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const boosterId = String(
      body.boosterId || ""
    ).trim();

    if (!boosterId) {
      return NextResponse.json(
        {
          error:
            "Booster ID is required",
        },
        {
          status: 400,
        }
      );
    }

    const booster =
      await prisma.user.findFirst({
        where: {
          id: boosterId,
          role: "BOOSTER",
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!booster) {
      return NextResponse.json(
        {
          error:
            "Booster not found",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.$transaction(
      async (tx) => {
        // Keep old orders
        await tx.order.updateMany({
          where: {
            boosterId,
          },

          data: {
            boosterId: null,
          },
        });

        // Keep old payments
        await tx.payment.updateMany({
          where: {
            boosterId,
          },

          data: {
            boosterId: null,
          },
        });

        // Keep old fines
        await tx.deduction.updateMany({
          where: {
            userId: boosterId,
          },

          data: {
            userId: null,
          },
        });

        // Delete account
        await tx.user.delete({
          where: {
            id: boosterId,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message:
        `Booster "${booster.name}" was deleted successfully`,
    });
  } catch (error) {
    console.error(
      "Delete booster error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete booster",
      },
      {
        status: 500,
      }
    );
  }
}