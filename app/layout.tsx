import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata={title:"Turni Ospedalieri",description:"Gestione professionale dei turni ospedalieri"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}