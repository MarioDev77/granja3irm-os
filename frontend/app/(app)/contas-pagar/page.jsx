'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { description: '', category: '', value: '', dueDate: '', paymentMethod: '', notes: '' };
const STATUS_LABELS = { OPEN: 'Em aberto', PAID: 'Paga', OVERDUE: 'Vencida', CANCELED: 'Cancelada' };
const STATUS_STYLE = {
  OPEN: 'bg-egg-400/20 text-ink-700', PAID: 'bg-olive-100 text-olive-700',
  OVERDUE: 'bg-clay-100 text-clay-700', CANCELED: 'bg-ink-100 text-ink-500',
};

export default function ContasPagarPage() {
  const [payables, setPayables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingPayable, setEditingPayable] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts-payable');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayables(data.payables);
      setCategories(data.categories || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar contas a pagar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounts-payable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta a pagar registrada.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar conta.');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(payable) {
    try {
      const res = await fetch(`/api/accounts-payable/${payable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta marcada como paga.');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar conta.');
    }
  }

  function openEdit(payable) {
    setEditingPayable(payable);
    setEditForm({
      description: payable.description || '',
      category: payable.category || '',
      value: String(payable.value ?? ''),
      dueDate: payable.dueDate ? payable.dueDate.slice(0, 10) : '',
      paymentMethod: payable.paymentMethod || '',
      notes: payable.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/accounts-payable/${editingPayable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta a pagar atualizada com sucesso.');
      setEditingPayable(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar conta.');
    } finally {
      setEditSaving(false);
    }
  }

  const totalOpen = payables.filter((p) => p.status === 'OPEN' || p.status === 'OVERDUE')
    .reduce((s, p) => s + Number(p.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Contas a pagar</h1>
          <p className="text-sm text-ink-500 mt-1">Total em aberto: <strong>R$ {totalOpen.toFixed(2)}</strong></p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Nova conta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Descrição</label>
            <input required className="input-field mt-1" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select required className="input-field mt-1" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Selecione...</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div>
            <label className="label">Vencimento</label>
            <input required type="date" className="input-field mt-1" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Forma de pagamento</label>
            <input className="input-field mt-1" value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar conta'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : payables.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payables.map((p) => (
                  <tr key={p.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(p.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{p.description}</td>
                    <td className="px-4 py-3 text-ink-700">{p.category}</td>
                    <td className="px-4 py-3 text-ink-700">R$ {Number(p.value).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_STYLE[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {(p.status === 'OPEN' || p.status === 'OVERDUE') && (
                          <button onClick={() => markPaid(p)} className="text-xs text-olive-700 hover:underline">
                            Marcar como paga
                          </button>
                        )}
                        <EditButton onClick={() => openEdit(p)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingPayable}
        title="Editar conta a pagar"
        onClose={() => setEditingPayable(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <input required className="input-field mt-1" value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Categoria</label>
          <select required className="input-field mt-1" value={editForm.category}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
            <option value="">Selecione...</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Valor (R$)</label>
          <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={editForm.value}
            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} />
        </div>
        <div>
          <label className="label">Vencimento</label>
          <input required type="date" className="input-field mt-1" value={editForm.dueDate}
            onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Forma de pagamento</label>
          <input className="input-field mt-1" value={editForm.paymentMethod}
            onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })} />
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
