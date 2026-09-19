'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const STATUS_LABELS = { ACTIVE: 'Ativa', SOLD: 'Vendida', DEAD: 'Morta', DISCARDED: 'Descartada', TRANSFERRED: 'Transferida' };

export default function AvesPage() {
  const [birds, setBirds] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // 'single' | 'bulk' | null
  const [selectedFlock, setSelectedFlock] = useState('');
  const [saving, setSaving] = useState(false);

  const [singleForm, setSingleForm] = useState({ identifier: '', sex: 'UNKNOWN', breed: '', flockId: '' });
  const [bulkForm, setBulkForm] = useState({ flockId: '', quantity: '', prefix: '', sex: 'UNKNOWN', breed: '' });

  async function load() {
    setLoading(true);
    try {
      const url = selectedFlock ? `/api/birds?flockId=${selectedFlock}` : '/api/birds';
      const [birdsRes, flocksRes] = await Promise.all([fetch(url), fetch('/api/flocks')]);
      const birdsData = await birdsRes.json();
      const flocksData = await flocksRes.json();
      if (!birdsRes.ok) throw new Error(birdsData.error);
      setBirds(birdsData.birds);
      setFlocks(flocksData.flocks || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar aves.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlock]);

  async function handleSingleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/birds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', ...singleForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Ave cadastrada com sucesso.');
      setSingleForm({ identifier: '', sex: 'UNKNOWN', breed: '', flockId: '' });
      setMode(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar ave.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/birds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'bulk', ...bulkForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setBulkForm({ flockId: '', quantity: '', prefix: '', sex: 'UNKNOWN', breed: '' });
      setMode(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar aves em lote.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(bird, status) {
    try {
      const res = await fetch(`/api/birds/${bird.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Status atualizado.');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar status.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Aves</h1>
          <p className="text-sm text-ink-500 mt-1">Cadastro individual ou em lote.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setMode(mode === 'single' ? null : 'single')}>
            Cadastro individual
          </button>
          <button className="btn-primary" onClick={() => setMode(mode === 'bulk' ? null : 'bulk')}>
            Cadastro em lote
          </button>
        </div>
      </div>

      {mode === 'single' && (
        <form onSubmit={handleSingleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Identificação</label>
            <input required className="input-field mt-1" value={singleForm.identifier}
              onChange={(e) => setSingleForm({ ...singleForm, identifier: e.target.value })} placeholder="Ex.: A-0001" />
          </div>
          <div>
            <label className="label">Lote</label>
            <select required className="input-field mt-1" value={singleForm.flockId}
              onChange={(e) => setSingleForm({ ...singleForm, flockId: e.target.value })}>
              <option value="">Selecione...</option>
              {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input-field mt-1" value={singleForm.sex}
              onChange={(e) => setSingleForm({ ...singleForm, sex: e.target.value })}>
              <option value="UNKNOWN">Não informado</option>
              <option value="FEMALE">Fêmea</option>
              <option value="MALE">Macho</option>
            </select>
          </div>
          <div>
            <label className="label">Raça</label>
            <input className="input-field mt-1" value={singleForm.breed}
              onChange={(e) => setSingleForm({ ...singleForm, breed: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar ave'}
            </button>
          </div>
        </form>
      )}

      {mode === 'bulk' && (
        <form onSubmit={handleBulkSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Lote</label>
            <select required className="input-field mt-1" value={bulkForm.flockId}
              onChange={(e) => setBulkForm({ ...bulkForm, flockId: e.target.value })}>
              <option value="">Selecione...</option>
              {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantidade</label>
            <input required type="number" min="1" max="5000" className="input-field mt-1" value={bulkForm.quantity}
              onChange={(e) => setBulkForm({ ...bulkForm, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Prefixo das identificações</label>
            <input required className="input-field mt-1" value={bulkForm.prefix}
              onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })} placeholder="Ex.: L2026-01" />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input-field mt-1" value={bulkForm.sex}
              onChange={(e) => setBulkForm({ ...bulkForm, sex: e.target.value })}>
              <option value="UNKNOWN">Não informado</option>
              <option value="FEMALE">Fêmea</option>
              <option value="MALE">Macho</option>
            </select>
          </div>
          <p className="sm:col-span-2 text-xs text-ink-500">
            As identificações serão geradas automaticamente como <code>PREFIXO-0001</code>, <code>PREFIXO-0002</code>...
          </p>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar aves'}
            </button>
          </div>
        </form>
      )}

      <div>
        <label className="label">Filtrar por lote</label>
        <select className="input-field mt-1 max-w-xs" value={selectedFlock} onChange={(e) => setSelectedFlock(e.target.value)}>
          <option value="">Todos os lotes</option>
          {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : birds.length === 0 ? (
          <EmptyState title="Não há dados registrados." description="Cadastre aves individualmente ou em lote." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Identificação</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Sexo</th>
                  <th className="px-4 py-3">Raça</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {birds.slice(0, 200).map((bird) => (
                  <tr key={bird.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{bird.identifier}</td>
                    <td className="px-4 py-3 text-ink-700">{bird.flock?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{bird.sex === 'FEMALE' ? 'Fêmea' : bird.sex === 'MALE' ? 'Macho' : '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{bird.breed || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input-field py-1 text-xs"
                        value={bird.status}
                        onChange={(e) => handleStatusChange(bird, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {birds.length > 200 && (
              <p className="p-3 text-xs text-ink-500">Mostrando as 200 mais recentes. Use o filtro por lote para refinar.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
