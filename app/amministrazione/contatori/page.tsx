"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import BackButton from "@/app/components/BackButton";
import {createClient} from "@/lib/supabase/client";
import {monthNames,theoreticalMonthlyHours} from "@/lib/calendar";

type User={id:string;username:string;email:string;role:string;employment_role:string;service:string};

const serviceLabel=(s:string)=>s==="rianimazione"?"Rianimazione":"Anestesia";
const roleLabel=(r:string)=>r==="calabria"?"Calabria":r==="part_time"?"Part-time":"Strutturato";

export default function Counters(){
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [users,setUsers]=useState<User[]>([]);
 const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [error,setError]=useState("");
 useEffect(()=>{(async()=>{const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){setAuthorized(false);return}const {data:p}=await s.from("profiles").select("role").eq("id",user.id).single();const {data:r}=await s.rpc("get_my_role");const role=String(p?.role||r||"utente").toLowerCase();const ok=["admin","super_admin"].includes(role);setAuthorized(ok);if(!ok)return;const {data,error:e}=await s.from("profiles").select("id,username,email,role,employment_role,service").order("username");if(e)setError(e.message);else setUsers((data||[]) as User[])})()},[]);
 const month=current.getMonth(),year=current.getFullYear();
 const rows=useMemo(()=>users.map(u=>({...u,hours:theoreticalMonthlyHours(year,month,u.employment_role)})),[users,year,month]);
 if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
 if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;
 return <div className="shell"><header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header><main className="main"><BackButton/>
 <div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Contatori</h1><p className="sub">Calcolo delle ore teoriche mensili in base al ruolo professionale.</p></div><Link className="btn btn-secondary" href="/amministrazione/genera-turni">← Generatore di turni</Link></div>
 {error&&<div className="error">{error}</div>}
 <section className="calendar-card"><div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{year}</p><h2>{monthNames[month]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month+1,1))}><ChevronRight size={20}/></button></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{rows.map(u=><article className="card" key={u.id} style={{boxShadow:"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><h2 style={{margin:0}}>{u.username}</h2><p className="muted" style={{margin:"6px 0 0"}}>{serviceLabel(u.service)} · {roleLabel(u.employment_role)}</p></div><span className="type-badge desiderata">{u.role==="super_admin"?"Super admin":u.role==="admin"?"Admin":"Utente"}</span></div><div style={{marginTop:22}}><div className="eyebrow" style={{letterSpacing:".04em"}}>Ore teoriche mensili</div><div style={{fontSize:32,fontWeight:850,color:"var(--navy)",marginTop:4}}>{u.hours.toFixed(2).replace(".",",")} h</div></div></article>)}</div>
 <div className="card" style={{marginTop:18,boxShadow:"none"}}><h2 style={{marginTop:0}}>Criteri di calcolo</h2><div style={{display:"grid",gap:8,fontSize:13,color:"var(--muted)"}}><div><strong style={{color:"var(--navy)"}}>Strutturato</strong> — Lun-Ven, festivi esclusi, 7,6 h/giorno.</div><div><strong style={{color:"var(--navy)"}}>Part-time</strong> — Lun-Mer-Ven, festivi esclusi, 8 h/giorno.</div><div><strong style={{color:"var(--navy)"}}>Calabria</strong> — Lun-Ven, festivi esclusi, 6,4 h/giorno.</div></div></div>
 </section></main></div>;
}