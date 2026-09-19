import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const feedSchema = z.object({
  name: z.string().min(1, 'Informe o nome da ração.'),
  type: z.enum(['INITIAL', 'GROWTH', 'LAYING', 'BREEDING', 'OTHER']),
  manufacturer: z.string().optional().nullable(),
  unit: z.string().min(1).default('kg'),
  minimumStock: z.coerce.number().min(0).default(0),
  averagePrice: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const FEED_SELECT = `id, name, type, manufacturer, supplier_id AS "supplierId", unit,
  current_stock AS "currentStock", minimum_stock AS "minimumStock", average_price AS "averagePrice",
  notes, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function GET() {
  const { error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const { rows: feeds } = await query(`SELECT ${FEED_SELECT} FROM feeds ORDER BY name ASC`);
  return NextResponse.json({ feeds });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = feedSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { name, type, manufacturer, unit, minimumStock, averagePrice, notes } = parsed.data;

  const { rows } = await query(
    `INSERT INTO feeds (id, name, type, manufacturer, unit, minimum_stock, average_price, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${FEED_SELECT}`,
    [genId(), name, type, manufacturer || null, unit, minimumStock, averagePrice ?? null, notes || null]
  );
  const feed = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Feed', $3, $4, $5)`,
    [genId(), session.user.id, feed.id, JSON.stringify(parsed.data), `${session.user.name} cadastrou a ração ${feed.name}.`]
  );

  return NextResponse.json({ feed }, { status: 201 });
}
