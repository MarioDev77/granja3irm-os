'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import StatCard from '@/components/StatCard';
import { ViewToggle } from '@/components/charts/ChartCard';
import FinanceCharts from '@/components/charts/FinanceCharts';

export default function FinanceiroPage() {
  const [data, setData] = useState(null);
  const [raw, setRaw] = useState({ entries: [], payables: [], receivables: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');

  useEffect(() => {
    async function load() {
      try {
        const [payRes, recRes, flowRes] = await Promise.all([
          fetch('/api/accounts-payable'),
          fetch('/api/accounts-receivable'),
          fetch('/api/cash-flow?preset=30d'),
        ]);
        const [payData, recData, flowData] = await Promise.all([payRes.json(), recRes.json(), flowRes.json()]);
        if (!payRes.ok) throw new Error(payData.error);
        if (!recRes.ok) throw new Error(recData.error);
        if (!flowRes.ok) throw new Error(flowData.error);

        const openPayable = payData.payables
          .filter((p) => p.status === 'OPEN' || p.status === 'OVERDUE')
          .reduce((s, p) => s + Number(p.value), 0);
        const overduePayable = payData.payables.filter((p) => p.status === 'OVERDUE').length;

        const openReceivable = recData.receivables
          .filter((r) => r.status === 'OPEN' || r.status === 'OVERDUE')
          .reduce((s, r) => s + Number(r.value), 0);
        const overdueReceivable = recData.receivables.filter((r) => r.status === 'OVERDUE').length;

        setData({
          openPayable, overduePayable, openReceivable, overdueReceivable,
          revenue30d: flowData.totalInflow, expenses30d: flowData.totalOutflow,
          balance: flowData.closingBalance,
        });
        setRaw({ entries: flowData.entries || [], payables: payData.payables || [], receivables: recData.receivables || [] });
      } catch (err) {
        toast.error(err.message || 'Erro ao carregar dados financeiros.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !data) return <p className="text-sm text-ink-500">Carregando...</p>;

  const profit30d = data.revenue30d - data.expenses30d;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Dashboard financeiro</h1>
          <p className="text-sm text-ink-500 mt-1">Visão geral dos últimos 30 dias.</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === 'charts' && (
        <FinanceCharts entries={raw.entries} payables={raw.payables} receivables={raw.receivables} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Receita (30 dias)" value={`R$ ${data.revenue30d.toFixed(2)}`} />
        <StatCard label="Despesas (30 dias)" value={`R$ ${data.expenses30d.toFixed(2)}`} />
        <StatCard
          label="Resultado estimado"
          value={`R$ ${profit30d.toFixed(2)}`}
          hint={profit30d >= 0 ? 'Positivo' : 'Negativo'}
        />
        <StatCard label="Saldo de caixa" value={`R$ ${data.balance.toFixed(2)}`} />
        <StatCard
          label="Contas a pagar em aberto"
          value={`R$ ${data.openPayable.toFixed(2)}`}
          hint={data.overduePayable > 0 ? `${data.overduePayable} vencida(s)` : undefined}
        />
        <StatCard
          label="Contas a receber em aberto"
          value={`R$ ${data.openReceivable.toFixed(2)}`}
          hint={data.overdueReceivable > 0 ? `${data.overdueReceivable} vencida(s)` : undefined}
        />
      </div>

      <div className="card p-5">
        <p className="text-sm text-ink-500">
          Os valores acima são calculados a partir de contas pagas/recebidas e lançamentos manuais de caixa —
          nada aqui é estimado. Para detalhar, use Fluxo de caixa, Contas a pagar, Contas a receber e Custos
          no menu Financeiro.
        </p>
      </div>
    </div>
  );
}
