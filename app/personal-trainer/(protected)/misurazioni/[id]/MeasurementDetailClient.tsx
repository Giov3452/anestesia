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
type MeasurementField = [string, string, string];
const groups: { title: string; fields: MeasurementField[] }[] = [
  { title: "Composizione corporea e pliche", fields: [
    ["fat_mass_percent","Massa grassa","%"],["triceps_mm","Plica tricipitale","mm"],["subscapular_mm","Plica sottoscapolare","mm"],
    ["abdominal_mm","Plica addominale","mm"],["suprailiac_mm","Plica sovrailiaca","mm"],["thigh_skinfold_mm","Plica coscia","mm"]
  ]},
  { title: "Circonferenze", fields: [
    ["arm_right_cm","Braccio destro","cm"],["arm_left_cm","Braccio sinistro","cm"],["chest_cm","Petto","cm"],
    ["waist_cm","Vita","cm"],["hips_cm","Fianchi","cm"],["thigh_right_cm","Coscia destra","cm"],["thigh_left_cm","Coscia sinistra","cm"]
  ]}
];
const allFields = groups.flatMap(g=>g.fields);
export default function MeasurementDetailClient({ initial }: { initial: Measurement }) {
  const router=useRouter();
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [date,setDate]=useState(initial.measured_on),[weight,setWeight]=useState(initial.weight_kg?.toString()??""),[height,setHeight]=useState(initial.height_cm_used?.toString()??"");
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(allFields.map(([key])=>[key,initial[key as keyof Measurement]?.toString()??""])));
  const [notes,setNotes]=useState(initial.notes??"");
  const bmi=weight&&height&&Number(weight)>0&&Number(height)>0?Number((Number(weight)/Math.pow(Number(height)/100,2)).toFixed(2)):null;
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setMessage("");
    const sb=createPersonalTrainerClient();
    const payload:Record<string,unknown>={measured_on:date,weight_kg:weight?Number(weight):null,height_cm_used:height?Number(height):null,notes:notes.trim()||null};
    for(const [key] of allFields)payload[key]=values[key]?Number(values[key]):null;
    const {error:err}=await sb.from("pt_measurements").update(payload).eq("id",initial.id);
    if(err)setError("Modifica non riuscita: "+err.message);else{setMessage("Rilevazione aggiornata.");setEditing(false);router.refresh();}
    setBusy(false);
  }
  async function remove(){if(!window.confirm("Vuoi eliminare definitivamente questa rilevazione?"))return;setBusy(true);setError("");
    const sb=createPersonalTrainerClient();const {error:err}=await sb.from("pt_measurements").delete().eq("id",initial.id);
    if(err){setError("Eliminazione non riuscita: "+err.message);setBusy(false);return;}
    router.push("/personal-trainer/misurazioni");router.refresh();
  }
  const display=(v:number|null,unit:string)=>v==null?"—":`${v} ${unit}`;
  return <div className="pt-page">
    <p className="pt-eyebrow">MONITORAGGIO ANTROPOMETRICO</p><h2>Dettaglio rilevazione</h2>
    <p className="pt-muted">Rilevazione del {new Date(initial.measured_on+"T12:00:00").toLocaleDateString("it-IT")}</p>
    <div className="pt-photo-actions">
      {!editing&&<button className="pt-button" type="button" onClick={()=>setEditing(true)}>Modifica rilevazione</button>}
      <button className="pt-secondary-button" type="button" disabled={busy} onClick={remove}>Elimina rilevazione</button>
      <button className="pt-secondary-button" type="button" onClick={()=>router.push("/personal-trainer/misurazioni")}>Torna allo storico</button>
    </div>
    {error&&<p className="pt-error" role="alert">{error}</p>}{message&&<p className="pt-success" role="status">{message}</p>}
    {editing?<form className="pt-card pt-section" onSubmit={save}>
      <h3>Modifica dati</h3><div className="pt-form-grid">
        <div className="pt-field"><label>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
        <div className="pt-field"><label>Peso (kg)</label><input type="number" min="1" max="500" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></div>
        <div className="pt-field"><label>Altezza (cm)</label><input type="number" min="50" max="250" step="0.1" value={height} onChange={e=>setHeight(e.target.value)}/></div>
      </div>
      {bmi!==null&&<div className="pt-card pt-bmi"><span className="pt-muted">BMI calcolato</span><strong>{bmi}</strong></div>}
      {groups.map(group=><section key={group.title}><h3>{group.title}</h3><div className="pt-form-grid">{group.fields.map(([key,label,unit])=><div className="pt-field" key={key}><label>{label} ({unit})</label><input type="number" min="0" step="0.1" value={values[key]??""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></div>)}</div></section>)}
      <div className="pt-field"><label>Note</label><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="pt-photo-actions"><button className="pt-button" disabled={busy}>{busy?"Salvataggio…":"Salva modifiche"}</button><button className="pt-secondary-button" type="button" disabled={busy} onClick={()=>setEditing(false)}>Annulla</button></div>
    </form>:<section className="pt-card pt-section">
      <h3>Dati generali</h3><div className="pt-form-grid">
        <div><span className="pt-muted">Data</span><p>{new Date(initial.measured_on+"T12:00:00").toLocaleDateString("it-IT")}</p></div>
        <div><span className="pt-muted">Peso</span><p>{display(initial.weight_kg,"kg")}</p></div>
        <div><span className="pt-muted">Altezza</span><p>{display(initial.height_cm_used,"cm")}</p></div>
        <div><span className="pt-muted">BMI</span><p>{initial.bmi??"—"}</p></div>
      </div>
      {groups.map(group=><section key={group.title}><h3>{group.title}</h3><div className="pt-form-grid">{group.fields.map(([key,label,unit])=><div key={key}><span className="pt-muted">{label}</span><p>{display(initial[key as keyof Measurement] as number|null,unit)}</p></div>)}</div></section>)}
      <h3>Note</h3><p style={{whiteSpace:"pre-wrap"}}>{initial.notes||"Nessuna nota inserita."}</p>
    </section>}
  </div>;
}
