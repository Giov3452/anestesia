"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import BackButton from "@/app/components/BackButton";
import {createClient} from "@/lib/supabase/client";
import {italianNationalHolidayName} from "@/lib/calendar";

const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const weekDays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

type User={id:string;username:string;service:string};
type Shift={id:number;user_id:string;shift_date:string;short_name:string;source:string;status:string};

function iso(y:number,m:number,d:number){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function buildCalendar(y:number,m:number){const first=new Date(y,m,1);const off=(first.getDay()+6)%7;const days=new Date(y,m+1,0).getDate();return [...Array(off).fill(null),...Array.from({length:days},(_,i)=>i+1)];}
function isWeekend(date:string){const [y,m,d]=date.split("-").map(Number);const w=new Date(y,m-1,d).getDay();return w===0||w===6;}
function fmtDate(v:string){return new Date(v+"T00:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});}

export default function History(){
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [users,setUsers]=useState<User[]>([]);
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [error,setError]=useState("");

 const load=async()=>{
  const s=createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user){setAuthorized(false);return;}
  const [{data:p},{data:r}]=await Promise.all([s.from("profiles").select("role").eq("id",user.id).single(),s.rpc("get_my_role")]);
  const role=String(p?.role||r||"utente").toLowerCase(),ok=["admin","super_admin"].includes(role);
  setAuthorized(ok);if(!ok)return;
  const y=current.getFullYear(),m=current.getMonth(),start=iso(y,m,1),end=iso(y,m,new Date(y,m+1,0).getDate());
  const [{data:u,error:ue},{data:a,error:ae}]=await Promise.all([
   s.from("profiles").select("id,username,service").order("username"),
   s.from("calendar_shifts").select("id,user_id,shift_date,short_name,source,status").gte("shift_date",start).lte("shift_date",end).order("shift_date").order("short_name")
  ]);
  if(ue||ae){setError(ue?.message||ae?.message||"Errore nel caricamento dello storico.");return;}
  setUsers(u||[]);setShifts(a||[]);
 };
 useEffect(()=>{load();},[current]);

 const cells=useMemo(()=>buildCalendar(current.getFullYear(),current.getMonth()),[current]);
 const byDate=(date:string)=>shifts.filter(s=>s.shift_date===date);

 if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
 if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

 return <div className="shell">
  <header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
  <main className="main"><BackButton/>
   <div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Storico</h1><p className="sub">Consultazione dei turni archiviati mese per mese.</p></div><Link className="btn btn-secondary" href="/amministrazione/genera-turni">← Calendario operativo</Link></div>
   {error&&<div className="error">{error}</div>}
   <section className="calendar-card">
    <div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{current.getFullYear()}</p><h2>{monthNames[current.getMonth()]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()+1,1))}><ChevronRight size={20}/></button></div>
    <div className="calendar admin-month-grid">{weekDays.map(d=><div className="dow" key={d}>{d}</div>)}{cells.map((day,i)=>{if(!day)return <div className="day empty" key={i}/>;const date=iso(current.getFullYear(),current.getMonth(),day),holiday=italianNationalHolidayName(date),weekend=isWeekend(date),list=byDate(date);return <div className={`day generation-day ${weekend?"weekend-day":""} ${holiday?"holiday-day":""}`} key={i}><div className="date-row"><span className="date">{day}</span></div>{holiday&&<div className="holiday-label">{holiday}</div>}<div className="cell-shifts">{list.map(a=><div key={a.id} className={`calendar-shift-chip ${a.source==="automatic"?"draft-shift":""}`}><strong>{a.short_name}</strong> <span>{users.find(u=>u.id===a.user_id)?.username||"—"}</span></div>)}</div></div>})}</div>
    <p className="muted calendar-note">Mese consultato: <strong>{monthNames[current.getMonth()]} {current.getFullYear()}</strong> · {shifts.length} turni archiviati.</p>
   </section>
   <p className="muted" style={{marginTop:12}}>Lo storico è in sola consultazione: i turni presenti nel database restano disponibili anche dopo il cambio mese.</p>
  </main>
 </div>;
}
