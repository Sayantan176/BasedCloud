import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

let devSessionCleared = false;

export async function proxy(request: NextRequest) {
  // Development ONLY: Force logout on first request after server restart
  if (process.env.NODE_ENV === 'development' && !devSessionCleared) {
    devSessionCleared = true;
    const response = NextResponse.redirect(new URL("/login", request.url));
    request.cookies.getAll().forEach(cookie => {
      response.cookies.set({ name: cookie.name, value: '', expires: new Date(0), path: '/' });
    });
    return response;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
