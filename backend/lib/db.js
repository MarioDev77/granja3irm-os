import { Pool } from 'pg';
import crypto from 'crypto';

// ============================================================================
// Conexão com o Postgres via node-postgres (pg), substituindo o Prisma
// Client. Um único Pool é reaproveitado entre requisições (e entre hot
// reloads em desenvolvimento, via globalThis) para não esgotar conexões.
// ============================================================================

const globalForPg = globalThis;

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

/**
 * Executa uma query simples (sem transação) usando uma conexão do pool.
 * @param {string} text SQL com placeholders $1, $2, ...
 * @param {any[]} params
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Executa `fn(client)` dentro de uma transação (BEGIN/COMMIT/ROLLBACK),
 * substituindo o antigo `prisma.$transaction([...])` /
 * `prisma.$transaction(async (tx) => ...)`.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gera um identificador único para novas linhas. O Prisma gerava os IDs
 * (cuid()) no próprio client antes do INSERT; aqui fazemos o equivalente
 * com crypto.randomUUID(), gerado em Node sem depender de extensão alguma
 * do Postgres (evita exigir pgcrypto/uuid-ossp no banco).
 */
export function genId() {
  return crypto.randomUUID();
}

export default { pool, query, withTransaction, genId };
