'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { feedId: '', type: 'IN', quantity: '', unitValue: '', document: '', date: '', notes: '' };

export default function EstoqueRacaoPage() {
  const [movements, setMovements] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingMovement, setEditingMovement] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [movRes, feedRes] = await Promise.all([fetch('/api/feed-movements'), fetch('/api/feeds')]);
      const movData = await movRes.json();
      const feedData = await feedRes.json();
      if (!movRes.ok) throw new Error(movData.error);
      setMovements(movData.movements);
      setFeeds(feedData.feeds || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar estoque.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(payload) {
    const res = await fetch('/api/feed-movements', {
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
        const confirmNegative = window.confirm(
          `${data.error}\n\nVocê é administrador e deseja autorizar mesmo assim?`
        );
        if (confirmNegative) {
          ({ res, data } = await submit({ ...form, authorizeNegative: true }));
        }
      }
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.stockAlertTriggered ? 'Movimentação registrada. Estoque crítico!' : 'Movimentação registrada com sucesso.'
      );
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(movement) {
    setEditingMovement(movement);
    setEditForm({
      feedId: movement.feedId || movement.feed?.id || '',
      type: movement.type || 'IN',
      quantity: String(movement.quantity ?? ''),
      unitValue: movement.unitValue !== null && movement.unitValue !== undefined ? String(movement.unitValue) : '',
      document: movement.document || '',
      date: movement.date ? movement.date.slice(0, 10) : '',
      notes: movement.notes || '',
    });
  }

  async function submitEdit(payload) {
    const res = await fetch(`/api/feed-movements/${editingMovement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { res, data: await res.json() };
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      let { res, data } = await submitEdit(editForm);
      if (!res.ok && data.error?.includes('Apenas um administrador')) {
        const confirmNegative = window.confirm(`${data.error}\n\nAutorizar mesmo assim?`);
        if (confirmNegative) ({ res, data } = await submitEdit({ ...editForm, authorizeNegative: true }));
      }
      if (!res.ok) throw new Error(data.error);
      toast.success('Movimentação atualizada com sucesso. Estoque recalculado.');
      setEditingMovement(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar movimentação.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Estoque de ração</h1>
          <p className="text-sm text-ink-500 mt-1">Entradas e saídas de ração.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={feeds.length === 0}>
          {showForm ? 'Cancelar' : 'Nova movimentação'}
        </button>
      </div>

      {feeds.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre uma ração antes de registrar movimentações de estoque.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Ração</label>
            <select required className="input-field mt-1" value={form.feedId}
              onChange={(e) => setForm({ ...form, feedId: e.target.value })}>
              <option value="">Selecione...</option>
              {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </select>
          </div>
          <div>
            <label className="label">Quantidade</label>
            <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Data</label>
            <input required type="date" className="input-field mt-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          {form.type === 'IN' && (
            <>
              <div>
                <label className="label">Valor unitário (R$)</label>
                <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.unitValue}
                  onChange={(e) => setForm({ ...form, unitValue: e.target.value })} />
              </div>
              <div>
                <label className="label">Nota/documento</label>
                <input className="input-field mt-1" value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })} />
              </div>
            </>
          )}
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
        ) : movements.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Ração</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{m.feed?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${m.type === 'IN' ? 'bg-olive-100 text-olive-700' : 'bg-clay-100 text-clay-700'}`}>
                        {m.type === 'IN' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{Number(m.quantity).toLocaleString('pt-BR')} {m.feed?.unit}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{m.responsible?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <EditButton onClick={() => openEdit(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingMovement}
        title="Editar movimentação de ração"
        onClose={() => setEditingMovement(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Ração</label>
          <select required className="input-field mt-1" value={editForm.feedId}
            onChange={(e) => setEditForm({ ...editForm, feedId: e.target.value })}>
            {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input-field mt-1" value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
            <option value="IN">Entrada</option>
            <option value="OUT">Saída</option>
          </select>
        </div>
        <div>
          <label className="label">Quantidade</label>
          <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">Data</label>
          <input required type="date" className="input-field mt-1" value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
        </div>
        {editForm.type === 'IN' && (
          <>
            <div>
              <label className="label">Valor unitário (R$)</label>
              <input type="number" min="0" step="0.01" className="input-field mt-1" value={editForm.unitValue}
                onChange={(e) => setEditForm({ ...editForm, unitValue: e.target.value })} />
            </div>
            <div>
              <label className="label">Nota/documento</label>
              <input className="input-field mt-1" value={editForm.document}
                onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <label className="label">Observações</label>
          <input className="input-field mt-1" value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
        <p className="sm:col-span-2 text-xs text-ink-500">
          Alterar tipo, quantidade ou ração recalcula automaticamente o estoque.
        </p>
      </EditModal>
    </div>
  );
}
