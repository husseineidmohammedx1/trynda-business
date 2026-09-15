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
    const session = await requireAdmin(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const month =
      request.nextUrl.searchParams.get("month")?.trim() || "";

    const transactions =
      await prisma.boosterPaymentTransaction.findMany({
        where: month ? { month } : undefined,
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
          booster: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

    return NextResponse.json({
      month,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        boosterId: transaction.boosterId,
        boosterName: transaction.booster.name,
        boosterEmail: transaction.booster.email,
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
    console.error("Get payment history error:", error);

    return NextResponse.json(
      { error: "Failed to load payment history" },
      { status: 500 }
    );
  }
}