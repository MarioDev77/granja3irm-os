import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, genId } from '@/lib/db';
import { SECTIONS, assertCan } from '@/lib/rbac';

const optionalNumber = z
  .union([z.coerce.number(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

const farmSchema = z.object({
  name: z.string().min(2, 'Informe o nome da granja.'),
  document: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  maxTemperature: optionalNumber,
  minTemperature: optionalNumber,
  maxHumidity: optionalNumber,
  minHumidity: optionalNumber,
});

const FARM_SELECT = `id, name, document, address, logo_url AS "logoUrl",
  max_temperature AS "maxTemperature", min_temperature AS "minTemperature",
  max_humidity AS "maxHumidity", min_humidity AS "minHumidity",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.SETTINGS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { rows } = await query(`SELECT ${FARM_SELECT} FROM farms ORDER BY created_at ASC LIMIT 1`);
  return NextResponse.json({ farm: rows[0] || null });
}

export async function PUT(request) {
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.SETTINGS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json();
  const parsed = farmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, document, address, maxTemperature, minTemperature, maxHumidity, minHumidity } = parsed.data;

  const { rows: existingRows } = await query('SELECT id FROM farms ORDER BY created_at ASC LIMIT 1');
  const existing = existingRows[0];

  let farm;
  if (existing) {
    const { rows } = await query(
      `UPDATE farms SET name = $1, document = $2, address = $3, max_temperature = $4,
        min_temperature = $5, max_humidity = $6, min_humidity = $7, updated_at = now()
       WHERE id = $8
       RETURNING ${FARM_SELECT}`,
      [name, document || null, address || null, maxTemperature, minTemperature, maxHumidity, minHumidity, existing.id]
    );
    farm = rows[0];
  } else {
    const { rows } = await query(
      `INSERT INTO farms (id, name, document, address, max_temperature, min_temperature, max_humidity, min_humidity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${FARM_SELECT}`,
      [genId(), name, document || null, address || null, maxTemperature, minTemperature, maxHumidity, minHumidity]
    );
    farm = rows[0];
  }

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, $3, 'Farm', $4, $5, $6)`,
    [
      genId(),
      session.user.id,
      existing ? 'UPDATE' : 'CREATE',
      farm.id,
      JSON.stringify(parsed.data),
      `${session.user.name} atualizou os dados da granja.`,
    ]
  );

  return NextResponse.json({ farm });
}
