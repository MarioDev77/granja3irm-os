'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const SIZE_LABELS = { SMALL: 'Pequeno', MEDIUM: 'Médio', LARGE: 'Grande', EXTRA: 'Extra', JUMBO: 'Jumbo' };
const TYPE_LABELS = { IN: 'Entrada', OUT: 'Saída', SALE: 'Venda', LOSS: 'Perda', BREAKAGE: 'Quebra', RETURN: 'Devolução', ADJUSTMENT: 'Ajuste' };

const emptyForm = { type: 'IN', size: 'LARGE', quantity: '', date: '', reference: '', notes: '' };

export default function EstoqueOvosPage() {
  const [movements, setMovements] = useState([]);
  const [stockBySize, setStockBySize] = useState({});
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
      const res = await fetch('/api/egg-inventory');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMovements(data.movements);
      setStockBySize(data.stockBySize || {});
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar estoque de ovos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(payload) {
    const res = await fetch('/api/egg-inventory', {
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
      toast.success('Movimentação registrada com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setSaving(false);
    }
  }

  // Movimentações do tipo "Venda" nascem automaticamente ao confirmar uma
  // venda (ver módulo Vendas) e não devem ser editadas por aqui, para não
  // ficarem descasadas do pedido de origem.
  function openEdit(movement) {
    setEditingMovement(movement);
    setEditForm({
      type: movement.type || 'IN',
      size: movement.size || 'LARGE',
      quantity: String(movement.quantity ?? ''),
      date: movement.date ? movement.date.slice(0, 10) : '',
      reference: movement.reference || '',
      notes: movement.notes || '',
    });
  }

  async function submitEdit(payload) {
    const res = await fetch(`/api/egg-inventory/${editingMovement.id}`, {
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
          <h1 className="font-display text-2xl text-ink-900">Estoque de ovos</h1>
          <p className="text-sm text-ink-500 mt-1">Estoque atual por classificação e histórico de movimentações.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nova movimentação'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(SIZE_LABELS).map(([size, label]) => (
          <div key={size} className="card p-3 text-center">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="font-display text-xl text-ink-900 mt-1">{(stockBySize[size] || 0).toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo de movimentação</label>
            <select className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Classificação</label>
            <select className="input-field mt-1" value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}>
              {Object.entries(SIZE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantidade</label>
            <input required type="number" className="input-field mt-1" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder={form.type === 'ADJUSTMENT' ? 'Pode ser negativo' : undefined} />
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input-field mt-1" value={form.date}
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
        ) : movements.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Observações</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-ink-700">{TYPE_LABELS[m.type]}</td>
                    <td className="px-4 py-3 text-ink-700">{SIZE_LABELS[m.size]}</td>
                    <td className="px-4 py-3 text-ink-700">{m.quantity.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{m.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {m.type !== 'SALE' && <EditButton onClick={() => openEdit(m)} />}
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
        title="Editar movimentação de estoque de ovos"
        onClose={() => setEditingMovement(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Tipo de movimentação</label>
          <select className="input-field mt-1" value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
            {Object.entries(TYPE_LABELS).filter(([v]) => v !== 'SALE').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Classificação</label>
          <select className="input-field mt-1" value={editForm.size}
            onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}>
            {Object.entries(SIZE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quantidade</label>
          <input required type="number" className="input-field mt-1" value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" className="input-field mt-1" value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
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
