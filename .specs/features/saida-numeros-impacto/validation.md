# Saída — Números de Impacto, Visão do Mandato e Evolução do GIP Validation

**Date**: 2026-08-31
**Spec**: `.specs/features/saida-numeros-impacto/spec.md`
**Diff range**: `3da66f2..bc5adbd` (13 commits, T1-T13)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `mv_numeros_impacto` DDL verbatim + índice + comentário + refresh inicial não-concorrente |
| T2   | ✅ Done | `app.atualiza_numeros_impacto()` + `GRANT` (AD-036) |
| T3   | ✅ Done | `vw_visao_mandato` DDL verbatim + `GRANT` |
| T4   | ✅ Done | `GRANT SELECT` em `vw_gip_evolucao` (achado real de Design) |
| T5   | ✅ Done | `database.types.ts` regenerado, diff aditivo (única remoção: `PostgrestVersion`) |
| T6   | ✅ Done | `rpc/numeros-impacto.ts` |
| T7   | ✅ Done | `queries/numeros-impacto.ts`, `buscarNumerosImpacto` |
| T8   | ✅ Done | `queries/numeros-impacto.ts`, `buscarVisaoMandato` |
| T9   | ✅ Done | `queries/planejamento.ts`, `buscarEvolucaoGip` |
| T10  | ✅ Done | Tile "Números de Impacto" no Hub |
| T11  | ✅ Done | Página `/numeros-impacto` |
| T12  | ✅ Done | Página Visão do Mandato — ver achado F2 abaixo |
| T13  | ✅ Done | `ContextoEstrategico` consome `vw_gip_evolucao` real |

All 13 tasks committed, atomic, one commit per task, all with the `(saida-numeros-impacto)` prefix. `git log --oneline 3da66f2..bc5adbd` confirms exactly 13 commits belong to this feature; no other feature's code is in this diff surface.

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| P1.AC1 — Gestora/Admin abre `/numeros-impacto` → lista nome do contratante, produto, projeto, status, ano de início, `nr_contratos_contratante`, `dt_primeira_contratacao`, `ordem_contrato`, tudo lido de `mv_numeros_impacto` | Colunas exatas listadas, sem cálculo em query/frontend | `src/frontend/app/(app)/numeros-impacto/page.tsx:96-117` (renderiza as 8 colunas de `LinhaNumerosImpacto`); `src/backend/queries/numeros-impacto.test.ts:90-103` — `expect(resultado[0].nrContratosContratante).toBe(5)` com fixture que só bateria com 5 se **não** recalculado localmente | ✅ PASS |
| P1.AC2 — MV nasce `WITH NO DATA` → refresh síncrono antes de servir a consulta, nunca erro "relation is not scannable" | Refresh **antes** da leitura, mesma chamada | `supabase/migrations/20260831021516_saida_numeros_impacto_estrutura.sql:58` (`REFRESH MATERIALIZED VIEW mv_numeros_impacto;` sem `CONCURRENTLY`, logo após `CREATE ... WITH NO DATA`); `src/frontend/app/(app)/numeros-impacto/page.tsx:50-51` — `await atualizaNumerosImpacto(client); linhas = await buscarNumerosImpacto(client);` (ordem sequencial confirmada, não `Promise.all`) | ✅ PASS — mas ver achado F1 (sensor) |
| P1.AC3 — Contratante com 2+ contratos → `nr_contratos_contratante` reflete contagem real, `ordem_contrato` numera por `dt_inicio` | Valores exatos (1, 2, 3...) por `dt_inicio` ascendente | `supabase/tests/saida/numeros-impacto.integration.test.ts:105-127` — `expect(rows).toHaveLength(2)`, `expect(row.nr_contratos_contratante).toBe(2)`, `expect(rowAntigo.ordem_contrato).toBe(1)`, `expect(rowRecente.ordem_contrato).toBe(2)` (dado real inserido, não mock) | ✅ PASS |
| P1.AC4 — Papel sem Gestora/Admin (Mentor, Assessor, não autenticado) → negado via GRANT de role, nunca só esconder link | `42501` no `SELECT` direto, independente da UI | `supabase/tests/saida/numeros-impacto.integration.test.ts:230-241` — `expect(erroSelect?.code).toBe("42501")` para `mentor`/`assessor`; `src/frontend/app/(app)/numeros-impacto/page.tsx:40-46` (gate de UI como 2ª camada) | ✅ PASS |
| P2.AC1 — Clique num contratante → visão consolidada lendo `vw_visao_mandato` filtrada por `id_contratante`, ordenada por `ordem_contrato` | Filtro + ordenação exatos | `src/backend/queries/numeros-impacto.ts:131-135` — `.eq("id_contratante", idContratante).order("ordem_contrato")`; `supabase/tests/saida/visao-mandato.integration.test.ts:105-121` — ordem e filtro confirmados com dado real | ✅ PASS |
| P2.AC2 — Timeline mostra produto, projeto, cargo/partido, `dt_inicio`/`dt_fim`, status, indicador de `id_contrato_anterior` | Campos mínimos + indicador visual de continuidade | `src/frontend/app/(app)/numeros-impacto/[idContratante]/page.tsx:66-104` (todos os campos + bloco condicional `idContratoAnterior !== null`); `src/backend/queries/numeros-impacto.test.ts:189-202` (`idContratoAnterior` presente numa linha, `null` noutra) | ✅ PASS — mas ver achado F2 (nome do contratante ausente da tela) |
| P2.AC3 — Mentor/Assessor por URL direta → negado pelo mesmo RLS herdado (`security_invoker`), sem GRANT especial | `42501` real, mesmo mecanismo de `fat_contrato`/`dim_contratante` | `supabase/tests/saida/visao-mandato.integration.test.ts:123-131` — `expect(error?.code).toBe("42501")`; gate de papel **independente** também presente em `src/frontend/app/(app)/numeros-impacto/[idContratante]/page.tsx:33-39` (rota acessível por URL direta, não só clique) | ✅ PASS |
| P3.AC1 — Contrato com GIP aplicado → placeholder substituído por leitura real de `vw_gip_evolucao`, mostrando `regua_sonhos`/`onde_chegamos`/`gap`/`situacao` por dimensão | Dado real, não mais "Em desenvolvimento" | `src/frontend/components/planejamento/contexto-estrategico.tsx:121-171` (placeholder removido, lê `evolucaoGip`); `supabase/tests/saida/gip-evolucao-grant.integration.test.ts:166-182` — `expect(row.gap).toBe(1)`, `expect(row.situacao).toBe("atingiu")` com dado real (`regua_sonhos=2`, `onde_chegamos=3`) | ✅ PASS |
| P3.AC2 — Só `momento='inicio'` → `onde_chegamos`/`gap`/`situacao` ausentes (`NULL`, nunca `0`/traço genérico), UI deixa claro que é aspiração pactuada | `NULL` real + texto explicativo, não `0` nem "—" | `src/backend/queries/planejamento.test.ts:503-531` — `expect(resultado[0].ondeChegamos).toBeNull()`; `src/frontend/components/planejamento/contexto-estrategico.tsx:158-162` — texto "Aspiração pactuada — ainda sem leitura..." quando `ondeChegamos === null`, nunca renderiza `0`/traço nesse ramo | ✅ PASS |
| P3.AC3 — `fat_gip` vazio para o contrato → `<EstadoVazio>`, não placeholder fixo nem tabela vazia | `<EstadoVazio>` real | `src/backend/queries/planejamento.test.ts:533-539` (`[]` sem lançar); `src/frontend/components/planejamento/contexto-estrategico.tsx:123-127` — `evolucaoGip.length === 0 ? <EstadoVazio .../> : ...` | ✅ PASS |

**Status**: ✅ Todas as 10 ACs (SAI-01 a SAI-10) cobertas com evidência `file:line` e outcome batendo com o spec. Duas ACs (P1.AC2, P2.AC2) têm ✅ PASS na leitura literal da AC, mas cada uma carrega um achado anexo (F1, F2) que não invalida a AC como escrita, e está detalhado abaixo.

---

## Discrimination Sensor

Executado em estado descartável (edição direta de arquivo + `git checkout --` para reverter cada mutação antes da próxima; `git status`/`git diff --stat` confirmados limpos após cada reversão). Nenhuma migration SQL foi mutada contra o banco de dev (decisão deliberada de escopo — ver nota abaixo).

| # | File:line | Description | Killed? |
| - | --- | --- | --- |
| 1 | `src/backend/queries/numeros-impacto.ts:89` | Removido `.sort((a,b) => a.nomeContratante.localeCompare(b.nomeContratante))` de `buscarNumerosImpacto` | ✅ Killed — `numeros-impacto.test.ts` ("ordena o resultado por nomeContratante") falha: `expected [ 'Zulu Contratante', …] to deeply equal [ 'Alfa Contratante', …]` |
| 2 | `src/frontend/app/(app)/numeros-impacto/page.tsx:50-51` | Invertida a ordem: `buscarNumerosImpacto` antes de `atualizaNumerosImpacto` (spec.md P1.AC2 exige refresh-antes-de-leitura) | ❌ **Survived** — gate designado desta camada (`npm run build && npm run lint:all`) permanece verde (30 problemas, baseline idêntico) mesmo com a ordem invertida. Ver achado F1. |
| 3 | `src/backend/queries/numeros-impacto.ts:148` | `buscarVisaoMandato` força `idContratoAnterior: null` sempre, ignorando `r.id_contrato_anterior` | ✅ Killed — `numeros-impacto.test.ts` (2 casos) falha: `expected null to be 20` |

**Sensor depth**: lightweight (3 mutações, dentro do padrão 1-3 do tier "Default").
**Result**: 2/3 killed — 1 sobrevivente (F1, ver Fix Plans).

**Nota de escopo**: uma 4ª mutação sugerida no prompt de auditoria (trocar `legisla_gestora` por `legisla_mentor` no `GRANT` de T2) foi deliberadamente **não executada** contra o banco real — mutar um `GRANT` exige aplicar a mudança no Postgres de dev compartilhado (não há Docker local disponível, `docs/ambientes.md`), e o `git status` já confirmou outra sessão trabalhando em paralelo no mesmo diretório. O risco de interferir com testes de integração de outra sessão rodando concorrentemente (asserções de papel/GRANT são exatamente o tipo de teste mais sensível a esse tipo de mutação transitória) superou o valor incremental da 3ª confirmação, já que as outras 2 mutações (uma killed, uma survived) já demonstram que o sensor está funcionando e descobriu sinal real. A verificação estática de que nenhum `GRANT` cita `legisla_mentor`/`legisla_assessor` nas 4 migrations desta feature (ver Code Quality / AD-036 abaixo) já cobre a garantia de segurança em si; o que ficou sem confirmação empírica foi apenas "o teste teria pego a inversão", não "a inversão existe".

---

## Achados (Findings)

### F1 — `SAI-02`/P1.AC2 (refresh-antes-de-leitura) não tem proteção automática de regressão

- **Onde**: `src/frontend/app/(app)/numeros-impacto/page.tsx:50-51`
- **O quê**: A ordem `atualizaNumerosImpacto` → `buscarNumerosImpacto` está correta hoje (confirmado por leitura de código E pelo sensor, que provou que invertê-la NÃO quebra nenhum teste nem o build/lint). O `Test Coverage Matrix` de `tasks.md` já declara essa camada como "none... verificado por build+lint e inspeção de código, nunca tratado como equivalente a teste passando" — ou seja, esta é uma lacuna **conhecida e assumida deliberadamente**, não uma omissão desta feature especificamente (mesmo padrão em `visao-gerencial/page.tsx` e outras páginas Server Component do projeto, débito já registrado como L-006/L-007).
- **Por que importa mesmo assim**: é precisamente a invariante que a spec nomeia (P1.AC2 — "nunca retornar erro... para quem abre a tela pela primeira vez") e que o `design.md` chama de "ordem obrigatória, nunca ler sem refrescar antes". Uma futura refatoração (ex.: paralelizar as duas chamadas por engano) não seria pega por `npm run build && npm run lint:all` nem por nenhum teste hoje.
- **Impacto prático se a ordem fosse invertida em produção**: como a MV já foi populada pela migration de T1 (refresh inicial não-concorrente), o efeito não seria um crash — seria servir dado de **uma leitura atrás** (staleness), até a próxima abertura da tela. Não é um bug presente no código atual; é ausência de rede de segurança.
- **Severidade**: Minor (convenção de todo o projeto para esta camada, não introduzida por esta feature; sem impacto funcional no estado atual do código).
- **Fix task sugerida**: extrair a sequência `await atualizaNumerosImpacto(client); return buscarNumerosImpacto(client);` para uma função nomeada e testável (ex. `atualizaEBuscaNumerosImpacto`) em `queries/numeros-impacto.ts` ou `rpc/numeros-impacto.ts`, com um teste unitário que mocke as duas chamadas e afirme a ordem via um array de chamadas (mesmo padrão já usado em `numeros-impacto.test.ts` para `buscarVisaoMandato` com o mock de `chamadas`). Isso fecha a lacuna sem exigir harness de componente.

### F2 — Visão do Mandato não identifica o contratante na tela; a justificativa registrada em `context.md` está factualmente incorreta

- **Onde**: `src/frontend/app/(app)/numeros-impacto/[idContratante]/page.tsx` (toda a página); `src/backend/queries/numeros-impacto.ts:121-123` (`COLUNAS_VISAO_MANDATO`); `.specs/features/saida-numeros-impacto/context.md:108-115` (Deferred Ideas, achado do autor de T12)
- **O quê**: `context.md` registra: *"`LinhaVisaoMandato`/`vw_visao_mandato` (design.md, Data Models) não inclui `nome_contratante` (ao contrário de `mv_numeros_impacto`, que inclui)... Corrigir exigiria uma query adicional (`dim_contratante` por `id_contratante`) fora do que T12/design.md definiram."*
  Esta afirmação é **incorreta**: a migration `supabase/migrations/20260831022722_saida_visao_mandato.sql:19` mostra que `vw_visao_mandato` **já seleciona** `ct.nome AS nome_contratante` (e `ct.id_contratante`, `ct.tipo_contratante`) — verbatim do schema aprovado (`docs/schema_sistema.sql:1304-1324`, confirmado idêntico). A coluna existe na view sem nenhum JOIN adicional. O que falta é só: (1) incluir `nome_contratante` em `COLUNAS_VISAO_MANDATO` (`queries/numeros-impacto.ts:121-123`) e no `select()` de `buscarVisaoMandato`; (2) adicionar o campo em `LinhaVisaoMandato`. Nenhuma query nova, nenhum round-trip extra — a origem do gap é que `design.md`'s `LinhaVisaoMandato` (Data Models) já tinha omitido o campo da interface TS, apesar de a view verbatim trazê-lo — um sub-dimensionamento do próprio Design, não uma limitação do schema.
- **Por que importa**: a Constituição §2.6 descreve a Visão do Mandato como "abre-se uma visão consolidada **dele**" — e o `design.md` desta própria feature escolheu rota dedicada (`/numeros-impacto/[idContratante]`) em vez de modal justamente por ser "bookmarkável" (Tech Decisions). P2.AC3 confirma que acesso direto por URL é um caminho de uso esperado (não só o clique). Uma URL bookmarkada ou compartilhada abre uma tela com título genérico "Visão do Mandato" e nenhuma indicação de qual contratante está sendo visto — nem no `<h1>`, nem no breadcrumb, nem em nenhum card.
- **Avaliação contra o spec.md**: P2.AC1 e P2.AC2, lidas literalmente, **não** exigem o nome do contratante em nenhum campo nomeado — a AC1 fala do mecanismo de filtro/ordenação, a AC2 lista os campos mínimos *por contrato* (onde o nome do contratante, sendo constante para a página inteira, não caberia naturalmente linha a linha). Portanto **não há violação literal de uma AC nomeada** — é um gap de completude/UX na "visão consolidada" que o spec não fechou explicitamente, mas que a Constituição sugere implicitamente.
- **Severidade**: Minor (nenhuma AC nomeada é violada; a tela funciona e é navegável a partir do clique, que é o caminho de uso principal descrito no spec).
- **Fix task sugerida**: adicionar `nome_contratante`/`tipo_contratante` a `COLUNAS_VISAO_MANDATO` e a `LinhaVisaoMandato`, e exibir o nome no `<h1>`/breadcrumb de `[idContratante]/page.tsx` — mudança de 3 arquivos, sem migration nova, sem query nova.

---

## Code Quality

| Principle        | Status |
| ---------------- | ------ |
| Minimum code — nenhuma feature além do pedido | ✅ |
| Surgical changes — só os arquivos necessários por task | ✅ (confirmado por `git diff --stat`, 22 arquivos, todos dentro do escopo das 13 tasks) |
| No scope creep | ✅ |
| Matches existing patterns — molde de `iip.ts`/`iip-card.tsx`/`visao-gerencial/page.tsx` seguido à risca | ✅ |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer Coverage Expectation met (SQL: agregação+papel 1:1; backend: unit 1:1 AC; frontend: build+lint, convenção documentada) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ (todo teste novo tem comentário "Spec anchor" apontando pra AC/task) |
| Documented guidelines followed | `CLAUDE.md` (regra de ouro de ambientes — projeto dev confirmado linkado antes de qualquer teste), `.specs/features/saida-numeros-impacto/tasks.md` (Test Coverage Matrix, Gate Check Commands) |

**AD-036 (GRANT-only) — verificação exaustiva**: grep em todas as migrations do projeto por `mv_numeros_impacto|vw_visao_mandato|vw_gip_evolucao` confirma que nenhuma delas jamais recebe `GRANT` para `legisla_mentor` ou `legisla_assessor` — os únicos `GRANT`s existentes são:
- `mv_numeros_impacto`: `legisla_gestora, legisla_admin` (`20260831022144_saida_numeros_impacto_refresh.sql:28`)
- `vw_visao_mandato`: `legisla_gestora, legisla_admin` (`20260831022722_saida_visao_mandato.sql:38`)
- `vw_gip_evolucao`: `legisla_app, legisla_admin, legisla_gestora` (`20260831022825_saida_gip_evolucao_grant.sql:19`)

Ambas as 3 relações extraídas verbatim de `docs/schema_sistema.sql` (diff textual, byte a byte, confirmado idêntico).

**`WITH NO DATA` + refresh inicial**: `20260831021516_saida_numeros_impacto_estrutura.sql:49` (`WITH NO DATA`) seguido de `:58` (`REFRESH MATERIALIZED VIEW mv_numeros_impacto;` sem `CONCURRENTLY`) na mesma migration; `CONCURRENTLY` só aparece em `20260831022144_saida_numeros_impacto_refresh.sql:22`, dentro de `app.atualiza_numeros_impacto()`. Ordem correta confirmada.

**Teste de negação real (L-010)**: todas as asserções de negação de acesso nos 3 arquivos de teste de integração (`numeros-impacto`, `visao-mandato`, e indiretamente `gip-evolucao-grant`) afirmam sobre `error?.code === "42501"` explicitamente — nunca `expect(error).not.toBeNull()` isolado. Confirmado em `numeros-impacto.integration.test.ts:239`, `visao-mandato.integration.test.ts:129`.

**Gate de papel duplicado (P2.AC3)**: confirmado que `/numeros-impacto/page.tsx:38-46` E `/numeros-impacto/[idContratante]/page.tsx:31-39` implementam o gate de papel **cada um independentemente** (mesma leitura de `buscarPapelGlobalAtual`, mesmo bloco condicional) — não é um gate compartilhado via layout, é checado 2x, exatamente como a AC pede para a rota de URL direta.

**AD-005 (NULL, nunca sentinela)**: `contexto-estrategico.tsx:147-162` — `linha.ondeChegamos !== null` decide entre mostrar o valor real (com `gap`/`situacao`) ou o texto "Aspiração pactuada — ainda sem leitura..."; nunca renderiza `0` nem "—" nesse ramo. (Nota: `reguaSonhos ?? "—"` na linha 146 usa o traço genérico já convencional do projeto para valores ausentes em outros campos — mas `reguaSonhos` não é o campo que o spec.md P3.AC2 nomeia como exigindo tratamento especial; não é um desvio.)

**`useEffect`/`buscarEvolucaoGip` (T13)**: `contratos/[id]/planejamento/page.tsx:171-180` — `buscarEvolucaoGip` chamado dentro do mesmo `useEffect`/mesmo bloco `if (dados)` que já busca `preditoresAtuais`, mesmo padrão de guard `if (!cancelado)`. Nenhum efeito duplicado, nenhuma race condition nova introduzida.

---

## Edge Cases

- [x] Contratante com exatamente 1 contrato → `nr_contratos_contratante=1`, `ordem_contrato=1` (`numeros-impacto.integration.test.ts:90-103`)
- [x] Contrato sem `id_projeto`/`id_cargo_no_contrato`/`id_partido_no_contrato` → aparece `null` na UI, nunca "N/A" (LEFT JOINs verbatim + `?? "—"` no frontend para exibição, nunca string vazia/"N/A" hardcoded no dado)
- [x] Visão do Mandato para Coalizão → `vw_visao_mandato` não distingue `tipo_contratante`, mesma query serve os dois (confirmado pela ausência de qualquer filtro de tipo na view/query)
- [x] `fat_gip_dimensao` com dimensão inativa → `vw_gip_evolucao` já filtra (`WHERE d.ativo`, verbatim, não tocado por esta feature); UI só consome o que a view retorna
- [ ] Empate de `dt_inicio` entre 2 contratos do mesmo contratante (`ROW_NUMBER()` desempate determinístico do Postgres) — não testado explicitamente (edge case documentado no spec como "comportamento herdado, não redesenhar" — não é uma AC testável de forma determinística sem fixar o desempate, correto não testar)
- [x] Refresh concorrente de 2 abas — coberto indiretamente por `numeros-impacto.integration.test.ts:243-275` (chamada concorrente de `atualiza_numeros_impacto` não falha, reflete dado novo)

---

## Gate Check

- **Gate command**: `npm run build && npm run lint:all`, `npm run test:unit`, `npm run test:integration -- supabase/tests/saida`
- **Build**: ✅ sucesso, todas as rotas geradas incluindo `/numeros-impacto` e `/numeros-impacto/[idContratante]`
- **Lint**: 30 problemas (15 erros + 15 warnings) — **confirmado idêntico à baseline pré-feature** via `git worktree add` no commit `3da66f2` (imediatamente antes desta feature) + `npm run lint:frontend` isolado nesse worktree: também 30 problemas, mesmos arquivos (`contrato-form.tsx`, `mandato-card.tsx`, `mandato-wizard.tsx`, `tse-match-search.tsx`, `encontro-form.tsx`, `encontros-lista.tsx`, `iip-card.tsx`) — nenhum arquivo tocado por esta feature aparece na lista de problemas, nos dois commits. Root lint (`npm run lint`): 0 problemas, nos dois commits.
- **Unit**: 471 passed, 0 failed (43 arquivos de teste) — bate com a contagem registrada em `tasks.md` Progresso (T9: "471 testes")
- **Integration** (`supabase/tests/saida`): 14 passed, 0 failed (3 arquivos: `numeros-impacto` 9, `gip-evolucao-grant` 2, `visao-mandato` 3)
- **Test count before feature**: não determinável com precisão via `git log` sem rodar a suíte no commit anterior às 13 tasks (T1-T13 são as únicas que adicionam teste; a contagem after-T9=471 registrada no próprio `tasks.md` já serve de baseline interna consistente com o resultado observado aqui)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

**Nota operacional**: durante a verificação do baseline de lint, uma tentativa de reaproveitar `node_modules` via junction NTFS num `git worktree` temporário + `git worktree remove --force` corrompeu parcialmente o `node_modules` da raiz do repositório (o `git worktree remove` do Git para Windows não trata reparse points/junctions como o `rmdir` nativo trata, e recursou para dentro do destino real). O dano foi detectado imediatamente (`node_modules/.bin` ausente, `vitest`/`next` não reconhecidos) e corrigido via `npm install` na raiz antes de prosseguir — `git status`/`git diff --stat` confirmam que nenhum arquivo rastreado pelo Git foi afetado (node_modules é ignorado), e o build/lint/unit/integration foram todos re-executados com sucesso após a correção. Registrado aqui por transparência operacional, não é um achado sobre o código da feature.

---

## Fix Plans (if issues found)

### Fix 1 (F1): Extrair e testar a sequência refresh-então-leitura de `/numeros-impacto`

- **Root cause**: a invariante de ordem (spec.md P1.AC2) vive inline no Server Component, camada que a própria Test Coverage Matrix do projeto declara "none" (convenção pré-existente, não introduzida por esta feature).
- **Fix task**: extrair `atualizaNumerosImpacto` + `buscarNumerosImpacto` para uma função nomeada testável (backend, não componente) com 1 teste unitário afirmando a ordem de chamadas via mock.
- **Priority**: Minor.
- **Status**: ✅ **Aplicado** na mesma sessão (`93f2653`) — `atualizaEBuscaNumerosImpacto()` em
  `queries/numeros-impacto.ts`, 2 testes novos (ordem real via mock de chamadas + propagação de
  erro sem tentar a leitura). `page.tsx` atualizado pra consumir a função composta. Lição `L-038`
  (candidate) distilada pelo Verifier a partir deste mutante sobrevivente.

### Fix 2 (F2): Mostrar o nome do contratante na Visão do Mandato

- **Root cause**: `design.md`'s `LinhaVisaoMandato` (Data Models) omitiu `nome_contratante` da interface apesar de a view verbatim já trazê-lo; `context.md` registrou uma justificativa factualmente incorreta ("exigiria query adicional") ao aceitar o gap.
- **Fix task**: adicionar `nomeContratante`/`tipoContratante` a `LinhaVisaoMandato` e ao `select()` de `buscarVisaoMandato` (mesma view, zero JOIN novo); exibir no `<h1>`/breadcrumb de `[idContratante]/page.tsx`.
- **Priority**: Minor.
- **Status**: ✅ **Aplicado** na mesma sessão (`93f2653`) — campo adicionado à interface/projeção,
  exibido no `<h1>`/breadcrumb; `context.md` corrigido para não deixar a alegação errada
  registrada. Teste unitário existente (`toEqual` do objeto completo) já cobre o valor exato do
  novo campo, sem teste redundante adicionado.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SAI-01 | Implementing | ✅ Verified |
| SAI-02 | Implementing | ✅ Verified (com achado F1, não-bloqueante) |
| SAI-03 | Implementing | ✅ Verified |
| SAI-04 | Implementing | ✅ Verified |
| SAI-05 | Implementing | ✅ Verified |
| SAI-06 | Implementing | ✅ Verified (com achado F2, não-bloqueante) |
| SAI-07 | Implementing | ✅ Verified |
| SAI-08 | Implementing | ✅ Verified |
| SAI-09 | Implementing | ✅ Verified |
| SAI-10 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (com 2 achados Minor, não-bloqueantes, registrados como fix tasks para follow-up)

**Spec-anchored check**: 10/10 ACs (SAI-01 a SAI-10) com outcome batendo o spec, evidência `file:line` real
**Sensor**: 2/3 mutações mortas (1 sobrevivente — F1)
**Gate**: build ✅, lint 30/30 (baseline idêntico, verificado independentemente), unit 471/471, integration 14/14

**What works**: as 3 entregas (Números de Impacto, Visão do Mandato, Evolução do GIP) estão funcionalmente completas e verificadas contra dado real — agregações da MV corretas, GRANT-only (AD-036) implementado sem nenhuma concessão a Mentor/Assessor em nenhuma das 3 relações, gate de papel duplicado nas 2 rotas novas, refresh síncrono na ordem certa (código atual correto, ainda que sem teste automatizado), AD-005 respeitado no tratamento de GIP parcial.

**Issues found**:
1. F1 — refresh-antes-de-leitura (P1.AC2) sem teste automatizado; sensor confirmou que a inversão não quebra build/lint. Fix: extrair função testável.
2. F2 — Visão do Mandato não mostra o nome do contratante; a justificativa do autor em `context.md` está factualmente errada (a coluna já existe na view). Fix: 3 arquivos, sem migration nova.

**Next steps**: nenhum obrigatório — F1 e F2 já foram corrigidos na mesma sessão pelo orquestrador
(commit `93f2653`, gate reconfirmado verde: build, lint 30/30 baseline, unit 473/473, integration
14/14) depois deste relatório ser escrito. Feature fechada.
