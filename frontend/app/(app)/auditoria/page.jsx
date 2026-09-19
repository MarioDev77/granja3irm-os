'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/EmptyState';

export default function AuditoriaPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLogs(data.logs);
      })
      .catch((err) => toast.error(err.message || 'Erro ao carregar auditoria.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-900">Auditoria</h1>
        <p className="text-sm text-ink-500 mt-1">
          Histórico de ações importantes realizadas no sistema. Este registro não pode ser alterado por
          usuários comuns.
        </p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-ink-500">Carregando...</div>
        ) : logs.length === 0 ? (
          <EmptyState title="Não há dados registrados." />
        ) : (
          <ul className="divide-y divide-ink-300/30">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3 text-sm">
                <p className="text-ink-900">{log.description}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {new Date(log.createdAt).toLocaleString('pt-BR')} · {log.action} · {log.entity}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
