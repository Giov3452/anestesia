import { notFound } from "next/navigation";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import MeasurementDetailClient from "./MeasurementDetailClient";

export default async function MeasurementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePersonalTrainerProfile();
  const { id } = await params;
  const supabase = await createPersonalTrainerServerClient();
  const { data, error } = await supabase.from("pt_measurements").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Impossibile caricare la rilevazione: " + error.message);
  if (!data) notFound();
  return <MeasurementDetailClient initial={data} />;
}
