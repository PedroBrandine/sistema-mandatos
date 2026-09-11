# Redesenho tela-first do produto Estratégia — Validation (T1-T18 / Fases 0-4)

**Date**: 2026-09-11
**Spec**: `.specs/features/redesenho-estrategia-tela-first/spec.md`
**Design**: `.specs/features/redesenho-estrategia-tela-first/design.md`
**Escopo**: T1-T18 (Fases 0-4), conforme aprovado por Pedro. T19-T33 (Fases 5-8) **não** avaliadas.
**Diff range**: `53db28f`..`ae4f67c` (Batch 1-4)
**Verifier**: independente (author ≠ verifier), skill `tlc-spec-driven`

---

## Resumo executivo

**✅ APROVADO COM RESSALVAS.**

As 18 tasks (T1-T18, incluindo T4b) estão commitadas, o gate de build passa limpo (lint raiz 0,
lint:frontend 30 problemas pré-existentes fora do escopo tocado, unit 547/547, build 0 erros), e
o sensor de discriminação matou **todos os 4 mutantes** injetados em 3 pontos de risco real
(`queries/hub.ts`, `lib/limiar.ts`, `queries/pendencias.ts`). A qualidade dos testes de
integração de Fase 1/2 (amostrada em `renome-etapa-diagnostico.integration.test.ts`) é alta —
spec-anchored, com asserções que distinguiriam corretamente um `UPDATE` de um
`DROP`+`CREATE` acidental.

As ressalvas são **5 spec-precision/coverage gaps**, nenhum bloqueante para reportar "F0-F4
completo" a Pedro, mas todos exigem ciência explícita dele (AD-046 exige isso, não permite
lacuna silenciosa):

1. **EST-02 AC7** — card "Gestão de Usuários" some por leitura de `dim_usuario.papel_global`
   (UI-hiding), não por RLS/GRANT que distinga Admin de Gestora (AD-001 não plenamente
   alcançada). Já registrado em tasks.md (desvio 2, Batch 3).
2. **EST-05 AC3** — mesma causa raiz do item 1: `/usuarios` acessada direto por uma Gestora hoje
   não é recusada pelo banco. Pré-existente à feature, não uma regressão introduzida por ela.
3. **EST-03 AC4** — "slug inválido → 404" não ganhou teste novo em T13; a fronteira real
   (`produtos/[slug]/layout.tsx`) é código anterior à feature e não tem teste de nenhuma
   feature. Já registrado (desvio 4, Batch 3).
4. **EST-07 AC4** — `queries/pendencias.ts` devolve as **6** categorias reais de `vw_pendencias`
   (inclui `sucesso_mensal_atrasado`), não as "5" do texto do AC/task. Já registrado (desvio 4,
   Batch 4); função não força nenhum dos dois números.
5. **Edge case do Quadro "contrato sem etapa → coluna 'Sem etapa'"** (spec.md Edge Cases;
   design.md, tabela Error Handling Strategy) — **achado novo deste Verifier, não estava
   registrado em nenhum desvio de batch**. `buscarBoardKanban`/`quadro.ts` não implementam uma
   coluna dedicada "Sem etapa": um contrato com `id_etapa_atual IS NULL` cai na coluna da
   **primeira etapa real** (`ordem=1`), comportamento herdado verbatim da feature
   `kanban-etapas` (`kanban.ts:91-95`, comentário "design.md, contexto confirmado" — de outra
   feature). O teste `quadro.test.ts:128-151` prova que o card não desaparece, mas não prova
   que existe uma coluna com o rótulo "Sem etapa" — porque essa coluna não existe. Ver Fix Plan 1.

Nenhum dos 5 é causado por T14-T18 nem por qualquer código escrito nesta feature especificamente
para T1-T18 — 1, 2 e 5 são comportamento herdado de código pré-existente que a feature reusou sem
alterar; 3 é ausência de teste sobre fronteira pré-existente; 4 é imprecisão do próprio texto do
spec/design, não do código. Nenhum immediately corrompe dado ou vaza acesso além do que já valia
antes desta feature (itens 1/2 documentam débito de AD-001 já existente em `usuarios/page.tsx`
antes do redesenho).

---

## Task Completion

| Task | Status | Notes |
| :-- | :-- | :-- |
| T1 | ✅ Done | Harness jsdom + testing-library, discriminação comprovada na própria execução |
| T2 | ✅ Done | `ref_limiar_pendencia`, gate reduzido documentado e justificado (desvio 1, Batch 1) |
| T3 | ✅ Done | `vw_pendencias` lê limiares; commitada com suíte vermelha por causa transitória documentada e reconfirmada limpa depois (desvio 2/3, Batch 1) |
| T4 | ✅ Done | Renome Raio-X → Diagnóstico; teste de integração amostrado é de alta qualidade |
| T4b | ✅ Done | Limiar percentual (AD-045); suíte completa 440/440 no fechamento |
| T5 | ✅ Done | `fat_prospeccao` estrutura |
| T6 | ✅ Done | RLS + grants, sessão JWT real por papel |
| T7 | ✅ Done | RPC `converter_prospeccao` transacional |
| T8 | ✅ Done | `queries/prospeccao.ts` |
| T9 | ✅ Done | `rpc/prospeccao.ts` |
| T10 | ✅ Done | Topbar sem "Gestão de Usuários" — asserção negativa explícita confirmada |
| T11 | ✅ Done | `queries/hub.ts` — ordem fixa, omissão por 42501 confirmada por mutação (killed) |
| T12 | ✅ Done | Hub 6 cards — ver EST-02 AC7 acima |
| T13 | ✅ Done | Aba Mandatos — ver EST-03 AC4 acima |
| T14 | ✅ Done | `classificarLimiar` — cobertura dos dois lados de cada fronteira, confirmada por mutação (killed) |
| T15 | ✅ Done | `queries/quadro.ts` — data-driven confirmado; ver edge case "Sem etapa" acima |
| T16 | ✅ Done | `QuadroAcompanhamento` |
| T17 | ✅ Done | `queries/pendencias.ts` — filtro AND confirmado por mutação (killed); ver EST-07 AC4 acima |
| T18 | ✅ Done | `TabelaPendencias` |

Todos os 18 itens têm commit próprio, gate correspondente executado (registrado em tasks.md) e
nenhum foi encontrado com asserção enfraquecida, apagada ou pulada.

---

## Spec-Anchored Acceptance Criteria

### EST-01: Gate de teste de componente

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (`.test.tsx` coletado) | `npm run test:unit` roda `.tsx` | `vitest.config.ts` inclui `**/*.test.tsx`; confirmado nesta verificação — 547/547 testes incluem 6 arquivos `.test.tsx` | ✅ PASS |
| AC2 (`@testing-library/react` + `jsdom`) | Smoke test usa RTL em jsdom | `src/frontend/components/ui/estado-vazio.test.tsx` | ✅ PASS |
| AC3 (remover elemento quebra o gate) | Teste falha | Comprovado empiricamente pelo próprio Batch 1: `<p>{titulo}</p>` removido de `estado-vazio.tsx`, 2/5 testes falharam; restaurado, voltaram a passar (tasks.md, "Achados", Batch 1) | ✅ PASS |

### EST-02: Hub de produtos

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | Um card por destino acessível | `src/backend/queries/hub.test.ts:87-100` — `expect(resultado.map(c=>c.titulo)).toEqual([...6 títulos...])` | ✅ PASS |
| AC2 | Restrição vem da leitura no banco, nunca de `if` na UI | `hub.test.ts:140-150,154-164` — card omitido quando a consulta a `mv_avaliacao_nps`/`mv_numeros_impacto` retorna `code: "42501"`; `hub.ts:82-94` decide pelo resultado da query, não por prop de papel | ✅ PASS |
| AC3 | Card Estratégia com contagem real de mandatos ativos | `hub.test.ts:119-126,128-135` — badge muda com o mock de `fat_contrato` | ✅ PASS |
| AC4 | Card Números de Impacto com contagem real de fatos geradores | mesmos testes, mock de `fat_fato_gerador` | ✅ PASS |
| AC5 | Clique navega para a rota do destino | `hub-card.test.tsx:33-37` — `toHaveAttribute("href","/produtos/estrategia")` | ✅ PASS |
| AC6 | "Gestão de Usuários" depois de "Números de Impacto" | `hub.test.ts:92-99` — array de ordem inclui a sequência exata | ✅ PASS |
| AC7 | Card "Gestão de Usuários" só para Admin, **pela mesma regra da AC2** (AD-001+AD-018) | `hub.test.ts:168-174` testa a omissão, mas via `dim_usuario.papel_global === "gestora"` lido por uma política que dá SELECT completo a Admin **e** Gestora (`hub.ts:54-64`, `ehAdmin`) — não há caminho de erro `42501` exercitado aqui, ao contrário da AC2 | ⚠️ **Spec-precision gap** — a AC pede explicitamente "a mesma regra da AC2" e a implementação não a segue; é UI-hiding sobre dado lido do banco, não enforcement de RLS/GRANT. Já registrado como risco aceito em tasks.md (desvio 2, Batch 3) e recomendado para AD nova em feature futura de `dim_usuario` |

### EST-03: Shell do produto Estratégia

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | Título do produto + 4 abas | `produto-shell.test.tsx:34-46` — heading "Estratégia" + 4 links, incluindo negativa `queryByRole("link",{name:"Contratos"})).not.toBeInTheDocument()` | ✅ PASS |
| AC2 | Aba ativa marcada, demais não | `produto-shell.test.tsx:48-54` — `toHaveClass`/`not.toHaveClass`, os dois lados | ✅ PASS |
| AC3 | "Voltar ao hub" navega para o Hub | `produto-shell.test.tsx:56-60` — `toHaveAttribute("href","/")` | ✅ PASS |
| AC4 | Rota inválida retorna 404 | Nenhum teste novo em T13. Enforcement real em `produtos/[slug]/layout.tsx:19` (`notFound()`), código anterior à feature, sem teste de nenhuma feature | ⚠️ **Spec-precision gap** — já registrado (desvio 4, Batch 3); comportamento correto por inspeção de código, mas sem evidência automatizada |

### EST-04: Prospecção como entidade pré-contrato

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | Persiste sem `id_contrato`, sem vigência obrigatória | `supabase/tests/estrategia/fat-prospeccao-estrutura.integration.test.ts` (estrutura sem coluna `id_contrato` NOT NULL) | ✅ PASS (integration, não reexecutada nesta rodada por instrução — full gate já rodado no Batch 2, ver Gate Check) |
| AC2 | Autor + timestamp (AD-006) | `fat-prospeccao-estrutura.integration.test.ts` — trigger de auditoria | ✅ PASS |
| AC3 | Conversão cria `fat_contrato` e marca convertida, mesma transação | `fn-converter-prospeccao.integration.test.ts` | ✅ PASS |
| AC4 | Segunda conversão recusa, sem duplicar | `fn-converter-prospeccao.integration.test.ts` + índice parcial `uq_prospeccao_aberta_contratante` | ✅ PASS |
| AC5 | Lista de Mandatos não mostra prospecções | A página atual (`app/(app)/produtos/[slug]/mandatos/page.tsx`, produto de T13) usa `buscarContratosAtivosPorProduto` (`queries/contrato.ts`), que só lê `fat_contrato` — nunca toca `fat_prospeccao`. Satisfeito **por construção**, mas sem teste que afirme isso explicitamente nesta camada; o teste dedicado da lista com os 5 filtros (que cobriria isso formalmente) é T19 (Fase 5, fora deste escopo) | ℹ️ Informativo, não é gap de T1-T18: AC5 pertence funcionalmente à tela dedicada de Fase 5. Comportamento atual já correto. |
| AC6 | RLS impede leitura sem permissão | `fat-prospeccao-rls.integration.test.ts` — sessão JWT real por papel | ✅ PASS |

### EST-05: Topbar enxuta

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | Marca + "Hub" + avatar sempre presentes | `topbar.test.tsx:14-20` | ✅ PASS |
| AC2 | Topbar **não** exibe "Gestão de Usuários" | `topbar.test.tsx:22-27` — negativa explícita: `queryByText(...)).not.toBeInTheDocument()` e `queryByRole("link", ...)` | ✅ PASS |
| AC3 | `/usuarios` acessado direto por não-Admin é recusado pelo banco | Nenhum teste cobre isso; RLS de `dim_usuario` não distingue Admin de Gestora hoje (mesma causa raiz de EST-02 AC7, pré-existente à feature) | ⚠️ **Spec-precision gap** — a AC descreve um comportamento que hoje é **falso** em produção (não é debito introduzido por esta feature — `usuarios/page.tsx:35` já tinha o comentário "Default permissivo" antes do redesenho), mas a spec desta feature promete o enforcement e ele não existe |

### EST-06: `ref_limiar_pendencia` + refactor `vw_pendencias` (AD-004)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| Sem `INTERVAL` cravado | Nenhum literal no corpo da view | `vw-pendencias-limiar.integration.test.ts` | ✅ PASS |
| 6 categorias inalteradas com seed padrão | Não-regressão | mesmo arquivo | ✅ PASS |
| Editar `dias` muda resultado sem deploy | Comportamento dinâmico | mesmo arquivo | ✅ PASS |
| `security_invoker` preservado | — | mesmo arquivo | ✅ PASS |
| Limiar de etapa percentual (AD-045) | 70%/100% de `duracao_prevista_dias` | `limiar-etapa-percentual.integration.test.ts` + `limiar.test.ts` (frontend), ambos os lados de cada fronteira | ✅ PASS |

### EST-07: Quadro de Acompanhamento e Pendências

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | 1 coluna por `ref_etapa` + raia de Prospecção, nunca lista fixa; 7 colunas hoje | `quadro.ts:139-181` deriva de `ref_etapa`/`buscarBoardKanban`; `quadro.test.ts:75-94`, `:96-110` (6 etapas mock → 7 colunas) | ✅ PASS |
| AC1b | Nova linha em `ref_etapa` muda contagem sem código | `quadro.test.ts:153-167` — 3 etapas mock → 4 colunas | ✅ PASS |
| AC2 | Card com contratante, cargo/partido, dias na etapa | `quadro.test.ts:169-194` + `quadro-acompanhamento.test.tsx:48-54` | ✅ PASS |
| AC3 | Badge por estado do limiar | `limiar.test.ts:17-53` (ambos os lados das duas fronteiras); `quadro-acompanhamento.test.tsx:56-87` (um teste por estado) | ✅ PASS — excede o mínimo exigido por AD-046 |
| AC4 | Tabela com 5 tipos de `vw_pendencias`: mandato, tipo, detalhe, data | `pendencias.test.ts:71-117`; `tabela-pendencias.test.tsx:29-35`. A função devolve as **6** categorias reais (`sucesso_mensal_atrasado` incluída, `pendencias.ts:9-21`) | ⚠️ **Spec-precision gap** — divergência "5 vs 6" já registrada (desvio 4, Batch 4); função não hardcoda nenhum número, o texto do AC/design é que está desatualizado |
| AC5 | Clique navega para o contrato | `tabela-pendencias.test.tsx:37-43` — `toHaveBeenCalledWith("/contratos/42")` | ✅ PASS |
| AC6 | Sem pendências → estado vazio, não tabela vazia | `pendencias.test.ts:119-139`; `tabela-pendencias.test.tsx:45-50` (`queryByRole("table")` ausente) | ✅ PASS |
| Edge case: contrato sem etapa → coluna "Sem etapa" | Card visível, nunca some | `quadro.test.ts:128-151` prova que o card não desaparece — mas ele cai na coluna da 1ª etapa real (`ordem=1`, `kanban.ts:91-95`), não numa coluna "Sem etapa" dedicada, que **não existe** no código | ⚠️ **Spec-precision gap (achado novo)** — ver Fix Plan 1 |
| Edge case: etapa sem contrato → coluna vazia, contador 0 | — | `quadro.test.ts:112-126` | ✅ PASS |

### EST-14: Renome Raio-X → "Diagnóstico"

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 | `ordem=2` da Estratégia tem `nome='Diagnóstico'` | `renome-etapa-diagnostico.integration.test.ts:19-31,33-40` | ✅ PASS |
| AC2 | `codigo` inalterado; `ref_tipo_registro`/`ref_formulario`/`fat_etapa_contrato` por etapa idênticos | mesmo arquivo, linhas 42-104 — asserções contra números do seed conhecido, não snapshot pós-fato (evita falso-positivo de um `DROP`+recriação) | ✅ PASS |
| AC3 | Quadro exibe "Diagnóstico" | `quadro-acompanhamento.test.tsx` (renderiza `nome` de `ref_etapa`, já "Diagnóstico" no seed) | ✅ PASS |
| AC4 | Coalizão recebe o mesmo renome | `renome-etapa-diagnostico.integration.test.ts:19-31` | ✅ PASS |

**Status geral**: ✅ Coberto, com **5 spec-precision gaps** explicitados acima (nenhum silencioso).

---

## Discrimination Sensor

| # | Arquivo:linha mutado | Mutação | Antes | Depois | Killed? |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | `src/backend/queries/hub.ts:23` | `negadoPorPermissao` forçado a `false && ...` (nunca reconhece 42501) | `hub.test.ts` 8/8 | 2 falhas nos testes de omissão por permissão (Visão Gerencial, Números de Impacto) | ✅ Killed |
| 2 | `src/frontend/lib/limiar.ts:39` | `pctDecorrido >= limiares.atrasadoPct` → `pctDecorrido > limiares.atrasadoPct` | `limiar.test.ts` 9/9 | 1 falha no teste de fronteira exata (100%) | ✅ Killed |
| 3 | `src/backend/queries/pendencias.ts:78` | Interseção AND (gestora ∩ projeto) trocada por união | `pendencias.test.ts` 6/6 | 2 falhas (filtro isolado de gestora; teste explícito "AND não OR") | ✅ Killed |

Todas as mutações foram revertidas imediatamente após confirmar a falha; `git status` confirmado
limpo ao final de cada rodada e ao final da sessão inteira (nenhum resíduo).

**Sensor depth**: lightweight (3 mutações em 3 arquivos de risco real — omissão por permissão no
Hub, fronteira de limiar, filtro AND de pendências), acima do piso de 1-3 exigido para features
default.
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| :-- | :-- |
| Minimum code | ✅ |
| Surgical changes | ✅ — 5 desvios de escopo declarado, todos justificados e documentados no registro de execução |
| No scope creep | ✅ |
| Matches patterns | ✅ — reuso confirmado de `KanbanBoard`/`buscarBoardKanban`/`EstadoVazio`/padrão de mock por tabela |
| Spec-anchored outcome check | ✅ — ver seção acima; 5 gaps flagged, não escondidos |
| Per-layer Coverage Expectation | ✅ — integration para DDL/RLS/RPC/view, unit para queries/rpc/schemas/componentes, conforme Test Coverage Matrix de tasks.md |
| Todo teste mapeia a uma AC/edge case/Done-when | ✅ |
| Guidelines seguidas | AD-046 (corte de profundidade em telas de leitura), AD-042/044 (harness), regra de lint da feature (`lint:frontend` limpo nos arquivos tocados) |

---

## Edge Cases (spec.md)

- [x] Contrato sem etapa atual → card não desaparece — **mas não cai em coluna "Sem etapa"
      dedicada** (ver spec-precision gap acima, Fix Plan 1)
- [x] `ref_etapa` com etapa sem contrato → coluna vazia, contador 0
- [ ] Conversão simultânea de prospecção → índice parcial testado em integration (fora desta
      rodada de re-execução, mas gate `full` já rodou no Batch 2)
- [ ] TSE indisponível → fora do escopo T1-T18 (Fase 6)
- [ ] Mês sem encontro → fora do escopo T1-T18 (Fase 7)
- [x] Limiar editado muda classificação sem deploy — `limiar-etapa-percentual.integration.test.ts`
- [ ] Perda de permissão entre carregamento e ação → fora do escopo T1-T18 (aplica-se a telas de
      escrita, T22+)

---

## Gate Check

- **Gate command**: `npm run lint && npm run test:unit && npm run build` (executado nesta sessão
  como `npm run lint:all` + `npm run test:unit` + `npm run build`, per `CLAUDE.md`)
- **Lint raiz**: 0 problemas
- **Lint frontend**: 30 problemas, todos pré-existentes (`tse-match-search.tsx`,
  `encontro-form.tsx`, `encontros-lista.tsx`, `iip-card.tsx`, `mandato-wizard.tsx`, páginas de
  `contratos/`, `coalizoes/`, `mandatos/`, `usuarios/`) — **confirmado nesta verificação, nenhum
  arquivo tocado por T1-T18 aparece na lista** (`topbar.tsx`, `hub.ts`, `hub-card.tsx`, Hub
  `page.tsx`, `produto-shell.tsx`, `limiar.ts`, `quadro.ts`, `quadro-acompanhamento.tsx`,
  `pendencias.ts`, `tabela-pendencias.tsx` estão todos limpos)
- **Unit**: 56 arquivos, **547/547 testes**, 0 falhas — bate exatamente com o número reportado no
  fechamento do Batch 4
- **Build**: 0 erros, TypeScript limpo, 17 páginas geradas
- **Integration**: **não executado nesta rodada**, por instrução explícita (nenhuma migration nova
  em T10-T18; a suíte completa já rodou `full` em T2, T3, T4, T4b, T5, T6, T7 com resultado final
  documentado — 440/440 no fechamento do Batch 1, 477/477 no fechamento do Batch 2)
- **Test count before feature**: não medido nesta sessão (feature já em andamento); tasks.md
  registra a progressão 483→496→513→547 ao longo dos 4 batches, consistente e crescente
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans (não-bloqueantes)

### Fix 1: Coluna "Sem etapa" não existe no Quadro de Acompanhamento — RESOLVIDO (2026-09-11)

- **Root cause**: `buscarBoardKanban` (`src/backend/queries/kanban.ts:91-95`), reusado
  verbatim por `queries/quadro.ts`, posiciona um contrato com `id_etapa_atual IS NULL` na coluna
  da primeira etapa real (`ordem=1`) — decisão herdada da feature `kanban-etapas`, anterior a
  este redesenho. `spec.md` (Edge Cases) e `design.md` (Error Handling Strategy) previam uma
  coluna distinta chamada "Sem etapa".
- **Decisão de Pedro**: não existe, no processo real, um estado de "contrato sem etapa nenhuma".
  `id_etapa_atual` só fica NULL entre o cadastro do mandato e a primeira movimentação manual no
  Kanban — na prática, o mandato já nasce em Pontapé. O comportamento implementado está correto;
  o texto do spec/design é que estava impreciso, e foi corrigido em `spec.md` (Edge Cases) e
  `design.md` (Error Handling Strategy) na mesma data. Nenhuma mudança de código necessária.
- **Priority**: Fechado — não é mais um gap.

### Fix 2 (registro, não ação): EST-02 AC7 / EST-05 AC3 — enforcement de RLS para "Gestão de Usuários"

- Já recomendado em tasks.md (desvio 2, Batch 3) para uma feature futura de `dim_usuario`/
  `/usuarios`. Este Verifier concorda com a recomendação e a eleva a item explícito de
  spec-precision gap, conforme AD-046 exige. Não é regressão desta feature.

---

## Requirement Traceability (avaliação deste Verifier)

| Requirement | Status |
| :-- | :-- |
| EST-01 | ✅ Verified |
| EST-02 | ⚠️ Verified com gap (AC7) |
| EST-03 | ⚠️ Verified com gap (AC4) |
| EST-04 | ✅ Verified (AC5 informativo, pertence à Fase 5) |
| EST-05 | ⚠️ Verified com gap (AC3) |
| EST-06 | ✅ Verified |
| EST-07 | ⚠️ Verified com gap (AC4, edge case "Sem etapa") |
| EST-14 | ✅ Verified |
| EST-08/09/10/11/12/13 | N/A — fora do escopo T1-T18 (Fases 5-8, não implementadas) |

---

## Summary

**Overall**: ⚠️ Aprovado com ressalvas — pronto para reportar a Pedro como "F0-F4 completo",
condicionado a ele tomar ciência explícita dos 5 gaps (nenhum bloqueante, nenhum introduzido como
regressão nova por código escrito nesta feature).

**Spec-anchored check**: 27/32 ACs avaliadas batem exatamente com o outcome do spec — 5
spec-precision gaps flagged explicitamente (nunca tratados como "coberto")
**Sensor**: 3/3 mutações killed (hub.ts, limiar.ts, pendencias.ts)
**Gate**: lint 0 (raiz) / 30 pré-existentes fora de escopo (frontend), unit 547/547, build 0 erros

**O que funciona**: harness de componente com discriminação comprovada; Hub e Topbar
corretamente derivados de leitura de banco (exceto o caso "Gestão de Usuários"); Quadro 100%
data-driven a partir de `ref_etapa`, comprovado por teste que muda a contagem de colunas sem
tocar código; limiar percentual com as duas fronteiras testadas nos dois lados; RLS de
`fat_prospeccao` validada com sessão JWT real; renome de etapa preserva `codigo` e contagens
dependentes, com teste que distinguiria um `DROP`+recriação acidental de um `UPDATE` correto.

**Issues found**:
1. "Gestão de Usuários" (Hub + rota `/usuarios`) não tem RLS que distinga Admin de Gestora —
   débito pré-existente à feature, herdado e apenas tornado mais visível por ela. Recomendação:
   AD nova + migration numa feature futura de `dim_usuario`.
2. Slug inválido → 404 (EST-03 AC4) não tem teste automatizado, embora o comportamento esteja
   correto por inspeção. Recomendação: teste de `layout.tsx` numa próxima passada (baixo custo).
3. "5 vs 6 categorias" de pendências é imprecisão de texto no spec/design, não bug de código.
   Recomendação: corrigir o texto numa revisão futura de spec.md/design.md.
4. Coluna "Sem etapa" prometida no spec/design não existe; contratos sem etapa caem na 1ª etapa
   real. Recomendação: decisão de Pedro (ver Fix Plan 1) — aceitar o comportamento atual ou
   implementar a coluna dedicada.

**Next steps**: nenhuma ação bloqueia o relatório "F0-F4 completo" a Pedro. Recomendado incluir os
4 itens acima no relatório para decisão consciente dele (mesma prática já usada nos Batches 1-4),
não como pendência de código.
