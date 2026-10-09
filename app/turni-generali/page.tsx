"use client";

import {useEffect,useMemo,useState} from "react";
import UserMenu from "@/app/components/UserMenu";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import BackButton from "@/app/components/BackButton";
import {createClient} from "@/lib/supabase/client";

const weekdays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const labels:Record<string,string>={
 G:"Giorno",N:"Notte",M1:"M1",M2:"M2",M3:"M3",mp:"Mattino + pomeriggio",RC:"Riposo compensativo",
 E:"Endoscopia",MRia:"Mattina Rianimazione",GRia:"Guardia Rianimazione",NRia:"Notte Rianimazione",
 RG:"Reperibilità giorno",RN:"Reperibilità notte",RP:"Reperibilità pomeriggio",SN:"Smonto notte",FT:"Fuori turno"
};

function buildCalendar(year:number,month:number){
 const first=new Date(year,month,1);
 const days=new Date(year,month+1,0).getDate();
 const offset=(first.getDay()+6)%7;
 const cells:(number|null)[]=Array(offset).fill(null);
 for(let d=1;d<=days;d++)cells.push(d);
 while(cells.length%7)cells.push(null);
 return cells;
}
function dateKey(year:number,month:number,day:number){
 return String(year)+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}

export default function GeneralShifts(){
 const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [validated,setValidated]=useState(false);
 const [shifts,setShifts]=useState<any[]>([]);
 const [profiles,setProfiles]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const year=current.getFullYear();
 const month=current.getMonth();

 useEffect(()=>{
  (async()=>{
   setLoading(true);setError("");
   const s=createClient();
   const {data:{user}}=await s.auth.getUser();
   if(!user){setError("Accesso non valido.");setLoading(false);return}
   const {data:status,error:statusError}=await s.from("calendar_month_status").select("validated").eq("year",year).eq("month",month+1).maybeSingle();
   if(statusError){setError(statusError.message);setLoading(false);return}
   setValidated(Boolean(status?.validated));
   if(status?.validated){
    const from=String(year)+"-"+String(month+1).padStart(2,"0")+"-01";
    const to=String(year)+"-"+String(month+1).padStart(2,"0")+"-"+String(new Date(year,month+1,0).getDate()).padStart(2,"0");
    const [{data:rows,error:rowsError},{data:ps,error:profilesError}]=await Promise.all([
     s.from("calendar_shifts").select("id,user_id,shift_date,short_name").gte("shift_date",from).lte("shift_date",to).order("shift_date").order("short_name"),
     s.from("profiles").select("id,username")
    ]);
    if(rowsError||profilesError){setError(rowsError?.message||profilesError?.message||"Errore nel caricamento.");setLoading(false);return}
    setShifts((rows||[]).filter((x:any)=>x.short_name!=="SN"));
    setProfiles(Object.fromEntries((ps||[]).map((p:any)=>[p.id,p.username])));
   }else setShifts([]);
   setLoading(false);
  })();
 },[year,month]);

 const cells=useMemo(()=>buildCalendar(year,month),[year,month]);
 const byDate=useMemo(()=>shifts.reduce<Record<string,any[]>>((acc,x)=>{(acc[x.shift_date]??=[]).push(x);return acc},{}),[shifts]);

 return <div className="shell">
  <header className="appbar"><a className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</a><UserMenu/></header>
  <main className="main"><BackButton/>
   <div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Turni generali</h1><p className="sub">Calendario dei turni convalidati del mese.</p></div></div>
   {error&&<div className="error">{error}</div>}
   <section className="calendar-card">
    <div className="calendar-head">
     <button className="icon-btn" onClick={()=>setCurrent(new Date(year,month-1,1))}><ChevronLeft size={20}/></button>
     <div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{year}</p><h2>{new Intl.DateTimeFormat("it-IT",{month:"long"}).format(current).replace(/^./,x=>x.toUpperCase())}</h2></div>
     <button className="icon-btn" onClick={()=>setCurrent(new Date(year,month+1,1))}><ChevronRight size={20}/></button>
    </div>
    {loading?<p className="muted" style={{marginTop:18}}>Caricamento…</p>:!validated?
      <div className="card" style={{marginTop:18,textAlign:"center"}}><h2 style={{marginTop:0}}>Turni non ancora convalidati</h2><p className="muted">Il calendario di questo mese sarà visibile qui dopo la convalida da parte dell'amministrazione.</p></div>
      :
      <div className="calendar" style={{marginTop:18}}>
       {weekdays.map(d=><div className="dow" key={d}>{d}</div>)}
       {cells.map((day,i)=>!day?<div className="day empty" key={i}/>:<div className="day general-shifts-day" key={i} role="button" tabIndex={0} aria-label={"Visualizza le assegnazioni del "+day+" "+new Intl.DateTimeFormat("it-IT",{month:"long"}).format(current)} onClick={()=>setSelectedDate(dateKey(year,month,day))} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedDate(dateKey(year,month,day));}}}><div className="date">{day}</div><div className="cell-shifts">{(byDate[dateKey(year,month,day)]||[]).map(x=><div className="calendar-shift-chip" key={x.id}><strong>{x.short_name}</strong> <span>{profiles[x.user_id]||"—"}</span></div>)}</div><span className="general-cell-hint">Dettagli</span></div>)}
      </div>
    }
   </section>
   {selectedDate&&<div className="modal-backdrop" onClick={()=>setSelectedDate(null)}><section className="modal general-shifts-modal" role="dialog" aria-modal="true" aria-labelledby="general-shifts-detail-title" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow" style={{margin:"0 0 5px"}}>Dettaglio assegnazioni</p><h2 id="general-shifts-detail-title">{new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(selectedDate+"T12:00:00"))}</h2></div><button className="icon-btn" aria-label="Chiudi dettagli" onClick={()=>setSelectedDate(null)}>×</button></div>{(byDate[selectedDate]||[]).length===0?<p className="muted" style={{margin:"16px 0"}}>Nessun turno assegnato in questa giornata.</p>:<div className="day-assignment-list">{(byDate[selectedDate]||[]).map(x=><div className="assignment-row general-assignment-row" key={x.id}><div className="general-assignment-shift"><strong>{x.short_name}</strong><span>{labels[x.short_name]||x.short_name}</span></div><div className="general-assignment-person">{profiles[x.user_id]||"Dipendente non disponibile"}</div></div>)}</div>}<button className="btn btn-secondary" style={{width:"100%"}} onClick={()=>setSelectedDate(null)}>Chiudi</button></section></div>}
  </main>
 </div>;
}
