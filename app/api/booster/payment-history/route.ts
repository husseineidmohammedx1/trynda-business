import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function serializeValue(value: unknown) {
  if (
    value !== null &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    return Number(
      (value as { toNumber: () => number }).toNumber()
    );
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("session")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const session = await verifySession(token);

    if (!session || session.role !== "BOOSTER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessionRecord = session as unknown as {
      userId?: unknown;
      id?: unknown;
      sub?: unknown;
      email?: unknown;
    };

    const boosterId = String(
      sessionRecord.userId ??
        sessionRecord.id ??
        sessionRecord.sub ??
        ""
    ).trim();

    const sessionEmail = String(
      sessionRecord.email ?? ""
    ).trim().toLowerCase();

    const booster =
      boosterId || sessionEmail
        ? await prisma.user.findFirst({
            where: {
              role: "BOOSTER",
              ...(boosterId
                ? { id: boosterId }
                : { email: sessionEmail }),
            },
            select: {
              id: true,
            },
          })
        : null;

    if (!booster) {
      return NextResponse.json(
        { error: "Booster not found" },
        { status: 401 }
      );
    }

    const transactions =
      await prisma.boosterPaymentTransaction.findMany({
        where: {
          boosterId: booster.id,
        },
        orderBy: {
          paidAt: "desc",
        },
        select: {
          id: true,
          boosterId: true,
          month: true,
          amountUsd: true,
          exchangeRate: true,
          amountEgp: true,
          paymentMethod: true,
          paymentNumber: true,
          paidAt: true,
          createdAt: true,
        },
      });

    return NextResponse.json({
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        boosterId: transaction.boosterId,
        month: transaction.month,
        amountUsd: serializeValue(transaction.amountUsd),
        exchangeRate: serializeValue(transaction.exchangeRate),
        amountEgp: serializeValue(transaction.amountEgp),
        paymentMethod: transaction.paymentMethod,
        paymentNumber: transaction.paymentNumber,
        paidAt: serializeValue(transaction.paidAt),
        createdAt: serializeValue(transaction.createdAt),
      })),
    });
  } catch (error) {
    console.error(
      "Get booster payment history error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load payment history" },
      { status: 500 }
    );
  }
}
