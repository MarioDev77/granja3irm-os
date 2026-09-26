import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  shedId: z.string().min(1).optional(),
  temperature: z.coerce.number().optional().nullable(),
  humidity: z.coerce.number().optional().nullable(),
  ventilation: z.string().optional().nullable(),
  lighting: z.string().optional().nullable(),
  waterQuality: z.string().optional().nullable(),
});

const SELECT = `id, shed_id AS "shedId", temperature, humidity, ventilation, lighting,
  water_quality AS "waterQuality", source, recorded_at AS "recordedAt"`;

// Só registros lançados manualmente podem ser editados; leituras vindas de
// sensores IoT (source = 'IOT') são preservadas como histórico do
// equipamento (ver seção 5: "não adicionar edição em dados que devam
// permanecer históricos por regra de negócio").
export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM environmental_records WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Leitura ambiental não encontrada.');
  if (existing.source !== 'MANUAL') {
    return badRequest('Leituras registradas automaticamente por sensores não podem ser editadas.');
  }

  const { shedId, temperature, humidity, ventilation, lighting, waterQuality } = parsed.data;
  const targetShedId = shedId ?? existing.shed_id;

  const { rows: shedRows } = await query('SELECT * FROM sheds WHERE id = $1', [targetShedId]);
  const shed = shedRows[0];
  if (!shed) return badRequest('Galpão inválido.');

  const { rows } = await query(
    `UPDATE environmental_records SET
       shed_id = $1, temperature = $2, humidity = $3, ventilation = $4, lighting = $5, water_quality = $6, updated_at = now()
     WHERE id = $7
     RETURNING ${SELECT}`,
    [
      targetShedId,
      temperature !== undefined ? temperature : existing.temperature,
      humidity !== undefined ? humidity : existing.humidity,
      ventilation !== undefined ? ventilation : existing.ventilation,
      lighting !== undefined ? lighting : existing.lighting,
      waterQuality !== undefined ? waterQuality : existing.water_quality,
      params.id,
    ]
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'EnvironmentalRecord', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, record.id,
      JSON.stringify({ temperature: existing.temperature, humidity: existing.humidity }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou uma leitura ambiental do galpão ${shed.name}.`,
    ]
  );

  return NextResponse.json({ record });
}
