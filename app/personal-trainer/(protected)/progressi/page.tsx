import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import ProgressClient from "./ProgressClient";

export default async function ProgressPage() {
  const supabase = await createPersonalTrainerServerClient();
  const { data, error } = await supabase.from("pt_progress_photos").select("id,taken_on,view_type,caption,file_path").order("taken_on", { ascending: false }).limit(100);
  if (error) throw new Error("Impossibile caricare l'archivio fotografico: " + error.message);
  const photos = await Promise.all((data ?? []).map(async photo => {
    const { data: signed } = await supabase.storage.from("pt-private").createSignedUrl(photo.file_path, 3600);
    return { ...photo, url: signed?.signedUrl ?? "" };
  }));
  return <ProgressClient initial={photos} />;
}
