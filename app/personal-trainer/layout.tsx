import type { Metadata } from "next";
import "./pt.css";
export const metadata: Metadata = { title: "Personal Trainer Hub", description: "Area riservata per allenamenti e progressi." };
export default function PersonalTrainerRootLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
