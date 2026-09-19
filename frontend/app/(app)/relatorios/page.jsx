'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import { exportToCSV, exportToPDF } from '@/lib/reportExport';

const REPORT_TYPES = [
  { group: 'Produção', type: 'production-daily', label: 'Produção diária', usesPeriod: true },
  { group: 'Produção', type: 'production-by-flock', label: 'Produção por lote', usesPeriod: false },
  { group: 'Aves', type: 'birds-summary', label: 'Resumo de aves', usesPeriod: false },
  { group: 'Alimentação', type: 'feed-consumption', label: 'Consumo de ração', usesPeriod: true },
  { group: 'Financeiro', type: 'financial-summary', label: 'Resumo financeiro', usesPeriod: true },
  { group: 'Vendas', type: 'sales-top-products', label: 'Produtos mais vendidos', usesPeriod: true },
  { group: 'Vendas', type: 'sales-top-customers', label: 'Clientes que mais compram', usesPeriod: true },
];

export default function RelatoriosPage() {
  const [selected, setSelected] = useState(REPORT_TYPES[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: selected.type });
      if (selected.usesPeriod && start && end) {
        params.set('start', start);
        params.set('end', end);
      }
      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Erro ao gerar relatório.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selected]);

  const groups = [...new Set(REPORT_TYPES.map((r) => r.group))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-900">Relatórios</h1>
        <p className="text-sm text-ink-500 mt-1">Todos os indicadores são calculados a partir dos dados reais do sistema.</p>
      </div>

      <div className="flex flex-wrap gap-4">
        {groups.map((group) => (
          <div key={group} className="flex flex-wrap gap-2">
            {REPORT_TYPES.filter((r) => r.group === group).map((r) => (
              <button
                key={r.type}
                onClick={() => setSelected(r)}
                className={`text-xs px-3 py-1.5 rounded font-medium ${
                  selected.type === r.type ? 'bg-olive-700 text-white' : 'bg-white border border-ink-300 text-ink-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {selected.usesPeriod && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-ink-500">De</label>
            <input type="date" className="input-field mt-1" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-ink-500">Até</label>
            <input type="date" className="input-field mt-1" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={load}>Filtrar período</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : error ? (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">{error}</div>
      ) : !report || report.rows.length === 0 ? (
        <EmptyState title="Não há dados registrados." description="Nenhum dado disponível para este relatório ainda." />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-lg text-ink-900">{report.title}</h2>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => exportToCSV(report.title, report.headers, report.rows)}>
                Exportar CSV
              </button>
              <button className="btn-secondary text-xs" onClick={() => exportToPDF(report.title, report.headers, report.rows)}>
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>{report.headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-t border-ink-300/30">
                      {row.map((cell, j) => <td key={j} className="px-4 py-3 text-ink-700">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
