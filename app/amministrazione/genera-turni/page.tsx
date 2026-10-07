"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight,Pencil,Trash2,X} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import {createClient} from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";

type User={id:string;username:string;role:string};
type Assignment={id:number;user_id:string;shift_date:string;short_name:string;shift_type:string|null;source:string;status:string;notes:string|null};
type Request={id:number;user_id:string;request_date:string;request_types:string[];notes:string|null;username?:string};
type Vacation={id:number;user_id:string;start_date:string;end_date:string;notes:string|null;username?:string};
type Def={id:number;shift_type:string;short_name:string;duration_minutes:number};
type Rule={id:number;code:string;name:string;description:string;enabled:boolean;config:any};

const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const weekDays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function iso(y:number,m:number,d:number){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function buildCalendar(y:number,m:number){const first=new Date(y,m,1);const off=(first.getDay()+6)%7;const days=new Date(y,m+1,0).getDate();return [...Array(off).fill(null),...Array.from({length:days},(_,i)=>i+1)];}
function easterSunday(year:number){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;return new Date(year,month,day);}
function holidayName(date:string){const [y,m,d]=date.split("-").map(Number);const fixed:[number,number,string][]=[[1,1,"Capodanno"],[1,6,"Epifania"],[4,25,"Liberazione"],[5,1,"Festa del Lavoro"],[6,2,"Festa della Repubblica"],[8,15,"Ferragosto"],[11,1,"Ognissanti"],[12,8,"Immacolata"],[12,25,"Natale"],[12,26,"Santo Stefano"]];for(const [mm,dd,n] of fixed)if(m===mm&&d===dd)return n;const e=easterSunday(y);e.setDate(e.getDate()+1);if(e.getMonth()+1===m&&e.getDate()===d)return "Lunedì dell'Angelo";return null;}
function isWeekend(date:string){const [y,m,d]=date.split("-").map(Number);const w=new Date(y,m-1,d).getDay();return w===0||w===6;}
function fmtDate(v:string){return new Date(v+"T00:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});}
function requestBlocksCode(r:any,code:string){
  if(!r?.request_types?.length)return false;
  if(r.request_types.includes("non_lavorare"))return true;
  if(r.request_types.includes("notte")&&code==="N")return true;
  if(r.request_types.includes("guardia")&&["G","Gm","Gp"].includes(code))return true;
  if(r.request_types.includes("mattina")&&["M1","M2","M3","Mo1","Mo2"].includes(code))return true;
  if(r.request_types.includes("pomeriggio")&&code==="P")return true;
  return false;
}


export default function GenerateShifts(){
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [users,setUsers]=useState<User[]>([]);
  const [defs,setDefs]=useState<Def[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [requests,setRequests]=useState<Request[]>([]);
  const [vacations,setVacations]=useState<Vacation[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [requestDate,setRequestDate]=useState<string|null>(null);
  const [requestKind,setRequestKind]=useState<"vacation"|"desiderata">("desiderata");
  const [editId,setEditId]=useState<number|null>(null);
  const [form,setForm]=useState({user_id:"",short_name:"",notes:""});
  const [manualRows,setManualRows]=useState([{user_id:"",short_name:"",notes:""}]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [conflictDates,setConflictDates]=useState<string[]>([]);

  const load=async()=>{
    const s=createClient(); const {data:{user}}=await s.auth.getUser();
    if(!user){setAuthorized(false);return;}
    const [{data:p},{data:r}]=await Promise.all([s.from("profiles").select("role").eq("id",user.id).single(),s.rpc("get_my_role")]);
    const role=String(p?.role||r||"utente").toLowerCase(); setAuthorized(["admin","super_admin"].includes(role)); if(!["admin","super_admin"].includes(role))return;
    const y=current.getFullYear(),m=current.getMonth(),start=iso(y,m,1),end=iso(y,m,new Date(y,m+1,0).getDate()),prev=iso(y,m,0);
    const [{data:us},{data:ds},{data:as},{data:req},{data:vac},{data:rr}]=await Promise.all([
      s.from("profiles").select("id,username,role").order("username"),
      s.from("shift_definitions").select("id,shift_type,short_name,duration_minutes").order("short_name"),
      s.from("calendar_shifts").select("*").gte("shift_date",start).lte("shift_date",end).order("shift_date").order("short_name"),
      s.from("requests").select("id,user_id,request_date,request_types,notes").gte("request_date",start).lte("request_date",end),
      s.from("vacations").select("id,user_id,start_date,end_date,notes").or(`start_date.lte.${end},end_date.gte.${start}`),
      s.from("generator_constraints").select("*").order("id")
    ]);
    setUsers(us||[]);setDefs(ds||[]);setAssignments(as||[]);setRequests(req||[]);setVacations(vac||[]);setRules(rr||[]);
    // Load the previous month's last day N as context; it is used by the automatic generator.
    if(prev){const {data:old}=await s.from("calendar_shifts").select("*").eq("shift_date",prev);if(old)setAssignments(a=>(as||[]).concat(old));}
  };
  useEffect(()=>{load()},[current]);

  const cells=useMemo(()=>buildCalendar(current.getFullYear(),current.getMonth()),[current]);
  const hasVacation=(date:string)=>vacations.some(v=>v.start_date<=date&&v.end_date>=date);
  const hasDesiderata=(date:string)=>requests.some(r=>r.request_date===date);
  const requestCount=(date:string)=>requests.filter(r=>r.request_date===date).length;
  const vacationCount=(date:string)=>vacations.filter(v=>v.start_date<=date&&v.end_date>=date).length;

  function openDay(date:string){setSelectedDate(date);setEditId(null);setForm({user_id:users[0]?.id||"",short_name:defs[0]?.short_name||"SN",notes:""});setManualRows([{user_id:users[0]?.id||"",short_name:defs[0]?.short_name||"SN",notes:""}]);setMessage("");setError("");}
  function editAssignment(a:Assignment){setEditId(a.id);setForm({user_id:a.user_id,short_name:a.short_name,notes:a.notes||""});setError("");}
  async function saveAssignment(e:FormEvent){e.preventDefault();if(!selectedDate)return;setBusy(true);setError("");const s=createClient();try{if(editId){if(!form.user_id||!form.short_name)throw new Error("Seleziona dipendente e turno.");const def=defs.find(d=>d.short_name===form.short_name);const {error:err}=await s.from("calendar_shifts").update({user_id:form.user_id,shift_date:selectedDate,short_name:form.short_name,shift_type:def?.shift_type||null,source:"manual",status:"confirmed",notes:form.notes||null}).eq("id",editId);if(err)throw new Error(err.code==="23505"?"Questo utente ha già lo stesso turno in questa giornata.":err.message);setMessage("Turno modificato.");setEditId(null);}else{const rows=manualRows.filter(r=>r.user_id&&r.short_name);if(!rows.length)throw new Error("Inserisci almeno un dipendente e un turno.");const payload=rows.map(r=>{const def=defs.find(d=>d.short_name===r.short_name);return {user_id:r.user_id,shift_date:selectedDate,short_name:r.short_name,shift_type:def?.shift_type||null,source:"manual",status:"confirmed",notes:r.notes||null}});const {error:err}=await s.from("calendar_shifts").insert(payload);if(err)throw new Error(err.code==="23505"?"Uno dei turni selezionati esiste già per questo utente nella giornata.":err.message);setMessage(`${payload.length} turni inseriti.`);setManualRows([{user_id:users[0]?.id||"",short_name:"SN",notes:""}]);}await load();}catch(err){setError(err instanceof Error?err.message:"Errore durante il salvataggio.");}finally{setBusy(false);}}
  async function deleteAssignment(id:number){if(!confirm("Eliminare questo turno?"))return;const {error:e}=await createClient().from("calendar_shifts").delete().eq("id",id);if(e)setError(e.message);else{setMessage("Turno eliminato.");await load();}}
  
  async function generate(){if(!confirm("Generare una nuova bozza automatica per questo mese? I turni manuali non verranno modificati. Le eventuali bozze automatiche precedenti del mese verranno sostituite."))return;setBusy(true);setError("");setMessage("");try{
    const s=createClient(); const y=current.getFullYear(),m=current.getMonth(),start=iso(y,m,1),end=iso(y,m,new Date(y,m+1,0).getDate()),prev=iso(y,m,0);
    await s.from("calendar_shifts").delete().eq("source","automatic").eq("status","draft").gte("shift_date",start).lte("shift_date",end);
    const [{data:manual},{data:old},{data:req},{data:vac}]=await Promise.all([
      s.from("calendar_shifts").select("*").gte("shift_date",start).lte("shift_date",end),
      s.from("calendar_shifts").select("*").eq("shift_date",prev),
      s.from("requests").select("*").gte("request_date",start).lte("request_date",end),
      s.from("vacations").select("*").or(`start_date.lte.${end},end_date.gte.${start}`)
    ]);
    const batch=crypto.randomUUID(); const existing=(manual||[]).filter((a:any)=>a.source==="manual"||a.status==="confirmed");
    const added: any[]=[]; const has=(uid:string,date:string,code:string)=>existing.concat(added).some(a=>a.user_id===uid&&a.shift_date===date&&a.short_name===code);
    const any=(uid:string,date:string)=>existing.concat(added).some(a=>a.user_id===uid&&a.shift_date===date&&a.short_name!=="SN");
    const vacation=(uid:string,date:string)=>((vac||[]) as any[]).some(v=>v.user_id===uid&&v.start_date<=date&&v.end_date>=date);
    const reqFor=(uid:string,date:string)=>((req||[]) as any[]).find(r=>r.user_id===uid&&r.request_date===date);
    const restRule=rules.find(r=>r.code==="rest_after_night"&&r.enabled);
    const canWork=(uid:string,date:string,code:string)=>{
      if(vacation(uid,date))return false;
      const r=reqFor(uid,date); if(requestBlocksCode(r,code))return false;
      if(restRule?.enabled){const d=new Date(date+"T00:00:00");d.setDate(d.getDate()-1);const pd=iso(d.getFullYear(),d.getMonth(),d.getDate());const hadN=existing.concat(added).some(a=>a.user_id===uid&&a.shift_date===pd&&a.short_name==="N")||((old||[]) as any[]).some(a=>a.user_id===uid&&a.short_name==="N");if(hadN)return false;}
      return !any(uid,date);
    };
    const score=(uid:string,date:string,code:string)=>{let n=0;const r=reqFor(uid,date);if(r?.request_types?.includes(code==="N"?"notte":code==="G"?"guardia":code.startsWith("M")?"mattina":"non_lavorare"))n+=100;const prevd=new Date(date+"T00:00:00");prevd.setDate(prevd.getDate()-1);const pd=iso(prevd.getFullYear(),prevd.getMonth(),prevd.getDate());const total=existing.concat(added).filter(a=>a.user_id===uid).length;const sameCode=existing.concat(added).filter(a=>a.user_id===uid&&a.short_name===code).length;const counts=users.map(u=>existing.concat(added).filter(a=>a.user_id===u.id&&a.short_name===code).length);const maxCount=Math.max(0,...counts);n-=total*3;n-=sameCode*25;n-=Math.max(0,maxCount-sameCode)*18;if(existing.concat(added).some(a=>a.user_id===uid&&a.shift_date===pd))n-=8;return n+Math.random();};
    const add=(uid:string,date:string,code:string)=>{const d=defs.find(x=>x.short_name===code);added.push({user_id:uid,shift_date:date,short_name:code,shift_type:d?.shift_type||null,source:"automatic",status:"draft",generation_batch:batch,notes:null});};
    for(let day=1;day<=new Date(y,m+1,0).getDate();day++){
      const date=iso(y,m,day);const weekend=isWeekend(date);const eligible=(code:string)=>users.filter(u=>canWork(u.id,date,code)).sort((a,b)=>score(b.id,date,code)-score(a.id,date,code));
      const need=weekend?["G","N"]:["M1","M2","M3","G","N"];
      for(const code of need){if(rules.some(r=>r.code==="weekend_guard"&&!r.enabled)&&weekend&&code==="G")continue;if(rules.some(r=>r.code==="weekend_night"&&!r.enabled)&&weekend&&code==="N")continue;if(!weekend&&code.startsWith("M")&&!rules.some(r=>r.code==="weekday_morning_rooms"&&r.enabled))continue;if(!rules.some(r=>r.code==="daily_guard"&&r.enabled)&&code==="G")continue;if(!rules.some(r=>r.code==="daily_night"&&r.enabled)&&code==="N")continue;const cand=eligible(code).filter(u=>!has(u.id,date,code));if(cand[0])add(cand[0].id,date,code);}
      if(restRule?.enabled){for(const u of users){const d0=new Date(date+"T00:00:00");d0.setDate(d0.getDate()-1);const pd=iso(d0.getFullYear(),d0.getMonth(),d0.getDate());const hadN=existing.concat(added).some(a=>a.user_id===u.id&&a.shift_date===pd&&a.short_name==="N")||((old||[]) as any[]).some(a=>a.user_id===u.id&&a.short_name==="N");if(hadN&&!has(u.id,date,"SN")){const sd=defs.find(x=>x.short_name==="SN");added.push({user_id:u.id,shift_date:date,short_name:"SN",shift_type:sd?.shift_type||"Smonto notte",source:"automatic",status:"draft",generation_batch:batch,notes:"Smonto notte automatico"});}}}
    }
    if(added.length){const {error:e}=await s.from("calendar_shifts").insert(added);if(e)throw e;}
    const generated=existing.concat(added);
    const conflicts=new Map<string,string[]>();
    const addConflict=(date:string,detail:string)=>conflicts.set(date,[...(conflicts.get(date)||[]),detail]);
    for(const a of generated){
      if(a.source!=="automatic"&&a.status!=="draft")continue;
      const vacHit=((vac||[]) as any[]).find(v=>v.user_id===a.user_id&&v.start_date<=a.shift_date&&v.end_date>=a.shift_date);
      const reqHit=((req||[]) as any[]).find(r=>r.user_id===a.user_id&&r.request_date===a.shift_date&&requestBlocksCode(r,a.short_name));
      const username=users.find(u=>u.id===a.user_id)?.username||"Utente";
      if(vacHit)addConflict(a.shift_date,`${username}: ferie`);
      if(reqHit)addConflict(a.shift_date,`${username}: desiderata`);
    }
    const criticalDates=[...conflicts.keys()].sort();
    setConflictDates(criticalDates);
    setMessage(`Bozza generata: ${added.length} assegnazioni. I turni manuali sono stati mantenuti.`);
    await load();
    if(criticalDates.length){
      window.alert("ATTENZIONE: non è stato possibile rispettare tutti i vincoli di ferie/desiderate.\\n\\nDate critiche:\\n"+criticalDates.map(d=>fmtDate(d)+" — "+[...new Set(conflicts.get(d)||[])].join(", ")).join("\\n")+"\\n\\nSono stati comunque proposti i turni necessari. Le giornate critiche sono evidenziate in rosso nel calendario.");
    }
    window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:"Errore durante la generazione automatica.");}finally{setBusy(false)}}

  if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
  if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

  return <div className="shell"><header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
  <main className="main"><BackButton/><div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Genera nuovi turni</h1><p className="sub">Calendario mensile operativo. Le celle sono modificabili manualmente.</p></div><div className="generator-links"><button className="generator-auto-link" onClick={generate} disabled={busy}>Generatore automatico</button><Link href="/amministrazione/modifica-generatore">Modifica Generatore</Link></div></div>
  {message&&<div className="success">{message}</div>}{error&&<div className="error">{error}</div>}
  <section className="calendar-card"><div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{current.getFullYear()}</p><h2>{monthNames[current.getMonth()]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()+1,1))}><ChevronRight size={20}/></button></div>
  <div className="calendar admin-month-grid">{weekDays.map(d=><div className="dow" key={d}>{d}</div>)}{cells.map((day,i)=>{if(!day)return <div className="day empty" key={i}/>;const date=iso(current.getFullYear(),current.getMonth(),day),holiday=holidayName(date),weekend=isWeekend(date),list=assignments.filter(a=>a.shift_date===date);const persistedConflict=list.some(a=>{const v=vacations.some(x=>x.user_id===a.user_id&&x.start_date<=date&&x.end_date>=date);const r=requests.find(x=>x.user_id===a.user_id&&x.request_date===date);return v||requestBlocksCode(r,a.short_name)});const critical=conflictDates.includes(date)||persistedConflict;return <div className={`day generation-day ${weekend?"weekend-day":""} ${holiday?"holiday-day":""} ${hasVacation(date)?"has-vacation":""} ${hasDesiderata(date)?"has-desiderata":""} ${critical?"generation-conflict":""}`} key={i} onClick={()=>openDay(date)}><div className="date-row"><span className="date">{day}</span>{hasVacation(date)&&<button className="request-dot vacation-dot" aria-label={vacationCount(date)+` ferie il ${fmtDate(date)}`} title={vacationCount(date)+` ferie il ${fmtDate(date)}`} onClick={e=>{e.stopPropagation();setRequestKind("vacation");setRequestDate(date)}}/>}{hasDesiderata(date)&&<button className="request-dot desiderata-dot" aria-label={requestCount(date)+` desiderata il ${fmtDate(date)}`} title={requestCount(date)+` desiderata il ${fmtDate(date)}`} onClick={e=>{e.stopPropagation();setRequestKind("desiderata");setRequestDate(date)}}/>}</div>{holiday&&<div className="holiday-label">{holiday}</div>}<div className="cell-shifts">{list.map(a=><div key={a.id} className={`calendar-shift-chip ${a.source==="automatic"?"draft-shift":""}`}><strong>{a.short_name}</strong> <span>{users.find(u=>u.id===a.user_id)?.username||"—"}</span></div>)}</div><div className="cell-edit-hint">modifica</div></div>})}</div></section>
  <p className="muted calendar-note"><span><span className="legend-swatch weekend-swatch"/> Sabato/Domenica</span><span><span className="legend-swatch holiday-swatch"/> Festività nazionale</span><span><span className="request-dot static vacation-dot"/> Ferie</span><span><span className="request-dot static desiderata-dot"/> Desiderata</span><span><span className="draft-mini"/> Bozza automatica</span></p></main>
  {selectedDate&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedDate(null)}><div className="modal wide-modal"><div className="modal-head"><div><p className="eyebrow">Programmazione giornaliera</p><h2>{fmtDate(selectedDate)}</h2></div><button className="icon-btn" onClick={()=>setSelectedDate(null)}><X size={21}/></button></div><div className="day-assignment-list">{assignments.filter(a=>a.shift_date===selectedDate).map(a=><div className="assignment-row" key={a.id}><span className={a.source==="automatic"?"draft-badge":""}><strong>{a.short_name}</strong> · {users.find(u=>u.id===a.user_id)?.username}</span><span className="assignment-actions">{a.status==="draft"&&<small>BOZZA</small>}<button className="icon-btn edit" onClick={()=>editAssignment(a)}><Pencil size={16}/></button><button className="icon-btn delete" onClick={()=>deleteAssignment(a.id)}><Trash2 size={16}/></button></span></div>)}{assignments.filter(a=>a.shift_date===selectedDate).length===0&&<p className="muted">Nessun turno presente.</p>}</div><form onSubmit={saveAssignment} className="manual-shift-form"><h3>{editId?"Modifica turno":"Inserisci turni manuali"}</h3>{editId?<div className="modal-grid"><div className="field"><label>Dipendente</label><select required value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}>{users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}</select></div><div className="field"><label>Turno</label><select required value={form.short_name} onChange={e=>setForm({...form,short_name:e.target.value})}>{defs.map(d=><option key={d.id} value={d.short_name}>{d.short_name} — {d.shift_type}</option>)}</select></div></div>:manualRows.map((row,i)=><div className="modal-grid manual-entry-row" key={i}><div className="field"><label>Dipendente {i+1}</label><select required value={row.user_id} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,user_id:e.target.value}:r))}>{users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}</select></div><div className="field"><label>Turno</label><select required value={row.short_name} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,short_name:e.target.value}:r))}>{defs.map(d=><option key={d.id} value={d.short_name}>{d.short_name} — {d.shift_type}</option>)}</select></div><div className="field"><label>Note</label><input value={row.notes} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,notes:e.target.value}:r))}/></div>{manualRows.length>1&&<button type="button" className="icon-btn delete" onClick={()=>setManualRows(rs=>rs.filter((_,j)=>j!==i))} aria-label="Rimuovi riga"><Trash2 size={16}/></button>}</div>)}{!editId&&<button type="button" className="btn btn-secondary" onClick={()=>setManualRows(rs=>[...rs,{user_id:users[0]?.id||"",short_name:"SN",notes:""}])}>+ Aggiungi altro turno</button>}<div className="row"><button type="button" className="btn btn-secondary" onClick={()=>{setEditId(null);setManualRows([{user_id:users[0]?.id||"",short_name:"SN",notes:""}])}}>Nuovo</button><button className="btn btn-primary" disabled={busy}>{editId?"Salva modifica":"Inserisci turni"}</button></div></form></div></div>}
  {requestDate&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setRequestDate(null)}><div className="modal"><div className="modal-head"><div><p className="eyebrow">{requestKind==="vacation"?"Ferie":"Desiderate"}</p><h2>{requestKind==="vacation"?"Periodi di ferie":"Richieste del "+fmtDate(requestDate)}</h2></div><button className="icon-btn" onClick={()=>setRequestDate(null)}><X size={21}/></button></div>{requestKind==="vacation"?vacations.filter(v=>v.start_date<=requestDate&&v.end_date>=requestDate).map((v,i)=><div className="request-detail-row" key={`v-${i}`}><strong>{users.find(u=>u.id===v.user_id)?.username||"Utente"}</strong><span>Dal <strong>{fmtDate(v.start_date)}</strong> al <strong>{fmtDate(v.end_date)}</strong>{v.notes&&` — ${v.notes}`}</span></div>):requests.filter(r=>r.request_date===requestDate).map((r,i)=><div className="request-detail-row" key={i}><strong>{users.find(u=>u.id===r.user_id)?.username||"Utente"}</strong><span>{r.request_types.join(", ")}{r.notes&&` — ${r.notes}`}</span></div>)}</div></div>}
  </div>;
}
