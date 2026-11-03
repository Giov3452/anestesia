import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import MeasurementsClient from "./MeasurementsClient";

export default async function MeasurementsPage() {
  const profile=await requirePersonalTrainerProfile();
  const supabase=await createPersonalTrainerServerClient();
  const {data,error}=await supabase.from("pt_measurements").select("*").order("measured_on",{ascending:false}).limit(100);
  if(error) throw new Error("Impossibile caricare le misurazioni: "+error.message);
  return <MeasurementsClient initial={data??[]} defaultHeight={profile.height_cm}/>;
}
