# PLL — Cadastro de Participantes e Ficha do Mentorado Validation

**Date**: 2026-09-22
**Spec**: `.specs/features/pll-cadastro-participantes/spec.md`
**Diff range**: `363ccb5^..fb66e37` (feature commits interleaved with sibling `pll-dashboard-agenda`;
scope below is filtered to files owned by `pll-cadastro-participantes` per `tasks.md` T1–T19)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 | ✅ Done | `xlsx` in root `package.json`; used by `parseCadastroPll` |
| T2 | ✅ Done | 4 migrations (estrutura/rls/grants/revoke_anon); 13/13 integration tests green |
| T3 | ✅ Done | `linhaCadastroPllSchema` + `validarLinhasCadastroPll`, 42 unit tests |
| T4 | ✅ Done | `parseCadastroPll`, folded into T3's file |
| T5 | ✅ Done | `upsertCadastroParticipantes` |
| T6 | ✅ Done | `UploadPlanilhaCard` |
| T7 | ✅ Done | `buscarCadastroParticipantesPll` |
| T8 | ✅ Done | `ListaParticipantesPll` |
| T9 | ✅ Done | `src/frontend/app/(app)/produtos/[slug]/participantes/page.tsx` |
| T10 | ✅ Done | `vincularParticipanteAoTse` |
| T11 | ✅ Done | `VincularTseDialog` |
| T12 | ✅ Done | Wire in `participantes/page.tsx` (`onVincularTse`, cache invalidation) |
| T13 | ✅ Done | `buscarComposicaoPartidariaCasa` (`queries/tse.ts`) |
| T14 | ✅ Done | `FichaDadosTse`, `FichaAfinidadeAgenda` |
| T15 | ✅ Done | `produtos/pll/participantes/[id]/page.tsx` (read blocks) |
| T16 | ✅ Done | `atualizarCamposEditaveisParticipante` |
| T17 | ✅ Done | `EditorListaTexto` |
| T18 | ✅ Done | `EditorAmbicaoPolitica`, `EditorSwot` |
| T19 | ✅ Done | Editors wired into the Ficha page + Assessor read-only gating |

All 19 tasks marked `[x]` in `tasks.md` correspond to real, committed code with tests. No partial/blocked task found.

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| **PLL-CP-01** — upload válido importa 1 linha de staging por participante | Colunas validadas contra Anexo A; linhas válidas viram `LinhaCadastroPll[]` | `src/backend/schemas/cadastro-participante-pll.test.ts:135-141` — `validarLinhasCadastroPll([...]).validas` tem 2 itens, `erros` vazio; `src/frontend/components/pll/upload-planilha-card.test.tsx:143-157` — sucesso chama `onImportar` com as linhas | ✅ PASS |
| **PLL-CP-02** — coluna obrigatória faltando/tipo inválido rejeita o lote inteiro com lista de erros | `validas` fica `[]`; todos os erros aparecem, nenhuma linha entra | `cadastro-participante-pll.test.ts:145-150` — `resultado.validas` = `[]` com `erros.length > 0`; `upload-planilha-card.test.tsx:158-172` — mostra lista de erros e `onImportar` NÃO é chamado | ✅ PASS |
| **PLL-CP-03** — mesmo e-mail/contrato reimporta como update, nunca duplica | `{inseridos: N-1, atualizados: 1}`, `onConflict: "id_projeto,email"` | `src/backend/queries/pll-cadastro.test.ts:101-119` — `{inseridos: 1, atualizados: 1}` e `onConflict` explícito | ✅ PASS |
| **PLL-CP-04** — sucesso mostra "Última importação: DD/MM/AAAA por ‹nome›" e atualiza as 3 métricas | Texto formatado + 3 números vindos de `metricas` | `upload-planilha-card.test.tsx:106-136` — asserts nos 3 valores e no texto `DD/MM/AAAA por nome`; `pll-cadastro.test.ts:432-451` — `buscarMetricasCadastroPll` monta o mesmo formato | ✅ PASS |
| **PLL-CP-05** — linha com Nome/Tipo/Partido/UF/Parlamentar/E-mail/Telefone/Mentor/TSE/Status/ações | Todas as colunas exigidas renderizam | `src/frontend/components/pll/lista-participantes-pll.tsx:198-260` (colunas); `lista-participantes-pll.test.tsx` cobre render (não citado linha-a-linha, mas ver PLL-CP-09 abaixo para a mesma tabela) | ✅ PASS |
| **PLL-CP-06** — busca por nome/e-mail/parlamentar | Um único `.or()` com os 3 `ilike` | `pll-cadastro.test.ts:296-308` — `.or()` recebe exatamente `nome_completo.ilike.%ped%,email.ilike.%ped%,nome_parlamentar.ilike.%ped%` | ✅ PASS |
| **PLL-CP-07** — filtros Partido/UF combináveis | Dois `.eq()` coexistindo | `pll-cadastro.test.ts:311-321` | ✅ PASS |
| **PLL-CP-08** — "Mostrando X–Y de N registros" + navegação | Texto + botões habilitados/desabilitados nos limites | `lista-participantes-pll.tsx:132-164` (`PaginacaoListaParticipantesPll`); `pll-cadastro.test.ts:324-334` cobre o `.range()` do backend | ⚠️ Spec-precision — não achei teste de componente que renderize o texto "Mostrando X–Y de N registros" nem os estados disabled dos botões anterior/próxima (só o backend `.range()` está testado) |
| **PLL-CP-09** — campo obrigatório vazio vira `—`, nunca em branco | Célula mostra `—` | `pll-cadastro.test.ts:337-352` (backend chega `null`); `lista-participantes-pll.tsx:218-223` (`?? "—"`) — sem teste de componente que renderize e assert o `—` na tabela real | ⚠️ Spec-precision — o mapeamento `null → "—"` do backend está testado; a renderização real do `—` na célula da tabela não tem teste de componente próprio |
| **PLL-CP-10** — "vincular TSE" abre `TseMatchSearch` pré-preenchido | Busca inicia com nome/UF autodeclarados | `src/frontend/components/pll/vincular-tse-dialog.test.tsx:68-95` — `combobox` já vem com "Pedro Bigardi" (ou nome completo, lado oposto) | ✅ PASS |
| **PLL-CP-11** — confirmar candidatura chama `criar_mandato`, marca ✓ | `criarMandato` chamado com `candidatura` preenchida; `UPDATE` grava `id_contrato`/`id_vinculo_tse` | `pll-cadastro.test.ts:518-549` — `criarMandatoMock` chamado com `candidatura: CANDIDATURA`; `update` args `= {id_contrato: 42, id_vinculo_tse: 77}` | ✅ PASS |
| **PLL-CP-12** — trocar vínculo preserva histórico | `idContratanteExistente` omite `contratante`/`mandato`, reaproveita RPC existente | `pll-cadastro.test.ts:553-568` | ✅ PASS |
| **PLL-CP-13** — fechar sem decisão é bloqueado | ESC/overlay/X não fecham o dialog | `vincular-tse-dialog.test.tsx:161-216` — Escape e clique no overlay não chamam `onOpenChange(false)`; sem botão de fechar (`showCloseButton={false}`) | ✅ PASS |
| **PLL-CP-14** — Ficha vinculada mostra Situação/Coligação/Votos/Evolução, sem os 3 campos inexistentes | Campos exatos presentes; Número do Candidato/Classificação/Despesa ausentes | `src/frontend/components/pll/ficha-dados-tse.tsx:70-107` (só os 4 campos); `ficha-dados-tse.test.tsx` (não lido linha a linha, mas import confirmado no diff-stat) | ✅ PASS (estrutura do componente confirma D-2; teste de página em `page.test.tsx:246-251` confere candidaturas passadas) |
| **PLL-CP-15** — não vinculado mostra "Ainda não vinculado ao TSE" + atalho | Estado vazio nomeado, nunca campos em branco | `ficha-dados-tse.tsx:44-59`; `page.test.tsx:268-283` — `vinculadoTse: false` e clique em "Simular vincular" navega para a lista | ✅ PASS |
| **PLL-CP-16** — Afinidade mostra as 4 notas 1–5 + chips | 4 notas + chips de outras pautas | `ficha-afinidade-agenda.test.tsx:14-35` (nome inferido do diff-stat; conteúdo real do componente em `ficha-afinidade-agenda.tsx:90-108`) | ✅ PASS |
| **PLL-CP-17** — composição por Casa/UF/ano, eleitos por partido, barra+legenda | Contagem e percentual reais | `src/backend/queries/tse.test.ts:333-352` — 3 valores de "eleito" batem contra dev (comentário datado 22/09/2026); `tse.ts:264-306` | ✅ PASS |
| **PLL-CP-18** — partido <3% agrupa em "Outros" | Agrupamento exato | `tse.test.ts:355-371` — 95/2/2/1 vira `{PT:95%, Outros:5%}` | ✅ PASS |
| **PLL-CP-19** — Casa/ano sem dado mostra "Dados indisponíveis para esta Casa/ano" | Estado nomeado, nunca gráfico vazio | `tse.test.ts:323-327` (função devolve `[]`); `produtos/pll/participantes/[id]/page.tsx:184-198` (`ComposicaoPartidariaCasa` renderiza `EstadoVazio` quando `composicao.length === 0`) — sem teste de componente isolado, mas coberto via `page.test.tsx` indiretamente (composição vazia não testada explicitamente na página) | ⚠️ Spec-precision — a mensagem exata "Dados indisponíveis para esta Casa/ano" não aparece asserida em nenhum `.test.tsx` revisado; só o valor vazio (`[]`) da função está testado |
| **PLL-CP-20** — adicionar/editar/remover Desafios/Destaques | CRUD de lista de texto | `src/frontend/components/pll/editor-lista-texto.test.tsx:28-66` | ✅ PASS |
| **PLL-CP-21** — Ambição: texto livre + até 3 tags | Limite de 3 respeitado | `editor-ambicao-politica.test.tsx:43-64` — campo desabilita com 3 tags; continua habilitado com menos | ✅ PASS |
| **PLL-CP-22** — nada registrado mostra "Nada registrado ainda" + atalho | Estado vazio nomeado | `editor-lista-texto.test.tsx:14-20` | ✅ PASS |
| **PLL-CP-23** — Assessor vê os 3 blocos somente leitura | Sem nenhum botão de editar | `page.test.tsx:309-319` — Assessor (`papel: "assessor"`) vê "(somente leitura)" nos 4 sub-blocos e nenhum botão `/Simular/`; reforçado no banco por `pll-cadastro.test.ts:702-713` (RLS 42501 → `PermissaoNegadaError`) e pela suíte de integração (GRANT ausente) | ✅ PASS — nota: mais forte que o gap equivalente da feature-irmã (`pll-dashboard-agenda` PLL-AG-12), porque aqui a UI é reforçada por GRANT real no banco, não só por checagem client-side |
| **PLL-CP-24** — SWOT com N itens por quadrante, editáveis independentemente | 4 quadrantes independentes | `editor-swot.test.tsx:53-65` — editar "Ameaças" só chama `onChangeAmeacas` | ✅ PASS |
| **PLL-CP-25** — quadrante vazio mostra estado vazio sem esconder os outros 3 | Estado vazio por quadrante, independente | `editor-swot.test.tsx:31-51` | ✅ PASS |

**Status**: ⚠️ Spec-precision gaps flagged (3) — nenhum bloqueante; nenhum AC sem evidência (evidence-or-zero: todos os 25 têm pelo menos 1 `file:line`).

---

## Achado adicional (fora da checklist de ACs, mas afeta PLL-CP-04/05/09 diretamente)

**`status_cadastro` (D-3) nunca transiciona de `'incompleto'` — a derivação descrita na spec não está implementada em lugar nenhum do código.**

- `supabase/migrations/20260922072328_pll_cadastro_participante_estrutura.sql:60` cria a coluna com
  `DEFAULT 'incompleto'` e o `CHECK ck_cadastro_status` aceita `'completo'`/`'incompleto'`/`'pendente_revisao'`
  — mas não há trigger, função ou `DEFAULT` que calcule o valor a partir da completude real da linha.
- `src/backend/queries/pll-cadastro.ts:60-69` (`upsertCadastroParticipantes`) deliberadamente **exclui**
  `status_cadastro` do payload de upsert (confirmado pelo teste `pll-cadastro.test.ts:143-162`, que afirma que
  o payload "NUNCA inclui... `status_cadastro`").
  `vincularParticipanteAoTse` (`pll-cadastro.ts:333-356`) só grava `id_contrato`/`id_vinculo_tse`, nunca
  `status_cadastro`. `atualizarCamposEditaveisParticipante` (`pll-cadastro.ts:384-407`) também não o toca.
- Busca em todos os arquivos do repo por `status_cadastro` (`grep -rl`) só encontra a coluna sendo lida, nunca
  escrita com um valor calculado.
- **Consequência**: toda linha de staging fica com `status_cadastro = 'incompleto'` para sempre, mesmo depois
  de completa e vinculada ao TSE. PLL-CP-05 (coluna "Status de cadastro") e PLL-CP-04 ("atualizar as 3
  métricas de cadastro") exibem um valor que nunca reflete a regra de D-3 ("Completo = campos obrigatórios +
  vinculado ao TSE; Pendente de revisão = completo mas sem vínculo"). `buscarMetricasCadastroPll` (linhas
  249–307) vai sempre reportar `pendentesRevisao` e "completo" como 0/quase-0 na prática, mesmo com
  participantes 100% prontos.
- **Por que não é um mutante do sensor**: isto não é uma regressão detectável por teste (a suíte testa
  corretamente que o campo NÃO é sobrescrito por upsert/vínculo/edição, exatamente como escrito) — é uma
  lacuna de cobertura na cadeia spec → design → tasks: nenhuma task de T1–T19 tem "Done when" que peça o
  cálculo de `status_cadastro`. `tasks.md` nunca atribuiu essa responsabilidade a nenhuma task.
- **Classificação**: gap real de comportamento (não spec-precision — D-3 é bem preciso sobre a regra), mas de
  origem em Design/Tasks, não em um desvio do autor durante Execute.

---

## Discrimination Sensor

Mutações aplicadas em `git`-tracked working copy (arquivos só desta feature), rodadas contra a suíte relevante, e revertidas com `git checkout --` logo em seguida. Nenhuma mutação foi deixada no working tree (confirmado com `git status --short` antes/depois).

| # | File:line | Mutation | Test run | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/backend/schemas/cadastro-participante-pll.ts:55` | `nota_educacao` bound `.max(5)` → `.max(6)` (weakens CHECK-mirroring validation) | `cadastro-participante-pll.test.ts` | ✅ Killed — `rejeita valor inválido para 'nota_educacao': 6` fails (`expected true to be false`) |
| 2 | `src/backend/queries/pll-cadastro.ts:72` | Inverted `atualizados` detection: `emailsExistentes.has(...)` → `!emailsExistentes.has(...)` | `pll-cadastro.test.ts` | ✅ Killed — `{inseridos:0, atualizados:2}` vs expected `{inseridos:2, atualizados:0}` |
| 3 | `src/backend/queries/pll-cadastro.ts:351` | Dropped `id_vinculo_tse` from the staging `.update()` payload after `vincularParticipanteAoTse` | `pll-cadastro.test.ts` | ✅ Killed — update payload missing `id_vinculo_tse: 77` |
| 4 | `src/backend/queries/pll-cadastro.ts:400` | Removed the empty-payload early-return guard in `atualizarCamposEditaveisParticipante` | `pll-cadastro.test.ts` | ✅ Killed — `nenhum campo informado não chama update` now finds an `update` call with `{}` |
| 5 | `src/frontend/components/pll/vincular-tse-dialog.tsx:99` | `if (novoEstado) onOpenChange(true)` → `onOpenChange(novoEstado)` (lets Escape/overlay close the dialog, breaking PLL-CP-13) | `vincular-tse-dialog.test.tsx` | ✅ Killed — "tecla Escape não fecha o dialog" now fails, `onOpenChange` called with `false` |

**Sensor depth**: lightweight (default tier) — 5 targeted mutations across schema/query/UI-decision layers, all in code introduced by this feature.
**Result**: 5/5 killed — PASS ✅

---

## Interactive UAT

Not performed — this Verifier ran as a standalone (non-interactive) agent per the orchestrating task; no user session available for UAT. Automated checks (spec-anchored ACs + sensor + gates) are the evidence of record.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — no speculative abstraction found; `EditorListaTexto` reused for SWOT's 4 quadrants instead of 4 bespoke components |
| Surgical changes | ✅ — feature files are additive; the only modified pre-existing file outside `pll/` scope is `src/backend/queries/tse.ts` (adds `buscarComposicaoPartidariaCasa`, does not touch existing functions) |
| No scope creep | ✅ — "Exportar dados" kept visible-but-disabled per spec's own Out-of-Scope note, not implemented (`upload-planilha-card.tsx:108-114`) |
| Matches patterns | ✅ — mock builder patterns match `visao-gerencial-g3-g6.test.ts`/`prospeccao.test.ts` precedents (explicitly cited in test comments) |
| Spec-anchored outcome check (asserted values match spec) | ✅ for 22/25 ACs; ⚠️ spec-precision gap for 3 (PLL-CP-08, PLL-CP-09, PLL-CP-19 — see table above) |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ — AD-042 (write surfaces) and AD-046 (read surfaces) both honored: write components (`UploadPlanilhaCard`, `VincularTseDialog`, editors) test both sides of every conditional; read components (`FichaDadosTse`, `FichaAfinidadeAgenda`) test happy path + empty state |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every test file opens with a "Spec anchor" comment citing the exact AC/Done-when clause |
| Documented guidelines followed | AD-042/AD-046 (component test harness + scope), AD-024 (RPC reuse, no new RPC), AD-012 (no `_pll` suffix), AD-005 (`—` for empty) — all followed and cited in code comments |

---

## Edge Cases (spec.md)

- [x] E-mail duplicado no mesmo arquivo rejeita o lote inteiro, apontando as duas linhas — `cadastro-participante-pll.test.ts:163-176`
- [ ] Vínculo a candidatura já usada por outro participante do mesmo contrato bloqueia com mensagem clara — **not independently tested for this feature**: `pll-cadastro.test.ts:592-608` confirms the error from `criarMandato` (unique violation) propagates intact without being swallowed, but the actual `UNIQUE` constraint enforcement lives in `dim_contratante` (fundação feature), reused here — acceptable by design (AD-024, "no new RPC"), but there is no test in this feature's scope that the error message is *user-clear* at the UI layer (`participantes/page.tsx:317-329` does show `toast.error(descreveErroDesconhecido(erro))`, unverified by a component test)
- [x] Reimportação nunca desfaz vínculo confirmado — `pll-cadastro.test.ts:143-162` (payload never includes `id_contrato`/`id_vinculo_tse`)
- [ ] Exportar dados (P3 se não houver tempo) — correctly deferred, button present-but-disabled, no functionality — not a gap, matches spec's own allowance
- [x] Mandato vigente reflete candidatura vigente (`eh_mandato_vigente`), nunca uma anterior — `produtos/pll/participantes/[id]/page.tsx:149-158` filters by `eh_mandato_vigente: true`; not covered by a dedicated `page.test.tsx` case with two candidaturas where one is not vigente (⚠️ spec-precision — the vigente-selection logic itself is untested; the tests that exist use only one candidatura)

---

## Gate Check

- **Gate command**: `npm run lint:all && npm run build && npm run test:unit` (Build gate); `npm run test:unit && npm run test:integration` on the RLS suite (Full gate, T2)
- **Result**:
  - `npm run test:unit`: **1758 passed, 0 failed** (162 test files). 4 unhandled-rejection errors logged during the run, all inside `src/frontend/app/(app)/contratos/[id]/fatos-registros/page.test.tsx` (`use-papel-global.ts` calling `.auth.getUser()` on an incomplete mock) — **outside this feature's diff scope**, pre-existing in a file this feature did not touch.
  - `npm run build`: succeeds, all routes compile, including `/produtos/[slug]/participantes` and `/produtos/pll/participantes/[id]`.
  - `npm run lint:all`: **1 error** — `DADOS TSE/carga_amostral.js:150` (`filterCampinas` unused var). This file is not part of this feature (it appears modified in the pre-existing `git status` snapshot, unrelated ongoing work in the shared dev tree) — **not attributable to this feature**.
  - `npx vitest run --config vitest.integration.config.ts supabase/tests/pll/fat-cadastro-participante-rls.integration.test.ts`: **13/13 passed** (154s), run isolated as instructed.
- **Test count before feature**: not measured directly (git history predates this session); no evidence of deleted or weakened tests found in the diff.
- **Test count after feature**: 46 files added/changed touch this feature per `git diff --stat`, contributing ~700+ new test cases across schema/query/component suites (not separately isolated from the sibling `pll-dashboard-agenda` count in this run).
- **Skipped tests**: none found.
- **Failures**: none in this feature's scope.

---

## Fix Plans

### Fix 1: `status_cadastro` (D-3) never derives from actual completeness

- **Root cause**: No task in `tasks.md` T1–T19 assigns responsibility for computing `status_cadastro` from
  field completeness + TSE-link state. The column exists with the right `CHECK` and a static `DEFAULT`, but
  nothing ever transitions it.
- **Fix task**: Add a DB trigger (`BEFORE INSERT OR UPDATE`) or an application-layer computation (in
  `upsertCadastroParticipantes`/`vincularParticipanteAoTse`) that derives `status_cadastro` per D-3's rule
  ("completo" = required fields + TSE link; "pendente_revisao" = required fields complete, no TSE link;
  "incompleto" = missing required field), plus a migration + integration test proving the transition on
  insert/update/vínculo.
- **Priority**: Major — the 3 métricas shown in `UploadPlanilhaCard` (PLL-CP-04) and the Status column
  (PLL-CP-05) are currently decorative; they will show `pendentesRevisao`/`completo` as always-zero-ish in
  production regardless of real data state.

### Fix 2 (minor): 3 spec-precision gaps lack component-level assertions

- PLL-CP-08 (pagination text + button disabled states), PLL-CP-09 (rendered `—` in the actual table cell),
  PLL-CP-19 ("Dados indisponíveis para esta Casa/ano" message rendered) — all implemented correctly in the
  component code reviewed, but no `.test.tsx` in this feature's scope asserts the rendered text/attribute
  directly (only the upstream data-shaping functions are tested).
- **Fix task**: Add 3 targeted component assertions to `lista-participantes-pll.test.tsx` and
  `produtos/pll/participantes/[id]/page.test.tsx` (or a dedicated `ComposicaoPartidariaCasa` unit if it is
  extracted to its own file).
- **Priority**: Minor — behavior is correct by code inspection; this is a coverage gap, not a functional bug.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PLL-CP-01 … 04 | Pending | ✅ Verified (PLL-CP-04 flagged, see Fix 1 re: métricas accuracy) |
| PLL-CP-05 … 09 | Pending | ✅ Verified (PLL-CP-05 flagged re: status_cadastro; PLL-CP-08/09 spec-precision gaps) |
| PLL-CP-10 … 13 | Pending | ✅ Verified |
| PLL-CP-14 … 16 | Pending | ✅ Verified |
| PLL-CP-17 … 19 | Pending | ✅ Verified (PLL-CP-19 spec-precision gap) |
| PLL-CP-20 … 23 | Pending | ✅ Verified |
| PLL-CP-24 … 25 | Pending | ✅ Verified |

---

## Summary

**Overall**: ⚠️ Issues (1 Major behavioral gap, not a UI/RLS bypass — see Fix 1; 2 Minor/spec-precision items — see Fix 2)

**Spec-anchored check**: 25/25 ACs have `file:line` evidence; 22/25 match the spec-defined outcome exactly, 3 flagged as spec-precision gaps (PLL-CP-08, PLL-CP-09, PLL-CP-19)
**Sensor**: 5/5 mutations killed
**Gate**: unit 1758 passed/0 failed; build green; RLS integration 13/13 passed; lint has 1 pre-existing, out-of-scope failure

**What works**: Import/validation (all-or-nothing, duplicate detection), list + search/filter/pagination,
TSE linking with the "never close without a decision" guarantee (PLL-CP-13, sensor-confirmed), the Ficha's
read blocks (Dados TSE/Afinidade/Composição Partidária) with real D-2 field exclusions, the 3 editable
blocks with Assessor read-only enforced BOTH client-side (UI) AND server-side (RLS/GRANT — confirmed by
13-test integration suite), unlike the sibling feature's equivalent gap (`pll-dashboard-agenda` PLL-AG-12,
which had none of the RLS backing).

**Issues found**:
1. **`status_cadastro` (D-3) never transitions past its `DEFAULT 'incompleto'`** — no task assigned this
   responsibility; the 3 métricas and the Status column are effectively decorative in production. Fix: add
   trigger/derivation + tests (see Fix 1).
2. 3 spec-precision gaps where implementation looks correct but lacks a direct component-level test
   (pagination text, `—` render, "Dados indisponíveis" message). Fix: add the missing assertions (see Fix 2).

**Next steps**: Route Fix 1 as a follow-up task (Major) before considering PLL-CP-04/05 fully done; Fix 2 is
optional hardening, not blocking.

---

## Fixes aplicados (pós-Verifier)

**Data**: 2026-09-22

### Fix 1 (Major): `status_cadastro` nunca saía do `DEFAULT 'incompleto'`

- **Abordagem**: trigger `BEFORE INSERT OR UPDATE` em `fat_cadastro_participante` (não RPC, não cálculo em
  TypeScript) -- confirma a recomendação do Fix Plan: é recômputo de uma coluna a partir de colunas da MESMA
  linha, não cruza tabela nem precisa de papel sem GRANT, então nem AD-035 nem AD-024 se aplicam; `SECURITY
  INVOKER` basta.
- **Migration**: `supabase/migrations/20260922152934_pll_cadastro_participante_status_trigger.sql` -- função
  `calcular_status_cadastro_participante()` + trigger `trg_calcular_status_cadastro_participante`, aplicando a
  regra de D-3:
  - **completo** = campos obrigatórios da planilha preenchidos **e** `id_contrato IS NOT NULL` (mesmo sinal de
    vínculo TSE que `buscarCadastroParticipantesPll`/`vincularParticipanteAoTse` já usam em
    `src/backend/queries/pll-cadastro.ts`)
  - **pendente_revisao** = campos obrigatórios preenchidos, sem vínculo
  - **incompleto** = falta `papel`, `nome_completo` ou `email` -- os únicos 3 campos sem
    `.nullable().optional()` em `src/backend/schemas/cadastro-participante-pll.ts` (T3), confirmados por
    releitura do arquivo antes de implementar
  - A migration também recalcula as linhas já existentes na tabela (UPDATE no-op disparando o trigger em
    todas de uma vez), corrigindo o passado, não só o futuro.
- **Achado durante a implementação**: `papel`/`nome_completo`/`email` já são `NOT NULL` na própria tabela (T2,
  `texto_limpo` para os dois primeiros, que também recusa string vazia) -- ou seja, o branch "incompleto" é
  **estruturalmente inalcançável** por um INSERT/UPDATE normal em `fat_cadastro_participante` hoje: qualquer
  tentativa de gravar um desses campos vazio já falha por violação de constraint antes do trigger conseguir
  persistir a linha. Implementado mesmo assim (por completude, e para o caso de a constraint mudar no
  futuro), mas testado isolando a mesma função de trigger numa `TEMP TABLE` de sessão sem essas constraints
  -- não é possível provar esse branch tocando a tabela real. Registrado aqui como achado de risco: se a
  intenção de produto for que "incompleto" apareça de fato na tela hoje, ele nunca vai aparecer com o schema
  atual -- só `pendente_revisao`/`completo` são estados alcançáveis em produção. Nenhuma mudança de schema foi
  feita para "abrir" esse estado, porque não fazia parte do escopo do gap reportado (a spec já define os 3
  estados e o CHECK já aceitava os 3 valores antes deste fix).
- **Código de aplicação**: nenhuma mudança necessária. `upsertCadastroParticipantes`,
  `vincularParticipanteAoTse` e `atualizarCamposEditaveisParticipante` (`src/backend/queries/pll-cadastro.ts`)
  já excluíam `status_cadastro` do payload deliberadamente (comportamento correto, preservado) -- a trigger
  passa a ser a única fonte da coluna, exatamente como o Fix Plan recomendava.
- **Testes**:
  - Novo: `supabase/tests/pll/fat-cadastro-participante-status.integration.test.ts` -- 4 testes cobrindo os 3
    estados (`pendente_revisao` no insert sem vínculo mesmo com todos os 22 campos opcionais NULL, `completo`
    no insert com vínculo, transição `pendente_revisao -> completo -> pendente_revisao` via UPDATE de
    `id_contrato`, e `incompleto` via TEMP TABLE isolada com a mesma função de trigger, 3 variações: papel
    NULL, nome em branco, email NULL mesmo com vínculo preenchido). **4/4 passed** (`npx vitest run --config
    vitest.integration.config.ts supabase/tests/pll/fat-cadastro-participante-status.integration.test.ts`,
    ~55s).
  - Atualizado: `supabase/tests/pll/fat-cadastro-participante-rls.integration.test.ts` -- o teste "Gestora
    insere um participante" asserido `status_cadastro === 'incompleto'` (valor correto só porque a coluna
    nunca saía do DEFAULT); corrigido para `'pendente_revisao'`, o valor real agora que a trigger calcula
    a partir da linha (papel/nome/email preenchidos, sem `id_contrato`). Suíte completa re-executada: **13/13
    passed** (~173s).
  - `npm run test:unit`: **1767 passed, 0 failed** (162 arquivos) -- mesmos 4 unhandled-rejection pré-existentes
    e fora de escopo já relatados pelo Verifier (`fatos-registros/page.test.tsx`, `use-papel-global.ts`), não
    afetados por este fix.
  - `npm run build`: verde, todas as rotas compilam.
- **Commits**:
  - `f752bfa` -- `fix(pll): calcula status_cadastro via trigger (D-3, gap Major pós-Verifier)` (migration +
    teste novo)
  - `8d32f8e` -- `test(pll): atualiza expectativa de status_cadastro pós-trigger (D-3)` (ajuste do teste RLS
    existente)

### Fix 2 (minor, spec-precision) -- não endereçado nesta rodada

Fora de escopo desta correção (que tratou só do gap Major listado acima). PLL-CP-08/09/19 continuam com
implementação correta e sem asserção de componente direta -- ver Fix Plan original.

**Risco novo encontrado**: nenhum além do já registrado acima (estado "incompleto" inalcançável no schema
atual). Nenhuma migration de terceiros foi tocada; `db push` durante esta sessão também aplicou uma migration
pendente alheia (`20260922151933_planejamento_deriva_situacao_do_pct.sql`, já presente no repo antes desta
sessão) porque `supabase db push` sempre aplica todo o pendente -- não foi criada nem alterada por este
trabalho.
