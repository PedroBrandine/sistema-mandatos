# Sistema Mandatos (Legisla)

Sistema de gestão de mandatos, contratos e planejamento para consultoria
política. Stack: Next.js App Router + TypeScript, Tailwind + shadcn/ui,
Supabase (Postgres + Auth + RLS), React Hook Form + Zod, hospedagem Vercel
(AD-021 em `.specs/STATE.md`).

## Onde fica cada coisa

| Caminho | Conteúdo |
| --- | --- |
| `src/frontend/app/` | Rotas Next.js App Router. `(app)/` = telas autenticadas (mandatos, coalizões, contratos, usuários); `admin/acesso/` = bypass dev-only de login; `auth/`, `login/` = fluxo de autenticação |
| `src/frontend/components/` | Componentes React, inclusive `components/ui/` (shadcn/Radix) |
| `src/backend/schemas/` | Validação Zod (fonte de verdade dos formulários) |
| `src/backend/rpc/` | Chamadas a functions/RPC do Postgres |
| `src/backend/queries/` | Leituras diretas (inclui espelho TSE) |
| `src/backend/supabase/` | Clientes Supabase: `client.ts` (browser), `server.ts` (SSR), `admin.ts` (service_role, nunca no client), `database.types.ts` (gerado) |
| `supabase/migrations/` | Migrations SQL — única forma permitida de alterar o schema |
| `docs/schema_sistema.sql` | Modelo de dados **aprovado** (51 tabelas lógicas). Fonte de verdade do desenho; o banco real é provisionado incrementalmente a partir dele (AD-025 em `.specs/STATE.md`) |
| `docs/ambientes.md` | **Fonte de verdade operacional** dos dois ambientes (refs, chaves, deploy, CI/CD) — leia antes de mexer em banco ou deploy |
| `docs/fluxo-de-trabalho.md` | Como uma mudança chega em produção: ciclo de código, ciclo de schema, checklist de release, backup, o que fazer quando falha |
| `.specs/` | Desenvolvimento guiado por spec (skill `tlc-spec-driven`): `overview.md` (arquitetura), `STATE.md` (decisões AD-XXX + handoffs), `roadmap.md` (plano de execução), `features/<nome>/` (spec/design/tasks/validation por feature) |
| `DADOS TSE/` | Carga e dicionário de dados do espelho TSE (schema `tse.*`, read-only) |
| `scripts/` | `gerar-link-acesso.ts`, `provisionar-senhas.ts` — provisionamento manual de usuários |

Não existe `tsconfig.json` na raiz — `src/backend/**` só é type-checado quando
tem consumidor no frontend. Para arquivos novos sem consumidor ainda, rode
`npx tsc --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM`
manualmente antes de dar como pronto.

## Comandos

```bash
npm run dev              # Next.js local (aponta pro Supabase de dev)
npm run lint:all         # lint da raiz + do frontend
npm run test:unit        # vitest, unitário
npm run test:integration # vitest, bate no Supabase cloud de dev (sem Docker local)
npm run build
npm run db:types         # regenera src/backend/supabase/database.types.ts a partir do projeto linkado
```

## Ambientes — regra de ouro

Dois projetos Supabase distintos. **Antes de qualquer `db push`, `config push`
ou `db reset`, confira qual está linkado** (`cat supabase/.temp/project-ref`)
— detalhes completos, chaves e passo a passo em `docs/ambientes.md`.

| | Dev | Produção |
| --- | --- | --- |
| Branch | `develop` (e qualquer outra) | `master` |
| Deploy | automático a cada push | automático a cada push, via merge em `master` |
| Banco | dados de teste | dados de negócio reais |

**Toda mudança de schema nasce como arquivo em `supabase/migrations/` e chega
ao banco por `supabase db push`. O SQL Editor do Supabase é somente leitura.**
Não é preferência de estilo: seis divergências entre dev e prod nasceram de SQL
rodado à mão que nunca virou arquivo, e uma delas derrubou a produção inteira.
Nenhuma era visível pelo `supabase migration list`, que compara a tabela de
histórico e não o schema.

- Migrations são **forward-only**: correção é arquivo novo, nunca editar uma
  já aplicada — nem em dev.
- Arquivo novo se cria com `supabase migration new <nome>`, que gera prefixo de
  timestamp. O padrão manual `00NN_` produziu dois `0023` e foi aposentado; os
  arquivos antigos ficam como estão.
- **Você nunca roda `db push` em produção.** O `deploy-db.yml` faz isso ao
  receber o merge em `master`, e só se o CI daquele commit estiver verde.
- `SUPABASE_SERVICE_ROLE_KEY` nunca leva prefixo `NEXT_PUBLIC_` (AD-009) — ela
  ignora RLS por completo.
- Produção não recebe seed (`supabase/seed_test.sql` é só para dev).

Antes de abrir PR para `master`, rode o checklist de release em
`docs/fluxo-de-trabalho.md`.

## Trabalhando em uma feature nova

Este projeto usa a skill `tlc-spec-driven`. Antes de implementar algo não
trivial, leia `.specs/STATE.md` (decisões arquiteturais ativas, prefixo AD-) e
`.specs/roadmap.md` (o que já foi feito e o que vem a seguir). Specs de
features individuais ficam em `.specs/features/<nome>/`.
