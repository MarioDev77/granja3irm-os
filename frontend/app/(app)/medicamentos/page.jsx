'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { name: '', flockId: '', quantity: '', dosage: '', reason: '', date: '', notes: '' };

export default function MedicamentosPage() {
  const [records, setRecords] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [mRes, fRes] = await Promise.all([fetch('/api/medications'), fetch('/api/flocks')]);
      const mData = await mRes.json();
      const fData = await fRes.json();
      if (!mRes.ok) throw new Error(mData.error);
      setRecords(mData.medications);
      setFlocks((fData.flocks || []).filter((f) => f.status === 'ACTIVE'));
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar medicamentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Medicamento registrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar medicamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Medicamentos</h1>
          <p className="text-sm text-ink-500 mt-1">Histórico de medicamentos aplicados por lote.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={flocks.length === 0}>
          {showForm ? 'Cancelar' : 'Registrar medicamento'}
        </button>
      </div>

      {flocks.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre pelo menos um lote ativo antes de registrar um medicamento.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome do medicamento</label>
            <input required className="input-field mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <label className="label">Quantidade</label>
            <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Dosagem</label>
            <input className="input-field mt-1" value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
          </div>
          <div>
            <label className="label">Motivo</label>
            <input className="input-field mt-1" value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <label className="label">Data</label>
            <input required type="date" className="input-field mt-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
        ) : records.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Medicamento</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.name}</td>
                    <td className="px-4 py-3 text-ink-700">{r.flock?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{Number(r.quantity).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-ink-700">{r.reason || '—'}</td>
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
