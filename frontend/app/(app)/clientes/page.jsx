'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { name: '', document: '', phone: '', email: '', address: '', type: 'INDIVIDUAL', notes: '' };
const TYPE_LABELS = {
  INDIVIDUAL: 'Pessoa física', MARKET: 'Mercado', RESTAURANT: 'Restaurante',
  DISTRIBUTOR: 'Distribuidor', WHOLESALER: 'Atacadista', FAIR: 'Feira', OTHER: 'Outro',
};

export default function ClientesPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomers(data.customers);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Cliente cadastrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Clientes</h1>
          <p className="text-sm text-ink-500 mt-1">Cadastro de clientes para vendas.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo cliente'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome</label>
            <input required className="input-field mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">CPF/CNPJ</label>
            <input className="input-field mt-1" value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input-field mt-1" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input-field mt-1" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input-field mt-1" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : customers.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Cadastre o primeiro cliente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                    <td className="px-4 py-3 text-ink-700">{TYPE_LABELS[c.type]}</td>
                    <td className="px-4 py-3 text-ink-700">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{c._count?.sales ?? 0}</td>
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
