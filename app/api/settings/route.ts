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

// =====================================================
// GET SETTINGS
// =====================================================

export async function GET(
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

    const settings =
      await getBusinessSettings();

    return NextResponse.json({
      id: settings.id,

      businessName:
        settings.businessName,

      platformFeePercent:
        Number(
          settings.platformFeePercent
        ),

      holdDays:
        settings.holdDays,

      baseCurrency: "USD",

      localCurrency: "EGP",

      createdAt:
        settings.createdAt,

      updatedAt:
        settings.updatedAt,
    });
  } catch (error) {
    console.error(
      "Get settings error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load settings",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// UPDATE SETTINGS
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

    const businessName =
      String(
        body.businessName ??
          "Trynda Business"
      ).trim();

    const platformFeePercent =
      Number(
        body.platformFeePercent
      );

    const holdDays =
      Number(body.holdDays);

    // =================================================
    // VALIDATION
    // =================================================

    if (!businessName) {
      return NextResponse.json(
        {
          error:
            "Business name is required",
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
      !Number.isInteger(holdDays) ||
      holdDays < 0 ||
      holdDays > 365
    ) {
      return NextResponse.json(
        {
          error:
            "Hold days must be a whole number between 0 and 365",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // GET CURRENT SETTINGS
    // =================================================

    const current =
      await getBusinessSettings();

    // =================================================
    // UPDATE
    // =================================================

    const settings =
      await prisma.businessSettings.update({
        where: {
          id: current.id,
        },

        data: {
          businessName,
          platformFeePercent,
          holdDays,
        },
      });

    return NextResponse.json({
      success: true,

      settings: {
        id: settings.id,

        businessName:
          settings.businessName,

        platformFeePercent:
          Number(
            settings.platformFeePercent
          ),

        holdDays:
          settings.holdDays,

        baseCurrency: "USD",

        localCurrency: "EGP",

        updatedAt:
          settings.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Update settings error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update settings",
      },
      {
        status: 500,
      }
    );
  }
}
