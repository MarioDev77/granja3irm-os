'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';
import { ROLE_LABELS } from '@/lib/rbac';

const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE'];

const emptyForm = { name: '', email: '', password: '', role: 'EMPLOYEE', phone: '' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', password: '' });
  const [editSaving, setEditSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Usuário criado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle(user) {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(nextStatus === 'ACTIVE' ? 'Usuário ativado.' : 'Usuário desativado.');
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar usuário.');
    }
  }

  async function handleRoleChange(user, role) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Perfil atualizado.');
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar perfil.');
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Usuário excluído.');
      setConfirmDeleteId(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir usuário.');
    }
  }

  // Perfil e status já podem ser trocados direto na tabela; o modal cobre o
  // que faltava: nome, telefone e redefinição de senha.
  function openEdit(user) {
    setEditingUser(user);
    setEditForm({ name: user.name || '', phone: user.phone || '', password: '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload = { name: editForm.name, phone: editForm.phone };
      if (editForm.password) payload.password = editForm.password;
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Usuário atualizado com sucesso.');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar usuário.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Usuários</h1>
          <p className="text-sm text-ink-500 mt-1">Gerencie quem tem acesso ao sistema e com qual perfil.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo usuário'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome completo</label>
            <input
              required
              className="input-field mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              required
              className="input-field mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Senha provisória</label>
            <input
              type="password"
              required
              minLength={8}
              className="input-field mt-1"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Perfil</label>
            <select
              className="input-field mt-1"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Telefone (opcional)</label>
            <input
              className="input-field mt-1"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Não há dados registrados."
            description="Ainda não existem outros usuários cadastrados além da sua conta."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{user.name}</td>
                    <td className="px-4 py-3 text-ink-700">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input-field py-1"
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleStatusToggle(user)}
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          user.status === 'ACTIVE'
                            ? 'bg-olive-100 text-olive-700'
                            : 'bg-clay-100 text-clay-700'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca acessou'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeleteId === user.id ? (
                        <span className="inline-flex gap-2">
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-xs text-white bg-clay-600 hover:bg-clay-700 rounded px-2 py-1"
                          >
                            Confirmar exclusão
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-ink-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <EditButton onClick={() => openEdit(user)} />
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            className="text-xs text-clay-700 hover:underline"
                          >
                            Excluir
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingUser}
        title="Editar usuário"
        onClose={() => setEditingUser(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Nome completo</label>
          <input required className="input-field mt-1" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input-field mt-1" value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nova senha (opcional)</label>
          <input type="password" minLength={8} className="input-field mt-1" value={editForm.password}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            placeholder="Deixe em branco para manter a senha atual" />
        </div>
      </EditModal>
    </div>
  );
}
