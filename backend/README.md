# Backend — Granja Oliveira

API do sistema: rotas `/api/*` (Next.js route handlers) · Prisma 5 + PostgreSQL ·
NextAuth (JWT) · RBAC · auditoria. Não possui telas.

```bash
npm install
cp .env.example .env          # DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET…
npx prisma generate
npm run prisma:migrate        # 1ª vez (não há migrações versionadas ainda)
npm run seed                  # 1º administrador
npm run dev                   # http://localhost:3001
```

## Estrutura

```
app/api/              45 rotas (uma pasta por recurso: flocks, sheds, sales, dashboard…)
lib/
├── auth.js           NextAuth: login, bloqueio de conta, auditoria de login
├── apiAuth.js        requireSection(): sessão + permissão em cada rota
├── rbac.js           FONTE DA VERDADE das permissões (front tem uma cópia)
├── prisma.js         cliente do banco
└── rateLimit.js      limite de tentativas (em memória)
prisma/               schema.prisma e seed.js
middleware.js         protege /api/* (sessão, /api/users, rate limit de login)
```

## Como proteger uma rota nova

```js
import { SECTIONS } from '@/lib/rbac';
import { requireSection } from '@/lib/apiAuth';

export async function GET() {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;
  // ...
}
```

`NEXTAUTH_URL` aqui deve ser a **URL pública do frontend** e `NEXTAUTH_SECRET`
deve ser **idêntico** ao do frontend. Para rodar em produção, `npm start` usa a
variável `PORT`; localmente use `PORT=3001 npm start` (o `npm run dev` já usa 3001).
