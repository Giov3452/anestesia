import { NextResponse, type NextRequest } from "next/server";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/personal-trainer/login?reason=invite-invalid", request.url));
  const supabase = await createPersonalTrainerServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/personal-trainer/login?reason=invite-invalid", request.url));
  return NextResponse.redirect(new URL("/personal-trainer/set-password", request.url));
}
