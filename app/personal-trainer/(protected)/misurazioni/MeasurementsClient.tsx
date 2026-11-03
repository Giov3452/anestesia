"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type Measurement = {
  id: string; measured_on: string; weight_kg: number | null; height_cm_used: number | null; bmi: number | null;
  fat_mass_percent: number | null; triceps_mm: number | null; subscapular_mm: number | null; abdominal_mm: number | null;
  suprailiac_mm: number | null; thigh_skinfold_mm: number | null; arm_right_cm: number | null; arm_left_cm: number | null;
  chest_cm: number | null; waist_cm: number | null; hips_cm: number | null; thigh_right_cm: number | null; thigh_left_cm: number | null; notes: string | null;
};
const fields = [
  ["fat_mass_percent","Massa grassa (%)","number"],["triceps_mm","Plica tricipitale (mm)","number"],["subscapular_mm","Plica sottoscapolare (mm)","number"],
  ["abdominal_mm","Plica addominale (mm)","number"],["suprailiac_mm","Plica sovrailiaca (mm)","number"],["thigh_skinfold_mm","Plica coscia (mm)","number"],
  ["arm_right_cm","Braccio destro (cm)","number"],["arm_left_cm","Braccio sinistro (cm)","number"],["chest_cm","Petto (cm)","number"],
  ["waist_cm","Vita (cm)","number"],["hips_cm","Fianchi (cm)","number"],["thigh_right_cm","Coscia destra (cm)","number"],["thigh_left_cm","Coscia sinistra (cm)","number"]
] as const;
export default function MeasurementsClient({ initial, defaultHeight }: { initial: Measurement[]; defaultHeight: number | null }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [weight,setWeight]=useState("");
  const [height,setHeight]=useState(defaultHeight?.toString() ?? ""); const [values,setValues]=useState<Record<string,string>>({}); const [notes,setNotes]=useState("");
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");
    const supabase=createPersonalTrainerClient();
    const payload:Record<string,unknown>={measured_on:date,weight_kg:weight?Number(weight):null,height_cm_used:height?Number(height):null,notes:notes||null};
    for(const [key] of fields) payload[key]=values[key]?Number(values[key]):null;
    const {error:err}=await supabase.from("pt_measurements").insert(payload);
    if(err)setError(err.message);else{setWeight("");setValues({});setNotes("");router.refresh();}
    setBusy(false);
  }
  return <div className="pt-page">
    <p className="pt-eyebrow">MONITORAGGIO ANTROPOMETRICO</p><h2>Misurazioni corporee</h2>
    <p className="pt-muted">Tu e il tuo personal trainer potete registrare e consultare lo storico delle rilevazioni.</p>
    <form className="pt-card pt-section" onSubmit={save}>
      <h3>Nuova rilevazione</h3>
      <div className="pt-form-grid">
        <div className="pt-field"><label>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
        <div className="pt-field"><label>Peso (kg)</label><input type="number" step="0.1" min="1" max="500" value={weight} onChange={e=>setWeight(e.target.value)} /></div>
        <div className="pt-field"><label>Altezza (cm)</label><input type="number" step="0.1" min="50" max="250" value={height} onChange={e=>setHeight(e.target.value)} /></div>
      </div>
      <h3>Composizione corporea e pliche</h3><div className="pt-form-grid">
        {fields.slice(0,6).map(([key,label])=><div className="pt-field" key={key}><label>{label}</label><input type="number" step="0.1" min="0" value={values[key]??""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></div>)}
      </div>
      <h3>Circonferenze</h3><div className="pt-form-grid">
        {fields.slice(6).map(([key,label])=><div className="pt-field" key={key}><label>{label}</label><input type="number" step="0.1" min="0" value={values[key]??""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></div>)}
      </div>
      <div className="pt-field"><label>Note</label><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      {error&&<p className="pt-error" role="alert">{error}</p>}<button className="pt-button" disabled={busy}>{busy?"Salvataggio…":"Salva rilevazione"}</button>
    </form>
    <section className="pt-section"><h3>Storico rilevazioni</h3>{initial.length===0?<div className="pt-empty">Non ci sono ancora misurazioni.</div>:<div className="pt-table-wrap"><table className="pt-table"><thead><tr><th>Data</th><th>Peso</th><th>Altezza</th><th>BMI</th><th>Massa grassa</th><th>Note</th></tr></thead><tbody>{initial.map(m=><tr key={m.id}><td>{new Date(m.measured_on+"T12:00:00").toLocaleDateString("it-IT")}</td><td>{m.weight_kg??"—"} kg</td><td>{m.height_cm_used??"—"} cm</td><td>{m.bmi??"—"}</td><td>{m.fat_mass_percent==null?"—":m.fat_mass_percent+"%"}</td><td>{m.notes||"—"}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
