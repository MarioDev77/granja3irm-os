'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';
import EditButton from '@/components/EditButton';
import EditModal from '@/components/EditModal';

const emptyForm = { code: '', name: '', capacity: '', location: '', type: '', notes: '' };
const STATUS_LABELS = { ACTIVE: 'Ativo', MAINTENANCE: 'Manutenção', INACTIVE: 'Inativo' };

function occupancyColor(percent) {
  if (percent >= 95) return 'bg-clay-600';
  if (percent >= 80) return 'bg-egg-500';
  return 'bg-olive-600';
}

export default function GalpoesPage() {
  const [sheds, setSheds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [qrModal, setQrModal] = useState(null);

  const [editingShed, setEditingShed] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm, status: 'ACTIVE' });
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/sheds');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSheds(data.sheds);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar galpões.');
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
      const res = await fetch('/api/sheds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Galpão cadastrado com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar galpão.');
    } finally {
      setSaving(false);
    }
  }

  async function showQrCode(shed) {
    try {
      const res = await fetch(`/api/sheds/${shed.id}/qrcode`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrModal(data);
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar QR Code.');
    }
  }

  function openEdit(shed) {
    setEditingShed(shed);
    setEditForm({
      code: shed.code || '',
      name: shed.name || '',
      capacity: String(shed.capacity ?? ''),
      location: shed.location || '',
      type: shed.type || '',
      status: shed.status || 'ACTIVE',
      notes: shed.notes || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sheds/${editingShed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Galpão atualizado com sucesso.');
      setEditingShed(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar galpão.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Galpões</h1>
          <p className="text-sm text-ink-500 mt-1">Capacidade e ocupação de cada galpão da granja.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo galpão'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Código/número</label>
            <input required className="input-field mt-1" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex.: 01" />
          </div>
          <div>
            <label className="label">Nome</label>
            <input required className="input-field mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Galpão 01" />
          </div>
          <div>
            <label className="label">Capacidade (aves)</label>
            <input required type="number" min="1" className="input-field mt-1" value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <input className="input-field mt-1" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Ex.: Postura" />
          </div>
          <div>
            <label className="label">Localização</label>
            <input className="input-field mt-1" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input-field mt-1" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar galpão'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : sheds.length === 0 ? (
        <EmptyState
          title="Não há dados registrados."
          description="Cadastre o primeiro galpão da granja para começar a organizar lotes e aves."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sheds.map((shed) => (
            <div key={shed.id} className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base text-ink-900">
                  {shed.name} <span className="text-ink-500 text-sm font-sans">({shed.code})</span>
                </h3>
                {shed.occupancyPercent >= 95 && (
                  <span className="text-[10px] uppercase bg-clay-100 text-clay-700 rounded px-1.5 py-0.5">
                    Capacidade crítica
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 mt-1">
                {shed.type || 'Tipo não informado'} {shed.location ? `· ${shed.location}` : ''}
                {shed.status && shed.status !== 'ACTIVE' ? ` · ${STATUS_LABELS[shed.status]}` : ''}
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
                  <span>{shed.currentBirds.toLocaleString('pt-BR')} / {shed.capacity.toLocaleString('pt-BR')} aves</span>
                  <span>{shed.occupancyPercent}%</span>
                </div>
                <div className="h-2 rounded bg-ink-100 overflow-hidden">
                  <div
                    className={`h-full ${occupancyColor(shed.occupancyPercent)}`}
                    style={{ width: `${Math.min(shed.occupancyPercent, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-ink-500">{shed.activeFlockCount} lote(s) ativo(s)</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => showQrCode(shed)} className="text-xs text-olive-700 hover:underline">
                    Ver QR Code
                  </button>
                  <EditButton onClick={() => openEdit(shed)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQrModal(null)}>
          <div className="card p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base text-ink-900 mb-1">{qrModal.shedName}</h3>
            <p className="text-xs text-ink-500 mb-4">
              Escaneie para abrir a página operacional deste galpão direto no celular.
            </p>
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrModal.svg }} />
            <a href={qrModal.url} target="_blank" rel="noreferrer" className="block mt-4 text-xs text-olive-700 hover:underline break-all">
              {qrModal.url}
            </a>
            <button onClick={() => setQrModal(null)} className="btn-secondary mt-4 w-full">Fechar</button>
          </div>
        </div>
      )}

      <EditModal
        open={!!editingShed}
        title="Editar galpão"
        onClose={() => setEditingShed(null)}
        onSubmit={handleEditSubmit}
        saving={editSaving}
      >
        <div>
          <label className="label">Código/número</label>
          <input required className="input-field mt-1" value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
        </div>
        <div>
          <label className="label">Nome</label>
          <input required className="input-field mt-1" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Capacidade (aves)</label>
          <input required type="number" min="1" className="input-field mt-1" value={editForm.capacity}
            onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field mt-1" value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <input className="input-field mt-1" value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
        </div>
        <div>
          <label className="label">Localização</label>
          <input className="input-field mt-1" value={editForm.location}
            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
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
