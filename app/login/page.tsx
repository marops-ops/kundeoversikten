"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    setLaster(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: epost,
      password: passord,
    });
    setLaster(false);
    if (error) {
      setFeil("Feil e-post eller passord.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[360px] bg-cream rounded-sm shadow-[0_18px_44px_-20px_rgba(49,53,61,.45)] p-8">
        <div className="font-display text-[15px] tracking-[0.16em] text-dark mb-1">AMIDAYS</div>
        <div className="font-display text-[10px] tracking-[0.12em] text-charcoal uppercase mb-6">
          Kunderegister — logg inn
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="E-post"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            className="border border-lightsage bg-white px-3 py-2.5 text-[13px] text-dark outline-none focus:border-dark rounded-sm"
          />
          <input
            type="password"
            required
            placeholder="Passord"
            value={passord}
            onChange={(e) => setPassord(e.target.value)}
            className="border border-lightsage bg-white px-3 py-2.5 text-[13px] text-dark outline-none focus:border-dark rounded-sm"
          />
          {feil && <div className="text-rose text-[12px]">{feil}</div>}
          <button
            type="submit"
            disabled={laster}
            className="bg-dark text-white font-display text-[12px] tracking-[0.08em] uppercase py-2.5 rounded-sm hover:bg-[#232630] transition-colors disabled:opacity-60 mt-2"
          >
            {laster ? "Logger inn…" : "Logg inn"}
          </button>
        </form>
        <div className="text-[11px] text-charcoal mt-5 leading-relaxed">
          Ingen konto ennå? Opprett brukeren din i Supabase → Authentication → Users, eller be meg legge til registrering.
        </div>
      </div>
    </div>
  );
}
