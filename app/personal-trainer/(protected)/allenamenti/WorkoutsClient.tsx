"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Plan={id:string;title:string;description:string|null;file_path:string;file_name:string;content_type:string;is_current:boolean;created_at:string;url:string};
export default function WorkoutsClient({initial}:{initial:Plan[]}) {
 const router=useRouter();
 const [plans,setPlans]=useState(initial),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const picker=useRef<HTMLInputElement>(null);
 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setMessage("");
  if(!file){setError("Seleziona un file PDF.");return;}
  if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){setError("Sono ammessi solo file PDF.");return;}
  if(file.size>25*1024*1024){setError("Il PDF supera il limite di 25 MB.");return;}
  if(!title.trim()){setError("Inserisci il titolo del piano.");return;}
  setBusy(true);
  const sb=createPersonalTrainerClient();
  const {data:{user}}=await sb.auth.getUser();
  if(!user){setError("Sessione scaduta: accedi di nuovo.");setBusy(false);return;}
  const path=user.id+"/"+Date.now()+"-"+crypto.randomUUID()+".pdf";
  const {error:upErr}=await sb.storage.from("pt-private").upload(path,file,{contentType:"application/pdf",upsert:false});
  if(upErr){setError("Caricamento non riuscito: "+upErr.message);setBusy(false);return;}
  const {data:record,error:dbErr}=await sb.from("pt_workout_plans").insert({title:title.trim(),description:description.trim()||null,file_path:path,file_name:file.name,content_type:"application/pdf",uploaded_by:user.id,is_current:true}).select("id,title,description,file_path,file_name,content_type,is_current,created_at").single();
  if(dbErr){await sb.storage.from("pt-private").remove([path]);setError("Impossibile registrare il piano: "+dbErr.message);setBusy(false);return;}
  const {data:signed}=await sb.storage.from("pt-private").createSignedUrl(path,3600);
  setPlans(p=>[{...record,url:signed?.signedUrl??""},...p]);setTitle("");setDescription("");setFile(null);if(picker.current)picker.current.value="";
  setMessage("Piano caricato e conservato nell'archivio privato.");setBusy(false);router.refresh();
 }
 async function remove(plan:Plan){
  if(!window.confirm("Vuoi eliminare definitivamente il piano “"+plan.title+"”? Il file non sarà più disponibile."))return;
  setBusy(true);setError("");setMessage("");
  const sb=createPersonalTrainerClient();
  const {error:dbErr}=await sb.from("pt_workout_plans").delete().eq("id",plan.id);
  if(dbErr){setError("Eliminazione non riuscita: "+dbErr.message);setBusy(false);return;}
  const {error:storageErr}=await sb.storage.from("pt-private").remove([plan.file_path]);
  setPlans(p=>p.filter(x=>x.id!==plan.id));
  if(storageErr)setMessage("Voce eliminata. Il file residuo non è stato rimosso: "+storageErr.message);
  else setMessage("Piano eliminato dall'archivio.");
  setBusy(false);router.refresh();
 }
 return <div className="pt-page">
  <p className="pt-eyebrow">LIBRERIA DOCUMENTI</p><h2>Piani di allenamento</h2>
  <p className="pt-muted">Archivio privato condiviso tra te e il personal trainer. I PDF restano conservati nello spazio protetto e possono essere aperti o scaricati in qualsiasi momento.</p>
  <form className="pt-card pt-section" onSubmit={upload}>
   <h3>Carica un nuovo piano</h3>
   <div className="pt-form-grid">
    <div className="pt-field"><label>Titolo del piano</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. Scheda forza – novembre" required/></div>
    <div className="pt-field"><label>Descrizione (facoltativa)</label><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Obiettivi, periodo, indicazioni…"/></div>
    <div className="pt-field"><label>File PDF (max 25 MB)</label><input ref={picker} type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)} required/></div>
   </div>
   {file&&<p className="pt-muted">{file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
   <button className="pt-button" disabled={busy}>{busy?"Operazione in corso…":"Carica piano di allenamento"}</button>
  </form>
  {error&&<p className="pt-error" role="alert">{error}</p>}{message&&<p className="pt-success" role="status">{message}</p>}
  <section className="pt-section"><h3>Archivio piani</h3>
   {plans.length===0?<div className="pt-empty">Nessun piano caricato. Usa il modulo qui sopra per aggiungere il primo PDF.</div>:<div className="pt-stack">{plans.map(plan=><article className="pt-card pt-section" key={plan.id}>
    <div className="pt-photo-actions" style={{justifyContent:"space-between",alignItems:"flex-start"}}><div><h3>{plan.title}</h3>{plan.description&&<p className="pt-muted">{plan.description}</p>}<p className="pt-muted">{plan.file_name} · {new Date(plan.created_at).toLocaleDateString("it-IT")}</p></div><span className="pt-role">PDF</span></div>
    <div className="pt-photo-actions">{plan.url?<a className="pt-button" href={plan.url} target="_blank" rel="noreferrer">Apri / scarica PDF</a>:<span className="pt-muted">Link temporaneamente non disponibile</span>}<button type="button" className="pt-secondary-button" disabled={busy} onClick={()=>void remove(plan)}>Elimina</button></div>
   </article>)}</div>}
  </section>
 </div>;
}
