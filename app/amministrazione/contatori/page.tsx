"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import BackButton from "@/app/components/BackButton";
import {createClient} from "@/lib/supabase/client";
import {monthNames,theoreticalMonthlyHours} from "@/lib/calendar";

type User={id:string;username:string;email:string;role:string;employment_role:string;service:string};
type Shift={user_id:string;short_name:string;duration_minutes:number};

const SALMON="#f7c9c1", OCRA="#e7c56a", GREEN="#c8e6c9";
const fmt=(n:number)=>n.toFixed(2).replace(".",",");
const roleLabel=(r:string)=>r==="calabria"?"Calabria":r==="part_time"?"Part-time":"Strutturato";

export default function Counters(){
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [users,setUsers]=useState<User[]>([]);
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [error,setError]=useState("");
 const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const month=current.getMonth(),year=current.getFullYear();

 useEffect(()=>{(async()=>{
  const s=createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user){setAuthorized(false);return}
  const {data:p}=await s.from("profiles").select("role").eq("id",user.id).single();
  const {data:r}=await s.rpc("get_my_role");
  const role=String(p?.role||r||"utente").toLowerCase(),ok=["admin","super_admin"].includes(role);
  setAuthorized(ok);if(!ok)return;
  const [{data:u,error:ue},{data:d,error:de}]=await Promise.all([
   s.from("profiles").select("id,username,email,role,employment_role,service").eq("service","anestesia").order("username"),
   s.from("shift_definitions").select("short_name,duration_minutes")
  ]);
  if(ue||de){setError(ue?.message||de?.message||"Errore nel caricamento");return}
  setUsers((u||[]) as User[]);
  const defs=new Map((d||[]).map((x:any)=>[x.short_name,Number(x.duration_minutes)]));
  const from=String(year)+"-"+String(month+1).padStart(2,"0")+"-01";
  const to=new Date(year,month+1,0).toISOString().slice(0,10);
  const {data:c,error:ce}=await s.from("calendar_shifts").select("user_id,short_name").gte("shift_date",from).lte("shift_date",to);
  if(ce){setError(ce.message);return}
  setShifts((c||[]).map((x:any)=>({user_id:x.user_id,short_name:x.short_name,duration_minutes:defs.get(x.short_name)||0})));
 })()},[year,month]);

 const rows=useMemo(()=>users.map(u=>{
  const us=shifts.filter(x=>x.user_id===u.id);
  const count=(...codes:string[])=>us.filter(x=>codes.includes(x.short_name)).length;
  const effective=us.filter(x=>!["RG","RN","RP","R","Rp"].includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
  const theoretical=theoreticalMonthlyHours(year,month,u.employment_role);
  return {...u,theoretical,eccesso:effective-theoretical,mattine:count("M1","M2","M3"),pomeriggi:count("P"),ft:count("FT"),guardie:count("G"),notti:count("N"),mortara:count("Mo1","Mo2"),ria:count("MRia","GRia","NRia"),reperibilita:count("RG","RN","RP"),rg:count("RG"),rn:count("RN"),rp:count("RP")};
 }),[users,shifts,year,month]);

 const totals=useMemo(()=>rows.reduce((a,r)=>{
  a.theoretical+=r.theoretical;a.eccesso+=r.eccesso;a.mattine+=r.mattine;a.pomeriggi+=r.pomeriggi;a.ft+=r.ft;a.guardie+=r.guardie;a.notti+=r.notti;a.mortara+=r.mortara;a.ria+=r.ria;a.reperibilita+=r.reperibilita;a.rg+=r.rg;a.rn+=r.rn;a.rp+=r.rp;return a
 },{theoretical:0,eccesso:0,mattine:0,pomeriggi:0,ft:0,guardie:0,notti:0,mortara:0,ria:0,reperibilita:0,rg:0,rn:0,rp:0}),[rows]);

 if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
 if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

 const th=(label:string,bg:string)=><th style={{background:bg,color:"#18212f",minWidth:label==="Dipendente"?150:88,padding:"10px 6px"}}>{label}</th>;
 const td=(value:string|number,bg:string)=><td style={{background:bg,fontVariantNumeric:"tabular-nums",fontWeight:650,textAlign:"center",padding:"9px 6px"}}>{typeof value==="number"?fmt(value):value}</td>;

 return <div className="shell"><header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
 <main className="main"><BackButton/><div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Contatori</h1><p className="sub">SALA — Contatori mensili del personale di Anestesia.</p></div><Link className="btn btn-secondary" href="/amministrazione/genera-turni">← Generatore di turni</Link></div>
 {error&&<div className="error">{error}</div>}
 <section className="calendar-card"><div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{year}</p><h2>{monthNames[month]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month+1,1))}><ChevronRight size={20}/></button></div>
 <div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:12}}><thead><tr>
 {th("Dipendente","#eef2f6")}{th("Teorico ore",SALMON)}{th("Esubero ore",SALMON)}{th("Mattine",SALMON)}{th("Pomeriggi",SALMON)}{th("FT",SALMON)}{th("Guardia G",SALMON)}{th("Notti N",SALMON)}{th("Mortara",SALMON)}{th("Rianimazione",OCRA)}{th("Reperibilità",GREEN)}{th("RG",GREEN)}{th("RN",GREEN)}{th("RP",GREEN)}
 </tr></thead><tbody>
 {rows.map(r=><tr key={r.id}><td style={{fontWeight:800,whiteSpace:"nowrap",padding:"9px 8px",background:"#f8fafc"}}><div>{r.username}</div><small style={{fontWeight:500,color:"#667085"}}>{roleLabel(r.employment_role)}</small></td>{td(r.theoretical,SALMON)}{td(r.eccesso,SALMON)}{td(r.mattine,SALMON)}{td(r.pomeriggi,SALMON)}{td(r.ft,SALMON)}{td(r.guardie,SALMON)}{td(r.notti,SALMON)}{td(r.mortara,SALMON)}{td(r.ria,OCRA)}{td(r.reperibilita,GREEN)}{td(r.rg,GREEN)}{td(r.rn,GREEN)}{td(r.rp,GREEN)}</tr>)}
 <tr><td style={{padding:"11px 8px",fontWeight:900,background:"#18212f",color:"white"}}>TOTALE</td>{td(totals.theoretical,SALMON)}{td(totals.eccesso,SALMON)}{td(totals.mattine,SALMON)}{td(totals.pomeriggi,SALMON)}{td(totals.ft,SALMON)}{td(totals.guardie,SALMON)}{td(totals.notti,SALMON)}{td(totals.mortara,SALMON)}{td(totals.ria,OCRA)}{td(totals.reperibilita,GREEN)}{td(totals.rg,GREEN)}{td(totals.rn,GREEN)}{td(totals.rp,GREEN)}</tr>
 </tbody></table></div></section></main></div>;
}