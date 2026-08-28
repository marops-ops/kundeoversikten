"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer, TimeEntry, Timetype } from "@/lib/types";
import Pill from "@/components/Pill";
import { inputCls, labelCls, btnPrimary } from "@/lib/ui";
import { timer, dato } from "@/lib/format";
import { Trash2 } from "lucide-react";

const TYPER: Timetype[] = ["Mersalg", "Prosjekt", "Internt", "Ikke fakturerbart"];

type Periode = "Denne mnd" | "Kvartal" | "Halvår" | "År" | "Alt";

function periodeStart(p: Periode): string | null {
  const now = new Date();
  if (p === "Denne mnd") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (p === "Kvartal") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
  if (p === "Halvår") return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10);
  if (p === "År") return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  return null;
}

export default function TimeloggPage() {
  const supabase = createClient();
  const [kunder, setKunder] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [periode, setPeriode] = useState<Periode>("Denne mnd");
  const [kundeFilter, setKundeFilter] = useState<string>("Alle");
  const [lagrer, setLagrer] = useState(false);

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    customer_id: "",
    type: "Prosjekt" as Timetype,
    task: "",
    hours: "",
    billable: true,
    comment: "",
  });

  async function hentKunder() {
    const { data } = await supabase.from("customers").select("*").order("name");
    setKunder(data ?? []);
  }

  async function hentEntries() {
    let q = supabase.from("time_entries").select("*, customers(name)").order("entry_date", { ascending: false });
    const start = periodeStart(periode);
    if (start) q = q.gte("entry_date", start);
    if (kundeFilter !== "Alle") q = q.eq("customer_id", kundeFilter);
    const { data } = await q.limit(200);
    setEntries((data as any) ?? []);
  }

  useEffect(() => {
    hentKunder();
  }, []);

  useEffect(() => {
    hentEntries();
  }, [periode, kundeFilter]);

  async function loggTid(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.hours) return;
    setLagrer(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("time_entries").insert({
      ...form,
      hours: Number(form.hours),
      owner: user.user?.id,
      customer_id: form.customer_id,
    });
    setForm({ ...form, task: "", hours: "", comment: "" });
    setLagrer(false);
    hentEntries();
  }

  async function slett(id: string) {
    await supabase.from("time_entries").delete().eq("id", id);
    hentEntries();
  }

  const totalPeriode = entries.reduce((s, e) => s + Number(e.hours), 0);
  const perKunde = new Map<string, number>();
  entries.forEach((e) => {
    const navn = (e as any).customers?.name ?? "Ukjent";
    perKunde.set(navn, (perKunde.get(navn) ?? 0) + Number(e.hours));
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-[22px] text-dark">Timelogg</div>
        <div className="text-[12px] text-charcoal mt-1">Registrer og se historikk på brukte timer</div>
      </div>

      {/* HURTIGREGISTRERING */}
      <div className="bg-cream rounded-sm p-5 shadow-sm">
        <div className="font-display text-[12px] tracking-[0.05em] uppercase text-charcoal mb-4">
          Logg timer
        </div>
        <form onSubmit={loggTid} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="col-span-1">
            <label className={labelCls}>Dato</label>
            <input
              type="date"
              className={inputCls}
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className={labelCls}>Kunde</label>
            <select
              className={inputCls}
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              required
            >
              <option value="">Velg kunde…</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <label className={labelCls}>Type</label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Timetype })}
            >
              {TYPER.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <label className={labelCls}>Timer</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className={inputCls}
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              required
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <button type="submit" disabled={lagrer} className={`${btnPrimary} w-full`}>
              {lagrer ? "Logger…" : "Logg"}
            </button>
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls}>Oppgave / prosjekt</label>
            <input
              className={inputCls}
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
              placeholder="F.eks. GA4-oppsett, kampanjeoptimalisering…"
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Kommentar</label>
            <input
              className={inputCls}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
        </form>
      </div>

      {/* FILTER + OPPSUMMERING */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2">
          {(["Denne mnd", "Kvartal", "Halvår", "År", "Alt"] as Periode[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={`px-3 py-1.5 rounded-full text-[11.5px] border transition-colors ${
                periode === p ? "bg-dark text-white border-dark" : "border-lightsage text-charcoal hover:border-dark"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <select
          className="text-[12px] border border-lightsage rounded-sm px-2.5 py-1.5 bg-white"
          value={kundeFilter}
          onChange={(e) => setKundeFilter(e.target.value)}
        >
          <option value="Alle">Alle kunder</option>
          {kunder.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
        {/* LISTE */}
        <div className="bg-cream rounded-sm shadow-sm overflow-hidden">
          <div className="divide-y divide-[#E2DDD2] max-h-[560px] overflow-y-auto">
            {entries.length === 0 && (
              <div className="p-6 text-center text-[12px] text-charcoal italic">Ingen timer i denne perioden.</div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px] group">
                <span className="text-charcoal w-[80px] shrink-0">{dato(e.entry_date)}</span>
                <span className="text-dark w-[140px] shrink-0 truncate">{(e as any).customers?.name ?? "—"}</span>
                <Pill value={e.type} />
                <span className="text-dark flex-1 truncate">{e.task ?? "—"}</span>
                <span className="font-display text-dark shrink-0">{timer(e.hours)} t</span>
                <button
                  onClick={() => slett(e.id)}
                  className="text-charcoal hover:text-rose opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SUM PER KUNDE */}
        <div className="bg-cream rounded-sm shadow-sm p-4 h-fit">
          <div className="font-display text-[11px] tracking-[0.05em] uppercase text-charcoal mb-3">
            Sum i perioden: {timer(totalPeriode)} t
          </div>
          <div className="flex flex-col gap-1.5">
            {[...perKunde.entries()].sort((a, b) => b[1] - a[1]).map(([navn, t]) => (
              <div key={navn} className="flex items-center justify-between text-[12px]">
                <span className="text-dark truncate pr-2">{navn}</span>
                <span className="font-display text-charcoal shrink-0">{timer(t)} t</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
