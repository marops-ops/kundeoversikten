"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Customer, Retainer, CustomerService, TimeEntry, ALLE_TJENESTER, Tjenestestatus } from "@/lib/types";
import Pill from "@/components/Pill";
import { inputCls, labelCls, btnPrimary, btnSecondary, btnDanger } from "@/lib/ui";
import { kr, timer, dato, pct } from "@/lib/format";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

const TJENESTESTATUSER: Tjenestestatus[] = ["Implementert", "Pågår", "Blokkert", "Ikke aktuelt", "Mangler"];

export default function KundeDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const router = useRouter();

  const [kunde, setKunde] = useState<Customer | null>(null);
  const [retainer, setRetainer] = useState<Retainer | null>(null);
  const [tjenester, setTjenester] = useState<CustomerService[]>([]);
  const [timer_, setTimerListe] = useState<TimeEntry[]>([]);
  const [lagrer, setLagrer] = useState(false);

  async function hent() {
    const [{ data: k }, { data: r }, { data: tj }, { data: t }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("retainers").select("*").eq("customer_id", id).maybeSingle(),
      supabase.from("customer_services").select("*").eq("customer_id", id).order("service_name"),
      supabase.from("time_entries").select("*").eq("customer_id", id).order("entry_date", { ascending: false }).limit(15),
    ]);
    setKunde(k);
    setRetainer(r);
    setTjenester(tj ?? []);
    setTimerListe(t ?? []);
  }

  useEffect(() => {
    hent();
  }, [id]);

  if (!kunde) return <div className="text-[13px] text-charcoal">Laster…</div>;

  async function oppdaterKunde(felt: Partial<Customer>) {
    setLagrer(true);
    await supabase.from("customers").update(felt).eq("id", id);
    await hent();
    setLagrer(false);
  }

  async function slettKunde() {
    if (!confirm(`Slette ${kunde!.name} permanent? Dette sletter også tilhørende retainer, timer og mersalg.`)) return;
    await supabase.from("customers").delete().eq("id", id);
    router.push("/kunder");
  }

  async function endreTjeneste(navn: string, status: Tjenestestatus) {
    const { data: user } = await supabase.auth.getUser();
    await supabase
      .from("customer_services")
      .upsert(
        { customer_id: id, service_name: navn, status, owner: user.user?.id },
        { onConflict: "customer_id,service_name" }
      );
    hent();
  }

  async function lagreRetainer(felt: Partial<Retainer>) {
    if (retainer) {
      await supabase.from("retainers").update(felt).eq("id", retainer.id);
    } else {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("retainers").insert({
        customer_id: id,
        owner: user.user?.id,
        monthly_price: 0,
        hour_budget: 0,
        status: "Aktiv",
        ...felt,
      });
    }
    hent();
  }

  async function slettRetainer() {
    if (!retainer) return;
    if (!confirm(`Fjerne retaineren for ${kunde?.name}? Dette kan ikke angres.`)) return;
    await supabase.from("retainers").delete().eq("id", retainer.id);
    hent();
  }

  const totalTimer = timer_.reduce((s, t) => s + Number(t.hours), 0);

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <Link href="/kunder" className="flex items-center gap-1.5 text-[12px] text-charcoal hover:text-dark w-fit">
        <ArrowLeft size={14} /> Tilbake til kunder
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-sm flex items-center justify-center text-white font-display text-[16px] overflow-hidden"
            style={{ background: kunde.brand_color ?? "#31353D" }}
          >
            {kunde.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kunde.logo_url} alt={kunde.name} className="w-full h-full object-cover" />
            ) : (
              kunde.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <div className="font-display text-[20px] text-dark">{kunde.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Pill value={kunde.status} />
              <span className="text-[11px] text-charcoal">{kunde.segment}</span>
            </div>
          </div>
        </div>
        <button onClick={slettKunde} className={`${btnDanger} flex items-center gap-1.5`}>
          <Trash2 size={13} /> Slett kunde
        </button>
      </div>

      {/* PROFIL */}
      <Seksjon tittel="Profil">
        <div className="grid grid-cols-2 gap-3">
          <Felt label="Segment">
            <select
              className={inputCls}
              value={kunde.segment}
              onChange={(e) => oppdaterKunde({ segment: e.target.value as any })}
            >
              {["Retainer", "Prosjekt", "Retainer + prosjekt", "Prospect", "Sovende"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Felt>
          <Felt label="Status">
            <select
              className={inputCls}
              value={kunde.status}
              onChange={(e) => oppdaterKunde({ status: e.target.value as any })}
            >
              {["Aktiv", "Pause", "Prospect", "Avsluttet"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Felt>
          <Felt label="Kontaktperson">
            <input
              className={inputCls}
              defaultValue={kunde.contact_name ?? ""}
              onBlur={(e) => oppdaterKunde({ contact_name: e.target.value })}
            />
          </Felt>
          <Felt label="E-post">
            <input
              className={inputCls}
              defaultValue={kunde.contact_email ?? ""}
              onBlur={(e) => oppdaterKunde({ contact_email: e.target.value })}
            />
          </Felt>
          <Felt label="Kundehelse">
            <select
              className={inputCls}
              value={kunde.health}
              onChange={(e) => oppdaterKunde({ health: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Felt>
          <Felt label="Kunde siden">
            <input
              type="date"
              className={inputCls}
              defaultValue={kunde.customer_since ?? ""}
              onBlur={(e) => oppdaterKunde({ customer_since: e.target.value || null })}
            />
          </Felt>
        </div>
        <div className="mt-3">
          <Felt label="Notat">
            <textarea
              className={inputCls}
              rows={2}
              defaultValue={kunde.notes ?? ""}
              onBlur={(e) => oppdaterKunde({ notes: e.target.value })}
            />
          </Felt>
        </div>
      </Seksjon>

      {/* RETAINER */}
      <Seksjon tittel="Retainer">
        <div className="grid grid-cols-3 gap-3 items-end">
          <Felt label="Månedspris">
            <input
              type="number"
              className={inputCls}
              defaultValue={retainer?.monthly_price ?? 0}
              onBlur={(e) => lagreRetainer({ monthly_price: Number(e.target.value) })}
            />
          </Felt>
          <Felt label="Timebudsjett/mnd">
            <div className="flex gap-1.5">
              <input
                type="number"
                step="0.5"
                className={inputCls}
                defaultValue={retainer?.hour_budget ?? 0}
                onBlur={(e) => lagreRetainer({ hour_budget: Number(e.target.value) })}
              />
              <button
                type="button"
                title="Foreslå timer ut fra 1650,-/t og gjeldende månedspris"
                onClick={() => {
                  const foreslatt = Math.round(((retainer?.monthly_price ?? 0) / 1650) * 10) / 10;
                  lagreRetainer({ hour_budget: foreslatt });
                }}
                className="shrink-0 px-2 text-[10.5px] border border-lightsage rounded-sm text-charcoal hover:border-dark hover:text-dark whitespace-nowrap"
              >
                Foreslå
              </button>
            </div>
          </Felt>
          <Felt label="Status">
            <select
              className={inputCls}
              value={retainer?.status === "Aktiv" ? "Aktiv" : "Ikke aktiv"}
              onChange={(e) => lagreRetainer({ status: e.target.value === "Aktiv" ? "Aktiv" : "Pause" })}
            >
              <option value="Aktiv">Aktiv</option>
              <option value="Ikke aktiv">Ikke aktiv</option>
            </select>
          </Felt>
          <Felt label="Startdato">
            <input
              type="date"
              className={inputCls}
              defaultValue={retainer?.start_date ?? ""}
              onBlur={(e) => lagreRetainer({ start_date: e.target.value || null })}
            />
          </Felt>
        </div>
        {!retainer && (
          <div className="text-[11px] text-charcoal mt-2 italic">
            Ingen retainer opprettet ennå — felt lagres når du fyller ut.
          </div>
        )}
        {retainer && (
          <button
            onClick={slettRetainer}
            className={`${btnDanger} flex items-center gap-1.5 mt-3`}
          >
            <Trash2 size={13} /> Fjern retainer helt
          </button>
        )}
      </Seksjon>

      {/* TJENESTER */}
      <Seksjon tittel="Tjenester / tracking-status">
        <div className="text-[11px] text-charcoal mb-3">
          Tjenester satt til «Mangler» dukker automatisk opp som mersalgsforslag i pipelinen.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALLE_TJENESTER.map((navn) => {
            const rad = tjenester.find((t) => t.service_name === navn);
            return (
              <div key={navn} className="flex items-center justify-between gap-2 bg-white rounded-sm px-3 py-2 border border-[#E2DDD2]">
                <span className="text-[12.5px] text-dark">{navn}</span>
                <select
                  className="text-[11px] border border-lightsage rounded-sm px-1.5 py-1 bg-white"
                  value={rad?.status ?? "Mangler"}
                  onChange={(e) => endreTjeneste(navn, e.target.value as Tjenestestatus)}
                >
                  {TJENESTESTATUSER.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Seksjon>

      {/* TIMEHISTORIKK */}
      <Seksjon tittel={`Siste timeføringer (${timer(totalTimer)} t totalt i listen)`}>
        {timer_.length === 0 ? (
          <div className="text-[12px] text-charcoal italic">Ingen timer ført på denne kunden ennå.</div>
        ) : (
          <div className="flex flex-col divide-y divide-[#E2DDD2]">
            {timer_.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-[12.5px]">
                <div className="flex items-center gap-3">
                  <span className="text-charcoal w-[80px] shrink-0">{dato(t.entry_date)}</span>
                  <Pill value={t.type} />
                  <span className="text-dark">{t.task ?? "—"}</span>
                </div>
                <span className="font-display text-dark">{timer(t.hours)} t</span>
              </div>
            ))}
          </div>
        )}
      </Seksjon>
    </div>
  );
}

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div className="bg-cream rounded-sm p-5 shadow-sm">
      <div className="font-display text-[12px] tracking-[0.05em] uppercase text-charcoal mb-4">{tittel}</div>
      {children}
    </div>
  );
}

function Felt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
