-- ============================================================================
-- GRANJA OLIVEIRA — Schema de banco de dados
-- PostgreSQL puro (sem Prisma / sem ORM)
--
-- Este arquivo substitui integralmente o antigo prisma/schema.prisma.
-- Os IDs são gerados pela aplicação (crypto.randomUUID(), ver lib/db.js),
-- não pelo banco — por isso nenhuma coluna "id" tem DEFAULT.
--
-- Rode com:  psql "$DATABASE_URL" -f sql/schema.sql
-- ou:        npm run db:migrate   (ver package.json)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE shed_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE flock_status AS ENUM ('ACTIVE', 'CLOSED', 'SOLD', 'TRANSFERRED');
CREATE TYPE bird_sex AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
CREATE TYPE bird_status AS ENUM ('ACTIVE', 'SOLD', 'DEAD', 'DISCARDED', 'TRANSFERRED');
CREATE TYPE egg_size AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'EXTRA', 'JUMBO');
CREATE TYPE egg_movement_type AS ENUM ('IN', 'OUT', 'SALE', 'LOSS', 'BREAKAGE', 'RETURN', 'ADJUSTMENT');
CREATE TYPE feed_type AS ENUM ('INITIAL', 'GROWTH', 'LAYING', 'BREEDING', 'OTHER');
CREATE TYPE feed_movement_type AS ENUM ('IN', 'OUT');
CREATE TYPE purchase_status AS ENUM ('PENDING', 'RECEIVED', 'CANCELED');
CREATE TYPE customer_type AS ENUM ('INDIVIDUAL', 'MARKET', 'RESTAURANT', 'DISTRIBUTOR', 'WHOLESALER', 'FAIR', 'OTHER');
CREATE TYPE sale_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');
CREATE TYPE payable_status AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'CANCELED');
CREATE TYPE receivable_status AS ENUM ('OPEN', 'RECEIVED', 'OVERDUE', 'CANCELED');
CREATE TYPE cash_flow_type AS ENUM ('INFLOW', 'OUTFLOW');
CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE equipment_status AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE notification_severity AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- ---------------------------------------------------------------------------
-- AUTENTICAÇÃO / RBAC
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  role                  user_role NOT NULL,
  status                user_status NOT NULL DEFAULT 'ACTIVE',
  phone                 TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens (email);

CREATE TABLE audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users (id),
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     TEXT,
  previous_data JSONB,
  new_data      JSONB,
  description   TEXT NOT NULL,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- GRANJA / GALPÕES
-- ---------------------------------------------------------------------------

CREATE TABLE farms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  document        TEXT,
  address         TEXT,
  logo_url        TEXT,
  max_temperature NUMERIC(5, 2),
  min_temperature NUMERIC(5, 2),
  max_humidity    NUMERIC(5, 2),
  min_humidity    NUMERIC(5, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sheds (
  id           TEXT PRIMARY KEY,
  farm_id      TEXT NOT NULL REFERENCES farms (id),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  capacity     INTEGER NOT NULL,
  location     TEXT,
  type         TEXT,
  status       shed_status NOT NULL DEFAULT 'ACTIVE',
  notes        TEXT,
  device_token TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (farm_id, code)
);

-- ---------------------------------------------------------------------------
-- LOTES / AVES
-- ---------------------------------------------------------------------------

CREATE TABLE flocks (
  id               TEXT PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  shed_id          TEXT NOT NULL REFERENCES sheds (id),
  entry_date       TIMESTAMPTZ NOT NULL,
  birth_date       TIMESTAMPTZ,
  breed            TEXT,
  initial_quantity INTEGER NOT NULL,
  origin           TEXT,
  production_type  TEXT,
  status           flock_status NOT NULL DEFAULT 'ACTIVE',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE birds (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  sex        bird_sex NOT NULL DEFAULT 'UNKNOWN',
  breed      TEXT,
  birth_date TIMESTAMPTZ,
  flock_id   TEXT NOT NULL REFERENCES flocks (id),
  origin     TEXT,
  status     bird_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- FORNECEDORES / CLIENTES (precisam existir antes de feeds/purchases/sales)
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  document   TEXT,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  products   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  document   TEXT,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  type       customer_type NOT NULL DEFAULT 'INDIVIDUAL',
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RAÇÃO / ESTOQUE / CONSUMO
-- ---------------------------------------------------------------------------

CREATE TABLE feeds (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          feed_type NOT NULL,
  manufacturer  TEXT,
  supplier_id   TEXT REFERENCES suppliers (id),
  unit          TEXT NOT NULL DEFAULT 'kg',
  current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  average_price NUMERIC(12, 2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feed_movements (
  id             TEXT PRIMARY KEY,
  feed_id        TEXT NOT NULL REFERENCES feeds (id),
  type           feed_movement_type NOT NULL,
  quantity       NUMERIC(12, 3) NOT NULL,
  supplier_id    TEXT REFERENCES suppliers (id),
  unit_value     NUMERIC(12, 2),
  document       TEXT,
  shed_id        TEXT,
  responsible_id TEXT NOT NULL REFERENCES users (id),
  notes          TEXT,
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feed_consumptions (
  id         TEXT PRIMARY KEY,
  date       TIMESTAMPTZ NOT NULL,
  flock_id   TEXT NOT NULL REFERENCES flocks (id),
  feed_id    TEXT NOT NULL REFERENCES feeds (id),
  quantity   NUMERIC(12, 3) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PRODUÇÃO DE OVOS / ESTOQUE DE OVOS
-- ---------------------------------------------------------------------------

CREATE TABLE egg_productions (
  id             TEXT PRIMARY KEY,
  date           TIMESTAMPTZ NOT NULL,
  flock_id       TEXT NOT NULL REFERENCES flocks (id),
  quantity       INTEGER NOT NULL,
  good_eggs      INTEGER NOT NULL,
  broken_eggs    INTEGER NOT NULL DEFAULT 0,
  dirty_eggs     INTEGER NOT NULL DEFAULT 0,
  discarded_eggs INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  responsible_id TEXT NOT NULL REFERENCES users (id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_egg_productions_flock_date ON egg_productions (flock_id, date);

CREATE TABLE egg_inventory_movements (
  id         TEXT PRIMARY KEY,
  type       egg_movement_type NOT NULL,
  size       egg_size NOT NULL,
  quantity   INTEGER NOT NULL,
  date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SAÚDE ANIMAL
-- ---------------------------------------------------------------------------

CREATE TABLE vaccinations (
  id             TEXT PRIMARY KEY,
  vaccine        TEXT NOT NULL,
  flock_id       TEXT NOT NULL REFERENCES flocks (id),
  date           TIMESTAMPTZ NOT NULL,
  quantity       INTEGER NOT NULL,
  next_dose_date TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medications (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  flock_id   TEXT NOT NULL REFERENCES flocks (id),
  quantity   NUMERIC(12, 3) NOT NULL,
  dosage     TEXT,
  reason     TEXT,
  date       TIMESTAMPTZ NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE health_records (
  id                TEXT PRIMARY KEY,
  issue             TEXT NOT NULL,
  flock_id          TEXT NOT NULL REFERENCES flocks (id),
  affected_quantity INTEGER,
  symptoms          TEXT,
  treatment         TEXT,
  date              TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mortality_records (
  id             TEXT PRIMARY KEY,
  date           TIMESTAMPTZ NOT NULL,
  flock_id       TEXT NOT NULL REFERENCES flocks (id),
  quantity       INTEGER NOT NULL,
  reason         TEXT,
  notes          TEXT,
  responsible_id TEXT NOT NULL REFERENCES users (id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mortality_records_flock_date ON mortality_records (flock_id, date);

CREATE TABLE incubations (
  id                  TEXT PRIMARY KEY,
  flock_id            TEXT NOT NULL REFERENCES flocks (id),
  incubation_date     TIMESTAMPTZ NOT NULL,
  egg_quantity        INTEGER NOT NULL,
  fertile_eggs        INTEGER,
  infertile_eggs      INTEGER,
  hatched_quantity    INTEGER,
  loss_quantity       INTEGER,
  expected_hatch_date TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- COMPRAS / VENDAS
-- ---------------------------------------------------------------------------

CREATE TABLE purchases (
  id             TEXT PRIMARY KEY,
  supplier_id    TEXT NOT NULL REFERENCES suppliers (id),
  total_value    NUMERIC(12, 2) NOT NULL,
  discount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date           TIMESTAMPTZ NOT NULL,
  payment_method TEXT,
  due_date       TIMESTAMPTZ,
  status         purchase_status NOT NULL DEFAULT 'PENDING',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_items (
  id          TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases (id),
  product     TEXT NOT NULL,
  feed_id     TEXT REFERENCES feeds (id),
  quantity    NUMERIC(12, 3) NOT NULL,
  unit_value  NUMERIC(12, 2) NOT NULL,
  total_value NUMERIC(12, 2) NOT NULL
);

CREATE TABLE sales (
  id             TEXT PRIMARY KEY,
  customer_id    TEXT NOT NULL REFERENCES customers (id),
  total_value    NUMERIC(12, 2) NOT NULL,
  discount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date           TIMESTAMPTZ NOT NULL,
  payment_method TEXT,
  status         sale_status NOT NULL DEFAULT 'PENDING',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sale_items (
  id          TEXT PRIMARY KEY,
  sale_id     TEXT NOT NULL REFERENCES sales (id),
  product     TEXT NOT NULL,
  egg_size    egg_size,
  quantity    NUMERIC(12, 3) NOT NULL,
  unit_price  NUMERIC(12, 2) NOT NULL,
  discount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12, 2) NOT NULL
);

-- ---------------------------------------------------------------------------
-- FINANCEIRO
-- ---------------------------------------------------------------------------

CREATE TABLE accounts_payable (
  id             TEXT PRIMARY KEY,
  description    TEXT NOT NULL,
  category       TEXT NOT NULL,
  purchase_id    TEXT REFERENCES purchases (id),
  value          NUMERIC(12, 2) NOT NULL,
  due_date       TIMESTAMPTZ NOT NULL,
  paid_at        TIMESTAMPTZ,
  status         payable_status NOT NULL DEFAULT 'OPEN',
  payment_method TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts_receivable (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  sale_id     TEXT REFERENCES sales (id),
  value       NUMERIC(12, 2) NOT NULL,
  due_date    TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ,
  status      receivable_status NOT NULL DEFAULT 'OPEN',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cash_flow_entries (
  id          TEXT PRIMARY KEY,
  type        cash_flow_type NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  value       NUMERIC(12, 2) NOT NULL,
  date        TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE production_costs (
  id               TEXT PRIMARY KEY,
  reference_month  TIMESTAMPTZ NOT NULL,
  feed_cost        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  medication_cost  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_cost       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  energy_cost      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  water_cost       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_cost       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- FUNCIONÁRIOS / EQUIPAMENTOS / MANUTENÇÃO
-- ---------------------------------------------------------------------------

CREATE TABLE employees (
  id         TEXT PRIMARY KEY,
  user_id    TEXT UNIQUE REFERENCES users (id),
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  phone      TEXT,
  hired_at   TIMESTAMPTZ,
  salary     NUMERIC(12, 2),
  status     employee_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  identifier  TEXT,
  shed_id     TEXT REFERENCES sheds (id),
  acquired_at TIMESTAMPTZ,
  status      equipment_status NOT NULL DEFAULT 'OPERATIONAL',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE maintenances (
  id           TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment (id),
  type         TEXT NOT NULL,
  date         TIMESTAMPTZ NOT NULL,
  responsible  TEXT,
  cost         NUMERIC(12, 2),
  next_date    TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CONTROLE AMBIENTAL
-- ---------------------------------------------------------------------------

CREATE TABLE environmental_records (
  id            TEXT PRIMARY KEY,
  shed_id       TEXT NOT NULL REFERENCES sheds (id),
  temperature   NUMERIC(5, 2),
  humidity      NUMERIC(5, 2),
  ventilation   TEXT,
  lighting      TEXT,
  water_quality TEXT,
  source        TEXT NOT NULL DEFAULT 'MANUAL',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- NOTIFICAÇÕES / ALERTAS
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  severity   notification_severity NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  category   TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
