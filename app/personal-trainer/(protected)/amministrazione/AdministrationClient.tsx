"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Trainer = { id: string; email: string; display_name: string; role: string; created_at: string; relationship_status: "active" | "disabled" };

export default function AdministrationClient({ trainers }: { trainers: Trainer[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function invoke(body: Record<string, unknown>) {
    const supabase = createPersonalTrainerClient();
    const { data, error: invokeError } = await supabase.functions.invoke("pt-admin-users", { body });
    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function createTrainer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await invoke({ action: "create", email, display_name: displayName });
      setMessage(result.message ?? "Invito inviato.");
      setEmail(""); setDisplayName("");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore durante la creazione."); }
    finally { setBusy(false); }
  }

  async function toggleTrainer(trainer: Trainer) {
    setBusy(true); setError(""); setMessage("");
    try {
      await invoke({ action: "set_status", trainer_id: trainer.id, status: trainer.relationship_status === "active" ? "disabled" : "active" });
      setMessage(trainer.relationship_status === "active" ? "Account PT sospeso." : "Account PT riattivato.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore durante l'aggiornamento."); }
    finally { setBusy(false); }
  }

  return <div className="pt-page">
    <p className="pt-eyebrow">AREA ADMIN</p>
    <h2>Amministrazione</h2>
    <p className="pt-muted">Gestisci gli accessi dei personal trainer collegati al tuo spazio.</p>
    <section className="pt-card pt-section">
      <h3>Invita un personal trainer</h3>
      <p className="pt-muted">Il PT riceverà un'email con un link per accedere e scegliere la propria password.</p>
      <form onSubmit={createTrainer}>
        <div className="pt-form-grid">
          <div className="pt-field"><label htmlFor="pt-name">Nome e cognome</label><input id="pt-name" value={displayName} onChange={e => setDisplayName(e.target.value)} required minLength={2} maxLength={100} /></div>
          <div className="pt-field"><label htmlFor="pt-new-email">Email</label><input id="pt-new-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        </div>
        <button className="pt-button" disabled={busy}>{busy ? "Attendi…" : "Invia invito"}</button>
      </form>
      {message && <p className="pt-success" role="status">{message}</p>}
      {error && <p className="pt-error" role="alert">{error}</p>}
    </section>
    <section className="pt-section">
      <h3>Personal trainer associati ({trainers.length})</h3>
      {trainers.length === 0 ? <div className="pt-empty">Non hai ancora invitato personal trainer.</div> : <div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Nome</th><th>Email</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
        {trainers.map(t => <tr key={t.id}><td>{t.display_name}</td><td>{t.email}</td><td><span className={t.relationship_status === "active" ? "pt-status-active" : "pt-status-disabled"}>{t.relationship_status === "active" ? "Attivo" : "Sospeso"}</span></td><td><button className="pt-secondary-button" disabled={busy} onClick={() => toggleTrainer(t)}>{t.relationship_status === "active" ? "Sospendi" : "Riattiva"}</button></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
