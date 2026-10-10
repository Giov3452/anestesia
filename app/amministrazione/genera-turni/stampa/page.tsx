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
 const columns=useMemo(()=>{const separateCodes=new Set(["GRia","MRia","NRia","Emo","RG","RP","RN","R","Rp"]);const used=new Set(shifts.filter(s=>!separateCodes.has(s.short_name)).map(s=>s.short_name));const available=defs.filter(d=>used.has(d.short_name)&&!separateCodes.has(d.short_name));const known=new Set(available.map(d=>d.short_name));const extra=Array.from(used).filter(c=>!known.has(c)).map((short_name,i)=>({id:-i-1,short_name,shift_type:"Altro",duration_minutes:0}));const rank=(code:string)=>{if(["G","GRia"].includes(code))return 0;if(code==="FT")return 1;if(["N","NRia"].includes(code))return 2;if(["M1","M2","M3"].includes(code))return 3;if(["Mo1","Mo2"].includes(code))return 4;if(["E"].includes(code))return 6;return 5};return [...available,...extra].sort((a,b)=>rank(a.short_name)-rank(b.short_name)||a.short_name.localeCompare(b.short_name,"it"))},[defs,shifts]);
 const reanimationColumns=useMemo<Def[]>(()=>[
  {id:-101,short_name:"GRia",shift_type:"Guardia",duration_minutes:0},
  {id:-102,short_name:"MRia",shift_type:"Mattina",duration_minutes:0},
  {id:-103,short_name:"NRia",shift_type:"Notte",duration_minutes:0},
  {id:-104,short_name:"Emo",shift_type:"Emodinamica",duration_minutes:0},
  {id:-105,short_name:"E",shift_type:"Endoscopia",duration_minutes:0},
 ],[]);
 const reanimationGroups=[{name:"GUARDIA",span:1},{name:"AIUTO MATTINA",span:1},{name:"NOTTE",span:1},{name:"EMODINAMICA",span:1},{name:"ENDOSCOPIA",span:1}];
 const reperibilityColumns=useMemo<Def[]>(()=>[
  {id:-201,short_name:"RG",shift_type:"Reperibilità giorno",duration_minutes:0},
  {id:-202,short_name:"RP",shift_type:"Reperibilità pomeriggio",duration_minutes:0},
  {id:-203,short_name:"RN",shift_type:"Reperibilità notte",duration_minutes:0},
 ],[]);
 const reperibilityGroups=[{name:"REPERIBILITÀ GIORNO",span:1},{name:"REPERIBILITÀ POMERIGGIO",span:1},{name:"REPERIBILITÀ NOTTE",span:1}];
 const sectionName=(code:string)=>{if(["G","GRia"].includes(code))return "GUARDIA";if(code==="FT")return "FUORI TURNO";if(["N","NRia"].includes(code))return "NOTTE";if(["M1","M2","M3"].includes(code))return "SALE";if(["Mo1","Mo2"].includes(code))return "MORTARA";if(code==="E")return "ENDOSCOPIA";return "ALTRI TURNI"};
 const groups=useMemo(()=>{const out:{name:string;span:number}[]=[];for(const c of columns){const name=sectionName(c.short_name);const last=out[out.length-1];if(last&&last.name===name)last.span++;else out.push({name,span:1})}return out},[columns]);
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
   .paper{background:white;padding:18px;border:1px solid #d8dee8;box-shadow:0 8px 30px #17203312;margin-bottom:18px}\n   .paper.sheet-page{break-before:page;page-break-before:always}
   .paper-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #252b33;padding-bottom:9px;margin-bottom:10px}
   .paper-head h2{font-size:19px;letter-spacing:.6px;text-transform:uppercase;margin:0 0 4px}
   .paper-head p{margin:0;color:#333;font-size:15px;font-weight:800;letter-spacing:.25px}
   .paper-meta{text-align:right;font-size:10px;color:#555;line-height:1.6}
   .report-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;color:#111}
   .report-table.compact-report{width:190mm;max-width:100%;margin-left:auto;margin-right:auto;table-layout:fixed}
   .report-table.oncall-report{width:94mm;max-width:100%;margin-left:auto;margin-right:auto;table-layout:fixed}
   .report-table.compact-report .day-col,.report-table.oncall-report .day-col{width:15mm}
   .report-table.compact-report .date-col,.report-table.oncall-report .date-col{width:10mm}
   .report-table.compact-report .shift-col,.report-table.compact-report td.shift-col{width:33mm}
.report-table.oncall-report .shift-col,.report-table.oncall-report td.shift-col{width:23mm}
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
    .paper{border:0;box-shadow:none;padding:0;margin:0}\n    .paper.sheet-page{break-before:page;page-break-before:always}
    .paper-head{padding-bottom:5px;margin-bottom:5px}
    .paper-head h2{font-size:13px}
    .paper-head p{font-size:11px;font-weight:800}\n    .paper-meta{font-size:8px}
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
  {[
    {title:"TURNI SERVIZIO ANESTESIA",tableColumns:columns,tableGroups:groups,page:1},
    {title:"TURNI RIANIMAZIONE",tableColumns:reanimationColumns,tableGroups:reanimationGroups,page:2},
    {title:"TURNI REPERIBILITÀ",tableColumns:reperibilityColumns,tableGroups:reperibilityGroups,page:3},
  ].map((sheet,index)=><section className={`paper ${index>0?"sheet-page":""}`} key={sheet.title}>
    <div className="paper-head"><div><h2>Turni · {months[month]} {year}</h2><p>{sheet.title}</p></div><div className="paper-meta">TURNI OSPEDALIERI<br/>Report generato il {new Date().toLocaleDateString("it-IT")}<br/>{shifts.filter(s=>sheet.tableColumns.some(col=>col.short_name===s.short_name)).length} assegnazioni</div></div>
    {loading?<p>Caricamento calendario…</p>:sheet.tableColumns.length===0?<p>Nessun turno assegnato per il mese selezionato.</p>:<table className={`report-table ${index===1?"compact-report":index===2?"oncall-report":""}`}><thead><tr><th className="day-col" rowSpan={2}>Giorno</th><th className="date-col" rowSpan={2}>Data</th>{sheet.tableGroups.map((g,i)=><th key={i} colSpan={g.span}>{g.name}</th>)}</tr><tr>{sheet.tableColumns.map(col=><th className="shift-col" key={col.id}>{col.short_name}</th>)}</tr></thead><tbody>{days.map(day=>{const date=iso(year,month,day),holiday=italianNationalHolidayName(date),isW=weekend(day);return <tr key={date} className={holiday?"holiday":isW?"weekend":""}><td className="day-col">{weekday(date).toLocaleUpperCase("it-IT")}</td><td className="date-col">{dateLabel(day)}</td>{sheet.tableColumns.map(col=>{const names=assignments[date]?.[col.short_name]||[];return <td key={col.id} className={`${names.length?"shift-name":"empty-cell"} shift-col`} title={names.join(", ")}>{names.length?names.join(" / "):"—"}</td>})}</tr>})}</tbody></table>}
    {!loading&&<div className="report-foot"><span>Le celle vuote sono indicate con un trattino. I nominativi riportano il cognome in maiuscolo.</span><span>{months[month]} {year} · Pagina {sheet.page} di 3</span></div>}
  </section>)}
 </main>
}