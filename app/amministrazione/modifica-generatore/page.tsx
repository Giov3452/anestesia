"use client";

import {FormEvent,useEffect,useState} from "react";
import {CalendarDays,Pencil,Plus,Trash2,X} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import {createClient} from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";

type Rule={id:number;code:string;name:string;description:string;enabled:boolean;config:any};

export default function GeneratorRules(){
  const [rules,setRules]=useState<Rule[]>([]);
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  const [editing,setEditing]=useState<Rule|null>(null);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [enabled,setEnabled]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const s=createClient();
    const {data:{user}}=await s.auth.getUser();
    if(!user){setAuthorized(false);return}
    const {data:p}=await s.from("profiles").select("role").eq("id",user.id).single();
    const {data:r}=await s.rpc("get_my_role");
    const role=String(p?.role||r||"utente").toLowerCase();
    setAuthorized(["admin","super_admin"].includes(role));
    if(["admin","super_admin"].includes(role)){
      const {data,error:e}=await s.from("generator_constraints").select("*").order("id");
      if(e)setError(e.message); else setRules((data||[]) as Rule[]);
    }
  }
  useEffect(()=>{load()},[]);

  function reset(){setEditing(null);setName("");setDescription("");setEnabled(true)}

  function edit(rule:Rule){setEditing(rule);setName(rule.name);setDescription(rule.description);setEnabled(rule.enabled);setError("");setMessage("")}

  async function save(e:FormEvent){
    e.preventDefault();setError("");setMessage("");
    if(!name.trim()){setError("Inserisci il nome del vincolo.");return}
    const s=createClient();
    if(editing){
      const {error:e}=await s.from("generator_constraints").update({name:name.trim(),description:description.trim(),enabled,updated_at:new Date().toISOString()}).eq("id",editing.id);
      if(e){setError(e.message);return}
      setMessage("Vincolo modificato.");reset();await load();
    }else{
      const {error:e}=await s.from("generator_constraints").insert({code:"custom_"+Date.now(),name:name.trim(),description:description.trim(),enabled,config:{}});
      if(e){setError(e.message);return}
      setMessage("Nuovo vincolo aggiunto.");reset();await load();
    }
  }

  async function remove(rule:Rule){
    if(!confirm("Eliminare questo vincolo?"))return;
    const {error:e}=await createClient().from("generator_constraints").delete().eq("id",rule.id);
    if(e)setError(e.message);else{setMessage("Vincolo eliminato.");await load()}
  }

  if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
  if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

  return <div className="shell">
    <header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
    <main className="main"><BackButton/>
      <div className="generation-title-row"><div><p className="eyebrow">Configurazione</p><h1 className="title">Modifica Generatore</h1><p className="sub">Gestisci i vincoli utilizzati dal generatore automatico.</p></div><Link className="btn btn-secondary" href="/amministrazione">← Amministrazione</Link></div>
      {message&&<div className="success">{message}</div>}{error&&<div className="error">{error}</div>}
      <section className="card admin-table-card"><div className="table-wrap"><table className="requests-table admin-users-table"><thead><tr><th>Vincolo</th><th>Descrizione</th><th>Stato</th><th className="action-col">Modifica</th><th className="action-col">Elimina</th></tr></thead><tbody>
        {rules.map(rule=><tr key={rule.id}><td><strong>{rule.name}</strong></td><td>{rule.description||"—"}</td><td><span className={rule.enabled?"rule-enabled":"rule-disabled"}>{rule.enabled?"Attivo":"Disattivo"}</span></td><td className="action-cell"><button className="icon-btn edit" title="Modifica" onClick={()=>edit(rule)}><Pencil size={17}/></button></td><td className="action-cell"><button className="icon-btn delete" title="Elimina" onClick={()=>remove(rule)}><Trash2 size={17}/></button></td></tr>)}
        {!rules.length&&<tr><td colSpan={5} className="muted">Nessun vincolo configurato.</td></tr>}
      </tbody></table></div></section>

      <section className="card admin-form-card"><h2><Plus size={18}/> {editing?"Modifica vincolo":"Aggiungi vincolo"}</h2><p className="muted">I vincoli standard possono essere attivati/disattivati; i nuovi vincoli vengono salvati come configurazione personalizzata.</p>
        <form className="admin-form-grid" onSubmit={save}><div className="field"><label>Nome</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Es. Riposo dopo reperibilità" required/></div><div className="field" style={{gridColumn:"span 2"}}><label>Descrizione</label><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descrivi la regola"/></div><label className="toggle-line"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Attivo</label><div className="row"><button type="button" className="btn btn-secondary" onClick={reset}>{editing?"Annulla":"Azzera"}</button><button className="btn btn-primary" disabled={!name.trim()}>{editing?"Salva modifiche":"Aggiungi vincolo"}</button></div></form>
      </section>
    </main>
  </div>
}