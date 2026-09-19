'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar redefinição.');
      setSent(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-xl text-center mb-6">Recuperar senha</h1>

        {sent ? (
          <div className="card p-6 text-sm text-ink-700 space-y-4">
            <p>
              Se o e-mail informado existir em nossa base, enviaremos instruções de redefinição de senha em
              instantes.
            </p>
            <a href="/login" className="btn-secondary inline-block">
              Voltar para o login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                E-mail cadastrado
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-field mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>
            <a href="/login" className="block text-center text-xs text-olive-700 hover:underline">
              Voltar para o login
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
