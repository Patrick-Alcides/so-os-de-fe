export default function StatCard({ title, value, subtitle, className = "" }) {
  return (
    <div className={`panel p-5 ${className}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-3 font-['Space_Grotesk'] text-4xl font-bold text-ink">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
