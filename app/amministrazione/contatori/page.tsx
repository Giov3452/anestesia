"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import BackButton from "@/app/components/BackButton";
import {createClient} from "@/lib/supabase/client";
import {italianNationalHolidayName,monthNames,theoreticalMonthlyHours} from "@/lib/calendar";

type User={id:string;username:string;email:string;role:string;employment_role:string;service:string};
type Shift={user_id:string;short_name:string;shift_date:string;duration_minutes:number};

const SALMON="#f7c9c1", OCRA="#e7c56a", GREEN="#c8e6c9", YELLOW="#fff3b0", BLUE="#cfe8ff";
const fmt=(n:number)=>n.toFixed(2).replace(".",",");
const roleLabel=(r:string)=>r==="calabria"?"Calabria":r==="part_time"?"Part-time":r==="gettonista"?"Gettonista":"Strutturato";

export default function Counters(){
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [users,setUsers]=useState<User[]>([]);
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [error,setError]=useState("");
 const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [realtimeTick,setRealtimeTick]=useState(0);
 const month=current.getMonth(),year=current.getFullYear();

 useEffect(()=>{(async()=>{
  const s=createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user){setAuthorized(false);return}
  const {data:p}=await s.from("profiles").select("role").eq("id",user.id).single();
  const {data:r}=await s.rpc("get_my_role");
  const role=String(p?.role||r||"utente").toLowerCase(),ok=["admin","super_admin"].includes(role);
  setAuthorized(ok);if(!ok)return;
  const [{data:u,error:ue},{data:d,error:de}]=await Promise.all([
   s.from("profiles").select("id,username,email,role,employment_role,service").order("username"),
   s.from("shift_definitions").select("short_name,duration_minutes")
  ]);
  if(ue||de){setError(ue?.message||de?.message||"Errore nel caricamento");return}
  setUsers((u||[]) as User[]);
  const defs=new Map((d||[]).map((x:any)=>[x.short_name,Number(x.duration_minutes)]));
  const from=String(year)+"-"+String(month+1).padStart(2,"0")+"-01";
  const to=new Date(year,month+1,0).toISOString().slice(0,10);
  const {data:c,error:ce}=await s.from("calendar_shifts").select("user_id,short_name,shift_date").gte("shift_date",from).lte("shift_date",to);
  if(ce){setError(ce.message);return}
  setShifts((c||[]).map((x:any)=>({user_id:x.user_id,short_name:x.short_name,shift_date:x.shift_date,duration_minutes:defs.get(x.short_name)||0})));
 })()},[year,month,realtimeTick]);

 useEffect(()=>{
  if(authorized!==true)return;
  const s=createClient();
  const channel=s.channel("contatori-calendar-shifts")
   .on("postgres_changes",{event:"*",schema:"public",table:"calendar_shifts"},()=>{
    setRealtimeTick(v=>v+1);
   })
   .subscribe();
  return()=>{s.removeChannel(channel);};
 },[authorized]);

 const nonWorkingCodes=["R","Rp","RC","SN"];
 const isSundayDay=(code:string)=>["G","Gm","Gp","GRia"].includes(code);
 const isEffectiveTurn=(x:Shift)=>!nonWorkingCodes.includes(x.short_name);
 const rows=useMemo(()=>users.filter(u=>u.service==="anestesia").map(u=>{
  const us=shifts.filter(x=>x.user_id===u.id);
  const hours=(...codes:string[])=>us.filter(x=>codes.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
  const turns=(...codes:string[])=>us.filter(x=>codes.includes(x.short_name)).length;
  const effective=us.filter(x=>!["RG","RN","RP","R","Rp","RC","SN"].includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
  const theoretical=theoreticalMonthlyHours(year,month,u.employment_role);
  const weekend=us.filter(x=>isEffectiveTurn(x)&&(()=>{const d=new Date(x.shift_date+"T12:00:00");const day=d.getDay();return (day===6||day===0)&&!(day===0&&isSundayDay(x.short_name));})()).length;
  const sundayHoliday=us.filter(x=>isEffectiveTurn(x)&&(()=>{const d=new Date(x.shift_date+"T12:00:00");return (d.getDay()===0&&isSundayDay(x.short_name))||!!italianNationalHolidayName(x.shift_date);})()).length;
  return {...u,theoretical,effective,eccesso:effective-theoretical,
   mattine:hours("M1","M2","M3"),mattineN:turns("M1","M2","M3"),
   pomeriggi:hours("P"),pomeriggiN:turns("P"),
   ft:hours("FT"),ftN:turns("FT"),
   endoscopia:hours("E"),endoscopiaN:turns("E"),
   guardie:hours("G","Gm","Gp"),guardieN:turns("G","Gm","Gp"),
   notti:hours("N"),nottiN:turns("N"),
   mortara:hours("Mo1","Mo2"),mortaraN:turns("Mo1","Mo2"),
   ria:hours("MRia","GRia","NRia"),riaN:turns("MRia","GRia","NRia"),
   reperibilita:hours("RG","RN","RP"),reperibilitaN:turns("RG","RN","RP"),
   rg:hours("RG"),rgN:turns("RG"),rn:hours("RN"),rnN:turns("RN"),rp:hours("RP"),rpN:turns("RP"),
   weekend,sundayHoliday};
 }),[users,shifts,year,month]);

 const totals=useMemo(()=>rows.reduce((a,r)=>{
  for(const k of ["theoretical","effective","eccesso","mattine","pomeriggi","ft","endoscopia","guardie","notti","mortara","ria","reperibilita","rg","rn","rp"] as const)a[k]+=r[k];
  for(const k of ["mattineN","pomeriggiN","ftN","endoscopiaN","guardieN","nottiN","mortaraN","riaN","reperibilitaN","rgN","rnN","rpN","weekend","sundayHoliday"] as const)a[k]+=r[k];
  return a
 },{theoretical:0,effective:0,eccesso:0,mattine:0,mattineN:0,pomeriggi:0,pomeriggiN:0,ft:0,ftN:0,endoscopia:0,endoscopiaN:0,guardie:0,guardieN:0,notti:0,nottiN:0,mortara:0,mortaraN:0,ria:0,riaN:0,reperibilita:0,reperibilitaN:0,rg:0,rgN:0,rn:0,rnN:0,rp:0,rpN:0,weekend:0,sundayHoliday:0}),[rows]);

 const riaRows=useMemo(()=>users.filter(u=>u.service==="rianimazione").map(u=>{
  const us=shifts.filter(x=>x.user_id===u.id),hours=(...codes:string[])=>us.filter(x=>codes.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0),turns=(...codes:string[])=>us.filter(x=>codes.includes(x.short_name)).length;
  const theoretical=theoreticalMonthlyHours(year,month,u.employment_role);
  const effective=us.filter(x=>!["RG","RN","RP","R","Rp","RC","SN"].includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
  const weekend=us.filter(x=>isEffectiveTurn(x)&&(()=>{const d=new Date(x.shift_date+"T12:00:00");const day=d.getDay();return (day===6||day===0)&&!(day===0&&isSundayDay(x.short_name));})()).length;
  const sundayHoliday=us.filter(x=>isEffectiveTurn(x)&&(()=>{const d=new Date(x.shift_date+"T12:00:00");return (d.getDay()===0&&isSundayDay(x.short_name))||!!italianNationalHolidayName(x.shift_date);})()).length;
  return {...u,theoretical,effective,eccesso:effective-theoretical,
   endoscopia:hours("E"),endoscopiaN:turns("E"),
   mria:hours("MRia"),mriaN:turns("MRia"),gria:hours("GRia"),griaN:turns("GRia"),nria:hours("NRia"),nriaN:turns("NRia"),
   reperibilita:hours("RG","RN","RP"),reperibilitaN:turns("RG","RN","RP"),
   rg:hours("RG"),rgN:turns("RG"),rn:hours("RN"),rnN:turns("RN"),rp:hours("RP"),rpN:turns("RP"),weekend,sundayHoliday};
 }),[users,shifts,year,month]);
 const riaTotals=useMemo(()=>riaRows.reduce((a,r)=>{
  a.theoretical+=r.theoretical;a.effective+=r.effective;a.eccesso+=r.eccesso;
  for(const k of ["endoscopia","mria","gria","nria","reperibilita","rg","rn","rp"] as const)a[k]+=r[k];
  for(const k of ["endoscopiaN","mriaN","griaN","nriaN","reperibilitaN","rgN","rnN","rpN","weekend","sundayHoliday"] as const)a[k]+=r[k];
  return a
 },{theoretical:0,effective:0,eccesso:0,endoscopia:0,endoscopiaN:0,mria:0,mriaN:0,gria:0,griaN:0,nria:0,nriaN:0,reperibilita:0,reperibilitaN:0,rg:0,rgN:0,rn:0,rnN:0,rp:0,rpN:0,weekend:0,sundayHoliday:0}),[riaRows]);

 if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
 if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

 const th=(label:string,bg:string,first=false)=><th style={{background:bg,color:"#18212f",minWidth:first?160:label==="WE"||label==="Dom + Festivi"?76:94,padding:"10px 6px",position:first?"sticky":"static",left:first?0:undefined,zIndex:first?4:1,whiteSpace:"nowrap"}}>{label}</th>;
 const td=(value:string|number,bg:string,first=false)=><td style={{background:bg,fontVariantNumeric:"tabular-nums",fontWeight:650,textAlign:first?"left":"center",padding:"9px 8px",position:first?"sticky":"static",left:first?0:undefined,zIndex:first?2:undefined,whiteSpace:first?"nowrap":undefined}}>{typeof value==="number"?fmt(value):value}</td>;
 const metric=(hours:number,count:number,bg:string)=><td style={{background:bg,padding:0,minWidth:94}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",height:"100%",minHeight:35}}><span title="Ore" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 3px",fontWeight:650,fontVariantNumeric:"tabular-nums",borderRight:"1px solid rgba(24,33,47,.16)"}}>{fmt(hours)}</span><span title="Numero di turni" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 3px",fontWeight:750,fontVariantNumeric:"tabular-nums"}}>{count}</span></div></td>;
 const countCell=(count:number,bg:string)=><td style={{background:bg,fontVariantNumeric:"tabular-nums",fontWeight:750,textAlign:"center",padding:"9px 6px"}}>{count}</td>;

 return <div className="shell"><header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
 <main className="main"><BackButton/><div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Contatori</h1></div><div className="generator-links"><Link className="page-action-link" href="/amministrazione/genera-turni">← Generatore di turni</Link><Link className="page-action-link" href="/amministrazione/storico-contatori" target="_blank" rel="noopener noreferrer">Storico Contatori</Link></div></div>
 {error&&<div className="error">{error}</div>}
 <section className="calendar-card"><div style={{marginBottom:12}}><p className="eyebrow" style={{margin:0}}>SALA</p><p className="sub" style={{margin:0}}>Contatori mensili del personale di Anestesia.</p></div><div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{year}</p><h2>{monthNames[month]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(year,month+1,1))}><ChevronRight size={20}/></button></div>
 <div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:12}}><thead><tr>
 {th("Dipendente","#eef2f6",true)}{th("Teorico ore",SALMON)}{th("Ore effettive",SALMON)}{th("Esubero ore",YELLOW)}{th("Mattine",SALMON)}{th("Pomeriggi",SALMON)}{th("FT",SALMON)}{th("Endoscopia E",SALMON)}{th("Guardia G",SALMON)}{th("Notti N",SALMON)}{th("Mortara",BLUE)}{th("Rianimazione",OCRA)}{th("Reperibilità",GREEN)}{th("RG",GREEN)}{th("RN",GREEN)}{th("RP",GREEN)}{th("WE",BLUE)}{th("Dom + Festivi",OCRA)}
 </tr><tr><th style={{position:"sticky",left:0,zIndex:4,background:"#eef2f6",padding:"5px 8px",textAlign:"left"}}> </th><th style={{background:SALMON,padding:5}}>ore</th><th style={{background:SALMON,padding:5}}>ore</th><th style={{background:YELLOW,padding:5}}>ore</th>{Array.from({length:14},(_,i)=><th key={i} style={{background:i===12?BLUE:i===13?OCRA:GREEN,padding:5,fontWeight:600}}>{i===12||i===13?"turni":"ore / turni"}</th>)}</tr></thead><tbody>
 {rows.map(r=><tr key={r.id}>{td(r.username,"#f8fafc",true)}{td(r.theoretical,SALMON)}{td(r.effective,SALMON)}{td(r.eccesso,YELLOW)}{metric(r.mattine,r.mattineN,SALMON)}{metric(r.pomeriggi,r.pomeriggiN,SALMON)}{metric(r.ft,r.ftN,SALMON)}{metric(r.endoscopia,r.endoscopiaN,SALMON)}{metric(r.guardie,r.guardieN,SALMON)}{metric(r.notti,r.nottiN,SALMON)}{metric(r.mortara,r.mortaraN,BLUE)}{metric(r.ria,r.riaN,OCRA)}{metric(r.reperibilita,r.reperibilitaN,GREEN)}{metric(r.rg,r.rgN,GREEN)}{metric(r.rn,r.rnN,GREEN)}{metric(r.rp,r.rpN,GREEN)}{countCell(r.weekend,BLUE)}{countCell(r.sundayHoliday,OCRA)}</tr>)}
 <tr><td style={{position:"sticky",left:0,zIndex:2,padding:"11px 8px",fontWeight:900,background:"#18212f",color:"white"}}>TOTALE</td>{td(totals.theoretical,SALMON)}{td(totals.effective,SALMON)}{td(totals.eccesso,YELLOW)}{metric(totals.mattine,totals.mattineN,SALMON)}{metric(totals.pomeriggi,totals.pomeriggiN,SALMON)}{metric(totals.ft,totals.ftN,SALMON)}{metric(totals.endoscopia,totals.endoscopiaN,SALMON)}{metric(totals.guardie,totals.guardieN,SALMON)}{metric(totals.notti,totals.nottiN,SALMON)}{metric(totals.mortara,totals.mortaraN,BLUE)}{metric(totals.ria,totals.riaN,OCRA)}{metric(totals.reperibilita,totals.reperibilitaN,GREEN)}{metric(totals.rg,totals.rgN,GREEN)}{metric(totals.rn,totals.rnN,GREEN)}{metric(totals.rp,totals.rpN,GREEN)}{countCell(totals.weekend,BLUE)}{countCell(totals.sundayHoliday,OCRA)}</tr>
 </tbody></table></div></section><section className="calendar-card" style={{marginTop:18}}><div style={{marginBottom:12}}><p className="eyebrow" style={{margin:0}}>RIANIMAZIONE</p><p className="sub" style={{margin:0}}>Contatori mensili del personale assegnato al servizio di Rianimazione.</p></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:12}}><thead><tr>{th("Dipendente","#eef2f6",true)}{th("Teorico ore",SALMON)}{th("Ore effettive",SALMON)}{th("Esubero ore",YELLOW)}{th("Endoscopia E",SALMON)}{th("MRia",OCRA)}{th("GRia",OCRA)}{th("NRia",OCRA)}{th("Reperibilità",GREEN)}{th("RG",GREEN)}{th("RN",GREEN)}{th("RP",GREEN)}{th("WE",BLUE)}{th("Dom + Festivi",OCRA)}</tr><tr><th style={{position:"sticky",left:0,zIndex:4,background:"#eef2f6",padding:"5px 8px",textAlign:"left"}}> </th><th style={{background:SALMON,padding:5}}>ore</th><th style={{background:SALMON,padding:5}}>ore</th><th style={{background:YELLOW,padding:5}}>ore</th>{Array.from({length:10},(_,i)=><th key={i} style={{background:i===8?BLUE:i===9?OCRA:OCRA,padding:5,fontWeight:600}}>{i===8||i===9?"turni":"ore / turni"}</th>)}</tr></thead><tbody>{riaRows.map(r=><tr key={r.id}>{td(r.username,"#f8fafc",true)}{td(r.theoretical,SALMON)}{td(r.effective,SALMON)}{td(r.eccesso,YELLOW)}{metric(r.endoscopia,r.endoscopiaN,SALMON)}{metric(r.mria,r.mriaN,OCRA)}{metric(r.gria,r.griaN,OCRA)}{metric(r.nria,r.nriaN,OCRA)}{metric(r.reperibilita,r.reperibilitaN,GREEN)}{metric(r.rg,r.rgN,GREEN)}{metric(r.rn,r.rnN,GREEN)}{metric(r.rp,r.rpN,GREEN)}{countCell(r.weekend,BLUE)}{countCell(r.sundayHoliday,OCRA)}</tr>)}<tr><td style={{position:"sticky",left:0,zIndex:2,padding:"11px 8px",fontWeight:900,background:"#18212f",color:"white"}}>TOTALE</td>{td(riaTotals.theoretical,SALMON)}{td(riaTotals.effective,SALMON)}{td(riaTotals.eccesso,YELLOW)}{metric(riaTotals.endoscopia,riaTotals.endoscopiaN,SALMON)}{metric(riaTotals.mria,riaTotals.mriaN,OCRA)}{metric(riaTotals.gria,riaTotals.griaN,OCRA)}{metric(riaTotals.nria,riaTotals.nriaN,OCRA)}{metric(riaTotals.reperibilita,riaTotals.reperibilitaN,GREEN)}{metric(riaTotals.rg,riaTotals.rgN,GREEN)}{metric(riaTotals.rn,riaTotals.rnN,GREEN)}{metric(riaTotals.rp,riaTotals.rpN,GREEN)}{countCell(riaTotals.weekend,BLUE)}{countCell(riaTotals.sundayHoliday,OCRA)}</tr></tbody></table></div></section></main></div>;
}