import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { query } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, notFound } from '@/lib/apiAuth';

export async function GET(request, { params: __p }) {
  const params = await __p;
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { rows } = await query('SELECT * FROM sheds WHERE id = $1', [params.id]);
  const shed = rows[0];
  if (!shed || shed.deleted_at) return notFound('Galpão não encontrado.');

  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const targetUrl = `${baseUrl}/operacional/${shed.id}`;

  const svg = await QRCode.toString(targetUrl, { type: 'svg', margin: 1, width: 240 });

  return NextResponse.json({ svg, url: targetUrl, shedName: shed.name });
}
