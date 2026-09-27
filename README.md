# GRANJA OLIVEIRA — Sistema de Gestão

Sistema de gestão de granja de aves (galpões, lotes, produção de ovos,
mortalidade, rações, saúde, vendas, compras, financeiro, relatórios,
usuários e auditoria), organizado em duas aplicações independentes:

```
granja-oliveira/
├── frontend/   Interface web (Next.js 16 · React 19 · Tailwind v4 · shadcn/ui)
└── backend/    API (Next.js route handlers · node-postgres · PostgreSQL · NextAuth · RBAC)
```

| | **frontend/** (porta 3000) | **backend/** (porta 3001) |
|---|---|---|
| Contém | páginas, componentes, estilos, `public/` | rotas `/api/*`, acesso PostgreSQL, autenticação, RBAC |
| Não tem | acesso direto ao banco | nenhuma tela |
| Middleware | protege as **páginas** (login + perfil) | protege a **API** (sessão + perfil + rate limit de login) |

## Como as duas partes conversam

O navegador só enxerga **um endereço**: o do frontend. Tudo o que começa com
`/api` é repassado (rewrite em `frontend/next.config.mjs`) para o backend:

```
Navegador ──► Frontend :3000 ──(/api/*)──► Backend :3001 ──► PostgreSQL
                  │                              ▲
                  └── páginas (Server Components) ┘  fetch com o cookie do usuário
```

Consequências práticas:

- **Login/sessão:** o backend (NextAuth) assina o cookie de sessão; o frontend
  apenas o **lê** (middleware e layouts) usando o mesmo `NEXTAUTH_SECRET`.
- **Sem CORS:** como o cookie e as chamadas passam pelo mesmo domínio, não há
  configuração de CORS nem cookies cross-site.
- **O backend se protege sozinho:** sua API exige sessão e perfil mesmo se for
  acessada sem passar pelo frontend. O frontend nunca é a única barreira.
- **Dashboard:** antes consultava o banco dentro da própria página; agora a
  lógica vive em `backend/app/api/dashboard/route.js` e a página só exibe o JSON.

## Variáveis de ambiente

Três valores precisam estar **alinhados** entre os dois projetos:

| Variável | Frontend | Backend | Regra |
|---|:-:|:-:|---|
| `NEXTAUTH_SECRET` | ✔ | ✔ | **idêntico** nos dois (assina/lê a sessão) |
| `NEXTAUTH_URL` | ✔ | ✔ | **idêntico** nos dois e igual à URL **pública do frontend** |
| `BACKEND_URL` | ✔ | — | endereço do backend (ex.: `http://localhost:3001`) |
| `DATABASE_URL` | — | ✔ | conexão PostgreSQL |
| `SEED_ADMIN_*` | — | ✔ | dados do 1º administrador (só para o seed) |

> `NEXTAUTH_URL` no backend aponta para o **frontend** porque é dela que o
> backend monta os links de redefinição de senha e o QR Code dos galpões, e
> porque com `https` o cookie de sessão muda de nome (`__Secure-…`) — os dois
> lados precisam concordar.

## Rodando localmente (dois terminais)

**Terminal 1 — backend**

```bash
cd backend
npm install
cp .env.example .env          # preencha DATABASE_URL, NEXTAUTH_SECRET etc.
npm run db:migrate            # cria o schema e aplica migrations pendentes
npm run seed                  # cria o primeiro administrador
npm run dev                   # http://localhost:3001
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
cp .env.example .env.local    # mesmo NEXTAUTH_SECRET do backend!
npm run dev                   # http://localhost:3000
```

Abra http://localhost:3000 e entre com o e-mail/senha definidos em `SEED_ADMIN_*`.

> **Migrações:** rode `npm run db:migrate` no backend. A primeira execução
> cria o schema inicial quando o banco está vazio; depois aplica cada arquivo
> numerado uma única vez e registra-o em `schema_migrations`. Para instalações
> existentes, mantenha um backup antes da primeira migração de hardening.

## Produção

Publique como **dois serviços** (ex.: dois serviços no Railway, cada um com o
diretório raiz em `backend/` e `frontend/`):

1. **Backend:** `npm run build` → `npm start` (respeita a variável `PORT`).
   Rode `npm run db:migrate` antes de subir uma nova versão.
2. **Frontend:** defina `BACKEND_URL` **antes do build** (o rewrite é fixado no
   `next build`), depois `npm run build` → `npm start`.
3. Configure `NEXTAUTH_URL` (URL pública do frontend) e `NEXTAUTH_SECRET`
   (o mesmo valor) nos dois serviços.
4. Configure um segredo aleatório de pelo menos 32 caracteres em
   `NEXTAUTH_SECRET`. Para redefinição de senha em produção, configure
   `PASSWORD_RESET_DELIVERY_URL` (HTTPS) e `PASSWORD_RESET_DELIVERY_TOKEN` no
   backend. O serviço configurado recebe POST JSON `{ email, resetUrl }` com
   autenticação Bearer; sem isso, o sistema não cria nem registra tokens de
   redefinição. Use `DATABASE_MIGRATION_URL` com credencial DDL separada da
   `DATABASE_URL` usada pela aplicação sempre que possível.

## Hardening de segurança

O relatório técnico está em [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). A
migração `002_security_hardening.sql` invalida links de redefinição antigos e
revoga tokens antigos de sensores; após aplicá-la, gere novamente os tokens
IoT necessários pela área administrativa. Os novos tokens são exibidos uma
vez e armazenados somente como hash.

Sensores IoT podem enviar dados a `/api/iot/environmental-records` tanto pelo
frontend quanto direto no backend — a rota é pública e autentica por token de
sensor.

## Permissões (RBAC): atenção a um arquivo duplicado

`backend/lib/rbac.js` é a **fonte da verdade** das permissões. O frontend tem uma
cópia (`frontend/lib/rbac.js`) apenas para montar a interface (menu, redirects).
Ao alterar perfis ou seções, **altere os dois arquivos**. Ambos trazem um aviso
no topo.

## Histórico

Este projeto une o mockup visual do v0 (Next 16 / React 19 / Tailwind v4 /
shadcn) com o sistema de gestão (PostgreSQL via `pg`, autenticação, RBAC, auditoria e
~25 telas). Todas as rotas dinâmicas usam o formato assíncrono de `params`
exigido a partir do Next 15. O shell e o dashboard usam o visual escuro do v0;
as demais páginas mantêm o visual oliva/terracota original.

## Pendências sugeridas

1. Validar as migrations em ambiente de homologação com dados representativos.
2. Estender o redesign escuro do v0 às demais páginas.
3. O Next 16 avisa que `middleware.js` foi renomeado para `proxy.js`
   (`npx @next/codemod@canary middleware-to-proxy .` em cada projeto). Ainda funciona.
4. O rate limit é em memória (uma instância). Se o app escalar
   para várias instâncias, troque por um contador compartilhado (Redis/Upstash).
