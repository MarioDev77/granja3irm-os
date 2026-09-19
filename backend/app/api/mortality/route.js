import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const mortalitySchema = z.object({
  date: z.string().min(1, 'Informe a data.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  quantity: z.coerce.number().int().positive('Informe uma quantidade válida.'),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Limite configurável de mortalidade diária (percentual do lote) que dispara
// alerta. Em uma fase futura isso vira configurável pela tela de
// Configurações; por ora fica como constante documentada.
const MORTALITY_ALERT_THRESHOLD_PERCENT = 1;

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get('take')) || 50, 200);

  const { rows: records } = await query(
    `SELECT
       m.id, m.date, m.flock_id AS "flockId", m.quantity, m.reason, m.notes, m.responsible_id AS "responsibleId",
       json_build_object('code', f.code, 'name', f.name, 'initialQuantity', f.initial_quantity) AS flock,
       json_build_object('name', u.name) AS responsible
     FROM mortality_records m
     JOIN flocks f ON f.id = m.flock_id
     JOIN users u ON u.id = m.responsible_id
     ORDER BY m.date DESC
     LIMIT $1`,
    [take]
  );

  return NextResponse.json({ records });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = mortalitySchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [parsed.data.flockId]);
  const flock = flockRows[0];
  if (!flock) return badRequest('Lote inválido.');

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1 AND status = 'ACTIVE'`,
    [flock.id]
  );
  const activeBirds = countRows[0].count;
  if (parsed.data.quantity > activeBirds && activeBirds > 0) {
    return badRequest(`O lote possui apenas ${activeBirds} aves ativas registradas.`);
  }

  const { date, flockId, quantity, reason, notes } = parsed.data;

  const record = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO mortality_records (id, date, flock_id, quantity, reason, notes, responsible_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, date, flock_id AS "flockId", quantity, reason, notes, responsible_id AS "responsibleId"`,
      [genId(), new Date(date), flockId, quantity, reason || null, notes || null, session.user.id]
    );
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
       VALUES ($1, $2, 'CREATE', 'Mortality', $3, $4, $5)`,
      [
        genId(), session.user.id, flock.id, JSON.stringify(parsed.data),
        `${session.user.name} registrou ${quantity} morte(s) no lote ${flock.name}.`,
      ]
    );
    return rows[0];
  });

  const dailyRatePercent = activeBirds > 0 ? Math.round((quantity / activeBirds) * 1000) / 10 : 0;
  const alertTriggered = dailyRatePercent >= MORTALITY_ALERT_THRESHOLD_PERCENT;

  if (alertTriggered) {
    await query(
      `INSERT INTO notifications (id, severity, title, message, category)
       VALUES ($1, 'CRITICAL', 'Mortalidade elevada', $2, 'MORTALITY')`,
      [genId(), `Lote ${flock.name}: ${quantity} mortes hoje (${dailyRatePercent}% das aves ativas).`]
    );
  }

  return NextResponse.json({ record, alertTriggered }, { status: 201 });
}
