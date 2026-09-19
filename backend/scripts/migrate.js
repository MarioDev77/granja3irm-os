// ============================================================================
// Aplica sql/schema.sql no banco apontado por DATABASE_URL.
//
// Substitui o antigo `prisma migrate deploy`. Não é uma migration engine
// incremental — para um projeto deste porte, um único schema.sql idempotente
// (rodado uma vez, num banco vazio) é suficiente. Se precisar alterar o
// schema depois, adicione arquivos numerados em sql/migrations/ e rode-os em
// ordem (este script já sabe fazer isso, ver abaixo).
// ============================================================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Defina DATABASE_URL no seu .env antes de rodar a migração.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Aplicando sql/schema.sql...');
  await pool.query(schemaSql);
  console.log('Schema criado com sucesso.');

  const migrationsDir = path.join(__dirname, '..', 'sql', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`Aplicando sql/migrations/${file}...`);
      await pool.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  }

  await pool.end();
  console.log('Concluído.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
