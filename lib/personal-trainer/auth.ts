import { redirect } from "next/navigation";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";

export type PersonalTrainerRole = "admin" | "pt";
export type PersonalTrainerProfile = { id:string; email:string; display_name:string; role:PersonalTrainerRole; height_cm:number|null; must_change_password?:boolean };

export async function requirePersonalTrainerProfile(requiredRole?:PersonalTrainerRole) {
 const supabase=await createPersonalTrainerServerClient();
 const result=await supabase.auth.getClaims();
 const userId=result.error?null:result.data?.claims?.sub;
 if(!userId)redirect("/personal-trainer/login");
 const {data:profile}=await supabase.from("pt_profiles").select("id,email,display_name,role,height_cm").eq("id",userId).maybeSingle();
 if(!profile)redirect("/personal-trainer/login?reason=not-authorized");
 if(profile.role==="pt"){
  const {data:relationship}=await supabase.from("pt_relationships").select("id").eq("trainer_id",userId).eq("status","active").maybeSingle();
  if(!relationship)redirect("/personal-trainer/login?reason=not-linked");
 }
 if(requiredRole&&profile.role!==requiredRole)redirect("/personal-trainer/dashboard");
 const { data: authUser } = await supabase.auth.getUser();
 if (authUser.user?.user_metadata?.must_change_password === true) redirect("/personal-trainer/set-password");
 return { ...profile, must_change_password: false } as PersonalTrainerProfile;
}
