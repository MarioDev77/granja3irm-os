'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Loader2, Mail } from 'lucide-react';

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
      <div className="field-group">
        <label htmlFor="email">E-mail</label>
        <div className="input-with-icon">
          <Mail size={19} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="seuemail@granja.com.br"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <label htmlFor="password">Senha</label>
          <a href="/recuperar-senha">Esqueci minha senha</a>
        </div>
        <div className="input-with-icon password-field">
          <LockKeyhole size={19} aria-hidden="true" />
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
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button className="login-button" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="spin" size={17} /> : 'Entrar'}
      </button>

      <p className={`form-message${messageType === 'success' ? ' success' : ''}${messageType === 'error' ? ' error' : ''}`} role="status">
        {message}
      </p>

      <p className="help-text">Acesso restrito. Em caso de dúvidas, contate o administrador da granja.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-page granja-login">
      <div className="login-glow login-glow-top" aria-hidden="true" />
      <div className="login-glow login-glow-bottom" aria-hidden="true" />

      <section className="login-card" aria-label="Área de autenticação">
        <div className="login-logo-wrap">
          <Image
            src="/granja-logo.png"
            alt="Logo Granja Oliveira"
            width={180}
            height={180}
            priority
            className="login-logo"
          />
        </div>

        <div className="form-heading">
          <p className="form-eyebrow">GRANJA OLIVEIRA</p>
          <h1>Login</h1>
          <p>Acesse o sistema de gestão da sua propriedade.</p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
