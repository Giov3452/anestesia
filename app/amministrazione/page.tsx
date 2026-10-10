"use client";

import {FormEvent,useEffect,useState} from "react";
import {CalendarDays,ChevronRight,Pencil,Plus,Trash2,X,Settings,CalendarRange} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import {createClient} from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";

type User={id:string;username:string;email:string;role:string;employment_role:string;service:string;created_at:string};
type ShiftDefinition={id:number;shift_type:string;short_name:string;duration_minutes:number};


function durationLabel(minutes:number){
  const h=Math.floor(minutes/60),m=minutes%60;
  return h+"h"+(m?String(m).padStart(2,"0")+"min":"");
}
function formatDate(value:string){return new Date(value).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"})}

export default function Admin(){
  const [users,setUsers]=useState<User[]>([]);
  const [me,setMe]=useState<User|null>(null);
  const [definitions,setDefinitions]=useState<ShiftDefinition[]>([]);
  const [userForm,setUserForm]=useState({username:"",email:"",password:"",role:"utente",employment_role:"strutturato",service:"anestesia"});
  const [shiftForm,setShiftForm]=useState({shift_type:"Mattina",short_name:"M1",hours:"8",minutes:"0"});
  const [editingUser,setEditingUser]=useState<User|null>(null);
  const [editForm,setEditForm]=useState({username:"",email:"",password:"",role:"utente",employment_role:"strutturato",service:"anestesia"});
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [activePanel,setActivePanel]=useState<"shifts"|"generator"|null>(null);

  const load=async()=>{
    setLoading(true);const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return;
    const {data:p}=await s.from("profiles").select("id,username,email,role,employment_role,service,created_at").eq("id",user.id).single();
    const {data:myRole}=await s.rpc("get_my_role");const effectiveRole=String(p?.role||myRole||"utente").toLowerCase();
    const effectiveProfile=p?{...p,role:effectiveRole}:null;setMe(effectiveProfile);
    if(effectiveProfile&&["admin","super_admin"].includes(effectiveRole)){
      const [{data:us},{data:defs}]=await Promise.all([
        s.from("profiles").select("id,username,email,role,employment_role,service,created_at").order("username"),
        s.from("shift_definitions").select("id,shift_type,short_name,duration_minutes").order("shift_type").order("short_name")
      ]);
      setUsers(us||[]);setDefinitions((defs||[]) as ShiftDefinition[]);
    }
    setLoading(false);
  };
  useEffect(()=>{load()},[]);

  async function invoke(body:any){
    const {data,error}=await createClient().functions.invoke("admin-users",{body});
    if(error){
      const ctx=(error as any)?.context;
      if(ctx?.json){
        try{const body=await ctx.json();throw new Error(body?.error||error.message)}catch(e){if(e instanceof Error)throw e;}
      }
      throw error;
    }
    if(data?.error)throw new Error(data.error);
    return data;
  }

  async function createUser(e:FormEvent){
    e.preventDefault();setError("");setMessage("");setSaving(true);
    try{await invoke({action:"create",...userForm});setUserForm({username:"",email:"",password:"",role:"utente",employment_role:"strutturato",service:"anestesia"});setMessage("Utente creato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setSaving(false)}
  }

  function openEdit(u:User){setEditingUser(u);setEditForm({username:u.username,email:u.email,password:"",role:u.role,employment_role:u.employment_role||"strutturato",service:u.service||"anestesia"});setError("");setMessage("")}

  async function saveUser(e:FormEvent){
    e.preventDefault();if(!editingUser)return;setError("");setMessage("");setSaving(true);
    try{await invoke({action:"update",userId:editingUser.id,username:editForm.username,email:editForm.email,password:editForm.password||undefined,role:editForm.role,employment_role:editForm.employment_role,service:editForm.service});setEditingUser(null);setMessage("Utente modificato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setSaving(false)}
  }

  async function removeUser(id:string){
    if(!confirm("Eliminare definitivamente questo utente?"))return;setError("");setMessage("");
    try{await invoke({action:"delete",userId:id});setMessage("Utente eliminato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore")}
  }

  async function createShift(e:FormEvent){
    e.preventDefault();setError("");setMessage("");
    const hours=Number(shiftForm.hours),minutes=Number(shiftForm.minutes);
    if(!Number.isInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59){setError("Inserisci una durata valida.");return}
    const shift_type=shiftForm.shift_type.trim(),short_name=shiftForm.short_name.trim();
    if(!shift_type||!short_name){setError("Inserisci il tipo di turno e il nome breve.");return}
    if(!/^[A-Za-z0-9_-]{1,12}$/.test(short_name)){setError("Il nome breve può contenere solo lettere, numeri, trattini e underscore (max 12 caratteri).");return}
    const duration_minutes=hours*60+minutes;if(duration_minutes<=0){setError("La durata deve essere maggiore di zero.");return}
    setSaving(true);const s=createClient();
    const {error:err}=await s.from("shift_definitions").insert({shift_type,short_name,duration_minutes});
    if(err)setError(err.code==="23505"?"Esiste già un turno con questo nome breve.":err.message);else{setMessage("Nuovo tipo di turno inserito.");setShiftForm(x=>({...x,short_name:"",hours:"8",minutes:"0"}));await load()}
    setSaving(false);
  }

  async function removeShift(id:number){
    if(!confirm("Eliminare questo tipo di turno?"))return;setError("");setMessage("");
    const {error:e}=await createClient().from("shift_definitions").delete().eq("id",id);
    if(e)setError(e.message);else{setMessage("Tipo di turno eliminato.");await load()}
  }

  if(loading)return <main className="auth"><div>Caricamento…</div></main>;
  if(!me||!["admin","super_admin"].includes(me.role))return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

  return <div className="shell">
    <header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
    <main className="main"><BackButton/>
      <p className="eyebrow">Controllo sistema</p><h1 className="title">Dashboard amministrativa</h1><p className="sub">Gestione degli utenti, dei tipi di turno e generazione del calendario.</p>
      {message&&<div className="success">{message}</div>}{error&&<div className="error">{error}</div>}

      <div className="admin-dashboard-links">
        <button className="admin-dashboard-card" onClick={()=>setActivePanel("shifts")}><span><strong>Inserisci nuovi turni</strong><small>Definisci tipo, nome breve e durata</small></span><ChevronRight size={20}/></button>
        <button className="admin-dashboard-card" onClick={()=>setActivePanel("generator")}><span><strong>Generatore automatico</strong><small>Calendario mensile e vincoli di generazione</small></span><ChevronRight size={20}/></button>
      </div>

      <section className="admin-section" id="utenti">
        <div className="card admin-form-card"><h2><Plus size={18}/> Nuovo utente</h2><form className="admin-form-grid" onSubmit={createUser}><div className="field"><label>Nome utente</label><input required value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" required value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></div><div className="field"><label>Password temporanea</label><input type="password" required minLength={6} value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></div><div className="field"><label>Ruolo professionale</label><select value={userForm.employment_role} onChange={e=>setUserForm({...userForm,employment_role:e.target.value})}><option value="strutturato">Strutturato</option><option value="calabria">Calabria</option><option value="part_time">Part-time</option><option value="gettonista">Gettonista</option></select></div><div className="field"><label>Servizio</label><select value={userForm.service} onChange={e=>setUserForm({...userForm,service:e.target.value})}><option value="anestesia">Anestesia</option><option value="rianimazione">Rianimazione</option></select></div><div className="field"><label>Livello</label><select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}>{me.role==="super_admin"&&<option value="super_admin">Super admin</option>}<option value="admin">Admin</option><option value="utente">Utente</option></select></div><button className="btn btn-primary" disabled={saving}>Crea utente</button></form></div>

        <div className="card admin-table-card"><div className="table-wrap"><table className="requests-table admin-users-table"><thead><tr><th>Data registrazione</th><th>Nome utente</th><th>Email</th><th>Servizio</th><th>Ruolo</th><th>Livello</th><th className="action-col">Modifica</th><th className="action-col">Cancella</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{formatDate(u.created_at)}</td><td><strong>{u.username}</strong></td><td>{u.email}</td><td><span className="type-badge desiderata">{u.employment_role==="calabria"?"Calabria":u.employment_role==="part_time"?"Part-time":u.employment_role==="gettonista"?"Gettonista":"Strutturato"}</span></td><td><span className="type-badge desiderata">{u.service==="rianimazione"?"Rianimazione":"Anestesia"}</span></td><td><span className="type-badge desiderata">{u.role==="super_admin"?"Super admin":u.role==="admin"?"Admin":"Utente"}</span></td><td className="action-cell">{u.id!==me.id&&!(u.role==="super_admin"&&me.role!=="super_admin")&&<button className="icon-btn edit" onClick={()=>openEdit(u)} title="Modifica"><Pencil size={17}/></button>}</td><td className="action-cell">{u.id!==me.id&&!(u.role==="super_admin"&&me.role!=="super_admin")&&<button className="icon-btn delete" onClick={()=>removeUser(u.id)} title="Cancella"><Trash2 size={17}/></button>}</td></tr>)}</tbody></table></div></div>
      </section>
    </main>

    {activePanel&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setActivePanel(null)}><div className="modal wide-modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><p className="eyebrow">Amministrazione</p><h2>{activePanel==="shifts"?"Inserisci nuovi turni":"Generatore automatico"}</h2></div><button className="icon-btn" onClick={()=>setActivePanel(null)}><X size={21}/></button></div>
      {activePanel==="shifts"&&<><p className="modal-help">Definisci i tipi di turno disponibili per l'inserimento manuale e per la programmazione.</p><form className="admin-form-grid" onSubmit={createShift}><div className="field"><label>Tipo di turno</label><input required maxLength={60} placeholder="Es. Pomeriggio" value={shiftForm.shift_type} onChange={e=>setShiftForm({...shiftForm,shift_type:e.target.value})}/></div><div className="field"><label>Nome breve</label><input required maxLength={12} placeholder="Es. P" value={shiftForm.short_name} onChange={e=>setShiftForm({...shiftForm,short_name:e.target.value})}/></div><div className="field"><label>Durata</label><div className="duration-inputs"><input type="number" min="0" value={shiftForm.hours} onChange={e=>setShiftForm({...shiftForm,hours:e.target.value})}/><span>h</span><input type="number" min="0" max="59" value={shiftForm.minutes} onChange={e=>setShiftForm({...shiftForm,minutes:e.target.value})}/><span>min</span></div></div><button className="btn btn-primary" disabled={saving}>Inserisci turno</button></form>        <div className="card admin-table-card"><h2>Tipi di turno presenti</h2><div className="table-wrap"><table className="requests-table"><thead><tr><th>Tipo</th><th>Nome breve</th><th>Durata</th><th className="action-col">Cancella</th></tr></thead><tbody>{definitions.map(x=><tr key={x.id}><td>{x.shift_type}</td><td><strong>{x.short_name}</strong></td><td>{durationLabel(x.duration_minutes)}</td><td className="action-cell"><button className="icon-btn delete" onClick={()=>removeShift(x.id)} title="Cancella"><Trash2 size={17}/></button></td></tr>)}{definitions.length===0&&<tr><td colSpan={4} className="muted">Nessun tipo di turno inserito.</td></tr>}</tbody></table></div></div>
      </>}
      {activePanel==="generator"&&<div className="admin-modal-links"><Link className="admin-dashboard-card" href="/amministrazione/genera-turni"><span><strong><CalendarRange size={18}/> Genera nuovi turni</strong><small>Apri il calendario mensile e crea la bozza automatica.</small></span><ChevronRight size={20}/></Link><Link className="admin-dashboard-card" href="/amministrazione/modifica-generatore"><span><strong><Settings size={18}/> Modifica Generatore</strong><small>Gestisci i vincoli utilizzati dal generatore.</small></span><ChevronRight size={20}/></Link><Link className="admin-dashboard-card" href="/amministrazione/contatori"><span><strong><CalendarRange size={18}/> Contatori</strong><small>Calcola le ore teoriche mensili in base al ruolo.</small></span><ChevronRight size={20}/></Link></div>}
    </div></div>}
    {editingUser&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingUser(null)}}><div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><p className="eyebrow">Gestione account</p><h2>Modifica utente</h2></div><button className="icon-btn" onClick={()=>setEditingUser(null)}><X size={21}/></button></div>
      <form onSubmit={saveUser}><div className="field"><label>Nome utente</label><input required value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" required value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})}/></div><div className="field"><label>Nuova password <span className="muted">(opzionale)</span></label><input type="password" minLength={6} value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})}/></div><div className="field"><label>Ruolo professionale</label><select value={editForm.employment_role} onChange={e=>setEditForm({...editForm,employment_role:e.target.value})}><option value="strutturato">Strutturato</option><option value="calabria">Calabria</option><option value="part_time">Part-time</option><option value="gettonista">Gettonista</option></select></div><div className="field"><label>Servizio</label><select value={editForm.service} onChange={e=>setEditForm({...editForm,service:e.target.value})}><option value="anestesia">Anestesia</option><option value="rianimazione">Rianimazione</option></select></div><div className="field"><label>Livello</label><select value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})}>{me.role==="super_admin"&&<option value="super_admin">Super admin</option>}<option value="admin">Admin</option><option value="utente">Utente</option></select></div><button className="btn btn-primary" disabled={saving}>Salva modifiche</button></form>
    </div></div>}
  </div>
}
