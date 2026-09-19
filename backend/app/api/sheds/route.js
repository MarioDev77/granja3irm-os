import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const shedSchema = z.object({
  code: z.string().min(1, 'Informe o código/número do galpão.'),
  name: z.string().min(1, 'Informe o nome do galpão.'),
  capacity: z.coerce.number().int().positive('Capacidade deve ser maior que zero.'),
  location: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { rows: sheds } = await query(
    `SELECT
       s.id, s.code, s.name, s.capacity, s.location, s.type, s.status, s.notes,
       (SELECT COUNT(*)::int FROM flocks f WHERE f.shed_id = s.id) AS "activeFlockCount",
       COALESCE((
         SELECT COUNT(*)::int
         FROM birds b
         JOIN flocks f ON f.id = b.flock_id
         WHERE f.shed_id = s.id AND f.status = 'ACTIVE' AND b.status = 'ACTIVE'
       ), 0) AS "currentBirds"
     FROM sheds s
     WHERE s.deleted_at IS NULL
     ORDER BY s.code ASC`
  );

  const result = sheds.map((shed) => ({
    ...shed,
    occupancyPercent:
      shed.capacity > 0 ? Math.round((shed.currentBirds / shed.capacity) * 1000) / 10 : 0,
  }));

  return NextResponse.json({ sheds: result });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const body = await request.json();
  const parsed = shedSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  // Precisa haver uma granja cadastrada antes de criar galpões.
  const { rows: farmRows } = await query('SELECT id FROM farms ORDER BY created_at ASC LIMIT 1');
  let farm = farmRows[0];
  if (!farm) {
    const { rows } = await query(
      `INSERT INTO farms (id, name) VALUES ($1, 'Granja Oliveira') RETURNING id`,
      [genId()]
    );
    farm = rows[0];
  }

  const { rows: existingRows } = await query(
    `SELECT id FROM sheds WHERE farm_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [farm.id, parsed.data.code]
  );
  if (existingRows.length > 0) return badRequest('Já existe um galpão com este código.');

  const { code, name, capacity, location, type, notes } = parsed.data;
  const { rows } = await query(
    `INSERT INTO sheds (id, farm_id, code, name, capacity, location, type, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, code, name, capacity, location, type, status, notes`,
    [genId(), farm.id, code, name, capacity, location || null, type || null, notes || null]
  );
  const shed = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Shed', $3, $4, $5)`,
    [
      genId(),
      session.user.id,
      shed.id,
      JSON.stringify(parsed.data),
      `${session.user.name} cadastrou o galpão ${shed.name} (${shed.code}).`,
    ]
  );

  return NextResponse.json({ shed }, { status: 201 });
}
