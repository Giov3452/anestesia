import Link from "next/link";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";

export default async function PersonalTrainerDashboardPage() {
  const profile = await requirePersonalTrainerProfile();
  return (
    <div className="pt-page">
      <p className="pt-eyebrow" style={{ margin: 0 }}>PANORAMICA</p>
      <h2>Ciao, {profile.display_name || "bentornato"}.</h2>
      <p className="pt-muted">Qui troverai il riepilogo delle lezioni, dei pagamenti e dei tuoi progressi.</p>
      <div className="pt-grid">
        <article className="pt-card"><small>Prossima lezione</small><strong>—</strong><span className="pt-muted">Nessuna lezione programmata</span></article>
        <article className="pt-card"><small>Lezioni completate</small><strong>0</strong><span className="pt-muted">Lo storico apparirà qui</span></article>
        <article className="pt-card"><small>Ultima rilevazione</small><strong>—</strong><span className="pt-muted">Misurazioni non ancora inserite</span></article>
      </div>
      <section className="pt-section">
        <h3>Accesso rapido</h3>
        <div className="pt-links">
          <Link href="/personal-trainer/lezioni">Apri calendario</Link>
          <Link href="/personal-trainer/allenamenti">I miei allenamenti</Link>
          <Link href="/personal-trainer/misurazioni">Misurazioni corporee</Link>
          <Link href="/personal-trainer/progressi">Fotografie progressi</Link>
        </div>
      </section>
      <section className="pt-section"><div className="pt-empty"><strong style={{ color: "#294a3a" }}>Il tuo spazio è pronto.</strong><p style={{ marginBottom: 0 }}>Le funzionalità verranno attivate progressivamente: prima la gestione degli utenti e poi lezioni, pagamenti, documenti e monitoraggio antropometrico.</p></div></section>
    </div>
  );
}
