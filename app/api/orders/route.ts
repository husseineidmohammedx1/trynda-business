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

async function getBusinessSettings() {
  let settings =
    await prisma.businessSettings.findFirst();

  if (!settings) {
    settings =
      await prisma.businessSettings.create({
        data: {
          businessName: "Trynda Business",
          platformFeePercent: 7,
          holdDays: 5,
        },
      });
  }

  return settings;
}

async function getLiveExchangeRate() {
  const response = await fetch(
    "https://open.er-api.com/v6/latest/USD",
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Exchange rate API failed");
  }

  const data = await response.json();

  const rate = Number(data?.rates?.EGP);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid exchange rate");
  }

  return rate;
}

// =====================================================
// GET ALL ORDERS
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const orders = await prisma.order.findMany({
      include: {
        booster: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Get orders error:", error);

    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}

// =====================================================
// CREATE ORDER
// =====================================================

export async function POST(request: NextRequest) {
  try {
    // =================================================
    // ADMIN AUTH
    // =================================================

    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // =================================================
    // BUSINESS SETTINGS
    // =================================================

    const settings = await getBusinessSettings();

    // =================================================
    // READ BODY
    // =================================================

    const body = await request.json();

    // =================================================
    // ORDER ID - MANUAL
    // =================================================

    const orderId = String(
      body.orderId || ""
    ).trim();

    // =================================================
    // BASIC ORDER DATA
    // =================================================

    const title = String(
      body.title || ""
    ).trim();

    const game =
      String(body.game || "").trim() ||
      "World of Warcraft";

    const customer =
      String(body.customer || "").trim() ||
      null;

    // =================================================
    // ORDER DETAILS
    // =================================================

    const description =
      String(body.description || "").trim() ||
      null;

    const characterName =
      String(
        body.characterName || ""
      ).trim() || null;

    const battleTag =
      String(body.battleTag || "").trim() ||
      null;

    const faction =
      String(body.faction || "").trim() ||
      null;

    const serverName =
      String(
        body.serverName || ""
      ).trim() || null;

    const vpnLocation =
      String(
        body.vpnLocation || ""
      ).trim() || null;

    const region =
      String(body.region || "").trim() ||
      null;

    // =================================================
    // PRICE
    // =================================================

    const priceUsd = Number(
      body.priceUsd
    );

    // =================================================
    // BOOSTER / ORDER FEES
    // =================================================

    const boosterId = body.boosterId
      ? String(body.boosterId)
      : null;

    const platformFeePercent =
      body.platformFeePercent === undefined
        ? Number(settings.platformFeePercent)
        : Number(body.platformFeePercent);

    const extraPenaltyPercent =
      body.extraPenaltyPercent === undefined
        ? 0
        : Number(body.extraPenaltyPercent);

    // =================================================
    // VALIDATION
    // =================================================

    if (!orderId) {
      return NextResponse.json(
        {
          error: "Order ID is required",
        },
        {
          status: 400,
        }
      );
    }

    // Prevent extremely long IDs
    if (orderId.length > 100) {
      return NextResponse.json(
        {
          error:
            "Order ID must be 100 characters or less",
        },
        {
          status: 400,
        }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Order title is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(priceUsd) ||
      priceUsd <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid USD price",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CHECK DUPLICATE ORDER ID
    // =================================================

    const existingOrder =
      await prisma.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
        },
      });

    if (existingOrder) {
      return NextResponse.json(
        {
          error:
            "This Order ID already exists",
        },
        {
          status: 409,
        }
      );
    }

    // =================================================
    // CHECK BOOSTER
    // =================================================

    if (boosterId) {
      const booster =
        await prisma.user.findFirst({
          where: {
            id: boosterId,
            role: "BOOSTER",
            active: true,
          },
          select: {
            id: true,
          },
        });

      if (!booster) {
        return NextResponse.json(
          {
            error:
              "Invalid or inactive booster",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // EXCHANGE RATE
    // =================================================

    const exchangeRate =
      await getLiveExchangeRate();

    // =================================================
    // PLATFORM FEE
    // =================================================

    const platformFeeUsd = Number(
      (
        priceUsd *
        (platformFeePercent / 100)
      ).toFixed(2)
    );

    const extraPenaltyUsd = Number(
      (
        priceUsd *
        (extraPenaltyPercent / 100)
      ).toFixed(2)
    );

    // =================================================
    // BOOSTER AMOUNT
    // =================================================

    const boosterAmountUsd = Number(
      (
        priceUsd -
        platformFeeUsd -
        extraPenaltyUsd
      ).toFixed(2)
    );

    // =================================================
    // INITIAL FINE
    // =================================================

    const finedUsd = 0;

    // =================================================
    // NET AMOUNT
    // =================================================

    const netAmountUsd = Number(
      (
        boosterAmountUsd -
        finedUsd
      ).toFixed(2)
    );

    // =================================================
    // EGP
    // =================================================

    const amountEgp = Number(
      (
        netAmountUsd *
        exchangeRate
      ).toFixed(2)
    );

    // =================================================
    // CREATE ORDER
    // =================================================

    const order =
      await prisma.order.create({
        data: {
          // Manual Order ID
          id: orderId,

          title,
          game,
          customer,

          description,
          characterName,
          battleTag,
          faction,
          serverName,
          vpnLocation,
          region,

          priceUsd,
          exchangeRate,

          platformFeePercent,
          extraPenaltyPercent,

          platformFeeUsd,
          extraPenaltyUsd,
          boosterAmountUsd,

          deductionUsd: finedUsd,

          boosterId,

          status: "PENDING",

          payment: {
            create: {
              orderPriceUsd:
                priceUsd,

              platformFeeUsd,
              extraPenaltyUsd,

              boosterAmountUsd,

              finedUsd,

              netAmountUsd,

              exchangeRate,

              amountEgp,

              status: "PENDING",

              completedAt: null,
              releaseAt: null,
              paidAt: null,

              ...(boosterId
                ? {
                    booster: {
                      connect: {
                        id: boosterId,
                      },
                    },
                  }
                : {}),
            },
          },
        },

        include: {
          booster: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          payment: true,
        },
      });

    return NextResponse.json(
      order,
      {
        status: 201,
      }
    );
  } catch (error) {
    // Handle duplicate IDs at database level
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "This Order ID already exists",
        },
        {
          status: 409,
        }
      );
    }

    console.error(
      "Create order error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create order",
      },
      {
        status: 500,
      }
    );
  }
}