import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import DiarioClient from "./DiarioClient";

export default async function DiarioPage() {
  await requirePersonalTrainerProfile("admin");
  const supabase = await createPersonalTrainerServerClient();
  const { data, error } = await supabase
    .from("pt_diary_posts")
    .select("id,title,body_html,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Impossibile caricare il diario: " + error.message);
  return <DiarioClient initialPosts={data ?? []} />;
}
