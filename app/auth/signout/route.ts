import {createClient} from "@/lib/supabase/server";
import {NextResponse} from "next/server";

export async function POST(){
  const s=await createClient();
  await s.auth.signOut();
  return new NextResponse(null,{
    status:303,
    headers:{Location:"/login"}
  });
}
