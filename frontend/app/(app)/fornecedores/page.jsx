'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { name: '', document: '', phone: '', email: '', address: '', products: '', notes: '' };

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuppliers(data.suppliers);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Fornecedor cadastrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar fornecedor.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(supplier) {
    setEditingSupplier(supplier);
    setEditForm({
      name: supplier.name || '',
      document: supplier.document || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      products: supplier.products || '',
      notes: supplier.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Fornecedor atualizado com sucesso.');
      setEditingSupplier(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar fornecedor.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Fornecedores</h1>
          <p className="text-sm text-ink-500 mt-1">Cadastro de fornecedores de insumos.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo fornecedor'}
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
          <div>
            <label className="label">Produtos fornecidos</label>
            <input className="input-field mt-1" value={form.products}
              onChange={(e) => setForm({ ...form, products: e.target.value })} placeholder="Ex.: Ração, vacinas" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : suppliers.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Cadastre o primeiro fornecedor." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Produtos</th>
                  <th className="px-4 py-3">Compras</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{s.name}</td>
                    <td className="px-4 py-3 text-ink-700">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{s.products || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{s._count?.purchases ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <EditButton onClick={() => openEdit(s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingSupplier}
        title="Editar fornecedor"
        onClose={() => setEditingSupplier(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Nome</label>
          <input required className="input-field mt-1" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div>
          <label className="label">CPF/CNPJ</label>
          <input className="input-field mt-1" value={editForm.document}
            onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input-field mt-1" value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input type="email" className="input-field mt-1" value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input-field mt-1" value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Produtos fornecidos</label>
          <input className="input-field mt-1" value={editForm.products}
            onChange={(e) => setEditForm({ ...editForm, products: e.target.value })} />
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
