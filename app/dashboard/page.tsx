import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CalendarDays,ClipboardList,FileText} from "lucide-react";

export const dynamic = "force-dynamic";

const weekdays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const shiftLabels:Record<string,string>={G:"Giorno",N:"Notte",M1:"M1",M2:"M2",M3:"M3",mp:"Mattino + pomeriggio",RC:"Riposo compensativo"};

function buildCalendar(year:number,month:number){
  const first=new Date(year,month,1);
  const daysInMonth=new Date(year,month+1,0).getDate();
  const mondayOffset=(first.getDay()+6)%7;
  const cells:(number|null)[]=Array(mondayOffset).fill(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  while(cells.length%7) cells.push(null);
  return cells;
}

function dateKey(year:number,month:number,day:number){
  return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export default async function Dashboard(){
  const s=await createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user)redirect("/login");

  const {data:p}=await s.from("profiles").select("username,role").eq("id",user.id).single();
  const {data:myRole}=await s.rpc("get_my_role");
  const {data:shifts}=await s.from("shifts").select("shift_date,shift_type").eq("user_id",user.id).order("shift_date");

  const name=p?.username||user.user_metadata?.username||user.email?.split("@")[0]||"";
  const role=String(p?.role||myRole||"utente").toLowerCase();
  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth();
  const cells=buildCalendar(year,month);
  const monthName=new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric"}).format(now);
  const shiftsByDate=(shifts||[]).reduce<Record<string,string[]>>((acc,shift)=>{
    (acc[shift.shift_date]??=[]).push(shift.shift_type);
    return acc;
  },{});

  return <div className="shell">
    <header className="appbar">
      <div className="brand"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</div>
      <nav className="nav">
        <a href="/dashboard">I miei turni</a>
        <a href="/turni-generali">Turni generali</a>
        <a href="/richieste">Invia richieste</a>
        <a href="/amministrazione">Amministrazione</a>
        <a href="/profilo">Profilo</a>
      </nav>
      <div className="user-menu">
        <div className="avatar">{name[0]?.toUpperCase()}</div>
        <span style={{fontSize:13,fontWeight:700}}>{name}</span>
        <form action="/auth/signout" method="post"><button className="btn btn-secondary">Esci</button></form>
      </div>
    </header>

    <main className="main">
      <div className="hero">
        <div>
          <p className="eyebrow">Area personale</p>
          <h1 className="title">Ciao, {name}</h1>
          <p className="sub">Qui trovi direttamente il tuo calendario dei turni.</p>
        </div>
      </div>

      <section className="calendar-card">
        <div className="calendar-head">
          <div>
            <p className="eyebrow">Programmazione personale</p>
            <h2>{monthName.charAt(0).toUpperCase()+monthName.slice(1)}</h2>
          </div>
          <span className="calendar-count">{shifts?.length||0} turni</span>
        </div>
        <div className="calendar">
          {weekdays.map(day=><div className="dow" key={day}>{day}</div>)}
          {cells.map((day,index)=>{
            if(!day) return <div className="day empty" key={`empty-${index}`}/>;
            const key=dateKey(year,month,day);
            const dayShifts=shiftsByDate[key]||[];
            return <div className="day" key={key}>
              <div className="date">{day}</div>
              {dayShifts.map(type=><div className="shift" key={type}>{type} · {shiftLabels[type]||type}</div>)}
            </div>;
          })}
        </div>
      </section>

      <div className="grid dashboard-cards">
        <a className="card" href="/richieste"><ClipboardList size={22}/><h2>Richieste</h2><p className="muted">Indica disponibilità, indisponibilità e ferie.</p></a>
        <a className="card" href="/turni-generali"><FileText size={22}/><h2>Turni generali</h2><p className="muted">Consulta la programmazione completa del reparto.</p></a>
        <div className="card"><CalendarDays size={22}/><h2>Turni futuri</h2><p className="muted">{shifts?.length||0} turni presenti in programmazione.</p></div>
      </div>
    </main>
  </div>;
}
