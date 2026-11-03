import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  await requirePersonalTrainerProfile();
  const supabase = await createPersonalTrainerServerClient();
  const { data, error } = await supabase.from("pt_clients")
    .select("id,first_name,last_name,email,phone,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Impossibile caricare l'elenco clienti: " + error.message);
  return <ClientsClient initialClients={data ?? []} />;
}
