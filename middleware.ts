import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPtArea = path === "/personal-trainer" || path.startsWith("/personal-trainer/");

  // Personal Trainer Hub uses its own cookie name and profile table.
  if (isPtArea) {
    const isPtLogin = path === "/personal-trainer/login" || path.startsWith("/personal-trainer/login/");
    if (isPtLogin) return NextResponse.next();

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
        cookieOptions: { name: "pt-auth-token" },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(values) {
            values.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );

    const { data: { claims }, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsError ? null : claims?.sub;
    if (!userId) return NextResponse.redirect(new URL("/personal-trainer/login", request.url));

    const { data: profile, error: profileError } = await supabase
      .from("pt_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.redirect(new URL("/personal-trainer/login?reason=not-authorized", request.url));
    }

    if (profile.role === "pt") {
      const { data: relationship } = await supabase
        .from("pt_relationships")
        .select("id")
        .eq("trainer_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!relationship) {
        return NextResponse.redirect(new URL("/personal-trainer/login?reason=not-linked", request.url));
      }
    }

    const isAdminPath =
      path === "/personal-trainer/amministrazione" ||
      path.startsWith("/personal-trainer/amministrazione/");
    if (isAdminPath && profile.role !== "admin") {
      return NextResponse.redirect(new URL("/personal-trainer/dashboard", request.url));
    }

    return response;
  }

  // Existing Turni authentication remains unchanged.
  const isPublic =
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/forgot-password" ||
    path.startsWith("/forgot-password/") ||
    path === "/auth" ||
    path.startsWith("/auth/");

  if (isPublic) return NextResponse.next();

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
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { claims }, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsError ? null : claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  const isPasswordPage = path === "/change-password";
  if (profile?.must_change_password && !isPasswordPage && !path.startsWith("/auth/signout")) {
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
