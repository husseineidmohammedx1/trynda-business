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