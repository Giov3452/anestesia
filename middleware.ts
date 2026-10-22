import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public pages and auth callbacks must never wait on Supabase. In particular,
  // /login needs to render even if the Auth service is slow or unavailable.
  const isPublic =
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/forgot-password" ||
    path.startsWith("/forgot-password/") ||
    path === "/auth" ||
    path.startsWith("/auth/");

  if (isPublic) {
    return NextResponse.next();
  }

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

  // Verify the JWT claims without fetching the full user record.
  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims();
  const userId = claimsError ? null : claims?.sub;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
