# Amidays Kunderegister

Internt verktøy for retainere, timeføring og mersalgspipeline. Next.js + Supabase.
Fungerer som en "desktop app" ved at du installerer den som PWA fra nettleseren (se nederst).

## 1. Sett opp Supabase

1. Gå til [supabase.com](https://supabase.com) → opprett nytt prosjekt (gratis tier er nok).
2. Gå til **SQL Editor** → **New query** → lim inn hele innholdet i [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
   - Dette oppretter alle tabeller, triggere (auto-mersalg ved manglende tjeneste, auto-avhuking ved vunnet mersalg), RLS-policyer og en storage-bucket for kundelogoer.
   - Trygt å kjøre flere ganger.
3. Gå til **Authentication → Users → Add user** og opprett din egen bruker (e-post + passord). Dette er innloggingen din i appen — ingen offentlig registrering.
4. Gå til **Project Settings → API** og noter:
   - `Project URL`
   - `anon public` key (IKKE `service_role` — den skal aldri i frontend-kode)

## 2. Kjør lokalt

```bash
npm install
cp .env.local.example .env.local
# lim inn Project URL og anon key i .env.local
npm run dev
```

Åpne `http://localhost:3000`, logg inn med brukeren du opprettet i steg 1.3.

## 3. Legg til dine faktiske kunder

Appen har ingen forhåndslastede kunder — du legger dem inn selv under **Kunder → Ny kunde** (tar ca. 30 sek per kunde). Ønsker du at jeg forhåndslaster kundene dine i stedet, gi meg en liste (navn, segment, status, ev. retainer-pris og timebudsjett) så skriver jeg et engangs seed-script.

## 4. Legg ut på GitHub

```bash
git init
git add .
git commit -m "Amidays Kunderegister v1"
gh repo create amidays-kunderegister --private --source=. --push
```

(Eller opprett repoet manuelt på github.com og følg `git remote add origin …` / `git push`.)

## 5. Deploy på Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importer GitHub-repoet.
2. Under **Environment Variables**, legg inn:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Vercel bygger automatisk ved hver push til `main`.

## 6. "Installer" som skrivebordsapp

Når appen kjører på Vercel-URLen din:
- **Chrome/Edge (Mac/Windows):** klikk installer-ikonet i adressefeltet, eller meny → "Installer Amidays Kunderegister". Åpner i eget vindu uten nettleserramme, med ikon i dock/oppgavelinje — identisk med en desktop-app.

## Datamodell

Direkte videreført fra `Amidays-Kunderegister.gs`:

| Tabell | Tilsvarer fane i regnearket |
|---|---|
| `customers` | Kunder |
| `retainers` | Retainere |
| `time_entries` | Timelogg |
| `upsell_opportunities` | Mersalg |
| `projects` | Prosjekter |
| `customer_services` | Tjenestematrise |
| `invoices` | Fakturering |

## Automatikk som er bygget inn

- **Manglende tjeneste → automatisk mersalgsforslag.** Nye kunder får alle 12 tjenester satt til "Mangler". Så lenge en tjeneste står som "Mangler", ligger det automatisk et forslag i Mersalg-pipelinen (markert med ✨).
- **Vunnet mersalg → automatisk avhuking.** Flytter du et mersalgskort til "Vunnet" og det er knyttet til en tjeneste, settes tjenesten automatisk til "Implementert".
- **Ledig kapasitet-varsel** på dashboardet: retainere under 60 % timeforbruk vises som mulig kapasitet for mersalg/prosjekter.
- **Over budsjett-varsel**: retainere over 85 % forbruk flagges på dashboardet.
- **Stille kunder-varsel**: aktive retainere uten timeføring de siste 30 dagene flagges på dashboardet.

## Foreslåtte neste steg (ikke bygget ennå)

- PDF-eksport av kvartalsrapport
- E-postvarsel ved 85 %+ timeforbruk eller stille kunder (Supabase Edge Function + cron)
- Enkel "produktivitet"-graf: timer brukt vs. fakturert over tid
