import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("session")?.value;

    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        {
          status: 200,
        }
      );
    }

    const session = await verifySession(token);

    if (!session) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: session,
    });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        status: 200,
      }
    );
  }
}