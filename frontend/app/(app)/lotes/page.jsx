'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = {
  code: '', name: '', shedId: '', entryDate: '', birthDate: '',
  breed: '', initialQuantity: '', origin: '', productionType: '', notes: '',
};

const STATUS_LABELS = { ACTIVE: 'Ativo', CLOSED: 'Encerrado', SOLD: 'Vendido', TRANSFERRED: 'Transferido' };

export default function LotesPage() {
  const [flocks, setFlocks] = useState([]);
  const [sheds, setSheds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingFlock, setEditingFlock] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', shedId: '', breed: '', status: 'ACTIVE', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [flocksRes, shedsRes] = await Promise.all([fetch('/api/flocks'), fetch('/api/sheds')]);
      const flocksData = await flocksRes.json();
      const shedsData = await shedsRes.json();
      if (!flocksRes.ok) throw new Error(flocksData.error);
      setFlocks(flocksData.flocks);
      setSheds(shedsData.sheds || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar lotes.');
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
      const res = await fetch('/api/flocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Lote cadastrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar lote.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(flock, status) {
    try {
      const res = await fetch(`/api/flocks/${flock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Status do lote atualizado.');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar status.');
    }
  }

  function openEdit(flock) {
    setEditingFlock(flock);
    setEditForm({
      name: flock.name || '',
      shedId: flock.shedId || flock.shed?.id || '',
      breed: flock.breed || '',
      status: flock.status || 'ACTIVE',
      notes: flock.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/flocks/${editingFlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Lote atualizado com sucesso.');
      setEditingFlock(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar lote.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Lotes</h1>
          <p className="text-sm text-ink-500 mt-1">Acompanhe idade, produção e mortalidade por lote.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={sheds.length === 0}>
          {showForm ? 'Cancelar' : 'Novo lote'}
        </button>
      </div>

      {sheds.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre pelo menos um galpão antes de criar um lote.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Código do lote</label>
            <input required className="input-field mt-1" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex.: L-2026-01" />
          </div>
          <div>
            <label className="label">Nome</label>
            <input required className="input-field mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Galpão</label>
            <select required className="input-field mt-1" value={form.shedId}
              onChange={(e) => setForm({ ...form, shedId: e.target.value })}>
              <option value="">Selecione...</option>
              {sheds.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantidade inicial</label>
            <input required type="number" min="1" className="input-field mt-1" value={form.initialQuantity}
              onChange={(e) => setForm({ ...form, initialQuantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Data de entrada</label>
            <input required type="date" className="input-field mt-1" value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Data de nascimento</label>
            <input type="date" className="input-field mt-1" value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Raça</label>
            <input className="input-field mt-1" value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div>
            <label className="label">Origem</label>
            <input className="input-field mt-1" value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo de produção</label>
            <input className="input-field mt-1" value={form.productionType}
              onChange={(e) => setForm({ ...form, productionType: e.target.value })} placeholder="Ex.: Postura" />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input-field mt-1" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar lote'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : flocks.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Cadastre o primeiro lote da granja." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Galpão</th>
                  <th className="px-4 py-3">Idade</th>
                  <th className="px-4 py-3">Aves ativas</th>
                  <th className="px-4 py-3">Produção acum.</th>
                  <th className="px-4 py-3">Mortalidade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {flocks.map((flock) => (
                  <tr key={flock.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{flock.name} <span className="text-ink-500 text-xs">({flock.code})</span></td>
                    <td className="px-4 py-3 text-ink-700">{flock.shed?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{flock.ageDays} dias</td>
                    <td className="px-4 py-3 text-ink-700">{flock.activeBirds.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-ink-700">{flock.totalEggs.toLocaleString('pt-BR')} ovos</td>
                    <td className="px-4 py-3 text-ink-700">{flock.mortalityTotal} ({flock.mortalityRate}%)</td>
                    <td className="px-4 py-3">
                      <select
                        className="input-field py-1 text-xs"
                        value={flock.status}
                        onChange={(e) => handleStatusChange(flock, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <EditButton onClick={() => openEdit(flock)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditModal
        open={!!editingFlock}
        title="Editar lote"
        onClose={() => setEditingFlock(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Nome</label>
          <input required className="input-field mt-1" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Galpão</label>
          <select required className="input-field mt-1" value={editForm.shedId}
            onChange={(e) => setEditForm({ ...editForm, shedId: e.target.value })}>
            {sheds.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Raça</label>
          <input className="input-field mt-1" value={editForm.breed}
            onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field mt-1" value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
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
