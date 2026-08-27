export function kr(n: number | null | undefined) {
  if (n == null) return "0 kr";
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n) + " kr";
}

export function pct(n: number | null | undefined) {
  if (n == null) return "0 %";
  return Math.round(n * 100) + " %";
}

export function timer(n: number | null | undefined) {
  if (n == null) return "0";
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function dato(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function monthRange(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
