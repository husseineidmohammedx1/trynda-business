import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const adminRoutes = [
  "/dashboard",
  "/orders",
  "/boosters",
  "/payments",
  "/settings",
];

const boosterRoutes = ["/booster"];

function isRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("session")?.value;

  const isAdminRoute = isRoute(pathname, adminRoutes);
  const isBoosterRoute = isRoute(pathname, boosterRoutes);

  /* =========================================================
     PUBLIC ROOT
     ========================================================= */

  if (pathname === "/") {
    if (!token) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const session = await verifySession(token);

    if (!session) {
      const response = NextResponse.redirect(
        new URL("/login", request.url)
      );

      response.cookies.delete("session");

      return response;
    }

    if (session.role === "ADMIN") {
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }

    if (session.role === "BOOSTER") {
      return NextResponse.redirect(
        new URL("/booster", request.url)
      );
    }

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete("session");

    return response;
  }

  /* =========================================================
     LOGIN
     ========================================================= */

  if (pathname === "/login") {
    if (!token) {
      return NextResponse.next();
    }

    const session = await verifySession(token);

    if (!session) {
      const response = NextResponse.next();

      response.cookies.delete("session");

      return response;
    }

    if (session.role === "ADMIN") {
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }

    if (session.role === "BOOSTER") {
      return NextResponse.redirect(
        new URL("/booster", request.url)
      );
    }

    const response = NextResponse.next();

    response.cookies.delete("session");

    return response;
  }

  /* =========================================================
     PUBLIC / UNKNOWN ROUTES
     ========================================================= */

  if (!isAdminRoute && !isBoosterRoute) {
    return NextResponse.next();
  }

  /* =========================================================
     PROTECTED ROUTES — NO SESSION
     ========================================================= */

  if (!token) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  /* =========================================================
     VERIFY SESSION
     ========================================================= */

  const session = await verifySession(token);

  if (!session) {
    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete("session");

    return response;
  }

  const role = String(session.role || "").toUpperCase();

  /* =========================================================
     ADMIN ROUTES
     ========================================================= */

  if (isAdminRoute) {
    if (role === "ADMIN") {
      return NextResponse.next();
    }

    if (role === "BOOSTER") {
      return NextResponse.redirect(
        new URL("/booster", request.url)
      );
    }

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete("session");

    return response;
  }

  /* =========================================================
     BOOSTER ROUTES
     ========================================================= */

  if (isBoosterRoute) {
    if (role === "BOOSTER") {
      return NextResponse.next();
    }

    if (role === "ADMIN") {
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete("session");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/orders/:path*",
    "/boosters/:path*",
    "/payments/:path*",
    "/settings/:path*",
    "/booster/:path*",
  ],
};