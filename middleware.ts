import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseKey) {
    return new NextResponse("Supabase environment not configured", { status: 500 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the session from its JWT claims instead of fetching the full user
  // from the Auth server on every request. This removes an unnecessary network
  // round trip from the middleware hot path.
  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims();
  const userId = claimsError ? null : claims?.sub;

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/auth");

  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();

    const isPasswordPage = path === "/change-password";
    if (
      profile?.must_change_password &&
      !isPasswordPage &&
      !path.startsWith("/auth/signout")
    ) {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
    if (!profile?.must_change_password && isPasswordPage) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
