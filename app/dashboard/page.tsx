import UserMenu from "@/app/components/UserMenu";
import PersonalCounters from "@/app/components/PersonalCounters";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CalendarDays} from "lucide-react";

export const dynamic = "force-dynamic";

const weekdays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
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
  if(!user) redirect("/login");

  const {data:p}=await s.from("profiles").select("username").eq("id",user.id).single();
  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth()+1;
  const {data:status}=await s.from("calendar_month_status").select("validated").eq("year",year).eq("month",month).maybeSingle();
  const validated=status?.validated===true;
  const monthStart=dateKey(year,month-1,1);
  const monthEnd=dateKey(year,month-1,new Date(year,month,0).getDate());
  const [{data:shifts},{data:vacations}]=await Promise.all([
    validated
      ? s.from("calendar_shifts").select("shift_date,short_name").eq("user_id",user.id).gte("shift_date",monthStart).lte("shift_date",monthEnd).order("shift_date")
      : Promise.resolve({data:[] as {shift_date:string;short_name:string}[]}),
    s.from("vacations").select("start_date,end_date").eq("user_id",user.id).lte("start_date",monthEnd).gte("end_date",monthStart),
  ]);

  const name=p?.username||user.user_metadata?.username||user.email?.split("@")[0]||"";
  const calendarMonth=month-1;
  const cells=buildCalendar(year,calendarMonth);
  const monthName=new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric"}).format(now);
  const shiftsByDate=(shifts||[]).reduce<Record<string,string[]>>((acc,shift)=>{
    if(shift.short_name==="SN")return acc;
    const list=acc[shift.shift_date]??=[];
    if(!list.includes(shift.short_name))list.push(shift.short_name);
    return acc;
  },{});
  const vacationDates=new Set<string>();
  for(const vacation of vacations||[]){
    const start=vacation.start_date>monthStart?vacation.start_date:monthStart;
    const end=vacation.end_date<monthEnd?vacation.end_date:monthEnd;
    for(let cursor=new Date(start+"T12:00:00");cursor<=new Date(end+"T12:00:00");cursor.setDate(cursor.getDate()+1)){
      vacationDates.add(dateKey(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()));
    }
  }

  return <div className="shell dashboard-shell">
    <header className="appbar">
      <div className="brand"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</div>
      <UserMenu/>
    </header>

    <main className="main dashboard-main">
      <section className="dashboard-intro">
        <p className="eyebrow">Area personale</p>
        <h1 className="title">Ciao, {name}</h1>
        <p className="sub">Qui trovi direttamente il tuo calendario dei turni.</p>
      </section>

      <section className="calendar-card dashboard-calendar-card">
        <div className="calendar-head">
          <div>
            <p className="eyebrow">Programmazione personale</p>
            <h2>{monthName.charAt(0).toUpperCase()+monthName.slice(1)}</h2>
          </div>
          <span className={`calendar-count ${validated?"validated":"pending"}`}>
            {validated ? `${shifts?.length||0} turni` : "Non convalidati"}
          </span>
        </div>

        {!validated ? (
          <div className="dashboard-empty-state">
            <h3>Turni non ancora convalidati</h3>
            <p>I tuoi turni personali saranno visibili qui dopo la convalida dei turni del mese da parte dell'amministrazione.</p>
          </div>
        ) : (
          <div className="calendar dashboard-calendar">
            {weekdays.map(day=><div className="dow" key={day}>{day}</div>)}
            {cells.map((day,index)=>{
              if(!day) return <div className="day empty" key={`empty-${index}`}/>;
              const key=dateKey(year,calendarMonth,day);
              const dayShifts=shiftsByDate[key]||[];
              return <div className="day" key={key}>
                <div className="date">{day}</div>
                {dayShifts.map(type=><div className="shift" key={type}>{type}</div>)}
                {vacationDates.has(key)&&<div className="shift vacation-label">FERIE</div>}
              </div>;
            })}
          </div>
        )}
      </section>

      <PersonalCounters />
    </main>
  </div>;
}
