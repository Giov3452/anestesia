"use client";

import { FormEvent, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

export default function PersonalTrainerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "not-authorized") setError("Questo account non è abilitato a Personal Trainer Hub.");
    if (reason === "not-linked") setError("Il profilo PT non è ancora associato a un account amministratore.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createPersonalTrainerClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError("Email o password non corrette.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("pt_profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Account non autorizzato. Chiedi all'amministratore di abilitare il tuo profilo.");
      setLoading(false);
      return;
    }

    if (profile.role === "pt") {
      const { data: relationship } = await supabase
        .from("pt_relationships")
        .select("id")
        .eq("trainer_id", data.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!relationship) {
        await supabase.auth.signOut();
        setError("Il tuo account non è ancora stato collegato. Contatta l'amministratore.");
        setLoading(false);
        return;
      }
    }

    window.location.assign("/personal-trainer/dashboard");
  }

  return (
    <main className="pt-login-wrap">
      <section className="pt-login-card">
        <div className="pt-brand">
          <span className="pt-brand-mark"><Activity size={21} /></span>
          <span>PERSONAL TRAINER HUB</span>
        </div>
        <p className="pt-eyebrow">Area riservata</p>
        <h1>Benvenuto.</h1>
        <p className="pt-muted">Accedi al tuo spazio personale per gestire lezioni, allenamenti e progressi.</p>
        {error && <div className="pt-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="pt-field">
            <label htmlFor="pt-email">Email</label>
            <input id="pt-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="pt-field">
            <label htmlFor="pt-password">Password</label>
            <input id="pt-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <button className="pt-button" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>
        <p className="pt-muted" style={{ fontSize: 12, marginTop: 22 }}>Accesso riservato agli account abilitati dall'amministratore.</p>
      </section>
    </main>
  );
}
