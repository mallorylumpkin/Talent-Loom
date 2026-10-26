import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" (formerly middleware): refreshes the auth session on each request.
export async function proxy(request: NextRequest) {
  // While an admin is viewing as a user, nothing can be changed (the database enforces this too).
  if (request.cookies.has("tl_imp")) {
    const path = request.nextUrl.pathname;
    if (path === "/auth/signout") {
      return NextResponse.redirect(new URL("/impersonation/exit", request.nextUrl.origin), { status: 303 });
    }
    const isFormAction = request.method === "POST" && request.headers.has("next-action");
    const isSensitive = path.startsWith("/api/oauth") || path.startsWith("/creator/connect") || path === "/creator/settings/export"
      || path === "/reset-password";
    if (isFormAction || isSensitive) {
      return new NextResponse("Read-only while viewing as this user. Exit view-as mode to make changes.", { status: 403 });
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
