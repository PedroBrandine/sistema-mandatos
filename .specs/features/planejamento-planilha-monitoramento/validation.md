# Planejamento do Contrato / Planilha de Monitoramento Validation

**Date**: 2026-08-12
**Spec**: `.specs/features/planejamento-planilha-monitoramento/spec.md`
**Diff range**: `06072bd..f0e8016` (23 commits, prefixo `(planejamento-planilha-monitoramento)`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Verdict (rodada 1)**: ❌ **FAIL** — 1 Major, 2 Minor (ver Re-verificação — Rodada 2 abaixo para o desfecho)

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| docs: confirmação de Pedro (`06072bd`) | ✅ Done | - |
| docs: design.md (`f72a6c1`) | ✅ Done | - |
| docs: tasks.md (`96eab85`) | ✅ Done | - |
| T1 — DDL 4 tabelas + view (`d3c78a5`) | ✅ Done | Verbatim confirmado contra `docs/schema_sistema.sql:877-980`/`:1196-1200` |
| T2 — RLS `p_heranca` (`84b5643`) | ✅ Done | `USING`+`WITH CHECK` explícitos nas 4 tabelas, confirmado via `pg_policies` no teste de integração |
| T3 — Grants (`f26b626`) | ✅ Done | Assessor `SELECT,UPDATE` tabela inteira; Mentor `SELECT,INSERT,UPDATE`; sequence fix confirmado |
| T4 — Cascata verbatim (`3e1047a`) | ✅ Done | Fórmulas conferidas linha a linha (ver Spec-Anchored ACs) |
| T5 — Auditoria (`48a9d65`) | ✅ Done | - |
| T6 — RPC lote (`b71069b`) | ✅ Done | `UPDATE` único via `jsonb_to_recordset`, `SECURITY INVOKER` |
| T7 — `db:types` (`711db21`) | ✅ Done | `npm run build` compila |
| T8 — Zod schemas (`72a43a3`) | ✅ Done | 32 testes unitários |
| T9 — Queries (`23881a7`) | ✅ Done | 6 testes unitários |
| docs: SPEC_DEVIATION T10 (`04b3539`) | ✅ Done | - |
| T10 — RPC wrappers (`a4aed5f`) | ✅ Done | 5 testes unitários |
| **T4 fix — SECURITY DEFINER/AD-035** (`75939af`) | ✅ Done | Achado real ao rodar T11; confirmado corrigido e testado (ver Discrimination Sensor / achado de segurança) |
| T11 — Integração RLS (`cc6682c`) | ✅ Done | 8/8 testes passam |
| T12 — Integração cascata (`8ddd4f1`) | ✅ Done | 5/5 testes passam |
| T13 — Integração lote (`d85f9ef`) | ✅ Done | 3/3 testes passam |
| fix: ordenação da grade (`5cb70d1`) | ✅ Done | - |
| T14 — `GradeSucessosMensais` (`5f31694`) | ✅ Done | Compila; ver PLM-02 no Fix Plan |
| T15 — `HierarquiaPlanejamento`+forms (`c775eb3`) | ✅ Done | SPEC_DEVIATION documentada (inline em vez de `<Dialog>`; dialog "editar detalhes" cortado) |
| T16 — `PlanejamentoAgregadoCoalizao` (`930ba4b`) | ✅ Done | - |
| T17 — Wiring da página (`f0e8016`) | ✅ Done | Recálculo 1x por planejamento via `useRef` guard, confirmado por leitura de código |

**23/23 commits confirmados** via `git log --oneline --grep="(planejamento-planilha-monitoramento)" --all` — bate exatamente com os 17 tasks + T4 fix + 3 commits de docs (Specify/Design/Tasks) + 1 fix de ordenação = 23. Árvore de trabalho limpa quanto a esta feature (`git status --short` só mostra `.specs/features/visao-gerencial-g1-g2/`, de outra sessão paralela, não tocado).

---

## Spec-Anchored Acceptance Criteria

### P1: Grade editável de Sucessos Mensais (PLM-01 a PLM-04)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| PLM-01: grade lista Sucessos do mês corrente, agrupados por Meta, com pct/status/dias_atraso de `vw_sucesso_mensal` | Campos vêm da view, nunca digitados | `src/backend/queries/planejamento.test.ts:180-222` — `expect(resultado).toEqual([{..., diasAtraso: 0, estaAtrasado: false, status: "realizado"}])`, mapeando de `vw_sucesso_mensal` (nunca de uma tabela editável) | ✅ PASS (camada de dados). Agrupamento visual por Meta é só frontend (sem teste, "none — build gate only" na Matrix) — código confirma (`grade-sucessos-mensais.tsx:202-218`, `linhasPorMeta`) |
| PLM-02: editar 1 célula e sair (tab/blur) salva **sem recarregar a grade inteira** | 1 `UPDATE` escopado, sem refetch full-grid | `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx:140-151` (`handleEdicaoCelula`: `UPDATE ... .eq("id_sucesso", idSucesso)`, escopado ✅) **mas** linha 150 chama `recarregarGrade()` (`:111-116`), que refaz `buscarGradeSucessosMensais` sobre **todas** as Metas do planejamento (`idsMetaDoPlanejamento(planejamento)`), não só a linha editada | ❌ **GAP** — ver Fix Plan #1 |
| PLM-03: colar faixa distribui valores respeitando ordem visual | 1 chamada atômica, sem escrita parcial | `supabase/tests/planejamento/planejamento-lote.integration.test.ts:151-170` (atomicidade, 1 valor inválido não salva nenhuma linha) + `src/backend/rpc/planejamento.test.ts:46-63` (payload serializado certo) + `grade-sucessos-mensais.tsx:242-278` (`handlePasteInicio`, usa `ordemVisual` computada por Meta) | ✅ PASS — SPEC_DEVIATION de interpretação de "seleção de faixa" já autodocumentada em `grade-sucessos-mensais.tsx:29-35`, consistente com o que o spec deixa em aberto |
| PLM-04: valor fora de 0-100 rejeitado inline, nunca salva | Erro antes do round-trip | `src/backend/schemas/planejamento.test.ts:270-292` (espelho `ck_sucesso_pct`) + `grade-sucessos-mensais.tsx:60-65,229-240` (`validaPct`/`handleCommitCelula`: retorna antes de chamar `onEdicaoCelula` quando inválido) | ✅ PASS (camada de schema testada; camada de UI sem teste automatizado, consistente com a Matrix) |

### P1: Assessor escreve Sucesso Mensal por completo (PLM-05/PLM-06)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| PLM-05: Assessor `UPDATE` em toda coluna de `fat_sucesso_mensal` do contrato vinculado | Sucesso, todas as 6 colunas | `supabase/tests/planejamento/planejamento-rls.integration.test.ts:202-222` — `update({pct_atingimento, status, peso, descricao, mes_referencia, dt_limite})`, `expect(error).toBeNull()`, valores confirmados por `SELECT` direto | ✅ PASS |
| PLM-06.1/.2: Assessor rejeitado em `fat_meta`/`fat_objetivo_especifico`/`dim_planejamento` | `42501` | `planejamento-rls.integration.test.ts:224-241` — `expect(e1?.code).toBe("42501")` (×3, uma por tabela) | ✅ PASS |
| PLM-06.3: Assessor rejeitado em `fat_sucesso_mensal` de contrato **não vinculado** | `UPDATE`/`INSERT`/`DELETE` rejeitados | `planejamento-rls.integration.test.ts:249-258` — só `UPDATE` testado (`expect(error).toBeNull()` + `expect(row.pct_atingimento).toBeNull()`, RLS silenciosa corretamente distinguida de rejeição por GRANT) | ⚠️ **Parcial** — `INSERT`/`DELETE` no contrato não vinculado não têm teste citável (evidence-or-zero); risco baixo pois o GRANT do Assessor em `fat_sucesso_mensal` já é só `SELECT, UPDATE` (`20260812145817_planejamento_planilha_grants.sql`), então `INSERT`/`DELETE` falhariam por `42501` de GRANT mesmo estando vinculado — mas isso não está empiricamente comprovado por teste. Ver Fix Plan #2 |

**Achado positivo digno de nota**: o teste distingue corretamente as duas semânticas de rejeição do Postgres — `42501` explícito quando é `GRANT` que barra (linhas 224-241) vs. rejeição silenciosa (`error: null`, 0 linhas afetadas) quando é `RLS USING` que barra (linhas 249-258) — exatamente o comportamento real do Postgres, não um comportamento inventado. O comentário inline no teste (`:243-248`) documenta isso corretamente como SPEC_DEVIATION do entendimento inicial.

### P1: Cascata de atingimento (PLM-07/PLM-08/PLM-09)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| PLM-07: editar Sucesso Mensal marca `atingimento_desatualizado=true`, sem recalcular na mesma transação | Flag `true`, `pct_atingimento` continua `NULL`/antigo | `supabase/tests/planejamento/planejamento-cascata.integration.test.ts:131-136` — `expect(row.atingimento_desatualizado).toBe(true); expect(row.pct_atingimento).toBeNull()` (logo após os INSERTs da fixture, antes de qualquer recálculo) + `:171-182` (`UPDATE` também marca) | ✅ PASS |
| PLM-08: fórmula Meta=ponderada, Objetivo/Planejamento=simples, nessa ordem | Valores exatos | SQL: `supabase/migrations/20260812145917_planejamento_planilha_cascata.sql:24-25` `ROUND(SUM(sm.peso*COALESCE(sm.pct_atingimento,0))/SUM(sm.peso),2)` (Meta); `:37` `ROUND(AVG(COALESCE(mm.pct_atingimento,0)),2)` (Objetivo); `:47-49` idem (Planejamento). Teste: `planejamento-cascata.integration.test.ts:150-165` — `expect(pctPorMeta.get(f.idMetaA)).toBe(50)` (25×80+75×40)/100=50 exato, não "not null"; `expect(Number(planejamento.pct_atingimento)).toBe(60)` (AVG(50,70)) | ✅ PASS — valores exatos, não vagos |
| PLM-09: Meta `pausada`/`descartada` excluída da média do Objetivo | Objetivo exclui a Meta não-ativa | SQL: `:40-41` `WHERE oo.id_planejamento=... AND mm.status='ativa'`. Teste: `planejamento-cascata.integration.test.ts:160-161` (`pctPorObjetivo.get(f.idObjetivo1)` = 50, só Meta A, Meta B pausada=90 fica fora) **e prova bidirecional** em `:203-218` (reativar a Meta pausada muda o resultado de 50→95) — prova ativa de exclusão, não apenas "bate por coincidência" | ✅ PASS para `'pausada'`. **`'descartada'` nunca é exercitado** (mesmo predicado `status='ativa'` cobre os dois, risco baixo, mas evidence-or-zero não permite declarar coberto) — ver Fix Plan #3 |

### P2: Gestão da hierarquia (PLM-10/PLM-11) — sem teste automatizado esperado

| Criterion | Result |
| --- | --- |
| PLM-10: criar Objetivo exige descrição, preditores opcionais | Sem teste automatizado — consistente com a Test Coverage Matrix (`tasks.md`: "componentes/formulários... none — build gate only"). Código confirma: `objetivo-form.tsx:39-43` usa `objetivoEspecificoSchema` (`descricao: z.string().trim().min(1,...)` obrigatório, resto opcional) |
| PLM-11: PLL não oferece preditor secundário no form de Meta | Sem teste automatizado. Código confirma: `meta-form.tsx:40,176` (`usaPreditorSecundario = produtoNome !== "PLL"`, campo condicional) |
| PLM-10/11: preditor secundário = primário rejeitado | Testado na camada Zod (não RPC, é INSERT direto, SPEC_DEVIATION documentada em T10): `schemas/planejamento.test.ts:35-43,168-177` — `expect(resultado.success).toBe(false)` | ✅ PASS (camada de validação) |

**Confirmação**: P2 e os componentes de frontend realmente não têm teste automatizado, e isso bate com a Test Coverage Matrix de `tasks.md` (linha final da tabela, "none — build gate only") — não é um gap desta feature, é débito de projeto já documentado e consistente em `convite-contrato`/`operacao-regua-instanciacao`.

---

## Discrimination Sensor

**Escopo desta rodada**: as 3 mutações abaixo foram aplicadas na camada TypeScript/Zod (arquivo copiado para `.bak`, mutado, testado, restaurado — nunca `git stash`). **Decisão de escopo, registrada aqui em vez de mutar SQL ao vivo**: as duas mutações sugeridas na camada SQL (fórmula de `app.recalcula_atingimento` e atomicidade de `app.atualiza_sucessos_mensais_lote`) não foram injetadas na função real porque (a) o Supabase de dev é compartilhado e está sendo usado concorrentemente agora mesmo por outras sessões neste mesmo branch (confirmado: o orquestrador rodou a suíte de integração completa do repositório em paralelo a esta validação); mutar uma função ao vivo, mesmo brevemente, arrisca corromper testes de integração concorrentes de outras sessões; e (b) o rastreamento de migrations deste projeto é por nome de arquivo já aplicado — editar o conteúdo de uma migration já empurrada e rodar `supabase db push` de novo não teria efeito nenhum sobre a função já aplicada (a CLI pula migrations já registradas), então a técnica "copiar arquivo, mutar, rodar teste, restaurar" descrita no protocolo não é tecnicamente viável para SQL já aplicado sem SQL cru fora do fluxo de migration. Como evidência compensatória: (i) a fórmula foi lida linha a linha contra o texto aprovado (ver PLM-08 acima, com `file:line` dos dois lados) e (ii) os testes de integração já existentes usam valores exatos e não-vazios (pesos 25/75/100 deliberadamente desiguais — ver PLM-08/09), o que por inspeção discriminaria uma média simples no lugar da ponderada e uma segunda escrita não-atômica; isso não substitui fault-injection real, então fica marcado como inferência, não como "killed" empírico.

| # | File:line | Mutação | Rodado contra | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/backend/schemas/planejamento.ts:80` | `ck_sucesso_mes`: `Number(valor.mes_referencia.slice(8,10)) === 1` → `!== 1` (inverte o refine) | `src/backend/schemas/planejamento.test.ts` | ✅ Killed — 4 testes falharam (`aceita mes_referencia no primeiro dia`, `rejeita ... não é o primeiro dia`, `aceita pct_atingimento nulo`, e 1 outro que dependia do mesmo caminho válido) |
| 2 | `src/backend/schemas/planejamento.ts:59` | `ck_meta_preditores` em `metaSchema`: `id_preditor_secundario !== id_preditor_primario` → `=== id_preditor_primario` (inverte a condição de exclusão mútua) | `src/backend/schemas/planejamento.test.ts` | ✅ Killed — 1 teste falhou (`metaSchema > rejeita id_preditor_secundario igual a id_preditor_primario`), localizado exatamente no schema mutado (o teste equivalente de `objetivoEspecificoSchema`, não tocado, continuou passando — confirma que a mutação foi isolada corretamente) |
| 3 | `src/backend/rpc/planejamento.ts:25-33` | `atualizarSucessosEmLote`: 1 chamada RPC com array batelado → `for` chamando a RPC 1x por item (quebra o contrato "1 chamada atômica") | `src/backend/rpc/planejamento.test.ts` | ✅ Killed — 1 teste falhou (`chama atualiza_sucessos_mensais_lote com o array serializado em snake_case`), `chamadas[0].params.p_valores` continha só 1 item em vez dos 2 esperados |

Todos os 3 arquivos mutados foram restaurados a partir do `.bak` e confirmados limpos via `git diff --stat` (sem saída) antes de prosseguir.

**Sensor depth**: lightweight (não P0) — 3/3 mutações mataram os testes correspondentes na camada onde foram aplicadas; 2 mutações adicionais sugeridas na camada SQL não foram empiricamente executadas (justificativa acima), compensadas por leitura de código com citação exata dos dois lados.
**Result**: 3/3 killed (camada testada) — ✅ PASS para o que foi empiricamente exercitado; SQL fica como inferência documentada, não como "killed" formal.

---

## Achado de segurança (SECURITY DEFINER / AD-035) — confirmado, não apenas documentado

Conferido de forma independente, não só aceito do `design.md`:

- **Causa raiz real**: `app.recalcula_atingimento` + os 5 `trg_marca_*` foram extraídas `SECURITY INVOKER` (verbatim) em T4, mas escrevem em `dim_planejamento`/`fat_meta`/`fat_objetivo_especifico` — tabelas onde Mentor/Assessor só têm `GRANT SELECT`. Qualquer escrita deles em `fat_sucesso_mensal` (permitida) disparava o trigger por baixo, que falhava com `42501` tentando marcar `dim_planejamento`, quebrando a própria escrita que deveria funcionar.
- **Fix real, não só documentado**: `supabase/migrations/20260812151909_planejamento_planilha_cascata_security_definer_fix.sql:38-43` — `ALTER FUNCTION ... SECURITY DEFINER SET search_path = public, pg_temp` nas 6 funções corretas (`recalcula_atingimento` + 5 `trg_marca_*`), com `search_path` explícito (mitigação padrão contra search_path hijacking em `SECURITY DEFINER`).
- **Escopo do fix está correto**: `app.recalcula_pendentes` **não** foi alterada (continua `SECURITY INVOKER`, correto — só chama `recalcula_atingimento` via `PERFORM`, que já roda como `DEFINER` independente de quem chamou) e `app.atualiza_sucessos_mensais_lote` (T6) **não** foi alterada (continua `SECURITY INVOKER`, correto — o chamador controla o valor escrito ali).
- **Prova de que o fix funciona de verdade, não só existe**: `planejamento-rls.integration.test.ts:202-222` (Assessor grava `fat_sucesso_mensal`, `expect(error).toBeNull()`) e `:260-269` (Mentor faz `INSERT` em `fat_sucesso_mensal`, `expect(error).toBeNull()`) — ambos disparam os triggers `SECURITY DEFINER` como efeito colateral obrigatório de qualquer escrita na tabela, e ambos passam. Sem o fix, esses dois testes falhariam com `42501` vindo de dentro do trigger, não do `UPDATE`/`INSERT` em si.

**Veredito**: achado real, corrigido de fato, e testado de fato (não é uma correção não verificada). Candidato forte a lição reutilizável — ver seção de Lições abaixo.

---

## Code Quality

| Principle | Status |
| --- | --- |
| No features beyond what was asked | ✅ |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — confirmado contra a lista de escopo exata fornecida |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ — `queries/planejamento.ts` segue `etapa-contrato.ts`; `rpc/planejamento.ts` segue `convite.ts`/`kanban.ts`; `schemas/planejamento.ts` segue `contrato.ts`; formulários inline seguem `contrato-form.tsx` |
| Would senior engineer approve? | ⚠️ Sim, com a ressalva do Fix Plan #1 (refetch desnecessário) |
| Tests map to acceptance criteria and are non-shallow (spot-check: cascata) | ✅ — valores exatos (50/70/60/95), não `toBeTruthy()`/`not.toBeNull()` genérico |
| Spec-anchored outcome check (asserted values match spec) | ✅ — ver tabela acima |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ⚠️ — PLM-06.3 (INSERT/DELETE em contrato não vinculado) e PLM-09 (`'descartada'`) parcialmente descobertos, ver Fix Plans #2/#3 |
| Every test maps to a spec requirement — no unclaimed tests | ✅ |
| Documented guidelines followed | Test Coverage Matrix + Gate Check Commands de `tasks.md` (usados como estão, não reinventados) |

**Achado de code quality adicional (não bloqueante)**: `sucessoMensalSchema` (`schemas/planejamento.ts:68-83`) não tem nenhum consumidor em `src/frontend` — nenhum componente desta feature cria uma linha nova de `fat_sucesso_mensal` (a grade só edita `pct_atingimento` de linhas existentes; o dialog "editar detalhes" foi cortado do escopo, Deferred Idea em `context.md`). Isso não é um bug — é consistente com o SPEC_DEVIATION documentado — mas deixa o Edge Case 3 (seletor de mês obrigatório na UI) sem nenhuma superfície de UI pra checar. Ver observação no Edge Cases abaixo.

---

## Edge Cases

- [x] Soma de `peso` ≠ 100 → alerta visual, sem bloqueio: `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx:123-133` (`idsMetaComPesoDivergente`) → `hierarquia-planejamento.tsx:68-72` (`Badge variant="destructive"`), sem gate sobre `handleEdicaoCelula`. Sem teste automatizado (frontend, consistente com a Matrix).
- [x] Coalizão sem planejamento próprio → leitura agregada, nunca formulário de criação: `planejamento-agregado-coalizao.tsx:112,118` sempre passa `somenteLeitura` para `HierarquiaPlanejamento`/`GradeSucessosMensais`; `hierarquia-planejamento.tsx:48` (`podeEditarEstrutura = !somenteLeitura && ...`) bloqueia os botões "+ Objetivo"/"+ Meta". Sem teste automatizado.
- [~] `mes_referencia` não-dia-1 rejeitado, UI sempre com seletor de mês: DB CHECK confirmado (migration T1) + espelho Zod testado (`schemas/planejamento.test.ts:224-233`) — **mas nenhum componente desta feature cria uma linha nova de `fat_sucesso_mensal`** (ver achado de code quality acima), então a cláusula "a UI SHALL sempre oferecer seletor de mês" não tem nenhuma superfície pra violar ou cumprir dentro do escopo entregue. Não é uma violação (nada expõe campo de data livre), mas é diferente de "coberto" — marcado como parcial/N/A, não PASS pleno.
- [x] Dois usuários editando Sucessos diferentes da mesma Meta → cada edição salva independente, sem lock de Meta: `page.tsx:140-151` — cada `UPDATE` é escopado por `.eq("id_sucesso", idSucesso)`, nenhum mecanismo de lock de Meta existe no código. PASS por ausência de contra-evidência (não há teste dedicado, mas a arquitetura não introduz nenhum lock que pudesse violar isso).

---

## Gate Check

- **Gate command** (Full, per `tasks.md`): `npm run test:unit && npm run test:integration` (integração restrita a `supabase/tests/planejamento/`, escopo desta validação) + `npm run build && npm run lint:all`
- **Unit**: 218 passed, 0 failed, 24 arquivos (inclui os 3 novos desta feature: `schemas/planejamento.test.ts` 32 testes, `queries/planejamento.test.ts` 6 testes, `rpc/planejamento.test.ts` 5 testes = **+43 testes unitários**)
- **Integration (escopo desta feature)**: `npm run test:integration -- supabase/tests/planejamento/` → 3 arquivos, **16/16 passed** (RLS 8, cascata 5, lote 3)
- **Integration (suíte completa, rodada em paralelo pelo orquestrador)**: 254/260 passed, 33/34 arquivos — as 6 falhas são inteiramente em `supabase/tests/kanban/fn-mover-etapa-kanban.integration.test.ts` (feature `kanban-etapas`, fora do escopo desta validação, não tocado por esta feature)
- **Build**: `npm run build` — sucesso, rota `/contratos/[id]/planejamento` compila (dinâmica, `ƒ`)
- **Lint**: `npm run lint:all` — 27 problemas (13 erros, 14 warnings), baseline pré-existente confirmada (`grep -i planejamento` na saída completa do lint = 0 ocorrências; nenhum arquivo desta feature aparece)
- **Test count before feature**: não medido diretamente (nenhum snapshot pré-feature disponível nesta sessão); confirmado por inspeção que nenhum arquivo de teste pré-existente foi modificado ou removido pelos 23 commits desta feature (só os 6 arquivos de teste novos listados no escopo) — delta é puramente aditivo: **+43 unit, +16 integration = +59 testes**
- **Skipped tests**: nenhum
- **Failures**: nenhuma dentro do escopo desta feature

---

## Fix Plans (if issues found)

### Fix 1: PLM-02 — grade refaz fetch completo após editar 1 célula

- **Root cause**: `handleEdicaoCelula` (`src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx:140-151`) faz o `UPDATE` escopado corretamente, mas em seguida chama `recarregarGrade()` (`:111-116`), que busca de novo **todos** os Sucessos Mensais de **todas** as Metas do planejamento via `idsMetaDoPlanejamento(planejamento)` — não só a linha editada. Isso contradiz o texto literal da AC2 ("SHALL salvar aquela célula **sem recarregar a grade inteira**") e reintroduz exatamente o tipo de custo de rede por edição que a AD-028 (risco de adoção) existe para evitar — ao tabular por N células em sequência, o cliente dispara N refetches completos da grade, não N updates simples.
- **Fix task**: Atualizar o estado local (`linhasGrade`) de forma otimista — substituir apenas a linha do `idSucesso` editado no array em memória — em vez de rechamar `buscarGradeSucessosMensais` para o planejamento inteiro. Reservar um refetch completo para os momentos em que campos derivados pelo servidor (`status`/`diasAtraso` via trigger) realmente precisam ressincronizar (ex.: após `recalcularAtingimento`), não a cada célula.
- **Priority**: Major (não Blocker — a escrita em si é correta e segura; o problema é custo/latência que ataca diretamente o risco de adoção que motivou a US inteira)

### Fix 2: PLM-06.3 — INSERT/DELETE em contrato não vinculado sem teste

- **Root cause**: `planejamento-rls.integration.test.ts:249-258` testa só `UPDATE` do Assessor em `fat_sucesso_mensal` de um contrato não vinculado; a AC lista `UPDATE`/`INSERT`/`DELETE`. Risco prático é baixo (o GRANT do Assessor em `fat_sucesso_mensal` já é só `SELECT, UPDATE` — sem `INSERT`/`DELETE` — então essas duas operações falhariam por GRANT independente de vínculo), mas isso não está comprovado empiricamente.
- **Fix task**: Adicionar 2 casos ao teste existente: Assessor `INSERT`/`DELETE` em `fat_sucesso_mensal` (de qualquer contrato, vinculado ou não) esperando `42501` por ausência de GRANT.
- **Priority**: Minor

### Fix 3: PLM-09 — `status='descartada'` nunca exercitado

- **Root cause**: `planejamento-cascata.integration.test.ts` só usa `status='pausada'` na fixture (com prova bidirecional de exclusão/inclusão). `'descartada'` compartilha o mesmo predicado SQL (`WHERE mm.status = 'ativa'`), então o risco de comportamento diferente é baixo, mas não está coberto por teste.
- **Fix task**: Adicionar uma Meta `status='descartada'` à fixture (ou um teste dedicado) confirmando que também é excluída da média do Objetivo.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PLM-01 | Implementing | ✅ Verified |
| PLM-02 | Implementing | ❌ Needs Fix (Fix Plan #1) |
| PLM-03 | Implementing | ✅ Verified |
| PLM-04 | Implementing | ✅ Verified |
| PLM-05 | Implementing | ✅ Verified |
| PLM-06 | Implementing | ⚠️ Verified com gap de cobertura (Fix Plan #2) |
| PLM-07 | Implementing | ✅ Verified |
| PLM-08 | Implementing | ✅ Verified |
| PLM-09 | Implementing | ⚠️ Verified com gap de cobertura (Fix Plan #3) |
| PLM-10 | Implementing | ✅ Verified (sem teste automatizado, consistente com a Matrix) |
| PLM-11 | Implementing | ✅ Verified (sem teste automatizado, consistente com a Matrix) |

---

## Summary

**Overall**: ⚠️ Issues — não bloqueante para o mecanismo de segurança (RLS/GRANT/SECURITY DEFINER, o risco mais sensível desta feature, está corrigido e comprovadamente testado), mas há 1 gap funcional real (Major) e 2 gaps de cobertura de teste (Minor) que justificam retorno FAIL por regra do processo ("achar um gap real → FAIL com lista rankeada").

**Spec-anchored check**: 10/11 requirements com evidência direta e precisa; PLM-02 com gap real; PLM-06/PLM-09 com cobertura parcial (comportamento correto por leitura de código, mas não 100% empiricamente comprovado)

**Sensor**: 3/3 mutações (camada TS/Zod) mortas; camada SQL (fórmula de cascata, atomicidade do lote) não mutada ao vivo por risco de banco de dev compartilhado concorrente — compensada por citação exata de código e por testes de integração já existentes com valores não-vazios/desiguais

**Gate**: unit 218/218, integration (escopo da feature) 16/16, build ✅, lint baseline confirmada (0 arquivos desta feature)

**What works**: toda a cadeia RLS/GRANT (incluindo a distinção correta 42501-vs-silencioso), a fórmula de cascata nos 3 níveis com prova numérica exata e bidirecional, a atomicidade do lote, o fix real de SECURITY DEFINER (AD-035) confirmado por teste, e os 43+16 testes novos mapeados 1:1 aos ACs.

**Issues found**:
1. [Major] PLM-02 — refetch completo da grade após cada edição de célula, contra o texto literal da AC e o risco de adoção (AD-028) que motivou a US
2. [Minor] PLM-06.3 — `INSERT`/`DELETE` em contrato não vinculado sem teste (risco baixo, coberto estruturalmente pelo GRANT)
3. [Minor] PLM-09 — `status='descartada'` nunca exercitado (mesmo predicado de `'pausada'`, risco baixo)

**Next steps**: decisão de corrigir (ou aceitar como débito) é do orquestrador. Fix 1 é o único com impacto direto em UX/performance de produção; Fixes 2/3 são só reforço de cobertura de teste sobre comportamento já correto.

---

## Re-verificação (Rodada 2)

**Date**: 2026-08-12
**Diff range**: `f0e8016..a2fda44` (1 commit de fix), HEAD = `a2fda44`
**Verifier**: independent sub-agent (author ≠ verifier), evidence-or-zero
**Escopo**: re-verificação dirigida dos 3 fixes do commit `a2fda44` — não uma re-auditoria da
feature inteira. Os itens já ✅ PASS da rodada 1 não foram reexaminados (nenhum fix os tocava).
**Verdict**: ✅ **PASS** — 3/3 fixes confirmados por leitura direta do código atual (não pelo
resumo do orquestrador), gate completo verde e rodado de forma independente.

### Os 3 fixes

| # | Fix | Evidência (lida diretamente, não do resumo do orquestrador) | Confirmado? |
| --- | --- | --- | --- |
| 1 | **Major** — PLM-02, refetch completo da grade após editar 1 célula | `git show a2fda44 -- ".../planejamento/page.tsx"` confirma a remoção de `recarregarGrade()` (função inteira deletada, ficou sem uso). Estado atual (`src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx:139-152`, `handleEdicaoCelula`): o `UPDATE` continua escopado (`.eq("id_sucesso", idSucesso)`, linha 144, idêntico à rodada 1) e a linha 149-151 agora faz `setLinhasGrade((atual) => atual.map((linha) => linha.idSucesso === idSucesso ? {...linha, pctAtingimento} : linha))` — atualização local, zero chamada de rede adicional. `handleColarFaixa` (`:155-166`) segue o mesmo padrão para as N linhas da faixa, com `Map` por `idSucesso`. Nenhuma referência a `recarregarGrade`/refetch completo sobrevive no arquivo (`grep -n recarregarGrade` no arquivo atual: 0 ocorrências). O carregamento inicial da grade (`:87-95`, dentro do efeito de montagem) continua chamando `buscarGradeSucessosMensais` normalmente — isso é o carregamento da tela, não um refetch pós-edição, e está fora do escopo do AC | ✅ |
| 2 | **Minor** — PLM-06.3, INSERT/DELETE sem GRANT do Assessor sem teste | `git show a2fda44 -- ".../planejamento-rls.integration.test.ts"` confirma os 2 casos novos. Lidos no arquivo atual: `supabase/tests/planejamento/planejamento-rls.integration.test.ts:264-270` (`INSERT`) e `:272-276` (`DELETE`) — ambos `expect(error?.code).toBe("42501")`, código específico, não `expect(error).not.toBeNull()` genérico. Comentário inline (`:260-263`) explica corretamente a diferença deste caso (rejeição por GRANT) do caso já existente na rodada 1 (rejeição por RLS silenciosa) | ✅ |
| 3 | **Minor** — PLM-09, `status='descartada'` nunca exercitado | `git show a2fda44 -- ".../planejamento-cascata.integration.test.ts"` confirma Meta D. Lido no arquivo atual: fixture ganha `idMetaD`/`idSucessoD` (`status='descartada'`, peso 100, pct 30) — `:94-97`, `:115-118`. Asserção de valor exato, não vaga: `:174` `expect(pctPorMeta.get(f.idMetaD)).toBe(30)` (a própria Meta D tem seu pct calculado normalmente) e `:186` `expect(pctPorObjetivo.get(f.idObjetivo1)).toBe(50)` — Objetivo1 continua exatamente 50 mesmo com Meta B (pausada, 90) **e** Meta D (descartada, 30) presentes; se qualquer uma entrasse na média, o valor não seria mais 50 (prova por exclusão, igual ao padrão já usado pra `'pausada'` na rodada 1) | ✅ |

### Gate completo (rodado de forma independente pelo Verifier, não só reusado do orquestrador)

| Gate | Rodada 1 | Rodada 2 (evidência fresca desta re-verificação) | Resultado |
| --- | --- | --- | --- |
| `npm run test:unit` | 218 passed (24 arquivos) | **218 passed, 0 failed** (24 arquivos) — sem mudança, esperado (o fix não tocou nenhum arquivo unitário) | ✅ |
| `npm run test:integration -- supabase/tests/planejamento/` | 16 passed (3 arquivos) | **18 passed, 0 failed** (3 arquivos: RLS 10, cascata 5, lote 3) — +2 (Fix 2). Cascata continua 5 arquivos/casos porque Fix 3 estendeu um `it` já existente com mais asserções, não criou um novo | ✅ +2 |
| `npm run build` | verde, rota `/contratos/[id]/planejamento` presente | **verde** — mesma rota presente na tabela de rotas, sem erro de TypeScript após a mudança em `page.tsx` | ✅ |
| `npm run lint:all` | 27 problems (13 errors, 14 warnings), 0 nesta feature | **27 problems (13 errors, 14 warnings)** — baseline exata, `grep -i planejamento` na saída completa: vazio | ✅ |

**Delta de testes (+2)**: `planejamento-rls.integration.test.ts` 8→10 (+2, INSERT/DELETE do
Assessor sem GRANT). `planejamento-cascata.integration.test.ts` continua 5 testes (Fix 3 adicionou
asserções dentro do teste `AC2/AC3` já existente, não um teste novo — Meta D entra na mesma
fixture `beforeAll` compartilhada pelos 5 `it`s). Nenhum teste removido, nenhum `skip`, nenhuma
asserção pré-existente enfraquecida (todas as asserções da rodada 1 continuam literalmente no
arquivo, só com `idMetaD`/`idSucessoD` adicionados ao lado).

**Projeto Supabase alvo**: mesma ressalva da rodada 1 — o dev é compartilhado com sessões
paralelas ativas (`kanban-etapas`, `visao-gerencial-g1-g2`). Nenhuma função/migration Postgres foi
mutada nesta rodada (os 3 fixes são só TypeScript/teste, nenhuma migration nova neste commit).

### Code Quality — arquivos tocados pelos fixes

| Check | Pass? |
| --- | --- |
| No features beyond what was asked | ✅ — nenhum fix adicionou superfície nova (nem UI, nem RPC, nem coluna) |
| No abstractions for single-use code | ✅ — `.map()`/`Map` inline, sem hook/util novo extraído |
| Only touched files required for task | ✅ — exatamente os 3 arquivos que os 3 Fix Plans apontavam, nada mais (`git show a2fda44 --stat`) |
| Didn't "improve" unrelated code | ✅ — `recarregarHierarquia` (não apontada por nenhum gap) permanece intocada |
| Matches existing patterns/style | ✅ — atualização otimista via `setState(prev => prev.map(...))` é o padrão React idiomático já usado em outras telas do repo para edição de item único numa lista |
| Spec-anchored outcome check | ✅ — os 2 novos casos de teste (Fix 2) e as novas asserções (Fix 3) usam valor/código exato, não asserção vaga |
| Would senior engineer approve? | ✅ |

### Requirement Traceability Update

| Requirement | Rodada 1 | Rodada 2 |
| --- | --- | --- |
| PLM-01 | ✅ Verified | ✅ Verified |
| PLM-02 | ❌ Needs Fix (refetch completo pós-edição) | ✅ Verified — atualização otimista confirmada, `recarregarGrade` removida, escrita continua escopada |
| PLM-03 | ✅ Verified | ✅ Verified |
| PLM-04 | ✅ Verified | ✅ Verified |
| PLM-05 | ✅ Verified | ✅ Verified |
| PLM-06 | ⚠️ Verified com gap de cobertura (INSERT/DELETE não testados) | ✅ Verified — INSERT e DELETE do Assessor sem GRANT agora testados com `42501` explícito |
| PLM-07 | ✅ Verified | ✅ Verified |
| PLM-08 | ✅ Verified | ✅ Verified |
| PLM-09 | ⚠️ Verified com gap de cobertura (`'descartada'` não exercitada) | ✅ Verified — Meta D (`descartada`) provadamente excluída da média do Objetivo, valor exato |
| PLM-10 | ✅ Verified (sem teste automatizado, consistente com a Matrix) | ✅ Verified |
| PLM-11 | ✅ Verified (sem teste automatizado, consistente com a Matrix) | ✅ Verified |

**11/11 requisitos ✅ Verified.**

### Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: 11/11 requirements com evidência direta e precisa (era 10/11 + 2 parciais
na rodada 1). PLM-02 deixou de ser GAP; PLM-06 e PLM-09 deixaram de ter cobertura parcial.
**Sensor**: não repetido nesta rodada — os 3 fixes são mudanças aditivas/de estado local e de
teste, sem lógica de validação nova na camada TS/Zod que justificasse uma nova rodada de mutação
(a rodada 1 já havia matado 3/3 mutações nessa camada, e nenhum dos 3 fixes altera `schemas/planejamento.ts`
nem `rpc/planejamento.ts`).
**Gate**: unit 218/218 ✅ · integration (escopo da feature) 18/18 ✅ (+2 vs. rodada 1) · build ✅ ·
lint 27 = baseline ✅ — todos rodados de forma independente por este Verifier, não só reusados do
resumo do orquestrador.

**O que mudou desde a rodada 1**: `handleEdicaoCelula`/`handleColarFaixa` (`page.tsx`) trocaram
refetch completo da grade por atualização otimista do estado local — a escrita em si (o `UPDATE`
escopado e a RPC de lote) não mudou, só a estratégia de resync pós-escrita; `recarregarGrade()` foi
removida por ficar sem uso. O teste de RLS ganhou 2 casos (`INSERT`/`DELETE` do Assessor sem GRANT,
`42501` explícito). O teste de cascata ganhou uma 4ª Meta (`'descartada'`) na mesma fixture,
provando por valor exato que ela também é excluída da média do Objetivo. Nenhuma migration nova,
nenhuma mudança de schema.

**Recomendação**: liberar a feature. Os 3 gaps da rodada 1 estão fechados com evidência de código
e de teste, não apenas com a palavra do commit.
