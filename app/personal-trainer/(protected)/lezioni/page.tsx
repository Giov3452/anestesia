import {requirePersonalTrainerProfile} from "@/lib/personal-trainer/auth";
import {createPersonalTrainerServerClient} from "@/lib/personal-trainer/server";
import LessonsClient from "./LessonsClient";
export default async function LessonsPage(){
 await requirePersonalTrainerProfile();
 const supabase=await createPersonalTrainerServerClient();
 const {data,error}=await supabase.from("pt_lessons").select("id,starts_at,duration_minutes,status,notes,package_id").order("starts_at",{ascending:false}).limit(200);
 if(error) throw new Error("Impossibile caricare il calendario: "+error.message);
 return <LessonsClient initial={data??[]}/>;
}
