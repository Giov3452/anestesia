import { createBrowserClient } from "@supabase/ssr";

export function createPersonalTrainerClient() {
  // Keep a distinct browser client and cookie jar from the Turni application.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { name: "pt-auth-token" }, isSingleton: false }
  );
}
