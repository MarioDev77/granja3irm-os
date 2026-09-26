'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { vaccine: '', flockId: '', date: '', quantity: '', nextDoseDate: '', notes: '' };

export default function VacinacaoPage() {
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
      const [vRes, fRes] = await Promise.all([fetch('/api/vaccinations'), fetch('/api/flocks')]);
      const vData = await vRes.json();
      const fData = await fRes.json();
      if (!vRes.ok) throw new Error(vData.error);
      setRecords(vData.vaccinations);
      setFlocks((fData.flocks || []).filter((f) => f.status === 'ACTIVE'));
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar vacinações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/vaccinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Vacinação registrada com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar vacinação.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(record) {
    setEditingRecord(record);
    setEditForm({
      vaccine: record.vaccine || '',
      flockId: record.flockId || record.flock?.id || '',
      date: record.date ? record.date.slice(0, 10) : '',
      quantity: String(record.quantity ?? ''),
      nextDoseDate: record.nextDoseDate ? record.nextDoseDate.slice(0, 10) : '',
      notes: record.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/vaccinations/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Vacinação atualizada com sucesso.');
      setEditingRecord(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar vacinação.');
    } finally {
      setEditSaving(false);
    }
  }

  const today = new Date();
  const upcoming = records.filter((r) => r.nextDoseDate && new Date(r.nextDoseDate) >= today &&
    new Date(r.nextDoseDate) <= new Date(today.getTime() + 7 * 86_400_000));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Vacinação</h1>
          <p className="text-sm text-ink-500 mt-1">Histórico de vacinas aplicadas e próximas doses.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={flocks.length === 0}>
          {showForm ? 'Cancelar' : 'Registrar vacinação'}
        </button>
      </div>

      {flocks.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre pelo menos um lote ativo antes de registrar uma vacinação.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card p-4 bg-egg-400/10 border-egg-500 text-sm text-ink-700">
          <strong>{upcoming.length}</strong> próxima(s) dose(s) nos próximos 7 dias.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vacina</label>
            <input required className="input-field mt-1" value={form.vaccine}
              onChange={(e) => setForm({ ...form, vaccine: e.target.value })} />
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
            <label className="label">Data de aplicação</label>
            <input required type="date" className="input-field mt-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Quantidade aplicada</label>
            <input required type="number" min="1" className="input-field mt-1" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Próxima aplicação</label>
            <input type="date" className="input-field mt-1" value={form.nextDoseDate}
              onChange={(e) => setForm({ ...form, nextDoseDate: e.target.value })} />
          </div>
          <div>
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
                  <th className="px-4 py-3">Vacina</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Próxima dose</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.vaccine}</td>
                    <td className="px-4 py-3 text-ink-700">{r.flock?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{r.quantity}</td>
                    <td className="px-4 py-3 text-ink-700">{r.nextDoseDate ? new Date(r.nextDoseDate).toLocaleDateString('pt-BR') : '—'}</td>
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
        title="Editar vacinação"
        onClose={() => setEditingRecord(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Vacina</label>
          <input required className="input-field mt-1" value={editForm.vaccine}
            onChange={(e) => setEditForm({ ...editForm, vaccine: e.target.value })} />
        </div>
        <div>
          <label className="label">Lote</label>
          <select required className="input-field mt-1" value={editForm.flockId}
            onChange={(e) => setEditForm({ ...editForm, flockId: e.target.value })}>
            {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Data de aplicação</label>
          <input required type="date" className="input-field mt-1" value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
        </div>
        <div>
          <label className="label">Quantidade aplicada</label>
          <input required type="number" min="1" className="input-field mt-1" value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">Próxima aplicação</label>
          <input type="date" className="input-field mt-1" value={editForm.nextDoseDate}
            onChange={(e) => setEditForm({ ...editForm, nextDoseDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Observações</label>
          <input className="input-field mt-1" value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
      </EditModal>
    </div>
  );
}
