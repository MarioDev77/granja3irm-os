// ATENÇÃO: esta é a FONTE DA VERDADE das permissões. O front-end mantém uma
// cópia em frontend/lib/rbac.js só para montar a interface (menu, redirects).
// Se você mudar permissões aqui, replique no front-end.
//
// ============================================================================
// RBAC — Controle de acesso baseado em funções
//
// Este módulo é a fonte única de verdade sobre quem pode fazer o quê.
// Ele é usado tanto no middleware (proteção de rotas de página) quanto
// dentro das API routes (proteção de dados) — nunca confie apenas no
// frontend para esconder algo que o backend não bloqueia.
// ============================================================================

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
};

export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Funcionário',
  FINANCE: 'Financeiro',
};

// Seções do sistema. Módulos futuros (galpões, lotes, vendas, etc.) devem
// registrar sua chave aqui à medida que forem implementados nas próximas
// fases, mantendo esta tabela como o único lugar que define permissões.
export const SECTIONS = {
  DASHBOARD: 'DASHBOARD',
  USERS: 'USERS',
  SETTINGS: 'SETTINGS',
  PRODUCTION: 'PRODUCTION',
  STOCK: 'STOCK',
  HEALTH: 'HEALTH',
  PURCHASES: 'PURCHASES',
  SALES: 'SALES',
  FINANCE: 'FINANCE',
  REPORTS: 'REPORTS',
  AUDIT: 'AUDIT',
};

// Matriz de permissões por perfil, conforme definido no escopo do sistema
// (seção 4). "true" = pode acessar a seção; ausência = sem acesso.
const PERMISSION_MATRIX = {
  [ROLES.ADMIN]: new Set(Object.values(SECTIONS)),
  [ROLES.MANAGER]: new Set([
    SECTIONS.DASHBOARD,
    SECTIONS.PRODUCTION,
    SECTIONS.STOCK,
    SECTIONS.HEALTH,
    SECTIONS.PURCHASES,
    SECTIONS.SALES,
    SECTIONS.REPORTS,
  ]),
  [ROLES.EMPLOYEE]: new Set([SECTIONS.DASHBOARD, SECTIONS.PRODUCTION, SECTIONS.STOCK, SECTIONS.HEALTH]),
  [ROLES.FINANCE]: new Set([
    SECTIONS.DASHBOARD,
    SECTIONS.SALES,
    SECTIONS.PURCHASES,
    SECTIONS.FINANCE,
    SECTIONS.REPORTS,
  ]),
};

export function can(role, section) {
  if (!role || !PERMISSION_MATRIX[role]) return false;
  return PERMISSION_MATRIX[role].has(section);
}

export function assertCan(role, section) {
  if (!can(role, section)) {
    const error = new Error('Acesso negado: você não tem permissão para esta ação.');
    error.status = 403;
    throw error;
  }
}

export function isAdmin(role) {
  return role === ROLES.ADMIN;
}
