import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/KpiCard";
import Pill from "@/components/Pill";
import { kr, pct, timer, dato, monthRange } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { start, end } = monthRange(0);

  const [
    { data: customers },
    { data: retainers },
    { data: timeEntriesMonth },
    { data: upsell },
    { data: projects },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("retainers").select("*, customers(name)").eq("status", "Aktiv"),
    supabase.from("time_entries").select("*").gte("entry_date", start).lte("entry_date", end),
    supabase.from("upsell_opportunities").select("*, customers(name)"),
    supabase.from("projects").select("*").eq("status", "Pågår"),
  ]);

  const retainerList = retainers ?? [];
  const entries = timeEntriesMonth ?? [];
  const upsellList = upsell ?? [];

  const mrr = retainerList.reduce((s, r) => s + Number(r.monthly_price ?? 0), 0);
  const hourBudget = retainerList.reduce((s, r) => s + Number(r.hour_budget ?? 0), 0);

  const hoursByCustomer = new Map<string, number>();
  entries.forEach((e) => {
    if (!e.customer_id) return;
    hoursByCustomer.set(e.customer_id, (hoursByCustomer.get(e.customer_id) ?? 0) + Number(e.hours));
  });
  const retainerHoursUsed = entries
    .filter((e) => e.type === "Retainer")
    .reduce((s, e) => s + Number(e.hours), 0);

  const utilization = hourBudget > 0 ? retainerHoursUsed / hourBudget : 0;

  const openUpsell = upsellList.filter((u) => u.status !== "Vunnet" && u.status !== "Tapt");
  const weightedPipeline = openUpsell.reduce(
    (s, u) => s + Number(u.value ?? 0) * Number(u.probability ?? 0),
    0
  );
  const wonUpsell = upsellList
    .filter((u) => u.status === "Vunnet")
    .reduce((s, u) => s + Number(u.value ?? 0), 0);

  const overBudget = retainerList
    .map((r) => {
      const used = entries
        .filter((e) => e.customer_id === r.customer_id && e.type === "Retainer")
        .reduce((s, e) => s + Number(e.hours), 0);
      const forbruk = r.hour_budget > 0 ? used / r.hour_budget : 0;
      return { ...r, used, forbruk };
    })
    .filter((r) => r.forbruk > 0.85)
    .sort((a, b) => b.forbruk - a.forbruk);

  const underUtilized = retainerList
    .map((r) => {
      const used = entries
        .filter((e) => e.customer_id === r.customer_id && e.type === "Retainer")
        .reduce((s, e) => s + Number(e.hours), 0);
      const forbruk = r.hour_budget > 0 ? used / r.hour_budget : 0;
      return { ...r, used, forbruk };
    })
    .filter((r) => r.forbruk < 0.6 && r.hour_budget > 0)
    .sort((a, b) => a.forbruk - b.forbruk);

  const in60Days = new Date();
  in60Days.setDate(in60Days.getDate() + 60);
  const renewals = retainerList
    .filter((r) => r.renewal_date && new Date(r.renewal_date) <= in60Days)
    .sort((a, b) => (a.renewal_date! > b.renewal_date! ? 1 : -1));

  const topOpen = [...openUpsell].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-[22px] text-dark">Kundeoversikt</div>
        <div className="text-[12px] text-charcoal mt-1">
          {new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" })} · Denne
          måneden
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="MRR — aktive retainere" value={kr(mrr)} accent="sage" />
        <KpiCard label="Aktive retainere" value={String(retainerList.length)} accent="dark" />
        <KpiCard label="Timebudsjett denne mnd" value={timer(hourBudget)} accent="dark" />
        <KpiCard label="Timer brukt denne mnd" value={timer(retainerHoursUsed)} accent="brown" />
        <KpiCard label="Utnyttelse" value={pct(utilization)} accent={utilization > 0.9 ? "rose" : "sage"} />
        <KpiCard label="Vektet mersalg-pipeline" value={kr(weightedPipeline)} accent="brown" />
        <KpiCard label="Vunnet mersalg (totalt)" value={kr(wonUpsell)} accent="sage" />
        <KpiCard label="Aktive prosjekter" value={String(projects?.length ?? 0)} accent="dark" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Block tittel="OVER TIMEBUDSJETT" accent="rose">
          {overBudget.length === 0 ? (
            <Tom tekst="Alt innenfor budsjett ✓" />
          ) : (
            overBudget.map((r) => (
              <Rad key={r.id} venstre={(r as any).customers?.name ?? "—"} hoyre={pct(r.forbruk)} fremhevet />
            ))
          )}
        </Block>

        <Block tittel="FORNYELSER NESTE 60 DAGER" accent="brown">
          {renewals.length === 0 ? (
            <Tom tekst="Ingen fornyelser innen 60 dager" />
          ) : (
            renewals.map((r) => (
              <Rad key={r.id} venstre={(r as any).customers?.name ?? "—"} hoyre={dato(r.renewal_date)} />
            ))
          )}
        </Block>

        <Block tittel="STØRSTE ÅPNE MERSALG" accent="sage">
          {topOpen.length === 0 ? (
            <Tom tekst="Ingen åpne muligheter" />
          ) : (
            topOpen.map((u) => (
              <Rad
                key={u.id}
                venstre={`${(u as any).customers?.name ?? "—"} — ${u.title}`}
                hoyre={kr(Number(u.value))}
              />
            ))
          )}
        </Block>

        <Block tittel="LEDIG KAPASITET (< 60% AV BUDSJETT)" accent="sage">
          {underUtilized.length === 0 ? (
            <Tom tekst="Ingen retainere med ledig kapasitet" />
          ) : (
            underUtilized.map((r) => (
              <Rad
                key={r.id}
                venstre={(r as any).customers?.name ?? "—"}
                hoyre={pct(r.forbruk)}
              />
            ))
          )}
        </Block>
      </div>

      <div className="text-[11px] text-charcoal">
        Ingen kunder ennå?{" "}
        <Link href="/kunder" className="underline">
          Legg til din første kunde →
        </Link>
      </div>
    </div>
  );
}

function Block({
  tittel,
  accent,
  children,
}: {
  tittel: string;
  accent: "sage" | "brown" | "rose";
  children: React.ReactNode;
}) {
  const bg = { sage: "bg-sage", brown: "bg-brown", rose: "bg-rose" }[accent];
  return (
    <div className="bg-cream rounded-sm overflow-hidden shadow-sm">
      <div className={`${bg} text-white font-display text-[10.5px] tracking-[0.1em] px-4 py-2.5`}>
        {tittel}
      </div>
      <div className="divide-y divide-[#E2DDD2]">{children}</div>
    </div>
  );
}

function Rad({ venstre, hoyre, fremhevet }: { venstre: string; hoyre: string; fremhevet?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[12.5px]">
      <span className="text-dark truncate pr-3">{venstre}</span>
      <span className={`font-display text-[12px] shrink-0 ${fremhevet ? "text-rose" : "text-charcoal"}`}>
        {hoyre}
      </span>
    </div>
  );
}

function Tom({ tekst }: { tekst: string }) {
  return <div className="px-4 py-3 text-[12px] text-charcoal italic">{tekst}</div>;
}
