import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
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

function serializeBooster(booster: any) {
  return {
    id: booster.id,
    name: booster.name,
    email: booster.email,
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
      booster.totalEarnedUsd ?? 0
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

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isCancelled(status: unknown) {
  return String(status ?? "")
    .toUpperCase()
    .includes("CANCEL");
}

function getOrderNetUsd(order: any) {
  const payment = order.payment;

  const boosterAmountUsd = toNumber(
    payment?.boosterAmountUsd ??
      order.boosterAmountUsd
  );

  const finedUsd = toNumber(
    payment?.finedUsd ??
      order.deductionUsd
  );

  const storedNetUsd = Number(
    payment?.netAmountUsd
  );

  return Number.isFinite(storedNetUsd)
    ? storedNetUsd
    : Math.max(
        0,
        boosterAmountUsd - finedUsd
      );
}

function serializeOrderDetail(order: any) {
  const payment = order.payment;

  const originalUsd = toNumber(
    payment?.orderPriceUsd ??
      order.priceUsd
  );

  const platformFeeUsd = toNumber(
    payment?.platformFeeUsd ??
      order.platformFeeUsd
  );

  const extraPenaltyUsd = toNumber(
    payment?.extraPenaltyUsd ??
      order.extraPenaltyUsd
  );

  const boosterAmountUsd = toNumber(
    payment?.boosterAmountUsd ??
      order.boosterAmountUsd
  );

  const finedUsd = toNumber(
    payment?.finedUsd ??
      order.deductionUsd
  );

  const netAmountUsd = getOrderNetUsd(order);

  const exchangeRate = toNumber(
    payment?.exchangeRate ??
      order.exchangeRate
  );

  // Historical conversion stored on the payment is preferred.
  // Fallbacks keep old orders visible even when amountEgp was not stored.
  const amountEgpStored = Number(
    payment?.amountEgp
  );
  const netAmountEgp = Number.isFinite(
    amountEgpStored
  )
    ? amountEgpStored
    : netAmountUsd * exchangeRate;

  const originalEgp =
    originalUsd * exchangeRate;

  const paidAmountUsd = toNumber(
    payment?.paidAmountUsd
  );

  const paidExchangeRate =
    payment?.paidExchangeRate != null
      ? toNumber(payment.paidExchangeRate)
      : null;

  const paidAmountEgp =
    payment?.paidAmountEgp != null
      ? toNumber(payment.paidAmountEgp)
      : paidAmountUsd > 0 && paidExchangeRate
      ? paidAmountUsd * paidExchangeRate
      : null;

  return {
    orderId: order.id,
    title: order.title,
    status: order.status,

    originalUsd: Number(
      originalUsd.toFixed(2)
    ),
    platformFeeUsd: Number(
      platformFeeUsd.toFixed(2)
    ),
    extraPenaltyUsd: Number(
      extraPenaltyUsd.toFixed(2)
    ),
    boosterAmountUsd: Number(
      boosterAmountUsd.toFixed(2)
    ),
    finedUsd: Number(
      finedUsd.toFixed(2)
    ),
    netAmountUsd: Number(
      netAmountUsd.toFixed(2)
    ),

    exchangeRate: Number(
      exchangeRate.toFixed(4)
    ),
    originalEgp: Number(
      originalEgp.toFixed(2)
    ),
    amountEgp: Number(
      netAmountEgp.toFixed(2)
    ),

    paidAmountUsd: Number(
      paidAmountUsd.toFixed(2)
    ),
    paidExchangeRate:
      paidExchangeRate !== null
        ? Number(
            paidExchangeRate.toFixed(4)
          )
        : null,
    paidAmountEgp:
      paidAmountEgp !== null
        ? Number(
            paidAmountEgp.toFixed(2)
          )
        : null,

    paymentStatus:
      payment?.status ?? "PENDING",
    completedAt:
      payment?.completedAt ??
      order.completedAt ??
      null,
    releaseAt:
      payment?.releaseAt ?? null,
    paidAt:
      payment?.paidAt ?? null,

    platformFeePercent: toNumber(
      order.platformFeePercent
    ),
    extraPenaltyPercent: toNumber(
      order.extraPenaltyPercent
    ),

    createdAt: order.createdAt,
  };
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

    await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        completedAt: {
          not: null,
        },
        releaseAt: {
          not: null,
          lte: new Date(),
        },
      },
      data: {
        status: "AVAILABLE",
      },
    });

    const now = new Date();

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
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const boosterIds = boosters.map(
      (booster) => booster.id
    );

    if (boosterIds.length === 0) {
      return NextResponse.json([]);
    }

    // Read all orders once. This becomes the source of truth for
    // lifetime earnings and the expandable booster order history.
    const orders = await prisma.order.findMany({
      where: {
        boosterId: {
          in: boosterIds,
        },
      },

      select: {
        id: true,
        title: true,
        boosterId: true,
        priceUsd: true,
        exchangeRate: true,

        platformFeePercent: true,
        extraPenaltyPercent: true,

        platformFeeUsd: true,
        extraPenaltyUsd: true,
        boosterAmountUsd: true,
        deductionUsd: true,

        status: true,
        createdAt: true,
        completedAt: true,

        payment: {
          select: {
            id: true,
            orderPriceUsd: true,
            platformFeeUsd: true,
            extraPenaltyUsd: true,
            boosterAmountUsd: true,
            finedUsd: true,
            netAmountUsd: true,
            exchangeRate: true,
            amountEgp: true,

            paidAmountUsd: true,
            paidExchangeRate: true,
            paidAmountEgp: true,

            status: true,
            completedAt: true,
            releaseAt: true,
            paidAt: true,
          },
        },
      },

      orderBy: [
        {
          completedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const payments = await prisma.payment.findMany({
      where: {
        boosterId: {
          in: boosterIds,
        },

        status: {
          in: [
            "PENDING",
            "AVAILABLE",
            "PAID",
          ],
        },
      },

      select: {
        id: true,
        boosterId: true,
        netAmountUsd: true,
        paidAmountUsd: true,
        paidAmountEgp: true,
        paidExchangeRate: true,
        status: true,
        completedAt: true,
        releaseAt: true,
        paidAt: true,
      },
    });

    // Historical payment transactions are the permanent source of truth
    // for EGP actually paid. Their exchange rate must never be replaced
    // by today's rate.
    const paymentTransactions =
      await prisma.boosterPaymentTransaction.findMany({
        where: {
          boosterId: {
            in: boosterIds,
          },
        },
        select: {
          id: true,
          boosterId: true,
          amountUsd: true,
          exchangeRate: true,
          amountEgp: true,
          allocations: {
            select: {
              paymentId: true,
              amountUsd: true,
            },
          },
        },
        orderBy: {
          paidAt: "desc",
        },
      });

    const fines = await prisma.deduction.findMany({
      where: {
        userId: {
          in: boosterIds,
        },
        remainingUsd: {
          gt: 0,
        },
      },

      select: {
        userId: true,
        remainingUsd: true,
      },
    });

    const orderMap = new Map<string, any[]>();
    const paymentMap = new Map<string, any[]>();
    const transactionMap = new Map<string, any[]>();
    const fineMap = new Map<string, number>();

    for (const order of orders) {
      if (!order.boosterId) continue;

      const list =
        orderMap.get(order.boosterId) ?? [];

      list.push(order);
      orderMap.set(order.boosterId, list);
    }

    for (const payment of payments) {
      if (!payment.boosterId) continue;

      const list =
        paymentMap.get(payment.boosterId) ?? [];

      list.push(payment);
      paymentMap.set(payment.boosterId, list);
    }

    for (const transaction of paymentTransactions) {
      if (!transaction.boosterId) continue;

      const list =
        transactionMap.get(transaction.boosterId) ?? [];

      list.push(transaction);
      transactionMap.set(transaction.boosterId, list);
    }

    for (const fine of fines) {
      if (!fine.userId) continue;

      fineMap.set(
        fine.userId,
        (fineMap.get(fine.userId) ?? 0) +
          toNumber(fine.remainingUsd)
      );
    }

    return NextResponse.json(
      boosters.map((booster) => {
        const boosterOrders =
          orderMap.get(booster.id) ?? [];

        const boosterPayments =
          paymentMap.get(booster.id) ?? [];

        // -------------------------------------------------
        // Lifetime earned
        // -------------------------------------------------
        // Sum the actual net amount for completed, non-cancelled
        // orders instead of trusting User.totalEarnedUsd.
        const completedOrderDetails =
          boosterOrders
            .filter(
              (order) =>
                !isCancelled(order.status) &&
                String(order.status ?? "")
                  .toUpperCase() ===
                  "COMPLETED"
            )
            .map(serializeOrderDetail);

        const totalEarnedUsd =
          completedOrderDetails.reduce(
            (sum, detail) =>
              sum + detail.netAmountUsd,
            0
          );

        // Gross revenue across all non-cancelled orders.
        const totalGrossUsd =
          boosterOrders.reduce(
            (sum, order) => {
              if (isCancelled(order.status)) {
                return sum;
              }

              return (
                sum +
                toNumber(
                  order.payment?.orderPriceUsd ??
                    order.priceUsd
                )
              );
            },
            0
          );

        // -------------------------------------------------
        // Balance / hold: same payment source of truth as
        // Payments page.
        // -------------------------------------------------
        const availablePayments =
          boosterPayments.filter(
            (payment) =>
              String(payment.status)
                .toUpperCase() ===
              "AVAILABLE"
          );

        const holdPayments =
          boosterPayments.filter((payment) => {
            const status = String(
              payment.status ?? ""
            ).toUpperCase();

            return (
              status === "PENDING" &&
              payment.releaseAt &&
              new Date(payment.releaseAt) > now
            );
          });

        const availableUsd =
          availablePayments.reduce(
            (sum, payment) =>
              sum +
              Math.max(
                0,
                toNumber(payment.netAmountUsd) -
                  toNumber(payment.paidAmountUsd)
              ),
            0
          );

        const onHoldUsd =
          holdPayments.reduce(
            (sum, payment) =>
              sum +
              Math.max(
                0,
                toNumber(payment.netAmountUsd) -
                  toNumber(payment.paidAmountUsd)
              ),
            0
          );

        const outstandingFines =
          fineMap.get(booster.id) ?? 0;

        const balanceUsd =
          Number(
            (
              availableUsd -
              outstandingFines
            ).toFixed(2)
          );

        const boosterTransactions =
          transactionMap.get(booster.id) ?? [];

        let paidUsd = 0;
        let paidEgp = 0;

        for (const transaction of boosterTransactions) {
          paidUsd += toNumber(transaction.amountUsd);
          paidEgp += toNumber(transaction.amountEgp);
        }

        // Backward compatibility for payments created before the
        // transaction history existed. Only use a payment record as a
        // fallback when no transaction allocation covers that payment.
        const allocatedPaymentIds = new Set<string>();

        for (const transaction of boosterTransactions) {
          for (const allocation of transaction.allocations ?? []) {
            allocatedPaymentIds.add(String(allocation.paymentId));
          }
        }

        for (const payment of boosterPayments) {
          if (allocatedPaymentIds.has(String(payment.id))) {
            continue;
          }

          const legacyPaidUsd = toNumber(payment.paidAmountUsd);

          if (legacyPaidUsd <= 0) {
            continue;
          }

          paidUsd += legacyPaidUsd;

          const legacyPaidEgp = toNumber(payment.paidAmountEgp);
          const legacyRate = toNumber(payment.paidExchangeRate);

          paidEgp +=
            legacyPaidEgp > 0
              ? legacyPaidEgp
              : legacyRate > 0
              ? legacyPaidUsd * legacyRate
              : 0;
        }

        const effectivePaidRate =
          paidUsd > 0 && paidEgp > 0
            ? paidEgp / paidUsd
            : null;

        const orderDetails =
          boosterOrders
            .filter(
              (order) =>
                !isCancelled(order.status)
            )
            .map(serializeOrderDetail);

        return {
          id: booster.id,
          name: booster.name,
          email: booster.email,
          profileImageUrl:
            booster.profileImageUrl ?? null,
          active: booster.active,
          createdAt: booster.createdAt,

          platformFeePercent: toNumber(
            booster.platformFeePercent,
            7
          ),
          extraPenaltyPercent: toNumber(
            booster.extraPenaltyPercent
          ),

          balanceUsd,
          totalEarnedUsd: Number(
            totalEarnedUsd.toFixed(2)
          ),
          totalPaidUsd: Number(
            paidUsd.toFixed(2)
          ),
          totalPaidEgp: Number(
            paidEgp.toFixed(2)
          ),
          paidExchangeRate:
            effectivePaidRate !== null
              ? Number(effectivePaidRate.toFixed(4))
              : null,

          totalGrossUsd: Number(
            totalGrossUsd.toFixed(2)
          ),
          onHoldUsd: Number(
            onHoldUsd.toFixed(2)
          ),
          finedUsd: Number(
            outstandingFines.toFixed(2)
          ),

          ordersCount:
            booster._count?.orders ??
            boosterOrders.length,
          paymentsCount:
            booster._count?.payments ??
            boosterPayments.length,

          details: orderDetails,
        };
      })
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