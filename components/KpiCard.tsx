export default function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sage" | "brown" | "rose" | "dark";
}) {
  const border = {
    sage: "border-l-sage",
    brown: "border-l-brown",
    rose: "border-l-rose",
    dark: "border-l-dark",
  }[accent ?? "dark"];

  return (
    <div className={`bg-cream rounded-sm p-4 border-l-[3px] ${border} shadow-sm`}>
      <div className="text-[10px] font-display tracking-[0.08em] uppercase text-charcoal mb-1.5">
        {label}
      </div>
      <div className="text-[22px] font-display text-dark leading-none">{value}</div>
    </div>
  );
}
