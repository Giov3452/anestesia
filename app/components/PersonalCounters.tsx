"use client";

import {useEffect,useMemo,useState} from "react";
import {ChevronLeft,ChevronRight} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {monthNames,theoreticalMonthlyHours} from "@/lib/calendar";

type Profile={username:string;service:string;employment_role:string};
type Shift={short_name:string;duration_minutes:number};

const SALMON="#f7c9c1",OCRA="#e7c56a",GREEN="#c8e6c9",YELLOW="#fff3b0",BLUE="#cfe8ff";
const fmt=(n:number)=>n.toFixed(2).replace(".",",");
const roleLabel=(r:string)=>r==="calabria"?"Calabria":r==="part_time"?"Part-time":r==="gettonista"?"Gettonista":"Strutturato";
const SALA_EFFECTIVE_EXCLUDED=["RG","RN","RP","R","Rp","RC","SN"];
const RIA_EFFECTIVE_EXCLUDED=["RG","RN","RP","R","Rp"];

export default function PersonalCounters(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [shifts,setShifts]=useState<Shift[]>([]);
  const [validated,setValidated]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [realtimeTick,setRealtimeTick]=useState(0);

  const now=new Date();
  const currentMonth=new Date(now.getFullYear(),now.getMonth(),1);
  const month=current.getMonth(),year=current.getFullYear();
  const isCurrentMonth=year===currentMonth.getFullYear()&&month===currentMonth.getMonth();

  useEffect(()=>{(async()=>{
    setLoading(true);setError("");
    const s=createClient();
    const {data:{user}}=await s.auth.getUser();
    if(!user){setLoading(false);return}
    const [{data:p,error:pe},{data:status,error:se}]=await Promise.all([
      s.from("profiles").select("username,service,employment_role").eq("id",user.id).single(),
      s.from("calendar_month_status").select("validated").eq("year",year).eq("month",month+1).maybeSingle()
    ]);
    if(pe||se){setError(pe?.message||se?.message||"Errore nel caricamento");setLoading(false);return}
    setProfile(p as Profile);
    const ok=status?.validated===true;
    setValidated(ok);
    if(!ok){setShifts([]);setLoading(false);return}

    const {data:defs,error:de}=await s.from("shift_definitions").select("short_name,duration_minutes");
    if(de){setError(de.message);setLoading(false);return}
    const durations=new Map((defs||[]).map((d:any)=>[d.short_name,Number(d.duration_minutes)]));
    const from=`${year}-${String(month+1).padStart(2,"0")}-01`;
    const to=new Date(year,month+1,0).toISOString().slice(0,10);
    const {data:rows,error:re}=await s.from("calendar_shifts").select("short_name").eq("user_id",user.id).gte("shift_date",from).lte("shift_date",to);
    if(re){setError(re.message);setLoading(false);return}
    setShifts((rows||[]).filter((x:any)=>x.short_name!=="SN").map((x:any)=>({short_name:x.short_name,duration_minutes:durations.get(x.short_name)||0})));
    setLoading(false);
  })()},[year,month,realtimeTick]);

  useEffect(()=>{
    const s=createClient();
    const channel=s.channel("home-counters-calendar-shifts")
      .on("postgres_changes",{event:"*",schema:"public",table:"calendar_shifts"},()=>setRealtimeTick(v=>v+1))
      .on("postgres_changes",{event:"*",schema:"public",table:"calendar_month_status"},()=>setRealtimeTick(v=>v+1))
      .subscribe();
    return()=>{s.removeChannel(channel)};
  },[]);

  const sala=useMemo(()=>{
    if(!profile||profile.service!=="anestesia")return null;
    const hours=(...codes:string[])=>shifts.filter(x=>codes.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
    const effective=shifts.filter(x=>!SALA_EFFECTIVE_EXCLUDED.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
    const theoretical=theoreticalMonthlyHours(year,month,profile.employment_role);
    return {theoretical,effective,eccesso:effective-theoretical,mattine:hours("M1","M2","M3"),mattineN:shifts.filter(x=>["M1","M2","M3"].includes(x.short_name)).length,pomeriggi:hours("P"),pomeriggiN:shifts.filter(x=>x.short_name==="P").length,ft:hours("FT"),ftN:shifts.filter(x=>x.short_name==="FT").length,endoscopia:hours("E"),endoscopiaN:shifts.filter(x=>x.short_name==="E").length,guardie:hours("G","Gm","Gp"),guardieN:shifts.filter(x=>["G","Gm","Gp"].includes(x.short_name)).length,notti:hours("N"),nottiN:shifts.filter(x=>x.short_name==="N").length,mortara:hours("Mo1","Mo2"),mortaraN:shifts.filter(x=>["Mo1","Mo2"].includes(x.short_name)).length,ria:hours("MRia","GRia","NRia"),riaN:shifts.filter(x=>["MRia","GRia","NRia"].includes(x.short_name)).length,reperibilita:hours("RG","RN","RP"),reperibilitaN:shifts.filter(x=>["RG","RN","RP"].includes(x.short_name)).length,rg:hours("RG"),rgN:shifts.filter(x=>x.short_name==="RG").length,rn:hours("RN"),rnN:shifts.filter(x=>x.short_name==="RN").length,rp:hours("RP"),rpN:shifts.filter(x=>x.short_name==="RP").length};
  },[profile,shifts,year,month]);

  const ria=useMemo(()=>{
    if(!profile||profile.service!=="rianimazione")return null;
    const hours=(...codes:string[])=>shifts.filter(x=>codes.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
    const effective=shifts.filter(x=>!RIA_EFFECTIVE_EXCLUDED.includes(x.short_name)).reduce((a,x)=>a+x.duration_minutes/60,0);
    const theoretical=theoreticalMonthlyHours(year,month,profile.employment_role);
    return {theoretical,effective,eccesso:effective-theoretical,endoscopia:hours("E"),endoscopiaN:shifts.filter(x=>x.short_name==="E").length,mria:hours("MRia"),mriaN:shifts.filter(x=>x.short_name==="MRia").length,gria:hours("GRia"),griaN:shifts.filter(x=>x.short_name==="GRia").length,nria:hours("NRia"),nriaN:shifts.filter(x=>x.short_name==="NRia").length,reperibilita:hours("RG","RN","RP"),reperibilitaN:shifts.filter(x=>["RG","RN","RP"].includes(x.short_name)).length,rg:hours("RG"),rgN:shifts.filter(x=>x.short_name==="RG").length,rn:hours("RN"),rnN:shifts.filter(x=>x.short_name==="RN").length,rp:hours("RP"),rpN:shifts.filter(x=>x.short_name==="RP").length};
  },[profile,shifts,year,month]);

  const th=(label:string,bg:string)=><th style={{background:bg,color:"#18212f",minWidth:label==="Dipendente"?145:88,padding:"10px 6px"}}>{label}</th>;
  const td=(value:number,bg:string)=><td style={{background:bg,fontVariantNumeric:"tabular-nums",fontWeight:650,textAlign:"center",padding:"9px 6px"}}>{fmt(value)}</td>;
  const metric=(hours:number,count:number,bg:string)=><td style={{background:bg,padding:0,minWidth:88}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:35,height:"100%"}}><span title="Ore" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 3px",fontWeight:650,fontVariantNumeric:"tabular-nums",borderRight:"1px solid rgba(24,33,47,.16)"}}>{fmt(hours)}</span><span title="Numero di turni" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 3px",fontWeight:750,fontVariantNumeric:"tabular-nums"}}>{count}</span></div></td>;

  if(loading&&!profile)return <section className="calendar-card" style={{marginTop:18}}><div className="card" style={{margin:0,textAlign:"center"}}>Caricamento…</div></section>;

  return <section className="calendar-card" style={{marginTop:18}}>
    <div className="calendar-head">
      <div>
        <p className="eyebrow" style={{margin:0}}>Contatori personali</p>
        <h2>{monthNames[month]} {year}</h2>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="icon-btn" aria-label="Mese precedente" onClick={()=>setCurrent(new Date(year,month-1,1))}><ChevronLeft size={20}/></button>
        <button className="icon-btn" aria-label="Mese successivo" disabled={isCurrentMonth} onClick={()=>setCurrent(new Date(year,month+1,1))} style={{opacity:isCurrentMonth?.45:1}}><ChevronRight size={20}/></button>
      </div>
    </div>

    {error&&<div className="error">{error}</div>}
    {!validated
      ? <div className="card" style={{margin:0,textAlign:"center"}}><h3>Contatori non ancora disponibili</h3><p className="muted">I contatori saranno visibili dopo la convalida dei turni del mese da parte dell'amministrazione.</p></div>
      : profile?.service==="anestesia"&&sala
        ? <div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:12}}><thead><tr>
            {th("Dipendente","#eef2f6")}{th("Teorico ore",SALMON)}{th("Ore effettive",SALMON)}{th("Esubero ore",YELLOW)}{th("Mattine",SALMON)}{th("Pomeriggi",SALMON)}{th("FT",SALMON)}{th("Endoscopia E",SALMON)}{th("Guardia G",SALMON)}{th("Notti N",SALMON)}{th("Mortara",BLUE)}{th("Rianimazione",OCRA)}{th("Reperibilità",GREEN)}{th("RG",GREEN)}{th("RN",GREEN)}{th("RP",GREEN)}
          </tr></thead><tbody><tr><td style={{fontWeight:800,whiteSpace:"nowrap",padding:"9px 8px",background:"#f8fafc"}}><div>{profile.username}</div><small style={{fontWeight:500,color:"#667085"}}>{roleLabel(profile.employment_role)}</small></td>
            {td(sala.theoretical,SALMON)}{td(sala.effective,SALMON)}{td(sala.eccesso,YELLOW)}{metric(sala.mattine,sala.mattineN,SALMON)}{metric(sala.pomeriggi,sala.pomeriggiN,SALMON)}{metric(sala.ft,sala.ftN,SALMON)}{metric(sala.endoscopia,sala.endoscopiaN,SALMON)}{metric(sala.guardie,sala.guardieN,SALMON)}{metric(sala.notti,sala.nottiN,SALMON)}{metric(sala.mortara,sala.mortaraN,BLUE)}{metric(sala.ria,sala.riaN,OCRA)}{metric(sala.reperibilita,sala.reperibilitaN,GREEN)}{metric(sala.rg,sala.rgN,GREEN)}{metric(sala.rn,sala.rnN,GREEN)}{metric(sala.rp,sala.rpN,GREEN)}
          </tr></tbody></table></div>
        : profile?.service==="rianimazione"&&ria
          ? <div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:2,fontSize:12}}><thead><tr>
              {th("Dipendente","#eef2f6")}{th("Teorico ore",SALMON)}{th("Ore effettive",SALMON)}{th("Esubero ore",YELLOW)}{th("Endoscopia E",SALMON)}{th("MRia",OCRA)}{th("GRia",OCRA)}{th("NRia",OCRA)}{th("Reperibilità",GREEN)}{th("RG",GREEN)}{th("RN",GREEN)}{th("RP",GREEN)}
            </tr></thead><tbody><tr><td style={{fontWeight:800,whiteSpace:"nowrap",padding:"9px 8px",background:"#f8fafc"}}><div>{profile.username}</div><small style={{fontWeight:500,color:"#667085"}}>{roleLabel(profile.employment_role)}</small></td>
              {td(ria.theoretical,SALMON)}{td(ria.effective,SALMON)}{td(ria.eccesso,YELLOW)}{metric(ria.endoscopia,ria.endoscopiaN,SALMON)}{metric(ria.mria,ria.mriaN,OCRA)}{metric(ria.gria,ria.griaN,OCRA)}{metric(ria.nria,ria.nriaN,OCRA)}{metric(ria.reperibilita,ria.reperibilitaN,GREEN)}{metric(ria.rg,ria.rgN,GREEN)}{metric(ria.rn,ria.rnN,GREEN)}{metric(ria.rp,ria.rpN,GREEN)}
            </tr></tbody></table></div>
          : null}
  </section>;
}
