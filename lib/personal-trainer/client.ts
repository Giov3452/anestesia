import { createBrowserClient } from "@supabase/ssr";

const SIXTY_DAYS = 60 * 24 * 60 * 60;

export function createPersonalTrainerClient(rememberDays?: number) {
  // Dedicated cookie jar for Personal Trainer Hub, separate from Turni.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        name: "pt-auth-token",
        ...(rememberDays ? { maxAge: rememberDays * 24 * 60 * 60 } : {}),
      },
      isSingleton: false,
    }
  );
}
