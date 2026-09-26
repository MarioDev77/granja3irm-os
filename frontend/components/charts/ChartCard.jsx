'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Envelope visual padrão para os cartões de gráfico (mesmo estilo do dashboard
 * principal). Mostra um estado vazio quando não há dados suficientes.
 */
export default function ChartCard({ title, subtitle, isEmpty, emptyText = 'Sem dados suficientes neste período.', children, className = '' }) {
  return (
    <Card className={`border-ink-300/40 bg-white shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="py-16 text-center text-sm text-ink-500">{emptyText}</p> : children}
      </CardContent>
    </Card>
  );
}

/** Par de botões "Lista / Gráficos" reutilizado nas páginas de módulo. */
export function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-ink-300/50 bg-white p-0.5">
      {[
        { id: 'list', label: 'Lista' },
        { id: 'charts', label: 'Gráficos' },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            view === opt.id ? 'bg-olive-700 text-white' : 'text-ink-600 hover:bg-ink-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
