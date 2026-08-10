# Cadastro de Mandato e Contrato Unificado — Validation

**Date**: 2026-08-10
**Spec**: `.specs/features/cadastro-mandato-contrato-unificado/spec.md`
**Diff range (CMU-15/16/04/14-AC5 only)**: `c8a2e25..d4dba31` (`c8a2e25`, `a39e500`, `487dc7d`, `d4dba31` — interleaved with unrelated commits from `plataforma-ui-tanstack`/`catalogos-referencia`, ignored)
**CMU-01..14**: no isolated diff exists (implemented across prior sessions) — evaluated against HEAD (`387481a`)
**Verifier**: independent sub-agent (author ≠ verifier) — first formal Validate pass for this feature

**Fix Round 1** (2026-08-10, commit `7abb6b0`): closes Gaps #1/#2/#3 below (backend test coverage for `app.criar_mandato`'s `p_contrato`/`p_coalizao`/`p_id_contratante_existente` path, and the 2 surviving sensor mutants). Re-verified independently by this same Verifier — see "Fix Round 1 — Re-verification" note inside each affected section. Gap #4 (CMU-05 spec-precision) and the UI-test-infrastructure convention note (#6) were explicitly **not** part of this fix round and remain unchanged, pending a product decision by Pedro.

---

## Task Completion

No `tasks.md` exists for this feature (CMU-01..14 shipped without a formal Tasks phase; CMU-15/16/04/14-AC5 went straight from Design/spec-fix to Execute in this session). Task-level status is therefore N/A — completion is judged directly against the 16 requirements' Acceptance Criteria below.

---

## Spec-Anchored Acceptance Criteria

### P1: Reaproveitar mandato existente (CMU-01..04)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: seleciona candidatura TSE com título já em `dim_mandato` | pula criação do mandato, mostra aviso com nome/dados básicos, vai direto para etapa de contrato do `id_contratante` existente | `mandato-wizard.tsx:180-181` (`iniciarRevisao` chama `checkExistente` antes de montar o passo "revisar"); `mandato-wizard.tsx:156-178` (`checkExistente` seta `passo:"existente"` com o resumo); `mandato-wizard.tsx:384-393` (Alert "Mandato já cadastrado"); `mandato-wizard.tsx:397,725` (ficha do mandato escondida, bloco de contrato sempre renderizado) | ✅ Code-verified (UI, sem teste automatizado — convenção do projeto) |
| AC2: digita manualmente um título já existente | mesmo comportamento do AC1, sem deixar o formulário chegar a um `INSERT` | `mandato-wizard.tsx:254-260` (`submeter`: se `passo.tipo==="manual"` e não `ignorarDuplicata`, chama `checkExistente` e retorna antes de chamar `criarMandato`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC3: confirma contrato p/ mandato existente | cria só `fat_contrato` (+ `rel_coalizao_membro` se selecionado) — nenhuma linha nova em `dim_contratante`/`dim_mandato`/`rel_mandato_candidatura` | `0022_cadastro_mandato_contrato_unificado.sql:48-50` (branch `IF p_id_contratante_existente IS NOT NULL` só faz `SELECT`, nunca `INSERT` nas 3 tabelas) vs `:117-137` (bloco de contrato/coalizão roda incondicionalmente). **Fix Round 1**: `fn-criar-mandato.integration.test.ts` — teste `"CMU-01/02: opens a second fat_contrato for an existing mandato via p_id_contratante_existente..."` chama a RPC 2x com o mesmo `p_id_contratante_existente`, asserta `segundo.data.id_contratante === primeiro.data.id_contratante` e `segundo.data.id_mandato === primeiro.data.id_mandato` (prova que nenhuma linha nova de `dim_contratante`/`dim_mandato` foi criada — um bug que ignorasse `p_id_contratante_existente` teria retornado ids novos), mais `SELECT count(*) FROM dim_mandato WHERE id_contratante=...` = 1 e `fat_contrato` da conta = 1 linha (a nova) | ✅ **PASS** — Gap #1 fechado, evidência re-lida e confirmada (ver seção Sensor) |
| AC4: título nulo/vazio | segue fluxo normal de mandato novo, sem checagem de duplicidade | `mandato-wizard.tsx:157` (`checkExistente` retorna `false` sem consultar o banco quando `!nrTituloEleitoral \|\| trim().length===0`); `mandato.ts` schema `nr_titulo_eleitoral` é `.nullable().optional()` (`schemas/mandato.ts:14-18`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC5: `INSERT` colide com `dim_mandato_nr_titulo_eleitoral_key` apesar da checagem prévia (condição de corrida) | mensagem amigável já mapeada + ação "ver mandato existente / abrir contrato para ele" | `errors.ts:70` (mapeia a constraint para "Já existe um mandato cadastrado com este título eleitoral."); `mandato-wizard.tsx:296-302` (`catch` reconhece `ViolacaoUnicaError` com esse `constraint`, guarda `duplicataTitulo`); `mandato-wizard.tsx:896-907` (botão "Ver mandato existente / abrir contrato para ele" chama `checkExistente(duplicataTitulo)`, reaproveitando o mesmo caminho do passo "existente"). **Fix Round 1**: `mandato.test.ts` — teste `"23505: lança ViolacaoUnicaError com a mensagem de dim_mandato_nr_titulo_eleitoral_key"` asserta `erro.constraint === "dim_mandato_nr_titulo_eleitoral_key"` **e** `erro.message === "Já existe um mandato cadastrado com este título eleitoral."` (valor exato, não só tipo) | ⚠️ UI: Code-verified (sem teste, convenção do projeto). Backend (`errors.ts` mapping): ✅ **PASS** — Gap #2 fechado, mutação reaplicada e morta de novo por este Verifier (ver seção Sensor) |

### P1: Wizard único (CMU-05..07)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1/AC2: etapa de contrato com Produto/Projeto/Coalizão, "mesmos campos e mesmas regras de `contratoSchema`" | Produto obrigatório, Projeto opcional, Data de início obrigatória, papel/nome_grupo espelhando `ck_membro_papel`/`ck_membro_grupo` quando coalizão selecionada | `mandato-wizard.tsx:725-871` (bloco "Abertura de Contrato" + Coalizão); `mandato-wizard.tsx:30-51` (`coalizaoSchema` local com `superRefine` cobrindo papel/nome_grupo) | ⚠️ **Spec-precision gap**: os *campos* batem, mas a letra do AC exige reuso de `contratoSchema` (`schemas/contrato.ts:9-43`) — o wizard usa um `z.object` local próprio (`mandato-wizard.tsx:56-60`: `id_produto`/`id_projeto`/`dt_inicio`, sem `status`/`ck_contrato_*`), nunca importa `contratoSchema`. Mesmo padrão de duplicação em `coalizaoSchema` local (linhas 30-51) em vez de `membroCoalizaoSchema` (`schemas/coalizao.ts:20-38`). Funcionalmente equivalente para os 3 campos em jogo, mas não é o mesmo objeto de validação — risco de drift se `ck_contrato_*`/`ck_membro_*` mudar |
| AC3/AC5: persistência atômica, sem escrita parcial | uma única operação transacional cobre mandato (quando novo) + contrato + vínculo de coalizão; falha no meio não deixa escrita parcial | `0022...sql:27-146` (`app.criar_mandato` é uma única função PL/pgSQL — uma chamada RPC é uma transação implícita do Postgres; sem `SAVEPOINT`/sub-transação que quebre esse isolamento); `mandato.ts:43-66` (único ponto de chamada). **Fix Round 1**: `fn-criar-mandato.integration.test.ts` — teste `"CMU-05/06: creates fat_contrato together with a new mandato in the same call (p_contrato)"` prova o caso "mandato novo + contrato" numa única chamada (`SELECT` em `fat_contrato` com `id_contratante`/`id_produto`/`status='ativo'` corretos); teste `"CMU-05: creates rel_coalizao_membro together with fat_contrato when p_coalizao is given"` prova mandato+contrato+coalizão numa única chamada (`SELECT` em `rel_coalizao_membro` com `id_coalizao`/`papel` corretos); teste `"CMU-05/06 AC5: rolls back the whole call (no dim_contratante left) when p_coalizao references a non-existent id_coalizao"` chama a RPC com um `id_coalizao` inexistente (FK inválida) e asserta `SELECT count(*) FROM dim_contratante WHERE nome='...'` = **0** — prova direta de rollback total (não é só "ausência de erro": é uma contagem de linha específica) | ✅ **PASS** — Gap #1 fechado, evidência de rollback é uma asserção de contagem, não apenas absence-of-error |
| AC4: navega pro detalhe do mandato ao concluir | `router.push('/mandatos/{idMandato}')`, inclusive no ramo de mandato existente | `mandato-wizard.tsx:292`; `0022...sql:48-50` (resolve `v_id_mandato` por `SELECT` mesmo no ramo existente, então o id retornado não é nulo). **Fix Round 1**: o mesmo teste `"CMU-01/02: opens a second fat_contrato..."` citado no AC3 acima asserta `segundo.data.id_mandato === primeiro.data.id_mandato` (não nulo) no ramo `p_id_contratante_existente` — cobre o lado backend desta AC (o lado UI/`router.push` continua code-verified sem teste) | ✅ Code-verified (UI) + ✅ PASS (backend, Fix Round 1) |

### P1: Combobox TSE (CMU-08..10)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: ≥3 caracteres → `buscarCandidaturas` com debounce, popover Command/Popover, colunas nome urna/UF/partido/ano | consulta com debounce, sem 1 req/tecla | `tse-match-search.tsx:36` (`useDebounce(nome, 500)`); `:45-72` (efeito só dispara com `debouncedNome`); `:82-138` (`Popover`/`Command` com colunas nmUrna/sgUf/sgPartido/anoEleicao + badge de confiança) | ✅ Code-verified (UI, sem teste automatizado) |
| AC2: seleção preenche a etapa seguinte igual ao "Selecionar" de antes | mesmo `onSelecionar`/`CandidaturaSugerida` | `tse-match-search.tsx:74-77` (`selecionar` chama `onSelecionar` com a mesma forma de `CandidaturaSugerida`); consumido por `mandato-wizard.tsx:328` (`onSelecionar={iniciarRevisao}`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC3: busca vazia → `modoManual` | libera cadastro manual com `metodoMatch:"manual"` | `tse-match-search.tsx:63` (`if (resultado.length===0) setModoManual(true)`); `:75` (`metodoMatch: "manual"` quando `modoManual`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC4: UF/ano opcionais, sem exigir preenchimento antes do nome | filtros continuam refinando sem bloquear a digitação do nome | `tse-match-search.tsx:139-152` (`Input` de UF/ano sempre visíveis, independentes do combobox) | ✅ Code-verified (UI, sem teste automatizado) |
| AC5: falha de rede | mensagem de erro genérica no combobox, sem quebrar o wizard | `tse-match-search.tsx:52-68` (`try/catch` em torno de `buscarCandidaturas`, `setErro` genérico); `:103` (renderizado dentro do próprio `CommandList`) | ✅ Code-verified (UI, sem teste automatizado). Backend: `buscarCandidaturas` **tem** teste real relançando erro (`tse.test.ts:117-120` — `rejects.toEqual({message:"boom"})`), então a origem do catch é coberta por teste; só o tratamento visual no combobox não é |

### P1: Título eleitoral travado (CMU-11)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1/AC3: origem TSE → somente leitura, com indicação visual | `readOnly` + estilo diferenciado + texto "vindo do TSE" | `mandato-wizard.tsx:428` (`readOnly={passo.tipo==="revisar"}`); `:429` (`className` com `bg-muted/50 cursor-default`); `:432` (`"Vindo do TSE"` só quando `passo.tipo==="revisar"`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC2: origem manual → editável, mesma validação de 12 dígitos | campo editável, `ck_mandato_titulo`/`mandatoSchema` | `mandato-wizard.tsx:428` (`readOnly` é `false` quando `passo.tipo!=="revisar"`); `schemas/mandato.ts:14-18` (`regex(/^\d{12}$/)`, testado em `mandato.test.ts`) | ✅ PASS — regra Zod tem teste real (`schemas/mandato.test.ts`, não lido linha-a-linha aqui mas gate confirma 10/10 passando) |

### P1: Base TSE restrita ao Legislativo (CMU-12..14)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: `DELETE` das 3 tabelas TSE fora do Legislativo, chave de cargo confirmada contra dado real antes do `DELETE` | só restam Vereador/Dep.Estadual/Dep.Federal/Senador | `0022...sql:6-18` (`cd_cargo NOT IN (5,6,7,13)`); códigos consistentes com o seed `ref_cargo` (`0007_catalogos_fundacao.sql:73-80`: Senador=5, Dep.Federal=6, Dep.Estadual=7, Vereador=13) | ⚠️ Débito aceito — a migration **não** documenta o `SELECT DISTINCT cd_cargo, ds_cargo FROM tse.dim_candidatura` exigido pelo próprio spec antes do `DELETE` (já apontado na auditoria anterior, Q3, resolvido como débito histórico aceito via **AD-031**, não revertido). Não é um achado novo desta sessão |
| AC2: refresh das MVs | `tse.mv_candidatura_resumo`/`tse.mv_perfil_eleitorado_candidatura` recriadas | `0022...sql:21-22` | ✅ PASS (leitura direta do SQL) |
| AC3: vínculo `rel_mandato_candidatura` confirmado apontando pra cargo removido → reportar antes de apagar | nunca apagar silenciosamente vínculo já confirmado | `0022...sql:11-15` — **apagou direto**, sem relatório prévio (comentário do próprio SQL: "we know there's one for Prefeito") | ❌ Divergência real, já ocorrida, **aceita como débito histórico via AD-031** (Pedro confirmou 2026-08-10 que Executivo está fora de escopo; dado já apagado não é restaurado). Mantida como ❌ na letra do AC, mas não bloqueante — decisão de produto já tomada |
| AC4: busca já sai filtrada da origem | `buscarCandidaturas` sem filtro adicional de cargo | `queries/tse.ts:110-140` — nenhum filtro de cargo hardcoded; depende só do dado remanescente em `mv_candidatura_resumo` | ✅ PASS — coberto indiretamente pelos testes de `tse.test.ts` (a função nunca filtra por cargo, então o comportamento é "o que a origem já filtrar") |
| AC5: carga futura do TSE só importa Legislativo, decisão documentada | ETL futuro não reintroduz Executivo; decisão registrada como AD | `carga_amostral.js:152-166,184-185` (`CARGOS_LEGISLATIVO=['5','6','7','13']`, `isCargoLegislativo`, aplicado a `consulta_cand`→`dim_candidatura` e `votacao_candidato_munzona`→`fat_votacao_zona`); `dicionario_de_dados_tse.md:84-145` confirma que `perfil_eleitorado` não tem `CD_CARGO` (justifica não filtrar essa carga, mesmo escopo da migration 0022); **AD-031** em `STATE.md:252-258` documenta a decisão e o trade-off | ✅ PASS — corrigido nesta sessão (commit `d4dba31`). **Caveat não bloqueante**: `public.carrega_tse` (`0027_carrega_tse.sql:27-45`) é a função genérica de insert chamada pelo loader e continua sem filtro de cargo — a defesa existe só no script cliente (`carga_amostral.js`), não como `CHECK`/trigger no banco; a própria migration 0027 já documenta que essa função é `SECURITY DEFINER` exposta a `anon`/`authenticated` via REST como "decisão em aberto" separada (linhas 19-24), fora do escopo desta feature |

### P2: Coalizão abre contrato próprio (CMU-15)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: ação "Novo contrato" em `/coalizoes/[id]` abre `ContratoForm` modo `abrir` com `idContratante` = coalizão | mesmo formulário do mandato, agnóstico de tipo de contratante | `coalizoes/[id]/page.tsx:180-193` (botão + `<ContratoForm idContratante={coalizao.id_contratante} .../>`); `contrato-form.tsx:30-41` (`ContratoFormProps.idContratante: number`, sem qualquer branch por tipo de contratante) | ✅ Code-verified (UI, sem teste automatizado) |
| AC2: contrato aberto aparece listado na tela da coalizão | seção "Contratos da coalizão" reflete o novo `fat_contrato` | `coalizoes/[id]/page.tsx:85-90` (query `contratosProprios` por `id_contratante` da coalizão); `:194-215` (tabela renderizada); `onConcluido` chama `void carregar()` (`:189-192`) | ✅ Code-verified (UI, sem teste automatizado) |
| AC3: "Contrato anterior" só lista contratos da própria coalizão | nunca contratos de mandato | `coalizoes/[id]/page.tsx:187` (`contratosExistentes={contratosProprios}`, já filtrado por `eq("id_contratante", coalizaoData.id_contratante)` em `:85-90`); `contrato-form.tsx:192-198` (`SelectContent` usa exatamente `contratosExistentes` recebido, sem query própria) | ✅ Code-verified (UI, sem teste automatizado) |

### P2: Corrigir seletor de membro — FND-COL-03 (CMU-16)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: seletor "Contrato do mandato" só lista `tipo_contratante='mandato'` | nunca lista contratos de `tipo_contratante='coalizao'` | `coalizoes/[id]/page.tsx:96-101` (`select("*, dim_contratante!inner(tipo_contratante)").eq("dim_contratante.tipo_contratante","mandato")`); `:272` (`SelectContent` do "Adicionar membro" usa `contratosMandato`, não mais o antigo `contratos` genérico) | ✅ Code-verified (UI, sem teste automatizado) — embed `!inner` filtra no banco, não no cliente; risco residual (RLS/PostgREST embutido mal configurado) mitigado pela mesma técnica já usada em `queries/mandato.ts:17` |

**Status (após Fix Round 1)**: ✅ Gaps de cobertura de teste backend (#1/#2/#3) fechados e reverificados de forma independente. Restam: 1 spec-precision gap não corrigido por decisão explícita do coordenador (CMU-05 AC1/AC2 — reuso de schema não literal, deferido a Pedro) e 1 divergência histórica já aceita (CMU-13, AD-031, não revertida). Nenhum AC tem hoje uma lacuna de teste de backend sem explicação.

---

## Discrimination Sensor

Sensor rodou em cópia de trabalho real, restaurada via `git diff --stat` (vazio) + reexecução do gate após cada reversão — nunca `git stash` (árvore já estava limpa nos 2 arquivos tocados). Alvo: único código desta feature com teste automatizado real (`src/backend/rpc/errors.ts`, `src/backend/rpc/mandato.ts`), por instrução explícita da tarefa.

| # | File:line | Mutação | Testes relevantes | Resultado |
| - | --------- | ------- | ------------------ | --------- |
| 1 | `src/backend/rpc/errors.ts:70` | `MENSAGENS_UNICA["dim_mandato_nr_titulo_eleitoral_key"]` trocado para `"MUTATED_WRONG_MESSAGE"` | `npm run test:unit` (91 testes) | ❌ **Sobreviveu** — 91/91 continuam passando. Nenhum teste asserta a mensagem exata desta constraint específica (só `uq_mandato_candidatura`, `uq_mandato_candidatura_vigente`, `uq_vinculo` têm asserção própria) |
| 2 | `src/backend/rpc/errors.ts:94` | `if (error.code === "23505")` → `if (error.code === "99999")` | `npm run test:unit` | ✅ **Morto** — 4 testes falharam (`mandato.test.ts`, `vinculo.test.ts`) como esperado — o branch genérico 23505 tem cobertura real |
| 3 | `src/backend/rpc/mandato.ts` (linha do `rpc()`, campo `p_id_contratante_existente`) | `p_id_contratante_existente: input.idContratanteExistente ?? null` → `p_id_contratante_existente: null` (remove o passthrough) | `npm run test:unit` | ❌ **Sobreviveu** — 91/91 continuam passando. Nenhum teste chama `criarMandato` com `idContratanteExistente` preenchido nem verifica o parâmetro `p_id_contratante_existente` |

Todas as 3 mutações foram revertidas após a rodada (confirmado por `git diff --stat` vazio para os 2 arquivos e gate voltando a 91/91 limpo).

**Sensor depth**: lightweight (3 mutações, conforme instrução da tarefa — não é P0/pagamento)
**Result (rodada original)**: 1/3 killed, 2/3 survived — ❌ FAIL no sensor (2 mutantes sobreviventes reais)

### Fix Round 1 — Re-verification (2026-08-10, commit `7abb6b0`)

O autor do Fix Round 1 adicionou 1 teste em `mandato.test.ts` para cada mutante sobrevivente (mensagem de `dim_mandato_nr_titulo_eleitoral_key`; passthrough de `idContratanteExistente`) e relatou os dois mortos. Este Verifier **reaplicou as 2 mutações de forma independente**, sem reaproveitar o relato do autor:

| # | File:line | Mutação reaplicada | Gate | Resultado (reverificação independente) |
| - | --------- | ------------------- | ---- | ---------------------------------------- |
| 1 | `src/backend/rpc/errors.ts:70` | `MENSAGENS_UNICA["dim_mandato_nr_titulo_eleitoral_key"]` → `"MUTATED_WRONG_MESSAGE"` | `npm run test:unit` (93 testes) | ✅ **Morto** — exatamente 1 falha: `mandato.test.ts > criarMandato > 23505: lança ViolacaoUnicaError com a mensagem de dim_mandato_nr_titulo_eleitoral_key` (92 passed, 1 failed). Os outros 92 continuam verdes |
| 3 | `src/backend/rpc/mandato.ts` (`p_id_contratante_existente: input.idContratanteExistente ?? null` → `p_id_contratante_existente: null`) | idem | `npm run test:unit` | ✅ **Morto** — exatamente 1 falha: `mandato.test.ts > criarMandato > CMU-01/02: repassa idContratanteExistente como p_id_contratante_existente` (asserção `toMatchObject` mostra `p_id_contratante_existente: null` recebido vs `9` esperado). Os outros 92 continuam verdes |

Ambas as mutações foram revertidas após a confirmação (`git diff --stat` vazio para `errors.ts`/`mandato.ts`, gate de volta a 93/93 limpo). Mutação #2 (flip do código `23505`→`99999`, `errors.ts:94`) não foi reaplicada nesta rodada — já havia sido morta na rodada original e nenhuma mudança de código a afetaria.

**Sensor depth**: lightweight (3 mutações no total ao longo das 2 rodadas)
**Result (após Fix Round 1)**: **3/3 killed**, 0 sobreviventes — ✅ **PASS** no sensor

---

## Interactive UAT

Não realizado nesta sessão — fora do pedido do orquestrador (escopo era Verify automatizado + sensor, não UAT interativo com o usuário). Edge case do spec.md ("Select de Cargo/Partido/Produto/Projeto não carrega") também não foi reproduzido em navegador — exigiria sessão de app rodando, não tentado por este Verifier (read-only, sem instrução explícita para tal).

---

## Code Quality

| Principle | Status | Nota |
| --- | --- | --- |
| Minimum code | ✅ | CMU-15/16/04/14-AC5 tocam só os arquivos necessários, sem refactor colateral |
| Surgical changes | ✅ | Cada commit desta sessão isola exatamente 1 requisito |
| No scope creep | ✅ | Nenhum dos 4 commits desta sessão adiciona funcionalidade não pedida |
| Matches existing patterns | ⚠️ | CMU-05/CMU-15's "Vinculação à Coalizão" no wizard duplica regras (`superRefine` local) em vez de reusar `contratoSchema`/`membroCoalizaoSchema` já existentes — ver spec-precision gap acima. CMU-15/16 (`coalizoes/[id]/page.tsx`), em contraste, reusa `ContratoForm`/`mapeiaErroRpc` sem duplicação, exatamente como o design.md pedia |
| Spec-anchored outcome check | ⚠️ | Ver tabela acima — 1 spec-precision gap (CMU-05 AC1/AC2), 1 divergência histórica aceita (CMU-13) |
| Per-layer Coverage Expectation | ✅ (Fix Round 1) | Domínio (Postgres `app.criar_mandato`, path novo de `p_contrato`/`p_coalizao`/`p_id_contratante_existente`) agora tem 4 casos de integration test dedicados (`fn-criar-mandato.integration.test.ts`, describe `"p_contrato / p_coalizao / p_id_contratante_existente (CMU-01/02/05/06/07)"`), cobrindo mandato novo+contrato, mandato existente+segundo contrato, contrato+coalizão, e rollback total. Wrapper TS (`mandato.ts`) ganhou 1 teste dedicado ao passthrough de `idContratanteExistente`. Único item ainda sem teste dedicado: a variação `papel="grupo_trabalho"` com `nome_grupo` dentro de `p_coalizao` (não testada nem antes nem depois — fora do escopo do Fix Round 1, que visava só os 3 gaps rankeados) |
| Every test maps to a spec requirement | ✅ | Os 91 testes existentes mapeiam para Done-when de tasks anteriores (T18-T28), nenhum teste órfão encontrado |
| Documented guidelines followed | ✅ | `vitest.config.ts:6` confirma `src/backend/**/*.test.ts` como único runner real; CLAUDE.md/AGENTS.md seguidos |

---

## Edge Cases (spec.md)

- [x] Título nulo → mandato novo, sem checagem — `mandato-wizard.tsx:157` (code-verified, sem teste)
- [ ] Select de Cargo/Partido/Produto/Projeto sem opções → **não reproduzido em navegador nesta sessão** (exige app rodando; fora do escopo desta rodada de Verify)
- [~] Vínculo TSE confirmado fora do Legislativo → reportar antes de apagar — **não seguido** no passado (`0022...sql:11-15`), aceito como débito histórico via AD-031, não corrigido retroativamente (dado já apagado)
- [x] Falha no meio do envio final → sem escrita parcial — garantido pela semântica de transação do Postgres (uma função = uma transação implícita); **Fix Round 1** acrescentou teste automatizado direto (`fn-criar-mandato.integration.test.ts`, caso de rollback com `id_coalizao` inexistente, `SELECT count(*) FROM dim_contratante` = 0)
- [x] Cancelar após TSE mas antes de enviar → nada escrito — `rejeitarERebuscar()` (`mandato-wizard.tsx:241-245`) só reseta state local, nenhum `insert`/`rpc` é chamado fora de `submeter`
- [x] Coalizão em branco → contrato sem `rel_coalizao_membro` — `mandato-wizard.tsx:283-287` (`coalizao: ... ? {...} : null`) + `0022...sql:128` (`IF p_coalizao IS NOT NULL`)

---

## Gate Check

- **Gate command**: `npm run test:unit` (único test runner automatizado real do projeto — confirmado por `vitest.config.ts:6`, que restringe a `src/backend/**/*.test.ts`; não há teste de componente React em nenhuma feature deste projeto, convenção preexistente)
- **Result (rodada original)**: 91 passed, 0 failed, 0 skipped (10 arquivos de teste)
- **Result (após Fix Round 1, `7abb6b0`, reconfirmado por este Verifier)**: **93 passed, 0 failed, 0 skipped** (10 arquivos de teste — os 2 testes novos entraram em `src/backend/rpc/mandato.test.ts`, que já existia)
- **Test count before feature**: não determinável com precisão (CMU-01..14 não têm diff isolado)
- **Test count after feature (pré-Fix Round 1)**: 91
- **Test count after Fix Round 1**: 93
- **Delta (Fix Round 1)**: +2 unit tests (`mandato.test.ts`) — mensagem de `dim_mandato_nr_titulo_eleitoral_key` e passthrough de `idContratanteExistente`. **Fora do gate `test:unit`**: +4 integration tests em `fn-criar-mandato.integration.test.ts` (não contados no gate desta seção porque `test:integration` bate no Supabase de dev real, fora do escopo deste Verifier rodar; execução e limpeza reportadas pelo autor do Fix Round 1 — 9/9 passou — e a correção das asserções desses 4 testes foi confirmada por leitura independente deste Verifier, não por reexecução)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Gaps (ranqueados)

1. **[Gap #1 — CLOSED em Fix Round 1, `7abb6b0`]** ~~O path novo de `app.criar_mandato`... não tem nenhum teste automatizado~~. `fn-criar-mandato.integration.test.ts` ganhou 4 casos dedicados (describe `"p_contrato / p_coalizao / p_id_contratante_existente (CMU-01/02/05/06/07)"`) com asserções de valor/contagem (não só ausência de erro) — reconfirmado por leitura independente deste Verifier, ver tabelas acima.
2. **[Gap #2 — CLOSED em Fix Round 1, `7abb6b0`]** ~~Mutante sobrevivente #1: mensagem de `dim_mandato_nr_titulo_eleitoral_key` sem asserção própria~~. `mandato.test.ts` ganhou o teste dedicado; mutação reaplicada de forma independente por este Verifier e confirmada morta (ver seção Sensor).
3. **[Gap #3 — CLOSED em Fix Round 1, `7abb6b0`]** ~~Mutante sobrevivente #2: passthrough de `idContratanteExistente` sem asserção própria~~. `mandato.test.ts` ganhou o teste dedicado; mutação reaplicada de forma independente por este Verifier e confirmada morta (ver seção Sensor).
4. **[Spec-precision gap — inalterado, fora do escopo do Fix Round 1 por decisão explícita do coordenador]** CMU-05 AC1/AC2: a letra do AC pede reuso de `contratoSchema`, mas `mandato-wizard.tsx:56-60` define um `z.object` local próprio (sem `status`/`ck_contrato_*`); mesma duplicação para a regra de coalizão (`coalizaoSchema` local, linhas 30-51, em vez de `membroCoalizaoSchema`). Funcionalmente equivalente para os 3-4 campos em jogo hoje, mas os dois objetos podem divergir silenciosamente se as regras de `ck_contrato_*`/`ck_membro_*` mudarem no schema compartilhado. Fica como decisão de produto para Pedro (aceitar como está ou abrir task de refactor).
5. **[Débito histórico, já aceito — não é achado novo, inalterado]** CMU-13 (exclusão silenciosa de vínculo TSE confirmado, `0022...sql:11-15`) e a lacuna de verificação `SELECT DISTINCT` do CMU-12 continuam como estavam — ambos já decididos como débito aceito via **AD-031** (2026-08-10), não revertidos e não bloqueantes.
6. **[Convenção preexistente do projeto, não uma lacuna desta feature — inalterado, fora do escopo do Fix Round 1 por decisão explícita do coordenador]** Zero componente React de UI tem teste automatizado em qualquer feature deste projeto (`vitest.config.ts:6` restringe a `src/backend/**`). Todas as ACs de comportamento de UI marcadas "Code-verified" acima dependem só de leitura de código — não há harness (jsdom/testing-library) configurado. Isto é visível e explícito aqui, não é um FAIL da feature.

---

## Requirement Traceability Update

| Requirement | Previous Status (spec.md) | New Status |
| --- | --- | --- |
| CMU-01 | Implement (auditoria de código) | ✅ Verified — AC1/2/4 code-verified (UI); AC3 e AC5 (backend) agora com teste dedicado e sensor confirmando (Gaps #1/#2 fechados, Fix Round 1) |
| CMU-02 | Implement | ✅ Verified — path `p_id_contratante_existente` agora com teste de integração dedicado (Gap #1 fechado) |
| CMU-03 | Implement | ✅ Verified (code-verified, UI) |
| CMU-04 | Implement (parcial → corrigido nesta sessão) | ✅ Verified — ação agora existe (`mandato-wizard.tsx:896-907`); mensagem subjacente agora com teste dedicado e mutante confirmado morto (Gap #2 fechado, Fix Round 1) |
| CMU-05 | Implement | ⚠️ Verified com spec-precision gap **inalterado** (fora do escopo do Fix Round 1) — campos corretos, "mesmas regras de contratoSchema" não é reuso literal; atomicidade (AC3/AC5) agora com teste dedicado (Gap #1 fechado) |
| CMU-06 | Implement | ✅ Verified — atomicidade e rollback agora com teste de integração dedicado, incluindo asserção de contagem no caso de falha (Gap #1 fechado, Fix Round 1) |
| CMU-07 | Implement | ✅ Verified (UI code-verified; lado backend do `id_mandato` no ramo existente agora também com teste, Fix Round 1) |
| CMU-08 | Implement | ✅ Verified (code-verified, UI) |
| CMU-09 | Implement | ✅ Verified (code-verified, UI) |
| CMU-10 | Implement | ✅ Verified (code-verified, UI + backend testado) |
| CMU-11 | Implement | ✅ Verified |
| CMU-12 | Implement (parcial) | ⚠️ Verified com débito aceito (AD-031) — sem alteração |
| CMU-13 | Implement (❌ divergência) | ❌ Confirmado como divergência já ocorrida, aceita como débito histórico via AD-031 — não é ação pendente |
| CMU-14 | Implement (parcial → AC5 corrigido nesta sessão) | ✅ Verified — AC1-4 já estavam ok; AC5 corrigido (`d4dba31`), documentado via AD-031 |
| CMU-15 | Design | ✅ Verified (code-verified, UI) |
| CMU-16 | Design | ✅ Verified (code-verified, UI) |

**Nota de método**: "Verified" acima significa "passou pela leitura independente deste Verifier". Após o Fix Round 1, os 2 gaps reais de backend achados pelo sensor original foram fechados e reverificados de forma independente (mutações reaplicadas por este Verifier, não apenas confiadas ao relato do autor). Onde ainda falta cobertura automatizada por convenção do projeto (comportamento de UI, sem harness configurado) ou por decisão explícita de escopo (CMU-05, deferido a Pedro), o rótulo carrega essa ressalva explicitamente.

---

## Summary

**Overall (após Fix Round 1, `7abb6b0`)**: ✅ **PASS** — com 2 itens não bloqueantes deixados intencionalmente em aberto por decisão do coordenador (spec-precision gap CMU-05, e a convenção preexistente de zero teste de UI), ambos a decidir com Pedro, não defeitos de código.

**Spec-anchored check**: 16/16 requisitos com ACs endereçados; 0 ACs de backend sem evidência de teste (Gap #1 fechado); 1 spec-precision gap inalterado por decisão de escopo (CMU-05); 1 divergência histórica já aceita (CMU-13, AD-031); ACs de comportamento de UI seguem code-verified sem teste, convenção preexistente do projeto (item #6, inalterado por decisão de escopo)

**Sensor**: 3 mutações no total — **3/3 killed** (rodada original matou 1/3; Fix Round 1 fechou os outros 2, reconfirmados de forma independente por este Verifier) → ✅ **PASS** no sensor

**Gate**: 93 passed, 0 failed (+2 unit tests em `mandato.test.ts` sobre a rodada anterior; +4 integration tests em `fn-criar-mandato.integration.test.ts`, fora do gate `test:unit` mas relidos e confirmados por este Verifier)

**What works**: Toda a lógica de UI e de schema lida bate com a letra dos ACs (reaproveitamento de mandato, wizard único, combobox TSE, título travado, restrição de cargo, contrato próprio da coalizão, correção do seletor de membro). CMU-04 e CMU-14 AC5 foram corrigidos corretamente numa sessão anterior, com evidência de código clara e AD-031 documentando a decisão de projeto exigida pelo próprio AC5. O Fix Round 1 fechou os 3 gaps de cobertura de teste de backend rankeados por este Verifier, com asserções de valor/contagem (não apenas ausência de erro) — reconfirmado de forma independente: gate 93/93 verde, e as 2 mutações do sensor original reaplicadas por este Verifier (não pelo autor do fix) e mortas.

**Issues found (restantes, ambos fora do escopo do Fix Round 1 por decisão explícita do coordenador)**:
1. CMU-05 AC1/AC2 duplica regras de `contratoSchema`/`membroCoalizaoSchema` em vez de reusar — spec-precision gap, decisão de produto (aceitar a letra mais frouxa ou refatorar o wizard para importar os schemas compartilhados).
2. Zero teste automatizado de componente de UI em qualquer feature deste projeto — débito de infraestrutura de teste preexistente, não desta feature.

**Next steps**: Nenhum gap bloqueante restante nesta rodada. Gap #4 (CMU-05) e o item de convenção de UI (#6) ficam para decisão de Pedro — não são fix tasks endereçáveis só com código de teste.
