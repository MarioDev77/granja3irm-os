import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  manufacturer: z.string().optional().nullable(),
  minimumStock: z.coerce.number().min(0).optional(),
  averagePrice: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const COLUMN_BY_FIELD = {
  name: 'name',
  manufacturer: 'manufacturer',
  minimumStock: 'minimum_stock',
  averagePrice: 'average_price',
  notes: 'notes',
};

const FEED_SELECT = `id, name, type, manufacturer, unit, current_stock AS "currentStock",
  minimum_stock AS "minimumStock", average_price AS "averagePrice", notes`;

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM feeds WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Ração não encontrada.');

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) {
    return NextResponse.json({ feed: existing });
  }

  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, value] of entries) {
    fields.push(`${COLUMN_BY_FIELD[key]} = $${i}`);
    values.push(value);
    i += 1;
  }
  fields.push('updated_at = now()');
  values.push(params.id);

  const { rows } = await query(
    `UPDATE feeds SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${FEED_SELECT}`,
    values
  );
  const feed = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Feed', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, feed.id,
      JSON.stringify({ minimumStock: existing.minimum_stock }),
      JSON.stringify(parsed.data),
      `${session.user.name} atualizou a ração ${feed.name}.`,
    ]
  );

  return NextResponse.json({ feed });
}
