"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { kr, timer } from "@/lib/format";
import { Plus, Check } from "lucide-react";

export interface KundeOversiktRadData {
  id: string;
  name: string;
  hoursLogged: number;
  budget: number;
  forbruk: number;
  totalverdi: number;
}

export default function KundeOversiktRad({ kunde }: { kunde: KundeOversiktRadData }) {
  const supabase = createClient();
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [timer_, setTimerVerdi] = useState("");
  const [lagrer, setLagrer] = useState(false);

  async function loggTid(e: React.FormEvent) {
    e.preventDefault();
    if (!timer_) return;
    setLagrer(true);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("time_entries").insert({
      customer_id: kunde.id,
      type: "Retainer",
      hours: Number(timer_),
      owner: user.user?.id,
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setTimerVerdi("");
    setLagrer(false);
    setApen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#E2DDD2] last:border-0 hover:bg-white/60 text-[12.5px]">
      <Link href={`/kunder/${kunde.id}`} className="w-[150px] shrink-0 truncate text-dark">
        {kunde.name}
      </Link>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${
              kunde.forbruk > 1 ? "bg-rose" : kunde.forbruk > 0.85 ? "bg-brown" : "bg-sage"
            }`}
            style={{ width: `${Math.min(100, kunde.forbruk * 100)}%` }}
          />
        </div>
        <span className="text-[11px] text-charcoal w-[90px] shrink-0 text-right">
          {timer(kunde.hoursLogged)} / {timer(kunde.budget)} t
        </span>
      </div>

      <span className="font-display text-dark w-[100px] shrink-0 text-right">{kr(kunde.totalverdi)}</span>

      {apen ? (
        <form onSubmit={loggTid} className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            step="0.25"
            min="0"
            autoFocus
            value={timer_}
            onChange={(e) => setTimerVerdi(e.target.value)}
            placeholder="t"
            className="w-[50px] border border-lightsage rounded-sm px-1.5 py-1 text-[11.5px] bg-white"
          />
          <button
            type="submit"
            disabled={lagrer}
            className="bg-sage text-white rounded-sm p-1 hover:opacity-90 disabled:opacity-50"
          >
            <Check size={13} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setApen(true)}
          className="shrink-0 p-1 rounded-sm border border-lightsage text-charcoal hover:border-dark hover:text-dark"
          title="Logg tid raskt"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
