import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import AdministrationClient from "./AdministrationClient";

export default async function AdministrationPage() {
  const admin = await requirePersonalTrainerProfile("admin");
  const supabase = await createPersonalTrainerServerClient();
  const [{ data: profiles }, { data: relationships }] = await Promise.all([
    supabase.from("pt_profiles").select("id,email,display_name,role,created_at").eq("role","pt").order("created_at",{ascending:false}),
    supabase.from("pt_relationships").select("trainer_id,status").eq("admin_id",admin.id),
  ]);
  const statusByTrainer = new Map((relationships ?? []).map((r) => [r.trainer_id, r.status]));
  const trainers = (profiles ?? []).filter((p) => statusByTrainer.has(p.id)).map((p) => ({
    ...p,
    relationship_status: statusByTrainer.get(p.id) as "active" | "disabled",
  }));
  return <AdministrationClient trainers={trainers} />;
}
