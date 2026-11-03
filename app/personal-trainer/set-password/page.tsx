"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

export default function SetPersonalTrainerPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password.length < 10) { setError("Usa almeno 10 caratteri."); return; }
    if (password !== confirm) { setError("Le password non coincidono."); return; }
    setBusy(true);
    const supabase = createPersonalTrainerClient();
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    if (updateError) { setError(updateError.message); setBusy(false); return; }
    router.replace("/personal-trainer/dashboard");
    router.refresh();
  }

  return <main className="pt-login-wrap"><section className="pt-login-card">
    <div className="pt-brand"><span className="pt-brand-mark">PT</span><span>PERSONAL TRAINER HUB</span></div>
    <p className="pt-eyebrow">Primo accesso</p><h1>Crea la tua password</h1>
    <p className="pt-muted">Scegli una password personale di almeno 10 caratteri.</p>
    {error && <div className="pt-error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <div className="pt-field"><label htmlFor="new-password">Nuova password</label><input id="new-password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} required /></div>
      <div className="pt-field"><label htmlFor="confirm-password">Conferma password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
      <button className="pt-button" style={{width:"100%"}} disabled={busy}>{busy ? "Salvataggio…" : "Salva password e accedi"}</button>
    </form>
  </section></main>;
}
