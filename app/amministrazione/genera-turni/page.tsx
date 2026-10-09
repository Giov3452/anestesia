"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight,Pencil,Trash2,X} from "lucide-react";
import Link from "next/link";
import UserMenu from "@/app/components/UserMenu";
import {createClient} from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";
import {italianNationalHolidayName} from "@/lib/calendar";
import {getParsedRule,ruleAppliesOnDate,type ParsedGeneratorRule} from "@/lib/generator-rules";

type User={id:string;username:string;role:string;employment_role:"strutturato"|"calabria"|"part_time";service:string};
type Assignment={id:number;user_id:string;shift_date:string;short_name:string;shift_type:string|null;source:string;status:string;notes:string|null};
type Request={id:number;user_id:string;request_date:string;request_types:string[];notes:string|null;username?:string};
type Vacation={id:number;user_id:string;start_date:string;end_date:string;notes:string|null;username?:string};
type IncentiveRequest={id:number;user_id:string;request_month:string;hours:number;notes:string|null};
type RequestListRow={id:string;created_at:string;username:string;kind:"desiderata"|"ferie"|"incentivo";dateLabel:string;notes:string|null;detail?:string};
type Def={id:number;shift_type:string;short_name:string;duration_minutes:number};
type Rule={id:number;code:string;name:string;description:string;enabled:boolean;config:any};

const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const weekDays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function iso(y:number,m:number,d:number){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function buildCalendar(y:number,m:number){const first=new Date(y,m,1);const off=(first.getDay()+6)%7;const days=new Date(y,m+1,0).getDate();return [...Array(off).fill(null),...Array.from({length:days},(_,i)=>i+1)];}
function isWeekend(date:string){const [y,m,d]=date.split("-").map(Number);const w=new Date(y,m-1,d).getDay();return w===0||w===6;}
function fmtDate(v:string){return new Date(v+"T00:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});}
function requestBlocksCode(r:any,code:string){
  if(!r?.request_types?.length)return false;
  if(r.request_types.includes("non_lavorare"))return true;
  if(r.request_types.includes("notte")&&code==="N")return true;
  if(r.request_types.includes("guardia")&&["G","Gm","Gp"].includes(code))return true;
  if(r.request_types.includes("mattina")&&["M1","M2","M3","Mo1","Mo2"].includes(code))return true;
  if(r.request_types.includes("pomeriggio")&&code==="P")return true;
  return false;
}


export default function GenerateShifts(){
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  const [current,setCurrent]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const [users,setUsers]=useState<User[]>([]);
  const [defs,setDefs]=useState<Def[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [requests,setRequests]=useState<Request[]>([]);
  const [vacations,setVacations]=useState<Vacation[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [requestDate,setRequestDate]=useState<string|null>(null);
  const [requestListOpen,setRequestListOpen]=useState(false);
  const [requestListMonth,setRequestListMonth]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`});
  const [requestListRows,setRequestListRows]=useState<RequestListRow[]>([]);
  const [requestListLoading,setRequestListLoading]=useState(false);
  const [requestListError,setRequestListError]=useState("");
  const [requestKind,setRequestKind]=useState<"vacation"|"desiderata">("desiderata");
  const [editId,setEditId]=useState<number|null>(null);
  const [form,setForm]=useState({user_id:"",short_name:"",notes:""});
  const [manualRows,setManualRows]=useState([{user_id:"",short_name:"",notes:""}]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [conflictDates,setConflictDates]=useState<string[]>([]);
  const [validated,setValidated]=useState(false);
  const [interpretingRules,setInterpretingRules]=useState(false);
  const [ruleInterpretation,setRuleInterpretation]=useState<{processed:number;supported:number;needsReview:number}|null>(null);

  const load=async()=>{
    const s=createClient(); const {data:{user}}=await s.auth.getUser();
    if(!user){setAuthorized(false);return;}
    const [{data:p},{data:r}]=await Promise.all([s.from("profiles").select("role").eq("id",user.id).single(),s.rpc("get_my_role")]);
    const role=String(p?.role||r||"utente").toLowerCase(); setAuthorized(["admin","super_admin"].includes(role)); if(!["admin","super_admin"].includes(role))return;
    const y=current.getFullYear(),m=current.getMonth(),start=iso(y,m,1),end=iso(y,m,new Date(y,m+1,0).getDate()),prev=iso(y,m,0);
    const [{data:us},{data:ds},{data:as},{data:req},{data:vac},{data:rr}]=await Promise.all([
      s.from("profiles").select("id,username,role,employment_role,service").order("username"),
      s.from("shift_definitions").select("id,shift_type,short_name,duration_minutes").order("short_name"),
      s.from("calendar_shifts").select("*").gte("shift_date",start).lte("shift_date",end).order("shift_date").order("short_name"),
      s.from("requests").select("id,user_id,request_date,request_types,notes").gte("request_date",start).lte("request_date",end),
      s.from("vacations").select("id,user_id,start_date,end_date,notes").or(`start_date.lte.${end},end_date.gte.${start}`),
      s.from("generator_constraints").select("*").order("id")
    ]);
    setUsers(us||[]);setDefs(ds||[]);setAssignments(as||[]);setRequests(req||[]);setVacations(vac||[]);setRules(rr||[]);
    const {data:monthStatus}=await s.from("calendar_month_status").select("validated").eq("year",y).eq("month",m+1).maybeSingle();
    setValidated(Boolean(monthStatus?.validated));
    // Load the previous month's last day N as context; it is used by the automatic generator.
    if(prev){const {data:old}=await s.from("calendar_shifts").select("*").eq("shift_date",prev);if(old)setAssignments(a=>(as||[]).concat(old));}
  };
  useEffect(()=>{load()},[current]);

  async function interpretRules(){
    setInterpretingRules(true);setError("");setMessage("");setRuleInterpretation(null);
    try{
      const response=await fetch("/api/amministrazione/interpreta-vincoli",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Impossibile interpretare i vincoli.");
      setRuleInterpretation({processed:result.processed||0,supported:result.supported||0,needsReview:result.needsReview||0});
      setMessage("Interpretazione AI completata. Le regole strutturate sono state salvate senza modificare i turni.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Errore interpretazione AI.");}
    finally{setInterpretingRules(false);}
  }

  async function loadRequestList(monthValue:string){setRequestListLoading(true);setRequestListError("");const [y,m]=monthValue.split("-").map(Number);const start=iso(y,m-1,1),end=iso(y,m-1,new Date(y,m,0).getDate());const s=createClient();try{const [r,v,i]=await Promise.all([s.from("requests").select("id,user_id,request_date,request_types,notes,created_at").gte("request_date",start).lte("request_date",end),s.from("vacations").select("id,user_id,start_date,end_date,notes,created_at").lte("start_date",end).gte("end_date",start),s.from("incentive_availability_requests").select("id,user_id,request_month,hours,notes,created_at").eq("request_month",monthValue)]);if(r.error||v.error||i.error)throw new Error(r.error?.message||v.error?.message||i.error?.message||"Impossibile caricare le richieste.");const names=new Map(users.map(u=>[u.id,u.username]));const rows:RequestListRow[]=[...(r.data||[]).map(x=>({id:`d-${x.id}`,created_at:x.created_at,username:names.get(x.user_id)||"Utente",kind:"desiderata" as const,dateLabel:fmtDate(x.request_date),notes:x.notes,detail:(x.request_types||[]).join(", ")})),...(v.data||[]).map(x=>({id:`v-${x.id}`,created_at:x.created_at,username:names.get(x.user_id)||"Utente",kind:"ferie" as const,dateLabel:`Dal ${fmtDate(x.start_date)} al ${fmtDate(x.end_date)}`,notes:x.notes})),...(i.data||[]).map(x=>({id:`i-${x.id}`,created_at:x.created_at,username:names.get(x.user_id)||"Utente",kind:"incentivo" as const,dateLabel:"—",notes:x.notes,detail:`${x.hours} h disponibili`}))].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());setRequestListRows(rows)}catch(e){setRequestListError(e instanceof Error?e.message:"Errore caricamento richieste.")}finally{setRequestListLoading(false)}}
  function openRequestList(){const d=new Date();const monthValue=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;setRequestListMonth(monthValue);setRequestListOpen(true);void loadRequestList(monthValue)}

  const cells=useMemo(()=>buildCalendar(current.getFullYear(),current.getMonth()),[current]);
  const hiddenShiftCodes=rules.filter(r=>r.enabled).map(r=>getParsedRule(r)).filter((r):r is ParsedGeneratorRule=>!!r&&r.kind==="hide_shift").flatMap(r=>r.shiftCodes);
  const hasVacation=(date:string)=>vacations.some(v=>v.start_date<=date&&v.end_date>=date);
  const hasDesiderata=(date:string)=>requests.some(r=>r.request_date===date);
  const requestCount=(date:string)=>requests.filter(r=>r.request_date===date).length;
  const vacationCount=(date:string)=>vacations.filter(v=>v.start_date<=date&&v.end_date>=date).length;

  function openDay(date:string){setSelectedDate(date);setEditId(null);setForm({user_id:users[0]?.id||"",short_name:defs[0]?.short_name||"SN",notes:""});setManualRows([{user_id:users[0]?.id||"",short_name:defs[0]?.short_name||"SN",notes:""}]);setMessage("");setError("");}
  function editAssignment(a:Assignment){setEditId(a.id);setForm({user_id:a.user_id,short_name:a.short_name,notes:a.notes||""});setError("");}
  async function saveAssignment(e:FormEvent){e.preventDefault();if(!selectedDate)return;setBusy(true);setError("");const s=createClient();try{if(editId){if(!form.user_id||!form.short_name)throw new Error("Seleziona dipendente e turno.");const def=defs.find(d=>d.short_name===form.short_name);const {error:err}=await s.from("calendar_shifts").update({user_id:form.user_id,shift_date:selectedDate,short_name:form.short_name,shift_type:def?.shift_type||null,source:"manual",status:"confirmed",notes:form.notes||null}).eq("id",editId);if(err)throw new Error(err.code==="23505"?"Questo utente ha già lo stesso turno in questa giornata.":err.message);setMessage("Turno modificato.");setEditId(null);}else{const rows=manualRows.filter(r=>r.user_id&&r.short_name);if(!rows.length)throw new Error("Inserisci almeno un dipendente e un turno.");const payload=rows.map(r=>{const def=defs.find(d=>d.short_name===r.short_name);return {user_id:r.user_id,shift_date:selectedDate,short_name:r.short_name,shift_type:def?.shift_type||null,source:"manual",status:"confirmed",notes:r.notes||null}});const {error:err}=await s.from("calendar_shifts").insert(payload);if(err)throw new Error(err.code==="23505"?"Uno dei turni selezionati esiste già per questo utente nella giornata.":err.message);setMessage(`${payload.length} turni inseriti.`);setManualRows([{user_id:users[0]?.id||"",short_name:"SN",notes:""}]);}await load();}catch(err){setError(err instanceof Error?err.message:"Errore durante il salvataggio.");}finally{setBusy(false);}}
  async function clearCurrentMonth(){
    const y=current.getFullYear(),m=current.getMonth(),start=iso(y,m,1),end=iso(y,m,new Date(y,m+1,0).getDate());
    if(!confirm(`ATTENZIONE: cancellare TUTTI i turni di ${monthNames[m]} ${y}?\\n\\nVerranno eliminati sia i turni manuali sia le bozze automatiche del mese. Il calendario verrà completamente ripulito.\\n\\nL'operazione non è reversibile.`))return;
    setBusy(true);setError("");setMessage("");
    try{
      const s=createClient();
      const {error:e}=await s.from("calendar_shifts").delete().gte("shift_date",start).lte("shift_date",end);
      if(e)throw e;
      const {error:ve}=await s.from("calendar_month_status").update({validated:false,validated_at:null,validated_by:null}).eq("year",y).eq("month",m+1);
      if(ve)throw ve;
      setValidated(false);
      setConflictDates([]);
      setSelectedDate(null);
      setMessage(`Tutti i turni di ${monthNames[m]} ${y} sono stati cancellati. Il mese è nuovamente vuoto e modificabile.`);
      await load();
    }catch(err){setError(err instanceof Error?err.message:"Errore durante la cancellazione dei turni.");}
    finally{setBusy(false);}
  }

  async function deleteAssignment(id:number){if(!confirm("Eliminare questo turno?"))return;const {error:e}=await createClient().from("calendar_shifts").delete().eq("id",id);if(e)setError(e.message);else{setMessage("Turno eliminato.");await load();}}
  
  async function validateMonth(){
    const y=current.getFullYear(),m=current.getMonth()+1;
    if(!confirm(`Convalidare i turni di ${monthNames[m-1]} ${y}? Dopo la convalida saranno visibili agli utenti in “Turni generali”.`))return;
    setBusy(true);setError("");setMessage("");
    try{
      const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)throw new Error("Sessione non valida.");
      const {error:e}=await s.from("calendar_month_status").upsert({year:y,month:m,validated:true,validated_at:new Date().toISOString(),validated_by:user.id},{onConflict:"year,month"});
      if(e)throw e; setValidated(true); setMessage(`Turni di ${monthNames[m-1]} ${y} convalidati. Ora sono visibili in “Turni generali”.`);
    }catch(err){setError(err instanceof Error?err.message:"Errore durante la convalida.");}finally{setBusy(false);}
  }

  async function cancelValidation(){
    const y=current.getFullYear(),m=current.getMonth()+1;
    if(!confirm(`Annullare la convalida di ${monthNames[m-1]} ${y}? Il mese tornerà modificabile e non sarà più visibile agli utenti in “Turni generali”.`))return;
    setBusy(true);setError("");setMessage("");
    try{
      const {error:e}=await createClient().from("calendar_month_status").update({validated:false,validated_at:null,validated_by:null}).eq("year",y).eq("month",m);
      if(e)throw e; setValidated(false); setMessage(`Convalida di ${monthNames[m-1]} ${y} annullata. Il calendario è nuovamente modificabile.`);
    }catch(err){setError(err instanceof Error?err.message:"Errore durante l'annullamento della convalida.");}finally{setBusy(false);}
  }

  async function generate(){
    const unresolved=rules.filter(r=>r.enabled&&!getParsedRule(r));
    if(unresolved.length){setError(`Prima interpreta i vincoli AI e risolvi o disattiva quelli non supportati. Vincoli da verificare: ${unresolved.map(r=>r.name).join(", ")}`);return;}
    if(!confirm("Generare una nuova bozza automatica per questo mese? I turni manuali non verranno modificati. Le eventuali bozze automatiche precedenti del mese verranno sostituite."))return;
    setBusy(true);setError("");setMessage("");
    try{
      const s=createClient();
      const y=current.getFullYear(),m=current.getMonth(),daysInMonth=new Date(y,m+1,0).getDate();
      const startDate=iso(y,m,1),endDate=iso(y,m,daysInMonth),prev=iso(y,m,0);
      await s.from("calendar_shifts").delete().eq("source","automatic").eq("status","draft").gte("shift_date",startDate).lte("shift_date",endDate);
      const [{data:manual},{data:old},{data:req},{data:vac},{data:incentives}]=await Promise.all([
        s.from("calendar_shifts").select("*").gte("shift_date",startDate).lte("shift_date",endDate),
        s.from("calendar_shifts").select("*").eq("shift_date",prev),
        s.from("requests").select("*").gte("request_date",startDate).lte("request_date",endDate),
        s.from("vacations").select("*").or(`start_date.lte.${endDate},end_date.gte.${startDate}`),
        s.from("incentive_availability_requests").select("id,user_id,request_month,hours,notes").eq("request_month",startDate)
      ]);
      const batch=crypto.randomUUID();
      const existing=(manual||[]).filter((a:any)=>a.source==="manual"||a.status==="confirmed");
      const added:any[]=[];
      const conflicts=new Map<string,string[]>();
      const allAssignments=()=>existing.concat(added);
      const conflict=(date:string,msg:string)=>conflicts.set(date,[...(conflicts.get(date)||[]),msg]);
      const has=(uid:string,date:string,code:string)=>allAssignments().some(a=>a.user_id===uid&&a.shift_date===date&&a.short_name===code);
      const hasAnyWork=(uid:string,date:string)=>allAssignments().some(a=>a.user_id===uid&&a.shift_date===date&&a.short_name!=="SN");
      const vacation=(uid:string,date:string)=>((vac||[]) as any[]).some(v=>v.user_id===uid&&v.start_date<=date&&v.end_date>=date);
      const reqFor=(uid:string,date:string)=>((req||[]) as any[]).find(r=>r.user_id===uid&&r.request_date===date);
      const enabled=(code:string)=>rules.some(r=>r.code===code&&r.enabled);
      const compiledRules:ParsedGeneratorRule[]=rules.filter(r=>r.enabled).map(r=>getParsedRule(r)).filter((r):r is ParsedGeneratorRule=>!!r);
      const usernameMatches=(ruleName:string|null,username:string)=>!!ruleName&&username.toLowerCase().replaceAll("_"," ").trim()===ruleName.toLowerCase().replaceAll("_"," ").trim();
      const textRule=(needle:string)=>rules.find(r=>r.enabled&&(`${r.name} ${r.description}`).toLowerCase().includes(needle.toLowerCase()));
      const restRule=rules.find(r=>r.code==="rest_after_night"&&r.enabled);
      const partTimeRule=textRule("part time");
      const partTimeText=partTimeRule?`${partTimeRule.name} ${partTimeRule.description}`.toLowerCase():"";
      const partTimeDaysLimited=!!partTimeRule&&/solo dal lunedì al mercoledì|solo dal lunedi al mercoledi|lunedì al mercoledì|lunedi al mercoledi/.test(partTimeText);
      const partTimeNoGN=!!rules.find(r=>r.enabled&&/part time/i.test(`${r.name} ${r.description}`)&&/non fanno guardia o notte|non fanno guardia.*notte/i.test(`${r.name} ${r.description}`));
      const mo1Rule=rules.find(r=>r.enabled&&/mo1/i.test(`${r.name} ${r.description}`));
      const mo2Rule=rules.find(r=>r.enabled&&/mo2/i.test(`${r.name} ${r.description}`));
      const mo1User=mo1Rule?users.find(u=>mo1Rule.description.toLowerCase().includes(u.username.toLowerCase())||mo1Rule.description.toLowerCase().includes(u.username.replaceAll("_"," ").toLowerCase())):undefined;
      const rissottiRule=rules.find(r=>r.enabled&&/rissotti/i.test(`${r.name} ${r.description}`));
      const rissottiUser=users.find(u=>/rissotti/i.test(u.username));
      const endoscopyRule=rules.find(r=>r.enabled&&/endoscopia/i.test(`${r.name} ${r.description}`));
      const ftRule=rules.find(r=>r.enabled&&/\bft\b/i.test(`${r.name} ${r.description}`));
      const weekendFairnessRule=rules.find(r=>r.enabled&&(/weekend/i.test(`${r.name} ${r.description}`)||/fine settimana/i.test(`${r.name} ${r.description}`)));
      const duration=(code:string)=>Number(defs.find(d=>d.short_name===code)?.duration_minutes||0)/60;
      const weekendKey=(date:string)=>{const d=new Date(date+"T00:00:00"),dow=d.getDay();if(dow===0)d.setDate(d.getDate()-1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
      const weekendCount=(uid:string)=>{const keys=new Set<string>();for(const a of allAssignments()){if(a.user_id!==uid||a.short_name==="SN")continue;const dow=new Date(a.shift_date+"T00:00:00").getDay();if(dow===0||dow===6)keys.add(weekendKey(a.shift_date));}return keys.size;};
      const weekendShiftCount=(uid:string)=>allAssignments().filter(a=>{if(a.user_id!==uid||a.short_name==="SN")return false;const dow=new Date(a.shift_date+"T00:00:00").getDay();return dow===0||dow===6;}).length;
      const roleRate=(u:User)=>u.employment_role==="calabria"?6.4:u.employment_role==="part_time"?8:7.6;
      const baseTargetHours=(u:User)=>{let h=0;for(let d=1;d<=daysInMonth;d++){const date=iso(y,m,d),dow=new Date(date+"T00:00:00").getDay();if(dow===0||dow===6||italianNationalHolidayName(date))continue;if(u.employment_role==="part_time"&&partTimeDaysLimited&&!([1,2,3].includes(dow)))continue;h+=roleRate(u);}return h;};
      const incentiveRule=rules.find(r=>r.enabled&&r.config?.parsed_rule?.status==="supported"&&r.config?.parsed_rule?.kind==="incentive_surplus");
      const incentiveConstraintEnabled=Boolean(incentiveRule);
      const incentiveByUser=new Map<string,number>((incentiveConstraintEnabled?(incentives||[]) as IncentiveRequest[]:[]).map(r=>[r.user_id,Number(r.hours)||0] as const));
      const incentiveSurplusRequired=(uid:string)=>incentiveByUser.has(uid)?incentiveByUser.get(uid)!+Math.max(0,Number(incentiveRule?.config?.parsed_rule?.count)||0):0;
      // L'obiettivo individuale include le ore richieste per incentivo più almeno 6 ore aggiuntive.
      const targetHours=(u:User)=>baseTargetHours(u)+incentiveSurplusRequired(u.id);
      const canoviUser=users.find(u=>/mariangela_canovi/i.test(u.username));
      const hasAnyRequest=(uid:string,date:string)=>((req||[]) as any[]).some(r=>r.user_id===uid&&r.request_date===date);
      const currentHours=(uid:string)=>allAssignments().filter(a=>a.user_id===uid&&!["SN","RC","RG","RN","RP","R","Rp"].includes(a.short_name)).reduce((sum,a)=>sum+duration(a.short_name),0);
      const previousDay=(date:string)=>{const d=new Date(date+"T00:00:00");d.setDate(d.getDate()-1);return iso(d.getFullYear(),d.getMonth(),d.getDate());};
      const hadNight=(uid:string,date:string)=>allAssignments().some(a=>a.user_id===uid&&a.shift_date===date&&a.short_name==="N")||((old||[]) as any[]).some(a=>a.user_id===uid&&a.short_name==="N");
      const hardBlocked=(u:User,date:string,code:string)=>{
        if(u.service!=="anestesia")return true;
        if(vacation(u.id,date)||requestBlocksCode(reqFor(u.id,date),code))return true;
        const dow=new Date(date+"T00:00:00").getDay(),weekend=dow===0||dow===6,holiday=!!italianNationalHolidayName(date);
        if(u.employment_role==="part_time"&&partTimeDaysLimited&&!([1,2,3].includes(dow)))return true;
        if(u.employment_role==="part_time"&&partTimeNoGN&&["G","N"].includes(code))return true;
        if(rissottiRule&&rissottiUser?.id===u.id&&["G","N"].includes(code))return true;
        if(mo1Rule&&mo1User&&code==="Mo1"&&u.id!==mo1User.id)return true;
        if(mo1Rule&&mo1User&&code!=="Mo1"&&u.id===mo1User.id)return true;
        if(mo2Rule&&code==="Mo2"&&!(dow>=1&&dow<=3))return true;
        if(endoscopyRule&&code==="E"&&dow!==4)return true;
        if(ftRule&&code==="FT"&&(dow===0||dow===6))return true;
        if(restRule&&hadNight(u.id,previousDay(date)))return true;
        for(const rule of compiledRules){
          if(!ruleAppliesOnDate(rule,date,holiday))continue;
          const roleMatch=rule.employmentRoles.length===0||rule.employmentRoles.includes(u.employment_role);
          const userMatch=!rule.username||usernameMatches(rule.username,u.username);
          const codeMatch=rule.shiftCodes.length===0||rule.shiftCodes.includes(code);
          if(rule.kind==="forbid_shift_for_user"&&userMatch&&codeMatch)return true;
          if(rule.kind==="forbid_shift_for_role"&&roleMatch&&codeMatch)return true;
          if(rule.kind==="allowed_weekdays_for_role"&&roleMatch&&rule.allowedWeekdays&&!rule.allowedWeekdays.includes(dow))return true;
          if(rule.kind==="rest_after_shift"&&rule.afterShiftCodes.some(prevCode=>allAssignments().some(a=>a.user_id===u.id&&a.shift_date===previousDay(date)&&a.short_name===prevCode)))return true;
        }
        if(hasAnyWork(u.id,date))return true;
        if((weekend||holiday)&&["M1","M2","M3","Mo1","Mo2","MRia"].includes(code))return true;
        return false;
      };
      const score=(u:User,date:string,code:string)=>{const target=targetHours(u),projected=currentHours(u.id)+duration(code);let n=(target-projected)*8;const sameCode=allAssignments().filter(a=>a.user_id===u.id&&a.short_name===code).length;const counts=users.filter(x=>x.service==="anestesia").map(x=>allAssignments().filter(a=>a.user_id===x.id&&a.short_name===code).length);n-=sameCode*30;n-=Math.max(0,(Math.max(0,...counts))-sameCode)*10;const pd=previousDay(date);if(allAssignments().some(a=>a.user_id===u.id&&a.shift_date===pd))n-=12;const dow=new Date(date+"T00:00:00").getDay(),weekend=dow===0||dow===6;if(weekend&&weekendFairnessRule){const candidates=users.filter(x=>!hardBlocked(x,date,code));const minWeekend=Math.min(...candidates.map(x=>weekendCount(x.id)),weekendCount(u.id));n-=(weekendCount(u.id)-minWeekend)*120;n-=weekendShiftCount(u.id)*20;}return n+Math.random();};
      const add=(u:User,date:string,code:string,notes?:string)=>{const d=defs.find(x=>x.short_name===code);if(!d)return false;added.push({user_id:u.id,shift_date:date,short_name:code,shift_type:d.shift_type||null,source:"automatic",status:"draft",generation_batch:batch,notes:notes||null});return true;};
      const choose=(date:string,code:string)=>users.filter(u=>!hardBlocked(u,date,code)).sort((a,b)=>score(b,date,code)-score(a,date,code))[0]||null;
      // Multi-start optimization: generate several valid candidate calendars and retain the one
      // that best balances theoretical hours, weekend duties and shift types. Hard constraints are
      // enforced during every candidate build; unresolved assignments carry a very large penalty.
      const generationLoop = () => {
        for(let day=1;day<=daysInMonth;day++){
        const date=iso(y,m,day),dow=new Date(date+"T00:00:00").getDay(),weekend=dow===0||dow===6,holiday=!!italianNationalHolidayName(date);
        if(mo1Rule&&mo1User&&!weekend&&!holiday){if(!hardBlocked(mo1User,date,"Mo1"))add(mo1User,date,"Mo1","Vincolo automatico: Mo1");else conflict(date,`Mo1 non assegnabile a ${mo1User.username}`);}
        for(const rule of compiledRules){
          if(!ruleAppliesOnDate(rule,date,holiday))continue;
          if(rule.kind==="require_shift_for_user"&&rule.username){
            const target=users.find(u=>usernameMatches(rule.username,u.username));
            const code=rule.shiftCodes[0];
            if(target&&code){
              const existingCode=allAssignments().find(a=>a.shift_date===date&&a.short_name===code);
              if(existingCode&&existingCode.user_id!==target.id){
                conflict(date,`Vincolo ${"per utente"}: ${code} è già assegnato a un dipendente diverso da ${target.username}`);
              }else if(!existingCode&&!hardBlocked(target,date,code)){
                add(target,date,code,`Vincolo interpretato: ${rule.rationale}`);
              }else if(!existingCode){
                conflict(date,`Vincolo: assegnazione di ${code} non possibile per ${target.username}`);
              }
            }
          }
        }
        if(endoscopyRule&&dow===4&&!holiday){const e=choose(date,"E");if(e)add(e,date,"E","Vincolo automatico: Endoscopia");else conflict(date,"Endoscopia E non assegnabile");}
        const required:string[]=weekend?[]:["M1","M2","M3"];
        for(const rule of compiledRules){
          if(rule.kind!=="require_shift_daily"||!ruleAppliesOnDate(rule,date,holiday))continue;
          for(const code of rule.shiftCodes){if(!required.includes(code)&&!allAssignments().some(a=>a.shift_date===date&&a.short_name===code))required.push(code);}
        }
        if(mo2Rule&&!holiday&&dow>=1&&dow<=3)required.push("Mo2");
        if(ftRule&&!weekend&&dow>=1&&dow<=5)required.push("FT");
        // G e N sono richiesti una sola volta al giorno. Le regole weekend
        // definiscono la copertura del weekend, non aggiungono una seconda G/N.
        if(weekend){
          if(enabled("weekend_guard")&&!holiday)required.push("G");
          if(enabled("weekend_night"))required.push("N");
        }else{
          if(enabled("daily_guard")&&!holiday)required.push("G");
          if(enabled("daily_night"))required.push("N");
        }
        // Presenza obbligatoria della part-time Mariangela Canovi lunedì, martedì e mercoledì,
        // salvo ferie o qualsiasi desiderata registrata per quella data. Le assegniamo una sala
        // mattutina prima di distribuire le altre sale, senza sovrascrivere turni manuali esistenti.
        const canoviMustWork=!!canoviUser&&canoviUser.employment_role==="part_time"&&[1,2,3].includes(dow)&&!vacation(canoviUser.id,date)&&!hasAnyRequest(canoviUser.id,date);
        if(canoviMustWork&&!hasAnyWork(canoviUser!.id,date)){
          const canoviRoom=["M1","M2","M3"].find(code=>enabled("weekday_morning_rooms")&&!allAssignments().some(a=>a.shift_date===date&&a.short_name===code)&&!hardBlocked(canoviUser!,date,code));
          if(canoviRoom)add(canoviUser!,date,canoviRoom,"Vincolo part-time: presenza obbligatoria lunedì-mercoledì");
          else conflict(date,"Presenza obbligatoria di Mariangela Canovi non assegnabile: nessuna sala mattutina disponibile");
        }
        for(const code of required){
          if(allAssignments().some(a=>a.shift_date===date&&a.short_name===code))continue;
          if(["M1","M2","M3"].includes(code)&&!enabled("weekday_morning_rooms"))continue;
          const u=choose(date,code);
          if(u)add(u,date,code);else conflict(date,`Nessun candidato valido per ${code}`);
        }
        if(restRule){for(const u of users.filter(x=>x.service==="anestesia")){if(hadNight(u.id,date)&&day<daysInMonth){const next=iso(y,m,day+1);if(!has(u.id,next,"SN")&&!vacation(u.id,next)){if(hasAnyWork(u.id,next))conflict(next,`${u.username}: smonto notte non inseribile perché il giorno successivo contiene già un turno`);else add(u,next,"SN","Smonto notte automatico");}}}}
      }
      };
      let bestAssignments:any[]=[];
      let bestConflictEntries:[string,string[]][]=[];
      let bestObjective=Number.POSITIVE_INFINITY;
      for(let attempt=0;attempt<30;attempt++){
        added.length=0;conflicts.clear();
        generationLoop();
        // Vincolo incentivo: raggiungere almeno ore richieste + 6 h di surplus sul monte ore teorico.
        // Si redistribuiscono solo turni generati in bozza; il donatore resta almeno al monte ore teorico
        // e rispetta l'eventuale propria quota incentivo.
        const incentiveList=incentiveConstraintEnabled?(incentives||[]) as IncentiveRequest[]:[];
        for(const incentive of incentiveList){
          const recipient=users.find(u=>u.id===incentive.user_id);
          if(!recipient||recipient.service!=="anestesia")continue;
          const minimumSurplus=Math.max(0,Number(incentiveRule?.config?.parsed_rule?.count)||0);
          const needed=Math.max(0,(Number(incentive.hours)||0)+minimumSurplus-(currentHours(recipient.id)-baseTargetHours(recipient)));
          let remaining=needed;
          while(remaining>0.001){
            const candidates=added.map((a,index)=>({a,index,donor:users.find(u=>u.id===a.user_id),hours:duration(a.short_name)}))
              .filter(x=>x.donor&&x.donor.id!==recipient.id&&x.hours>0&&!["SN","RC","RG","RN","RP","R","Rp"].includes(x.a.short_name))
              .filter(x=>currentHours(x.donor!.id)-x.hours-baseTargetHours(x.donor!)>=incentiveSurplusRequired(x.donor!.id)-0.001)
              .filter(x=>!hardBlocked(recipient,x.a.shift_date,x.a.short_name))
              .sort((a,b)=>b.hours-a.hours);
            const chosen=candidates[0];
            if(!chosen)break;
            const donor=chosen.donor!;
            added[chosen.index]={...chosen.a,user_id:recipient.id,notes:`${chosen.a.notes?chosen.a.notes+" · ":""}Redistribuito per incentivo da ${donor.username}`};
            remaining-=chosen.hours;
          }
          if(remaining>0.001)conflict(endDate,`${recipient.username}: incentivo ${incentive.hours} h; surplus minimo richiesto ${Number(incentive.hours)+minimumSurplus} h oltre il monte ore teorico, mancano ${remaining.toFixed(1)} h senza portare altri utenti sotto il loro bilancio minimo`);
          // If the initial coverage allocation already pushed the incentive recipient above
          // the minimum target, rebalance excess draft shifts away instead of leaving an
          // unnecessarily large surplus. Never drop the recipient below target, and only
          // move a shift when another eligible colleague can take it without conflicts.
          const recipientTarget = baseTargetHours(recipient) + (Number(incentive.hours)||0) + minimumSurplus;
          let excess = currentHours(recipient.id) - recipientTarget;
          while(excess > 0.001){
            const candidates = added.map((a,index)=>({a,index,hours:duration(a.short_name)}))
              .filter(x=>x.a.user_id===recipient.id&&x.a.source==="automatic"&&x.a.status==="draft"&&x.hours>0
                && !["SN","RC","RG","RN","RP","R","Rp"].includes(x.a.short_name)
                && x.hours<=excess+0.001
                && !compiledRules.some(rule=>rule.kind==="require_shift_for_user"&&rule.shiftCodes.includes(x.a.short_name)
                  && ruleAppliesOnDate(rule,x.a.shift_date,!!italianNationalHolidayName(x.a.shift_date))))
              .flatMap(x=>users.filter(donor=>donor.id!==recipient.id&&!hardBlocked(donor,x.a.shift_date,x.a.short_name))
                .map(donor=>({...x,donor,remainingExcess:excess-x.hours})))
              .filter(x=>currentHours(recipient.id)-x.hours>=recipientTarget-0.001)
              .sort((a,b)=>a.remainingExcess-b.remainingExcess);
            const chosen=candidates[0];
            if(!chosen)break;
            added[chosen.index]={...chosen.a,user_id:chosen.donor.id,notes:(chosen.a.notes?chosen.a.notes+" · ":"")+"Redistribuito per contenere il surplus incentivo di "+recipient.username};
            excess=currentHours(recipient.id)-recipientTarget;
          }
        }
        let objective=0;
        for(const u of users.filter(x=>x.service==="anestesia")){
          const target=targetHours(u);
          const delta=currentHours(u.id)-target;
          objective+=Math.pow(delta/Math.max(target,40),2)*1000;
        }
        const weekendEligible=users.filter(u=>u.service==="anestesia"&&u.employment_role!=="part_time"&&u.id!==rissottiUser?.id);
        if(weekendEligible.length){
          const counts=weekendEligible.map(u=>weekendCount(u.id));
          const avg=counts.reduce((a,b)=>a+b,0)/counts.length;
          objective+=counts.reduce((sum,n)=>sum+Math.pow(n-avg,2),0)*250;
        }
        for(const code of ["G","N","M1","M2","M3","Mo2","FT","E"]){
          const eligible=users.filter(u=>u.service==="anestesia"&&( !["G","N"].includes(code)|| (u.employment_role!=="part_time"&&u.id!==rissottiUser?.id) ));
          if(eligible.length<2)continue;
          const counts=eligible.map(u=>allAssignments().filter(a=>a.user_id===u.id&&a.short_name===code).length);
          const avg=counts.reduce((a,b)=>a+b,0)/counts.length;
          objective+=counts.reduce((sum,n)=>sum+Math.pow(n-avg,2),0)*18;
        }
        objective+=conflicts.size*100000;
        if(objective<bestObjective){bestObjective=objective;bestAssignments=added.slice();bestConflictEntries=Array.from(conflicts.entries()).map(([date,msgs])=>[date,msgs.slice()]);}
      }
      added.splice(0,added.length,...bestAssignments);
      conflicts.clear();for(const [date,msgs] of bestConflictEntries)conflicts.set(date,msgs);
      if(added.length){const {error:e}=await s.from("calendar_shifts").insert(added);if(e)throw e;}
      for(const a of allAssignments()){if(a.source!=="automatic"&&a.status!=="draft")continue;const vacHit=((vac||[]) as any[]).find(v=>v.user_id===a.user_id&&v.start_date<=a.shift_date&&v.end_date>=a.shift_date);const reqHit=((req||[]) as any[]).find(r=>r.user_id===a.user_id&&r.request_date===a.shift_date&&requestBlocksCode(r,a.short_name));const username=users.find(u=>u.id===a.user_id)?.username||"Utente";if(vacHit)conflict(a.shift_date,`${username}: ferie`);if(reqHit)conflict(a.shift_date,`${username}: desiderata`);}
      const criticalDates=[...conflicts.keys()].sort();
      setConflictDates(criticalDates);
      setMessage(`Bozza generata: ${added.length} assegnazioni. Vincoli e ruoli professionali applicati.`);
      await load();
      if(criticalDates.length)window.alert("ATTENZIONE: alcuni vincoli non sono soddisfacibili con i dati disponibili.\\n\\nDate critiche:\\n"+criticalDates.map(d=>fmtDate(d)+" — "+[...new Set(conflicts.get(d)||[])].join(", ")).join("\\n")+"\\n\\nLe giornate critiche sono evidenziate in rosso nel calendario.");
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:"Errore durante la generazione automatica.");}finally{setBusy(false)}
  }

  if(authorized===null)return <main className="auth"><div>Caricamento…</div></main>;
  if(!authorized)return <main className="auth"><section className="auth-card"><h1 className="title">Accesso negato</h1><p className="sub">Questa sezione è riservata agli amministratori.</p><Link className="link" href="/dashboard">Torna alla dashboard</Link></section></main>;

  return <div className="shell"><header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><UserMenu/></header>
  <main className="main"><BackButton/><div className="generation-title-row"><div><p className="eyebrow">Programmazione</p><h1 className="title">Genera nuovi turni</h1><p className="sub">Calendario mensile operativo. Le celle sono modificabili manualmente.</p></div><div className="generator-links"><button className="generator-auto-link" onClick={generate} disabled={busy||interpretingRules}>Generatore automatico</button><Link className="page-action-link" href="/amministrazione/modifica-generatore">Modifica generatore</Link><button className="generator-auto-link" onClick={interpretRules} disabled={busy||interpretingRules}>{interpretingRules?"Interpreto…":"Interpreta vincoli AI"}</button><button className="page-action-link" onClick={openRequestList}>Vedi richieste</button><Link className="page-action-link" href="/amministrazione/contatori" target="_blank" rel="noopener noreferrer">Contatori</Link><Link className="page-action-link" href="/amministrazione/storico" target="_blank" rel="noopener noreferrer">Storico</Link><button className="generator-clear-link" onClick={clearCurrentMonth} disabled={busy}>Cancella tutto</button></div></div>
  {message&&<div className="success">{message}</div>}{error&&<div className="error">{error}</div>}{ruleInterpretation&&<div className="muted" style={{margin:"8px 0 14px"}}>Vincoli analizzati: {ruleInterpretation.processed} · Supportati: {ruleInterpretation.supported} · Da verificare: {ruleInterpretation.needsReview}</div>}
  <section className="calendar-card"><div className="calendar-head"><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()-1,1))}><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{current.getFullYear()}</p><h2>{monthNames[current.getMonth()]}</h2></div><button className="icon-btn" onClick={()=>setCurrent(new Date(current.getFullYear(),current.getMonth()+1,1))}><ChevronRight size={20}/></button></div>
  <div className="calendar admin-month-grid">{weekDays.map(d=><div className="dow" key={d}>{d}</div>)}{cells.map((day,i)=>{if(!day)return <div className="day empty" key={i}/>;const date=iso(current.getFullYear(),current.getMonth(),day),holiday=italianNationalHolidayName(date),weekend=isWeekend(date),list=assignments.filter(a=>a.shift_date===date);const persistedConflict=list.some(a=>{const v=vacations.some(x=>x.user_id===a.user_id&&x.start_date<=date&&x.end_date>=date);const r=requests.find(x=>x.user_id===a.user_id&&x.request_date===date);return v||requestBlocksCode(r,a.short_name)});const critical=conflictDates.includes(date)||persistedConflict;return <div className={`day generation-day ${weekend?"weekend-day":""} ${holiday?"holiday-day":""} ${hasVacation(date)?"has-vacation":""} ${hasDesiderata(date)?"has-desiderata":""} ${critical?"generation-conflict":""}`} key={i} onClick={()=>openDay(date)}><div className="date-row"><span className="date">{day}</span>{hasVacation(date)&&<button className="request-dot vacation-dot" aria-label={vacationCount(date)+` ferie il ${fmtDate(date)}`} title={vacationCount(date)+` ferie il ${fmtDate(date)}`} onClick={e=>{e.stopPropagation();setRequestKind("vacation");setRequestDate(date)}}/>}{hasDesiderata(date)&&<button className="request-dot desiderata-dot" aria-label={requestCount(date)+` desiderata il ${fmtDate(date)}`} title={requestCount(date)+` desiderata il ${fmtDate(date)}`} onClick={e=>{e.stopPropagation();setRequestKind("desiderata");setRequestDate(date)}}/>}</div>{holiday&&<div className="holiday-label">{holiday}</div>}<div className="cell-shifts">{list.filter(a=>!hiddenShiftCodes.includes(a.short_name)&&!(a.short_name==="SN"&&rules.some(r=>r.enabled&&r.name.toLowerCase()==="sn"&&r.description.toLowerCase().includes("non deve essere visualizzato")))).map(a=><div key={a.id} className={`calendar-shift-chip ${a.source==="automatic"?"draft-shift":""}`}><strong>{a.short_name}</strong> <span>{users.find(u=>u.id===a.user_id)?.username||"—"}</span></div>)}</div><div className="cell-edit-hint">modifica</div></div>})}</div></section><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14}}>{validated&&<button className="btn btn-secondary" onClick={cancelValidation} disabled={busy}>Annulla convalida</button>}<button className="btn btn-primary" onClick={validateMonth} disabled={busy||validated}>{validated?"Turni convalidati":"Convalida turni"}</button></div>
  <p className="muted calendar-note"><span><span className="legend-swatch weekend-swatch"/> Sabato/Domenica</span><span><span className="legend-swatch holiday-swatch"/> Festività nazionale</span><span><span className="request-dot static vacation-dot"/> Ferie</span><span><span className="request-dot static desiderata-dot"/> Desiderata</span><span><span className="conflict-mini"/> Violazione ferie/desiderata</span><span><span className="draft-mini"/> Bozza automatica</span></p></main>
  {selectedDate&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedDate(null)}><div className="modal wide-modal"><div className="modal-head"><div><p className="eyebrow">Programmazione giornaliera</p><h2>{fmtDate(selectedDate)}</h2></div><button className="icon-btn" onClick={()=>setSelectedDate(null)}><X size={21}/></button></div><div className="day-assignment-list">{assignments.filter(a=>a.shift_date===selectedDate).map(a=><div className="assignment-row" key={a.id}><span className={a.source==="automatic"?"draft-badge":""}><strong>{a.short_name}</strong> · {users.find(u=>u.id===a.user_id)?.username}</span><span className="assignment-actions">{a.status==="draft"&&<small>BOZZA</small>}<button className="icon-btn edit" onClick={()=>editAssignment(a)}><Pencil size={16}/></button><button className="icon-btn delete" onClick={()=>deleteAssignment(a.id)}><Trash2 size={16}/></button></span></div>)}{assignments.filter(a=>a.shift_date===selectedDate).length===0&&<p className="muted">Nessun turno presente.</p>}</div><form onSubmit={saveAssignment} className="manual-shift-form"><h3>{editId?"Modifica turno":"Inserisci turni manuali"}</h3>{editId?<div className="modal-grid"><div className="field"><label>Dipendente</label><select required value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})}>{users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}</select></div><div className="field"><label>Turno</label><select required value={form.short_name} onChange={e=>setForm({...form,short_name:e.target.value})}>{defs.map(d=><option key={d.id} value={d.short_name}>{d.short_name} — {d.shift_type}</option>)}</select></div></div>:manualRows.map((row,i)=><div className="modal-grid manual-entry-row" key={i}><div className="field"><label>Dipendente {i+1}</label><select required value={row.user_id} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,user_id:e.target.value}:r))}>{users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}</select></div><div className="field"><label>Turno</label><select required value={row.short_name} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,short_name:e.target.value}:r))}>{defs.map(d=><option key={d.id} value={d.short_name}>{d.short_name} — {d.shift_type}</option>)}</select></div><div className="field"><label>Note</label><input value={row.notes} onChange={e=>setManualRows(rs=>rs.map((r,j)=>j===i?{...r,notes:e.target.value}:r))}/></div>{manualRows.length>1&&<button type="button" className="icon-btn delete" onClick={()=>setManualRows(rs=>rs.filter((_,j)=>j!==i))} aria-label="Rimuovi riga"><Trash2 size={16}/></button>}</div>)}{!editId&&<button type="button" className="btn btn-secondary" onClick={()=>setManualRows(rs=>[...rs,{user_id:users[0]?.id||"",short_name:"SN",notes:""}])}>+ Aggiungi altro turno</button>}<div className="row"><button type="button" className="btn btn-secondary" onClick={()=>{setEditId(null);setManualRows([{user_id:users[0]?.id||"",short_name:"SN",notes:""}])}}>Nuovo</button><button className="btn btn-primary" disabled={busy}>{editId?"Salva modifica":"Inserisci turni"}</button></div></form></div></div>}
  {requestListOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setRequestListOpen(false)}><div className="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="request-list-title"><div className="modal-head"><div><p className="eyebrow">Gestione richieste</p><h2 id="request-list-title">Richieste per il mese di {new Date(requestListMonth+"T12:00:00").toLocaleDateString("it-IT",{month:"long",year:"numeric"})}</h2></div><button className="icon-btn" aria-label="Chiudi" onClick={()=>setRequestListOpen(false)}><X size={21}/></button></div><div className="field"><label>Mese</label><select value={requestListMonth} onChange={e=>{setRequestListMonth(e.target.value);void loadRequestList(e.target.value)}}>{Array.from({length:24-new Date().getMonth()},(_,i)=>{const d=new Date(new Date().getFullYear(),new Date().getMonth()+i,1);return <option key={d.toISOString()} value={`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`}>{d.toLocaleDateString("it-IT",{month:"long",year:"numeric"})}</option>})}</select></div>{requestListError&&<div className="error">{requestListError}</div>}{requestListLoading?<p className="muted">Caricamento richieste...</p>:requestListRows.length===0?<div className="empty-history">Nessuna richiesta per il mese selezionato.</div>:<div className="table-wrap"><table className="requests-table request-list-table"><thead><tr><th>Data inserimento</th><th>Utente</th><th>Tipo richiesta</th><th>Data di riferimento</th><th>Note</th></tr></thead><tbody>{requestListRows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td><td>{row.username}</td><td><span className={"type-badge "+(row.kind==="desiderata"?"desiderata":row.kind==="ferie"?"vacation":"incentivo")}>{row.kind==="desiderata"?"Desiderata":row.kind==="ferie"?"Ferie":"Incentivo"}</span>{row.detail&&<div className="muted table-detail">{row.detail}</div>}</td><td>{row.dateLabel}</td><td>{row.notes||"—"}</td></tr>)}</tbody></table></div>}</div></div>}
  {requestDate&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setRequestDate(null)}><div className="modal"><div className="modal-head"><div><p className="eyebrow">{requestKind==="vacation"?"Ferie":"Desiderate"}</p><h2>{requestKind==="vacation"?"Periodi di ferie":"Richieste del "+fmtDate(requestDate)}</h2></div><button className="icon-btn" onClick={()=>setRequestDate(null)}><X size={21}/></button></div>{requestKind==="vacation"?vacations.filter(v=>v.start_date<=requestDate&&v.end_date>=requestDate).map((v,i)=><div className="request-detail-row" key={`v-${i}`}><strong>{users.find(u=>u.id===v.user_id)?.username||"Utente"}</strong><span>Dal <strong>{fmtDate(v.start_date)}</strong> al <strong>{fmtDate(v.end_date)}</strong>{v.notes&&` — ${v.notes}`}</span></div>):requests.filter(r=>r.request_date===requestDate).map((r,i)=><div className="request-detail-row" key={i}><strong>{users.find(u=>u.id===r.user_id)?.username||"Utente"}</strong><span>{r.request_types.join(", ")}{r.notes&&` — ${r.notes}`}</span></div>)}</div></div>}
  </div>;
}
