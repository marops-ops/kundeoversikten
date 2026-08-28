import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/KpiCard";
import Pill from "@/components/Pill";
import { kr, pct, timer, dato, monthFromParam } from "@/lib/format";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const supabase = await createClient();
  const { start, end, label, monthParam, prevParam, nextParam, isCurrentMonth } = monthFromParam(month);

  const [
    { data: customers },
    { data: retainers },
    { data: timeEntriesMonth },
    { data: upsell },
    { data: projects },
    { data: lastEntries },
  ] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("retainers").select("*, customers(name)").eq("status", "Aktiv"),
    supabase.from("time_entries").select("*").gte("entry_date", start).lte("entry_date", end),
    supabase.from("upsell_opportunities").select("*, customers(name)"),
    supabase.from("projects").select("*"),
    supabase.from("time_entries").select("customer_id, entry_date").order("entry_date", { ascending: false }),
  ]);

  const customerList = customers ?? [];
  const retainerList = retainers ?? [];
  const entries = timeEntriesMonth ?? [];
  const upsellList = upsell ?? [];
  const projectList = projects ?? [];

  const mrr = retainerList.reduce((s, r) => s + Number(r.monthly_price ?? 0), 0);
  const hourBudget = retainerList.reduce((s, r) => s + Number(r.hour_budget ?? 0), 0);

  const retainerHoursUsed = entries
    .filter((e) => e.type === "Retainer")
    .reduce((s, e) => s + Number(e.hours), 0);

  const utilization = hourBudget > 0 ? retainerHoursUsed / hourBudget : 0;

  const openUpsell = upsellList.filter((u) => u.status !== "Vunnet" && u.status !== "Tapt");
  const weightedPipeline = openUpsell.reduce(
    (s, u) => s + Number(u.value ?? 0) * Number(u.probability ?? 0),
    0
  );

  // "Verdi denne måneden": retainer-inntekt + vunnet mersalg + leverte prosjekter i valgt måned
  const wonUpsellPeriode = upsellList
    .filter((u) => u.status === "Vunnet" && u.updated_at >= start && u.updated_at <= end + "T23:59:59")
    .reduce((s, u) => s + Number(u.value ?? 0), 0);
  const deliveredProjectsPeriode = projectList
    .filter((p) => p.status === "Levert")
    .reduce((s, p) => s + Number(p.budget ?? 0), 0);
  const verdiDenneManeden = mrr + wonUpsellPeriode;

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

  const lastSeen = new Map<string, string>();
  (lastEntries ?? []).forEach((e) => {
    if (e.customer_id && !lastSeen.has(e.customer_id)) lastSeen.set(e.customer_id, e.entry_date);
  });
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() - 30);
  const stilleKunder = retainerList
    .map((r) => {
      const siste = lastSeen.get(r.customer_id);
      return { ...r, siste };
    })
    .filter((r) => !r.siste || new Date(r.siste) < in30Days)
    .sort((a, b) => (a.siste ?? "").localeCompare(b.siste ?? ""));

  // Kundeoversikt-rad: timer logget i perioden + nåværende totalverdi (retainer + prosjekter)
  const kundeOversikt = customerList.map((k) => {
    const retainer = retainerList.find((r) => r.customer_id === k.id);
    const hoursLogged = entries
      .filter((e) => e.customer_id === k.id)
      .reduce((s, e) => s + Number(e.hours), 0);
    const budget = retainer?.hour_budget ?? 0;
    const forbruk = budget > 0 ? hoursLogged / budget : 0;
    const prosjektverdi = projectList
      .filter((p) => p.customer_id === k.id && p.status !== "Stoppet")
      .reduce((s, p) => s + Number(p.budget ?? 0), 0);
    const totalverdi = (retainer?.monthly_price ?? 0) + prosjektverdi;
    return { ...k, hoursLogged, budget, forbruk, totalverdi };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Kundeoversikt</div>
          <div className="text-[12px] text-charcoal mt-1 capitalize">{label}</div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/?month=${prevParam}`}
            className="p-1.5 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
          >
            <ChevronLeft size={15} />
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/"
              className="text-[11px] text-charcoal underline px-1.5"
            >
              I dag
            </Link>
          )}
          <Link
            href={`/?month=${nextParam}`}
            className="p-1.5 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Verdi denne måneden" value={kr(verdiDenneManeden)} accent="sage" />
        <KpiCard label="MRR — aktive retainere" value={kr(mrr)} accent="dark" />
        <KpiCard label="Timebudsjett i perioden" value={timer(hourBudget)} accent="dark" />
        <KpiCard label="Timer brukt i perioden" value={timer(retainerHoursUsed)} accent="brown" />
        <KpiCard label="Utnyttelse" value={pct(utilization)} accent={utilization > 0.9 ? "rose" : "sage"} />
        <KpiCard label="Vektet mersalg-pipeline" value={kr(weightedPipeline)} accent="brown" />
        <KpiCard label="Vunnet mersalg i perioden" value={kr(wonUpsellPeriode)} accent="sage" />
        <KpiCard label="Leverte prosjekter (totalt)" value={kr(deliveredProjectsPeriode)} accent="dark" />
      </div>

      {/* KUNDEOVERSIKT-RAD */}
      <div className="bg-cream rounded-sm shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#E2DDD2] font-display text-[10.5px] tracking-[0.1em] uppercase text-charcoal">
          Alle kunder — timer i perioden og verdi akkurat nå
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {kundeOversikt.map((k) => (
              <Link
                key={k.id}
                href={`/kunder/${k.id}`}
                className="flex items-center gap-4 px-4 py-2 border-b border-[#E2DDD2] last:border-0 hover:bg-white/60 text-[12.5px]"
              >
                <span className="w-[160px] shrink-0 truncate text-dark">{k.name}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${k.forbruk > 1 ? "bg-rose" : k.forbruk > 0.85 ? "bg-brown" : "bg-sage"}`}
                      style={{ width: `${Math.min(100, k.forbruk * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-charcoal w-[90px] shrink-0 text-right">
                    {timer(k.hoursLogged)} / {timer(k.budget)} t
                  </span>
                </div>
                <span className="font-display text-dark w-[110px] shrink-0 text-right">{kr(k.totalverdi)}</span>
              </Link>
            ))}
            {kundeOversikt.length === 0 && (
              <div className="px-4 py-4 text-[12px] text-charcoal italic">Ingen kunder ennå.</div>
            )}
          </div>
        </div>
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
              <Rad key={r.id} venstre={(r as any).customers?.name ?? "—"} hoyre={pct(r.forbruk)} />
            ))
          )}
        </Block>

        <Block tittel="STILLE KUNDER (INGEN TIMER PÅ 30+ DAGER)" accent="rose">
          {stilleKunder.length === 0 ? (
            <Tom tekst="Alle aktive retainere har fersk timeføring ✓" />
          ) : (
            stilleKunder.map((r) => (
              <Rad
                key={r.id}
                venstre={(r as any).customers?.name ?? "—"}
                hoyre={r.siste ? dato(r.siste) : "Aldri ført"}
                fremhevet
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
