import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { notifyBooster } from "@/lib/notifications";

type PaymentMethodValue = "VODAFONE_CASH" | "INSTAPAY";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("session")?.value;

  if (!token) return null;

  const session = await verifySession(token);

  if (!session || session.role !== "ADMIN") {
    return null;
  }

  return session;
}

async function getSettings() {
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

function getCurrentMonth() {
  const now = new Date();

  return `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) {
    throw new Error("Invalid month");
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error("Invalid month");
  }

  return {
    start: new Date(
      Date.UTC(year, monthNumber - 1, 1)
    ),
    end: new Date(
      Date.UTC(year, monthNumber, 1)
    ),
  };
}

function normalizePaymentMethod(
  value: unknown
): PaymentMethodValue | null {
  const method = String(value || "")
    .trim()
    .toUpperCase();

  if (method === "VODAFONE_CASH") {
    return "VODAFONE_CASH";
  }

  if (method === "INSTAPAY") {
    return "INSTAPAY";
  }

  return null;
}

function formatPaymentMethod(
  value: PaymentMethodValue
) {
  return value === "VODAFONE_CASH"
    ? "Vodafone Cash"
    : "InstaPay";
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

async function refreshAvailablePayments() {
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
}

async function sendTelegramPaymentNotification({
  boosterName,
  amountUsd,
  exchangeRate,
  amountEgp,
  paymentMethod,
  paymentNumber,
}: {
  boosterName: string;
  amountUsd: number;
  exchangeRate: number;
  amountEgp: number;
  paymentMethod: PaymentMethodValue;
  paymentNumber: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn(
      "TELEGRAM_BOT_TOKEN is not configured."
    );

    return;
  }

  const message = [
    "💰 Booster Payment",
    "",
    `Booster: ${boosterName}`,
    "",
    `USD Withdrawn: $${amountUsd.toFixed(2)}`,
    `Exchange Rate: ${exchangeRate.toFixed(4)} EGP`,
    "",
    `Paid in EGP: ${amountEgp.toFixed(2)} EGP`,
    "",
    `Payment Method: ${formatPaymentMethod(
      paymentMethod
    )}`,
    `Payment Number: ${paymentNumber}`,
    "",
    "Status: PAID ✅",
  ].join("\n");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_PAYMENT_CHAT_ID,
          text: message,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();

      console.error(
        "Telegram payment notification failed:",
        text
      );
    }
  } catch (error) {
    console.error(
      "Telegram payment notification error:",
      error
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const settings = await getSettings();

    const { searchParams } = new URL(
      request.url
    );

    const month =
      searchParams.get("month") ||
      getCurrentMonth();

    let range;

    try {
      range = getMonthRange(month);
    } catch {
      return NextResponse.json(
        {
          error: "Invalid month. Use YYYY-MM.",
        },
        { status: 400 }
      );
    }

    await refreshAvailablePayments();

    const now = new Date();

    const [
      boosters,
      orders,
      fines,
      payments,
    ] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "BOOSTER",
        },

        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          profileImageUrl: true,
          paymentMethod: true,
          paymentNumber: true,
        },

        orderBy: {
          name: "asc",
        },
      }),

      prisma.order.findMany({
        where: {
          boosterId: {
            not: null,
          },

          OR: [
            {
              status: "COMPLETED",
              completedAt: {
                gte: range.start,
                lt: range.end,
              },
            },

            {
              status: "CANCELLED",
              createdAt: {
                gte: range.start,
                lt: range.end,
              },
            },
          ],
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
      }),

      prisma.deduction.findMany({
        where: {
          userId: {
            not: null,
          },

          remainingUsd: {
            gt: 0,
          },
        },

        select: {
          id: true,
          userId: true,
          reason: true,
          amountUsd: true,
          remainingUsd: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.payment.findMany({
        where: {
          boosterId: {
            not: null,
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
          status: true,
          completedAt: true,
          releaseAt: true,
          paidAt: true,
        },
      }),
    ]);

    const orderMap = new Map<
      string,
      typeof orders
    >();

    const fineMap = new Map<
      string,
      typeof fines
    >();

    const paymentMap = new Map<
      string,
      typeof payments
    >();

    for (const order of orders) {
      if (!order.boosterId) continue;

      const list =
        orderMap.get(order.boosterId) || [];

      list.push(order);

      orderMap.set(
        order.boosterId,
        list
      );
    }

    for (const fine of fines) {
      if (!fine.userId) continue;

      const list =
        fineMap.get(fine.userId) || [];

      list.push(fine);

      fineMap.set(
        fine.userId,
        list
      );
    }

    for (const payment of payments) {
      if (!payment.boosterId) continue;

      const list =
        paymentMap.get(payment.boosterId) ||
        [];

      list.push(payment);

      paymentMap.set(
        payment.boosterId,
        list
      );
    }

    const result = boosters.map((booster) => {
      const boosterOrders =
        orderMap.get(booster.id) || [];

      const boosterFines =
        fineMap.get(booster.id) || [];

      const boosterPayments =
        paymentMap.get(booster.id) || [];

      const completedOrders =
        boosterOrders.filter(
          (order) =>
            order.status === "COMPLETED"
        );

      const grossUsd =
        completedOrders.reduce(
          (sum, order) =>
            sum + Number(order.priceUsd),
          0
        );

      const platformFeeUsd =
        completedOrders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.payment
                ?.platformFeeUsd ??
                order.platformFeeUsd ??
                0
            ),
          0
        );

      const extraPenaltyUsd =
        completedOrders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.payment
                ?.extraPenaltyUsd ??
                order.extraPenaltyUsd ??
                0
            ),
          0
        );

      const boosterAmountUsd =
        completedOrders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.payment
                ?.boosterAmountUsd ??
                order.boosterAmountUsd ??
                0
            ),
          0
        );

      const monthFines =
        boosterFines.filter(
          (fine) =>
            fine.createdAt >= range.start &&
            fine.createdAt < range.end
        );

      const finedUsd =
        monthFines.reduce(
          (sum, fine) =>
            sum +
            Number(fine.amountUsd),
          0
        );

      const outstandingFines =
        boosterFines.reduce(
          (sum, fine) =>
            sum +
            Number(fine.remainingUsd),
          0
        );

      const availablePayments =
        boosterPayments.filter(
          (payment) =>
            payment.status === "AVAILABLE"
        );

      const holdPayments =
        boosterPayments.filter(
          (payment) =>
            payment.status === "PENDING" &&
            payment.releaseAt &&
            new Date(
              payment.releaseAt
            ) > now
        );

      const availableUsd =
        availablePayments.reduce(
          (sum, payment) =>
            sum +
            Math.max(
              0,
              Number(payment.netAmountUsd) -
                Number(
                  payment.paidAmountUsd ?? 0
                )
            ),
          0
        );

      const onHoldUsd =
        holdPayments.reduce(
          (sum, payment) =>
            sum +
            Math.max(
              0,
              Number(payment.netAmountUsd) -
                Number(
                  payment.paidAmountUsd ?? 0
                )
            ),
          0
        );

      const paidUsd =
        boosterPayments
          .filter(
            (payment) =>
              Number(
                payment.paidAmountUsd ?? 0
              ) > 0 &&
              payment.paidAt &&
              new Date(payment.paidAt) >=
                range.start &&
              new Date(payment.paidAt) <
                range.end
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(
                payment.paidAmountUsd ?? 0
              ),
            0
          );

      const balanceUsd = Number(
        (
          availableUsd -
          outstandingFines
        ).toFixed(2)
      );

      const expectedPayableUsd =
        Number(
          (
            availableUsd +
            onHoldUsd -
            outstandingFines
          ).toFixed(2)
        );

      const totalEarnedAfterFeesAndFines =
        Number(
          (
            boosterAmountUsd -
            extraPenaltyUsd -
            outstandingFines
          ).toFixed(2)
        );

      let status = "NO BALANCE";

      if (balanceUsd < 0) {
        status = "OWES MONEY";
      } else if (
        balanceUsd > 0 &&
        onHoldUsd > 0
      ) {
        status =
          "AVAILABLE + ON HOLD";
      } else if (balanceUsd > 0) {
        status = "AVAILABLE";
      } else if (onHoldUsd > 0) {
        status = "ON HOLD";
      } else if (paidUsd > 0) {
        status = "PAID";
      }

      const details =
        boosterOrders.map((order) => ({
          orderId: order.id,
          title: order.title,

          originalUsd:
            Number(order.priceUsd),

          platformFeeUsd:
            Number(
              order.payment
                ?.platformFeeUsd ??
                order.platformFeeUsd ??
                0
            ),

          extraPenaltyUsd:
            Number(
              order.payment
                ?.extraPenaltyUsd ??
                order.extraPenaltyUsd ??
                0
            ),

          boosterAmountUsd:
            Number(
              order.payment
                ?.boosterAmountUsd ??
                order.boosterAmountUsd ??
                0
            ),

          finedUsd:
            Number(
              order.payment?.finedUsd ??
              order.deductionUsd ??
              0
            ),

          netAmountUsd:
            Number(
              order.payment
                ?.netAmountUsd ??
                0
            ),

          exchangeRate:
            Number(
              order.payment?.exchangeRate ??
              order.exchangeRate
            ),

          amountEgp:
            Number(
              order.payment?.amountEgp ??
              0
            ),

          paidAmountUsd:
            Number(
              order.payment
                ?.paidAmountUsd ??
              0
            ),

          paidExchangeRate:
            order.payment
              ?.paidExchangeRate != null
              ? Number(
                  order.payment
                    .paidExchangeRate
                )
              : null,

          paidAmountEgp:
            order.payment
              ?.paidAmountEgp != null
              ? Number(
                  order.payment
                    .paidAmountEgp
                )
              : null,

          paymentStatus:
            order.payment?.status ??
            "PENDING",

          orderStatus:
            order.status,

          createdAt:
            order.createdAt,

          completedAt:
            order.payment
              ?.completedAt ??
            order.completedAt,

          releaseAt:
            order.payment
              ?.releaseAt ??
            null,

          paidAt:
            order.payment?.paidAt ??
            null,

          platformFeePercent:
            Number(
              order.platformFeePercent ??
              settings.platformFeePercent
            ),

          extraPenaltyPercent:
            Number(
              order.extraPenaltyPercent ??
              0
            ),
        }));

      return {
        id: booster.id,
        name: booster.name,
        email: booster.email,
        active: booster.active,
        profileImageUrl:
          booster.profileImageUrl,

        paymentMethod:
          booster.paymentMethod,
        paymentNumber:
          booster.paymentNumber,

        orders:
          boosterOrders.length,

        grossUsd,

        platformFeeUsd,

        boosterAmountUsd,

        totalEarnedAfterFeesAndFines,

        expectedPayableUsd,

        balanceUsd,

        onHoldUsd,

        finedUsd,

        paidUsd,

        status,

        fines:
          monthFines.map((fine) => ({
            id: fine.id,
            reason: fine.reason,
            amountUsd:
              Number(fine.amountUsd),
            remainingUsd:
              Number(
                fine.remainingUsd
              ),
            createdAt:
              fine.createdAt,
          })),

        details,
      };
    });

    const totals = result.reduce(
      (sum, item) => ({
        boosters:
          sum.boosters + 1,

        orders:
          sum.orders + item.orders,

        grossUsd:
          sum.grossUsd +
          item.grossUsd,

        platformFeeUsd:
          sum.platformFeeUsd +
          item.platformFeeUsd,

        boosterAmountUsd:
          sum.boosterAmountUsd +
          item.boosterAmountUsd,

        balanceUsd:
          sum.balanceUsd +
          item.balanceUsd,

        onHoldUsd:
          sum.onHoldUsd +
          item.onHoldUsd,

        finedUsd:
          sum.finedUsd +
          item.finedUsd,

        paidUsd:
          sum.paidUsd +
          item.paidUsd,
      }),
      {
        boosters: 0,
        orders: 0,
        grossUsd: 0,
        platformFeeUsd: 0,
        boosterAmountUsd: 0,
        balanceUsd: 0,
        onHoldUsd: 0,
        finedUsd: 0,
        paidUsd: 0,
      }
    );

    return NextResponse.json({
      month,
      holdDays: settings.holdDays,
      payments: result,
      totals,
    });
  } catch (error) {
    console.error(
      "Get payments error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load payments",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json(
        {
          error:
            "Admin access required",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const action = String(
      body.action || ""
    ).trim();

    const boosterId = String(
      body.boosterId || ""
    ).trim();

    const month = String(
      body.month || getCurrentMonth()
    ).trim();

    if (action === "undoLastPayment") {
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

      const lastTransaction =
        await prisma.boosterPaymentTransaction.findFirst(
          {
            where: {
              boosterId,
            },

            orderBy: {
              paidAt: "desc",
            },

            include: {
              allocations: {
                select: {
                  paymentId: true,
                  amountUsd: true,
                },
              },
            },
          }
        );

      if (!lastTransaction) {
        return NextResponse.json(
          {
            error:
              "No payment to undo",
          },
          {
            status: 400,
          }
        );
      }

      const reversedUsd =
        round2(
          Number(
            lastTransaction.amountUsd
          )
        );

      await prisma.$transaction(
        async (tx) => {
          for (const allocation of
            lastTransaction.allocations) {
            const payment =
              await tx.payment.findUnique({
                where: {
                  id: allocation.paymentId,
                },
              });

            if (!payment) {
              continue;
            }

            const currentPaidUsd =
              Number(
                payment.paidAmountUsd ?? 0
              );

            const currentPaidEgp =
              Number(
                payment.paidAmountEgp ?? 0
              );

            const undoUsd =
              Number(
                allocation.amountUsd
              );

            const newPaidUsd =
              round2(
                Math.max(
                  0,
                  currentPaidUsd -
                    undoUsd
                )
              );

            const transactionPaidEgp =
              round2(
                undoUsd *
                  Number(
                    lastTransaction.exchangeRate
                  )
              );

            const newPaidEgp =
              round2(
                Math.max(
                  0,
                  currentPaidEgp -
                    transactionPaidEgp
                )
              );

            const shouldBeAvailable =
              payment.completedAt &&
              payment.releaseAt &&
              payment.releaseAt <=
                new Date();

            await tx.payment.update({
              where: {
                id: payment.id,
              },

              data: {
                status:
                  newPaidUsd >=
                  Number(
                    payment.netAmountUsd
                  )
                    ? "PAID"
                    : shouldBeAvailable
                    ? "AVAILABLE"
                    : "PENDING",

                paidAmountUsd:
                  newPaidUsd > 0
                    ? newPaidUsd
                    : null,

                paidAmountEgp:
                  newPaidEgp > 0
                    ? newPaidEgp
                    : null,

                paidExchangeRate:
                  newPaidUsd > 0
                    ? lastTransaction.exchangeRate
                    : null,

                paidAt:
                  newPaidUsd > 0
                    ? lastTransaction.paidAt
                    : null,
              },
            });
          }

          await tx.paymentTransactionAllocation.deleteMany(
            {
              where: {
                transactionId:
                  lastTransaction.id,
              },
            }
          );

          await tx.boosterPaymentTransaction.delete(
            {
              where: {
                id: lastTransaction.id,
              },
            }
          );

          await tx.user.update({
            where: {
              id: boosterId,
            },

            data: {
              totalPaidUsd: {
                decrement:
                  reversedUsd,
              },

              balanceUsd: {
                increment:
                  reversedUsd,
              },
            },
          });
        }
      );

      return NextResponse.json({
        success: true,
        reversedUsd,
      });
    }

    const exchangeRate = Number(
      body.exchangeRate
    );

    const paymentMethod =
      normalizePaymentMethod(
        body.paymentMethod
      );

    const paymentNumber = String(
      body.paymentNumber || ""
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

    if (
      !Number.isFinite(exchangeRate) ||
      exchangeRate <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment exchange rate",
        },
        {
          status: 400,
        }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          error:
            "Payment method is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!paymentNumber) {
      return NextResponse.json(
        {
          error:
            "Payment number is required",
        },
        {
          status: 400,
        }
      );
    }

    let range;

    try {
      range =
        getMonthRange(month);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid month. Use YYYY-MM.",
        },
        {
          status: 400,
        }
      );
    }

    await refreshAvailablePayments();

    const [
      booster,
      payablePayments,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: boosterId,
        },

        select: {
          id: true,
          name: true,
          role: true,
        },
      }),

      prisma.payment.findMany({
        where: {
          boosterId,

          status: {
            in: [
              "PENDING",
              "AVAILABLE",
            ],
          },

          order: {
            status: "COMPLETED",

            completedAt: {
              gte: range.start,
              lt: range.end,
            },
          },
        },

        select: {
          id: true,
          netAmountUsd: true,
          paidAmountUsd: true,
          paidAmountEgp: true,
          status: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    if (!booster || booster.role !== "BOOSTER") {
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

    if (!payablePayments.length) {
      return NextResponse.json(
        {
          error:
            "No payable balance to pay",
        },
        {
          status: 400,
        }
      );
    }

    const totalAvailable =
      round2(
        payablePayments.reduce(
          (sum, payment) =>
            sum +
            Math.max(
              0,
              Number(
                payment.netAmountUsd
              ) -
                Number(
                  payment.paidAmountUsd ??
                    0
                )
            ),
          0
        )
      );

    const fines =
      await prisma.deduction.findMany({
        where: {
          userId: boosterId,

          remainingUsd: {
            gt: 0,
          },
        },

        select: {
          id: true,
          remainingUsd: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    const totalFines =
      round2(
        fines.reduce(
          (sum, fine) =>
            sum +
            Number(
              fine.remainingUsd
            ),
          0
        )
      );

    const maximumPayableUsd =
      round2(
        Math.max(
          0,
          totalAvailable -
            totalFines
        )
      );

    const requestedAmount =
      body.amountUsd === undefined
        ? maximumPayableUsd
        : Number(body.amountUsd);

    if (
      !Number.isFinite(
        requestedAmount
      ) ||
      requestedAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment amount",
        },
        {
          status: 400,
        }
      );
    }

    const payableUsd =
      round2(
        Math.min(
          requestedAmount,
          maximumPayableUsd
        )
      );

    if (payableUsd <= 0) {
      return NextResponse.json(
        {
          error:
            "No payable balance after fines",
        },
        {
          status: 400,
        }
      );
    }

    const fineUsed = round2(
      Math.min(
        totalFines,
        Math.max(
          0,
          totalAvailable -
            payableUsd
        )
      )
    );

    const paymentUpdates: {
      id: string;
      paidUsd: number;
      remainingUsd: number;
      status:
        | "PENDING"
        | "AVAILABLE";
      existingPaidUsd: number;
      existingPaidEgp: number;
    }[] = [];

    let remainingToAllocate =
      round2(
        payableUsd +
          fineUsed
      );

    for (const payment of
      payablePayments) {
      if (remainingToAllocate <= 0) {
        break;
      }

      const amount =
        Math.max(
          0,
          Number(
            payment.netAmountUsd
          ) -
            Number(
              payment.paidAmountUsd ??
                0
            )
        );

      const paidUsd =
        Math.min(
          amount,
          remainingToAllocate
        );

      if (paidUsd <= 0) {
        continue;
      }

      paymentUpdates.push({
        id: payment.id,

        paidUsd:
          round2(paidUsd),

        remainingUsd:
          round2(amount),

        status:
          payment.status ===
          "AVAILABLE"
            ? "AVAILABLE"
            : "PENDING",

        existingPaidUsd:
          Number(
            payment.paidAmountUsd ??
              0
          ),

        existingPaidEgp:
          Number(
            payment.paidAmountEgp ??
              0
          ),
      });

      remainingToAllocate =
        round2(
          remainingToAllocate -
            paidUsd
        );
    }

    if (remainingToAllocate > 0) {
      return NextResponse.json(
        {
          error:
            "Unable to allocate the full payment amount",
        },
        {
          status: 400,
        }
      );
    }

    const paidAt = new Date();

    const paidEgp = round2(
      payableUsd *
        exchangeRate
    );

    await prisma.$transaction(
      async (tx) => {
        const transaction =
          await tx.boosterPaymentTransaction.create(
            {
              data: {
                boosterId,

                month,

                amountUsd:
                  payableUsd,

                exchangeRate,

                amountEgp:
                  paidEgp,

                paymentMethod,

                paymentNumber,

                paidAt,
              },
            }
          );

        for (const payment of
          paymentUpdates) {
          const newPaidUsd =
            round2(
              payment.existingPaidUsd +
                payment.paidUsd
            );

          const newPaidEgp =
            round2(
              payment.existingPaidEgp +
                payment.paidUsd *
                  exchangeRate
            );

          await tx.payment.update({
            where: {
              id: payment.id,
            },

            data: {
              status:
                newPaidUsd >=
                payment.remainingUsd +
                  payment.existingPaidUsd
                  ? "PAID"
                  : payment.status,

              paidAmountUsd:
                newPaidUsd,

              paidExchangeRate:
                exchangeRate,

              paidAmountEgp:
                newPaidEgp,

              paidAt,
            },
          });

          await tx.paymentTransactionAllocation.create(
            {
              data: {
                transactionId:
                  transaction.id,

                paymentId:
                  payment.id,

                amountUsd:
                  payment.paidUsd,
              },
            }
          );
        }

        let remainingFine =
          fineUsed;

        for (const fine of fines) {
          if (
            remainingFine <= 0
          ) {
            break;
          }

          const current =
            Number(
              fine.remainingUsd
            );

          const used =
            Math.min(
              current,
              remainingFine
            );

          await tx.deduction.update({
            where: {
              id: fine.id,
            },

            data: {
              remainingUsd:
                round2(
                  current - used
                ),
            },
          });

          remainingFine =
            round2(
              remainingFine - used
            );
        }

        await tx.user.update({
          where: {
            id: boosterId,
          },

          data: {
            totalPaidUsd: {
              increment:
                payableUsd,
            },

            balanceUsd: {
              decrement:
                payableUsd,
            },
          },
        });
      }
    );

    try {
      await notifyBooster({
        boosterId,

        type: "PAYMENT_SENT",

        title:
          "Payment sent",

        message: [
          `A payment of $${payableUsd.toFixed(
            2
          )} was sent to you.`,
          `Exchange rate: ${exchangeRate.toFixed(
            4
          )} EGP`,
          `Paid in EGP: ${paidEgp.toFixed(
            2
          )} EGP`,
          `Payment method: ${formatPaymentMethod(
            paymentMethod
          )}`,
          `Payment number: ${paymentNumber}`,
        ].join("\n"),
      });
    } catch (error) {
      console.error(
        "Booster notification error:",
        error
      );
    }

    await sendTelegramPaymentNotification({
      boosterName:
        booster.name,

      amountUsd:
        payableUsd,

      exchangeRate,

      amountEgp:
        paidEgp,

      paymentMethod,

      paymentNumber,
    });

    return NextResponse.json({
      success: true,

      boosterId,

      month,

      availableUsd:
        totalAvailable,

      finesUsd:
        totalFines,

      fineUsed,

      paidUsd:
        payableUsd,

      paidEgp,

      exchangeRate,

      paymentMethod,

      paymentNumber,

      paymentsCount:
        paymentUpdates.length,

      paidAt,
    });
  } catch (error) {
    console.error(
      "Pay booster error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to pay booster",
      },
      {
        status: 500,
      }
    );
  }
}