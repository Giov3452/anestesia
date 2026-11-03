import {requirePersonalTrainerProfile} from "@/lib/personal-trainer/auth";
import {createPersonalTrainerServerClient} from "@/lib/personal-trainer/server";
import PaymentsClient from "./PaymentsClient";
export default async function PaymentsPage(){
 await requirePersonalTrainerProfile();
 const supabase=await createPersonalTrainerServerClient();
 const [{data:payments,error:paymentsError},{data:packages,error:packagesError},{data:{user}}]=await Promise.all([
  supabase.from("pt_payments").select("id,amount_eur,paid_on,method,description,status,created_by").order("paid_on",{ascending:false}).limit(200),
  supabase.from("pt_packages").select("id,title,total_lessons,price_eur,starts_on,expires_on,created_at").order("created_at",{ascending:true}),
  supabase.auth.getUser()
 ]);
 if(paymentsError) throw new Error("Impossibile caricare i pagamenti: "+paymentsError.message);
 if(packagesError) throw new Error("Impossibile caricare i pacchetti: "+packagesError.message);
 return <PaymentsClient initial={payments??[]} initialPackages={packages??[]} viewerId={user?.id??""}/>;
}
