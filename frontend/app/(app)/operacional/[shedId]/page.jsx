'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function OperacionalShedPage() {
  const { shedId } = useParams();
  const [shed, setShed] = useState(null);
  const [flocks, setFlocks] = useState([]);
  const [flockId, setFlockId] = useState('');
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'producao' | 'alimentacao' | 'mortalidade' | 'ocorrencia'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [shedsRes, flocksRes, feedsRes] = await Promise.all([
          fetch('/api/sheds'), fetch('/api/flocks'), fetch('/api/feeds'),
        ]);
        const shedsData = await shedsRes.json();
        const flocksData = await flocksRes.json();
        const feedsData = await feedsRes.json();
        const currentShed = (shedsData.sheds || []).find((s) => s.id === shedId);
        setShed(currentShed || null);
        const shedFlocks = (flocksData.flocks || []).filter((f) => f.shed && currentShed && f.status === 'ACTIVE' && f.shed.code === currentShed.code);
        setFlocks(shedFlocks);
        if (shedFlocks.length === 1) setFlockId(shedFlocks[0].id);
        setFeeds(feedsData.feeds || []);
      } catch {
        toast.error('Erro ao carregar dados do galpão.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shedId]);

  if (loading) return <p className="text-sm text-ink-500 p-4">Carregando...</p>;
  if (!shed) return <p className="text-sm text-clay-700 p-4">Galpão não encontrado.</p>;

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div>
        <h1 className="font-display text-2xl text-ink-900">{shed.name}</h1>
        <p className="text-sm text-ink-500">Acesso rápido — selecione o que deseja registrar.</p>
      </div>

      {flocks.length === 0 ? (
        <div className="card p-4 text-sm text-clay-700 bg-clay-50 border-clay-300">
          Nenhum lote ativo neste galpão no momento.
        </div>
      ) : flocks.length > 1 && !action && (
        <div>
          <label className="label">Lote</label>
          <select className="input-field mt-1" value={flockId} onChange={(e) => setFlockId(e.target.value)}>
            <option value="">Selecione...</option>
            {flocks.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
          </select>
        </div>
      )}

      {!action && flocks.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <BigButton label="Registrar produção" onClick={() => setAction('producao')} />
          <BigButton label="Registrar alimentação" onClick={() => setAction('alimentacao')} />
          <BigButton label="Registrar mortalidade" onClick={() => setAction('mortalidade')} />
          <BigButton label="Registrar ocorrência" onClick={() => setAction('ocorrencia')} />
        </div>
      )}

      {action === 'producao' && (
        <QuickProduction flockId={flockId} onDone={() => setAction(null)} setSaving={setSaving} saving={saving} />
      )}
      {action === 'alimentacao' && (
        <QuickFeed flockId={flockId} feeds={feeds} onDone={() => setAction(null)} setSaving={setSaving} saving={saving} />
      )}
      {action === 'mortalidade' && (
        <QuickMortality flockId={flockId} onDone={() => setAction(null)} setSaving={setSaving} saving={saving} />
      )}
      {action === 'ocorrencia' && (
        <QuickOccurrence flockId={flockId} onDone={() => setAction(null)} setSaving={setSaving} saving={saving} />
      )}
    </div>
  );
}

function BigButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="card p-6 text-center font-medium text-ink-900 hover:bg-olive-50 transition-colors">
      {label}
    </button>
  );
}

function QuickProduction({ flockId, onDone, saving, setSaving }) {
  const [goodEggs, setGoodEggs] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/egg-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY(), flockId, goodEggs, brokenEggs: 0, dirtyEggs: 0, discardedEggs: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Produção registrada com sucesso.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <label className="label">Ovos bons coletados hoje</label>
      <input required autoFocus type="number" min="0" className="input-field text-2xl py-4 text-center" value={goodEggs}
        onChange={(e) => setGoodEggs(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={saving || !flockId} className="btn-primary flex-1">Salvar</button>
      </div>
    </form>
  );
}

function QuickFeed({ flockId, feeds, onDone, saving, setSaving }) {
  const [feedId, setFeedId] = useState('');
  const [quantity, setQuantity] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/feed-consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY(), flockId, feedId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Alimentação registrada com sucesso.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div>
        <label className="label">Ração</label>
        <select required className="input-field mt-1" value={feedId} onChange={(e) => setFeedId(e.target.value)}>
          <option value="">Selecione...</option>
          {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Quantidade ({feeds.find((f) => f.id === feedId)?.unit || 'kg'})</label>
        <input required autoFocus type="number" min="0.01" step="0.01" className="input-field text-2xl py-4 text-center" value={quantity}
          onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={saving || !flockId} className="btn-primary flex-1">Salvar</button>
      </div>
    </form>
  );
}

function QuickMortality({ flockId, onDone, saving, setSaving }) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/mortality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY(), flockId, quantity, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Mortalidade registrada com sucesso.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <label className="label">Quantidade de mortes hoje</label>
      <input required autoFocus type="number" min="1" className="input-field text-2xl py-4 text-center" value={quantity}
        onChange={(e) => setQuantity(e.target.value)} />
      <div>
        <label className="label">Motivo (opcional)</label>
        <input className="input-field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={saving || !flockId} className="btn-primary flex-1">Salvar</button>
      </div>
    </form>
  );
}

function QuickOccurrence({ flockId, onDone, saving, setSaving }) {
  const [issue, setIssue] = useState('');
  const [symptoms, setSymptoms] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/health-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY(), flockId, issue, symptoms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Ocorrência registrada com sucesso.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <label className="label">O que foi observado?</label>
      <input required autoFocus className="input-field" value={issue} onChange={(e) => setIssue(e.target.value)} />
      <div>
        <label className="label">Sintomas (opcional)</label>
        <input className="input-field mt-1" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={saving || !flockId} className="btn-primary flex-1">Salvar</button>
      </div>
    </form>
  );
}
