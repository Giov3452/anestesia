import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
 const path=request.nextUrl.pathname;
 const isPtArea=path==="/personal-trainer"||path.startsWith("/personal-trainer/");
 if(isPtArea){
  const isPtLogin=path==="/personal-trainer/login"||path.startsWith("/personal-trainer/login/");
  if(isPtLogin)return NextResponse.next();
  let response=NextResponse.next({request});
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!key)return new NextResponse("Supabase environment not configured",{status:500});
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{cookieOptions:{name:"pt-auth-token"},cookies:{
   getAll(){return request.cookies.getAll();},
   setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
  }});
  const result=await supabase.auth.getClaims();
  const userId=result.error?null:result.data?.claims?.sub;
  if(!userId)return NextResponse.redirect(new URL("/personal-trainer/login",request.url));
  const {data:profile,error}=await supabase.from("pt_profiles").select("role").eq("id",userId).maybeSingle();
  if(error||!profile)return NextResponse.redirect(new URL("/personal-trainer/login?reason=not-authorized",request.url));
  if(profile.role==="pt"){
   const {data:relationship}=await supabase.from("pt_relationships").select("id").eq("trainer_id",userId).eq("status","active").maybeSingle();
   if(!relationship)return NextResponse.redirect(new URL("/personal-trainer/login?reason=not-linked",request.url));
  }
  const adminPath=path==="/personal-trainer/amministrazione"||path.startsWith("/personal-trainer/amministrazione/");
  if(adminPath&&profile.role!=="admin")return NextResponse.redirect(new URL("/personal-trainer/dashboard",request.url));
  return response;
 }
 const isPublic=path==="/login"||path.startsWith("/login/")||path==="/forgot-password"||path.startsWith("/forgot-password/")||path==="/auth"||path.startsWith("/auth/");
 if(isPublic)return NextResponse.next();
 let response=NextResponse.next({request});
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!key)return new NextResponse("Supabase environment not configured",{status:500});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{cookies:{
  getAll(){return request.cookies.getAll();},
  setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
 }});
 const result=await supabase.auth.getClaims();
 const userId=result.error?null:result.data?.claims?.sub;
 if(!userId)return NextResponse.redirect(new URL("/login",request.url));
 const {data:profile}=await supabase.from("profiles").select("must_change_password").eq("id",userId).maybeSingle();
 const passwordPage=path==="/change-password";
 if(profile?.must_change_password&&!passwordPage&&!path.startsWith("/auth/signout"))return NextResponse.redirect(new URL("/change-password",request.url));
 if(!profile?.must_change_password&&passwordPage)return NextResponse.redirect(new URL("/dashboard",request.url));
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
