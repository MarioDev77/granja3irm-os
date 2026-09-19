import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, genId } from '@/lib/db';
import { ROLES } from '@/lib/rbac';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from '@/lib/apiAuth';

// Gerar/revogar token de sensor é uma ação sensível (concede acesso de
// escrita sem login) — por isso é restrita a Administrador, não apenas a
// quem tem acesso a Produção.
export async function POST(request, { params: __p }) {
  const params = await __p;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (session.user.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Apenas um administrador pode gerenciar tokens de sensores.' }, { status: 403 });
  }

  const { rows } = await query('SELECT * FROM sheds WHERE id = $1', [params.id]);
  const shed = rows[0];
  if (!shed || shed.deleted_at) return notFound('Galpão não encontrado.');

  const deviceToken = crypto.randomBytes(24).toString('hex');
  await query('UPDATE sheds SET device_token = $1, updated_at = now() WHERE id = $2', [deviceToken, params.id]);

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description)
     VALUES ($1, $2, 'UPDATE', 'Shed', $3, $4)`,
    [genId(), session.user.id, shed.id, `${session.user.name} gerou um novo token de sensor IoT para o galpão ${shed.name}.`]
  );

  return NextResponse.json({ deviceToken });
}

export async function DELETE(request, { params: __p }) {
  const params = await __p;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (session.user.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Apenas um administrador pode gerenciar tokens de sensores.' }, { status: 403 });
  }

  const { rows } = await query('SELECT * FROM sheds WHERE id = $1', [params.id]);
  const shed = rows[0];
  if (!shed || shed.deleted_at) return notFound('Galpão não encontrado.');

  await query('UPDATE sheds SET device_token = NULL, updated_at = now() WHERE id = $1', [params.id]);

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description)
     VALUES ($1, $2, 'UPDATE', 'Shed', $3, $4)`,
    [genId(), session.user.id, shed.id, `${session.user.name} revogou o token de sensor IoT do galpão ${shed.name}.`]
  );

  return NextResponse.json({ message: 'Token revogado.' });
}
