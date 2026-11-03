import Link from "next/link";
import { Activity, CalendarDays, CreditCard, Dumbbell, Ruler, Camera, NotebookPen, Settings, LogOut, UserRound } from "lucide-react";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";

export default async function PersonalTrainerProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = await requirePersonalTrainerProfile();
  const links = [
    { href: "/personal-trainer/dashboard", label: "Dashboard", icon: Activity },
    { href: "/personal-trainer/lezioni", label: "Calendario", icon: CalendarDays },
    { href: "/personal-trainer/pagamenti", label: "Pagamenti al PT", icon: CreditCard },
    { href: "/personal-trainer/allenamenti", label: "Allenamenti", icon: Dumbbell },
    { href: "/personal-trainer/misurazioni", label: "Misurazioni", icon: Ruler },
    { href: "/personal-trainer/progressi", label: "Progressi", icon: Camera },
    { href: "/personal-trainer/note", label: "Note", icon: NotebookPen },
  ];

  return (
    <div className="pt-root">
      <div className="pt-shell">
        <aside className="pt-sidebar">
          <div className="pt-brand"><span className="pt-brand-mark"><Activity size={20} /></span><span>PT HUB</span></div>
          <nav className="pt-nav" aria-label="Navigazione principale">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}><Icon size={16} style={{ verticalAlign: "middle", marginRight: 10 }} />{label}</Link>
            ))}
            {profile.role === "admin" && <Link href="/personal-trainer/amministrazione"><Settings size={16} style={{ verticalAlign: "middle", marginRight: 10 }} />Amministrazione</Link>}
          </nav>
          <div className="pt-sidebar-foot">
            <div style={{ fontWeight: 700, color: "#fff" }}>{profile.display_name || profile.email}</div>
            <div style={{ margin: "5px 0 14px" }}>{profile.role === "admin" ? "Cliente · Amministratore" : "Personal trainer"}</div>
            <form action="/personal-trainer/logout" method="post">
              <button type="submit" style={{ border: 0, background: "transparent", color: "#d9e9df", padding: 0, cursor: "pointer" }}><LogOut size={16} style={{ verticalAlign: "middle" }} /><span className="pt-logout-label">Esci</span></button>
            </form>
          </div>
        </aside>
        <main className="pt-main">
          <header className="pt-topbar">
            <div><div className="pt-eyebrow" style={{ margin: "0 0 6px" }}>PERSONAL TRAINER HUB</div><h1>Il tuo spazio fitness</h1></div>
            <span className="pt-role">{profile.role === "admin" ? "CLIENTE / ADMIN" : "PERSONAL TRAINER"}</span>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
