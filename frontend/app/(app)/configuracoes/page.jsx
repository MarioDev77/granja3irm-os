'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ConfiguracoesPage() {
  const [form, setForm] = useState({
    name: '', document: '', address: '',
    maxTemperature: '', minTemperature: '', maxHumidity: '', minHumidity: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/farm')
      .then((res) => res.json())
      .then((data) => {
        if (data.farm) {
          setForm({
            name: data.farm.name || '',
            document: data.farm.document || '',
            address: data.farm.address || '',
            maxTemperature: data.farm.maxTemperature ?? '',
            minTemperature: data.farm.minTemperature ?? '',
            maxHumidity: data.farm.maxHumidity ?? '',
            minHumidity: data.farm.minHumidity ?? '',
          });
        }
      })
      .catch(() => toast.error('Erro ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/farm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Dados da granja atualizados.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-2xl text-ink-900">Configurações</h1>
        <p className="text-sm text-ink-500 mt-1">Dados gerais da granja usados em relatórios e no sistema.</p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div>
            <label className="label">Nome da granja</label>
            <input
              required
              className="input-field mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">CPF/CNPJ</label>
            <input
              className="input-field mt-1"
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input
              className="input-field mt-1"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {!loading && (
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink-900 mb-1">Limites ambientais</h2>
          <p className="text-sm text-ink-500 mb-4">
            Usados para gerar alertas automáticos no Controle ambiental. Deixe em branco para não checar aquele limite.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Temperatura máxima (°C)</label>
              <input type="number" step="0.1" className="input-field mt-1" value={form.maxTemperature}
                onChange={(e) => setForm({ ...form, maxTemperature: e.target.value })} />
            </div>
            <div>
              <label className="label">Temperatura mínima (°C)</label>
              <input type="number" step="0.1" className="input-field mt-1" value={form.minTemperature}
                onChange={(e) => setForm({ ...form, minTemperature: e.target.value })} />
            </div>
            <div>
              <label className="label">Umidade máxima (%)</label>
              <input type="number" step="0.1" className="input-field mt-1" value={form.maxHumidity}
                onChange={(e) => setForm({ ...form, maxHumidity: e.target.value })} />
            </div>
            <div>
              <label className="label">Umidade mínima (%)</label>
              <input type="number" step="0.1" className="input-field mt-1" value={form.minHumidity}
                onChange={(e) => setForm({ ...form, minHumidity: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Salvando...' : 'Salvar limites'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg text-ink-900 mb-1">Mais configurações</h2>
        <p className="text-sm text-ink-500">
          Limites de estoque, mortalidade, parâmetros ambientais, categorias e unidades serão habilitados
          aqui conforme os módulos correspondentes forem implementados nas próximas fases.
        </p>
      </div>
    </div>
  );
}
