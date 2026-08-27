"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Customer, Segment, Kundestatus } from "@/lib/types";
import Modal from "@/components/Modal";
import Pill from "@/components/Pill";
import { inputCls, labelCls, btnPrimary } from "@/lib/ui";
import { Plus } from "lucide-react";

const SEGMENTER: Segment[] = ["Retainer", "Prosjekt", "Retainer + prosjekt", "Prospect", "Sovende"];
const STATUSER: Kundestatus[] = ["Aktiv", "Pause", "Prospect", "Avsluttet"];

export default function KunderPage() {
  const supabase = createClient();
  const [kunder, setKunder] = useState<Customer[]>([]);
  const [lastet, setLastet] = useState(false);
  const [modalApen, setModalApen] = useState(false);
  const [filter, setFilter] = useState<Kundestatus | "Alle">("Alle");

  async function hent() {
    const { data } = await supabase.from("customers").select("*").order("name");
    setKunder(data ?? []);
    setLastet(true);
  }

  useEffect(() => {
    hent();
  }, []);

  const visKunder = filter === "Alle" ? kunder : kunder.filter((k) => k.status === filter);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[22px] text-dark">Kunder</div>
          <div className="text-[12px] text-charcoal mt-1">{kunder.length} kunder totalt</div>
        </div>
        <button onClick={() => setModalApen(true)} className={`${btnPrimary} flex items-center gap-2`}>
          <Plus size={14} /> Ny kunde
        </button>
      </div>

      <div className="flex gap-2">
        {(["Alle", ...STATUSER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-[11.5px] border transition-colors ${
              filter === s ? "bg-dark text-white border-dark" : "border-lightsage text-charcoal hover:border-dark"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {lastet && visKunder.length === 0 && (
        <div className="bg-cream rounded-sm p-8 text-center text-[13px] text-charcoal">
          Ingen kunder i denne visningen ennå.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visKunder.map((k) => (
          <Link
            key={k.id}
            href={`/kunder/${k.id}`}
            className="bg-cream rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 overflow-hidden text-white font-display text-[13px]"
                style={{ background: k.brand_color ?? "#31353D" }}
              >
                {k.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={k.logo_url} alt={k.name} className="w-full h-full object-cover" />
                ) : (
                  k.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-dark truncate">{k.name}</div>
                <div className="text-[11px] text-charcoal">{k.segment}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Pill value={k.status} />
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < k.health ? "bg-sage" : "bg-lightsage"}`}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {modalApen && (
        <NyKundeModal
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

function NyKundeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [lagrer, setLagrer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [logoFil, setLogoFil] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    segment: "Retainer" as Segment,
    status: "Aktiv" as Kundestatus,
    health: 5,
    contact_name: "",
    contact_email: "",
    customer_since: "",
    brand_color: "#31353D",
    notes: "",
  });

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    if (!form.name.trim()) {
      setFeil("Kundenavn er påkrevd.");
      return;
    }
    setLagrer(true);

    const { data: user } = await supabase.auth.getUser();
    const owner = user.user?.id;

    const { data: kunde, error } = await supabase
      .from("customers")
      .insert({ ...form, customer_since: form.customer_since || null, owner })
      .select()
      .single();

    if (error || !kunde) {
      setFeil(error?.message ?? "Noe gikk galt.");
      setLagrer(false);
      return;
    }

    if (logoFil) {
      const path = `${kunde.id}/${logoFil.name}`;
      const { error: uploadErr } = await supabase.storage.from("logos").upload(path, logoFil, {
        upsert: true,
      });
      if (!uploadErr) {
        const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
        await supabase.from("customers").update({ logo_url: pub.publicUrl }).eq("id", kunde.id);
      }
    }

    setLagrer(false);
    onSaved();
  }

  return (
    <Modal title="Ny kunde" onClose={onClose}>
      <form onSubmit={lagre} className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Kundenavn</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Segment</label>
            <select
              className={inputCls}
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value as Segment })}
            >
              {SEGMENTER.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Kundestatus })}
            >
              {STATUSER.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Kontaktperson</label>
            <input
              className={inputCls}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>E-post</label>
            <input
              type="email"
              className={inputCls}
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Kunde siden</label>
            <input
              type="date"
              className={inputCls}
              value={form.customer_since}
              onChange={(e) => setForm({ ...form, customer_since: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Kundehelse (1–5)</label>
            <select
              className={inputCls}
              value={form.health}
              onChange={(e) => setForm({ ...form, health: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className={labelCls}>Merkefarge</label>
            <input
              type="color"
              className="w-full h-[38px] border border-lightsage rounded-sm bg-white"
              value={form.brand_color}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFil(e.target.files?.[0] ?? null)}
              className="text-[12px]"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notat</label>
          <textarea
            className={inputCls}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {feil && <div className="text-rose text-[12px]">{feil}</div>}
        <button type="submit" disabled={lagrer} className={btnPrimary}>
          {lagrer ? "Lagrer…" : "Lagre kunde"}
        </button>
      </form>
    </Modal>
  );
}
