'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import StatCard from '@/components/StatCard';

const PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '1y', label: '1 ano' },
];

const emptyForm = { type: 'INFLOW', category: '', description: '', value: '', date: '' };

export default function FluxoCaixaPage() {
  const [preset, setPreset] = useState('30d');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cash-flow?preset=${preset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar fluxo de caixa.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [preset]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/cash-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Lançamento registrado.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar lançamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Fluxo de caixa</h1>
          <p className="text-sm text-ink-500 mt-1">
            Inclui contas pagas/recebidas automaticamente, além de lançamentos manuais.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo lançamento'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`text-xs px-3 py-1.5 rounded font-medium ${
              preset === p.value ? 'bg-olive-700 text-white' : 'bg-white border border-ink-300 text-ink-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo</label>
            <select className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="INFLOW">Entrada</option>
              <option value="OUTFLOW">Saída</option>
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <input required className="input-field mt-1" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={form.type === 'INFLOW' ? 'Ex.: Venda de esterco' : 'Ex.: Combustível'} />
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div>
            <label className="label">Data</label>
            <input required type="date" className="input-field mt-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descrição</label>
            <input className="input-field mt-1" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {loading || !summary ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Saldo inicial" value={`R$ ${summary.openingBalance.toFixed(2)}`} />
            <StatCard label="Entradas" value={`R$ ${summary.totalInflow.toFixed(2)}`} />
            <StatCard label="Saídas" value={`R$ ${summary.totalOutflow.toFixed(2)}`} />
            <StatCard label="Saldo final" value={`R$ ${summary.closingBalance.toFixed(2)}`} />
          </div>

          <div className="card overflow-hidden">
            {summary.entries.length === 0 ? (
              <EmptyState title="Não há dados registrados." description="Nenhum lançamento manual neste período." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.entries.map((e) => (
                      <tr key={e.id} className="border-t border-ink-300/30">
                        <td className="px-4 py-3 text-ink-700">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${e.type === 'INFLOW' ? 'bg-olive-100 text-olive-700' : 'bg-clay-100 text-clay-700'}`}>
                            {e.type === 'INFLOW' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{e.category}</td>
                        <td className="px-4 py-3 text-ink-700">R$ {Number(e.value).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
