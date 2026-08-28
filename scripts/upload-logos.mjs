// Engangsverktøy: last opp alle logofiler i en mappe og koble dem til
// riktig kunde basert på filnavn.
//
// BRUK:
//   1. Legg logofiler i en mappe, f.eks. ./logo-upload
//      Filnavnet MÅ matche kundenavnet i appen (uten filending), f.eks.:
//        Com4.png, NTG.jpg, Cappelen Damm.png, Up Norway.png
//      Store/små bokstaver spiller ingen rolle.
//   2. Sørg for at .env.local har SUPABASE_SECRET_KEY (se instruks i chat).
//   3. Kjør: node scripts/upload-logos.mjs
//   4. Legg til flere filer senere og kjør scriptet på nytt når som helst —
//      det oppdaterer bare de kundene som mangler logo eller har fått ny fil.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_DIR = path.join(__dirname, "..", "logo-upload");

// Les .env.local manuelt (enkelt, uten ekstra avhengighet)
function lastEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const innhold = fs.readFileSync(envPath, "utf-8");
  innhold.split("\n").forEach((linje) => {
    const match = linje.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  });
}
lastEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SECRET_KEY i .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY);

function normaliser(s) {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]/g, "") // fjerner mellomrom, understrek, bindestrek osv.
    .replace(/logo$/, ""); // fjerner "logo" på slutten av filnavnet, hvis der
}

function mimeType(filnavn) {
  const ext = path.extname(filnavn).toLowerCase();
  return { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" }[ext] ?? "application/octet-stream";
}

async function main() {
  if (!fs.existsSync(LOGO_DIR)) {
    console.error(`Fant ikke mappen ${LOGO_DIR}. Opprett den og legg logofiler der.`);
    process.exit(1);
  }

  const filer = fs.readdirSync(LOGO_DIR).filter((f) => !f.startsWith("."));
  if (filer.length === 0) {
    console.log("Ingen filer funnet i logo-upload/.");
    return;
  }

  const { data: kunder, error } = await supabase.from("customers").select("id, name, logo_url");
  if (error) {
    console.error("Klarte ikke hente kunder:", error.message);
    process.exit(1);
  }

  let lastetOpp = 0;
  let hoppetOver = 0;
  const ukjente = [];

  for (const fil of filer) {
    const navnUtenEndelse = path.basename(fil, path.extname(fil)).trim();
    const kunde = kunder.find((k) => normaliser(k.name) === normaliser(navnUtenEndelse));

    if (!kunde) {
      ukjente.push(fil);
      continue;
    }

    const filsti = path.join(LOGO_DIR, fil);
    const buffer = fs.readFileSync(filsti);
    const storagePath = `${kunde.id}/${fil}`;

    const { error: uploadErr } = await supabase.storage
      .from("logos")
      .upload(storagePath, buffer, { upsert: true, contentType: mimeType(fil) });

    if (uploadErr) {
      console.error(`✗ ${fil} → opplasting feilet: ${uploadErr.message}`);
      hoppetOver++;
      continue;
    }

    const { data: pub } = supabase.storage.from("logos").getPublicUrl(storagePath);
    const { error: updateErr } = await supabase
      .from("customers")
      .update({ logo_url: pub.publicUrl })
      .eq("id", kunde.id);

    if (updateErr) {
      console.error(`✗ ${fil} → kunne ikke oppdatere kunde: ${updateErr.message}`);
      hoppetOver++;
      continue;
    }

    console.log(`✓ ${fil} → ${kunde.name}`);
    lastetOpp++;
  }

  console.log(`\nFerdig: ${lastetOpp} logoer lastet opp, ${hoppetOver} feilet.`);
  if (ukjente.length > 0) {
    console.log(`\nFant ingen kunde som matcher disse filnavnene (sjekk stavemåte):`);
    ukjente.forEach((f) => console.log(`  - ${f}`));
  }
}

main();
