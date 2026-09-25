'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { date: '', flockId: '', feedId: '', quantity: '', notes: '' };

export default function ConsumoRacaoPage() {
  const [consumptions, setConsumptions] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cRes, fRes, feedRes] = await Promise.all([
        fetch('/api/feed-consumption'), fetch('/api/flocks'), fetch('/api/feeds'),
      ]);
      const cData = await cRes.json();
      const fData = await fRes.json();
      const feedData = await feedRes.json();
      if (!cRes.ok) throw new Error(cData.error);
      setConsumptions(cData.consumptions);
      setFlocks((fData.flocks || []).filter((f) => f.status === 'ACTIVE'));
      setFeeds(feedData.feeds || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar consumo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(payload) {
    const res = await fetch('/api/feed-consumption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { res, data: await res.json() };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let { res, data } = await submit(form);
      if (!res.ok && data.error?.includes('Apenas um administrador')) {
        const confirmNegative = window.confirm(`${data.error}\n\nAutorizar mesmo assim?`);
        if (confirmNegative) ({ res, data } = await submit({ ...form, authorizeNegative: true }));
      }
      if (!res.ok) throw new Error(data.error);
      toast.success('Consumo registrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar consumo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Consumo de ração</h1>
          <p className="text-sm text-ink-500 mt-1">Consumo diário por lote, com custo calculado automaticamente.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={flocks.length === 0 || feeds.length === 0}>
          {showForm ? 'Cancelar' : 'Registrar consumo'}
        </button>
      </div>

      {(flocks.length === 0 || feeds.length === 0) && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          {flocks.length === 0 && feeds.length === 0
            ? 'Cadastre um lote (em Lotes) e uma ração (em Rações) antes de registrar consumo.'
            : flocks.length === 0
            ? 'Cadastre um lote (em Lotes) antes de registrar consumo.'
            : 'Cadastre uma ração (em Rações) antes de registrar consumo.'}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Data</label>
            <input required type="date" className="input-field mt-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Lote</label>
            <select required className="input-field mt-1" value={form.flockId}
              onChange={(e) => setForm({ ...form, flockId: e.target.value })}>
              <option value="">Selecione...</option>
              {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ração</label>
            <select required className="input-field mt-1" value={form.feedId}
              onChange={(e) => setForm({ ...form, feedId: e.target.value })}>
              <option value="">Selecione...</option>
              {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantidade</label>
            <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observações</label>
            <input className="input-field mt-1" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : consumptions.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Ração</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Custo</th>
                  <th className="px-4 py-3">Custo/ave</th>
                </tr>
              </thead>
              <tbody>
                {consumptions.map((c) => (
                  <tr key={c.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(c.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{c.flock?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{c.feed?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{Number(c.quantity).toLocaleString('pt-BR')} {c.feed?.unit}</td>
                    <td className="px-4 py-3 text-ink-700">{c.cost !== null ? `R$ ${c.cost.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{c.costPerBird !== null ? `R$ ${c.costPerBird.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
