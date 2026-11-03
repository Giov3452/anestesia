"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {createPersonalTrainerClient} from "@/lib/personal-trainer/client";

type Package={id:string;title:string;total_lessons:number;price_eur:number;starts_on:string|null;expires_on:string|null;created_at:string;payment_method:string|null;status:string;admin_approved_by:string|null;admin_approved_at:string|null;pt_approved_by:string|null;pt_approved_at:string|null;is_active:boolean};
// The package is activated only after one approval from each role.\nconst methods:Record<string,string>={bank_transfer:"Bonifico",cash:"Contanti",card:"Carta",other:"Altro"};
export default function PaymentsClient({initialPackages,viewerId,viewerRole}:{initialPackages:Package[];viewerId:string;viewerRole:string}){
 const router=useRouter();
 const [packages,setPackages]=useState(initialPackages);
 const [title,setTitle]=useState(""),[lessons,setLessons]=useState("10"),[price,setPrice]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[expiry,setExpiry]=useState(""),[method,setMethod]=useState("bank_transfer");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function addPackage(){
  setError("");setSuccess("");
  const count=Number(lessons),amount=Number(price.replace(",","."));
  if(!title.trim()){setError("Inserisci il nome del pacchetto.");return}
  if(!Number.isInteger(count)||count<1){setError("Inserisci un numero di lezioni valido.");return}
  if(!Number.isFinite(amount)||amount<0){setError("Inserisci un prezzo valido.");return}
  if(expiry&&expiry<date){setError("La scadenza non può precedere la data di acquisto.");return}
  setBusy(true);const sb=createPersonalTrainerClient();const {data:{user}}=await sb.auth.getUser();
  if(!user){setError("Sessione non valida.");setBusy(false);return}
  const {data,error}=await sb.from("pt_packages").insert({title:title.trim(),total_lessons:count,price_eur:amount,starts_on:date,expires_on:expiry||null,payment_method:method,created_by:user.id,is_active:false,status:"pending"}).select("id,title,total_lessons,price_eur,starts_on,expires_on,created_at,payment_method,status,admin_approved_by,admin_approved_at,pt_approved_by,pt_approved_at,is_active").single();
  if(error)setError(error.message);else{setPackages(v=>[data,...v]);setTitle("");setLessons("10");setPrice("");setExpiry("");setSuccess("Acquisto registrato: in attesa delle due approvazioni.");router.refresh()}
  setBusy(false);
 }
 async function approve(p:Package){
  setError("");const sb=createPersonalTrainerClient();
  const patch=viewerRole==="admin"?{admin_approved_by:viewerId}:{pt_approved_by:viewerId};
  const {data,error}=await sb.from("pt_packages").update(patch).eq("id",p.id).select("id,title,total_lessons,price_eur,starts_on,expires_on,created_at,payment_method,status,admin_approved_by,admin_approved_at,pt_approved_by,pt_approved_at,is_active").single();
  if(error){setError(error.message);return}
  setPackages(v=>v.map(x=>x.id===p.id?data:x));router.refresh();
 }
 const dateLabel=(value:string|null)=>value?new Date(value+"T12:00:00").toLocaleDateString("it-IT"):"—";
 return <section className="pt-page">
  <div className="pt-eyebrow">GESTIONE PACCHETTI</div><h2>Pacchetti</h2>
  <p className="pt-muted">Registra qui l’acquisto: il metodo di pagamento e le approvazioni vengono gestiti insieme al pacchetto. L’acquisto diventa attivo solo dopo la conferma di amministratore e PT.</p>
  <div className="pt-card pt-section"><h3>Registra un nuovo pacchetto</h3>
   <div className="pt-form-grid">
    <div className="pt-field"><label>Nome pacchetto</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. Pacchetto 10 lezioni"/></div>
    <div className="pt-field"><label>Numero lezioni</label><input type="number" min="1" step="1" value={lessons} onChange={e=>setLessons(e.target.value)}/></div>
    <div className="pt-field"><label>Prezzo (€)</label><input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Es. 300"/></div>
    <div className="pt-field"><label>Data acquisto</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <div className="pt-field"><label>Scadenza (facoltativa)</label><input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div>
    <div className="pt-field"><label>Metodo di pagamento</label><select value={method} onChange={e=>setMethod(e.target.value)}><option value="bank_transfer">Bonifico</option><option value="cash">Contanti</option><option value="card">Carta</option><option value="other">Altro</option></select></div>
   </div>
   <button className="pt-button" disabled={busy} onClick={addPackage}>{busy?"Salvataggio…":"Registra acquisto"}</button>
   {error&&<p className="pt-error" role="alert">{error}</p>}{success&&<p className="pt-success" role="status">{success}</p>}
  </div>
  <div className="pt-section"><h3>Storico pacchetti ({packages.length})</h3>
   {packages.length===0?<div className="pt-empty">Nessun pacchetto registrato.</div>:<div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Pacchetto</th><th>Acquisto</th><th>Lezioni</th><th>Prezzo</th><th>Pagamento</th><th>Stato / approvazioni</th><th>Azioni</th></tr></thead><tbody>
    {packages.map(p=><tr key={p.id}><td><strong>{p.title}</strong>{p.is_active&&<div className="pt-muted">Attivo</div>}</td><td>{dateLabel(p.starts_on)}</td><td>{p.total_lessons}</td><td>€ {Number(p.price_eur).toFixed(2)}</td><td>{methods[p.payment_method||""]||p.payment_method||"—"}</td><td><strong>{p.status==="confirmed"?"Approvato":p.status==="rejected"?"Rifiutato":"In attesa"}</strong><div className="pt-muted">Amministratore: {p.admin_approved_by?"✓":"in attesa"} · PT: {p.pt_approved_by?"✓":"in attesa"}</div></td><td>{p.status==="pending"&&((viewerRole==="admin"&&!p.admin_approved_by)||(viewerRole==="pt"&&!p.pt_approved_by))?<button className="pt-secondary-button" onClick={()=>approve(p)}>Approva</button>:p.status==="pending"?"Approvazione registrata":"—"}</td></tr>)}
   </tbody></table></div>}
  </div>
 </section>;
}
