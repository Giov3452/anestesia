import Link from "next/link";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
import { createPersonalTrainerServerClient } from "@/lib/personal-trainer/server";

export default async function PersonalTrainerDashboardPage() {
  const profile = await requirePersonalTrainerProfile();
  const supabase = await createPersonalTrainerServerClient();
  const now = new Date().toISOString();

  const [nextResult, completedResult, measurementResult, activePackageResult] = await Promise.all([
    supabase.from("pt_lessons").select("id,starts_at,duration_minutes,notes").eq("status","scheduled").gte("starts_at",now).order("starts_at",{ascending:true}).limit(1).maybeSingle(),
    supabase.from("pt_lessons").select("id",{count:"exact",head:true}).eq("status","completed"),
    supabase.from("pt_measurements").select("id,measured_on,weight_kg,height_cm_used,bmi,fat_mass_percent").order("measured_on",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("pt_packages").select("id,total_lessons").eq("is_active",true).eq("status","confirmed").order("created_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  const errors = [nextResult.error,completedResult.error,measurementResult.error,activePackageResult.error].filter(Boolean);
  if(errors.length) throw new Error("Impossibile aggiornare la dashboard: "+errors.map(e=>e!.message).join(" · "));
  const nextLesson=nextResult.data;
  const lastMeasurement=measurementResult.data;
  const activePackage=activePackageResult.data;
  let used=0;
  if(activePackage){
    const {count,error}=await supabase.from("pt_lessons").select("id",{count:"exact",head:true}).eq("status","completed").eq("package_id",activePackage.id);
    if(error) throw new Error("Impossibile calcolare le lezioni residue: "+error.message);
    used=count??0;
  }
  const total=activePackage?.total_lessons??0;
  const remaining=Math.max(0,total-used);
  const lessonDate=nextLesson?new Date(nextLesson.starts_at):null;
  const measurementDate=lastMeasurement?new Date(lastMeasurement.measured_on+"T12:00:00"):null;
  const fmtDate=(d:Date)=>d.toLocaleDateString("it-IT",{weekday:"short",day:"2-digit",month:"short"});
  const fmtTime=(d:Date)=>d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
  return (
    <div className="pt-page">
      <p className="pt-eyebrow" style={{ margin: 0 }}>PANORAMICA</p>
      <h2>Ciao, {profile.display_name || "bentornato"}.</h2>
      <p className="pt-muted">Il tuo spazio condiviso con il personal trainer: qui trovi un riepilogo aggiornato di lezioni e rilevazioni.</p>
      <div className="pt-grid pt-dashboard-grid">
        <article className="pt-card"><small>Prossima lezione</small><strong>{lessonDate?fmtDate(lessonDate):"—"}</strong><p className="pt-muted pt-dashboard-detail">{lessonDate?<><span>{fmtTime(lessonDate)}</span>{nextLesson?.notes&&<span className="pt-dashboard-note">{nextLesson.notes}</span>}</>:"Nessuna lezione programmata"}</p><Link href="/personal-trainer/lezioni">Apri calendario →</Link></article>
        <article className="pt-card"><small>Lezioni completate</small><strong>{completedResult.count??0}</strong><p className="pt-muted pt-dashboard-detail">Sessioni svolte con il tuo PT</p><Link href="/personal-trainer/lezioni">Vedi lezioni →</Link></article>
        <article className="pt-card"><small>Lezioni residue</small><strong>{activePackage?remaining+"/"+total:"—"}</strong><p className="pt-muted pt-dashboard-detail">{activePackage?"Pacchetto attivo · le residue dei pacchetti sostituiti non vengono conteggiate":"Nessun pacchetto attivo approvato"}</p><Link href="/personal-trainer/pagamenti">Gestisci pacchetti →</Link></article>
        <article className="pt-card"><small>Ultima rilevazione</small><strong>{measurementDate?fmtDate(measurementDate):"—"}</strong><p className="pt-muted pt-dashboard-detail">{lastMeasurement?[
          lastMeasurement.weight_kg!=null?lastMeasurement.weight_kg+" kg":null,
          lastMeasurement.bmi!=null?"BMI "+lastMeasurement.bmi:null,
          lastMeasurement.fat_mass_percent!=null?lastMeasurement.fat_mass_percent+"% massa grassa":null
         ].filter(Boolean).join(" · ")||"Rilevazione registrata":"Misurazioni non ancora inserite"}</p><Link href="/personal-trainer/misurazioni">Apri misurazioni →</Link></article>
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
    </div>
  );
}
