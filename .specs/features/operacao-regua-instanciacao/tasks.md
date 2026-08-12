# Régua de Etapas e Instanciação — Tasks

11 tasks, 1 lote (execução inline, sem sub-agente — abaixo do limiar de oferta, e a instrução desta
sessão foi para prosseguir sem pausas de confirmação). Uma migration/commit por task de schema; tasks
de código de app agrupam por preocupação única.

| # | Task | Requisitos | Arquivos | Status |
| - | --- | --- | --- | --- |
| T1 | DDL das 3 tabelas + view, verbatim | RGI-02,03,04 | `supabase/migrations/20260812001130_regua_instanciacao_estrutura.sql` | ✅ `e643384` |
| T2 | RLS `p_por_contrato` com `WITH CHECK` explícito nas 3 tabelas | RGI-07,08 | `supabase/migrations/20260812001234_regua_instanciacao_rls.sql` | ✅ `08ff545` |
| T3 | Grants (re-run ALL TABLES + mentor/assessor específico) | — (pré-requisito operacional) | `supabase/migrations/20260812001310_regua_instanciacao_grants.sql` | ✅ `b03903f` |
| T4 | Função (verbatim) + trigger wrapper + trigger + backfill | RGI-01,05,06 | `supabase/migrations/20260812001347_regua_instanciacao_trigger_backfill.sql` | ✅ `670346a` |
| T5 | Corrige cleanup dos 6 arquivos de teste existentes (FK RESTRICT) | achado de Design | `supabase/tests/fundacao/{plataforma-tabelas,fundacao-tabelas,fundacao-rls,fn-substituir-vinculo,fn-criar-mandato,auditoria-gap}.integration.test.ts` | ✅ `4dea444` + `1f35ad8` (fix2: round-trips/timeout) |
| T6 | Corrige os 3 fluxos de exclusão do frontend (mesma FK) | achado de Design | `contratos/page.tsx`, `mandatos/page.tsx`, `mandatos/[id]/page.tsx` | ✅ `ca5be45` |
| T7 | Testes de integração novos: instanciação (trigger+backfill+idempotência) | RGI-01..06 | `supabase/tests/operacao/regua-instanciacao.integration.test.ts` | ✅ `5432d16` |
| T8 | Testes de integração novos: RLS (USING+WITH CHECK, 2 sentidos) | RGI-07,08 | `supabase/tests/operacao/regua-rls.integration.test.ts` | ✅ `29d4b59` |
| T9 | `npm run db:types` | pré-requisito de T10 | `src/backend/supabase/database.types.ts` | ✅ `7dad335` |
| T10 | Query `buscarReguaDoContrato` + unit test | RGI-09,10 (dados) | `src/backend/queries/etapa-contrato.ts` (+`.test.ts`) | ✅ `3c53a43` |
| T11 | Tela da régua — preenche o placeholder da aba de etapa | RGI-09,10 (UI) | `contratos/[id]/etapas/[codigo]/page.tsx` | ✅ `aeb7687` |

**Todas as 11 tasks concluídas.** Gate final rodado 3x (ver seção abaixo) — Verifier independente
dispatchado em seguida, relatório em `validation.md`.

**Ordem de dependência:** T1→T2→T3→T4 (schema, sequencial, cada um depende do anterior existir no
banco) → T5/T6 podem rodar em paralelo com T1-T4 (são código de app/teste, independentes do schema
até o gate final) mas logicamente só fazem sentido *depois* de T4 estar aplicado (senão não há FK nova
para quebrar nada) → T7/T8 dependem de T1-T4 aplicados → T9 depende de T1-T4 aplicados → T10 depende
de T9 → T11 depende de T10.

Execução real: T1→T2→T3→T4 (push a cada um), depois T5, T6, T7, T8 (todos podem já assumir o schema
novo), T9, T10, T11. Gate final (`lint:all`, `build`, `test:unit`, `test:integration`) depois de T11,
antes do Verifier.

## Done-when por task

- **T1**: as 3 tabelas + a view existem no dev (`supabase db push` sem erro); `CREATE TABLE IF NOT
  EXISTS` idempotente (rodar de novo não falha).
- **T2**: `pg_policies` mostra `p_por_contrato` com `qual` E `with_check` não nulos nas 3 tabelas;
  `relforcerowsecurity = true`.
- **T3**: `pg_class.relacl` mostra `legisla_app/admin/gestora` com `arwd` nas 3 tabelas + view;
  `legisla_mentor`/`legisla_assessor` com `r` onde o design especifica.
- **T4**: `INSERT INTO fat_contrato (...)` cru dispara o trigger e popula as 3 tabelas; rodar o
  backfill 2x não duplica nenhuma linha (`ON CONFLICT DO NOTHING`).
- **T5/T6**: `npm run test:integration` completo verde; exclusão de contrato via UI (verificação
  estática do código, sem UAT) não deixa mais nenhum `DELETE FROM fat_contrato` sem os 3 filhos antes.
- **T7/T8**: novos arquivos passam (`npm run test:integration`), cobrindo RGI-01 a 08 com asserção
  real (não smoke test).
- **T9**: `database.types.ts` inclui `fat_etapa_contrato`, `rel_formulario_contrato`,
  `dim_planejamento`, `vw_etapa_contrato` com colunas corretas.
- **T10**: `npm run test:unit` verde com os casos novos; `npx tsc --noEmit` limpo no arquivo (tem
  consumidor real em T11, mas checar isoladamente primeiro é mais barato de depurar).
- **T11**: `npm run build` inclui a rota sem erro; leitura de código confirma Badge de atraso vindo de
  `esta_atrasada` da view (nunca recalculado), e que a tabela renderiza com todas as etapas
  `nao_iniciada` sem tratar como erro/vazio.

## Gate Check — resultado real

- `npm run test:unit`: 115/115 ✅ (13 arquivos, incluindo os 4 novos de `etapa-contrato.test.ts`).
- `npm run build`: ✅, rota `/contratos/[id]/etapas/[codigo]` presente.
- `npm run lint:all`: 27 problemas (13 erro, 14 warning) — mesma baseline pré-existente documentada em
  handoffs anteriores; nenhum nos arquivos desta feature.
- `npm run test:integration` (suíte completa): rodada 3x nesta sessão.
  - Rodada 1 (antes do fix2): 3 suítes com hook/test timeout (30s padrão) em
    `plataforma-tabelas`/`fundacao-tabelas`/`auditoria-gap` — causa: os 3 `DELETE` novos da T5, cada
    um um round-trip próprio via Management API, empurraram fixtures já perto do limite. Nenhum
    `23503` (a FK em si nunca falhou). Corrigido no commit `1f35ad8` (round-trips combinados +
    timeout explícito).
  - Rodada 2 (arquivo a arquivo, pós-fix2): todos os 8 arquivos tocados por esta feature, verdes.
  - Rodada 3 (suíte completa, pós-fix2): 224/229 ✅. As 5 falhas restantes são **de outra feature**
    (`convite/fn-consumir-convite.integration.test.ts`, 4 falhas por `23505` em dados da própria
    fixture — reproduzido: passa 8/8 isolado, então era pool de dados compartilhado/execução
    concorrente com a sessão paralela de `convite-contrato`, não algo desta feature) + 1 timeout
    isolado em `auditoria-gap > audits ... on dim_contratante` (tabela nunca tocada por esta
    feature — reproduzido: passa isolado, 18.9s). Nenhuma falha relacionada a `fat_etapa_contrato`,
    `rel_formulario_contrato`, `dim_planejamento`, ao trigger ou às 3 tabelas RLS desta feature.
