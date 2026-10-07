export const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

export function iso(y:number,m:number,d:number){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}

function easterSunday(year:number){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;return new Date(year,month,day);}

export function italianNationalHolidayName(date:string){const [y,m,d]=date.split("-").map(Number);const fixed:[number,number,string][]=[[1,1,"Capodanno"],[1,6,"Epifania"],[4,25,"Liberazione"],[5,1,"Festa del Lavoro"],[6,2,"Festa della Repubblica"],[8,15,"Ferragosto"],[11,1,"Ognissanti"],[12,8,"Immacolata"],[12,25,"Natale"],[12,26,"Santo Stefano"]];for(const [mm,dd,n] of fixed)if(m===mm&&d===dd)return n;const e=easterSunday(y);e.setDate(e.getDate()+1);if(e.getMonth()+1===m&&e.getDate()===d)return "Lunedì dell'Angelo";return null;}

export function isItalianNationalHoliday(date:string){return Boolean(italianNationalHolidayName(date));}

export function theoreticalMonthlyHours(year:number,month:number,role:string){
  const days=new Date(year,month+1,0).getDate();let count=0;
  for(let day=1;day<=days;day++){
    const date=iso(year,month,day); if(isItalianNationalHoliday(date))continue;
    const weekday=new Date(year,month,day).getDay();
    if(role==="part_time"){if([1,3,5].includes(weekday))count+=8;}
    else if([1,2,3,4,5].includes(weekday))count+=role==="calabria"?6.4:7.6;
  }
  return count;
}