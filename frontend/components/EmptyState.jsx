export default function EmptyState({ title = 'Não há dados registrados.', description, action }) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-12 px-4">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-ink-300 mb-3">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-500 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
