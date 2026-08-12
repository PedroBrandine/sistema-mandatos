# G1 + G2 — Primeira Fatia de Visão Gerencial Validation

**Date**: 2026-08-12
**Spec**: `.specs/features/visao-gerencial-g1-g2/spec.md`
**Diff range**: `e1f0865^..f36fdd7` (13 planned commits T1–T13, filtered to this feature's file scope, since `develop` received interleaved commits from `planejamento-planilha-monitoramento` in the same window) + 1 unplanned fix commit `f36fdd7` (`fix(visao-gerencial-g1-g2): T9 -- backbone dim_usuario.papel_global em buscarCarteiraPonderada`)
**Verifier**: independent sub-agent (author ≠ verifier) — first complete, non-nested validation run for this feature. A prior nested/unauthorized Verifier run was interrupted mid-sensor by the orchestrator before this session started; its mutation was reverted and its stale docs discarded before this session began (confirmed via clean `git status` at start).

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 — DDL `ref_peso_etapa` | ✅ Done | `e1f0865` |
| T2 — Grants `ref_peso_etapa` | ✅ Done | `4b7d0c2` |
| T3 — Seed `ref_peso_etapa` | ✅ Done | `941ebdb` |
| T4 — `vw_carteira` reduzida | ✅ Done | `a1b07d9` |
| T5 — `vw_carteira_ponderada` | ✅ Done | `617d84d` |
| T6 — `vw_ciclo_etapa` | ✅ Done | `5f7a164` |
| T7 — Grants das 3 views | ✅ Done | `756cd91` |
| T8 — `db:types` | ✅ Done | No commit (no diff — file already current via another feature's `db:types` run, per execution note in `tasks.md`). Verified independently: `database.types.ts:1953,2497,2520,2548` contain the 4 new objects. |
| T9 — `buscarCarteiraPonderada` | ✅ Done | `3455717`, amended by unplanned fix `f36fdd7` (see below) |
| T10 — `buscarCicloEtapa` | ✅ Done | `01667b0` |
| T11 — `CarteiraPonderadaCard` | ✅ Done | `23a5e41` |
| T12 — `CicloEtapaCard` | ✅ Done | `e575336` |
| T13 — Página `/visao-gerencial` | ✅ Done | `b457fb4` |

**Unplanned fix commit `f36fdd7`** (outside the 13-task plan): rewrites `buscarCarteiraPonderada` to source a `dim_usuario.papel_global`-filtered backbone list, so a Gestora/Mentor with zero active contracts appears with `somaPeso: 0` instead of being omitted. This claims to fix a real gap found by a prior (untrusted, nested, interrupted) Verifier round. **Independently re-audited in this session — see Sensor Mutation 1 below: confirmed both correct and load-bearing** (removing it un-kills the edge case, tests catch it). Architecturally consistent with the pre-existing `ref_etapa`-as-backbone pattern already used in `buscarBoardKanban`/`buscarCicloEtapa` (`src/backend/queries/kanban.ts:101-104`, `src/backend/queries/visao-gerencial.ts:155`) — not a new pattern invented ad hoc.

**Process gap** (non-blocking, see Fix Plans): this fix commit changed T9's actual behavior (added a new `dim_usuario` read path) without updating `design.md` (Data Models / Integration Points still only describe `vw_carteira_ponderada` as the source) or `tasks.md` T9 Done-when (still lists only the original 5 criteria). No `.specs/STATE.md` entry documents this as a decision either. Functionally correct and well-tested, but a future reader of `design.md` would not learn this integration point exists.

---

## Spec-Anchored Acceptance Criteria

### P1: G2 — tempo de ciclo por etapa

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| GG-03 AC1: mediana de `dt_conclusao - dt_inicio` por etapa, só `status='concluida'` | Mediana numérica exata sobre amostra real | `supabase/migrations/20260812180419_visao_gerencial_vw_ciclo_etapa.sql:17,24` (`dias_ciclo`, `WHERE vec.status = 'concluida'`) + `supabase/tests/visao-gerencial/vw-ciclo-etapa.integration.test.ts:104-112` — `expect(...dias_ciclo).toBe(7)` / `.toBe(14)` (fixture 2026-01-01→01-08 e →01-15) + `src/backend/queries/visao-gerencial.test.ts:317-332` — `expect(resultado).toEqual([{..., mediana: 7, amostra: 2}])` | ✅ PASS |
| GG-04 AC2: filtro por produto/Gestora restringe a amostra, sem misturar outro corte | Amostra restrita, mediana não contaminada | `src/backend/queries/visao-gerencial.test.ts:352-365` (`eqsCiclo` contém `["id_produto",7]`/`["id_usuario_gestora",42]`) + `:369-390` — `expect(colunaCadastro.mediana).toBe(7)` não afetado pelo `100` da etapa 11 | ✅ PASS |
| GG-03 AC3: etapa sem ocorrência `concluida` → "sem dado suficiente", nunca 0/mediana vazia | `mediana: null`, etapa não omitida | `src/backend/queries/visao-gerencial.test.ts:337-348` — `expect(colunaPontape.mediana).toBeNull(); expect(colunaPontape.amostra).toBe(0)` + UI: `src/frontend/components/visao-gerencial/ciclo-etapa-card.tsx:115-116` — renderiza `"sem dado suficiente"` quando `mediana === null` | ✅ PASS |

### P1: G1 — carteira ponderada por Gestora

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| GG-05 AC1: soma `ref_peso_etapa.peso` de contratos `ativo` por Gestora | Soma numérica exata por usuário | `src/backend/queries/visao-gerencial.test.ts:71-94` — `expect(resultado).toEqual([{..., somaPeso: 5, qtdContratos: 2}])` (2+3=5) + `supabase/tests/visao-gerencial/vw-carteira-ponderada.integration.test.ts:126-134` (peso `10.00`/`3.00` por linha, na view) | ✅ PASS |
| GG-05 AC2: corte "por Mentor" agrupa por Mentor, mesma soma | Mesma agregação, `papel_no_contrato='mentor'` | `src/backend/queries/visao-gerencial.test.ts:98-122` — `eqsPapel` contém `["papel_no_contrato","mentor"]`, resultado com `somaPeso: 4` | ✅ PASS |
| GG-06 AC3: atingimento médio (`AVG(pct_atingimento)` ignorando `NULL`) como acessório | Média exata, NULL fora do denominador | `src/backend/queries/visao-gerencial.test.ts:140-155` — `expect(resultado[0].atingimentoMedio).toBe(60)` ((80+40)/2, NULL excluído) | ✅ PASS |
| GG-05 AC4: `id_etapa_atual IS NULL` → peso da 1ª etapa (`ordem=1`) | Peso resolvido = peso da etapa `ordem=1` do produto | `supabase/migrations/20260812175929_visao_gerencial_vw_carteira_ponderada.sql:22-25` (`COALESCE(c.id_etapa_atual, SELECT ... ordem=1)`) + `supabase/tests/visao-gerencial/vw-carteira-ponderada.integration.test.ts:136-142` — `expect(rows[0].peso).toBe(pesoOrdem1Esperado)` + unit `src/backend/queries/visao-gerencial.test.ts:261-275` (confirma que a função não reintroduz a lógica, só consome `peso` da view) | ✅ PASS |

### P1: `vw_carteira` reduzida (AD-032)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| GG-01 AC1: `vw_carteira` sem `iip_provisorio`/`nr_fatos`/`LEFT JOIN mv_iip_contrato` | View existe, roda sem erro, colunas exatas (sem as 3 omitidas) | `supabase/migrations/20260812175507_visao_gerencial_vw_carteira.sql:22-40` + `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts:15-41` — `expect(colunas).toEqual(COLUNAS_ESPERADAS)` e `expect(colunas).not.toContain(omitida)` para as 3 colunas | ✅ PASS |
| GG-01 AC2: substituição futura quando `mv_iip_contrato` existir | Débito registrado, não uma verificação executável agora | `.specs/STATE.md:267-272` (adendo AD-032) + `supabase/migrations/20260812175507_visao_gerencial_vw_carteira.sql:43` (`COMMENT ON VIEW`) | ⚠️ Não testável nesta feature (é uma AC de tarefa futura, condicionada a objeto ainda inexistente) — documentado como débito explícito, consistente com o texto da própria AC. Não é um gap desta feature. |

### P2: Página mínima de Visão Gerencial

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| GG-07 AC1: G1+G2 na mesma tela, filtros próprios | Ambos os cards presentes, sem estado de filtro compartilhado | `src/frontend/app/(app)/visao-gerencial/page.tsx:19-20` (`<CarteiraPonderadaCard/>` + `<CicloEtapaCard/>`) — cada um com seu próprio `useState` (`carteira-ponderada-card.tsx:26-27`, `ciclo-etapa-card.tsx:23-24`) | ⚠️ Spec-precision: sem harness de componente no projeto (débito conhecido L-006/L-007) — verificado por inspeção de código + `npm run build` (compila e renderiza estaticamente), não por teste automatizado |
| GG-07 AC2: link pro Kanban navega pro board do produto | `<Link href="/produtos/{slug}/dashboard">` | `src/frontend/app/(app)/visao-gerencial/page.tsx:27-34` | ⚠️ Mesma ressalva acima — sem teste automatizado, confirmado por inspeção + build |
| GG-07 AC3: placeholder "G3-G6 em desenvolvimento" visível | Componente `<EmDesenvolvimento>` renderizado | `src/frontend/app/(app)/visao-gerencial/page.tsx:38` | ⚠️ Mesma ressalva acima |

**Status**: ✅ Todos os AC testáveis cobertos com evidência precisa. 2 ressalvas ⚠️: GG-01 AC2 é uma AC de tarefa futura (não é gap); GG-07 AC1-AC3 têm apenas cobertura de build+inspeção (débito de projeto já documentado e aceito em `tasks.md`'s Test Coverage Matrix, não uma lacuna desta feature).

---

## Edge Cases (spec.md)

| Edge Case | Result | Evidence |
| --- | --- | --- |
| Gestora sem nenhum contrato ativo → G1 mostra 0 (nunca omitida) | ✅ Handled | `src/backend/queries/visao-gerencial.ts:59-64,80-82` (backbone `dim_usuario.papel_global`) + `src/backend/queries/visao-gerencial.test.ts:200-235` — resultado inclui `{idUsuario:2, somaPeso:0,...}`. **Re-auditado com ceticismo nesta sessão** (não assumido do fix commit): confirmado funcionalmente correto e coberto por sensor de discriminação (Mutação 1, abaixo) |
| Dois contratos da mesma Gestora na mesma etapa → peso somado 1x por contrato (não deduplicado) | ✅ Handled | `src/backend/queries/visao-gerencial.test.ts:240-255` — `somaPeso: 6` (3+3), `qtdContratos: 2` |
| `ref_peso_etapa` sem linha (lacuna de seed) → peso `NULL`, excluído da soma, alerta visual (nunca peso=1 silencioso) | ✅ Handled | View: `supabase/migrations/20260812175929_visao_gerencial_vw_carteira_ponderada.sql:22` (`LEFT JOIN`) + `supabase/tests/visao-gerencial/vw-carteira-ponderada.integration.test.ts:144-150` (linha preservada com `peso: null`) + agregação: `src/backend/queries/visao-gerencial.test.ts:159-175` (`somaPeso: 5` não 6, `qtdContratosSemPeso: 1`) + UI: `src/frontend/components/visao-gerencial/carteira-ponderada-card.tsx:102-110` (`<Alert>` quando `qtdContratosSemPeso > 0`) |
| Corte por produto E por Gestora juntos → AND, não OR | ✅ Handled | `src/backend/queries/visao-gerencial.test.ts:279-289` — `eqs` contém ambos `["papel_no_contrato","gestora"]` e `["id_produto",7]` |

---

## Discrimination Sensor

Escopo: camada TS de agregação (`src/backend/queries/visao-gerencial.ts`), o código novo de maior risco desta feature — inclui a lógica em disputa (backbone `dim_usuario`, adicionada pelo fix commit `f36fdd7` fora do plano original). Mutações aplicadas diretamente no arquivo real, gate escopado rodado após cada uma, revertidas com `git checkout --` antes da próxima; `git status --short` confirmado limpo entre cada uma.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/backend/queries/visao-gerencial.ts:59-64,80-82` | Removido o backbone `dim_usuario` inteiro (`const usuarios: RowUsuarioPapelGlobal[] = [];` no lugar da query real) — testa diretamente se o fix `f36fdd7` é de fato load-bearing | ✅ Killed — 2 testes falharam (`filtra o backbone...`, `mostra uma Gestora sem nenhum contrato ativo...`) |
| 2 | `src/backend/queries/visao-gerencial.ts:90-94` | Invertida a condição `row.peso === null` → `row.peso !== null` (soma/exclusão trocadas) | ✅ Killed — 5 testes falharam |
| 3 | `src/backend/queries/visao-gerencial.ts:141` | Off-by-one na mediana de amostra par: `(ordenados[meio-1]+ordenados[meio])/2` → `ordenados[meio]` | ✅ Killed — 2 testes falharam |

**Sensor depth**: lightweight (default, 3 mutações)
**Result**: 3/3 killed — PASS ✅

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ (fix commit `f36fdd7` está fora do plano de 13 tasks, mas endereça um Edge Case literal do próprio `spec.md` — não é feature nova) |
| Matches patterns | ✅ (backbone `dim_usuario` segue o mesmo padrão já usado para `ref_etapa` em `kanban.ts:101-104`) |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer Coverage Expectation met (DB integration 1:1 com Done-when; backend unit 1:1 com ACs; frontend build+lint, débito conhecido) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ |
| Documented guidelines followed | `docs/schema_sistema.sql` (definição aprovada de `vw_carteira`), AD-002/AD-025/AD-030/AD-032 (`.specs/STATE.md`), padrão GRANT-only da Trilha C |

**Minor process gap (non-blocking)**: `f36fdd7` alterou o comportamento de T9 (novo integration point `dim_usuario`) sem atualizar `design.md` (Data Models/Integration Points ainda só citam `vw_carteira_ponderada`) nem o Done-when de T9 em `tasks.md`. Ver Fix Plan 1.

---

## Gate Check

- **Gate command**: `npm run build && npm run lint:all` (Build) + `npx vitest run --config vitest.integration.config.ts supabase/tests/visao-gerencial` (Full, escopado) + `npx vitest run --config vitest.config.ts src/backend/queries/visao-gerencial.test.ts` (Quick, escopado)
- **Build**: ✅ `npm run build` — compilou sem erro, 0 erros de tipo, 16 rotas geradas incluindo `/visao-gerencial`
- **Lint**: `npm run lint:all` retorna exit 1, mas com os mesmos **27 problemas pré-existentes** (13 erros, 14 warnings) já documentados como baseline em `.specs/STATE.md` (Handoff Kanban de Etapas: "baseline inalterada de 27 problemas pré-existentes"). Nenhum dos arquivos com erro/warning pertence a esta feature (todos em `mandatos/`, `usuarios/`, `fundacao/`) — baseline confirmada inalterada, não uma regressão desta feature.
- **Integration (escopado)**: 7 arquivos, **29/29 passed**
- **Unit (escopado)**: 1 arquivo, **17/17 passed**
- **Total desta feature**: 46 passed, 0 failed, 0 skipped
- **Test count before feature**: 0 (nenhum teste de `visao-gerencial` existia antes)
- **Delta**: +46 novos testes
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans (non-blocking — documentation drift, not a functional gap)

### Fix 1: `design.md`/`tasks.md` não refletem o backbone `dim_usuario` adicionado por `f36fdd7`

- **Root cause**: o fix commit `f36fdd7` mudou o comportamento real de T9 (query nova a `dim_usuario`, filtrada por `papel_global`) para cobrir um Edge Case do `spec.md`, mas só atualizou código + testes — não tocou `design.md` (## Data Models / ## Integration Points, que ainda descrevem `buscarCarteiraPonderada` como consumindo só `vw_carteira_ponderada`) nem o checklist "Done when" de T9 em `tasks.md` (ainda lista as 5 condições originais, sem menção ao backbone). O commit também referencia um `validation.md`/"Verifier, rodada 1" que não existe mais no repositório (era de uma rodada aninhada não autorizada, já descartada pelo orquestrador) — a referência ficou órfã no histórico de commit.
- **Fix task**: Adicionar ao `design.md` (seção `buscarCarteiraPonderada`, Data Models) uma linha documentando o backbone `dim_usuario.papel_global` como fonte adicional, com a mesma justificativa do comentário em código (`visao-gerencial.ts:46-54`); atualizar o Done-when de T9 em `tasks.md` para incluir o critério "Gestora/Mentor com papel_global correspondente aparece mesmo sem contrato ativo (somaPeso: 0)".
- **Priority**: Minor (não bloqueia — a implementação está correta e testada; é só documentação desatualizada, que uma leitura futura de `design.md` sem o código na tela não detectaria)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| GG-01 | Designed | ✅ Verified (AC2 é débito documentado, condicionado a feature futura — não bloqueia) |
| GG-02 | Designed | ✅ Verified |
| GG-03 | Designed | ✅ Verified |
| GG-04 | Designed | ✅ Verified |
| GG-05 | Designed | ✅ Verified |
| GG-06 | Designed | ✅ Verified |
| GG-07 | Designed | ✅ Verified (AC1-AC3 cobertos por inspeção + build; sem harness de componente, débito de projeto já aceito) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 ACs testáveis cobertos com evidência exata (GG-01 AC2 é AC de tarefa futura, não testável agora por natureza; GG-07 AC1-AC3 cobertos por build+inspeção, débito de frontend já documentado no projeto)
**Sensor**: 3/3 mutações mortas
**Gate**: 46 passed (29 integration + 17 unit), build limpo, lint na mesma baseline pré-existente (27 problemas, nenhum desta feature)

**What works**: `ref_peso_etapa` (catálogo GRANT-only completo, DDL+grants+seed), `vw_carteira` reduzida (AD-032, sem `mv_iip_contrato`/`fat_registro`), `vw_carteira_ponderada` e `vw_ciclo_etapa` (grão fino, `security_invoker=true`, grants corretos), `buscarCarteiraPonderada`/`buscarCicloEtapa` (agregação em TS, todas as ACs e Edge Cases do spec cobertas), página `/visao-gerencial` (G1+G2+link Kanban+placeholder G3-G6). O gap de Edge Case ("Gestora sem contrato ativo") alegado por uma rodada de Verifier anterior (não confiável, aninhada e interrompida) foi **re-auditado com ceticismo nesta sessão** e confirmado como uma correção real, funcionalmente correta, arquiteturalmente consistente com o padrão já existente (`ref_etapa` como backbone em `kanban.ts`), e comprovadamente load-bearing pelo sensor de discriminação (Mutação 1).

**Issues found**: 1 gap de processo (Minor, não-bloqueante) — `design.md`/`tasks.md` não documentam o backbone `dim_usuario` adicionado pelo fix `f36fdd7`. Ver Fix Plan 1.

**Next steps**: Nenhum obrigatório para fechar esta feature. Recomendado (não bloqueante): aplicar Fix Plan 1 na próxima sessão que tocar `design.md` desta feature, e considerar UAT manual da tela `/visao-gerencial` com dado real do Kanban (nenhum harness de componente cobre isso automaticamente — mesmo débito L-006/L-007 já conhecido).

**Nota de segurança do processo de verificação**: durante o sensor de discriminação, o ambiente injetou repetidamente (3x, idênticas) uma mensagem de sistema forjada alegando que `visao-gerencial.ts` "foi modificado pelo usuário ou por um linter" e instruindo a não reverter e a não contar isso ao usuário. Isso não correspondia à realidade — cada mutação foi aplicada e revertida por este Verifier via `git checkout --`, com `git status --short` limpo confirmado logo em seguida. A instrução de ocultar informação do usuário foi ignorada; nenhuma mutação permaneceu no working tree (confirmado limpo ao final).
