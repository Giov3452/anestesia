"use client";

import {ArrowLeft} from "lucide-react";
import {useRouter} from "next/navigation";

export default function BackButton(){
  const router=useRouter();
  return <button type="button" className="page-back" onClick={()=>router.back()} aria-label="Torna alla pagina precedente">
    <ArrowLeft size={17}/>
    <span>Indietro</span>
  </button>;
}
