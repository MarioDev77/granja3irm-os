'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

const SEVERITY_STYLE = {
  CRITICAL: { emoji: '🔴', className: 'bg-clay-50 border-clay-300 text-clay-700' },
  WARNING: { emoji: '🟡', className: 'bg-egg-400/10 border-egg-500 text-ink-700' },
  INFO: { emoji: '🟢', className: 'bg-olive-50 border-olive-300 text-olive-700' },
};

export default function AlertasPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotifications(data.notifications);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      load();
    } catch {
      toast.error('Erro ao atualizar alerta.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-900">Alertas</h1>
        <p className="text-sm text-ink-500 mt-1">
          Gerados automaticamente pelo sistema (estoque crítico, mortalidade elevada, etc.).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : notifications.length === 0 ? (
        <EmptyState title="Não há dados registrados." description="Nenhum alerta gerado até o momento." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const style = SEVERITY_STYLE[n.severity] || SEVERITY_STYLE.INFO;
            return (
              <div key={n.id} className={`card p-4 border flex items-start justify-between gap-3 ${style.className} ${n.isRead ? 'opacity-60' : ''}`}>
                <div>
                  <p className="text-sm font-medium">{style.emoji} {n.title}</p>
                  <p className="text-sm mt-1">{n.message}</p>
                  <p className="text-xs mt-1 opacity-70">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} className="text-xs whitespace-nowrap hover:underline">
                    Marcar como lido
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
