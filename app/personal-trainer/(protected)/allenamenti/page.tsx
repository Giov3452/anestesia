import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";
import WorkoutsClient from "./WorkoutsClient";

export default async function WorkoutsPage() {
  await requirePersonalTrainerProfile();
  const supabase=await createPersonalTrainerServerClient();
  const {data,error}=await supabase.from("pt_workout_plans").select("id,title,description,file_path,file_name,content_type,is_current,created_at").order("created_at",{ascending:false});
  if(error)throw new Error("Impossibile caricare i piani di allenamento: "+error.message);
  const plans=await Promise.all((data??[]).map(async plan=>{
    const {data:signed}=await supabase.storage.from("pt-private").createSignedUrl(plan.file_path,3600);
    return {...plan,url:signed?.signedUrl??""};
  }));
  return <WorkoutsClient initial={plans}/>;
}
