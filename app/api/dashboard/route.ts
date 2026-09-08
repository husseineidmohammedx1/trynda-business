import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

async function getBusinessSettings() {
  let settings = await prisma.businessSettings.findFirst();

  if (!settings) {
    settings = await prisma.businessSettings.create({
      data: {
        businessName: "Trynda Business",
        platformFeePercent: 7,
        holdDays: 5,
      },
    });
  }

  return settings;
}

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

    // ========================================
    // LOAD DASHBOARD DATA
    // ========================================

    const settings = await getBusinessSettings();
    const platformFeePercent = Number(settings.platformFeePercent);

    const [
      orders,
      activeBoosters,
      activeOrders,
      completedOrders,
    ] = await Promise.all([
      prisma.order.findMany({
        orderBy: {
          createdAt: "desc",
        },

        take: 5,

        include: {
          booster: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      prisma.user.count({
        where: {
          role: "BOOSTER",
          active: true,
        },
      }),

      prisma.order.count({
        where: {
          status: {
            in: [
              "PENDING",
              "IN_PROGRESS",
            ],
          },
        },
      }),

      prisma.order.count({
        where: {
          status: "COMPLETED",
        },
      }),
    ]);

    // ========================================
    // COMPLETED ORDER FINANCIALS
    // ========================================

    const completedOrdersData =
      await prisma.order.findMany({
        where: {
          status: "COMPLETED",
        },

        select: {
          priceUsd: true,
          platformFeeUsd: true,
          boosterAmountUsd: true,
        },
      });

    // ========================================
    // TOTAL GROSS REVENUE
    // ========================================

    const totalRevenue =
      completedOrdersData.reduce(
        (sum, order) =>
          sum +
          Number(order.priceUsd),
        0
      );

    // ========================================
    // TOTAL PLATFORM FEES
    // ========================================

    const platformFees =
      completedOrdersData.reduce(
        (sum, order) => {
          const fee =
            Number(
              order.platformFeeUsd
            ) ||
            Number(order.priceUsd) *
              (platformFeePercent / 100);

          return sum + fee;
        },
        0
      );

    // ========================================
    // TOTAL BOOSTER EARNINGS
    // ========================================

    const boosterEarnings =
      completedOrdersData.reduce(
        (sum, order) => {
          const price =
            Number(order.priceUsd);

          const platformFee =
            Number(
              order.platformFeeUsd
            ) ||
            price *
              (platformFeePercent /
                100);

          const boosterAmount =
            Number(
              order.boosterAmountUsd
            ) ||
            price - platformFee;

          return (
            sum + boosterAmount
          );
        },
        0
      );

    // ========================================
    // RETURN DASHBOARD
    // ========================================

    return NextResponse.json({
      totalRevenue: Number(
        totalRevenue.toFixed(2)
      ),

      platformFees: Number(
        platformFees.toFixed(2)
      ),

      boosterEarnings: Number(
        boosterEarnings.toFixed(2)
      ),

      platformFeePercent,

      activeBoosters,

      activeOrders,

      completedOrders,

      orders,
    });
  } catch (error) {
    console.error(
      "Dashboard error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load dashboard",
      },
      {
        status: 500,
      }
    );
  }
}