"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  Zap,
  Clock,
  Repeat,
  TrendingUp,
  Briefcase,
  BarChart3,
  LogOut,
} from "lucide-react";

const LENKER = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/hurtiglogging", label: "Hurtiglogging", icon: Zap },
  { href: "/timelogg", label: "Timelogg", icon: Clock },
  { href: "/retainere", label: "Retainere", icon: Repeat },
  { href: "/mersalg", label: "Mersalg", icon: TrendingUp },
  { href: "/prosjekter", label: "Prosjekter", icon: Briefcase },
  { href: "/rapporter", label: "Rapporter", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function loggUt() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[220px] shrink-0 bg-dark text-cream flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="font-display text-[15px] tracking-[0.16em]">AMIDAYS</div>
        <div className="font-display text-[10px] tracking-[0.12em] text-lightsage uppercase mt-1">
          Kunderegister
        </div>
      </div>
      <nav className="flex-1 py-4">
        {LENKER.map(({ href, label, icon: Icon }) => {
          const aktiv = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-6 py-2.5 text-[13px] transition-colors ${
                aktiv
                  ? "bg-white/10 text-white border-r-2 border-brown"
                  : "text-lightsage hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={loggUt}
        className="flex items-center gap-3 px-6 py-4 text-[12px] text-lightsage hover:text-white border-t border-white/10 transition-colors"
      >
        <LogOut size={15} strokeWidth={1.75} />
        Logg ut
      </button>
    </aside>
  );
}
