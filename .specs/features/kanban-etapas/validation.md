# Kanban de Etapas Validation

**Date**: 2026-08-12
**Spec**: `.specs/features/kanban-etapas/spec.md`
**Diff range**: `d355788^..8569c31` (T1-T11 + 2 docs commits — interleaved in `develop`'s history with
unrelated concurrent commits from `planejamento-planilha-monitoramento`, which never touch a
kanban-etapas file; confirmed by `git show --stat` per commit below)
**This session's batch (T6-T11)**: `2df7f79..8569c31`
**Verifier**: standalone fallback (no orchestrator/sub-agents in this run — same agent that
implemented T6-T11 runs this as a distinct, fresh-eyes final phase per `sub-agents.md`)

---

## Task Completion

| Task | Status | Commit |
| --- | --- | --- |
| T1 | ✅ Done | `d355788` |
| T2 | ✅ Done | `c34137c` |
| T3 | ✅ Done | `8ede5c1` |
| T4 | ✅ Done | `98ba773` |
| T5 | ✅ Done | `093c46f` |
| T6 | ✅ Done | `2df7f79` |
| T7 | ✅ Done | `a729a7e` |
| T8 | ✅ Done | `fda180b` |
| T9 | ✅ Done | `60e2495` |
| T10 | ✅ Done | `8655c3d` |
| T11 | ✅ Done | `de8c3cf` |
| docs (traceability) | ✅ Done | `69774b2` (Batch 1), `8569c31` (Batch 2) |

All 11 tasks complete, no blocked/partial tasks.

---

## Spec-Anchored Acceptance Criteria

### P1: Board Kanban por produto (KAN-01, KAN-02, KAN-03)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: abre o Kanban → 1 coluna por `ref_etapa`, ordenada por `ordem` | colunas em ordem crescente de `ordem` | `src/backend/queries/kanban.test.ts:99-111` — `expect(resultado.map((c) => c.ordem)).toEqual([1, 2])` + `expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }])` | ✅ PASS (backend) — frontend render (`kanban-coluna.tsx`/`kanban-board.tsx`) sem harness, ver Nota |
| AC2: `id_etapa_atual` preenchido → card na coluna correspondente | card aparece só na coluna de `id_etapa_atual` | `src/backend/queries/kanban.test.ts:114-132` — `expect(colunaPontape.cards[0].idContrato).toBe(100)`, `expect(colunaCadastro.cards).toEqual([])` | ✅ PASS |
| AC2: `id_etapa_atual IS NULL` → card na coluna `ordem = 1` | card aparece na 1ª coluna | `src/backend/queries/kanban.test.ts:135-151` — `expect(colunaCadastro.cards[0].idContrato).toBe(100)` | ✅ PASS |
| AC3: filtro aplicado → só cards que passam, sem reload de página inteira | conjunto de `id_contrato` restringido por filtro; 2 filtros = AND | `src/backend/queries/kanban.test.ts:154-178` (isolado, `idGestora`), `:181-196` (isolado, `idProjeto`), `:199-222` (isolado, `minhaCarteira`), `:225-247` (dois juntos, AND) | ✅ PASS (backend, AND confirmado). "Sem reload de página inteira" é garantido pela arquitetura (client component + `useQuery`, sem `router.refresh`/navegação) — não testado por assertion dedicada, ⚠️ spec-precision gap por construção |
| AC4: card mostra nome do contratante e "há N dias" | campos `nomeContratante`/`diasNaEtapaAtual` corretos | `src/backend/queries/kanban.test.ts:250-267` (usa `dt_inicio` da etapa), `:270-288` (fallback `fat_contrato.dt_inicio`) — `expect(resultado[0].cards[0].diasNaEtapaAtual).toBe(5)`/`toBe(30)` | ✅ PASS (dado); render em `kanban-card.tsx` sem harness, ver Nota |

### P1: Mover card pra frente grava a transição (KAN-04, KAN-05, KAN-06, KAN-07)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: arrasta N→N+1 → etapa N `concluida`/`dt_conclusao=hoje`, etapa N+1 `em_andamento`/`dt_inicio=hoje` | valores exatos de status/data | `supabase/tests/kanban/fn-mover-etapa-kanban.integration.test.ts:177-197` — `expect(etapa1.status).toBe("concluida")`, `expect(etapa1.dt_conclusao).toBe(hoje)`, `expect(etapa2.status).toBe("em_andamento")`, `expect(etapa2.dt_inicio).toBe(hoje)` | ✅ PASS (DB) |
| AC1 (encadeado): etapa 2→3 a partir de `id_etapa_atual` não-nulo | mesmo padrão, a partir de estado não-inicial | `fn-mover-etapa-kanban.integration.test.ts:199-217` | ✅ PASS (DB) |
| AC2: grava → `fat_contrato.id_etapa_atual` = etapa N+1 | valor exato do novo `id_etapa_atual` | `fn-mover-etapa-kanban.integration.test.ts:196` — `expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa2)` | ✅ PASS (DB) |
| AC3: grava → linha em `log_auditoria` (autor, tabela, alvo, antes/depois) | linhas `insert`/`update`/`delete` com `id_registro_alvo` correto | `supabase/tests/kanban/kanban-etapas-audit-trigger.integration.test.ts:45-77` — `expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"])`; `fn-mover-etapa-kanban.integration.test.ts:310-326` (avanço+retrocesso reais geram linhas) | ✅ PASS (DB) |
| AC4: salto não-adjacente (N→N+2) → rejeitado, card volta pra origem | erro `KAN01`, nenhuma linha alterada | DB: `fn-mover-etapa-kanban.integration.test.ts:219-234` — `expect(error?.code).toBe("KAN01")` + `expect(etapa1.status).toBe("nao_iniciada")`. Backend: `src/backend/rpc/kanban.test.ts:43-52` — `rejects.toThrow(TransicaoInvalidaError)` | ✅ PASS (DB+backend); guard client-side em `kanban-board.tsx:96-113` (`handleDragEnd`) sem harness, ver Nota |

### P1: RLS de escrita — só quem tem vínculo pode mover (KAN-08)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: sem vínculo/sem papel admin-gestora → `WITH CHECK` rejeita | UPDATE não altera a linha (RLS filtra) | `supabase/tests/kanban/kanban-etapas-rls-grants.integration.test.ts:147-160` — `expect(rows[0].status).toBe("nao_iniciada")` (inalterado); `fn-mover-etapa-kanban.integration.test.ts:295-308` — `expect(error?.code).toBe("42501")` | ✅ PASS (DB) |
| AC2: Admin/Gestora move qualquer card → permitido | sucesso incondicional | `fn-mover-etapa-kanban.integration.test.ts:177-197` (Gestora) | ✅ PASS (DB) |
| AC3: Mentor/Assessor com vínculo ativo move o próprio contrato → permitido | sucesso | `kanban-etapas-rls-grants.integration.test.ts:129-145` (UPDATE direto), `fn-mover-etapa-kanban.integration.test.ts:263-277` (via RPC) | ✅ PASS (DB) |

### P2: Mover card pra trás corrige erro (KAN-09)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: Admin/Gestora N+1→N → etapa N reabre (`em_andamento`, `dt_conclusao=NULL`), N+1 zera (`nao_iniciada`, datas `NULL`) | valores exatos | `fn-mover-etapa-kanban.integration.test.ts:236-261` — `expect(etapa1.status).toBe("em_andamento")`, `expect(etapa1.dt_conclusao).toBeNull()`, `expect(etapa2.status).toBe("nao_iniciada")`, `expect(etapa2.dt_inicio).toBeNull()` | ✅ PASS (DB) |
| AC2: Mentor/Assessor tenta o mesmo → rejeitado | erro `42501`, nenhuma linha alterada | `fn-mover-etapa-kanban.integration.test.ts:279-293` — `expect(error?.code).toBe("42501")` + status inalterados. Backend: `src/backend/rpc/kanban.test.ts:54-60` — `rejects.toThrow(PermissaoNegadaError)` | ✅ PASS (DB+backend); guard client-side (`usePapelGlobal`) sem harness, ver Nota |
| AC3: reversão audita igual ao avanço | linha em `log_auditoria` | `fn-mover-etapa-kanban.integration.test.ts:310-326` (retrocesso incluído) | ✅ PASS (DB) |

### P2: Recortes do board (KAN-10)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: "Minha carteira" → restringe a `rel_usuario_contrato` do usuário logado, qualquer papel | conjunto de `id_contrato` restringido pela sessão atual | `src/backend/queries/kanban.test.ts:199-222` — `expect(idsCards).toEqual([200])` | ✅ PASS (backend); Select/Switch em `dashboard/page.tsx` sem harness, ver Nota |
| AC2: produto + projeto combinados → AND | interseção, não união | `src/backend/queries/kanban.test.ts:225-247` | ✅ PASS (backend) |

**Status**: ✅ Todos os 10 requisitos (KAN-01 a KAN-10) e suas ACs têm evidência de `file:line` —
nenhum GAP (ausência total de evidência). 1 ⚠️ spec-precision gap anotado (AC3 do Board, "sem reload
de página inteira" — garantido por arquitetura, não por assertion dedicada).

**Nota (camada frontend, T6-T11):** `vitest.config.ts` só inclui `src/backend/**` — não há harness
de componente React neste projeto (débito documentado, lições L-006/L-007, confirmado por leitura de
`vitest.config.ts:6` nesta sessão). Toda renderização/interação client-side (drag-and-drop em si,
guards `onDragEnd`, filtro de projeto/minha carteira na UI) é coberta só por `npm run build && npm
run lint:all` (tipagem + lint, gate verde em cada uma das 6 tasks) e inspeção de código — não por
assertion de comportamento renderizado. Isso é consistente com a Test Coverage Matrix de `tasks.md`
(`Tests: none` para T6-T11, decisão já tomada na fase Tasks, não uma omissão desta validação).

---

## Discrimination Sensor

Sensor rodado nas camadas com teste automatizado real (backend unit — `src/backend/queries/
kanban.ts`, `src/backend/rpc/errors.ts`), em estado de rascunho local (edit → `npx vitest run` →
`git checkout --` para descartar, nenhuma mudança chegou a ficar no working tree ou em commit).

**DB layer (`app.mover_etapa_kanban`) deliberadamente fora do sensor desta rodada** — decisão de
segurança, não omissão: o projeto de dev é um recurso **compartilhado em tempo real** com outra
sessão de agente ativa durante esta mesma execução (evidenciado por commits intercalados de
`planejamento-planilha-monitoramento` no `git log`, incluindo uma regeneração de `database.types.ts`
no meio deste próprio batch). Mutar uma função/policy **já implantada** no banco, mesmo
temporariamente, é exatamente o anti-padrão que `CLAUDE.md` documenta como causa de 6 divergências
dev/prod anteriores ("SQL rodado à mão que nunca virou arquivo") — mesmo em dev, mesmo revertido em
segundos, um `CREATE OR REPLACE FUNCTION`/`ALTER POLICY` ad-hoc fora do fluxo de migration arrisca
comportamento incorreto observável pela outra sessão durante a janela da mutação.

A camada DB foi, em vez disso, **re-confirmada ao vivo nesta sessão** (não só por evidência
histórica): `npx vitest run --config vitest.integration.config.ts supabase/tests/kanban` — as 3
suítes (T1/T2/T3) rodaram de ponta a ponta contra o Supabase de dev real, **15/15 testes verdes**
(mesma contagem exata documentada em `tasks.md` no momento de cada task: T1=4, T2=2, T3=9). A
suíte completa (`npm run test:integration`, todos os arquivos do repo) foi tentada primeiro e
cancelada após ~10 min sem produzir output — `fileParallelism: false` serializa TODOS os arquivos de
integração do repo (não só os desta feature), e cada `runSql` spawna um processo `supabase db query`
próprio; com outra sessão concorrente disputando a mesma API de management, o tempo total da suíte
inteira ficou impraticável para esta validação. O recorte só de `supabase/tests/kanban` (sem esse
gargalo do resto do repo) completou em 346s -- lento (cada teste individual levou de 4s a 28s, nested
CLI spawn por `runSql`), mas **não estava travado**: terminou com sucesso e forneceu a confirmação ao
vivo que se buscava.

| # | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/backend/rpc/errors.ts:124` | `if (error.code === "KAN01")` → `"KAN99"` (rompe o mapeamento do salto inválido) | ✅ Killed — `src/backend/rpc/kanban.test.ts` "KAN01: lança TransicaoInvalidaError" falhou (`expected error to be instance of TransicaoInvalidaError`) |
| 2 | `src/backend/queries/kanban.ts:172` | `contrato.id_etapa_atual ?? idEtapaOrdem1` → `idEtapaOrdem1` (ignora `id_etapa_atual`, todo card cairia sempre na coluna 1) | ✅ Killed — `src/backend/queries/kanban.test.ts` "posiciona o card na coluna correspondente a id_etapa_atual quando preenchido" falhou (esperava `[]` na coluna 1, recebeu o card) |
| 3 | `src/backend/queries/kanban.ts:178` | `dtInicioEtapa ?? contrato.dt_inicio` → `contrato.dt_inicio ?? dtInicioEtapa` (inverte a prioridade das 2 datas-âncora) | ✅ Killed — "diasNaEtapaAtual usa fat_etapa_contrato.dt_inicio..." falhou (`expected 100 to be 5`) |
| 4 | `src/backend/queries/kanban.ts:140` | `.filter((c) => idsContratoSet.has(c.id_contrato))` → adiciona `&& c.status === "ativo"` (dropa silenciosamente contratos encerrados) | ❌ **Survived** — as 12 assertions de `kanban.test.ts` continuaram passando; nenhuma delas usa um fixture com `status !== "ativo"`. Confirma empiricamente o gap já suspeitado por evidence-or-zero: o Edge Case "contrato `concluido`/`nao_concluido` continua visível" (spec.md, Edge Cases) não tem cobertura dedicada na camada backend → **fix task recomendado** |

**Sensor depth**: lightweight (4 mutações — 1 acima do teto default de 3, porque a mutação 4 nasceu
de uma suspeita concreta levantada durante a leitura de `kanban.test.ts`, evidence-or-zero aplicado
antes do sensor, não um mutation-testing exaustivo)
**Result**: 3/4 killed, 1 survived (gap real e não-bloqueante — comportamento correto já implementado
em `buscarBoardKanban`, só falta a asserção que o comprove; ver Fix Plans)

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — cada componente (`kanban-card`/`kanban-coluna`/`kanban-board`) faz uma coisa; nenhuma abstração para uso único |
| Surgical changes | ✅ — cada commit toca só os arquivos listados na sua task (confirmado via `git show --stat` por commit) |
| No scope creep | ✅ — nenhum cálculo de G1/G2, nenhuma ação "dispensar etapa", nenhuma reordenação de coluna (todos Out of Scope do spec.md) foi tocado |
| Matches patterns | ✅ — `Badge`/`STATUS_VARIANT` (T7) replica `etapas/[codigo]/page.tsx`; `<CarregandoSkeleton>`/`<ErroInline>`/`<EstadoVazio>` (T9) replicam o padrão AD-029; filtro papel+pessoa (T10) estende o Select em cascata já existente |
| Spec-anchored outcome check (asserted values match spec) | ✅ — ver tabela de ACs acima, valores exatos (`"concluida"`, `hoje`, `idEtapa2`, códigos de erro) em cada assertion, não só "não lançou erro" |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ para DB/backend (1:1 com KAN-04 a KAN-09, incluindo caminho negado); ⚠️ frontend T6-T11 sem cobertura automatizada possível (sem harness), conforme já decidido na Test Coverage Matrix de `tasks.md` |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — todo teste em `kanban.test.ts`/`fn-mover-etapa-kanban.integration.test.ts`/etc. tem comentário `// Done-when:`/`// spec.md KAN-NN` citando o requisito |
| Documented guidelines followed | `tasks.md` → Test Coverage Matrix (gerada por amostragem do próprio repo, sem doc de guideline formal além de `CLAUDE.md`) |

**SPEC_DEVIATION encontrados nesta sessão (T6-T11)** — ambos já documentados inline no código/commit,
recapitulados aqui por completude:
1. `src/frontend/components/ui/switch.tsx` (T10) — `design.md` assumia `Switch`/`Checkbox` (shadcn) já
   instalado; nenhum existia. Resolvido com o primitivo `radix-ui` já dependência do projeto, mesmo
   padrão de `select.tsx`/`label.tsx` — zero `npm install` novo.
2. `filtroBoard` (T10→T11) — a combinação AND das 3 dimensões de filtro foi deliberadamente movida de
   T10 para T11 (onde tem consumidor), para não introduzir um `no-unused-vars` no gate de lint de T10.

---

## Edge Cases

- [x] `ref_etapa` com `gera_registro = false` → coluna aparece normalmente — `buscarBoardKanban`
      (`src/backend/queries/kanban.ts`) nunca lê/filtra por `gera_registro`; nenhum código de caminho
      diferente existe para esse campo. Correto por construção, sem assertion dedicada (o campo
      simplesmente não é usado nesta feature).
- [x] Falha de rede no meio do drag → card volta pra posição original — `kanban-board.tsx` (`onMutate`
      snapshot + `onError` restore, linhas 60-79). Implementado seguindo o padrão idiomático de
      optimistic mutation do TanStack Query; sem harness de componente para simular a falha e
      confirmar o rollback em runtime (débito já registrado).
- [x] Concorrência (2 usuários movem o mesmo card) → última escrita vence, board revalida ao focar/
      reconectar — comportamento **default** do TanStack Query (`refetchOnWindowFocus`/
      `refetchOnReconnect`), não sobrescrito em `src/frontend/lib/query-client.ts` (só `staleTime` é
      configurado). Não é lógica desta feature para testar — é o comportamento de biblioteca já usado
      em todo o app.
- [ ] Contrato `concluido`/`nao_concluido` continua visível com indicação visual — **implementado
      corretamente** (`buscarBoardKanban` nunca filtra por `status`; `kanban-card.tsx` mostra `Badge`
      quando `statusContrato !== "ativo"`), mas **sem teste dedicado** — confirmado pelo sensor
      (mutação 4, sobreviveu). Marcado como gap de cobertura, não de comportamento.

---

## Gate Check

- **Gate command (T6-T11, "Build")**: `npm run build && npm run lint:all` — rodado 6x nesta sessão
  (uma vez por task), sempre com `npm run build` limpo e `npm run lint:all` na baseline pré-existente
  documentada em `.specs/STATE.md` de **27 problemas (13 erros, 14 warnings)**, zero novos em
  qualquer arquivo desta feature.
- **Gate command (T1-T3, "Full")**: `npm run test:integration && npm run test:unit`. Re-executado ao
  vivo nesta sessão de validação (recorte `supabase/tests/kanban`, ver nota no Discrimination
  Sensor): **15/15 testes verdes**, mesma contagem documentada em `tasks.md` para T1/T2/T3.
- **`npm run test:unit` (rodado ao vivo nesta sessão)**: 22 arquivos, **204 testes, todos verdes**
  (inclui os 12 de `kanban.test.ts` e os 4 de `rpc/kanban.test.ts`, sem alteração desde T4/T5).
- **Test count antes da feature**: 0 testes de `kanban-etapas` (feature nova).
- **Test count depois (unit)**: 16 (`kanban.test.ts` 12 + `rpc/kanban.test.ts` 4).
- **Test count depois (integration)**: 15 (T1=4 + T2=2 + T3=9) — reconfirmado ao vivo nesta sessão.
- **Delta**: +31 testes automatizados novos (backend+DB), +0 possível no frontend (sem harness).
- **Skipped tests**: nenhum.
- **Failures**: nenhuma (nem nos testes reais, nem nos 4 testes durante as mutações — os 3
  esperados falharam e foram revertidos; o 4º não falhou, é o gap reportado acima).

---

## Fix Plans (gap encontrado, não-bloqueante)

### Fix 1: `kanban.test.ts` não tem um fixture com `status !== "ativo"`

- **Root cause**: nenhum dos 12 testes de `buscarBoardKanban` usa uma linha de `fat_contrato` com
  `status: "concluido"` ou `"nao_concluido"` — a suíte nunca exercitou o Edge Case explícito do
  spec.md ("contrato encerrado continua visível"). O comportamento correto já existe no código
  (nenhum filtro de `status` em `buscarBoardKanban`); só a prova automatizada está faltando.
- **Fix task**: adicionar um teste em `src/backend/queries/kanban.test.ts` — fixture de
  `fat_contrato` com `status: "concluido"`, `criarClienteMock`, `buscarBoardKanban`, e
  `expect(resultado...cards[0].statusContrato).toBe("concluido")` (confirma que a linha aparece e
  preserva o status, não é removida pelo filtro).
- **Priority**: Minor (comportamento já correto; gap é só de cobertura/prova, não de função).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| KAN-01 | Implementing | Implemented (backend Verified; frontend sem harness) |
| KAN-02 | Implementing | ✅ Verified |
| KAN-03 | Implementing | Implemented (backend Verified; frontend sem harness) |
| KAN-04 | Implementing | Implemented (DB+backend Verified; guard client-side sem harness) |
| KAN-05 | Implementing | ✅ Verified |
| KAN-06 | Verified | ✅ Verified (reconfirmado) |
| KAN-07 | Implementing | Implemented (DB+backend Verified; guard client-side sem harness) |
| KAN-08 | Verified | ✅ Verified (reconfirmado) |
| KAN-09 | Implementing | Implemented (DB+backend Verified; guard client-side sem harness) |
| KAN-10 | Implementing | Implemented (backend Verified; frontend sem harness) |

(Já refletido em `spec.md` → Requirement Traceability, atualizado nesta sessão antes desta
validação.)

---

## Summary

**Overall**: ✅ Ready (PASS, com 1 gap Minor ranked abaixo — não-bloqueante, comportamento correto,
falta só cobertura de teste)

**Spec-anchored check**: 10/10 requisitos com evidência `file:line`; 17 ACs mapeadas, 16 PASS + 1
⚠️ spec-precision gap (garantida por arquitetura, sem assertion dedicada)
**Sensor**: 3/4 mutações mortas, 1 sobreviveu (gap de cobertura documentado, Fix 1)
**Gate**: `npm run build && npm run lint:all` verde em 6/6 tasks desta sessão; `npm run test:unit`
204/204 verde (rodado ao vivo); `npm run test:integration` (recorte kanban) 15/15 verde (rodado ao
vivo)

**What works**: Board completo (colunas por etapa, posicionamento por `id_etapa_atual`, filtros
combináveis por AND incluindo "minha carteira"), drag-and-drop com `@dnd-kit/core` gravando a
transição real via `app.mover_etapa_kanban` (avanço, retrocesso restrito a Admin/Gestora, rejeição de
salto não-adjacente), auditoria automática via trigger, RLS/GRANT corretos de ponta a ponta, UI
integrada ao Dashboard do produto substituindo o placeholder.

**Issues found**:
1. Fix 1 (Minor): `kanban.test.ts` sem teste para contrato com `status !== "ativo"` — código já
   correto, falta a prova.
2. Débito estrutural já conhecido e aceito (não uma issue desta feature): nenhuma parte da UI
   (T6-T11) tem cobertura automatizada — sem harness de componente React no projeto.

**Next steps**: Fix 1 pode ser resolvido em uma task de 1 teste (`src/backend/queries/kanban.test.ts`)
quando convier; não bloqueia o encerramento desta feature. G1/G2 (feature seguinte,
`visao-gerencial-g1-g2`) já encontra dado real (`fat_etapa_contrato` sendo escrita de fato) pra
consumir.

**Ranked gaps** (informativo, não impede PASS):
1. Fix 1 — cobertura de teste do Edge Case "contrato encerrado continua visível" —
   `src/backend/queries/kanban.test.ts` (Minor).

**Fix aplicado** (orquestrador, mesma sessão, pós-Validate): `ccb0694` — novo teste com fixture
`status: 'concluido'` em `kanban.test.ts` (13 testes agora, era 12). `npm run test:unit`: 216/216
verde. Mutante #4 (linha 128 acima) seria morto por este teste caso reaplicado — não reexecutado
formalmente (seria a 4ª vez mutando o mesmo trecho na mesma sessão), mas a asserção nova
(`statusContrato` presente e preservado, card não removido) é logicamente a asserção que faltava
exatamente para capturar aquele mutante.
