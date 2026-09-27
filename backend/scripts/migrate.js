const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runInTransaction(pool, sql, migrationName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Defina DATABASE_MIGRATION_URL ou DATABASE_URL antes de rodar a migração.');
  }

  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows: baselineRows } = await pool.query(
      'SELECT name FROM schema_migrations WHERE name = $1',
      ['000_schema']
    );
    if (baselineRows.length === 0) {
      const { rows: existingRows } = await pool.query(
        `SELECT to_regclass('public.users') IS NOT NULL AS users_table_exists`
      );
      const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
      if (existingRows[0].users_table_exists) {
        // Existing installations already have the baseline schema. Record it
        // and advance only through numbered migrations.
        await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['000_schema']);
      } else {
        await runInTransaction(pool, schemaSql, '000_schema');
      }
    }

    const migrationsDir = path.join(__dirname, '..', 'sql', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const { rows } = await pool.query('SELECT name FROM schema_migrations WHERE name = $1', [file]);
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await runInTransaction(pool, sql, file);
      console.log(`Aplicada: ${file}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
