import {createClient} from "@/lib/supabase/server";
import {NextResponse} from "next/server";

export async function POST(request:Request){
  const s=await createClient();
  await s.auth.signOut();
  const requestUrl=new URL(request.url);
  return NextResponse.redirect(new URL("/login",requestUrl.origin),303);
}
