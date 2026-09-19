import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'SALE', 'LOSS', 'BREAKAGE', 'RETURN', 'ADJUSTMENT']),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA', 'JUMBO']),
  quantity: z.coerce.number().int(),
  date: z.string().optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  authorizeNegative: z.boolean().optional(),
});

// Tipos que aumentam o estoque (RETURN devolve ovos que tinham saído).
const INCREASE_TYPES = new Set(['IN', 'RETURN']);

export async function GET() {
  const { error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const [movementsResult, allForStockResult] = await Promise.all([
    query('SELECT id, type, size, quantity, date, reference, notes FROM egg_inventory_movements ORDER BY date DESC LIMIT 100'),
    query('SELECT type, size, quantity FROM egg_inventory_movements'),
  ]);

  const stockBySize = {};
  for (const m of allForStockResult.rows) {
    const signedQty = INCREASE_TYPES.has(m.type) || m.type === 'ADJUSTMENT' ? m.quantity : -m.quantity;
    stockBySize[m.size] = (stockBySize[m.size] || 0) + signedQty;
  }

  return NextResponse.json({ movements: movementsResult.rows, stockBySize });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = movementSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { type, size, quantity, date, reference, notes, authorizeNegative } = parsed.data;

  if (type !== 'ADJUSTMENT' && quantity <= 0) {
    return badRequest('Informe uma quantidade positiva.');
  }

  // Verifica se a saída deixaria o estoque negativo (seção 10: nunca
  // permitir estoque negativo sem autorização administrativa).
  if (!INCREASE_TYPES.has(type)) {
    const { rows: existing } = await query('SELECT type, quantity FROM egg_inventory_movements WHERE size = $1', [size]);
    let currentStock = 0;
    for (const m of existing) {
      const signed = INCREASE_TYPES.has(m.type) || m.type === 'ADJUSTMENT' ? m.quantity : -m.quantity;
      currentStock += signed;
    }
    const resulting = type === 'ADJUSTMENT' ? currentStock + quantity : currentStock - quantity;
    if (resulting < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
      return badRequest(
        'Estoque de ovos insuficiente para esta movimentação. Apenas um administrador pode autorizar estoque negativo.'
      );
    }
  }

  const { rows } = await query(
    `INSERT INTO egg_inventory_movements (id, type, size, quantity, date, reference, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, type, size, quantity, date, reference, notes`,
    [genId(), type, size, quantity, date ? new Date(date) : new Date(), reference || null, notes || null]
  );
  const movement = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'EggInventoryMovement', $3, $4, $5)`,
    [
      genId(), session.user.id, movement.id, JSON.stringify({ type, size, quantity }),
      `${session.user.name} registrou movimentação de estoque de ovos (${type}, ${size}, ${quantity}).`,
    ]
  );

  return NextResponse.json({ movement }, { status: 201 });
}
