import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';

// ============================================================================
// Endpoint de ingestão para sensores IoT (seção 27 do escopo: "preparar
// arquitetura para futura integração com sensores IoT").
//
// Não usa sessão de usuário (um sensor não faz login) — em vez disso, cada
// galpão pode ter um `deviceToken` gerado pelo Administrador na tela de
// Controle ambiental. O sensor envia esse token no header `x-device-token`.
//
// Isso é infraestrutura real e funcional, não um enfeite: qualquer sensor
// capaz de fazer um POST HTTP já pode usar esta rota hoje. O que ainda não
// existe é o firmware/hardware do sensor em si, que é responsabilidade de
// quem for integrar o dispositivo físico.
// ============================================================================

const ingestSchema = z.object({
  temperature: z.coerce.number().optional().nullable(),
  humidity: z.coerce.number().optional().nullable(),
});

export async function POST(request) {
  const token = request.headers.get('x-device-token');
  if (!token) {
    return NextResponse.json({ error: 'Cabeçalho x-device-token ausente.' }, { status: 401 });
  }

  const { rows: shedRows } = await query('SELECT * FROM sheds WHERE device_token = $1', [token]);
  const shed = shedRows[0];
  if (!shed || shed.deleted_at) {
    return NextResponse.json({ error: 'Token de dispositivo inválido.' }, { status: 401 });
  }

  const parsed = ingestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { temperature, humidity } = parsed.data;

  const { rows } = await query(
    `INSERT INTO environmental_records (id, shed_id, temperature, humidity, source)
     VALUES ($1, $2, $3, $4, 'SENSOR')
     RETURNING id, shed_id AS "shedId", temperature, humidity, source, recorded_at AS "recordedAt"`,
    [genId(), shed.id, temperature ?? null, humidity ?? null]
  );
  const record = rows[0];

  const { rows: farmRows } = await query('SELECT * FROM farms WHERE id = $1', [shed.farm_id]);
  const farm = farmRows[0];
  if (farm) {
    const breaches = [];
    if (temperature != null && farm.max_temperature != null && temperature > Number(farm.max_temperature)) {
      breaches.push(`temperatura de ${temperature}°C acima do máximo (${Number(farm.max_temperature)}°C)`);
    }
    if (humidity != null && farm.max_humidity != null && humidity > Number(farm.max_humidity)) {
      breaches.push(`umidade de ${humidity}% acima do máximo (${Number(farm.max_humidity)}%)`);
    }
    for (const breach of breaches) {
      await query(
        `INSERT INTO notifications (id, severity, title, message, category)
         VALUES ($1, 'CRITICAL', 'Limite ambiental ultrapassado (sensor)', $2, 'ENVIRONMENT')`,
        [genId(), `${shed.name}: ${breach}.`]
      );
    }
  }

  return NextResponse.json({ record }, { status: 201 });
}
