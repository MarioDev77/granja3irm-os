import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, genId } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

const GENERIC_MESSAGE =
  'Se o e-mail informado existir em nossa base, enviaremos instruções de redefinição de senha.';

async function deliverResetLink(email, resetUrl) {
  const deliveryUrl = process.env.PASSWORD_RESET_DELIVERY_URL;
  const deliveryToken = process.env.PASSWORD_RESET_DELIVERY_TOKEN;
  if (!deliveryUrl || !deliveryToken) return false;

  let parsedUrl;
  try {
    parsedUrl = new URL(deliveryUrl);
  } catch {
    return false;
  }
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') return false;

  const response = await fetch(parsedUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${deliveryToken}`,
    },
    body: JSON.stringify({ email, resetUrl }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = checkRateLimit(`forgot-password:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da solicitação inválido.' }, { status: 400 });
  }
  const normalizedEmail = String(body?.email || '').trim().toLowerCase();

  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Informe um e-mail.' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, email FROM users
     WHERE email = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [normalizedEmail]
  );
  const user = rows[0];

  // Sempre responde a mesma mensagem genérica, exista ou não o usuário,
  // para não permitir enumeração de e-mails cadastrados.
  if (!user) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  // Não cria um token inutilizável quando o serviço de e-mail não está
  // configurado. A resposta continua genérica para impedir enumeração.
  if (!process.env.PASSWORD_RESET_DELIVERY_URL || !process.env.PASSWORD_RESET_DELIVERY_TOKEN) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  await query(
    `INSERT INTO password_reset_tokens (id, email, token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET id = EXCLUDED.id, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at,
           created_at = now()`,
    [genId(), normalizedEmail, tokenHash, expiresAt]
  );

  // A fragment is not sent in HTTP requests or referrer headers, reducing
  // token exposure in proxy access logs and third-party asset requests.
  const resetUrl = `${process.env.NEXTAUTH_URL}/redefinir-senha#token=${token}`;
  try {
    if (!(await deliverResetLink(normalizedEmail, resetUrl))) throw new Error('Reset delivery failed');
  } catch {
    await query('DELETE FROM password_reset_tokens WHERE token = $1', [tokenHash]);
    // Preserve the same response for known and unknown addresses. The caller
    // can request help if no message arrives; never log the reset URL/token.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
