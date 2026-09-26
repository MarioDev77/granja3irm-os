'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { date: '', flockId: '', goodEggs: '', brokenEggs: '0', dirtyEggs: '0', discardedEggs: '0', notes: '' };

export default function ProducaoPage() {
  const [records, setRecords] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [recordsRes, flocksRes] = await Promise.all([fetch('/api/egg-production'), fetch('/api/flocks')]);
      const recordsData = await recordsRes.json();
      const flocksData = await flocksRes.json();
      if (!recordsRes.ok) throw new Error(recordsData.error);
      setRecords(recordsData.records);
      setFlocks((flocksData.flocks || []).filter((f) => f.status === 'ACTIVE'));
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar produção.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/egg-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Produção registrada com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar produção.');
    } finally {
      setSaving(false);
    }
  }

  // Apenas as quantidades e observações podem ser corrigidas (data e lote
  // são fixos após o lançamento, ver PATCH /api/egg-production/:id).
  function openEdit(record) {
    setEditingRecord(record);
    setEditForm({
      goodEggs: String(record.goodEggs ?? '0'),
      brokenEggs: String(record.brokenEggs ?? '0'),
      dirtyEggs: String(record.dirtyEggs ?? '0'),
      discardedEggs: String(record.discardedEggs ?? '0'),
      notes: record.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/egg-production/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Produção atualizada com sucesso.');
      setEditingRecord(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar produção.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Produção de ovos</h1>
          <p className="text-sm text-ink-500 mt-1">Registro diário de produção por lote.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={flocks.length === 0}>
          {showForm ? 'Cancelar' : 'Registrar produção'}
        </button>
      </div>

      {flocks.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre pelo menos um lote ativo antes de registrar produção.
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
            <label className="label">Ovos bons</label>
            <input required type="number" min="0" className="input-field mt-1" value={form.goodEggs}
              onChange={(e) => setForm({ ...form, goodEggs: e.target.value })} />
          </div>
          <div>
            <label className="label">Ovos quebrados</label>
            <input type="number" min="0" className="input-field mt-1" value={form.brokenEggs}
              onChange={(e) => setForm({ ...form, brokenEggs: e.target.value })} />
          </div>
          <div>
            <label className="label">Ovos sujos</label>
            <input type="number" min="0" className="input-field mt-1" value={form.dirtyEggs}
              onChange={(e) => setForm({ ...form, dirtyEggs: e.target.value })} />
          </div>
          <div>
            <label className="label">Ovos descartados</label>
            <input type="number" min="0" className="input-field mt-1" value={form.discardedEggs}
              onChange={(e) => setForm({ ...form, discardedEggs: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observações</label>
            <input className="input-field mt-1" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar produção'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : records.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Registre a primeira coleta de ovos do dia." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Bons</th>
                  <th className="px-4 py-3">Perdas</th>
                  <th className="px-4 py-3">Taxa de postura</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.flock?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{r.goodEggs.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-ink-700">{r.lossPercent}%</td>
                    <td className="px-4 py-3 text-ink-700">{r.layingRate !== null ? `${r.layingRate}%` : '—'}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{r.responsible?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <EditButton onClick={() => openEdit(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingRecord}
        title="Editar produção do dia"
        onClose={() => setEditingRecord(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Ovos bons</label>
          <input required type="number" min="0" className="input-field mt-1" value={editForm.goodEggs}
            onChange={(e) => setEditForm({ ...editForm, goodEggs: e.target.value })} />
        </div>
        <div>
          <label className="label">Ovos quebrados</label>
          <input type="number" min="0" className="input-field mt-1" value={editForm.brokenEggs}
            onChange={(e) => setEditForm({ ...editForm, brokenEggs: e.target.value })} />
        </div>
        <div>
          <label className="label">Ovos sujos</label>
          <input type="number" min="0" className="input-field mt-1" value={editForm.dirtyEggs}
            onChange={(e) => setEditForm({ ...editForm, dirtyEggs: e.target.value })} />
        </div>
        <div>
          <label className="label">Ovos descartados</label>
          <input type="number" min="0" className="input-field mt-1" value={editForm.discardedEggs}
            onChange={(e) => setEditForm({ ...editForm, discardedEggs: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observações</label>
          <input className="input-field mt-1" value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
      </EditModal>
    </div>
  );
}
