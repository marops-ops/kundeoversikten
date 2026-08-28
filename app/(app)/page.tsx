import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/KpiCard";
import { kr, pct, timer, monthFromParam } from "@/lib/format";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const PROSJEKT_TIMEPRIS = 1650;

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
    { data: retainerHours },
    { data: timeEntriesMonth },
    { data: upsell },
    { data: projects },
  ] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("retainers").select("*, customers(name)").eq("status", "Aktiv"),
    supabase.from("retainer_month_hours").select("*").eq("year_month", monthParam),
    supabase.from("time_entries").select("*").gte("entry_date", start).lte("entry_date", end),
    supabase.from("upsell_opportunities").select("*, customers(name)"),
    supabase.from("projects").select("*"),
  ]);

  const customerList = customers ?? [];
  const retainerList = retainers ?? [];
  const entries = timeEntriesMonth ?? [];
  const upsellList = upsell ?? [];
  const projectList = projects ?? [];

  // Hurtiglogging (retainer_month_hours) er autoritativ kilde for retainer-timer.
  const hurtigTimer = new Map<string, number>();
  (retainerHours ?? []).forEach((h) => hurtigTimer.set(h.customer_id, Number(h.hours)));

  // Prosjekttimer denne perioden, per kunde — verdsettes til 1650,-/t
  const prosjektTimerPerKunde = new Map<string, number>();
  entries
    .filter((e) => e.type === "Prosjekt" && e.customer_id)
    .forEach((e) => {
      prosjektTimerPerKunde.set(
        e.customer_id!,
        (prosjektTimerPerKunde.get(e.customer_id!) ?? 0) + Number(e.hours)
      );
    });
  const prosjektTimerTotalt = [...prosjektTimerPerKunde.values()].reduce((s, t) => s + t, 0);
  const prosjektTimeverdi = prosjektTimerTotalt * PROSJEKT_TIMEPRIS;

  const mrr = retainerList.reduce((s, r) => s + Number(r.monthly_price ?? 0), 0);
  const hourBudget = retainerList.reduce((s, r) => s + Number(r.hour_budget ?? 0), 0);
  const retainerHoursUsed = retainerList.reduce((s, r) => s + (hurtigTimer.get(r.customer_id) ?? 0), 0);
  const utilization = hourBudget > 0 ? retainerHoursUsed / hourBudget : 0;

  const openUpsell = upsellList.filter((u) => u.status !== "Vunnet" && u.status !== "Tapt");
  const weightedPipeline = openUpsell.reduce(
    (s, u) => s + Number(u.value ?? 0) * Number(u.probability ?? 0),
    0
  );

  // "Verdi denne måneden": retainer-MRR + vunnet mersalg + manuelle prosjekter
  // + verdi av loggede prosjekttimer. Prosjektverdi telles i måneden prosjektet
  // faktisk ble FULLFØRT (completed_date), ikke måneden du registrerte det —
  // slik at et prosjekt du legger inn i august, men som var ferdig i juni,
  // korrekt havner i juni-tallene og ikke dukker opp i august.
  // Prosjekter som kom AUTOMATISK fra et vunnet mersalg telles ikke separat her
  // (verdien ligger allerede i "vunnet mersalg", unngår dobbelttelling).
  const wonUpsellPeriode = upsellList
    .filter((u) => u.status === "Vunnet" && u.updated_at >= start && u.updated_at <= end + "T23:59:59")
    .reduce((s, u) => s + Number(u.value ?? 0), 0);
  const manueltProsjektsalgPeriode = projectList
    .filter(
      (p) =>
        !p.from_upsell &&
        p.status === "Levert" &&
        p.completed_date &&
        p.completed_date >= start &&
        p.completed_date <= end
    )
    .reduce((s, p) => s + Number(p.budget ?? 0), 0);
  const verdiDenneManeden = mrr + wonUpsellPeriode + manueltProsjektsalgPeriode + prosjektTimeverdi;

  const overBudget = retainerList
    .map((r) => {
      const used = hurtigTimer.get(r.customer_id) ?? 0;
      const forbruk = r.hour_budget > 0 ? used / r.hour_budget : 0;
      return { ...r, used, forbruk };
    })
    .filter((r) => r.forbruk > 0.85)
    .sort((a, b) => b.forbruk - a.forbruk);

  const underUtilized = retainerList
    .map((r) => {
      const used = hurtigTimer.get(r.customer_id) ?? 0;
      const forbruk = r.hour_budget > 0 ? used / r.hour_budget : 0;
      return { ...r, used, forbruk };
    })
    .filter((r) => r.forbruk < 0.6 && r.hour_budget > 0)
    .sort((a, b) => a.forbruk - b.forbruk);

  const topOpen = [...openUpsell].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 6);

  const ikkeLoggetDenneManeden = retainerList
    .filter((r) => !hurtigTimer.has(r.customer_id) || hurtigTimer.get(r.customer_id) === 0)
    .sort((a, b) => ((a as any).customers?.name ?? "").localeCompare((b as any).customers?.name ?? ""));

  // Kundeoversikt-rad: retainer-timer (Hurtiglogging) + prosjekttimer denne perioden,
  // og nåværende totalverdi (retainer + løpende prosjekter)
  const kundeOversikt = customerList.map((k) => {
    const retainer = retainerList.find((r) => r.customer_id === k.id);
    const retainerTimerBrukt = hurtigTimer.get(k.id) ?? 0;
    const prosjektTimerBrukt = prosjektTimerPerKunde.get(k.id) ?? 0;
    const hoursLogged = retainerTimerBrukt + prosjektTimerBrukt;
    const budget = retainer?.hour_budget ?? 0;
    const forbruk = budget > 0 ? retainerTimerBrukt / budget : 0;
    const prosjektverdi = projectList
      .filter((p) => p.customer_id === k.id && p.status !== "Stoppet")
      .reduce((s, p) => s + Number(p.budget ?? 0), 0);
    const totalverdi = (retainer?.monthly_price ?? 0) + prosjektverdi;
    return { ...k, hoursLogged, budget, forbruk, totalverdi, harRetainer: !!retainer };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Kundeoversikt</div>
          <div className="text-[12px] text-charcoal mt-1 capitalize">{label}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/hurtiglogging"
            className="flex items-center gap-1.5 text-[11.5px] bg-dark text-white px-3 py-1.5 rounded-sm hover:bg-[#232630]"
          >
            <Zap size={13} /> Hurtiglogging
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={`/?month=${prevParam}`}
              className="p-1.5 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
            >
              <ChevronLeft size={15} />
            </Link>
            {!isCurrentMonth && (
              <Link href="/" className="text-[11px] text-charcoal underline px-1.5">
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Verdi denne måneden" value={kr(verdiDenneManeden)} accent="sage" />
        <KpiCard label="MRR — aktive retainere" value={kr(mrr)} accent="dark" />
        <KpiCard label="Timebudsjett i perioden" value={timer(hourBudget)} accent="dark" />
        <KpiCard label="Retainer-timer brukt" value={timer(retainerHoursUsed)} accent="brown" />
        <KpiCard label="Utnyttelse" value={pct(utilization)} accent={utilization > 0.9 ? "rose" : "sage"} />
        <KpiCard label="Vektet mersalg-pipeline" value={kr(weightedPipeline)} accent="brown" />
        <KpiCard label="Vunnet mersalg i perioden" value={kr(wonUpsellPeriode)} accent="sage" />
        <KpiCard label="Leverte prosjekter i perioden" value={kr(manueltProsjektsalgPeriode)} accent="sage" />
        <KpiCard
          label={`Prosjekttimer (${timer(prosjektTimerTotalt)} t × 1650,-)`}
          value={kr(prosjektTimeverdi)}
          accent="sage"
        />
      </div>

      {/* KUNDEOVERSIKT-RAD */}
      <div className="bg-cream rounded-sm shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#E2DDD2] font-display text-[10.5px] tracking-[0.1em] uppercase text-charcoal">
          Alle kunder — timer i perioden (retainer + prosjekt) og verdi akkurat nå
        </div>
        <div className="p-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
            {kundeOversikt.map((k, idx) => (
              <Link
                key={k.id}
                href={`/kunder/${k.id}`}
                className={`flex items-center gap-3 py-2 text-[12.5px] hover:bg-white/60 ${
                  idx % 2 === 0 ? "lg:border-r lg:border-[#E2DDD2] lg:pr-6" : "lg:pl-2"
                }`}
              >
                <span className="w-[110px] shrink-0 truncate text-dark">{k.name}</span>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden min-w-[40px]">
                    <div
                      className={`h-full ${
                        k.forbruk > 1 ? "bg-rose" : k.forbruk > 0.85 ? "bg-brown" : "bg-sage"
                      }`}
                      style={{ width: `${Math.min(100, k.forbruk * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] text-charcoal w-[80px] shrink-0 text-right">
                    {k.harRetainer ? `${timer(k.hoursLogged)}/${timer(k.budget)} t` : `${timer(k.hoursLogged)} t`}
                  </span>
                </div>
                <span className="font-display text-dark w-[85px] shrink-0 text-right text-[11.5px]">
                  {kr(k.totalverdi)}
                </span>
              </Link>
            ))}
            {kundeOversikt.length === 0 && (
              <div className="px-4 py-4 text-[12px] text-charcoal italic">Ingen kunder ennå.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Block tittel="OVER TIMEBUDSJETT (RETAINER)" accent="rose">
          {overBudget.length === 0 ? (
            <Tom tekst="Alt innenfor budsjett ✓" />
          ) : (
            overBudget.map((r) => (
              <Rad key={r.id} venstre={(r as any).customers?.name ?? "—"} hoyre={pct(r.forbruk)} fremhevet />
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

        <Block tittel="IKKE HURTIGLOGGET DENNE MÅNEDEN" accent="rose">
          {ikkeLoggetDenneManeden.length === 0 ? (
            <Tom tekst="Alle aktive retainere har timer logget ✓" />
          ) : (
            ikkeLoggetDenneManeden.map((r) => (
              <Rad key={r.id} venstre={(r as any).customers?.name ?? "—"} hoyre="0 t" fremhevet />
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
