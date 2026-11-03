import {requirePersonalTrainerProfile} from "@/lib/personal-trainer/auth";
import {createPersonalTrainerServerClient} from "@/lib/personal-trainer/server";
import PaymentsClient from "./PaymentsClient";
export default async function PaymentsPage(){
 await requirePersonalTrainerProfile();
 const supabase=await createPersonalTrainerServerClient();
 const [{data:packages,error:packagesError},{data:{user}}]=await Promise.all([
  supabase.from("pt_packages").select("id,title,total_lessons,price_eur,starts_on,expires_on,created_at,payment_method,status,admin_approved_by,admin_approved_at,pt_approved_by,pt_approved_at,is_active").order("created_at",{ascending:false}),
  supabase.auth.getUser()
 ]);
 if(packagesError) throw new Error("Impossibile caricare i pacchetti: "+packagesError.message);
 const {data:profile,error:profileError}=await supabase.from("pt_profiles").select("role").eq("id",user?.id??"").single();
 if(profileError) throw new Error("Impossibile verificare il ruolo: "+profileError.message);
 return <PaymentsClient initialPackages={packages??[]} viewerId={user?.id??""} viewerRole={profile.role}/>;
}
