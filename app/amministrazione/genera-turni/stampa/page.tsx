"use client";

import {useEffect,useMemo,useState} from "react";
import {Printer,ArrowLeft,CalendarDays} from "lucide-react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {italianNationalHolidayName} from "@/lib/calendar";

type Shift={id:number;user_id:string;shift_date:string;short_name:string;shift_type?:string|null};
type Def={id:number;short_name:string;shift_type:string;duration_minutes:number};
type Person={id:string;username:string};
const months=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const iso=(y:number,m:number,d:number)=>String(y)+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
const weekday=(date:string)=>new Date(date+"T12:00:00").toLocaleDateString("it-IT",{weekday:"short"}).replace(".","");
const surname=(username:string)=>{const p=username.split("_");return (p.length>1?p.slice(1).join("_"):username).replaceAll("_"," ").toLocaleUpperCase("it-IT")};

export default function PrintShiftsReport(){
 const [year,setYear]=useState(new Date().getFullYear());
 const [month,setMonth]=useState(new Date().getMonth());
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [defs,setDefs]=useState<Def[]>([]);
 const [people,setPeople]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const y=Number(params.get("year")),m=Number(params.get("month"));if(y>=2000&&y<=2100)setYear(y);if(m>=1&&m<=12)setMonth(m-1)},[]);
 useEffect(()=>{let active=true;(async()=>{setLoading(true);setError("");const s=createClient();const start=iso(year,month,1),end=iso(year,month,new Date(year,month+1,0).getDate());const [{data:rows,error:se},{data:definitions,error:de},{data:profiles,error:pe}]=await Promise.all([s.from("calendar_shifts").select("id,user_id,shift_date,short_name,shift_type").gte("shift_date",start).lte("shift_date",end).neq("short_name","SN").order("shift_date"),s.from("shift_definitions").select("id,short_name,shift_type,duration_minutes").order("id"),s.from("profiles").select("id,username")]);if(!active)return;if(se||de||pe){setError(se?.message||de?.message||pe?.message||"Impossibile caricare il report.");setLoading(false);return}setShifts((rows||[]).filter((x:Shift)=>x.short_name!=="SN"));setDefs((definitions||[]).filter((d:Def)=>d.short_name!=="SN"));setPeople(Object.fromEntries((profiles||[]).map((p:Person)=>[p.id,p.username])));setLoading(false)})();return()=>{active=false}},[year,month]);
 const columns=useMemo(()=>{const used=new Set(shifts.map(s=>s.short_name));const available=defs.filter(d=>used.has(d.short_name));const known=new Set(available.map(d=>d.short_name));const extra=Array.from(used).filter(c=>!known.has(c)).sort().map((short_name,i)=>({id:-i-1,short_name,shift_type:"Altro",duration_minutes:0}));return [...available,...extra]},[defs,shifts]);
 const groups=useMemo(()=>{const out:{name:string;span:number}[]=[];for(const c of columns){const name=c.shift_type||"Turni";const last=out[out.length-1];if(last&&last.name===name)last.span++;else out.push({name,span:1})}return out},[columns]);
 const days=useMemo(()=>Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>i+1),[year,month]);
 const assignments=useMemo(()=>{const map:Record<string,Record<string,string[]>>={};for(const a of shifts){const day=map[a.shift_date]??(map[a.shift_date]={});const peopleForShift=day[a.short_name]??(day[a.short_name]=[]);const name=people[a.user_id];if(name)peopleForShift.push(surname(name))}return map},[shifts,people]);
 const dateLabel=(day:number)=>new Date(year,month,day).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"});
 const weekend=(day:number)=>{const w=new Date(year,month,day).getDay();return w===0||w===6};
 return <main className="report-shell">
  <style jsx global>{`
   *{box-sizing:border-box}
   body{margin:0;background:#eef1f5;color:#151a22;font-family:Arial,Helvetica,sans-serif}
   .report-shell{max-width:1500px;margin:0 auto;padding:24px}
   .report-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}
   .report-toolbar h1{font-size:23px;margin:0 0 5px;font-weight:800;letter-spacing:-.3px}
   .report-toolbar p{font-size:13px;color:#667085;margin:0}
   .report-actions{display:flex;gap:9px;align-items:center}
   .report-button{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #cbd3df;border-radius:9px;background:white;color:#182230;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer}
   .report-button.primary{background:#1f2937;color:white;border-color:#1f2937}
   .paper{background:white;padding:18px;border:1px solid #d8dee8;box-shadow:0 8px 30px #17203312}
   .paper-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #252b33;padding-bottom:9px;margin-bottom:10px}
   .paper-head h2{font-size:19px;letter-spacing:.6px;text-transform:uppercase;margin:0 0 4px}
   .paper-head p{margin:0;color:#555;font-size:10px}
   .paper-meta{text-align:right;font-size:10px;color:#555;line-height:1.6}
   .report-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;color:#111}
   .report-table th,.report-table td{border:1px solid #aeb5be;padding:3px 2px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
   .report-table thead th{background:#e9edf1;color:#111;font-weight:800}
   .report-table thead tr:first-child th{font-size:8px;text-transform:uppercase;letter-spacing:.15px;background:#dfe4e9}
   .report-table thead tr:nth-child(2) th{font-size:9px}
   .report-table .day-col{width:17mm;font-weight:800;white-space:nowrap}
   .report-table .date-col{width:11mm}
   .report-table .shift-col{min-width:0}
   .report-table td.shift-name{font-weight:700}
   .report-table tr.weekend td{background:#f0f0f0}
   .report-table tr.holiday td{background:#e5e5e5}
   .report-table tr.weekend td.shift-name,.report-table tr.holiday td.shift-name{background:#dedede}
   .report-table .empty-cell{color:#b0b0b0}
   .report-foot{display:flex;justify-content:space-between;gap:12px;margin-top:8px;color:#555;font-size:9px}
   .report-error{padding:12px;background:#fff0f0;border:1px solid #e5aaaa;color:#7f1d1d;border-radius:8px}
   @media print{
    @page{size:A4 landscape;margin:5mm}
    body{background:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-shell{max-width:none;padding:0;margin:0}
    .report-toolbar{display:none!important}
    .paper{border:0;box-shadow:none;padding:0}
    .paper-head{padding-bottom:5px;margin-bottom:5px}
    .paper-head h2{font-size:13px}
    .paper-head p,.paper-meta{font-size:8px}
    .report-table{font-size:6.5px}
    .report-table th,.report-table td{padding:2px 1px;line-height:1.12}
    .report-table thead tr:first-child th{font-size:6px}
    .report-table thead tr:nth-child(2) th{font-size:6.5px}
    .report-table .day-col{width:13mm}
    .report-table .date-col{width:9mm}
    .report-foot{font-size:7px;margin-top:4px}
    .report-table tr{break-inside:avoid;page-break-inside:avoid}
   }
   @media(max-width:760px){.report-shell{padding:12px}.report-toolbar{align-items:flex-start;flex-direction:column}.report-actions{width:100%;flex-wrap:wrap}.paper{padding:8px;overflow-x:auto}.report-table{min-width:1000px}}
  `}</style>
  <div className="report-toolbar"><div><h1>Report di stampa</h1><p>Calendario mensile · formato A4 orizzontale · ottimizzato per stampa in bianco e nero</p></div><div className="report-actions"><Link className="report-button" href="/amministrazione/genera-turni"><ArrowLeft size={16}/> Torna al generatore</Link><button className="report-button primary" onClick={()=>window.print()}><Printer size={16}/> Stampa</button></div></div>
  {error&&<div className="report-error">{error}</div>}
  <section className="paper"><div className="paper-head"><div><h2>Turni · {months[month]} {year}</h2><p>Programmazione mensile del personale · assegnazioni per giornata</p></div><div className="paper-meta">TURNI OSPEDALIERI<br/>Report generato il {new Date().toLocaleDateString("it-IT")}<br/>{shifts.length} assegnazioni</div></div>
  {loading?<p>Caricamento calendario…</p>:columns.length===0?<p>Nessun turno assegnato per il mese selezionato.</p>:<table className="report-table"><thead><tr><th className="day-col" rowSpan={2}>Giorno</th><th className="date-col" rowSpan={2}>Data</th>{groups.map((g,i)=><th key={i} colSpan={g.span}>{g.name}</th>)}</tr><tr>{columns.map(c=><th className="shift-col" key={c.id}>{c.short_name}</th>)}</tr></thead><tbody>{days.map(day=>{const date=iso(year,month,day),holiday=italianNationalHolidayName(date),isW=weekend(day);return <tr key={date} className={holiday?"holiday":isW?"weekend":""}><td className="day-col">{weekday(date).toLocaleUpperCase("it-IT")}</td><td className="date-col">{dateLabel(day)}</td>{columns.map(c=>{const names=assignments[date]?.[c.short_name]||[];return <td key={c.id} className={names.length?"shift-name":"empty-cell"} title={names.join(", ")}>{names.length?names.join(" / "):"—"}</td>})}</tr>})}</tbody></table>}
  {!loading&&columns.length>0&&<div className="report-foot"><span>Le celle vuote sono indicate con un trattino. I nominativi riportano il cognome in maiuscolo.</span><span>{months[month]} {year} · Pagina 1</span></div>}
  </section>
 </main>
}