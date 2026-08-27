"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer } from "@/lib/types";
import Modal from "@/components/Modal";
import Pill from "@/components/Pill";
import { inputCls, labelCls, btnPrimary } from "@/lib/ui";
import { kr, dato } from "@/lib/format";
import { Plus } from "lucide-react";

const STATUSER = ["Utkast", "Klar til fakturering", "Sendt", "Betalt", "Forfalt", "Kreditert"];

function inneverendeManed() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export default function FaktureringPage() {
  const supabase = createClient();
  const [kunder, setKunder] = useState<Customer[]>([]);
  const [fakturaer, setFakturaer] = useState<any[]>([]);
  const [maned, setManed] = useState(inneverendeManed());
  const [modalApen, setModalApen] = useState(false);

  async function hent() {
    const [{ data: k }, { data: f }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase
        .from("invoices")
        .select("*, customers(name)")
        .gte("month", `${maned}-01`)
        .lt("month", nesteManed(maned))
        .order("created_at"),
    ]);
    setKunder(k ?? []);
    setFakturaer(f ?? []);
  }

  function nesteManed(m: string) {
    const [y, mm] = m.split("-").map(Number);
    const d = new Date(y, mm, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  useEffect(() => {
    hent();
  }, [maned]);

  async function endreStatus(id: string, status: string) {
    await supabase.from("invoices").update({ status }).eq("id", id);
    hent();
  }

  const sumTotal = fakturaer.reduce(
    (s, f) => s + Number(f.retainer_amount) + Number(f.upsell_amount) + Number(f.project_amount),
    0
  );
  const utestaende = fakturaer
    .filter((f) => f.status === "Sendt" || f.status === "Forfalt")
    .reduce((s, f) => s + Number(f.retainer_amount) + Number(f.upsell_amount) + Number(f.project_amount), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Fakturering</div>
          <div className="text-[12px] text-charcoal mt-1">
            {kr(sumTotal)} totalt denne måneden · {kr(utestaende)} utestående
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={maned}
            onChange={(e) => setManed(e.target.value)}
            className="text-[12px] border border-lightsage rounded-sm px-2.5 py-1.5 bg-white"
          />
          <button onClick={() => setModalApen(true)} className={`${btnPrimary} flex items-center gap-2`}>
            <Plus size={14} /> Ny faktura
          </button>
        </div>
      </div>

      <div className="bg-cream rounded-sm shadow-sm overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[10.5px] font-display tracking-[0.05em] uppercase text-charcoal border-b border-[#E2DDD2]">
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Retainer</th>
              <th className="px-4 py-3">Mersalg</th>
              <th className="px-4 py-3">Prosjekt/annet</th>
              <th className="px-4 py-3">Sum</th>
              <th className="px-4 py-3">Forfall</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {fakturaer.map((f) => {
              const sum = Number(f.retainer_amount) + Number(f.upsell_amount) + Number(f.project_amount);
              const forfalt = f.due_date && new Date(f.due_date) < new Date() && f.status !== "Betalt" && f.status !== "Kreditert";
              return (
                <tr key={f.id} className="border-b border-[#E2DDD2] last:border-0 hover:bg-white/60">
                  <td className="px-4 py-2.5 text-dark">{f.customers?.name}</td>
                  <td className="px-4 py-2.5 text-charcoal">{kr(f.retainer_amount)}</td>
                  <td className="px-4 py-2.5 text-charcoal">{kr(f.upsell_amount)}</td>
                  <td className="px-4 py-2.5 text-charcoal">{kr(f.project_amount)}</td>
                  <td className="px-4 py-2.5 font-display text-dark">{kr(sum)}</td>
                  <td className={`px-4 py-2.5 ${forfalt ? "text-rose" : "text-charcoal"}`}>{dato(f.due_date)}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={f.status}
                      onChange={(e) => endreStatus(f.id, e.target.value)}
                      className="text-[11px] border border-lightsage rounded-sm px-1.5 py-1 bg-white"
                    >
                      {STATUSER.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {fakturaer.length === 0 && (
          <div className="p-6 text-center text-[12px] text-charcoal italic">Ingen fakturarader for denne måneden.</div>
        )}
      </div>

      {modalApen && (
        <NyFakturaModal
          kunder={kunder}
          maned={maned}
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

function NyFakturaModal({
  kunder,
  maned,
  onClose,
  onSaved,
}: {
  kunder: Customer[];
  maned: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [lagrer, setLagrer] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    retainer_amount: "",
    upsell_amount: "",
    project_amount: "",
    invoice_number: "",
    due_date: "",
  });

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) return;
    setLagrer(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("invoices").insert({
      customer_id: form.customer_id,
      month: `${maned}-01`,
      retainer_amount: Number(form.retainer_amount) || 0,
      upsell_amount: Number(form.upsell_amount) || 0,
      project_amount: Number(form.project_amount) || 0,
      invoice_number: form.invoice_number || null,
      due_date: form.due_date || null,
      owner: user.user?.id,
      status: "Utkast",
    });
    setLagrer(false);
    onSaved();
  }

  return (
    <Modal title={`Ny faktura — ${maned}`} onClose={onClose}>
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Retainer</label>
            <input
              type="number"
              className={inputCls}
              value={form.retainer_amount}
              onChange={(e) => setForm({ ...form, retainer_amount: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Mersalg</label>
            <input
              type="number"
              className={inputCls}
              value={form.upsell_amount}
              onChange={(e) => setForm({ ...form, upsell_amount: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Prosjekt/annet</label>
            <input
              type="number"
              className={inputCls}
              value={form.project_amount}
              onChange={(e) => setForm({ ...form, project_amount: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fakturanr</label>
            <input
              className={inputCls}
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Forfall</label>
            <input
              type="date"
              className={inputCls}
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" disabled={lagrer} className={btnPrimary}>
          {lagrer ? "Lagrer…" : "Lagre faktura"}
        </button>
      </form>
    </Modal>
  );
}
