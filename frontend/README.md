# Frontend — Granja Oliveira

Interface web: Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (base-nova) · Recharts.

```bash
npm install
cp .env.example .env.local   # BACKEND_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
npm run dev                  # http://localhost:3000  (precisa do backend em :3001)
```

## Estrutura

```
app/
├── (app)/            páginas autenticadas (dashboard, galpões, lotes, vendas…)
├── login/  recuperar-senha/  redefinir-senha/   páginas públicas
├── layout.tsx  page.tsx  globals.css
components/           AppShell, dashboard-view, StatCard… e ui/ (shadcn)
lib/
├── session.js        lê a sessão (cookie JWT) nos Server Components
├── backend.js        fetch ao backend no servidor, repassando o cookie
├── rbac.js           CÓPIA de backend/lib/rbac.js (só para a interface)
├── reportExport.js   exportação CSV/PDF (roda no navegador)
└── utils.ts          cn()
middleware.js         protege as páginas (login + perfil)
next.config.mjs       rewrite: /api/* → BACKEND_URL
```

## Regras de ouro

- **Não importe nada do backend** (`@prisma/client`, `bcryptjs`, `lib/auth`…).
  Para dados, chame `fetch('/api/...')` (no navegador) ou `backendFetch()`
  (em Server Components).
- Para saber quem está logado num Server Component use `getSession()` de
  `@/lib/session`.
- `BACKEND_URL` é lido no **build** (rewrite): defina-a também no ambiente de deploy.
