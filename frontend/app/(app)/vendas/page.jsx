'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyItem = { product: '', eggSize: '', quantity: '', unitPrice: '' };
const emptyForm = { customerId: '', date: '', paymentMethod: '', dueDate: '', discount: '0', notes: '' };
const STATUS_LABELS = { PENDING: 'Pendente', COMPLETED: 'Confirmada', CANCELED: 'Cancelada' };
const SIZE_LABELS = { SMALL: 'Pequeno', MEDIUM: 'Médio', LARGE: 'Grande', EXTRA: 'Extra', JUMBO: 'Jumbo' };

export default function VendasPage() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([fetch('/api/sales'), fetch('/api/customers')]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      if (!sRes.ok) throw new Error(sData.error);
      setSales(sData.sales);
      setCustomers(cData.customers || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, items: items.map((i) => ({ ...i, eggSize: i.eggSize || null })) };
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Venda registrada com sucesso.');
      setForm(emptyForm);
      setItems([{ ...emptyItem }]);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar venda.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmSale(sale) {
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    let data = await res.json();
    if (!res.ok && data.error?.includes('Apenas um administrador')) {
      const confirmNegative = window.confirm(`${data.error}\n\nAutorizar mesmo assim?`);
      if (confirmNegative) {
        const res2 = await fetch(`/api/sales/${sale.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED', authorizeNegative: true }),
        });
        data = await res2.json();
        if (!res2.ok) return toast.error(data.error);
        toast.success('Venda confirmada. Estoque atualizado.');
        return load();
      }
      return;
    }
    if (!res.ok) return toast.error(data.error);
    toast.success('Venda confirmada. Estoque atualizado.');
    load();
  }

  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = Math.max(0, itemsTotal - (Number(form.discount) || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Vendas</h1>
          <p className="text-sm text-ink-500 mt-1">
            Ao confirmar, o estoque de ovos é atualizado automaticamente (para itens marcados como ovos).
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={customers.length === 0}>
          {showForm ? 'Cancelar' : 'Nova venda'}
        </button>
      </div>

      {customers.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre um cliente antes de registrar uma venda.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente</label>
              <select required className="input-field mt-1" value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Selecione...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data</label>
              <input required type="date" className="input-field mt-1" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Forma de pagamento</label>
              <input className="input-field mt-1" value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} />
            </div>
            <div>
              <label className="label">Vencimento (gera conta a receber)</label>
              <input type="date" className="input-field mt-1" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Desconto (R$)</label>
              <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
          </div>

          <div>
            <p className="label mb-2">Itens da venda</p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-ink-500">Produto</label>
                    <input required className="input-field mt-1" value={item.product}
                      onChange={(e) => updateItem(index, 'product', e.target.value)} placeholder="Ex.: Ovos grandes" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Classificação (se ovos)</label>
                    <select className="input-field mt-1" value={item.eggSize}
                      onChange={(e) => updateItem(index, 'eggSize', e.target.value)}>
                      <option value="">Não é ovo</option>
                      {Object.entries(SIZE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Quantidade</label>
                    <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Preço unitário (R$)</label>
                    <input required type="number" min="0" step="0.01" className="input-field mt-1" value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button type="button" className="text-xs text-olive-700 hover:underline"
                onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>
                + Adicionar item
              </button>
              {items.length > 1 && (
                <button type="button" className="text-xs text-clay-700 hover:underline"
                  onClick={() => setItems((prev) => prev.slice(0, -1))}>
                  Remover último item
                </button>
              )}
            </div>
            <p className="text-sm mt-3 text-ink-700"><strong>Total estimado: R$ {total.toFixed(2)}</strong></p>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar venda'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : sales.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{s.customer?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{s.items.length} item(ns)</td>
                    <td className="px-4 py-3 text-ink-700">R$ {Number(s.totalValue).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        s.status === 'COMPLETED' ? 'bg-olive-100 text-olive-700' :
                        s.status === 'CANCELED' ? 'bg-clay-100 text-clay-700' : 'bg-egg-400/20 text-ink-700'
                      }`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'PENDING' && (
                        <button onClick={() => confirmSale(s)} className="text-xs text-olive-700 hover:underline">
                          Confirmar venda
                        </button>
                      )}
                    </td>
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
