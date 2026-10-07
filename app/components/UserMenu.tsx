"use client";

import {useEffect,useRef,useState} from "react";
import {CalendarDays,ChevronDown,ClipboardList,FileText,LogOut,Settings,UserCircle} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

export default function UserMenu(){
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("Utente");
  const [role,setRole]=useState("utente");
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const s=createClient();s.auth.getUser().then(async({data})=>{if(!data.user)return;const {data:p}=await s.from("profiles").select("username,role").eq("id",data.user.id).single();setName(p?.username||data.user.email?.split("@")[0]||"Utente");setRole(String(p?.role||"utente").toLowerCase())});const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",esc);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",esc)}},[]);
  const admin=["admin","super_admin"].includes(role);
  return <div className="user-menu" ref={ref}>
    <button className={"user-menu-trigger "+(open?"open":"")} onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu"><span className="avatar">{name[0]?.toUpperCase()}</span><span className="user-menu-name">{name}</span><ChevronDown size={16}/></button>
    {open&&<div className="user-dropdown" role="menu">
      <div className="user-dropdown-head"><div className="avatar large">{name[0]?.toUpperCase()}</div><div><strong>{name}</strong><small>{role==="super_admin"?"Super admin":role==="admin"?"Amministratore":"Utente"}</small></div></div>
      <div className="user-dropdown-divider"/>
      <a href="/dashboard" role="menuitem"><CalendarDays size={16}/>I miei turni</a>
      <a href="/turni-generali" role="menuitem"><FileText size={16}/>Turni generali</a>
      <a href="/richieste" role="menuitem"><ClipboardList size={16}/>Invia richieste</a>
      {admin&&<a href="/amministrazione" role="menuitem"><Settings size={16}/>Amministrazione</a>}
      <a href="/profilo" role="menuitem"><UserCircle size={16}/>Profilo</a>
      <div className="user-dropdown-divider"/>
      <form action="/auth/signout" method="post"><button role="menuitem" type="submit"><LogOut size={16}/>Esci</button></form>
    </div>}
  </div>
}