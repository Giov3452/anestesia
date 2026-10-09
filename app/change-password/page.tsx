"use client";

import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
import {Hospital,Eye,EyeOff} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

export default function ChangePassword(){
 const router=useRouter();
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [show,setShow]=useState(false);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setError("");
  if(password.length<8){setError("La nuova password deve contenere almeno 8 caratteri.");return}
  if(password!==confirm){setError("Le password non coincidono.");return}
  setLoading(true);
  const s=createClient();
  const {error:changeError}=await s.functions.invoke("admin-users",{body:{action:"complete_password_change",password}});
  if(changeError){setError("Non è stato possibile aggiornare la password. Riprova.");setLoading(false);return}
  router.replace("/dashboard");router.refresh();
 }
 return <main className="auth"><section className="auth-card"><div className="brand"><span className="brand-mark"><Hospital size={21}/></span>Turni Ospedalieri</div><p className="eyebrow" style={{marginTop:36}}>Primo accesso</p><h1 className="title">Crea la tua password</h1><p className="sub">Per proteggere il tuo account, prima di utilizzare l'app devi sostituire la password temporanea fornita dall'amministratore con una personale.</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit}><div className="field"><label>Nuova password</label><div style={{position:"relative"}}><input style={{paddingRight:44}} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/><button type="button" onClick={()=>setShow(!show)} aria-label={show?"Nascondi password":"Mostra password"} style={{position:"absolute",right:10,top:9,border:0,background:"transparent",color:"#6b7280",cursor:"pointer"}}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small className="muted">Almeno 8 caratteri.</small></div><div className="field"><label>Conferma nuova password</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={8} autoComplete="new-password"/></div><button className="btn btn-primary" disabled={loading}>{loading?"Aggiornamento…":"Salva nuova password"}</button></form><p className="muted" style={{marginTop:16,fontSize:13}}>Non potrai accedere alle altre sezioni finché la procedura non sarà completata.</p></section></main>
}