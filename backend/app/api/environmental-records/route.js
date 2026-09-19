import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const recordSchema = z.object({
  shedId: z.string().min(1, 'Selecione o galpão.'),
  temperature: z.coerce.number().optional().nullable(),
  humidity: z.coerce.number().optional().nullable(),
  ventilation: z.string().optional().nullable(),
  lighting: z.string().optional().nullable(),
  waterQuality: z.string().optional().nullable(),
});

// Compara uma leitura com os limites configurados na granja e cria um
// alerta quando ultrapassado (seção 27: "Se registrar 31,5°C, gerar
// alerta" quando o máximo configurado é 30°C).
async function checkThresholds(shed, temperature, humidity) {
  const { rows: farmRows } = await query('SELECT * FROM farms WHERE id = $1', [shed.farm_id]);
  const farm = farmRows[0];
  if (!farm) return false;

  const breaches = [];
  if (temperature !== null && temperature !== undefined) {
    if (farm.max_temperature !== null && temperature > Number(farm.max_temperature)) {
      breaches.push(`temperatura de ${temperature}°C acima do máximo configurado (${Number(farm.max_temperature)}°C)`);
    }
    if (farm.min_temperature !== null && temperature < Number(farm.min_temperature)) {
      breaches.push(`temperatura de ${temperature}°C abaixo do mínimo configurado (${Number(farm.min_temperature)}°C)`);
    }
  }
  if (humidity !== null && humidity !== undefined) {
    if (farm.max_humidity !== null && humidity > Number(farm.max_humidity)) {
      breaches.push(`umidade de ${humidity}% acima do máximo configurado (${Number(farm.max_humidity)}%)`);
    }
    if (farm.min_humidity !== null && humidity < Number(farm.min_humidity)) {
      breaches.push(`umidade de ${humidity}% abaixo do mínimo configurado (${Number(farm.min_humidity)}%)`);
    }
  }

  for (const breach of breaches) {
    await query(
      `INSERT INTO notifications (id, severity, title, message, category)
       VALUES ($1, 'CRITICAL', 'Limite ambiental ultrapassado', $2, 'ENVIRONMENT')`,
      [genId(), `${shed.name}: ${breach}.`]
    );
  }

  return breaches.length > 0;
}

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const shedId = searchParams.get('shedId') || null;

  const { rows: records } = await query(
    `SELECT
       er.id, er.shed_id AS "shedId", er.temperature, er.humidity, er.ventilation, er.lighting,
       er.water_quality AS "waterQuality", er.source, er.recorded_at AS "recordedAt",
       json_build_object('name', s.name, 'code', s.code) AS shed
     FROM environmental_records er
     JOIN sheds s ON s.id = er.shed_id
     WHERE ($1::text IS NULL OR er.shed_id = $1)
     ORDER BY er.recorded_at DESC
     LIMIT 100`,
    [shedId]
  );

  const { rows: farmRows } = await query('SELECT * FROM farms ORDER BY created_at ASC LIMIT 1');
  const farm = farmRows[0];

  return NextResponse.json({
    records,
    thresholds: farm
      ? {
          maxTemperature: farm.max_temperature,
          minTemperature: farm.min_temperature,
          maxHumidity: farm.max_humidity,
          minHumidity: farm.min_humidity,
        }
      : null,
  });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = recordSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { shedId, temperature, humidity, ventilation, lighting, waterQuality } = parsed.data;

  const { rows: shedRows } = await query('SELECT * FROM sheds WHERE id = $1', [shedId]);
  const shed = shedRows[0];
  if (!shed) return badRequest('Galpão inválido.');

  const { rows } = await query(
    `INSERT INTO environmental_records (id, shed_id, temperature, humidity, ventilation, lighting, water_quality, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL')
     RETURNING id, shed_id AS "shedId", temperature, humidity, ventilation, lighting,
       water_quality AS "waterQuality", source, recorded_at AS "recordedAt"`,
    [genId(), shedId, temperature ?? null, humidity ?? null, ventilation || null, lighting || null, waterQuality || null]
  );
  const record = rows[0];

  const alertTriggered = await checkThresholds(shed, temperature, humidity);

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'EnvironmentalRecord', $3, $4, $5)`,
    [genId(), session.user.id, record.id, JSON.stringify(parsed.data), `${session.user.name} registrou leitura ambiental no galpão ${shed.name}.`]
  );

  return NextResponse.json({ record, alertTriggered }, { status: 201 });
}
