import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const singleBirdSchema = z.object({
  mode: z.literal('single'),
  identifier: z.string().min(1, 'Informe a identificação da ave.'),
  sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).default('UNKNOWN'),
  breed: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  flockId: z.string().min(1, 'Selecione o lote.'),
  origin: z.string().optional().nullable(),
});

const bulkBirdSchema = z.object({
  mode: z.literal('bulk'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  quantity: z.coerce.number().int().positive('Informe uma quantidade válida.'),
  prefix: z.string().min(1, 'Informe um prefixo para gerar as identificações.'),
  sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).default('UNKNOWN'),
  breed: z.string().optional().nullable(),
});

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const flockId = searchParams.get('flockId') || null;
  const take = Math.min(Number(searchParams.get('take')) || 100, 500);

  const { rows: birds } = await query(
    `SELECT
       b.id, b.identifier, b.sex, b.breed, b.birth_date AS "birthDate", b.flock_id AS "flockId",
       b.origin, b.status, b.created_at AS "createdAt",
       json_build_object('code', f.code, 'name', f.name) AS flock
     FROM birds b
     JOIN flocks f ON f.id = b.flock_id
     WHERE ($1::text IS NULL OR b.flock_id = $1)
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [flockId, take]
  );

  return NextResponse.json({ birds });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const body = await request.json();

  if (body.mode === 'bulk') {
    const parsed = bulkBirdSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const { flockId, quantity, prefix, sex, breed } = parsed.data;

    const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [flockId]);
    const flock = flockRows[0];
    if (!flock) return badRequest('Lote inválido.');

    if (quantity > 5000) {
      return badRequest('Cadastro em lote limitado a 5.000 aves por vez.');
    }

    const { rows: countRows } = await query('SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1', [flockId]);
    const existingCount = countRows[0].count;

    await withTransaction(async (client) => {
      for (let i = 0; i < quantity; i += 1) {
        const identifier = `${prefix}-${String(existingCount + i + 1).padStart(4, '0')}`;
        // Equivalente a skipDuplicates: true do Prisma.
        await client.query(
          `INSERT INTO birds (id, identifier, sex, breed, flock_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (identifier) DO NOTHING`,
          [genId(), identifier, sex, breed || null, flockId]
        );
      }
      await client.query(
        `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
         VALUES ($1, $2, 'CREATE', 'Bird', $3, $4, $5)`,
        [
          genId(), session.user.id, flockId, JSON.stringify({ quantity, prefix, flockId }),
          `${session.user.name} cadastrou ${quantity} aves em lote no lote ${flock.name}.`,
        ]
      );
    });

    return NextResponse.json({ message: `${quantity} aves cadastradas.` }, { status: 201 });
  }

  const parsed = singleBirdSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT id FROM birds WHERE identifier = $1', [parsed.data.identifier]);
  if (existingRows.length > 0) return badRequest('Já existe uma ave com esta identificação.');

  const { identifier, sex, breed, birthDate, flockId, origin } = parsed.data;

  const { rows } = await query(
    `INSERT INTO birds (id, identifier, sex, breed, birth_date, flock_id, origin)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, identifier, sex, breed, birth_date AS "birthDate", flock_id AS "flockId", origin, status`,
    [genId(), identifier, sex, breed || null, birthDate ? new Date(birthDate) : null, flockId, origin || null]
  );
  const bird = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Bird', $3, $4, $5)`,
    [
      genId(), session.user.id, bird.id,
      JSON.stringify({ identifier, sex, breed, birthDate, flockId, origin }),
      `${session.user.name} cadastrou a ave ${bird.identifier}.`,
    ]
  );

  return NextResponse.json({ bird }, { status: 201 });
}
