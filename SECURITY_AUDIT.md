# Relatório de vistoria de segurança

## Escopo e limites

Vistoria estática do ZIP fornecido: frontend Next.js, API Next.js, rotas, RBAC, autenticação, SQL e migrations. Foram revisadas as 49 rotas de API listadas no projeto. As rotas de dados usam validação de sessão e seção no backend; as exceções são autenticação/recuperação e ingestão IoT, que têm fluxos próprios. Não havia banco, variáveis reais de produção nem histórico Git disponíveis; por isso não foi possível verificar privilégios efetivos do PostgreSQL, dados já armazenados, logs do provedor ou exposição em repositórios remotos.

O projeto é uma aplicação PostgreSQL de uma única granja, com acesso ao banco feito pelo backend via `pg`. Não usa Supabase. O schema não habilita RLS; o controle atual acontece no servidor por sessão e RBAC, e os registros são compartilhados pela granja, não pertencem individualmente a um usuário. Criar políticas RLS por `user_id` sem essa regra de negócio bloquearia ou alteraria o funcionamento atual. Recomenda-se revisar a credencial de runtime no banco e usar `DATABASE_MIGRATION_URL` separada com DDL, deixando `DATABASE_URL` com privilégios mínimos.

## 🔴 Crítico

Nenhum achado crítico confirmado nesta revisão está sem mitigação no código.

## 🟠 Alto

### 1. Link de redefinição de senha exposto e token em texto puro

- **Local:** `backend/app/api/auth/forgot-password/route.js`, `backend/app/api/auth/reset-password/route.js`, tabela `password_reset_tokens`.
- **Problema e risco:** a implementação anterior imprimia o link completo, contendo um token válido para troca de senha, nos logs do servidor e gravava o token em texto puro no banco. Quem obtivesse acesso a logs ou dump do banco poderia redefinir a senha da conta durante a validade do link.
- **Como explorar:** obter o URL de redefinição em logs acessíveis ou ler o valor `token` na tabela e enviá-lo à rota de redefinição.
- **Correção aplicada:** não há mais log do link; o banco guarda SHA-256 do token; tokens antigos são invalidados; o reset usa transação e bloqueio da linha para impedir reutilização concorrente; redefinir senha revoga sessões anteriores. O token novo vai no fragmento da URL, que não é enviado em requisições HTTP nem em cabeçalhos Referer.
- **Entrega de e-mail:** o ZIP não tinha provedor de e-mail, apenas o log do link. Agora a API só emite o token quando `PASSWORD_RESET_DELIVERY_URL` e `PASSWORD_RESET_DELIVERY_TOKEN` estão configurados; em produção a URL exige HTTPS. Sem essa integração, a rota não cria um link inalcançável.

### 2. Alertas financeiros visíveis para qualquer perfil autenticado

- **Local:** `backend/app/api/notifications/route.js` e `backend/app/api/dashboard/route.js`.
- **Problema e risco:** antes, o `GET` buscava todas as notificações persistidas sem filtrar `category`; empregados podiam ler mensagens sobre contas a pagar e receber, mesmo sem acesso à seção financeira. O `PATCH` também permitia marcar qualquer alerta como lido pelo ID.
- **Como explorar:** uma sessão EMPLOYEE poderia chamar `/api/notifications` diretamente e receber as mensagens financeiras; IDs de outros alertas também podiam ser enviados ao `PATCH`.
- **Correção aplicada:** categorias são mapeadas para seções RBAC; notificações e alertas do dashboard filtram pelo papel atual, e alterações aceitam somente categorias autorizadas. Categorias desconhecidas falham fechadas. Testes cobrem os casos de perfil empregado, financeiro, administrador e IDs de alertas ao vivo.

### 3. Token IoT persistido em texto puro

- **Local:** tabela `sheds`, `backend/app/api/sheds/[id]/device-token/route.js`, `backend/app/api/iot/environmental-records/route.js`.
- **Problema e risco:** o token concede escrita anônima de medições ambientais; armazená-lo em texto puro permitia usá-lo diretamente após exposição do banco.
- **Como explorar:** ler `device_token` no banco e enviar medições com `x-device-token` para a API pública de sensores.
- **Correção aplicada:** tokens novos são armazenados como SHA-256 e comparados por hash; o valor original é retornado apenas ao administrador no momento da geração. A migration remove valores antigos dos snapshots de auditoria. A ingestão valida faixas numéricas e limita chamadas por token.

### 4. Papel e estado da conta podiam ficar desatualizados na sessão

- **Local:** `backend/lib/auth.js`, `backend/app/api/users/[id]/route.js`.
- **Problema e risco:** o papel era confiado a partir do JWT até a expiração (oito horas). Desativar ou rebaixar uma conta não revogava imediatamente as sessões emitidas antes da alteração.
- **Como explorar:** manter uma sessão de administrador e continuar chamando APIs protegidas após a conta ser desativada/rebaixada.
- **Correção aplicada:** a sessão recarrega papel e estado da conta no banco; conta inativa/excluída perde acesso. Alterar papel, estado ou senha incrementa `auth_version`; redefinir senha também o incrementa para invalidar sessões existentes.

## 🟡 Médio

### Limitação do rate limit

O limitador do projeto é em memória; protege uma instância, mas não coordena várias instâncias e usa `x-forwarded-for`, cujo valor depende da configuração do proxy. O mapa agora remove entradas vencidas e tem tamanho máximo para evitar crescimento sem limite, mas implantação escalada deve usar armazenamento compartilhado (por exemplo, Redis) e confiar apenas em cabeçalhos definidos pelo proxy confiável.

### RLS, privilégios do banco e isolamento dos dados

Não há RLS nem roles/grants do PostgreSQL versionados. O backend é responsável por autorizar rotas com RBAC; o banco é de uso compartilhado para uma única granja. Sem acesso à instância não dá para afirmar se a conta em `DATABASE_URL` é proprietária/superusuária ou se tem privilégios menores. Configurar uma credencial de runtime sem DDL e manter uma credencial de migration separada.

### Constraints e índices

O schema usa ENUMs, `NUMERIC` para valores financeiros e várias chaves estrangeiras, mas várias validações estão somente na API e não há `CHECK` constraints para intervalos de medidas/quantidades. Não foram adicionadas constraints amplas nem índices especulativos: sem inspecionar dados reais ou planos `EXPLAIN`, isso poderia rejeitar dados existentes ou aumentar o custo de escrita. A ingestão IoT agora valida temperatura e umidade na API.

## 🟢 Baixo / itens confirmados como adequados

- Senhas de usuário são armazenadas com bcrypt (custo 12) e nunca retornadas pelos endpoints de usuários.
- Nenhuma chave `service_role`, chave administrativa ou segredo real foi encontrada no código do ZIP. Os arquivos `.env.example` contêm apenas valores ilustrativos.
- As rotas de exclusão de usuários e galpões fazem soft delete; as demais rotas de registro não expõem exclusão física.
- A maioria das relações estruturais inspecionadas tem Foreign Keys; valores monetários usam `NUMERIC`, não ponto flutuante.
- As APIs principais aplicam autorização server-side por sessão e RBAC. O frontend também oculta páginas, mas não é usado como única barreira de dados.

## Arquivos alterados

- `backend/lib/auth.js`: revalidação do perfil e invalidação de sessão.
- `backend/app/api/auth/forgot-password/route.js`, `backend/app/api/auth/reset-password/route.js` e `frontend/app/redefinir-senha/page.jsx`: entrega configurável, token em hash, fragmento de URL e consumo atômico.
- `backend/app/api/notifications/route.js`, `backend/app/api/dashboard/route.js` e `backend/lib/notificationAccess.mjs`: leitura e alteração de alertas por seção.
- `backend/app/api/sheds/[id]/device-token/route.js`, `backend/app/api/sheds/[id]/route.js` e `backend/app/api/iot/environmental-records/route.js`: token IoT em hash, limpeza de snapshots, validação e limitação.
- `backend/app/api/users/[id]/route.js`: revogação após mudança de acesso.
- `backend/sql/schema.sql`, `backend/sql/migrations/002_security_hardening.sql` e `backend/scripts/migrate.js`: versão de sessão, hash de token e registro incremental das migrations.

## Validação executada

`node --test backend/tests/security-hardening.test.mjs`: 2 testes passaram, 0 falharam. Não foi possível validar migrations contra um PostgreSQL real nem executar build do Next.js sem banco/configuração e dependências instaladas.
