import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { SECTIONS, assertCan } from '@/lib/rbac';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.AUDIT);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get('take')) || 50, 200);

  const { rows: logs } = await query(
    `SELECT
       al.id, al.action, al.entity, al.entity_id AS "entityId", al.previous_data AS "previousData",
       al.new_data AS "newData", al.description, al.ip_address AS "ipAddress", al.created_at AS "createdAt",
       json_build_object('name', u.name, 'email', u.email) AS user
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [take]
  );

  return NextResponse.json({ logs });
}
