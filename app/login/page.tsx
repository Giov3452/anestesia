"use client";
import {FormEvent,useState} from "react";
import Link from "next/link";
import {Eye,EyeOff,Hospital} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

export default function Login(){
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [show,setShow]=useState(false);
 const [remember,setRemember]=useState(true);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  const supabase=createClient();
  try{
   const {data:lookup,error:lookupError}=await supabase.functions.invoke("username-login",{body:{username:username.trim()}});
   const email=lookup?.email;
   if(lookupError||!email)throw new Error("login");
   const {error:authError}=await supabase.auth.signInWithPassword({email,password});
   if(authError)throw new Error("login");
   window.location.href="/dashboard";
  }catch{
   setError("Nome utente o password non corretti.");
  }finally{setLoading(false)}
 }
 return <main className="auth"><section className="auth-card"><div className="brand"><span className="brand-mark"><Hospital size={21}/></span>Turni Ospedalieri</div><p className="eyebrow" style={{marginTop:36}}>Area riservata</p><h1 className="title">Bentornato</h1><p className="sub">Accedi per consultare i tuoi turni e inviare richieste.</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit}><div className="field"><label>Nome utente</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" /></div><div className="field"><label>Password</label><div style={{position:"relative"}}><input style={{paddingRight:44}} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/><button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:9,border:0,background:"transparent",color:"#6b7280",cursor:"pointer"}}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div><div className="row" style={{margin:"10px 0 22px"}}><label className="check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Ricorda accesso</label><Link className="link" href="/forgot-password">Password dimenticata?</Link></div><button className="btn btn-primary" disabled={loading}>{loading?"Accesso…":"Accedi"}</button></form></section></main>
}