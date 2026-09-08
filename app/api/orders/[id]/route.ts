import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { notifyBooster } from "@/lib/notifications";

const ALLOWED_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

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
    throw new Error(
      "Exchange rate API failed"
    );
  }

  const data = await response.json();

  const rate = Number(
    data?.rates?.EGP
  );

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(
      "Invalid exchange rate"
    );
  }

  return rate;
}

function isAllowedStatus(
  value: unknown
): value is AllowedStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(
      value as AllowedStatus
    )
  );
}

// =====================================================
// UPDATE ORDER
// =====================================================

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  }
) {
  try {
    // =================================================
    // AUTH
    // =================================================

    const session =
      await requireAdmin(request);

    if (!session) {
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

    // =================================================
    // SETTINGS
    // =================================================

    const settings =
      await getBusinessSettings();

    const defaultPlatformFeePercent =
      Number(
        settings.platformFeePercent
      );

    const holdDays =
      settings.holdDays;

    // =================================================
    // BODY
    // =================================================

    const body =
      await request.json();

    const action = String(
      body.action || ""
    ).trim();

    // =================================================
    // FIND ORDER
    // =================================================

    const order =
      await prisma.order.findUnique({
        where: {
          id: params.id,
        },
        include: {
          payment: true,
        },
      });

    if (!order) {
      return NextResponse.json(
        {
          error: "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    if (action === "updatePrice") {
      if (order.payment?.status === "PAID") {
        return NextResponse.json(
          {
            error:
              "Paid orders cannot have their price changed.",
          },
          {
            status: 409,
          }
        );
      }

      const priceUsd = Number(body.priceUsd);

      if (
        !Number.isFinite(priceUsd) ||
        priceUsd <= 0
      ) {
        return NextResponse.json(
          {
            error: "Invalid order price",
          },
          {
            status: 400,
          }
        );
      }

      const feePercent =
        Number(order.platformFeePercent || 0);

      const penaltyPercent =
        Number(
          order.extraPenaltyPercent || 0
        );

      const platformFee =
        priceUsd *
        (feePercent / 100);

      const extraPenalty =
        priceUsd *
        (penaltyPercent / 100);

      const boosterAmount =
        priceUsd -
        platformFee -
        extraPenalty;

      if (boosterAmount < 0) {
        return NextResponse.json(
          {
            error:
              "Price is too low for the current fee settings",
          },
          {
            status: 400,
          }
        );
      }

      const exchangeRate =
        Number(order.exchangeRate || 0);

      const amountEgp =
        boosterAmount * exchangeRate;

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const updatedOrder =
              await tx.order.update({
                where: {
                  id: params.id,
                },

                data: {
                  priceUsd,

                  platformFeeUsd:
                    platformFee,

                  extraPenaltyUsd:
                    extraPenalty,

                  boosterAmountUsd:
                    boosterAmount,
                },
              });

            if (order.payment) {
              await tx.payment.update({
                where: {
                  id: order.payment.id,
                },

                data: {
                  orderPriceUsd:
                    priceUsd,

                  platformFeeUsd:
                    platformFee,

                  extraPenaltyUsd:
                    extraPenalty,

                  boosterAmountUsd:
                    boosterAmount,

                  netAmountUsd:
                    boosterAmount -
                    Number(
                      order.payment.finedUsd || 0
                    ),

                  amountEgp,
                  exchangeRate,
                },
              });
            }

            return updatedOrder;
          }
        );

      return NextResponse.json({
        success: true,
        order: updated,
      });
    }

    // =================================================
    // STATUS
    // =================================================

    let status: AllowedStatus =
      order.status as AllowedStatus;

    if (
      body.status !== undefined
    ) {
      if (
        !isAllowedStatus(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid order status",
          },
          {
            status: 400,
          }
        );
      }

      status = body.status;
    }

    // =================================================
    // ORDER DATA
    // =================================================

    const title =
      body.title !== undefined
        ? String(
            body.title
          ).trim()
        : order.title;

    const game =
      body.game !== undefined
        ? String(
            body.game
          ).trim() ||
          "World of Warcraft"
        : order.game;

    const customer =
      body.customer !== undefined
        ? String(
            body.customer
          ).trim() || null
        : order.customer;

    const description =
      body.description !== undefined
        ? String(
            body.description
          ).trim() || null
        : order.description;

    const characterName =
      body.characterName !==
      undefined
        ? String(
            body.characterName
          ).trim() || null
        : order.characterName;

    const battleTag =
      body.battleTag !== undefined
        ? String(
            body.battleTag
          ).trim() || null
        : order.battleTag;

    const faction =
      body.faction !== undefined
        ? String(
            body.faction
          ).trim() || null
        : order.faction;

    const serverName =
      body.serverName !== undefined
        ? String(
            body.serverName
          ).trim() || null
        : order.serverName;

    const vpnLocation =
      body.vpnLocation !==
      undefined
        ? String(
            body.vpnLocation
          ).trim() || null
        : order.vpnLocation;

    const region =
      body.region !== undefined
        ? String(
            body.region
          ).trim() || null
        : order.region;

    const priceUsd =
      body.priceUsd !== undefined
        ? Number(
            body.priceUsd
          )
        : Number(order.priceUsd);

    // =================================================
    // BOOSTER
    // =================================================

    let boosterId =
      order.boosterId;

    if (
      body.boosterId !==
      undefined
    ) {
      boosterId = body.boosterId
        ? String(
            body.boosterId
          ).trim()
        : null;
    }

    let booster = null;

    if (boosterId) {
      booster =
        await prisma.user.findFirst({
          where: {
            id: boosterId,
            role: "BOOSTER",
            active: true,
          },
          select: {
            id: true,
            platformFeePercent: true,
            extraPenaltyPercent: true,
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
    // VALIDATION
    // =================================================

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
      !Number.isFinite(
        priceUsd
      ) ||
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
    // ORDER FEE PERCENT
    // =================================================

    let platformFeePercent =
      Number(
        order.platformFeePercent
      );

    let extraPenaltyPercent =
      Number(
        order.extraPenaltyPercent
      );

    // If old order does not have valid
    // saved values, use the current defaults.

    if (
      !Number.isFinite(
        platformFeePercent
      )
    ) {
      platformFeePercent =
        booster
          ? Number(
              booster.platformFeePercent
            )
          : defaultPlatformFeePercent;
    }

    if (
      !Number.isFinite(
        extraPenaltyPercent
      )
    ) {
      extraPenaltyPercent =
        booster
          ? Number(
              booster.extraPenaltyPercent
            )
          : 0;
    }

    // Allow explicit values when updating.

    if (
      body.platformFeePercent !==
      undefined
    ) {
      platformFeePercent =
        Number(
          body.platformFeePercent
        );
    }

    if (
      body.extraPenaltyPercent !==
      undefined
    ) {
      extraPenaltyPercent =
        Number(
          body.extraPenaltyPercent
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
    // EXCHANGE RATE
    // =================================================

    const priceChanged =
      body.priceUsd !==
        undefined &&
      priceUsd !==
        Number(order.priceUsd);

    const exchangeRate =
      priceChanged
        ? await getLiveExchangeRate()
        : Number(order.exchangeRate);

    // =================================================
    // CALCULATIONS
    // =================================================

    const platformFeeUsd =
      Number(
        (
          priceUsd *
          (platformFeePercent /
            100)
        ).toFixed(2)
      );

    const extraPenaltyUsd =
      Number(
        (
          priceUsd *
          (extraPenaltyPercent /
            100)
        ).toFixed(2)
      );

    const boosterAmountUsd =
      Number(
        (
          priceUsd -
          platformFeeUsd -
          extraPenaltyUsd
        ).toFixed(2)
      );

    // =================================================
    // FINED
    // =================================================

    let finedUsd = 0;

    if (
      body.finedUsd !==
      undefined
    ) {
      finedUsd = Number(
        body.finedUsd
      );
    } else if (
      order.payment
    ) {
      finedUsd = Number(
        order.payment.finedUsd
      );
    } else {
      finedUsd = Number(
        order.deductionUsd
      );
    }

    if (
      !Number.isFinite(
        finedUsd
      ) ||
      finedUsd < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid fined amount",
        },
        {
          status: 400,
        }
      );
    }

    if (
      finedUsd >
      boosterAmountUsd
    ) {
      return NextResponse.json(
        {
          error:
            "Fined amount cannot exceed booster earnings",
        },
        {
          status: 400,
        }
      );
    }

    const netAmountUsd =
      Number(
        (
          boosterAmountUsd -
          finedUsd
        ).toFixed(2)
      );

    const amountEgp =
      Number(
        (
          netAmountUsd *
          exchangeRate
        ).toFixed(2)
      );

    // =================================================
    // COMPLETION
    // =================================================

    let completedAt =
      order.completedAt;

    let releaseAt =
      order.payment?.releaseAt ??
      null;

    if (
      status ===
      "COMPLETED"
    ) {
      if (!completedAt) {
        completedAt =
          new Date();
      }

      if (!releaseAt) {
        releaseAt =
          new Date(
            completedAt.getTime() +
              holdDays *
                24 *
                60 *
                60 *
                1000
          );
      }
    } else {
      completedAt = null;
      releaseAt = null;
    }

    // =================================================
    // PAYMENT STATUS
    // =================================================

    let paymentStatus:
      | "PENDING"
      | "AVAILABLE"
      | "PAID"
      | "CANCELLED" =
      order.payment?.status ??
      "PENDING";

    if (
      status ===
      "COMPLETED"
    ) {
      if (
        !order.payment ||
        order.payment.status !==
          "PAID"
      ) {
        paymentStatus =
          "PENDING";
      }
    } else if (
      status ===
      "CANCELLED"
    ) {
      paymentStatus =
        "CANCELLED";
    } else {
      paymentStatus =
        "PENDING";
    }

    // =================================================
    // UPDATE DATABASE
    // =================================================

    const updatedOrder =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.order.update({
              where: {
                id: params.id,
              },

              data: {
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

                deductionUsd:
                  finedUsd,

                boosterId,

                status,
                completedAt,
              },

              include: {
                booster: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    platformFeePercent: true,
                    extraPenaltyPercent: true,
                  },
                },

                payment: true,
              },
            });

          // =================================================
          // UPDATE PAYMENT
          // =================================================

          if (order.payment) {
            await tx.payment.update({
              where: {
                orderId:
                  order.id,
              },

              data: {
                boosterId,

                orderPriceUsd:
                  priceUsd,

                platformFeeUsd,

                extraPenaltyUsd,

                boosterAmountUsd,

                finedUsd,

                netAmountUsd,

                exchangeRate,

                amountEgp,

                status:
                  paymentStatus,

                completedAt,

                releaseAt,

                paidAt:
                  paymentStatus ===
                  "PAID"
                    ? order
                        .payment
                        .paidAt
                    : null,
              },
            });
          }

          // =================================================
          // CREATE PAYMENT
          // =================================================

          else {
            await tx.payment.create({
              data: {
                orderId:
                  order.id,

                boosterId,

                orderPriceUsd:
                  priceUsd,

                platformFeeUsd,

                extraPenaltyUsd,

                boosterAmountUsd,

                finedUsd,

                netAmountUsd,

                exchangeRate,

                amountEgp,

                status:
                  paymentStatus,

                completedAt,

                releaseAt,

                paidAt: null,
              },
            });
          }

          return updated;
        }
      );

    if (
      boosterId &&
      (body.status !== undefined ||
        body.boosterId !== undefined)
    ) {
      await notifyBooster({
        boosterId,
        type:
          body.boosterId !== undefined
            ? "ORDER_ASSIGNED"
            : "ORDER_STATUS_UPDATED",
        title:
          body.boosterId !== undefined
            ? "Order assignment updated"
            : "Order status updated",
        message:
          body.boosterId !== undefined
            ? `Order ${updatedOrder.id} was assigned to you.`
            : `Order ${updatedOrder.id} is now ${status}.`,
      });
    }

    return NextResponse.json(
      updatedOrder
    );
  } catch (error) {
    console.error(
      "Update order error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update order",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE ORDER
// =====================================================

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  }
) {
  try {
    const session =
      await requireAdmin(request);

    if (!session) {
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

    const order =
      await prisma.order.findUnique({
        where: {
          id: params.id,
        },
        select: {
          id: true,
          title: true,
        },
      });

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.order.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      deletedOrderId:
        order.id,
    });
  } catch (error) {
    console.error(
      "Delete order error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete order",
      },
      {
        status: 500,
      }
    );
  }
}