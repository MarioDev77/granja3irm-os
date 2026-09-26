import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  type: z.enum(['IN', 'OUT', 'SALE', 'LOSS', 'BREAKAGE', 'RETURN', 'ADJUSTMENT']).optional(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA', 'JUMBO']).optional(),
  quantity: z.coerce.number().int().optional(),
  date: z.string().optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  authorizeNegative: z.boolean().optional(),
});

const INCREASE_TYPES = new Set(['IN', 'RETURN']);

function signed(type, quantity) {
  return INCREASE_TYPES.has(type) || type === 'ADJUSTMENT' ? quantity : -quantity;
}

// O estoque de ovos é sempre calculado somando todas as movimentações (ver
// GET de /api/egg-inventory), então editar um registro já recalcula o
// estoque automaticamente — só precisamos validar que o resultado final
// não fica negativo para o tamanho afetado.
export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM egg_inventory_movements WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Movimentação de estoque de ovos não encontrada.');

  const { type, size, quantity, date, reference, notes, authorizeNegative } = parsed.data;
  const targetType = type ?? existing.type;
  const targetSize = size ?? existing.size;
  const targetQuantity = quantity ?? existing.quantity;

  if (targetType !== 'ADJUSTMENT' && targetQuantity <= 0) {
    return badRequest('Informe uma quantidade positiva.');
  }

  const sizesToCheck = new Set([existing.size, targetSize]);
  for (const checkSize of sizesToCheck) {
    const { rows: others } = await query(
      'SELECT type, quantity FROM egg_inventory_movements WHERE size = $1 AND id <> $2',
      [checkSize, params.id]
    );
    let stock = others.reduce((total, m) => total + signed(m.type, m.quantity), 0);
    if (checkSize === targetSize) {
      stock += signed(targetType, targetQuantity);
    }
    if (stock < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
      return badRequest(
        'Estoque de ovos insuficiente para esta alteração. Apenas um administrador pode autorizar estoque negativo.'
      );
    }
  }

  const { rows } = await query(
    `UPDATE egg_inventory_movements SET
       type = $1, size = $2, quantity = $3, date = $4, reference = $5, notes = $6, updated_at = now()
     WHERE id = $7
     RETURNING id, type, size, quantity, date, reference, notes`,
    [
      targetType,
      targetSize,
      targetQuantity,
      date ? new Date(date) : existing.date,
      reference !== undefined ? reference : existing.reference,
      notes !== undefined ? notes : existing.notes,
      params.id,
    ]
  );
  const movement = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'EggInventoryMovement', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, movement.id,
      JSON.stringify({ type: existing.type, size: existing.size, quantity: existing.quantity }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou uma movimentação de estoque de ovos.`,
    ]
  );

  return NextResponse.json({ movement });
}
