export default function StatCard({ label, value, suffix, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-display text-ink-900">
        {value}
        {suffix && <span className="text-sm font-sans text-ink-500 ml-1">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
