import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      {
        next: {
          revalidate: 600,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Exchange rate API failed");
    }

    const data = await response.json();

    const rate = Number(data?.rates?.EGP);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid USD/EGP rate");
    }

    return NextResponse.json({
      currency: "USD",
      target: "EGP",
      rate,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Exchange rate error:", error);

    return NextResponse.json(
      {
        error: "Unable to fetch exchange rate",
      },
      { status: 500 }
    );
  }
}