'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { referenceMonth: '', medicationCost: '0', laborCost: '0', energyCost: '0', waterCost: '0', otherCost: '0' };

export default function CustosPage() {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/production-costs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCosts(data.costs);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar custos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/production-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Custo de produção lançado. Custo de ração calculado automaticamente pelo consumo do mês.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao lançar custo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Custo de produção</h1>
          <p className="text-sm text-ink-500 mt-1">
            Custo de ração é calculado automaticamente pelo consumo real do mês; os demais custos são
            lançados manualmente (ainda não há módulos dedicados de folha de pagamento e contas de
            energia/água).
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Lançar mês'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Mês de referência</label>
            <input required type="month" className="input-field mt-1" value={form.referenceMonth}
              onChange={(e) => setForm({ ...form, referenceMonth: e.target.value })} />
          </div>
          <div>
            <label className="label">Medicamentos/vacinas (R$)</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.medicationCost}
              onChange={(e) => setForm({ ...form, medicationCost: e.target.value })} />
          </div>
          <div>
            <label className="label">Funcionários (R$)</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.laborCost}
              onChange={(e) => setForm({ ...form, laborCost: e.target.value })} />
          </div>
          <div>
            <label className="label">Energia (R$)</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.energyCost}
              onChange={(e) => setForm({ ...form, energyCost: e.target.value })} />
          </div>
          <div>
            <label className="label">Água (R$)</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.waterCost}
              onChange={(e) => setForm({ ...form, waterCost: e.target.value })} />
          </div>
          <div>
            <label className="label">Outros custos (R$)</label>
            <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.otherCost}
              onChange={(e) => setForm({ ...form, otherCost: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Lançar custo do mês'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : costs.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Mês</th>
                  <th className="px-4 py-3">Custo ração</th>
                  <th className="px-4 py-3">Custo total</th>
                  <th className="px-4 py-3">Custo/ovo</th>
                  <th className="px-4 py-3">Custo/ave</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {new Date(c.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-ink-700">R$ {Number(c.feedCost).toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink-700">R$ {c.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink-700">{c.costPerEgg !== null ? `R$ ${c.costPerEgg.toFixed(4)}` : '—'}</td>
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
