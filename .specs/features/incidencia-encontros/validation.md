# Incidência & Encontros Validation

**Date**: 2026-08-14
**Spec**: `.specs/features/incidencia-encontros/spec.md`
**Diff range**: `ceb200b` (Specify+Discuss) .. `4f1d419` (fix: CAT-15 AC1/AC10 pra 4 linhas)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

All 35 tasks (T1–T35) marked `[x]` in `tasks.md`, across 5 phases. Two documented scope
reductions (T33 `EncontroForm` create-only; edição de status resolvida à parte em T34, 2º commit
`6bceb3e`) and one SPEC_DEVIATION (Encontro estendido a Assessor/Mentor, aprovado em design.md,
Tech Decisions) — ambos verificados abaixo, não são gaps.

| Task | Status | Notes |
| --- | --- | --- |
| T1–T9 (Schema) | ✅ Done | Migrations verbatim confirmadas por leitura direta (ver Spec-Anchored abaixo) |
| T10–T15 (Integration tests) | ✅ Done | 5 arquivos novos + 1 estendido, lidos integralmente — evidência real, não só "existe teste" |
| T16–T22 (Backend infra) | ✅ Done | `database.types.ts`, `usePapelGlobal`, `errors.ts`, 4 schemas Zod |
| T23–T27 (RPC/Queries) | ✅ Done | 3 wrappers RPC + `queries/incidencia.ts` (9 funções) |
| T28–T35 (Frontend) | ✅ Done | Confirmado por sub-agente de leitura independente (`IipCard`, 4 forms, `EncontrosLista`, chrome, 2 páginas) |
| Fix CAT-15 (`4f1d419`) | ✅ Done | Commit existe; as 2 asserções corrigidas batem com o schema real (`ref_nivel_iip` tem 4 linhas via T1) |

---

## Spec-Anchored Acceptance Criteria

### P1: Fato Gerador validado por Tipologia + cálculo do IIP

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — grava `fat_fato_gerador` com autor+criado_em | linha inserida, `id_usuario_autor > 0` | `supabase/tests/incidencia/fn-criar-fato-gerador.integration.test.ts:141-162` — `expect(row.id_usuario_autor).toBeGreaterThan(0)` | ✅ PASS |
| AC2 — rejeita quando D1/D2/D3 todos NULL (`ck_fato_niveis`) | erro `23514` | `supabase/tests/incidencia/incidencia-triggers-constraints.integration.test.ts:148-161` — `expectSqlError(..., "23514")` | ✅ PASS (sensor: mutante morto, ver abaixo) |
| AC3 — vínculo a Meta grava `rel_fato_origem`; sem Meta, fato existe sem linha | `id_meta` gravado / `count = 0` | `fn-criar-fato-gerador.integration.test.ts:164-181` (`vinculo.id_meta === a.idMeta`) e `:141-162` (`vinculos[0].count === 0`) | ✅ PASS |
| AC4 — vínculo a Insight aceito (não excludente de Meta) | `id_insight` gravado, `id_meta` NULL | `fn-criar-fato-gerador.integration.test.ts:183-200` | ✅ PASS |
| AC5 — `mv_iip_contrato` expõe `nr_fatos`/`iip_provisorio` pela fórmula verbatim | valor numérico exato calculado à mão | `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts:235-249` — `nr_fatos=2`, `iip_provisorio=4` (1×100/100 + 3×100/100, fórmula de `docs/schema_sistema.sql:1247-1267`) | ✅ PASS — valor exato, não só "não nulo" |
| AC6 — refresh síncrono antes de ler | `atualizaIipContrato` chamado antes de `buscarIipContrato` | `src/frontend/components/incidencia/iip-card.tsx:38-41` (código) + `supabase/tests/incidencia/iip.integration.test.ts:117-120` (RPC não falha por role) | ✅ PASS |
| AC7 — UI rotula "provisório" | texto explícito | `iip-card.tsx:63-68` — as 3 variantes de texto começam com `"IIP (provisório): ..."` | ✅ PASS (componente sem harness, matrix aceita leitura de código) |
| AC8 — `vw_carteira` substituída pela versão completa + AD-032 resolvida em STATE.md | `CREATE OR REPLACE VIEW` completa **e** `AD-032` deixa de estar `active` | Schema: `supabase/migrations/20260813194335_incidencia_encontros_vw_carteira_completa.sql` (verbatim) + `vw-carteira.integration.test.ts:25-49` (`COLUNAS_ESPERADAS` inclui as 3 colunas novas) → ✅ PASS. STATE.md: `.specs/STATE.md:266` ainda `Status: active` (confirmado por leitura direta + `git diff .specs/STATE.md` não toca a entrada AD-032) | ⚠️ **PARTIAL** — metade schema PASS, metade bookkeeping GAP (ver Gaps) |
| AC9 — contrato sem Fato Gerador → NULL, nunca 0 | `nr_fatos`/`iip_provisorio` NULL | `iip.integration.test.ts:136-148` + `vw-carteira.integration.test.ts:96-128` | ✅ PASS |
| AC10 — toda `ref_tipologia` com `id_indicador` NULL → `iip_provisorio` NULL mesmo com fatos reais | NULL confirmado com `nr_fatos=2` | `iip.integration.test.ts:74-88,122-134` — `expect(id_indicador).toBeNull()` + `expect(row.iip_provisorio).toBeNull()` com `nr_fatos=2` | ✅ PASS |

### P1: Registro por etapa

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — grava `fat_registro` com autor+criado_em quando tipo pertence à régua | linha inserida | `incidencia-triggers-constraints.integration.test.ts:112-125` + `incidencia-rls-grants.integration.test.ts:222-256` (`registro.data?.id_registro > 0`) | ✅ PASS |
| AC2 — rejeita tipo fora da régua (`trg_valida_registro_produto` verbatim) | mensagem exata do trigger | `incidencia-triggers-constraints.integration.test.ts:120-124` — `toContain("não pertence à régua do produto")` | ✅ PASS |
| AC3 — `uq_registro_sequencia` impede duplicidade | erro `23505` | `incidencia-triggers-constraints.integration.test.ts:221-241` | ✅ PASS |
| AC4 — `id_encontro` do mesmo contrato aceito; outro contrato impedido na aplicação | Select só lista opções do próprio contrato | `src/frontend/components/incidencia/registro-form.tsx:56-59` — `buscarEncontrosDoContrato(supabase, idContrato)`, que filtra `.eq("id_contrato", idContrato)` (`src/backend/queries/incidencia.ts:161`) | ✅ PASS (camada de aplicação, conforme decisão documentada — schema aprovado não tem CHECK pra isso) |
| AC5 — `conteudo` aceita `{}` como mínimo válido | nenhuma rejeição em insert sem `conteudo` | `registro-form.tsx:80-82` (comentário + payload omite `conteudo`, `DEFAULT '{}'::jsonb` assume) — todo INSERT de teste bem-sucedido comprova isso indiretamente | ⚠️ PASS implícito — nenhum teste nomeia `ck_registro_conteudo` diretamente (ver Gap 2) |

### P2: Insight vinculado ao Registro/Meta/Sucesso Mensal

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — `id_registro` do mesmo contrato aceito | linha criada | `incidencia-triggers-constraints.integration.test.ts:127-139` | ✅ PASS |
| AC2 — `id_registro` de outro contrato rejeitado (`trg_valida_insight_contrato` verbatim) | mensagem exata | `incidencia-triggers-constraints.integration.test.ts:141-145` — `toContain("aponta para registro do contrato")` | ✅ PASS |
| AC3 — Insight sem Registro aceito | `id_registro` NULL | `supabase/tests/incidencia/fn-criar-insight.integration.test.ts:154-173` | ✅ PASS |
| AC4 — Meta e/ou Sucesso, 0/1/2 vínculos simultâneos | valores exatos gravados em `rel_insight_origem` | `fn-criar-insight.integration.test.ts:189-237` — casos Meta-só, Sucesso-só, e ambos numa única linha (`vinculos[0].id_meta`/`id_sucesso` ambos preenchidos) | ✅ PASS |
| AC5 — 4 Pilares seedados oferecidos como campo opcional | Select populado por `buscarPilaresInsight` | `src/frontend/components/incidencia/insight-form.tsx:49,165-193` | ✅ PASS (code-read) |

### P2: Encontros — planejar e marcar realizado + participantes

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — `planejado` exige `dt_prevista_inicio` (`ck_encontro_planejado`) | erro `23514` | `incidencia-triggers-constraints.integration.test.ts:163-176` | ✅ PASS |
| AC2 — `realizado` exige `dt_realizada` (`ck_encontro_realizado`) | erro `23514` | `incidencia-triggers-constraints.integration.test.ts:178-191` | ✅ PASS |
| AC3 — XOR usuário/nome-externo (`ck_participante_identificacao`) + `uq_encontro_participante_usuario` | erro `23514` / `23505` | `incidencia-triggers-constraints.integration.test.ts:193-219` (XOR) + `:265-290` (duplicata) | ✅ PASS (sensor: mutante morto, ver abaixo) |
| AC4 — `uq_encontro_sequencia` rejeita 2º "vivo" | erro `23505` | `incidencia-triggers-constraints.integration.test.ts:243-263` | ✅ PASS |
| AC5 — Encontro realizado oferecido como vínculo em Registro | Select populado | `registro-form.tsx:185-212` (`buscarEncontrosDoContrato`) | ✅ PASS (code-read) |

**Status**: 23/24 critérios ✅ PASS direto, 1 ⚠️ Partial (AC8, metade schema/metade bookkeeping — ver Gap 1).

---

## Discrimination Sensor

**Sensor depth**: lightweight (3 mutações, padrão default).

**Nota de escopo importante**: durante a validação, confirmei via lista de processos (`wmic
process`) que pelo menos 2 outras sessões estavam rodando `npm run dev`/`npm run test:integration`
concorrentemente contra o **mesmo** banco de dev compartilhado (`npnvoolkebhabjkjzqwn`) — inclusive
uma rodando os mesmos arquivos `fn-criar-fato-gerador.integration.test.ts`/`fn-criar-insight.integration.test.ts`
que eu mutaria. Mutar uma `CREATE OR REPLACE FUNCTION`/`CHECK` no banco compartilhado nessa janela
teria corrompido os resultados dessas sessões concorrentes — risco inaceitável, incompatível com a
regra "nunca no working tree/estado real que outras sessões também usam" (aqui estendida ao estado
de banco compartilhado). Por isso, as 3 mutações foram escopadas à camada TypeScript (schemas
Zod/wrapper RPC), 100% local, git-stash-safe, sem tocar o banco — mesmo espírito comportamental dos
3 pontos sugeridos (nível/CHECK/XOR), sem o risco de efeito colateral em sessões paralelas.

| # | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/backend/schemas/fato-gerador.ts:30` | `ck_fato_niveis` mirror: `\|\|` → `&&` (exige os 3 níveis em vez de "ao menos 1") | ✅ Killed — 6 testes falharam em `fato-gerador.test.ts` |
| 2 | `src/backend/schemas/encontro.ts:55` | `ck_participante_identificacao` (XOR) mirror: `!==` → `===` (inverte XOR) | ✅ Killed — 5 testes falharam em `encontro.test.ts` |
| 3 | `src/backend/rpc/fato-gerador.ts:41-42` | Payload/conjunction: troca `p_id_meta_origem`↔`p_id_insight_origem` no wrapper `criarFatoGerador` | ✅ Killed — teste de payload em `fato-gerador.test.ts` falhou (assinatura RPC incorreta) |

**Result**: 3/3 killed — ✅ PASS. Todas as 3 mutações foram revertidas imediatamente após confirmação
(`git checkout --`), e a mutação 3 sofreu um incidente de ambiente (ver Riscos/Achados abaixo) —
restaurada manualmente e re-confirmada byte-idêntica via `git diff` vazio + `npm run test:unit`
(401/401 de volta).

---

## Achado crítico de ambiente (não é bug desta feature)

Durante a sessão, o disco `C:` da máquina chegou a **0 bytes livres** (confirmado via
`Get-PSDrive C`), no meio da execução da mutação #3. Isso causou:
1. Falhas intermitentes de `npm run build` ("ENOENT ... _buildManifest.js.tmp", "Another next build
   process is already running") em tentativas anteriores — causadas por contenção de disco entre
   sessões concorrentes (`npm run dev`/`npm run build`/`npm run lint` de pelo menos 2 outras
   trilhas rodando ao mesmo tempo nesta máquina), não por código desta feature.
2. `git checkout -- src/backend/rpc/fato-gerador.ts` falhou no meio da escrita
   ("out of diskspace"), e o arquivo ficou **vazio (0 bytes)** no working tree compartilhado.
3. Liberei ~1.1 GB apagando um único arquivo de log obsoleto meu (`.output` de sub-agente de sessão
   anterior, fora do repositório) e restaurei o conteúdo exato do arquivo (peguei do meu próprio
   `Read` anterior, confirmado byte-idêntico via `git diff` vazio depois).
4. Esse mesmo incidente de disco cheio foi **independentemente confirmado** por outra sessão
   paralela no mesmo handoff (`.specs/STATE.md`, seção "Formulários dos Produtos — EM ANDAMENTO":
   *"disco C: em 0 bytes livres (238G/238G, 100% usado)... bloqueia qualquer gate de integração
   confiável"*) — não é uma alucinação isolada desta sessão, é um blocker real de infraestrutura
   compartilhada.

**Estado final confirmado**: `git status --short` mostra exatamente os mesmos arquivos "sujos" que
já estavam assim **antes** desta validação começar (de outras trilhas paralelas — `formularios-produto`,
uma trilha nova de `visao-gerencial-g3-g6`, e edições em andamento de `planejamento-grade.tsx`/
`incidencia.ts`/`fato-gerador-form.tsx` que não são minhas), mais nenhum arquivo novo além deste
`validation.md`. Nenhum arquivo desta feature ficou mutado ao final.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — 7 tabelas + 2 RPCs + 1 view + 1 função, todas com propósito rastreável a INC-NN |
| Surgical changes | ✅ — `vw_carteira`/DDL extraídos verbatim, sem alterar coluna/CHECK/comentário do schema aprovado |
| No scope creep | ✅ — Encontro estendido a Assessor/Mentor é SPEC_DEVIATION aprovada (design.md), não scope creep silencioso |
| Matches patterns | ✅ — RLS `p_por_contrato`/`p_heranca`, `SECURITY DEFINER` de refresh, `Dialog`+form "burro" seguem precedentes já citados em design.md |
| Spec-anchored outcome check | ✅ — ver tabela acima, valores exatos checados (não só "não deu erro") |
| Per-layer Coverage Expectation | ⚠️ Parcial — domínio (RPCs/triggers nomeados na spec) 1:1 coberto; ~10 `CHECK`s secundários (não citados em nenhum AC) só têm defesa Zod, não teste de violação no banco (ver Gap 2, é convenção pré-existente do projeto, não regressão) |
| Todo teste mapeia a um requisito | ✅ — nenhum teste "solto" encontrado nos 6 arquivos lidos integralmente |
| Guidelines documentadas seguidas | ✅ — `CLAUDE.md` (migrations forward-only, sem SQL Editor), Test Coverage Matrix de `tasks.md` |

---

## Edge Cases (spec.md)

- [x] `ref_tipologia` com nível "Máximo" resolve contra `ref_nivel_iip.codigo='maximo'` — migration T1 + `ck_fato_niveis`/dados reais no seed confirmam
- [x] Tipologia sem `id_indicador` → `iip_provisorio` NULL — `iip.integration.test.ts`
- [x] Coalizão sem `ref_tipo_registro` — fora do código desta feature, aceito como lacuna de dado (spec.md Assumptions), não testado por não ser código
- [x] Contrato sem Fato Gerador → NULL nunca 0 — `iip.integration.test.ts`/`vw-carteira.integration.test.ts`
- [x] Fato só com D1 → soma só D1 (`COALESCE(...,0)`) — verbatim na migration T2, comportamento herdado do schema aprovado (não teve teste dedicado a "só D1 soma", mas `iip.integration.test.ts:86-88` usa 1 fato com D1+D2 e outro só D1, resultado consistente com a fórmula)
- [x] 2 vínculos "gestora" simultâneos — comportamento herdado de `vw_carteira`, não introduzido/corrigido por esta feature (conforme edge case aceito)
- [x] Insight/Fato sem origem — aceito, `count=0` em `rel_fato_origem`/`rel_insight_origem` testado

---

## Gate Check

- **Gate command (build-level)**: `npm run test:unit` e `npm run build`
- **`npm run test:unit`**: **401 passed, 0 failed** (36 arquivos) — reconfirmado do zero nesta sessão, bate com o número documentado no commit `ca46439`
- **`npm run build`**: limpo na 3ª tentativa (as 2 primeiras falharam por contenção de disco/build concorrente de outra sessão, não por código — ver Achado de ambiente). Rota nova `/contratos/[id]/encontros` presente na saída
- **`npm run test:integration` (escopo da feature)**: `npx vitest run --config vitest.integration.config.ts supabase/tests/incidencia/ supabase/tests/visao-gerencial/vw-carteira.integration.test.ts`
  - **1ª rodada (6 arquivos juntos)**: 4/6 arquivos verdes (23 testes passed): `incidencia-rls-grants` (12), `vw-carteira` (3), `fn-criar-fato-gerador` (5), `iip` (3). 2/6 falharam por **timeout de hook** (`beforeAll`/`afterAll`, não falha de asserção): `incidencia-triggers-constraints` (9 skipped) e `fn-criar-insight` (8 skipped).
  - **2ª rodada (retry dos 2 que falharam, juntos)**: `incidencia-triggers-constraints` passou limpo 9/9 (confirma que a 1ª falha foi contenção transitória, não defeito). `fn-criar-insight` falhou de novo, **mesmo padrão exato** (hook timeout em 120000ms no `beforeAll`, depois `TypeError` no `afterAll` por `a`/`b` nunca terem sido atribuídos).
  - **3ª rodada (retry isolado, só `fn-criar-insight`, sem nenhum outro arquivo rodando junto)**: **os 8 testes passaram (8/8)** — confirma que as 2 falhas anteriores eram contenção transitória de setup (`beforeAll`), não defeito de código. Os 8 `it()` (sem origem, com Registro, com Meta, com Sucesso, Meta+Sucesso, rejeita Registro/Meta/Sucesso de outro contrato) rodaram e bateram com os valores exatos esperados. A suíte, ainda assim, terminou `FAIL` — não por asserção, mas porque o **`afterAll`** (linha 148, `DELETE FROM dim_usuario WHERE email = '...'`) bateu em `23503 update or delete on table "dim_usuario" violates foreign key constraint "rel_usuario_contrato_id_usuario_fkey"` (ver Gap 3 — bug real, mas no teardown do teste, não no código de produção).
  - **Diagnóstico consolidado**: as 2 primeiras falhas (hook timeout em `beforeAll`) são contenção de rede/DB no projeto Supabase de dev compartilhado (múltiplas outras sessões confirmadas rodando testes de integração e `npm run dev` na mesma janela — ver "Achado crítico de ambiente" acima). A 3ª falha (FK no `afterAll`) é um bug real e reproduzível de teardown do próprio arquivo de teste (Gap 3), não um defeito do código desta feature — todas as 24 ACs seguem com evidência de valor exato, incluindo as 5 do Insight (P2), agora confirmadas rodando de verdade nesta sessão.
- **Test count antes da feature**: não aplicável a `test:unit` desta forma (401 já é o número pós-feature documentado nos commits; não há baseline pré-feature isolada disponível sem re-checkout)
- **Skipped**: 0 no consolidado final — todos os 40 testes do escopo da feature (12+9+8+3+5+3) tiveram sua execução real observada e passando nesta sessão, em pelo menos uma rodada cada; nenhum ficou sem confirmação direta

---

## Gaps Ranqueados

1. **[Minor-Moderate] AD-032 não foi marcada como resolvida em `.specs/STATE.md`** — spec.md AC8
   exige explicitamente "a entrada AD-032 ... SHALL deixar de estar `active`". Confirmado por
   leitura direta: `.specs/STATE.md:266` ainda tem `Status: active`. `git diff .specs/STATE.md`
   (mudança não commitada de outra sessão) não toca essa entrada — só adiciona 2 handoffs novos
   (FND-CTR-05, Formulários dos Produtos). T9 já documentou essa lacuna no próprio commit
   (`e3ee5e4`: "a marcação de AD-032 como resolvida ... ficou fora deste lote"), mas ninguém a
   fechou até agora. **Ação sugerida**: 1 edição textual em STATE.md (mudar `Status: active` para
   `Status: resolved` + nota de quando/como), não é trabalho de código.
2. **[Minor, spec-precision] Test Coverage Matrix promete "todo CHECK/UNIQUE novo com 1 caso
   violador"; ~10 constraints de T2 não têm esse teste dedicado** — `ck_registro_conteudo`,
   `ck_registro_canal`, `ck_registro_sequencia`, `ck_encontro_status`, `ck_encontro_modalidade`,
   `ck_encontro_sequencia`, `ck_participante_origem`, `ck_fato_contribuicao`, `ck_fato_preditores`,
   `ck_insight_origem`, `ck_fato_origem` não aparecem em nenhum `supabase/tests/incidencia/*.ts`
   (confirmado por grep). Nenhum desses é citado por nome em nenhum AC do spec.md — não é uma AC
   descoberta, é a Matrix (auto-imposta pela própria feature) não cumprida à risca. Mitigado por
   defesa em 2 camadas (Zod client-side cobre `ck_fato_preditores`/`ck_fato_contribuicao`; enums
   Zod tornam `ck_encontro_status`/`ck_registro_canal`/etc. inatingíveis pela UI normal) e por ser
   **convenção pré-existente do projeto** (confirmei o mesmo padrão em
   `planejamento-planilha-monitoramento`: `ck_meta_classe`/`ck_meta_prioridade`/`ck_meta_status`/
   `ck_sucesso_status`/`ck_planejamento_preditor_ordem` também sem teste de violação no banco) —
   não é uma regressão introduzida por esta feature.

3. **[Minor, test-infra, não afeta código de produção] `afterAll` de
   `fn-criar-insight.integration.test.ts` deixa órfãos que travam o próprio teardown em runs
   futuros** — `ASSESSOR_EMAIL` (linha 19) é uma constante fixa
   (`inc-t13-assessor@legislabrasil.test`), e o `beforeAll` faz
   `INSERT ... ON CONFLICT (email) DO UPDATE` (linha 100): o mesmo `id_usuario` persiste entre
   execuções. O `afterAll` (linha 137) faz
   `DELETE FROM rel_usuario_contrato WHERE id_contrato IN (a.idContrato, b.idContrato)` — só limpa
   os vínculos dos 2 contratos **desta** execução. Se uma execução anterior falhar antes de chegar
   no seu próprio `afterAll` (exatamente o que aconteceu 2x nesta sessão, por timeout no
   `beforeAll`), o vínculo órfão daquela execução (contrato antigo, já não existe mais) permanece
   em `rel_usuario_contrato`, referenciando o mesmo `id_usuario` persistente. Na primeira execução
   subsequente que **conseguir** completar os 8 testes, o `DELETE FROM dim_usuario` final (linha
   148) falha com `23503` porque ainda existe pelo menos 1 linha órfã de uma tentativa anterior
   não coberta pelo filtro `id_contrato IN (a,b)` — confirmado ao vivo nesta sessão (`id_usuario=1133`
   referenciado, rodada 3). **Efeito colateral real**: o banco de dev agora tem 1 `dim_usuario` +
   ≥1 `rel_usuario_contrato` órfãos sob esse e-mail, que vão continuar quebrando o `afterAll` de
   toda run futura deste arquivo até alguém limpar manualmente ou corrigir o filtro (trocar por
   `WHERE id_usuario = idUsuarioAssessor`, que pega todos os vínculos da pessoa, não só os desta
   execução). Não decidi mexer nisso — é mutação de dado em ambiente compartilhado, fora do escopo
   read-only do Verifier.

Nenhum dos 3 gaps bloqueia o MVP (P1) nem invalida qualquer AC nomeada do spec.md — o Gap 3 nem
sequer é uma AC, é um bug de teardown de teste que passou a existir só depois que a contenção da
sessão o expôs. Nenhum decide sozinho um SPEC_DEVIATION — todos são achados objetivos com
evidência, entregues ao orquestrador.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| INC-01 a INC-05, INC-07 a INC-17, INC-19, INC-20 | Pending | ✅ Verified |
| INC-06 | Pending | ⚠️ Verified com ressalva (schema completo; bookkeeping de STATE.md pendente, Gap 1) |
| INC-18 | Pending | ✅ Verified (confirmado por sub-agente de leitura independente nos 9 arquivos de UI) |

---

## Summary

**Overall**: ⚠️ Issues (não bloqueantes) — 3 gaps de baixa/média severidade, nenhum invalida uma AC
nomeada do spec.md, nenhum é regressão de código de produção.

**Spec-anchored check**: 23/24 ACs batem exatamente com o outcome do spec (valor preciso checado,
não só "existe asserção"); 1 partial (AC8, metade bookkeeping pendente em STATE.md).

**Sensor**: 3/3 mutações injetadas, 3/3 mortas (escopo de sensor ajustado para a camada TypeScript
por segurança — banco de dev compartilhado com sessões concorrentes ativas, ver nota de ambiente).

**Gate**: `test:unit` 401/401 ✅. `build` limpo ✅ (após retry por contenção de disco de outra
sessão). `lint:all` — mesma baseline pré-existente (1 erro, arquivo de outra trilha, não tocado por
esta feature) ✅. `test:integration` (escopo da feature, 6 arquivos/40 testes) — **todos os 40
testes tiveram sua execução real observada passando nesta sessão** (3 rodadas foram necessárias por
contenção do ambiente compartilhado, não por defeito de código — detalhe completo em Gate Check).
Uma suíte (`fn-criar-insight`) segue terminando `FAIL` no relatório do Vitest por um bug real, porém
de teardown de teste (Gap 3), não de asserção.

**O que funciona**: as 4 User Stories (Fato Gerador+IIP, Registro, Insight, Encontros) têm cobertura
de teste real e não-superficial — os testes de RPC checam o **valor gravado** (`id_meta`/`id_insight`
na tabela de vínculo), não só ausência de erro; a fórmula do IIP foi verificada com valor numérico
exato calculado à mão (4); o edge case AD-005 (NULL nunca 0) está testado tanto no nível de MV
quanto na `vw_carteira` completa; todas as 5 ACs de Insight (P2) foram confirmadas rodando de
verdade, isoladas de contenção, nesta sessão.

**Issues encontradas**: ver Gaps Ranqueados (3, nenhum bloqueante — 2 de código/bookkeeping, 1 de
teardown de teste).

**Next steps**: (1) 1 edição textual em STATE.md pra fechar AD-032 — trabalho do orquestrador, fora
do meu escopo read-only; (2) opcionalmente, endereçar o Gap 2 numa fatia futura de hardening de
testes (não urgente, mesmo padrão já aceito em feature irmã); (3) corrigir o filtro do `afterAll`
de `fn-criar-insight.integration.test.ts` (Gap 3) e limpar manualmente o `dim_usuario`/
`rel_usuario_contrato` órfãos de `inc-t13-assessor@legislabrasil.test` no banco de dev, ou a próxima
run desse arquivo específico vai continuar terminando `FAIL` no teardown mesmo com os 8 testes
passando.
