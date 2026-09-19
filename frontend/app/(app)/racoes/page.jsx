'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { name: '', type: 'LAYING', manufacturer: '', unit: 'kg', minimumStock: '0', averagePrice: '', notes: '' };
const TYPE_LABELS = { INITIAL: 'Inicial', GROWTH: 'Crescimento', LAYING: 'Postura', BREEDING: 'Reprodução', OTHER: 'Outra' };

export default function RacoesPage() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/feeds');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeeds(data.feeds);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar rações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Ração cadastrada com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar ração.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Rações</h1>
          <p className="text-sm text-ink-500 mt-1">Cadastro de tipos de ração e estoque mínimo.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nova ração'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome</label>
            <input required className="input-field mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Ração Postura Premium" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fabricante</label>
            <input className="input-field mt-1" value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <label className="label">Unidade</label>
            <input className="input-field mt-1" value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg" />
          </div>
          <div>
            <label className="label">Estoque mínimo</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.minimumStock}
              onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} />
          </div>
          <div>
            <label className="label">Preço médio (R$/{form.unit || 'un.'})</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.averagePrice}
              onChange={(e) => setForm({ ...form, averagePrice: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observações</label>
            <input className="input-field mt-1" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar ração'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : feeds.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Cadastre o primeiro tipo de ração." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Ração</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estoque atual</th>
                  <th className="px-4 py-3">Estoque mínimo</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((f) => {
                  const critical = Number(f.currentStock) <= Number(f.minimumStock);
                  return (
                    <tr key={f.id} className="border-t border-ink-300/30">
                      <td className="px-4 py-3 font-medium text-ink-900">{f.name}</td>
                      <td className="px-4 py-3 text-ink-700">{TYPE_LABELS[f.type]}</td>
                      <td className="px-4 py-3 text-ink-700">{Number(f.currentStock).toLocaleString('pt-BR')} {f.unit}</td>
                      <td className="px-4 py-3 text-ink-700">{Number(f.minimumStock).toLocaleString('pt-BR')} {f.unit}</td>
                      <td className="px-4 py-3">
                        {critical ? (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-clay-100 text-clay-700">Estoque crítico</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-olive-100 text-olive-700">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
