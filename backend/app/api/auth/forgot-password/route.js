import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, genId } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

const GENERIC_MESSAGE =
  'Se o e-mail informado existir em nossa base, enviaremos instruções de redefinição de senha.';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = checkRateLimit(`forgot-password:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 });
  }

  const { email } = await request.json();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: 'Informe um e-mail.' }, { status: 400 });
  }

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = rows[0];

  // Sempre responde a mesma mensagem genérica, exista ou não o usuário,
  // para não permitir enumeração de e-mails cadastrados.
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await query(
    `INSERT INTO password_reset_tokens (id, email, token, expires_at) VALUES ($1, $2, $3, $4)`,
    [genId(), normalizedEmail, token, expiresAt]
  );

  const resetUrl = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${token}`;

  // TODO(fase futura): integrar um provedor de e-mail (ex.: Resend, SES,
  // SMTP corporativo) para enviar `resetUrl` de fato ao usuário. Sem esse
  // provedor configurado, o link é apenas registrado no log do servidor —
  // isso é aceitável em desenvolvimento, mas NÃO deve ir para produção
  // sem envio real de e-mail.
  console.info(`[Granja Oliveira] Link de redefinição de senha para ${normalizedEmail}: ${resetUrl}`);

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
