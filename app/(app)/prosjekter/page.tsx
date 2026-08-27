"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer, Project, Prosjektstatus } from "@/lib/types";
import Modal from "@/components/Modal";
import Pill from "@/components/Pill";
import { inputCls, labelCls, btnPrimary } from "@/lib/ui";
import { kr, dato, timer } from "@/lib/format";
import { Plus } from "lucide-react";

const STATUSER: Prosjektstatus[] = ["Planlagt", "Pågår", "Venter på kunde", "Levert", "Stoppet"];

export default function ProsjekterPage() {
  const supabase = createClient();
  const [kunder, setKunder] = useState<Customer[]>([]);
  const [prosjekter, setProsjekter] = useState<(Project & { customers?: { name: string } })[]>([]);
  const [modalApen, setModalApen] = useState(false);

  async function hent() {
    const [{ data: k }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("projects").select("*, customers(name)").order("created_at", { ascending: false }),
    ]);
    setKunder(k ?? []);
    setProsjekter((p as any) ?? []);
  }

  useEffect(() => {
    hent();
  }, []);

  async function endreStatus(id: string, status: Prosjektstatus) {
    await supabase.from("projects").update({ status }).eq("id", id);
    hent();
  }

  const summerte = prosjekter.reduce((s, p) => s + Number(p.budget), 0);
  const levertDenneMnd = prosjekter
    .filter((p) => p.status === "Levert")
    .reduce((s, p) => s + Number(p.budget), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Prosjekter</div>
          <div className="text-[12px] text-charcoal mt-1">
            {prosjekter.length} totalt · {kr(summerte)} samlet budsjett · {kr(levertDenneMnd)} levert
          </div>
        </div>
        <button onClick={() => setModalApen(true)} className={`${btnPrimary} flex items-center gap-2`}>
          <Plus size={14} /> Nytt prosjekt
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {prosjekter.map((p) => (
          <div key={p.id} className="bg-cream rounded-sm p-4 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13.5px] text-dark leading-snug">{p.name}</div>
              <span className="font-display text-[13px] text-dark shrink-0">{kr(p.budget)}</span>
            </div>
            <div className="text-[11px] text-charcoal">{p.customers?.name ?? "Internt"} {p.type ? `· ${p.type}` : ""}</div>
            {p.hour_budget && <div className="text-[11px] text-charcoal">Timebudsjett: {timer(p.hour_budget)} t</div>}
            {p.deadline && <div className="text-[11px] text-charcoal">Frist: {dato(p.deadline)}</div>}
            <div className="flex items-center justify-between mt-1">
              <select
                value={p.status}
                onChange={(e) => endreStatus(p.id, e.target.value as Prosjektstatus)}
                className="text-[11px] border border-lightsage rounded-sm px-1.5 py-1 bg-white"
              >
                {STATUSER.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Pill value={p.status} />
            </div>
          </div>
        ))}
      </div>

      {prosjekter.length === 0 && (
        <div className="bg-cream rounded-sm p-8 text-center text-[13px] text-charcoal">Ingen prosjekter ennå.</div>
      )}

      {modalApen && (
        <NyttProsjektModal
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

function NyttProsjektModal({
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
    name: "",
    customer_id: "",
    type: "",
    budget: "",
    hour_budget: "",
    start_date: "",
    deadline: "",
    notes: "",
  });

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setLagrer(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("projects").insert({
      ...form,
      customer_id: form.customer_id || null,
      budget: Number(form.budget) || 0,
      hour_budget: form.hour_budget ? Number(form.hour_budget) : null,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      owner: user.user?.id,
      status: "Planlagt",
    });
    setLagrer(false);
    onSaved();
  }

  return (
    <Modal title="Nytt prosjekt" onClose={onClose}>
      <form onSubmit={lagre} className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Prosjektnavn</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="F.eks. Custom dashboard, CRM-utvikling…"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Kunde (valgfritt — internt hvis tomt)</label>
          <select
            className={inputCls}
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          >
            <option value="">Internt / ikke kundespesifikt</option>
            {kunder.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <input
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="Tracking, dashboard, produkt…"
            />
          </div>
          <div>
            <label className={labelCls}>Pris (kr)</label>
            <input
              type="number"
              className={inputCls}
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start</label>
            <input
              type="date"
              className={inputCls}
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Deadline</label>
            <input
              type="date"
              className={inputCls}
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" disabled={lagrer} className={btnPrimary}>
          {lagrer ? "Lagrer…" : "Lagre prosjekt"}
        </button>
      </form>
    </Modal>
  );
}
