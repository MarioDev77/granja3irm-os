'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { customerId: '', value: '', dueDate: '' };
const STATUS_LABELS = { OPEN: 'Em aberto', RECEIVED: 'Recebida', OVERDUE: 'Vencida', CANCELED: 'Cancelada' };
const STATUS_STYLE = {
  OPEN: 'bg-egg-400/20 text-ink-700', RECEIVED: 'bg-olive-100 text-olive-700',
  OVERDUE: 'bg-clay-100 text-clay-700', CANCELED: 'bg-ink-100 text-ink-500',
};

export default function ContasReceberPage() {
  const [receivables, setReceivables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingReceivable, setEditingReceivable] = useState(null);
  const [editForm, setEditForm] = useState({ value: '', dueDate: '' });
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([fetch('/api/accounts-receivable'), fetch('/api/customers')]);
      const rData = await rRes.json();
      const cData = await cRes.json();
      if (!rRes.ok) throw new Error(rData.error);
      setReceivables(rData.receivables);
      setCustomers(cData.customers || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar contas a receber.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounts-receivable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta a receber registrada.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar conta.');
    } finally {
      setSaving(false);
    }
  }

  async function markReceived(r) {
    try {
      const res = await fetch(`/api/accounts-receivable/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta marcada como recebida.');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar conta.');
    }
  }

  // Cliente vinculado não pode ser trocado (a conta nasce junto com a
  // venda/lançamento original) — apenas valor e vencimento são corrigíveis.
  function openEdit(receivable) {
    setEditingReceivable(receivable);
    setEditForm({
      value: String(receivable.value ?? ''),
      dueDate: receivable.dueDate ? receivable.dueDate.slice(0, 10) : '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/accounts-receivable/${editingReceivable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conta a receber atualizada com sucesso.');
      setEditingReceivable(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar conta.');
    } finally {
      setEditSaving(false);
    }
  }

  const totalOpen = receivables.filter((r) => r.status === 'OPEN' || r.status === 'OVERDUE')
    .reduce((s, r) => s + Number(r.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Contas a receber</h1>
          <p className="text-sm text-ink-500 mt-1">Total em aberto: <strong>R$ {totalOpen.toFixed(2)}</strong></p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={customers.length === 0}>
          {showForm ? 'Cancelar' : 'Nova conta'}
        </button>
      </div>

      {customers.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre um cliente antes de lançar uma conta a receber.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Cliente</label>
            <select required className="input-field mt-1" value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Selecione...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        ) : receivables.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.customer?.name}</td>
                    <td className="px-4 py-3 text-ink-700">R$ {Number(r.value).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {(r.status === 'OPEN' || r.status === 'OVERDUE') && (
                          <button onClick={() => markReceived(r)} className="text-xs text-olive-700 hover:underline">
                            Marcar como recebida
                          </button>
                        )}
                        <EditButton onClick={() => openEdit(r)} />
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
        open={!!editingReceivable}
        title="Editar conta a receber"
        onClose={() => setEditingReceivable(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
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
      </EditModal>
    </div>
  );
}
