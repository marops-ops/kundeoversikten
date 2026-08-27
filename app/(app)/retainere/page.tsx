"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Pill from "@/components/Pill";
import { kr, timer, pct, dato, monthRange } from "@/lib/format";

export default function RetainerePage() {
  const supabase = createClient();
  const [rader, setRader] = useState<any[]>([]);
  const [lastet, setLastet] = useState(false);

  useEffect(() => {
    (async () => {
      const { start, end } = monthRange(0);
      const [{ data: retainers }, { data: entries }] = await Promise.all([
        supabase.from("retainers").select("*, customers(name, logo_url, brand_color)").order("created_at"),
        supabase.from("time_entries").select("customer_id, hours, type").gte("entry_date", start).lte("entry_date", end).eq("type", "Retainer"),
      ]);

      const brukt = new Map<string, number>();
      (entries ?? []).forEach((e) => {
        if (!e.customer_id) return;
        brukt.set(e.customer_id, (brukt.get(e.customer_id) ?? 0) + Number(e.hours));
      });

      const beriket = (retainers ?? []).map((r) => {
        const used = brukt.get(r.customer_id) ?? 0;
        const forbruk = r.hour_budget > 0 ? used / r.hour_budget : 0;
        const effektivPris = used > 0 ? r.monthly_price / used : null;
        return { ...r, used, forbruk, effektivPris };
      });

      setRader(beriket);
      setLastet(true);
    })();
  }, []);

  const totalMrr = rader.filter((r) => r.status === "Aktiv").reduce((s, r) => s + Number(r.monthly_price), 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="font-display text-[22px] text-dark">Retainere</div>
        <div className="text-[12px] text-charcoal mt-1">
          {rader.filter((r) => r.status === "Aktiv").length} aktive · {kr(totalMrr)} MRR
        </div>
      </div>

      <div className="bg-cream rounded-sm shadow-sm overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[10.5px] font-display tracking-[0.05em] uppercase text-charcoal border-b border-[#E2DDD2]">
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Månedspris</th>
              <th className="px-4 py-3">Timebudsjett</th>
              <th className="px-4 py-3">Brukt (mnd)</th>
              <th className="px-4 py-3">Forbruk</th>
              <th className="px-4 py-3">Eff. timepris</th>
              <th className="px-4 py-3">Fornyelse</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((r) => (
              <tr key={r.id} className="border-b border-[#E2DDD2] last:border-0 hover:bg-white/60">
                <td className="px-4 py-2.5">
                  <Link href={`/kunder/${r.customer_id}`} className="text-dark hover:underline">
                    {r.customers?.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-charcoal">{kr(r.monthly_price)}</td>
                <td className="px-4 py-2.5 text-charcoal">{timer(r.hour_budget)} t</td>
                <td className="px-4 py-2.5 text-charcoal">{timer(r.used)} t</td>
                <td className={`px-4 py-2.5 font-display ${r.forbruk > 1 ? "text-rose" : r.forbruk > 0.85 ? "text-brown" : "text-sage"}`}>
                  {pct(r.forbruk)}
                </td>
                <td className="px-4 py-2.5 text-charcoal">{r.effektivPris ? kr(r.effektivPris) : "—"}</td>
                <td className="px-4 py-2.5 text-charcoal">{dato(r.renewal_date)}</td>
                <td className="px-4 py-2.5">
                  <Pill value={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lastet && rader.length === 0 && (
          <div className="p-6 text-center text-[12px] text-charcoal italic">
            Ingen retainere ennå — legg til fra kundeprofilen.
          </div>
        )}
      </div>
    </div>
  );
}
