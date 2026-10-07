"use client";

import {useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import Link from "next/link";

const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const weekDays=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function buildCalendar(year:number,month:number){
  const first=new Date(year,month,1);
  const offset=(first.getDay()+6)%7;
  const days=new Date(year,month+1,0).getDate();
  return [...Array(offset).fill(null),...Array.from({length:days},(_,i)=>i+1)];
}

export default function GenerateShifts(){
  const today=new Date();
  const [current,setCurrent]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const cells=useMemo(()=>buildCalendar(current.getFullYear(),current.getMonth()),[current]);
  function changeMonth(delta:number){setCurrent(new Date(current.getFullYear(),current.getMonth()+delta,1))}
  return <div className="shell">
    <header className="appbar"><Link className="brand" href="/dashboard"><span className="brand-mark"><CalendarDays size={19}/></span>Turni Ospedalieri</Link><nav className="nav"><Link href="/dashboard">I miei turni</Link><Link href="/turni-generali">Turni generali</Link><Link href="/richieste">Invia richieste</Link><Link href="/amministrazione">Amministrazione</Link><Link href="/profilo">Profilo</Link></nav><form action="/auth/signout" method="post"><button className="btn btn-secondary">Esci</button></form></header>
    <main className="main">
      <p className="eyebrow">Programmazione</p><h1 className="title">Genera nuovi turni</h1><p className="sub">Seleziona il mese da programmare. La fase di assegnazione dei turni verrà aggiunta successivamente.</p>
      <section className="calendar-card admin-generation-calendar">
        <div className="calendar-head"><button className="icon-btn" onClick={()=>changeMonth(-1)} aria-label="Mese precedente"><ChevronLeft size={20}/></button><div style={{textAlign:"center"}}><p className="eyebrow" style={{margin:0}}>{current.getFullYear()}</p><h2>{monthNames[current.getMonth()]}</h2></div><button className="icon-btn" onClick={()=>changeMonth(1)} aria-label="Mese successivo"><ChevronRight size={20}/></button></div>
        <div className="calendar admin-month-grid">{weekDays.map(day=><div className="dow" key={day}>{day}</div>)}{cells.map((day,i)=><div className={"day "+(!day?"empty":"")} key={i}>{day&&<><div className="date">{day}</div><div className="generation-cell-placeholder">—</div></>}</div>)}</div>
      </section>
      <Link className="link" href="/amministrazione">← Torna alla dashboard amministrativa</Link>
    </main>
  </div>
}
