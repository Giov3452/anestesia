# Turni Ospedalieri

Web app per la gestione dei turni ospedalieri, utenti, richieste di disponibilità e ferie.

## Stack
- Next.js 16
- React 19
- Supabase Auth + PostgreSQL + Edge Functions
- TypeScript

## Configurazione locale
Copia `.env.example` in `.env.local` e inserisci URL e publishable key del progetto Supabase.

Le password non vengono salvate nella tabella `profiles`: sono gestite da Supabase Auth. La tabella profili contiene username, email e ruolo.

## Ruoli
- `super_admin`
- `admin`
- `utente`

L'operazione privilegiata di gestione utenti passa dalla Edge Function `admin-users`, protetta da JWT e da un controllo del ruolo server-side.
