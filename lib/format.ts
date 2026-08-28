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

// Tar imot en "YYYY-MM"-streng (fra ?month= i URL) og returnerer alt
// dashboardet trenger for å vise og navigere den måneden.
export function monthFromParam(monthParam?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indeksert

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  const toParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("nb-NO", { month: "long", year: "numeric" }),
    monthParam: toParam(start),
    prevParam: toParam(prev),
    nextParam: toParam(next),
    isCurrentMonth,
  };
}
