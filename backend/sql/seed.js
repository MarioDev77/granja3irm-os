// ============================================================================
// Seed inicial da Granja Oliveira.
//
// Este script NÃO cria dados fictícios de produção, lotes, aves, etc. Ele
// cria apenas a primeira conta de administrador, a partir de variáveis de
// ambiente, para que seja possível o primeiro login no sistema com banco
// vazio (conforme exigido no escopo do projeto).
//
// Reescrito para usar `pg` diretamente (antes usava @prisma/client).
// ============================================================================

const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Defina SEED_ADMIN_NAME, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no seu .env antes de rodar o seed.'
    );
  }

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
  }

  const { rows: existingRows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingRows.length > 0) {
    console.log(`Já existe um usuário com o e-mail ${email}. Nenhuma alteração foi feita.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'ADMIN')
     RETURNING email`,
    [id, name, email, passwordHash]
  );

  console.log(`Administrador criado: ${rows[0].email}. Faça login e troque a senha o quanto antes.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
