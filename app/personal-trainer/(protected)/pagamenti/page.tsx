import {requirePersonalTrainerProfile} from "@/lib/personal-trainer/auth";
import {createPersonalTrainerServerClient} from "@/lib/personal-trainer/server";
import PaymentsClient from "./PaymentsClient";
export default async function PaymentsPage(){
 await requirePersonalTrainerProfile();
 const supabase=await createPersonalTrainerServerClient();
 const [{data,error},{data:{user}}]=await Promise.all([supabase.from("pt_payments").select("id,amount_eur,paid_on,method,description,status,created_by").order("paid_on",{ascending:false}).limit(200),supabase.auth.getUser()]);
 if(error) throw new Error("Impossibile caricare i pagamenti: "+error.message);
 return <PaymentsClient initial={data??[]} viewerId={user?.id??""}/>;
}