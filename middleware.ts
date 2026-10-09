import {createServerClient} from "@supabase/ssr";import {NextResponse,type NextRequest} from "next/server";
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!supabaseKey)return new NextResponse("Supabase environment not configured",{status:500});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,supabaseKey,{cookies:{getAll(){return request.cookies.getAll()},setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
 const {data:{user}}=await supabase.auth.getUser();
 const path=request.nextUrl.pathname;
 const isPublic=path.startsWith("/login")||path.startsWith("/forgot-password")||path.startsWith("/auth");
 if(!user&&!isPublic)return NextResponse.redirect(new URL("/login",request.url));
 if(user){
  const {data:profile}=await supabase.from("profiles").select("must_change_password").eq("id",user.id).maybeSingle();
  const isPasswordPage=path==="/change-password";
  if(profile?.must_change_password&&!isPasswordPage&&!path.startsWith("/auth/signout"))return NextResponse.redirect(new URL("/change-password",request.url));
  if(!profile?.must_change_password&&isPasswordPage)return NextResponse.redirect(new URL("/dashboard",request.url));
  if(path==="/login")return NextResponse.redirect(new URL("/",request.url));
 }
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]}