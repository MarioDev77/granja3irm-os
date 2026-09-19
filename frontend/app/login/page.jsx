'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16 4c-4.5 3.5-7 8-7 12.5C9 21.6 12.1 26 16 26s7-4.4 7-9.5C23 12 20.5 7.5 16 4z"
                fill="#556f31"
              />
              <ellipse cx="16" cy="18" rx="4.2" ry="5.4" fill="#f4f6ee" />
            </svg>
            <span className="font-display text-xl text-ink-900 tracking-tight">Granja Oliveira</span>
          </div>
          <p className="text-sm text-ink-500">Entre com suas credenciais para acessar o sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="email" className="label">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input-field mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@granjaoliveira.com.br"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">
                Senha
              </label>
              <a href="/recuperar-senha" className="text-xs text-olive-700 hover:underline">
                Esqueci minha senha
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          Acesso restrito. Em caso de dúvidas, contate o administrador da granja.
        </p>
      </div>
    </div>
  );
}
