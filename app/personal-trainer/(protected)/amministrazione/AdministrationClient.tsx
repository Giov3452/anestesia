"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Trainer = { id: string; email: string; display_name: string; role: string; height_cm: number | null; created_at: string; relationship_status: "active" | "disabled" };

export default function AdministrationClient({ trainers }: { trainers: Trainer[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHeight, setEditHeight] = useState("");

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
      const result = await invoke({ action: "create_temporary", email, display_name: displayName });
      setTemporaryPassword(result.temporary_password ?? "");
      setMessage(result.message ?? "Account PT creato.");
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

  function startEdit(t: Trainer) {
    setEditingId(t.id); setEditName(t.display_name ?? ""); setEditEmail(t.email ?? "");
    setEditHeight(t.height_cm == null ? "" : String(t.height_cm));
    setError(""); setMessage("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, trainerId: string) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await invoke({ action: "update", trainer_id: trainerId, display_name: editName, email: editEmail, height_cm: editHeight });
      setMessage("Account PT aggiornato.");
      setEditingId(null); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore durante la modifica."); }
    finally { setBusy(false); }
  }

  async function deleteTrainer(t: Trainer) {
    const confirmed = window.confirm(`Eliminare definitivamente l'account di ${t.display_name} ( ${t.email} )? I dati storici resteranno nello spazio e saranno attribuiti all'amministratore. L'operazione non è reversibile.`);
    if (!confirmed) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await invoke({ action: "delete", trainer_id: t.id });
      setMessage(result.message ?? "Account PT eliminato.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore durante l'eliminazione."); }
    finally { setBusy(false); }
  }

  return <div className="pt-page">
    <p className="pt-eyebrow">AREA ADMIN</p>
    <h2>Amministrazione</h2>
    <p className="pt-muted">Gestisci gli accessi dei personal trainer collegati al tuo spazio.</p>
    <section className="pt-card pt-section">
      <h3>Crea account personal trainer</h3>
      <p className="pt-muted">Crea un account PT senza invio email. La password temporanea verrà mostrata una sola volta e dovrà essere cambiata al primo accesso.</p>
      <form onSubmit={createTrainer}>
        <div className="pt-form-grid">
          <div className="pt-field"><label htmlFor="pt-name">Nome e cognome</label><input id="pt-name" value={displayName} onChange={e => setDisplayName(e.target.value)} required minLength={2} maxLength={100} /></div>
          <div className="pt-field"><label htmlFor="pt-new-email">Email</label><input id="pt-new-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        </div>
        <button className="pt-button" disabled={busy}>{busy ? "Attendi…" : "Crea account PT"}</button>
      </form>
    </section>
    {message && <p className="pt-success" role="status">{message}</p>}
    {temporaryPassword && <div className="pt-card pt-section"><strong>Password temporanea — copiala ora</strong><p className="pt-muted">Comunicala a Federico tramite un canale sicuro. Non verrà inviata via email né mostrata di nuovo.</p><code style={{display:"block",padding:12,wordBreak:"break-all"}}>{temporaryPassword}</code><button type="button" className="pt-secondary-button" onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Copia password</button></div>}
    {error && <p className="pt-error" role="alert">{error}</p>}
    <section className="pt-section">
      <h3>Personal trainer associati ({trainers.length})</h3>
      {trainers.length === 0 ? <div className="pt-empty">Non hai ancora invitato personal trainer.</div> : <div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Nome / Email</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
        {trainers.map(t => <tr key={t.id}><td>
          {editingId === t.id ? <form onSubmit={e => saveEdit(e, t.id)} className="pt-form-grid">
            <div className="pt-field"><label>Nome e cognome</label><input value={editName} onChange={e => setEditName(e.target.value)} required minLength={2} maxLength={100} /></div>
            <div className="pt-field"><label>Email</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required /></div>
            <div className="pt-field"><label>Altezza (cm)</label><input type="number" min="50" max="250" step="0.1" value={editHeight} onChange={e => setEditHeight(e.target.value)} placeholder="Non specificata" /></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="pt-button" disabled={busy}>Salva</button><button type="button" className="pt-secondary-button" disabled={busy} onClick={() => setEditingId(null)}>Annulla</button></div>
          </form> : <><strong>{t.display_name}</strong><div className="pt-muted">{t.email}</div>{t.height_cm ? <small className="pt-muted">{t.height_cm} cm</small> : null}</>}
        </td><td><span className={t.relationship_status === "active" ? "pt-status-active" : "pt-status-disabled"}>{t.relationship_status === "active" ? "Attivo" : "Sospeso"}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="pt-secondary-button" disabled={busy} onClick={() => toggleTrainer(t)}>{t.relationship_status === "active" ? "Sospendi" : "Riattiva"}</button>
          <button className="pt-secondary-button" disabled={busy} onClick={() => editingId === t.id ? setEditingId(null) : startEdit(t)}>Modifica</button>
          <button className="pt-secondary-button" style={{color:"#a12d2d",borderColor:"#d9aaaa"}} disabled={busy} onClick={() => deleteTrainer(t)}>Elimina</button>
        </div></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
