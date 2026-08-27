"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { kr, timer } from "@/lib/format";

type Periode = "Kvartal" | "Halvår" | "År";

function periodeStart(p: Periode): Date {
  const now = new Date();
  if (p === "Kvartal") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  if (p === "Halvår") return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  return new Date(now.getFullYear(), 0, 1);
}

export default function RapporterPage() {
  const supabase = createClient();
  const [periode, setPeriode] = useState<Periode>("Kvartal");
  const [data, setData] = useState<{
    totalHours: number;
    billableHours: number;
    wonUpsell: number;
    deliveredProjects: number;
    retainerRevenue: number;
    perKunde: { navn: string; timer: number }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const start = periodeStart(periode).toISOString().slice(0, 10);

      const [{ data: entries }, { data: upsell }, { data: projects }, { data: retainers }] = await Promise.all([
        supabase.from("time_entries").select("*, customers(name)").gte("entry_date", start),
        supabase.from("upsell_opportunities").select("*").eq("status", "Vunnet").gte("updated_at", start),
        supabase.from("projects").select("*").eq("status", "Levert"),
        supabase.from("retainers").select("*").eq("status", "Aktiv"),
      ]);

      const totalHours = (entries ?? []).reduce((s, e) => s + Number(e.hours), 0);
      const billableHours = (entries ?? []).filter((e) => e.billable).reduce((s, e) => s + Number(e.hours), 0);
      const wonUpsell = (upsell ?? []).reduce((s, u) => s + Number(u.value), 0);
      const deliveredProjects = (projects ?? []).reduce((s, p) => s + Number(p.budget), 0);

      const monthsInPeriod = periode === "Kvartal" ? 3 : periode === "Halvår" ? 6 : new Date().getMonth() + 1;
      const retainerRevenue = (retainers ?? []).reduce((s, r) => s + Number(r.monthly_price), 0) * monthsInPeriod;

      const perKundeMap = new Map<string, number>();
      (entries ?? []).forEach((e: any) => {
        const navn = e.customers?.name ?? "Ukjent";
        perKundeMap.set(navn, (perKundeMap.get(navn) ?? 0) + Number(e.hours));
      });

      setData({
        totalHours,
        billableHours,
        wonUpsell,
        deliveredProjects,
        retainerRevenue,
        perKunde: [...perKundeMap.entries()].sort((a, b) => b[1] - a[1]).map(([navn, t]) => ({ navn, timer: t })),
      });
    })();
  }, [periode]);

  const totalTjent = data ? data.retainerRevenue + data.wonUpsell + data.deliveredProjects : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Rapporter</div>
          <div className="text-[12px] text-charcoal mt-1">Oppsummering til ledelsen — timer og inntjening</div>
        </div>
        <div className="flex gap-2">
          {(["Kvartal", "Halvår", "År"] as Periode[]).map((p) => (
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
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kort label="Totalt timer ført" verdi={`${timer(data.totalHours)} t`} />
            <Kort label="Fakturerbare timer" verdi={`${timer(data.billableHours)} t`} />
            <Kort label="Estimert retainer-inntekt" verdi={kr(data.retainerRevenue)} />
            <Kort label="Vunnet mersalg" verdi={kr(data.wonUpsell)} />
            <Kort label="Leverte prosjekter" verdi={kr(data.deliveredProjects)} />
            <Kort label="Totalt tjent i perioden" verdi={kr(totalTjent)} fremhevet />
          </div>

          <div className="bg-cream rounded-sm shadow-sm p-5">
            <div className="font-display text-[12px] tracking-[0.05em] uppercase text-charcoal mb-4">
              Timer per kunde
            </div>
            <div className="flex flex-col gap-2">
              {data.perKunde.map((k) => (
                <div key={k.navn} className="flex items-center gap-3">
                  <span className="text-[12px] text-dark w-[160px] shrink-0 truncate">{k.navn}</span>
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sage h-full"
                      style={{ width: `${Math.min(100, (k.timer / (data.perKunde[0]?.timer || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-display text-charcoal w-[50px] text-right shrink-0">
                    {timer(k.timer)} t
                  </span>
                </div>
              ))}
              {data.perKunde.length === 0 && (
                <div className="text-[12px] text-charcoal italic">Ingen timer ført i perioden.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kort({ label, verdi, fremhevet }: { label: string; verdi: string; fremhevet?: boolean }) {
  return (
    <div className={`rounded-sm p-4 shadow-sm border-l-[3px] ${fremhevet ? "bg-dark border-l-brown" : "bg-cream border-l-sage"}`}>
      <div className={`text-[10px] font-display tracking-[0.08em] uppercase mb-1.5 ${fremhevet ? "text-lightsage" : "text-charcoal"}`}>
        {label}
      </div>
      <div className={`text-[20px] font-display leading-none ${fremhevet ? "text-white" : "text-dark"}`}>{verdi}</div>
    </div>
  );
}
