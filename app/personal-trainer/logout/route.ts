import { NextResponse } from "next/server";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
export async function POST(request: Request) {
  const supabase = await createPersonalTrainerServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/personal-trainer/login", request.url), { status: 303 });
}
