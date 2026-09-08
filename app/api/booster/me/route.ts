import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof (value as { toJSON?: unknown }).toJSON === "function"
  ) {
    return (
      value as { toJSON: () => unknown }
    ).toJSON();
  }

  return value;
}

function serializeObject<T extends Record<string, unknown>>(
  object: T
) {
  return Object.fromEntries(
    Object.entries(object).map(
      ([key, value]) => [
        key,
        serializeValue(value),
      ]
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get("session")?.value;

    if (!token) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const session = await verifySession(token);

    if (!session?.userId) {
      return NextResponse.json(
        {
          error: "Invalid session",
        },
        {
          status: 401,
        }
      );
    }

    if (session.role !== "BOOSTER") {
      return NextResponse.json(
        {
          error: "Booster access required",
        },
        {
          status: 403,
        }
      );
    }

    const booster = await prisma.user.findUnique({
      where: {
        id: String(session.userId),
      },

      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        profileImageUrl: true,
        telegramChatId: true,

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
          error: "Booster account not found",
        },
        {
          status: 404,
        }
      );
    }

    if (!booster.active) {
      return NextResponse.json(
        {
          error: "Your booster account is disabled",
        },
        {
          status: 403,
        }
      );
    }

    /*
      IMPORTANT:

      We intentionally DO NOT accept boosterId
      from the client.

      The boosterId comes only from the
      authenticated JWT session.
    */

    const orders = await prisma.order.findMany({
      where: {
        boosterId: booster.id,
      },

      /*
        No "select" here.

        Prisma therefore returns ALL scalar
        fields that exist on Order.
      */

      include: {
        payment: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const notifications =
      await prisma.notification.findMany({
        where: { userId: booster.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

    const serializedOrders = orders.map(
      (order) => {
        const plainOrder =
          serializeObject(
            order as unknown as Record<
              string,
              unknown
            >
          );

        const payment =
          order.payment
            ? serializeObject(
                order.payment as unknown as Record<
                  string,
                  unknown
                >
              )
            : null;

        return {
          ...plainOrder,
          payment,
        };
      }
    );

    return NextResponse.json({
      success: true,

      booster: {
        id: booster.id,
        name: booster.name,
        email: booster.email,
        profileImageUrl: booster.profileImageUrl,
        telegramChatId: booster.telegramChatId,

        active: booster.active,

        createdAt: serializeValue(
          booster.createdAt
        ),

        platformFeePercent:
          serializeValue(
            booster.platformFeePercent
          ),

        extraPenaltyPercent:
          serializeValue(
            booster.extraPenaltyPercent
          ),

        balanceUsd:
          serializeValue(
            booster.balanceUsd
          ),

        totalEarnedUsd:
          serializeValue(
            booster.totalEarnedUsd
          ),

        totalPaidUsd:
          serializeValue(
            booster.totalPaidUsd
          ),

        ordersCount:
          booster._count.orders,

        paymentsCount:
          booster._count.payments,
      },

      orders: serializedOrders,
      notifications: notifications.map(
        (notification) =>
          serializeObject(
            notification as unknown as Record<
              string,
              unknown
            >
          )
      ),
    });
  } catch (error) {
    console.error(
      "Booster portal error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load booster portal",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("session")?.value;
    const session = token
      ? await verifySession(token)
      : null;

    if (!session?.userId || session.role !== "BOOSTER") {
      return NextResponse.json(
        { error: "Booster access required" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.action === "markNotificationsRead") {
      await prisma.notification.updateMany({
        where: {
          userId: String(session.userId),
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return NextResponse.json({
        success: true,
      });
    }

    const data: {
      profileImageUrl?: string | null;
    } = {};

    if (body.profileImageUrl !== undefined) {
      data.profileImageUrl =
        body.profileImageUrl === null
          ? null
          : String(body.profileImageUrl || "");
    }

    if (
      data.profileImageUrl &&
      (!/^data:image\/(jpeg|png|webp);base64,/.test(
        data.profileImageUrl
      ) || data.profileImageUrl.length > 1_500_000)
    ) {
      return NextResponse.json(
        {
          error:
            "Please upload a valid image smaller than 1 MB.",
        },
        { status: 400 }
      );
    }

    const booster = await prisma.user.update({
      where: { id: String(session.userId) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        profileImageUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      booster,
    });
  } catch (error) {
    console.error(
      "Update booster profile image error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update profile image" },
      { status: 500 }
    );
  }
}