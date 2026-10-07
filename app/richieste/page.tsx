"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,Pencil,Plus,X} from "lucide-react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

const types=[["non_lavorare","Non lavorare"],["guardia","Guardia"],["mattina","Mattina"],["pomeriggio","Pomeriggio"],["notte","Notte"]] as const;
type RequestRow={id:number;request_date:string;request_types:string[];notes:string|null;created_at:string};
type VacationRow={id:number;start_date:string;end_date:string;notes:string|null;created_at:string};
type HistoryRow={kind:"desiderata"|"ferie";id:number;created_at:string;dateLabel:string;detail:string};

const typeLabel=(value:string)=>types.find(([key])=>key===value)?.[1]||value;
const formatDate=(value:string)=>new Date(value+"T12:00:00").toLocaleDateString("it-IT");
const formatDateTime=(value:string)=>new Date(value).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});

export default function Requests(){
  const [open,setOpen]=useState<"desiderata"|"ferie"|null>(null);
  const [editing,setEditing]=useState<HistoryRow|null>(null);
  const [date,setDate]=useState("");
  const [selected,setSelected]=useState<string[]>(["non_lavorare"]);
  const [notes,setNotes]=useState("");
  const [dates,setDates]=useState<string[]>([]);
  const [vacStart,setVacStart]=useState("");
  const [vacEnd,setVacEnd]=useState("");
  const [vacNotes,setVacNotes]=useState("");
  const [requests,setRequests]=useState<RequestRow[]>([]);
  const [vacations,setVacations]=useState<VacationRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const history=useMemo<HistoryRow[]>(()=>[
    ...requests.map(x=>({kind:"desiderata" as const,id:x.id,created_at:x.created_at,dateLabel:formatDate(x.request_date),detail:x.request_types.map(typeLabel).join(" · ")+(x.notes?" · "+x.notes:"")})),
    ...vacations.map(x=>({kind:"ferie" as const,id:x.id,created_at:x.created_at,dateLabel:formatDate(x.start_date)+" – "+formatDate(x.end_date),detail:x.notes||"Periodo ferie"}))
  ].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[requests,vacations]);

  async function load(){
    setLoading(true);
    const s=createClient();
    const {data:{user}}=await s.auth.getUser();
    if(!user){setError("Sessione scaduta.");setLoading(false);return}
    const [r,v]=await Promise.all([
      s.from("requests").select("id,request_date,request_types,notes,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
      s.from("vacations").select("id,start_date,end_date,notes,created_at").eq("user_id",user.id).order("created_at",{ascending:false})
    ]);
    if(r.error||v.error)setError(r.error?.message||v.error?.message||"Impossibile caricare le richieste.");
    else{setRequests((r.data||[]) as RequestRow[]);setVacations((v.data||[]) as VacationRow[])}
    setLoading(false);
  }

  useEffect(()=>{load()},[]);

  function resetModal(){
    setOpen(null);setEditing(null);setDate("");setSelected(["non_lavorare"]);setNotes("");setDates([]);
    setVacStart("");setVacEnd("");setVacNotes("");setError("");
  }

  function startNew(kind:"desiderata"|"ferie"){
    setMessage("");setError("");setEditing(null);setOpen(kind);
    if(kind==="desiderata"){setDate("");setSelected(["non_lavorare"]);setNotes("");setDates([])}
    else{setVacStart("");setVacEnd("");setVacNotes("")}
  }

  function startEdit(row:HistoryRow){
    setMessage("");setError("");setEditing(row);setOpen(row.kind);
    if(row.kind==="desiderata"){
      const item=requests.find(x=>x.id===row.id);if(!item)return;
      setDate(item.request_date);setSelected(item.request_types||[]);setNotes(item.notes||"");setDates([]);
    }else{
      const item=vacations.find(x=>x.id===row.id);if(!item)return;
      setVacStart(item.start_date);setVacEnd(item.end_date);setVacNotes(item.notes||"");
    }
  }

  function toggleType(value:string){setSelected(current=>current.includes(value)?current.filter(x=>x!==value):[...current,value])}

  function addDate(){
    setError("");
    if(!date||!selected.length){setError("Seleziona una data e almeno una tipologia.");return}
    if(dates.includes(date)){setError("Questa data è già presente nella richiesta.");return}
    setDates(current=>[...current,date].sort());setDate("");
  }

  async function saveDesiderata(){
    setError("");setMessage("");setSaving(true);
    const s=createClient();const {data:{user}}=await s.auth.getUser();
    if(!user){setError("Sessione scaduta.");setSaving(false);return}
    if(editing?.kind==="desiderata"){
      if(!date||!selected.length){setError("Seleziona una data e almeno una tipologia.");setSaving(false);return}
      const {error:e}=await s.from("requests").update({request_date:date,request_types:selected,notes:notes||null,updated_at:new Date().toISOString()}).eq("id",editing.id).eq("user_id",user.id);
      if(e){setError(e.message);setSaving(false);return}
    }else{
      const allDates=[...dates];if(date)allDates.push(date);const uniqueDates=[...new Set(allDates)];
      if(!uniqueDates.length||!selected.length){setError("Aggiungi almeno un giorno e una tipologia.");setSaving(false);return}
      const {error:e}=await s.from("requests").upsert(uniqueDates.map(request_date=>({user_id:user.id,request_date,request_types:selected,notes:notes||null})),{onConflict:"user_id,request_date"});
      if(e){setError(e.message);setSaving(false);return}
    }
    await load();setSaving(false);resetModal();setMessage(editing?"Desiderata modificata correttamente.":"Desiderate inviate correttamente.");
  }

  async function saveFerie(){
    setError("");setMessage("");setSaving(true);
    const s=createClient();const {data:{user}}=await s.auth.getUser();
    if(!user){setError("Sessione scaduta.");setSaving(false);return}
    if(!vacStart||!vacEnd||vacEnd<vacStart){setError("Inserisci un intervallo ferie valido.");setSaving(false);return}
    if(editing?.kind==="ferie"){
      const {error:e}=await s.from("vacations").update({start_date:vacStart,end_date:vacEnd,notes:vacNotes||null}).eq("id",editing.id).eq("user_id",user.id);
      if(e){setError(e.message);setSaving(false);return}
    }else{
      const {error:e}=await s.from("vacations").insert({user_id:user.id,start_date:vacStart,end_date:vacEnd,notes:vacNotes||null});
      if(e){setError(e.message);setSaving(false);return}
    }
    await load();setSaving(false);resetModal();setMessage(editing?"Periodo ferie modificato correttamente.":"Periodo ferie inviato correttamente.");
  }

  async function remove(row:HistoryRow){
    if(!window.confirm("Sei sicuro di voler cancellare questa richiesta?"))return;
    setError("");setMessage("");const s=createClient();const table=row.kind==="desiderata"?"requests":"vacations";
    const {error:e}=await s.from(table).delete().eq("id",row.id);
    if(e){setError(e.message);return}
    if(row.kind==="desiderata")setRequests(current=>current.filter(x=>x.id!==row.id));
    else setVacations(current=>current.filter(x=>x.id!==row.id));
    setMessage("Richiesta cancellata correttamente.");
  }

  return <div className="shell">
    <header className="appbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link>
      <nav className="nav"><Link href="/dashboard">I miei turni</Link><Link href="/turni-generali">Turni generali</Link><Link href="/richieste">Invia richieste</Link><Link href="/profilo">Profilo</Link></nav>
      <form action="/auth/signout" method="post"><button className="btn btn-secondary">Esci</button></form>
    </header>

    <main className="main">
      <p className="eyebrow">Disponibilità</p><h1 className="title">Invia richieste</h1>
      <p className="sub">Gestisci desiderate e periodi di ferie e consulta lo storico delle richieste inviate.</p>
      {message&&<div className="success">{message}</div>}
      {error&&!open&&<div className="error">{error}</div>}

      <div className="request-links">
        <button className="request-link-card" onClick={()=>startNew("desiderata")}><span><strong>Inserimento Desiderata</strong><small>Seleziona anche più giorni non contigui.</small></span><Plus size={22}/></button>
        <button className="request-link-card" onClick={()=>startNew("ferie")}><span><strong>Inserimento Ferie</strong><small>Inserisci il periodo continuativo di ferie.</small></span><Plus size={22}/></button>
      </div>

      <section className="card request-history">
        <div className="history-head"><div><h2>Richieste inviate</h2><p className="muted">Visualizza, modifica o cancella le richieste già inserite.</p></div></div>
        {loading?<p className="muted">Caricamento...</p>:history.length===0?<div className="empty-history">Non hai ancora inviato richieste.</div>:
          <div className="table-wrap"><table className="requests-table"><thead><tr><th>Data invio</th><th>Tipologia</th><th>Data / periodo</th><th className="action-col">Modifica</th><th className="action-col">Cancella</th></tr></thead><tbody>
          {history.map(row=><tr key={row.kind+"-"+row.id}><td>{formatDateTime(row.created_at)}</td><td><span className={"type-badge "+(row.kind==="ferie"?"vacation":"desiderata")}>{row.kind==="ferie"?"Ferie":"Desiderata"}</span></td><td><strong>{row.dateLabel}</strong><div className="muted table-detail">{row.detail}</div></td><td className="action-cell"><button className="icon-btn edit" aria-label="Modifica richiesta" title="Modifica" onClick={()=>startEdit(row)}><Pencil size={17}/></button></td><td className="action-cell"><button className="icon-btn delete" aria-label="Cancella richiesta" title="Cancella" onClick={()=>remove(row)}><X size={19}/></button></td></tr>)}
          </tbody></table></div>}
      </section>
    </main>

    {open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)resetModal()}}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
        <div className="modal-head"><div><p className="eyebrow">{editing?"Modifica":"Nuova richiesta"}</p><h2 id="request-modal-title">{open==="desiderata"?"Inserimento Desiderata":"Inserimento Ferie"}</h2></div><button className="icon-btn" aria-label="Chiudi" onClick={resetModal}><X size={21}/></button></div>

        {open==="desiderata"?<div>
          <p className="modal-help">Puoi aggiungere tutti i giorni che desideri, anche se non sono consecutivi.</p>
          <div className="field"><label>Giorno</label><div className="date-add"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/>{!editing&&<button type="button" className="btn btn-secondary" onClick={addDate}><Plus size={16}/> Aggiungi</button>}</div></div>
          <div className="field"><label>Tipologie</label><div className="type-options">{types.map(([value,label])=><button type="button" key={value} className={"type-option "+(selected.includes(value)?"selected":"")} onClick={()=>toggleType(value)}>{label}</button>)}</div></div>
          {!editing&&dates.length>0&&<div className="selected-dates"><strong>Giorni selezionati</strong>{dates.map(item=><div className="selected-date" key={item}><span>{formatDate(item)}</span><button type="button" onClick={()=>setDates(current=>current.filter(x=>x!==item))}><X size={15}/></button></div>)}</div>}
          <div className="field"><label>Note</label><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Eventuali indicazioni..."/></div>
          {error&&<div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={saving} onClick={saveDesiderata}>{saving?"Salvataggio...":editing?"Salva modifiche":"Invia desiderate"}</button>
        </div>:<div>
          <p className="modal-help">Le ferie vengono inserite come un unico periodo continuativo.</p>
          <div className="modal-grid"><div className="field"><label>Dal</label><input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/></div><div className="field"><label>Al</label><input type="date" value={vacEnd} onChange={e=>setVacEnd(e.target.value)}/></div></div>
          <div className="field"><label>Note</label><textarea rows={3} value={vacNotes} onChange={e=>setVacNotes(e.target.value)} placeholder="Eventuali indicazioni..."/></div>
          {error&&<div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={saving} onClick={saveFerie}>{saving?"Salvataggio...":editing?"Salva modifiche":"Invia ferie"}</button>
        </div>}
      </div>
    </div>}
  </div>
}
