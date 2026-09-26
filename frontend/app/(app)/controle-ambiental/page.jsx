'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const emptyForm = { shedId: '', temperature: '', humidity: '', ventilation: '', lighting: '', waterQuality: '' };

export default function ControleAmbientalPage() {
  const [records, setRecords] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [sheds, setSheds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tokenModal, setTokenModal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([fetch('/api/environmental-records'), fetch('/api/sheds')]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      if (!rRes.ok) throw new Error(rData.error);
      setRecords(rData.records);
      setThresholds(rData.thresholds);
      setSheds(sData.sheds || []);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar controle ambiental.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/environmental-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.alertTriggered ? 'Leitura registrada. Limite ultrapassado — alerta gerado.' : 'Leitura registrada com sucesso.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar leitura.');
    } finally {
      setSaving(false);
    }
  }

  async function generateToken(shed) {
    try {
      const res = await fetch(`/api/sheds/${shed.id}/device-token`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTokenModal({ shed, token: data.deviceToken });
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar token.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Controle ambiental</h1>
          <p className="text-sm text-ink-500 mt-1">
            Temperatura, umidade e outras condições por galpão. Limites configuráveis em Configurações.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} disabled={sheds.length === 0}>
          {showForm ? 'Cancelar' : 'Nova leitura'}
        </button>
      </div>

      {sheds.length === 0 && !loading && (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Cadastre pelo menos um galpão antes de registrar uma leitura.
        </div>
      )}

      {thresholds && (thresholds.maxTemperature || thresholds.minTemperature || thresholds.maxHumidity || thresholds.minHumidity) && (
        <div className="card p-4 text-sm text-ink-700 flex flex-wrap gap-4">
          {thresholds.maxTemperature && <span>Temp. máx.: <strong>{Number(thresholds.maxTemperature)}°C</strong></span>}
          {thresholds.minTemperature && <span>Temp. mín.: <strong>{Number(thresholds.minTemperature)}°C</strong></span>}
          {thresholds.maxHumidity && <span>Umidade máx.: <strong>{Number(thresholds.maxHumidity)}%</strong></span>}
          {thresholds.minHumidity && <span>Umidade mín.: <strong>{Number(thresholds.minHumidity)}%</strong></span>}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Galpão</label>
            <select required className="input-field mt-1" value={form.shedId}
              onChange={(e) => setForm({ ...form, shedId: e.target.value })}>
              <option value="">Selecione...</option>
              {sheds.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Temperatura (°C)</label>
            <input type="number" step="0.1" className="input-field mt-1" value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
          </div>
          <div>
            <label className="label">Umidade (%)</label>
            <input type="number" step="0.1" className="input-field mt-1" value={form.humidity}
              onChange={(e) => setForm({ ...form, humidity: e.target.value })} />
          </div>
          <div>
            <label className="label">Ventilação</label>
            <input className="input-field mt-1" value={form.ventilation}
              onChange={(e) => setForm({ ...form, ventilation: e.target.value })} placeholder="Ex.: Ligada, nível 2" />
          </div>
          <div>
            <label className="label">Iluminação</label>
            <input className="input-field mt-1" value={form.lighting}
              onChange={(e) => setForm({ ...form, lighting: e.target.value })} />
          </div>
          <div>
            <label className="label">Qualidade da água</label>
            <input className="input-field mt-1" value={form.waterQuality}
              onChange={(e) => setForm({ ...form, waterQuality: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar leitura'}
            </button>
          </div>
        </form>
      )}

      {sheds.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-medium text-ink-900 mb-2">Sensores IoT (opcional)</h2>
          <p className="text-xs text-ink-500 mb-3">
            Gere um token por galpão para que um sensor físico envie leituras automaticamente via API, sem
            precisar de login. Requer um dispositivo compatível — a rota de ingestão já está pronta e
            funcional (<code>POST /api/iot/environmental-records</code>).
          </p>
          <div className="flex flex-wrap gap-2">
            {sheds.map((s) => (
              <button key={s.id} onClick={() => generateToken(s)} className="btn-secondary text-xs">
                Gerar token — {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : records.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Galpão</th>
                  <th className="px-4 py-3">Temp.</th>
                  <th className="px-4 py-3">Umidade</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-ink-300/30">
                    <td className="px-4 py-3 text-ink-700">{new Date(r.recordedAt).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.shed?.name}</td>
                    <td className="px-4 py-3 text-ink-700">{r.temperature !== null ? `${Number(r.temperature)}°C` : '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{r.humidity !== null ? `${Number(r.humidity)}%` : '—'}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{r.source === 'SENSOR' ? 'Sensor' : 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTokenModal(null)}>
          <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base text-ink-900 mb-2">Token do galpão {tokenModal.shed.name}</h3>
            <p className="text-xs text-ink-500 mb-3">
              Copie este token agora — ele não será mostrado novamente. Configure-o no seu sensor para enviar
              leituras via <code>POST /api/iot/environmental-records</code> com o header{' '}
              <code>x-device-token</code>.
            </p>
            <code className="block break-all bg-ink-100 rounded p-3 text-xs">{tokenModal.token}</code>
            <button onClick={() => setTokenModal(null)} className="btn-secondary mt-4 w-full">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
