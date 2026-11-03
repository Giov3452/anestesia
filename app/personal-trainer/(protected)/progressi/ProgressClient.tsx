"use client";
import { useRef, useState } from "react";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Photo={id:string;taken_on:string;view_type:string;caption:string|null;file_path:string;url:string};
export default function ProgressClient({initial}:{initial:Photo[]}) {
 const [photos,setPhotos]=useState(initial),[view,setView]=useState("front"),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[caption,setCaption]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const gallery=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null);
 async function upload(file?:File){if(!file)return;setError("");setMessage("");if(!file.type.startsWith("image/")){setError("Seleziona un'immagine.");return}if(file.size>15*1024*1024){setError("La foto supera il limite di 15 MB.");return}setBusy(true);
 const sb=createPersonalTrainerClient();const {data:{user}}=await sb.auth.getUser();if(!user){setError("Sessione scaduta: accedi di nuovo.");setBusy(false);return}
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");const path=user.id+"/"+Date.now()+"-"+crypto.randomUUID()+"."+ext;
 const {error:upErr}=await sb.storage.from("pt-private").upload(path,file,{contentType:file.type,upsert:false});
 if(upErr){setError("Caricamento non riuscito: "+upErr.message);setBusy(false);return}
 const {data,error:dbErr}=await sb.from("pt_progress_photos").insert({taken_on:date,view_type:view,file_path:path,caption:caption.trim()||null,uploaded_by:user.id}).select("id,taken_on,view_type,caption,file_path").single();
 if(dbErr){await sb.storage.from("pt-private").remove([path]);setError("Impossibile salvare la foto: "+dbErr.message);setBusy(false);return}
 const {data:signed}=await sb.storage.from("pt-private").createSignedUrl(path,3600);
 setPhotos(p=>[{...data,url:signed?.signedUrl||""},...p]);setCaption("");setMessage("Foto caricata nell'archivio privato.");setBusy(false);
 }
 return <div className="pt-page">
 <p className="pt-eyebrow">DIARIO VISIVO</p><h2>Fotografie dei progressi</h2><p className="pt-muted">Archivio privato condiviso con il tuo personal trainer. Puoi scegliere una foto dalla galleria oppure scattarla direttamente con la fotocamera posteriore dello smartphone.</p>
 <section className="pt-card pt-section"><h3>Carica una nuova foto</h3>
 <div className="pt-form-grid">
 <div className="pt-field"><label>Data dello scatto</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
 <div className="pt-field"><label>Inquadratura</label><select value={view} onChange={e=>setView(e.target.value)}><option value="front">Frontale</option><option value="side">Laterale</option><option value="back">Posteriore</option><option value="other">Altro</option></select></div>
 <div className="pt-field"><label>Nota (facoltativa)</label><input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Es. controllo mensile" /></div>
 </div>
 <input ref={gallery} type="file" accept="image/*" hidden onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value="";}} />
 <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value="";}} />
 <div className="pt-photo-actions"><button type="button" className="pt-button" disabled={busy} onClick={()=>gallery.current?.click()}>Scegli dalla galleria</button><button type="button" className="pt-secondary-button" disabled={busy} onClick={()=>camera.current?.click()}>Scatta con fotocamera posteriore</button></div>
 <p className="pt-muted pt-photo-hint">Su iPhone e Android il pulsante fotocamera richiede la fotocamera posteriore quando il browser e il dispositivo supportano l'attributo. In alternativa puoi scegliere lo scatto dalla galleria.</p>
 {busy&&<p className="pt-muted" role="status">Caricamento foto…</p>}{error&&<p className="pt-error" role="alert">{error}</p>}{message&&<p className="pt-success" role="status">{message}</p>}
 </section>
 <section className="pt-section"><h3>Archivio fotografico</h3>{photos.length===0?<div className="pt-empty">Non hai ancora caricato fotografie. Usa uno dei due pulsanti qui sopra per iniziare.</div>:<div className="pt-photo-grid">{photos.map(p=><article className="pt-photo-card" key={p.id}>{p.url?<a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption||"Foto progressi"} /></a>:<div className="pt-photo-unavailable">Anteprima non disponibile</div>}<div className="pt-photo-meta"><strong>{new Date(p.taken_on+"T12:00:00").toLocaleDateString("it-IT")}</strong><span>{p.view_type==="front"?"Frontale":p.view_type==="side"?"Laterale":p.view_type==="back"?"Posteriore":"Altro"}</span>{p.caption&&<small>{p.caption}</small>}</div></article>)}</div>}</section>
 </div>;
}
