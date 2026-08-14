# Formulários dos Produtos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/formularios-produto/design.md`
**Status**: In Progress — Lote A pausado em T4 (ver `.specs/STATE.md`, Handoff "Formulários dos
Produtos"). T1 ✅ (`337baa9`), T2 ✅ (`11d17e9`), T3 ✅ (`1a44446`), T4 ⏸️ escrito, gate bloqueado por
disco cheio na máquina — não commitado. T5-T21 não iniciadas.

---

## Test Coverage Matrix

> Gerado a partir do código (amostra de `supabase/tests/kanban/`, `supabase/tests/operacao/`,
> `src/backend/queries/*.test.ts`, `src/backend/rpc/*.test.ts`) e de `CLAUDE.md`. Nenhum
> `AGENTS.md`/`CONTRIBUTING.md` com limiar de cobertura numérico foi encontrado — aplicado o
> critério já em uso no repositório (mesma profundidade das features anteriores), não o default
> genérico da skill.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema (DDL puro: tabelas/índices/views sem comportamento condicional) | none | Build gate só — estrutura não tem branch a testar | `supabase/migrations/*.sql` | `npm run build` (drift confirmado no CI) |
| RLS + GRANT + triggers (comportamento condicional por papel) | integration | 1 teste por papel × operação relevante (admin/gestora permitido, mentor/assessor negado onde aplicável) + trigger de extração/derivação disparando corretamente + faixa de valor do GIP + `uq_gip_contrato_momento` | `supabase/tests/operacao/formularios-*.integration.test.ts` | `npm run test:integration` |
| Backend queries (`src/backend/queries/formulario.ts`) | unit | 1:1 por função pública, client mockado, cobre os ramos de filtro por papel (FRM-14) | `src/backend/queries/formulario.test.ts` | `npm run test:unit` |
| Backend RPC wrapper (`src/backend/rpc/formulario.ts`) | unit | Sucesso + erro mapeado (mesmo padrão de `rpc/vinculo.test.ts`) | `src/backend/rpc/formulario.test.ts` | `npm run test:unit` |
| Frontend (componentes, hook, rotas) | none | Sem harness de componente no projeto (débito conhecido, L-006/L-007) — coberto só por `build`+`lint` | `src/frontend/**` | `npm run build && npm run lint:all` |

## Gate Check Commands

> Gerado a partir de `package.json`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Depois de task só com teste unitário (queries/rpc TS) | `npm run test:unit` |
| Full | Depois de task de schema com comportamento (RLS/GRANT/trigger) | `npm run test:unit && npm run test:integration` |
| Build | Fim de fase, ou task só de DDL/frontend | `npm run build && npm run lint:all` |

---

## Execution Plan

Phases são ordenadas e rodam em sequência — cada fase completa antes da próxima começar, e as
tasks dentro de uma fase executam em ordem.

### Phase 1: Schema — mecanismo genérico (`fat_submissao`/`fat_resposta_metrica`)

```
T1 → T2 → T3 → T4
```

### Phase 2: Schema — GIP sob medida (`fat_gip`/`fat_gip_dimensao`)

```
T5 → T6 → T7 → T8 → T9
```

### Phase 3: Schema + backend — NPS agregado

```
T10 → T11
```

### Phase 4: Backend TS (types, queries, hook)

```
T12 → T13 → T14 → T15
```

### Phase 5: Frontend — lista + abrir/fechar

```
T16 → T17
```

### Phase 6: Frontend — resposta genérica

```
T18 → T19
```

### Phase 7: Frontend — GIP + NPS card

```
T20 → T21
```

---

## Task Breakdown

### T1: DDL `fat_submissao` + `fat_resposta_metrica`

**What**: Migration com as 2 tabelas verbatim (`docs/schema_sistema.sql:747-783`), incluindo o
índice único parcial `uq_submissao_respondente`.
**Where**: `supabase/migrations/<timestamp>_formularios_produto_estrutura.sql`
**Depends on**: None
**Reuses**: nenhuma tabela existente é alterada — checar antes (AD-025) que nenhuma das 2 já existe.
**Requirement**: FRM-06, FRM-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `supabase migration new` gera o arquivo com prefixo de timestamp correto
- [ ] `supabase db push` aplica sem erro no projeto de dev linkado (confirmar `project-ref` antes)
- [ ] `npm run build` (drift check mental — DDL puro)

**Tests**: none
**Gate**: build

---

### T2: RLS `fat_submissao` + `fat_resposta_metrica`

**What**: `p_por_contrato` em `fat_submissao` (com cláusula extra de autoria no `WITH CHECK`:
`id_usuario_respondente = app.id_usuario() OR app.papel_atual() IN ('admin','gestora')`) +
`p_heranca` (EXISTS contra `fat_submissao`) em `fat_resposta_metrica`. `FORCE ROW LEVEL SECURITY`
nas 2.
**Where**: `supabase/migrations/<timestamp>_formularios_produto_rls.sql`
**Depends on**: T1
**Reuses**: texto de policy de `20260813192341_incidencia_encontros_rls.sql` (`p_por_contrato`/`p_heranca`)
**Requirement**: FRM-12, FRM-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `ENABLE`/`FORCE ROW LEVEL SECURITY` nas 2 tabelas
- [ ] Policy criada com a cláusula de autoria exata (design.md, Tech Decisions)
- [ ] `supabase db push` aplica sem erro

**Tests**: none (behavior testado em T4)
**Gate**: build

---

### T3: Grants `fat_submissao` + `fat_resposta_metrica`

**What**: Re-GRANT explícito (AD-025) — `legisla_app`/`legisla_admin`/`legisla_gestora`: full nas 2
tabelas + sequences. `legisla_mentor`/`legisla_assessor`: `SELECT, INSERT, UPDATE` só em
`fat_submissao` (igual ao schema aprovado `:2082`/`:2094`), **nenhum** grant em
`fat_resposta_metrica`.
**Where**: `supabase/migrations/<timestamp>_formularios_produto_grants.sql`
**Depends on**: T1
**Reuses**: padrão de `20260812001310_regua_instanciacao_grants.sql`
**Requirement**: FRM-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Grants aplicados conforme design.md
- [ ] `supabase db push` aplica sem erro

**Tests**: none (behavior testado em T4)
**Gate**: build

---

### T4: Trigger `app.trg_extrai_metricas()` (`SECURITY DEFINER`) + testes de integração da Fase 1

**What**: Cria a função verbatim (`docs/schema_sistema.sql:1836-1856`) já como
`SECURITY DEFINER SET search_path = public, pg_temp` (conforma AD-035, não verbatim puro — desvio
documentado), cria o trigger `trg_submissao_metricas`, e escreve os testes de integração de toda a
Fase 1 (merge-forward: só agora RLS+GRANT+trigger existem juntos para testar de ponta a ponta).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_trigger_metricas.sql` +
`supabase/tests/operacao/formularios-submissao.integration.test.ts`
**Depends on**: T1, T2, T3
**Reuses**: `app.trg_auditoria()` como precedente de `SECURITY DEFINER` (AD-035)
**Requirement**: FRM-03, FRM-08, FRM-09, FRM-10, FRM-11, FRM-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Assessor/Mentor conseguem INSERT em `fat_submissao` do seu próprio formulário sem `42501`
- [ ] Trigger popula `fat_resposta_metrica` a partir de `ref_metrica_formulario` (caso com NPS)
- [ ] Reenvio (UPDATE de `respostas`) repovoa `fat_resposta_metrica` (delete+reinsert)
- [ ] Mentor/Assessor negados tentando gravar `id_usuario_respondente` diferente do próprio
- [ ] Admin/Gestora conseguem UPDATE numa linha de outro respondente (reabertura, FRM-11)
- [ ] Formulário fechado (`rel_formulario_contrato.estado='fechado'`) bloqueia INSERT
- [ ] Contrato encerrado bloqueia INSERT novo
- [ ] `npm run test:unit && npm run test:integration` verde, contagem de testes documentada no commit

**Tests**: integration
**Gate**: full

---

### T5: DDL `fat_gip` + `fat_gip_dimensao`

**What**: Migration com as 2 tabelas verbatim (`docs/schema_sistema.sql:983-1022`).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_gip_estrutura.sql`
**Depends on**: T1 (FK `fat_gip.id_submissao → fat_submissao`)
**Reuses**: nenhuma
**Requirement**: FRM-15, FRM-16, FRM-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `supabase db push` aplica sem erro
- [ ] `ref_dimensao_gip` já provisionada confirmada antes (AD-025 — checar, não assumir)

**Tests**: none
**Gate**: build

---

### T6: RLS `fat_gip` + `fat_gip_dimensao`

**What**: `p_por_contrato` em `fat_gip` (sem cláusula de autoria — não tem coluna de respondente
próprio) + `p_heranca` em `fat_gip_dimensao` (EXISTS contra `fat_gip`).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_gip_rls.sql`
**Depends on**: T5
**Reuses**: mesmo padrão de T2
**Requirement**: FRM-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `ENABLE`/`FORCE ROW LEVEL SECURITY` + policies criadas
- [ ] `supabase db push` aplica sem erro

**Tests**: none (testado em T9)
**Gate**: build

---

### T7: Grants `fat_gip` + `fat_gip_dimensao`

**What**: `legisla_app`/`legisla_admin`/`legisla_gestora`: full. **Nenhum** grant a
`legisla_mentor`/`legisla_assessor` (só a derivação via trigger `SECURITY DEFINER` escreve).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_gip_grants.sql`
**Depends on**: T5
**Reuses**: padrão de T3
**Requirement**: FRM-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Grants aplicados conforme design.md
- [ ] `supabase db push` aplica sem erro

**Tests**: none (testado em T9)
**Gate**: build

---

### T8: `app.trg_deriva_gip()` (nova, `SECURITY DEFINER`) + trigger

**What**: Cria a função de derivação (design.md, Data Models) e o trigger `trg_submissao_gip`
`AFTER INSERT OR UPDATE OF respostas ON fat_submissao`.
**Where**: `supabase/migrations/<timestamp>_formularios_produto_gip_trigger.sql`
**Depends on**: T5, T6, T7
**Reuses**: `app.trg_valida_gip_dimensao` (já existe, reaproveitada sem alteração)
**Requirement**: FRM-15, FRM-16, FRM-17, FRM-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Função criada exatamente como em design.md, `SECURITY DEFINER SET search_path`
- [ ] `supabase db push` aplica sem erro

**Tests**: none (testado em T9)
**Gate**: build

---

### T9: `vw_gip_evolucao` + testes de integração da Fase 2

**What**: Cria a view verbatim (`docs/schema_sistema.sql:1359-1370`) e escreve os testes de
integração de toda a Fase 2 (merge-forward — só agora DDL+RLS+grants+trigger+view existem juntos).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_gip_view.sql` +
`supabase/tests/operacao/formularios-gip.integration.test.ts`
**Depends on**: T5, T6, T7, T8
**Reuses**: nenhuma
**Requirement**: FRM-15, FRM-16, FRM-17, FRM-18, FRM-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] GIP momento='inicio' grava `fat_gip` + 4 linhas `fat_gip_dimensao` (`eixo='regua_sonhos'`)
- [ ] GIP momento='meio'/'fim' grava `fat_gip_dimensao` (`eixo='onde_chegamos'`)
- [ ] Reaplicar o mesmo momento não cria 2ª linha (`ON CONFLICT` funcionando)
- [ ] Valor de dimensão fora de 1-4 rejeitado pelo trigger existente
- [ ] `vw_gip_evolucao` expõe `regua_sonhos`/`onde_chegamos`/`gap` corretos após inicio+meio aplicados
- [ ] `npm run test:unit && npm run test:integration` verde, contagem de testes documentada

**Tests**: integration
**Gate**: full

---

### T10: DDL `mv_avaliacao_nps` + grants

**What**: Materialized view verbatim (`docs/schema_sistema.sql:1272-1297`, `WITH NO DATA`) + índice
único + `GRANT SELECT` só para `legisla_app`/`legisla_admin`/`legisla_gestora` (FRM-23 — nunca
mentor/assessor).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_nps_estrutura.sql`
**Depends on**: T1, T4 (depende de `fat_resposta_metrica` populável)
**Reuses**: nenhuma
**Requirement**: FRM-20

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `supabase db push` aplica sem erro

**Tests**: none (testado em T11)
**Gate**: build

---

### T11: `app.atualiza_avaliacao_nps()` + testes de integração da Fase 3

**What**: RPC `SECURITY DEFINER` de refresh (design.md, Data Models) + testes de integração:
agregação correta após ≥2 submissões de NPS, refresh funciona pra Gestora, e Mentor/Assessor
negados lendo a MV (FRM-23).
**Where**: `supabase/migrations/<timestamp>_formularios_produto_nps_refresh.sql` +
`supabase/tests/operacao/formularios-nps.integration.test.ts`
**Depends on**: T10
**Reuses**: nenhuma
**Requirement**: FRM-20, FRM-21, FRM-23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `app.atualiza_avaliacao_nps()` executa `REFRESH ... CONCURRENTLY` sem erro
- [ ] Após refresh, `mv_avaliacao_nps` mostra score/promotores/neutros/detratores corretos pro
      cenário de teste (≥2 submissões de NPS conhecidas)
- [ ] Mentor e Assessor recebem erro de permissão lendo `mv_avaliacao_nps` diretamente
- [ ] `npm run test:unit && npm run test:integration` verde, contagem de testes documentada

**Tests**: integration
**Gate**: full

---

### T12: `npm run db:types`

**What**: Regenera `database.types.ts` a partir do projeto linkado, agora incluindo `fat_submissao`,
`fat_resposta_metrica`, `fat_gip`, `fat_gip_dimensao`, `mv_avaliacao_nps`, `vw_gip_evolucao`.
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T4, T9, T11 (toda a fatia de schema desta feature já aplicada)
**Reuses**: script já existente (`package.json`)
**Requirement**: — (infraestrutura de tipos)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Diff do arquivo mostra as 6 entradas novas
- [ ] `npm run build` continua verde (nenhum tipo quebrado em consumidor existente)

**Tests**: none
**Gate**: build

---

### T13: `rpc/formulario.ts` (`atualizarAvaliacaoNps`)

**What**: Wrapper fino de `.rpc()` para `app.atualiza_avaliacao_nps()`, com mapeamento de erro.
**Where**: `src/backend/rpc/formulario.ts` + `src/backend/rpc/formulario.test.ts`
**Depends on**: T12
**Reuses**: `rpc/vinculo.ts` (padrão), `rpc/errors.ts` (`mapeiaErroRpc`)
**Requirement**: FRM-21

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Função chama `client.schema("app").rpc("atualiza_avaliacao_nps")`
- [ ] Erro de permissão mapeado com `mapeiaErroRpc`
- [ ] `npm run test:unit` verde (2+ testes: sucesso, erro)

**Tests**: unit
**Gate**: quick

---

### T14: `queries/formulario.ts` (5 funções de leitura)

**What**: `buscarFormulariosDoContrato`, `buscarMetricasAtivas`, `buscarSubmissaoPropria`,
`buscarDimensoesGipAtivas`, `buscarGipDoContrato`, `buscarAvaliacaoNps` (design.md, Components).
**Where**: `src/backend/queries/formulario.ts` + `src/backend/queries/formulario.test.ts`
**Depends on**: T12
**Reuses**: estilo de `queries/etapa-contrato.ts`/`queries/kanban.ts`
**Requirement**: FRM-04, FRM-05, FRM-14, FRM-19, FRM-23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] 6 funções implementadas com as assinaturas de design.md
- [ ] `buscarFormulariosDoContrato` cobre os 2 ramos de filtro por papel (Gestora/Admin vs Mentor/Assessor)
- [ ] `npm run test:unit` verde, 1 teste por função no mínimo + os 2 ramos de filtro

**Tests**: unit
**Gate**: quick

---

### T15: Estender `usePapelGlobal` (`idUsuario`) — ⏭️ JÁ FEITO por feature paralela, virou verificação

**Achado ao dispatar o Lote B (checagem de `git log` antes de começar, regra de ouro de `CLAUDE.md`)**:
a trilha irmã `incidencia-encontros` já entregou exatamente esta task no commit `617a2c2`
(`feat(incidencia-encontros): T17 -- usePapelGlobal ganha idUsuario`) — mesma necessidade
(`RegistroForm` precisava de `id_usuario` próprio pra preencher autoria sem RPC). Conferido: o hook
já devolve `{ papel, idUsuario, carregando }`, com `select("id_usuario, papel_global")`. Nenhuma
mudança a fazer — esta task vira só uma checagem de compatibilidade com o design desta feature.

**What**: Confirmar que o formato de retorno já entregue (`idUsuario: number | null`) é compatível
com o que `FormulariosLista`/`FormularioGenericoForm`/`FormularioGipForm` precisam — sem editar o
arquivo.
**Where**: `src/frontend/hooks/use-papel-global.ts` (leitura, sem alteração)
**Depends on**: None
**Reuses**: implementação já entregue por `incidencia-encontros`
**Requirement**: FRM-11, FRM-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Hook já devolve `idUsuario: number | null` — confirmado por leitura do arquivo, nenhum ajuste necessário
- [x] `npm run build` já verde (feature paralela já rodou o próprio gate)

**Tests**: none
**Gate**: build (nenhum comando novo — já coberto pelo commit `617a2c2`)

---

### T16: `FormulariosLista`

**What**: Componente da aba Formulários — lista filtrada por papel (FRM-14), badges de estado,
toggle abrir/fechar (Gestora/Admin, escrita direta em `rel_formulario_contrato`).
**Where**: `src/frontend/components/produtos/formularios-lista.tsx`
**Depends on**: T14, T15
**Reuses**: `Table`, `Badge`, `<CarregandoSkeleton>`/`<ErroInline>`/`<EstadoVazio>` (AD-029)
**Requirement**: FRM-01, FRM-02, FRM-03, FRM-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Gestora/Admin veem os 16 formulários do produto + toggle funcional
- [ ] Mentor/Assessor veem só os endereçados ao papel dele (mapeamento fixo, design.md)
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

---

### T17: Liga `FormulariosLista` na rota existente

**What**: Troca `<EmDesenvolvimento>` por `<FormulariosLista idContrato idProduto>` em
`contratos/[id]/formularios/page.tsx`.
**Where**: `src/frontend/app/(app)/contratos/[id]/formularios/page.tsx`
**Depends on**: T16
**Reuses**: `idContrato`/`idProduto` já disponíveis via `FichaContratoChrome`/layout pai
**Requirement**: FRM-01, FRM-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Página renderiza a lista real, sem placeholder
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

---

### T18: `FormularioGenericoForm`

**What**: Página de resposta genérica — Zod schema construído em runtime a partir de
`buscarMetricasAtivas`, RHF, os 3 estados (bloqueado sem métrica / editável / somente-leitura ou
reabertura por Gestora/Admin).
**Where**: `src/frontend/components/produtos/formulario-generico-form.tsx`
**Depends on**: T14, T15
**Reuses**: padrão RHF+Zod de `sucesso-mensal-form.tsx`/`contrato-form.tsx` (schema dinâmico em vez
de fixo)
**Requirement**: FRM-04, FRM-05, FRM-07, FRM-09, FRM-10, FRM-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Sem métrica ativa → aviso de bloqueio, sem botão de envio
- [ ] Com métrica, sem submissão prévia → formulário editável, grava direto (`insert`, nunca `upsert`)
- [ ] Com submissão prévia + `permite_edicao_aberta=true` → editável, grava via `update` pelo
      `id_submissao` já lido
- [ ] Com submissão prévia + `permite_edicao_aberta=false` → somente leitura pro respondente comum;
      Gestora/Admin veem ação de reabrir
- [ ] `exige_anexo=true` exige aceite antes de habilitar envio, grava `aceite_em`
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

---

### T19: Rota `/contratos/[id]/formularios/[codigo]`

**What**: Nova rota que resolve `codigo`; roteia para `FormularioGipForm` se `codigo === 'gip'`,
senão `FormularioGenericoForm`. Formulários fora de escopo (`inscricao_mentorado`/`inscricao_mentor`)
mostram mensagem de fora de escopo, não 404 (evita link morto sem explicação).
**Where**: `src/frontend/app/(app)/contratos/[id]/formularios/[codigo]/page.tsx`
**Depends on**: T18
**Reuses**: mesmo padrão de resolução de `params` (Promise) de `etapas/[codigo]/page.tsx`
**Requirement**: FRM-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Rota resolve os 14 formulários genéricos em escopo + roteia GIP corretamente
- [ ] Formulário fora de escopo mostra mensagem explícita
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

---

### T20: `FormularioGipForm`

**What**: Tela sob medida — 3 ações (Início/Meio/Fim, desabilitadas se já aplicadas e
`permite_edicao_aberta=false`), campos fixos + 4 dimensões via `buscarDimensoesGipAtivas`, leitura de
`vw_gip_evolucao` já aplicado.
**Where**: `src/frontend/components/produtos/formulario-gip-form.tsx`
**Depends on**: T14, T19
**Reuses**: mesmo RHF+Zod, grava direto em `fat_submissao` (contrato JSONB de design.md)
**Requirement**: FRM-15, FRM-16, FRM-17, FRM-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] As 3 ações (inicio/meio/fim) renderizam os campos fixos + 4 sliders/selects de dimensão (1-4)
- [ ] Envio grava `fat_submissao` com `momento` correto — nunca escreve `fat_gip`/`fat_gip_dimensao`
      diretamente (é 100% trigger)
- [ ] Mostra a evolução já aplicada (`vw_gip_evolucao`) quando existir
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

---

### T21: `NpsAvaliacoesCard` + wiring no dashboard do produto

**What**: Card de NPS agregado (Gestora/Admin only), botão "Atualizar" chamando
`atualizarAvaliacaoNps`, e inclusão no `dashboard/page.tsx` do produto.
**Where**: `src/frontend/components/produtos/nps-avaliacoes-card.tsx` +
`src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (modificado)
**Depends on**: T13, T14, T15
**Reuses**: `Card`/`Table`/`Button`, `usePapelGlobal`
**Requirement**: FRM-20, FRM-21, FRM-23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Card só aparece para Gestora/Admin (viewer), nunca para Mentor/Assessor
- [ ] Botão "Atualizar" chama o RPC e rebusca `mv_avaliacao_nps`
- [ ] `npm run build && npm run lint:all` verde

**Tests**: none
**Gate**: build

**Commit**: `feat(formularios-produto): T21 -- card de NPS agregado no dashboard`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1:  T1 ──→ T2 ──→ T3 ──→ T4
Phase 2:  T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9
Phase 3:  T10 ──→ T11
Phase 4:  T12 ──→ T13 ──→ T14 ──→ T15
Phase 5:  T16 ──→ T17
Phase 6:  T18 ──→ T19
Phase 7:  T20 ──→ T21
```

Execução é estritamente sequencial — sem paralelismo intra-fase.

**Batches propostos** (~7 tasks/lote, cortando só em fronteira de fase — 21 tasks > ~8, oferta de
sub-agente abaixo):

- **Lote A** — Phase 1 + Phase 2 (T1-T9, 9 tasks): todo o schema do mecanismo genérico + GIP.
- **Lote B** — Phase 3 + Phase 4 (T10-T15, 6 tasks): NPS + toda a camada TS de backend.
- **Lote C** — Phase 5 + Phase 6 + Phase 7 (T16-T21, 6 tasks): todo o frontend.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: DDL 2 tabelas relacionadas (mesma migration, verbatim) | 1 migration coesa | ✅ Granular |
| T2: RLS 2 tabelas (mesmo padrão, mesma migration) | 1 migration coesa | ✅ Granular |
| T3: Grants 2 tabelas | 1 migration coesa | ✅ Granular |
| T4: 1 função + 1 trigger + testes da fase | 1 conceito + testes co-locados (merge-forward) | ✅ Granular |
| T5: DDL 2 tabelas relacionadas | 1 migration coesa | ✅ Granular |
| T6: RLS 2 tabelas | 1 migration coesa | ✅ Granular |
| T7: Grants 2 tabelas | 1 migration coesa | ✅ Granular |
| T8: 1 função + 1 trigger | 1 conceito | ✅ Granular |
| T9: 1 view + testes da fase | 1 conceito + testes co-locados (merge-forward) | ✅ Granular |
| T10: 1 MV + grants | 1 conceito | ✅ Granular |
| T11: 1 função + testes da fase | 1 conceito + testes co-locados (merge-forward) | ✅ Granular |
| T12: 1 comando (types) | 1 ação | ✅ Granular |
| T13: 1 wrapper RPC | 1 função | ✅ Granular |
| T14: 6 funções de leitura, 1 arquivo coeso | 1 módulo coeso (mesma responsabilidade: leitura desta feature) | ✅ Granular |
| T15: 1 hook estendido | 1 arquivo | ✅ Granular |
| T16: 1 componente | 1 componente | ✅ Granular |
| T17: 1 rota (troca de import) | 1 arquivo | ✅ Granular |
| T18: 1 componente | 1 componente | ✅ Granular |
| T19: 1 rota nova | 1 arquivo | ✅ Granular |
| T20: 1 componente | 1 componente | ✅ Granular |
| T21: 1 componente + 1 wiring | 2 arquivos, mesma entrega coesa | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (início da Phase 1) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T1 | T1→T2→T3 (sequencial na fase) | ✅ Match |
| T4 | T1, T2, T3 | T3→T4 | ✅ Match |
| T5 | T1 | (início da Phase 2, após Phase 1) | ✅ Match |
| T6 | T5 | T5→T6 | ✅ Match |
| T7 | T5 | T5→T6→T7 (sequencial na fase) | ✅ Match |
| T8 | T5, T6, T7 | T7→T8 | ✅ Match |
| T9 | T5, T6, T7, T8 | T8→T9 | ✅ Match |
| T10 | T1, T4 | (início da Phase 3, após Phase 1/2) | ✅ Match |
| T11 | T10 | T10→T11 | ✅ Match |
| T12 | T4, T9, T11 | (início da Phase 4, após Phase 1/2/3) | ✅ Match |
| T13 | T12 | T12→T13 | ✅ Match |
| T14 | T12 | T13→T14 (sequencial na fase) | ✅ Match |
| T15 | None | T14→T15 (sequencial na fase, sem dependência real) | ✅ Match |
| T16 | T14, T15 | (início da Phase 5) | ✅ Match |
| T17 | T16 | T16→T17 | ✅ Match |
| T18 | T14, T15 | (início da Phase 6) | ✅ Match |
| T19 | T18 | T18→T19 | ✅ Match |
| T20 | T14, T19 | (início da Phase 7) | ✅ Match |
| T21 | T13, T14, T15 | T20→T21 (sequencial na fase) | ✅ Match |

Nenhuma task depende de uma task de fase posterior. Todas as setas do diagrama correspondem a um
`Depends on` do corpo da task correspondente.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Schema (DDL puro) | none | none | ✅ OK |
| T2 | Schema (RLS, comportamento — mas não testável sem T3/T4) | integration (merge-forward → T4) | none | ✅ OK (ver nota) |
| T3 | Schema (GRANT, comportamento — mas não testável sem T2/T4) | integration (merge-forward → T4) | none | ✅ OK (ver nota) |
| T4 | Schema (trigger) + RLS/GRANT da fase inteira agora testável | integration | integration | ✅ OK |
| T5 | Schema (DDL puro) | none | none | ✅ OK |
| T6 | Schema (RLS, merge-forward → T9) | integration (em T9) | none | ✅ OK (ver nota) |
| T7 | Schema (GRANT, merge-forward → T9) | integration (em T9) | none | ✅ OK (ver nota) |
| T8 | Schema (trigger, merge-forward → T9) | integration (em T9) | none | ✅ OK (ver nota) |
| T9 | Schema (view) + toda a Fase 2 agora testável | integration | integration | ✅ OK |
| T10 | Schema (MV+grant, merge-forward → T11) | integration (em T11) | none | ✅ OK (ver nota) |
| T11 | Schema (RPC) + MV/grants agora testável | integration | integration | ✅ OK |
| T12 | Tipos gerados (mecânico) | none | none | ✅ OK |
| T13 | Backend RPC wrapper | unit | unit | ✅ OK |
| T14 | Backend queries | unit | unit | ✅ OK |
| T15 | Frontend hook | none | none | ✅ OK |
| T16 | Frontend componente | none | none | ✅ OK |
| T17 | Frontend rota | none | none | ✅ OK |
| T18 | Frontend componente | none | none | ✅ OK |
| T19 | Frontend rota | none | none | ✅ OK |
| T20 | Frontend componente | none | none | ✅ OK |
| T21 | Frontend componente + rota | none | none | ✅ OK |

**Nota sobre T2/T3/T6/T7/T8/T10 (merge-forward)**: RLS/GRANT/trigger isolados não são testáveis de
ponta a ponta antes que toda a cadeia da fase exista (não dá para provar "Mentor é negado" sem
GRANT+RLS+trigger juntos, nem "MV agrega certo" sem a função de refresh). Em vez de uma task de
teste separada (deferral, proibido pela regra), os testes de cada fase estão **co-locados na última
task da cadeia** (T4 para a Fase 1, T9 para a Fase 2, T11 para a Fase 3) — mesmo padrão de
"merge forward" descrito em `tasks.md` da skill, e mesmo padrão real já usado por
`operacao-regua-instanciacao` (T1-T4 schema, testes só depois de tudo aplicado).

---

## MCPs e Skills

Nenhuma MCP nem skill externa necessária para nenhuma task — todo o trabalho é SQL (migrations
verbatim do schema aprovado + triggers pequenos) e TypeScript/React dentro de padrões já
estabelecidos no repositório. `NONE` em todas as tasks acima.

---

Pronto para Execute. Como as tasks passam de ~8 (21 no total), a oferta de rodar em lotes de
sub-agente segue no chat, fora deste arquivo.
