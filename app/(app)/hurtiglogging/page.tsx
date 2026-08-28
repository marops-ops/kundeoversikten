"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timer } from "@/lib/format";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

interface Rad {
  customerId: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  hourBudget: number;
  hours: string;
  lagret: boolean;
}

function inneverendeManed() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function manedLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}

function flyttManed(m: string, delta: number) {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function HurtigloggingPage() {
  const supabase = createClient();
  const [maned, setManed] = useState(inneverendeManed());
  const [rader, setRader] = useState<Rad[]>([]);
  const [lastet, setLastet] = useState(false);

  async function hent() {
    setLastet(false);
    const [{ data: retainers }, { data: loggedHours }] = await Promise.all([
      supabase
        .from("retainers")
        .select("customer_id, hour_budget, customers(name, logo_url, brand_color)")
        .eq("status", "Aktiv"),
      supabase.from("retainer_month_hours").select("*").eq("year_month", maned),
    ]);

    const hoursMap = new Map<string, number>();
    (loggedHours ?? []).forEach((h) => hoursMap.set(h.customer_id, Number(h.hours)));

    const nyeRader: Rad[] = (retainers ?? [])
      .map((r: any) => ({
        customerId: r.customer_id,
        name: r.customers?.name ?? "—",
        logo_url: r.customers?.logo_url ?? null,
        brand_color: r.customers?.brand_color ?? "#31353D",
        hourBudget: Number(r.hour_budget ?? 0),
        hours: String(hoursMap.get(r.customer_id) ?? ""),
        lagret: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));

    setRader(nyeRader);
    setLastet(true);
  }

  useEffect(() => {
    hent();
  }, [maned]);

  function oppdaterLokalt(customerId: string, verdi: string) {
    setRader((prev) =>
      prev.map((r) => (r.customerId === customerId ? { ...r, hours: verdi, lagret: false } : r))
    );
  }

  async function lagre(customerId: string, verdi: string) {
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("retainer_month_hours").upsert(
      {
        customer_id: customerId,
        year_month: maned,
        hours: Number(verdi) || 0,
        owner: user.user?.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id,year_month" }
    );
    setRader((prev) => prev.map((r) => (r.customerId === customerId ? { ...r, lagret: true } : r)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Hurtiglogging</div>
          <div className="text-[12px] text-charcoal mt-1">
            Sett totalt antall retainer-timer brukt denne måneden per kunde — overstyrer, legger ikke til.
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setManed((m) => flyttManed(m, -1))}
            className="p-1.5 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[12px] text-dark capitalize w-[130px] text-center">{manedLabel(maned)}</span>
          <button
            onClick={() => setManed((m) => flyttManed(m, 1))}
            className="p-1.5 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="bg-cream rounded-sm shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {rader.map((r, idx) => (
            <div
              key={r.customerId}
              className={`flex items-center gap-3 py-2 ${
                idx % 2 === 0 ? "sm:border-r sm:border-[#E2DDD2] sm:pr-6" : "sm:pl-2"
              }`}
            >
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 overflow-hidden text-white font-display text-[11px]"
                style={{ background: r.brand_color ?? "#31353D" }}
              >
                {r.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  r.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="text-[12.5px] text-dark flex-1 truncate">{r.name}</span>
              <span className="text-[10.5px] text-charcoal shrink-0">/ {timer(r.hourBudget)} t</span>
              <input
                type="number"
                step="0.25"
                min="0"
                value={r.hours}
                onChange={(e) => oppdaterLokalt(r.customerId, e.target.value)}
                onBlur={(e) => lagre(r.customerId, e.target.value)}
                className="w-[56px] border border-lightsage rounded-sm px-1.5 py-1 text-[12px] bg-white text-right"
                placeholder="0"
              />
              {r.lagret ? (
                <Check size={14} className="text-sage shrink-0" />
              ) : (
                <span className="w-[14px] shrink-0" />
              )}
            </div>
          ))}
          {lastet && rader.length === 0 && (
            <div className="text-[12px] text-charcoal italic py-4">Ingen aktive retainere ennå.</div>
          )}
        </div>
      </div>
    </div>
  );
}
