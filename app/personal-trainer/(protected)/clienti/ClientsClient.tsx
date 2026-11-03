"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Client = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; status: "active" | "inactive"; created_at: string };

export default function ClientsClient({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function addClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const supabase = createPersonalTrainerClient();
    const { data, error } = await supabase.from("pt_clients").insert({
      first_name: firstName.trim(), last_name: lastName.trim(),
      email: email.trim() || null, phone: phone.trim() || null
    }).select("id,first_name,last_name,email,phone,status,created_at").single();
    if (error) setError(error.message);
    else {
      setClients(current => [data as Client, ...current]);
      setFirstName(""); setLastName(""); setEmail(""); setPhone("");
      setSuccess("Cliente aggiunto correttamente."); router.refresh();
    }
    setBusy(false);
  }

  async function toggleStatus(client: Client) {
    setBusy(true); setError(""); setSuccess("");
    const next = client.status === "active" ? "inactive" : "active";
    const supabase = createPersonalTrainerClient();
    const { error } = await supabase.from("pt_clients").update({ status: next }).eq("id", client.id);
    if (error) setError(error.message);
    else {
      setClients(current => current.map(c => c.id === client.id ? { ...c, status: next } : c));
      setSuccess(next === "inactive" ? "Cliente archiviato." : "Cliente riattivato.");
      router.refresh();
    }
    setBusy(false);
  }

  return <div className="pt-page">
    <p className="pt-eyebrow">ANAGRAFICA</p>
    <h2>Clienti</h2>
    <p className="pt-muted">Aggiungi e gestisci le persone che segui. I clienti non devono creare un account.</p>
    <section className="pt-card pt-section">
      <h3>Nuovo cliente</h3>
      <form onSubmit={addClient}>
        <div className="pt-form-grid">
          <div className="pt-field"><label htmlFor="client-first">Nome</label><input id="client-first" value={firstName} onChange={e=>setFirstName(e.target.value)} required maxLength={80}/></div>
          <div className="pt-field"><label htmlFor="client-last">Cognome</label><input id="client-last" value={lastName} onChange={e=>setLastName(e.target.value)} required maxLength={80}/></div>
          <div className="pt-field"><label htmlFor="client-email">Email (facoltativa)</label><input id="client-email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="pt-field"><label htmlFor="client-phone">Telefono (facoltativo)</label><input id="client-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
        </div>
        <button className="pt-button" disabled={busy}>{busy ? "Salvataggio…" : "Aggiungi cliente"}</button>
      </form>
      {error && <p className="pt-error" role="alert">{error}</p>}
      {success && <p className="pt-success" role="status">{success}</p>}
    </section>
    <section className="pt-section">
      <h3>Elenco clienti ({clients.length})</h3>
      {clients.length === 0 ? <div className="pt-empty">Ancora nessun cliente. Aggiungi il primo dal modulo qui sopra.</div> :
      <div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Cliente</th><th>Contatti</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
        {clients.map(c=><tr key={c.id}><td><strong>{c.first_name} {c.last_name}</strong></td><td>{c.email || "—"}<br/>{c.phone || "—"}</td><td><span className={c.status === "active" ? "pt-status-active" : "pt-status-disabled"}>{c.status === "active" ? "Attivo" : "Archiviato"}</span></td><td><button type="button" className="pt-secondary-button" disabled={busy} onClick={()=>toggleStatus(c)}>{c.status === "active" ? "Archivia" : "Riattiva"}</button></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
