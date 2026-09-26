'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

const particles = [
  { className: 'particle particle-one' },
  { className: 'particle particle-two' },
  { className: 'particle particle-three' },
  { className: 'particle particle-four' },
  { className: 'particle particle-five' },
  { className: 'particle particle-six' },
  { className: 'particle particle-seven' },
];

function AnimatedParticlePanel() {
  return (
    <div className="visual-panel" aria-hidden="true">
      <div className="visual-grid" />
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      {particles.map(({ className }) => (
        <span key={className} className={className} />
      ))}
      <span className="glow-sphere sphere-large" />
      <span className="glow-sphere sphere-small" />
      <span className="vertical-line line-one" />
      <span className="vertical-line line-two" />
      <div className="visual-caption">GRANJA 3 IRMÃOS</div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('idle'); // 'idle' | 'error' | 'success'

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setMessageType('idle');
    setIsLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setMessage(result.error);
      setMessageType('error');
      return;
    }

    setMessage('Acesso concluído. Redirecionando...');
    setMessageType('success');
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <p className="eyebrow">GRANJA 3 IRMÃOS / ACESSO</p>
        <h1>Entrar</h1>
        <p>Bem-vindo de volta. Informe suas credenciais para continuar.</p>
      </div>
      <div className="fields">
        <label htmlFor="email">Seu e-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="seu.email@granja3irmaos.com.br"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="password-label-row">
          <label htmlFor="password">Senha</label>
          <a href="/recuperar-senha">Esqueci minha senha</a>
        </div>
        <div className="password-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <button className="submit-button" type="submit" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="spin" size={16} />
        ) : (
          <>
            <span>Entrar</span>
            <ArrowRight size={15} />
          </>
        )}
      </button>
      <p className={`form-message${messageType === 'success' ? ' success' : ''}${messageType === 'error' ? ' error' : ''}`} role="status">
        {message}
      </p>
      <p className="signup-prompt">Acesso restrito. Em caso de dúvidas, contate o administrador da granja.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-page granja-login">
      <section className="login-card" aria-label="Área de autenticação">
        <div className="window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="login-content">
          <LoginForm />
        </div>
        <AnimatedParticlePanel />
      </section>
    </main>
  );
}
