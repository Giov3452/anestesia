"use client";
import { useMemo, useState } from "react";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Lesson={id:string;starts_at:string;duration_minutes:number;status:string;notes:string|null;package_id:string|null};
export default function LessonsClient({initial}:{initial:Lesson[]}) {
 const [rows,setRows]=useState(initial),[date,setDate]=useState(""),[time,setTime]=useState("18:00"),[duration,setDuration]=useState("60"),[notes,setNotes]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const ordered=useMemo(()=>[...rows].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[rows]);
 async function add(){setError("");if(!date||!time){setError("Inserisci data e ora.");return}setBusy(true);const sb=createPersonalTrainerClient();const {data:{user}}=await sb.auth.getUser();if(!user){setError("Sessione non valida.");setBusy(false);return}const {data,error}=await sb.from("pt_lessons").insert({starts_at:new Date(date+"T"+time).toISOString(),duration_minutes:Number(duration),notes:notes.trim()||null,created_by:user.id,status:"scheduled"}).select("id,starts_at,duration_minutes,status,notes,package_id").single();if(error)setError(error.message);else{setRows(v=>[...v,data as Lesson]);setDate("");setNotes("")}setBusy(false)}
 async function changeStatus(id:string,status:string){setError("");const sb=createPersonalTrainerClient();const current=rows.find(x=>x.id===id);if(!current)return;let packageId=current.package_id;
  if(status==="completed"&&!packageId){
   const {data:packages,error:packagesError}=await sb.from("pt_packages").select("id,total_lessons").order("created_at",{ascending:true});
   if(packagesError){setError("Impossibile verificare i pacchetti: "+packagesError.message);return}
   for(const pack of packages??[]){
    const {count,error:countError}=await sb.from("pt_lessons").select("id",{count:"exact",head:true}).eq("package_id",pack.id).eq("status","completed");
    if(countError){setError("Impossibile verificare le lezioni del pacchetto: "+countError.message);return}
    if((count??0)<Number(pack.total_lessons)){packageId=pack.id;break}
   }
  }
  const {error}=await sb.from("pt_lessons").update({status,package_id:packageId}).eq("id",id);
  if(error){setError(error.message);return}
  setRows(v=>v.map(x=>x.id===id?{...x,status,package_id:packageId}:x))
 }
 return <section className="pt-page"><div className="pt-eyebrow">APPUNTAMENTI CONDIVISI</div><h2>Calendario</h2><p className="pt-muted">Lezioni future e storico sono condivisi tra te e il personal trainer. Quando contrassegni una lezione come completata, viene scalata dal pacchetto più vecchio con disponibilità.</p>
 <div className="pt-card pt-section"><h3>Programma una lezione</h3><div className="pt-form-grid"><div className="pt-field"><label>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="pt-field"><label>Ora</label><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></div><div className="pt-field"><label>Durata</label><select value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">30 minuti</option><option value="45">45 minuti</option><option value="60">60 minuti</option><option value="75">75 minuti</option><option value="90">90 minuti</option><option value="120">120 minuti</option></select></div></div><div className="pt-field"><label>Note (facoltative)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Es. allenamento gambe"/></div><button className="pt-button" disabled={busy} onClick={add}>{busy?"Salvataggio…":"Aggiungi al calendario"}</button>{error&&<p className="pt-error">{error}</p>}</div>
 <div className="pt-section"><h3>Lezioni registrate</h3>{ordered.length===0?<div className="pt-empty">Ancora nessuna lezione. Aggiungi il primo appuntamento qui sopra.</div>:<div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Data e ora</th><th>Durata</th><th>Note</th><th>Stato</th><th>Azione</th></tr></thead><tbody>{ordered.map(x=><tr key={x.id}><td>{new Date(x.starts_at).toLocaleString("it-IT",{dateStyle:"medium",timeStyle:"short"})}</td><td>{x.duration_minutes} min</td><td>{x.notes||"—"}</td><td>{x.status==="scheduled"?"Programmato":x.status==="completed"?"Completato":"Annullato"}</td><td>{x.status==="scheduled"? <><button className="pt-secondary-button" onClick={()=>changeStatus(x.id,"completed")}>Completa</button> <button className="pt-secondary-button" onClick={()=>changeStatus(x.id,"cancelled")}>Annulla</button></>:<button className="pt-secondary-button" onClick={()=>changeStatus(x.id,"scheduled")}>Ripristina</button>}</td></tr>)}</tbody></table></div>}</div></section>
}
