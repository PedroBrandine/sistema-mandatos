# Régua de Etapas e Instanciação — Tasks

11 tasks, 1 lote (execução inline, sem sub-agente — abaixo do limiar de oferta, e a instrução desta
sessão foi para prosseguir sem pausas de confirmação). Uma migration/commit por task de schema; tasks
de código de app agrupam por preocupação única.

| # | Task | Requisitos | Arquivos |
| - | --- | --- | --- |
| T1 | DDL das 3 tabelas + view, verbatim | RGI-02,03,04 | `supabase/migrations/<ts>_regua_instanciacao_estrutura.sql` |
| T2 | RLS `p_por_contrato` com `WITH CHECK` explícito nas 3 tabelas | RGI-07,08 | `supabase/migrations/<ts>_regua_instanciacao_rls.sql` |
| T3 | Grants (re-run ALL TABLES + mentor/assessor específico) | — (pré-requisito operacional) | `supabase/migrations/<ts>_regua_instanciacao_grants.sql` |
| T4 | Função (verbatim) + trigger wrapper + trigger + backfill | RGI-01,05,06 | `supabase/migrations/<ts>_regua_instanciacao_trigger_backfill.sql` |
| T5 | Corrige cleanup dos 6 arquivos de teste existentes (FK RESTRICT) | achado de Design | `supabase/tests/fundacao/{plataforma-tabelas,fundacao-tabelas,fundacao-rls,fn-substituir-vinculo,fn-criar-mandato,auditoria-gap}.integration.test.ts` |
| T6 | Corrige os 3 fluxos de exclusão do frontend (mesma FK) | achado de Design | `contratos/page.tsx`, `mandatos/page.tsx`, `mandatos/[id]/page.tsx` |
| T7 | Testes de integração novos: instanciação (trigger+backfill+idempotência) | RGI-01..06 | `supabase/tests/operacao/regua-instanciacao.integration.test.ts` |
| T8 | Testes de integração novos: RLS (USING+WITH CHECK, 2 sentidos) | RGI-07,08 | `supabase/tests/operacao/regua-rls.integration.test.ts` |
| T9 | `npm run db:types` | pré-requisito de T10 | `src/backend/supabase/database.types.ts` |
| T10 | Query `buscarReguaDoContrato` + unit test | RGI-09,10 (dados) | `src/backend/queries/etapa-contrato.ts` (+`.test.ts`) |
| T11 | Tela da régua — preenche o placeholder da aba de etapa | RGI-09,10 (UI) | `contratos/[id]/etapas/[codigo]/page.tsx` |

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
