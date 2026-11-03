import { SectionPage } from "@/app/personal-trainer/components/SectionPage";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
export default async function AdministrationPage() {
  await requirePersonalTrainerProfile("admin");
  return <SectionPage eyebrow="AREA ADMIN" title="Amministrazione" description="Gestione degli accessi e configurazione di Personal Trainer Hub." emptyTitle="Account amministratore attivato" emptyDescription="Il tuo profilo è stato registrato con ruolo ADMIN. Nel prossimo passaggio aggiungeremo la creazione e abilitazione dell'account PT e la gestione della relazione tra i due profili." />;
}
