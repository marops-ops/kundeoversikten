"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer, UpsellOpportunity, MERSALG_KOLONNER, Mersalgsstatus, ALLE_TJENESTER } from "@/lib/types";
import Modal from "@/components/Modal";
import { inputCls, labelCls, btnPrimary } from "@/lib/ui";
import { kr, pct, dato } from "@/lib/format";
import { Plus, Sparkles } from "lucide-react";

export default function MersalgPage() {
  const supabase = createClient();
  const [kunder, setKunder] = useState<Customer[]>([]);
  const [muligheter, setMuligheter] = useState<(UpsellOpportunity & { customers?: { name: string } })[]>([]);
  const [modalApen, setModalApen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  async function hent() {
    const [{ data: k }, { data: m }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("upsell_opportunities").select("*, customers(name)").order("created_at", { ascending: false }),
    ]);
    setKunder(k ?? []);
    setMuligheter((m as any) ?? []);
  }

  useEffect(() => {
    hent();
  }, []);

  async function flytt(id: string, status: Mersalgsstatus) {
    setMuligheter((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    await supabase.from("upsell_opportunities").update({ status }).eq("id", id);
    hent();
  }

  const totalVektet = muligheter
    .filter((m) => m.status !== "Vunnet" && m.status !== "Tapt")
    .reduce((s, m) => s + Number(m.value) * Number(m.probability), 0);

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Mersalg-pipeline</div>
          <div className="text-[12px] text-charcoal mt-1">Vektet åpen pipeline: {kr(totalVektet)}</div>
        </div>
        <button onClick={() => setModalApen(true)} className={`${btnPrimary} flex items-center gap-2`}>
          <Plus size={14} /> Nytt forslag
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {MERSALG_KOLONNER.map((kol) => {
          const kort = muligheter.filter((m) => m.status === kol);
          const sum = kort.reduce((s, m) => s + Number(m.value), 0);
          return (
            <div
              key={kol}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && flytt(dragId, kol)}
              className="bg-cream rounded-sm shrink-0 w-[260px] flex flex-col shadow-sm"
            >
              <div className="px-3 py-2.5 border-b border-[#E2DDD2]">
                <div className="font-display text-[10.5px] tracking-[0.05em] uppercase text-dark">{kol}</div>
                <div className="text-[10.5px] text-charcoal mt-0.5">
                  {kort.length} · {kr(sum)}
                </div>
              </div>
              <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                {kort.map((m) => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={() => setDragId(m.id)}
                    className="bg-white rounded-sm p-3 shadow-sm cursor-grab active:cursor-grabbing border border-[#E2DDD2]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[12px] text-dark leading-snug">{m.title}</div>
                      {m.auto_generated && <Sparkles size={12} className="text-brown shrink-0 mt-0.5" />}
                    </div>
                    <div className="text-[10.5px] text-charcoal mt-1">{m.customers?.name}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-display text-[12px] text-dark">{kr(Number(m.value))}</span>
                      <span className="text-[10.5px] text-charcoal">{pct(Number(m.probability))}</span>
                    </div>
                    {m.deadline && <div className="text-[10px] text-rose mt-1">Frist {dato(m.deadline)}</div>}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {MERSALG_KOLONNER.filter((s) => s !== m.status).map((s) => (
                        <button
                          key={s}
                          onClick={() => flytt(m.id, s)}
                          className="text-[9.5px] border border-lightsage rounded-full px-1.5 py-0.5 text-charcoal hover:border-dark hover:text-dark"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalApen && (
        <NyttForslagModal
          kunder={kunder}
          onClose={() => setModalApen(false)}
          onSaved={() => {
            setModalApen(false);
            hent();
          }}
        />
      )}
    </div>
  );
}

function NyttForslagModal({
  kunder,
  onClose,
  onSaved,
}: {
  kunder: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [lagrer, setLagrer] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    service: "",
    value: "",
    probability: "0.5",
    deal_type: "Engangs",
    next_step: "",
    deadline: "",
  });

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.title) return;
    setLagrer(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("upsell_opportunities").insert({
      ...form,
      value: Number(form.value) || 0,
      probability: Number(form.probability),
      deadline: form.deadline || null,
      service: form.service || null,
      owner: user.user?.id,
      status: "Idé",
    });
    setLagrer(false);
    onSaved();
  }

  return (
    <Modal title="Nytt mersalgsforslag" onClose={onClose}>
      <form onSubmit={lagre} className="flex flex-col gap-3">
        <div>
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
        <div>
          <label className={labelCls}>Tittel / mulighet</label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Knyttet tjeneste (valgfritt)</label>
            <select
              className={inputCls}
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
            >
              <option value="">Ingen</option>
              {ALLE_TJENESTER.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select
              className={inputCls}
              value={form.deal_type}
              onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
            >
              {["Engangs", "Retainer-økning", "Prosjekt"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Verdi (kr)</label>
            <input
              type="number"
              className={inputCls}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Sannsynlighet</label>
            <select
              className={inputCls}
              value={form.probability}
              onChange={(e) => setForm({ ...form, probability: e.target.value })}
            >
              {[0.1, 0.25, 0.5, 0.75, 0.9, 1].map((p) => (
                <option key={p} value={p}>
                  {Math.round(p * 100)}%
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Neste steg</label>
          <input
            className={inputCls}
            value={form.next_step}
            onChange={(e) => setForm({ ...form, next_step: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Frist</label>
          <input
            type="date"
            className={inputCls}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
        <button type="submit" disabled={lagrer} className={btnPrimary}>
          {lagrer ? "Lagrer…" : "Lagre forslag"}
        </button>
      </form>
    </Modal>
  );
}
