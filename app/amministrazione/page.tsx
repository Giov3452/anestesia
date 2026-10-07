"use client";

import {FormEvent,useEffect,useState} from "react";
import {CalendarDays,ChevronRight,Pencil,Plus,Trash2,X} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import {createClient} from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";

type User={id:string;username:string;email:string;role:string;created_at:string};
type ShiftDefinition={id:number;shift_type:string;short_name:string;duration_minutes:number};

const shiftTypes=["Mattina","Pomeriggio","Guardia","Notte","Endoscopia","Reperibilità pomeriggio","Reperibilità notte","Reperibilità giorno","Rianimazione","Smonto notte","Riposo compensativo"];
const shortNames=["M1","M2","M3","Mo1","Mo2","P","G","Gm","Gp","N","E","R","Rp","Rn","Ria"];
const allowedShort:Record<string,string[]>={
  "Mattina":["M1","M2","M3","Mo1","Mo2"],"Pomeriggio":["P"],"Guardia":["G","Gm","Gp"],"Notte":["N"],
  "Endoscopia":["E"],"Reperibilità pomeriggio":["Rp"],"Reperibilità notte":["Rn"],"Reperibilità giorno":["R"],"Rianimazione":["Ria"],"Smonto notte":["SN"],"Riposo compensativo":["RC"]
};

function durationLabel(minutes:number){
  const h=Math.floor(minutes/60),m=minutes%60;
  return h+"h"+(m?String(m).padStart(2,"0")+"min":"");
}
function formatDate(value:string){return new Date(value).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"})}

export default function Admin(){
  const [users,setUsers]=useState<User[]>([]);
  const [me,setMe]=useState<User|null>(null);
  const [definitions,setDefinitions]=useState<ShiftDefinition[]>([]);
  const [userForm,setUserForm]=useState({username:"",email:"",password:"",role:"utente"});
  const [shiftForm,setShiftForm]=useState({shift_type:"Mattina",short_name:"M1",hours:"8",minutes:"0"});
  const [editingUser,setEditingUser]=useState<User|null>(null);
  const [editForm,setEditForm]=useState({username:"",email:"",password:"",role:"utente"});
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    setLoading(true);const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return;
    const {data:p}=await s.from("profiles").select("id,username,email,role,created_at").eq("id",user.id).single();
    const {data:myRole}=await s.rpc("get_my_role");const effectiveRole=String(p?.role||myRole||"utente").toLowerCase();
    const effectiveProfile=p?{...p,role:effectiveRole}:null;setMe(effectiveProfile);
    if(effectiveProfile&&["admin","super_admin"].includes(effectiveRole)){
      const [{data:us},{data:defs}]=await Promise.all([
        s.from("profiles").select("id,username,email,role,created_at").order("username"),
        s.from("shift_definitions").select("id,shift_type,short_name,duration_minutes").order("shift_type").order("short_name")
      ]);
      setUsers(us||[]);setDefinitions((defs||[]) as ShiftDefinition[]);
    }
    setLoading(false);
  };
  useEffect(()=>{load()},[]);

  async function invoke(body:any){
    const {data,error}=await createClient().functions.invoke("admin-users",{body});
    if(error)throw error;if(data?.error)throw new Error(data.error);return data;
  }

  async function createUser(e:FormEvent){
    e.preventDefault();setError("");setMessage("");setSaving(true);
    try{await invoke({action:"create",...userForm});setUserForm({username:"",email:"",password:"",role:"utente"});setMessage("Utente creato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setSaving(false)}
  }

  function openEdit(u:User){setEditingUser(u);setEditForm({username:u.username,email:u.email,password:"",role:u.role});setError("");setMessage("")}

  async function saveUser(e:FormEvent){
    e.preventDefault();if(!editingUser)return;setError("");setMessage("");setSaving(true);
    try{await invoke({action:"update",userId:editingUser.id,username:editForm.username,email:editForm.email,password:editForm.password||undefined,role:editForm.role});setEditingUser(null);setMessage("Utente modificato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setSaving(false)}
  }

  async function removeUser(id:string){
    if(!confirm("Eliminare definitivamente questo utente?"))return;setError("");setMessage("");
    try{await invoke({action:"delete",userId:id});setMessage("Utente eliminato.");await load()}
    catch(e){setError(e instanceof Error?e.message:"Errore")}
  }

  function changeShiftType(value:string){
    setShiftForm(x=>({...x,shift_type:value,short_name:allowedShort[value][0]}));
  }

  async function createShift(e:FormEvent){
    e.preventDefault();setError("");setMessage("");
    const hours=Number(shiftForm.hours),minutes=Number(shiftForm.minutes);
    if(!Number.isInteger(hours)||hours<0||!Number.isInteger(minutes)||minutes<0||minutes>59){setError("Inserisci una durata valida.");return}
    if(!allowedShort[shiftForm.shift_type]?.includes(shiftForm.short_name)){setError("Il nome breve non è compatibile con il tipo di turno.");return}
    const duration_minutes=hours*60+minutes;if(duration_minutes<=0){setError("La durata deve essere maggiore di zero.");return}
    setSaving(true);const s=createClient();
    const {error:err}=await s.from("shift_definitions").insert({shift_type:shiftForm.shift_type,short_name:shiftForm.short_name,duration_minutes});
    if(err)setError(err.message);else{setMessage("Nuovo tipo di turno inserito.");setShiftForm(x=>({...x,hours:"8",minutes:"0"}));await load()}
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
        <a className="admin-dashboard-card" href="#utenti"><span><strong>Gestione utenti</strong><small>Utenti registrati, ruoli e accessi</small></span><ChevronRight size={20}/></a>
        <a className="admin-dashboard-card" href="#tipi-turno"><span><strong>Inserisci nuovi turni</strong><small>Definisci tipo, nome breve e durata</small></span><ChevronRight size={20}/></a>
        <Link className="admin-dashboard-card" href="/amministrazione/genera-turni"><span><strong>Generatore automatico</strong><small>Calendario mensile e generazione dei turni</small></span><ChevronRight size={20}/></Link>
      </div>

      <section className="admin-section" id="utenti">
        <div className="section-title"><div><p className="eyebrow">Account</p><h2>Gestione degli utenti</h2></div></div>
        <div className="card admin-table-card"><div className="table-wrap"><table className="requests-table admin-users-table"><thead><tr><th>Data registrazione</th><th>Nome utente</th><th>Email</th><th>Livello</th><th className="action-col">Modifica</th><th className="action-col">Cancella</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{formatDate(u.created_at)}</td><td><strong>{u.username}</strong></td><td>{u.email}</td><td><span className="type-badge desiderata">{u.role==="super_admin"?"Super admin":u.role==="admin"?"Admin":"Utente"}</span></td><td className="action-cell">{u.id!==me.id&&!(u.role==="super_admin"&&me.role!=="super_admin")&&<button className="icon-btn edit" onClick={()=>openEdit(u)} title="Modifica"><Pencil size={17}/></button>}</td><td className="action-cell">{u.id!==me.id&&!(u.role==="super_admin"&&me.role!=="super_admin")&&<button className="icon-btn delete" onClick={()=>removeUser(u.id)} title="Cancella"><Trash2 size={17}/></button>}</td></tr>)}</tbody></table></div></div>

        <div className="card admin-form-card"><h2><Plus size={18}/> Nuovo utente</h2><form className="admin-form-grid" onSubmit={createUser}><div className="field"><label>Nome utente</label><input required value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" required value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></div><div className="field"><label>Password temporanea</label><input type="password" required minLength={6} value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></div><div className="field"><label>Livello</label><select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}>{me.role==="super_admin"&&<option value="super_admin">Super admin</option>}<option value="admin">Admin</option><option value="utente">Utente</option></select></div><button className="btn btn-primary" disabled={saving}>Crea utente</button></form></div>
      </section>

      <section className="admin-section" id="tipi-turno">
        <div className="section-title"><div><p className="eyebrow">Programmazione</p><h2>Inserisci nuovi turni</h2><p className="muted">Il nome breve disponibile viene filtrato automaticamente in base al tipo di turno.</p></div></div>
        <div className="card admin-form-card"><form className="admin-form-grid" onSubmit={createShift}>
          <div className="field"><label>Tipo di turno</label><select value={shiftForm.shift_type} onChange={e=>changeShiftType(e.target.value)}>{shiftTypes.map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Nome breve</label><select value={shiftForm.short_name} onChange={e=>setShiftForm({...shiftForm,short_name:e.target.value})}>{allowedShort[shiftForm.shift_type].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Durata</label><div className="duration-inputs"><input type="number" min="0" value={shiftForm.hours} onChange={e=>setShiftForm({...shiftForm,hours:e.target.value})} placeholder="Ore"/><span>h</span><input type="number" min="0" max="59" value={shiftForm.minutes} onChange={e=>setShiftForm({...shiftForm,minutes:e.target.value})} placeholder="Minuti"/><span>min</span></div></div>
          <button className="btn btn-primary" disabled={saving}>Inserisci turno</button>
        </form></div>
        <div className="card admin-table-card"><h2>Tipi di turno presenti</h2><div className="table-wrap"><table className="requests-table"><thead><tr><th>Tipo</th><th>Nome breve</th><th>Durata</th><th className="action-col">Cancella</th></tr></thead><tbody>{definitions.map(x=><tr key={x.id}><td>{x.shift_type}</td><td><strong>{x.short_name}</strong></td><td>{durationLabel(x.duration_minutes)}</td><td className="action-cell"><button className="icon-btn delete" onClick={()=>removeShift(x.id)} title="Cancella"><Trash2 size={17}/></button></td></tr>)}{definitions.length===0&&<tr><td colSpan={4} className="muted">Nessun tipo di turno inserito.</td></tr>}</tbody></table></div></div>
      </section>
    </main>

    {editingUser&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingUser(null)}}><div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><p className="eyebrow">Gestione account</p><h2>Modifica utente</h2></div><button className="icon-btn" onClick={()=>setEditingUser(null)}><X size={21}/></button></div>
      <form onSubmit={saveUser}><div className="field"><label>Nome utente</label><input required value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" required value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})}/></div><div className="field"><label>Nuova password <span className="muted">(opzionale)</span></label><input type="password" minLength={6} value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})}/></div><div className="field"><label>Livello</label><select value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})}>{me.role==="super_admin"&&<option value="super_admin">Super admin</option>}<option value="admin">Admin</option><option value="utente">Utente</option></select></div><button className="btn btn-primary" disabled={saving}>Salva modifiche</button></form>
    </div></div>}
  </div>
}
