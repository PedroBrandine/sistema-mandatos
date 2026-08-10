# Catálogos de Referência (Trilha C) Validation

**Date**: 2026-08-10
**Spec**: `.specs/features/catalogos-referencia/spec.md`
**Diff range**: commits `50640f7`, `d996a67`, `e88ac11`, `93e5e67` (4 commits desta feature, **não contíguo** — `932c1fd` no meio pertence a uma sessão paralela e foi excluído desta auditoria, conforme instrução de escopo)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes                                                                                    |
| ---- | ------- | ----------------------------------------------------------------------------------------- |
| T1   | ✅ Done | `50640f7` — 26/26 testes verdes nesta reverificação                                       |
| T2   | ✅ Done | `d996a67` — 6/6 testes verdes nesta reverificação; inclui a migração de revoke de default privileges no mesmo commit |
| T3   | ✅ Done | `e88ac11` — testes de T3 rodam hoje dentro do arquivo estendido (ver T4)                  |
| T4   | ✅ Done | `93e5e67` — 13/13 testes verdes (10 de T3 + 3 de T4) nesta reverificação                  |

Todas as 4 tasks foram implementadas e commitadas atomicamente, uma por task, como declarado em `tasks.md`.

---

## Spec-Anchored Acceptance Criteria

Evidence-or-zero: cada linha cita `file:line` + expressão de asserção exata. CAT-16 é bloco de rastreamento sem código (N/A, não contado nos 17).

| Requirement | Criterion (spec.md) | Spec-defined outcome | `file:line` + assertion | Result |
| ----------- | -------------------- | --------------------- | ------------------------ | ------ |
| CAT-01 | `ref_etapa`: FK id_produto, UNIQUE(id_produto,codigo), UNIQUE(id_produto,ordem), CHECK duracao>0 | 23503 (FK), 23505 (UNIQUE codigo), 23505 (UNIQUE ordem), 23514 (CHECK) | `catalogos-referencia.integration.test.ts:136-141` `expect(message).toContain("23503")`; `:122-134` `toContain("23505")`; `:114-120` `toContain("23514")` | ⚠️ Partial — **UNIQUE(id_produto, ordem)** (`uq_etapa_produto_ordem`) não tem nenhum teste que insira `ordem` duplicada para o mesmo produto. Sem `file:line` ⇒ NOT covered nesse ponto (evidence-or-zero) |
| CAT-02 | `ref_tipo_registro`: FK id_etapa, UNIQUE(id_etapa,codigo), CHECK qtd_prevista | 23503, 23505, 23514 | `:153-158` `toContain("23503")`; `:145-151` `toContain("23514")` | ⚠️ Partial — **UNIQUE(id_etapa, codigo)** (`uq_tipo_registro_etapa_codigo`) sem teste. NOT covered nesse ponto |
| CAT-03 | `ref_formulario`: FK id_etapa, UNIQUE(codigo), CHECK respondente | 23503, 23505, 23514 | `:170-176` `toContain("23505")`; `:162-168` `toContain("23514")` | ⚠️ Partial — FK `id_etapa → ref_etapa` nunca testada com valor inexistente (só UNIQUE e CHECK). NOT covered nesse ponto |
| CAT-04 | `ref_metrica_formulario`: FK CASCADE, UNIQUE(id_formulario,codigo_campo), CHECK tipo, índice único parcial `WHERE eh_nps` | 23514, 23505 (ambos), CASCADE remove linha filha | `:204-227` CASCADE (`expect(remaining).toHaveLength(0)`); `:180-186` `toContain("23514")`; `:188-202` `toContain("23505")` (índice parcial) | ⚠️ Partial — **UNIQUE(id_formulario, codigo_campo)** puro nunca testado com `codigo_campo` duplicado; e o teste do índice parcial **não discrimina** a cláusula `WHERE eh_nps` (ver Discrimination Sensor, mutação 2 — sobreviveu) |
| CAT-05 | `ref_preditor` UNIQUE(nome) | 23505 | `:231-236` `toContain("23505")` | ✅ PASS |
| CAT-06 | `ref_agenda_tematica` UNIQUE(nome) | 23505 | `:238-243` `toContain("23505")` | ✅ PASS |
| CAT-07 | `ref_perfil_atuacao` UNIQUE(nome) | 23505 | `:245-250` `toContain("23505")` | ✅ PASS |
| CAT-08 | `ref_pilar_insight` UNIQUE(codigo) **e** UNIQUE(nome) — duas constraints distintas | 23505 para cada uma | `:252-257` insere `('dup_cat08','Pilar A CAT-08'), ('dup_cat08','Pilar B CAT-08')` — `nome` é distinto nas duas linhas, então só exercita a UNIQUE de `codigo` | ⚠️ Partial — a UNIQUE de **`nome`** nunca é exercida (nenhum insert com `nome` duplicado e `codigo` distinto). Título do teste ("codigo and .nome are each UNIQUE") sobre-representa a cobertura real |
| CAT-09 | `ref_indicador` UNIQUE(nome), CHECK peso_iip>=0 | 23505, 23514 | `:268-273` `toContain("23505")`; `:261-266` `toContain("23514")` (valor -1) | ✅ PASS |
| CAT-10 | `ref_nivel_iip`: `codigo TEXT PRIMARY KEY` (chave natural), CHECK valor>=0 | 23505 (duplicata de PK), 23514 | `:277-287` `toContain("23505")`; `:289-294` `toContain("23514")` (valor -1) | ✅ PASS — nota: o teste prova rejeição de duplicata (mecanismo de PK/UNIQUE), mas não distingue estruturalmente "PRIMARY KEY natural" de "UNIQUE index" via `information_schema`/`pg_constraint.contype`; DDL confirmado verbatim contra `docs/schema_sistema.sql:265-271` na leitura manual desta auditoria, então não é um gap de código, só uma nuance de profundidade de teste (spec-precision, não bloqueante) |
| CAT-11 | `ref_tipologia`: FK id_preditor_1/2, FK nivel_d1/d2/d3_padrao, FK id_indicador, UNIQUE(grupo,tipologia,estado), CHECK preditores | 23503 (cada FK), 23505, 23514 | `:298-308` UNIQUE `toContain("23505")`; `:310-316` CHECK `toContain("23514")`; `:318-324` FK `nivel_d1_padrao` `toContain("23503")` | ⚠️ Partial — FK de `nivel_d2_padrao`, `nivel_d3_padrao`, `id_indicador`, e rejeição de `id_preditor_1`/`id_preditor_2` inexistentes (valor não-nulo mas sem linha correspondente) **não têm teste próprio** — só `nivel_d1_padrao` é exercitada |
| CAT-12 | `ref_dimensao_gip` UNIQUE(codigo), CHECK valor_max>valor_min | 23505, 23514 | `:336-341` `toContain("23505")`; `:328-334` `toContain("23514")` (valor_max=valor_min=4) | ✅ PASS |
| CAT-13 | RLS desabilitada (não FORCE) nas 12 tabelas (AD-030) | `relrowsecurity=false`, `relforcerowsecurity=false` | `catalogos-referencia-grants.integration.test.ts:152-163` `expect(row.relrowsecurity).toBe(false)`; `expect(row.relforcerowsecurity).toBe(false)` | ✅ PASS |
| CAT-14 | Provisionamento incremental — migração nova, 4 tabelas antigas intocadas | colunas originais das 4 tabelas antigas inalteradas | `catalogos-referencia.integration.test.ts:97-110` `expect(rows).toHaveLength(4)` (`id_produto`,`id_projeto`,`id_cargo`,`id_partido` presentes) | ✅ PASS |
| CAT-15 | Seed das 9 tabelas com conteúdo aprovado, idempotência em "qualquer um dos 9 INSERTs" | contagens exatas (3/5/3/4/4/7+5/11/16/1-por-avaliação) + reaplicação não duplica **em todas as 9** | `catalogos-referencia-seed.integration.test.ts:11-132` (AC1-AC9 com contagens exatas, todas batem com o spec) | ⚠️ Partial — **AC10 só reaplica o INSERT de `ref_nivel_iip`** (`:124-132`); os outros 8 INSERTs (`ref_preditor`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_dimensao_gip`, `ref_etapa` ×2, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`) não são reaplicados no teste, apesar do AC dizer explicitamente "qualquer um dos 9" |
| CAT-17 | Régua da Coalizão clona Estratégia; idempotência; sem regressão em Estratégia/PLL | 7 linhas idênticas, reaplicação sem duplicar, 7/5 preservadas | `:136-150` `expect(coalizao...).toEqual(estrategia...)`; `:152-167` `expect(qtd).toBe(7)` pós-reaplicação; `:169-180` `expect(rows).toEqual([{Estratégia,7},{PLL,5}])` | ✅ PASS — cobertura completa e precisa |
| CAT-18 | Smoke test por papel: 5 `legisla_*` + `authenticated` SELECT ok; `anon` negado (S/I/U/D); mentor/assessor sem escrita | `has_table_privilege(...)` true/false exatos | `catalogos-referencia-grants.integration.test.ts:34-44` (AC14); `:46-74` (AC15, todas 4 operações); `:106-127` (AC16) | ✅ PASS — cobertura completa, inclusive além do pedido (`authenticated` puro sem escrita, defesa em profundidade) |

**Status**: ❌ Gaps presentes — 6 dos 17 requisitos de código têm cobertura parcial (evidence-or-zero: sub-cláusula sem `file:line` conta como não coberta). Nenhum gap encontrado indica DDL/seed incorreto — toda constraint/seed foi conferida manualmente nesta auditoria linha a linha contra `docs/schema_sistema.sql:170-301` e `:2178-2316` (verbatim, sem divergência). Os gaps são de **profundidade de teste**, não de comportamento de produção incorreto.

---

## Discrimination Sensor

Sensor rodado por **raciocínio estrutural + query de diagnóstico somente-leitura contra o dev real** (`supabase db query --linked`, projeto `npnvoolkebhabjkjzqwn` confirmado antes de cada chamada) — alternativa explicitamente autorizada pela task, dado que mutações de DDL/GRANT exigiriam `db push` real para serem observáveis e este ambiente não tem Docker/`supabase start`. **Nenhuma mutação foi aplicada à árvore real nem ao banco de dev real** — todas as 3 abaixo foram só lidas/raciocinadas.

| # | File:line | Mutação | Raciocínio + evidência real | Killed? |
| - | --------- | ------- | ---------------------------- | ------- |
| 1 | `supabase/migrations/20260810191659_catalogos_referencia_estrutura.sql:114` | Trocar `duracao_prevista_dias > 0` por `>= 0` em `ck_etapa_duracao` | Query `pg_get_constraintdef` confirmou o estado real hoje: `CHECK (((duracao_prevista_dias IS NULL) OR (duracao_prevista_dias > 0)))`. O teste `catalogos-referencia.integration.test.ts:114-120` insere `duracao_prevista_dias=0` esperando `23514`. Sob `>=0`, o INSERT teria sucesso; rastreei `expectSqlError` (`:15-23`): sucesso inesperado dispara `throw new Error("expected query to fail but it succeeded")` dentro do próprio `try`, capturado pelo `catch`, e `expect(message).toContain("23514")` falha porque a mensagem não é a de erro do Postgres. Teste falharia. | ✅ Killed |
| 2 | `supabase/migrations/20260810191659_catalogos_referencia_estrutura.sql:161-164` | Remover `WHERE eh_nps` do índice único parcial `uq_metrica_nps_por_formulario`, virando `UNIQUE(id_formulario)` puro | Query `pg_indexes.indexdef` confirmou o estado real hoje: `... USING btree (id_formulario) WHERE eh_nps` (parcial, de fato). O único teste que insere 2 linhas no mesmo `id_formulario` (`:188-202`) usa `codigo_campo` **diferentes** (`teste_cat04_nps1`, `teste_cat04_nps2`), ambos com `eh_nps=true`. Sob um índice **não-parcial** `UNIQUE(id_formulario)`, essa segunda inserção **também** violaria a constraint (por ser a 2ª linha do mesmo formulário, não por ambas serem NPS) — `23505` continuaria disparando pela razão errada, e a asserção `toContain("23505")` continuaria passando. Nenhum teste do arquivo insere uma 2ª linha `eh_nps=false` (não-NPS) no mesmo formulário para provar que a coexistência é permitida — que é exatamente o comportamento que a cláusula `WHERE eh_nps` (vs. um UNIQUE pleno) garante. | ❌ **Survived** → fix task criada abaixo |
| 3 | `supabase/migrations/20260810193545_catalogos_referencia_revoke_default_privileges.sql:38-43` | Trocar `FROM anon` por `FROM authenticated` no primeiro `REVOKE ALL` | Query `pg_default_acl` confirmou o mecanismo real que a migração documenta: baseline do Supabase concede `anon=arwdDxtm` (CRUD completo) a toda tabela nova de `public` por padrão. Query `has_table_privilege('anon','ref_etapa','SELECT'/'INSERT')` confirmou hoje `false`/`false` — ou seja, é **só o REVOKE explícito** que zera o acesso de `anon` (RLS está desabilitada por AD-030, não bloqueia nada aqui). Se o REVOKE mirasse `authenticated` em vez de `anon`, `anon` manteria o baseline `arwdDxtm`, e `catalogos-referencia-grants.integration.test.ts:46-74` (AC15) observaria `has_table_privilege('anon', tabela, 'SELECT')=true`, falhando `expect(row.can_select).toBe(false)`. | ✅ Killed |

**Sensor depth**: lightweight (3 mutações, proporcional a feature padrão sem caminho crítico de pagamento/auth)
**Result**: 2/3 killed, 1/3 survived — **FAIL parcial do sensor**, gap real e concreto (mutação 2), já refletido no gap de CAT-04 acima.

---

## Interactive UAT

Não aplicável — feature sem componente de UI/comportamento visual (design.md: "Não há componente de aplicação... só migrações SQL e testes de integração").

---

## Code Quality

| Principle | Status | Nota |
| --------- | ------ | ---- |
| Minimum code | ✅ | DDL/seed extraídos verbatim do schema aprovado, sem invenção |
| Surgical changes | ✅ | `git show --stat` dos 4 commits confirma: só os 5 arquivos de migração + 3 arquivos de teste desta feature, nenhum outro arquivo tocado |
| No scope creep | ✅ | Nenhuma das 4 tabelas antigas (`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`) é alterada — confirmado por teste (CAT-14) e por leitura manual do diff |
| Matches patterns | ✅ | Segue fielmente o padrão de `0007`/`0020`/`0021`/`0024` (header comentado, `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, RLS-disable + GRANT explícito) |
| Spec-anchored outcome check (asserted values match spec) | ⚠️ | 11/17 batem integralmente; 6/17 batem parcialmente (ver tabela acima) |
| Per-layer Coverage Expectation met | ⚠️ | Meta auto-declarada em `tasks.md` ("100% dos CHECK/UNIQUE/FK relevantes testados") **não** foi atingida — 5 constraints (`uq_etapa_produto_ordem`, `uq_tipo_registro_etapa_codigo`, FK `ref_formulario.id_etapa`, `uq_metrica_form_campo`, 4 FKs de `ref_tipologia`) e 1 UNIQUE (`ref_pilar_insight.nome`) ficaram sem teste próprio |
| Every test maps to a spec requirement — no unclaimed tests | ✅ | Todos os 45 testes citam CAT-NN/AC-NN no nome ou docstring, nenhum teste solto |
| Documented project quality/testing guidelines followed | ⚠️ | `npm run lint:all` (documentado em `CLAUDE.md` como comando de rotina, e exigido no checklist de release de `docs/fluxo-de-trabalho.md`) **falha** por causa de código desta feature — ver Gate Check abaixo |

❌ Um "No"/⚠️ real encontrado → não pode ser marcado "completo" sem correção.

---

## Edge Cases

Da seção Edge Cases de `spec.md`:

- [x] Ordem interna `ref_etapa` → `ref_tipo_registro`/`ref_formulario` na mesma migração: confirmado por leitura direta do arquivo (`ref_etapa` linha 104, `ref_tipo_registro` linha 117, `ref_formulario` linha 130 — ordem correta)
- [x] `ref_tipologia` criada depois de `ref_preditor`/`ref_nivel_iip`/`ref_indicador` (Grupo A antes do Grupo C): confirmado (Grupo A linhas 21-75, `ref_tipologia` linhas 81-98)
- [⚠️] Segunda métrica NPS rejeitada via `uq_metrica_nps_por_formulario`: comportamento correto e testado, mas o teste **não discrimina** a cláusula `WHERE eh_nps` especificamente (ver Discrimination Sensor, mutação 2 sobrevivente)
- [x] `ref_tipologia` com `id_preditor_2 = id_preditor_1` rejeitada via `ck_tipologia_preditores`: testado (`:310-316`)
- [x] `ref_dimensao_gip` com `valor_max <= valor_min` rejeitada via `ck_dimensao_faixa`: testado (`:328-334`)
- [x] Papel sem GRANT nenhum negado (nunca linha vazia silenciosa): coberto via `has_table_privilege()` como proxy determinístico — escolha de design explícita e documentada em `design.md` (não precisa de sessão JWT por papel porque o controle é GRANT, não RLS); não é um teste de sessão real retornando `42501`, mas é logicamente equivalente e é exatamente o mecanismo que a própria Design autorizou
- [⚠️] Smoke test contra as 3 tabelas vazias (`ref_agenda_tematica`/`ref_indicador`/`ref_tipologia`) retornando 0 linhas sem erro: os testes de GRANT cobrem que o acesso é permitido (`has_table_privilege` inclui as 3 nas 12), mas nenhum teste faz literalmente `SELECT * FROM ref_agenda_tematica` e afirma `toHaveLength(0)` — gap muito menor (comportamento trivial de tabela vazia com GRANT), não listado como ranked gap por materialidade baixíssima

---

## Gate Check

- **Gate command**: `npm run lint:all && npm run build && npm run test:unit && npm run test:integration` (nível Build, `tasks.md`)
- **Result**: ❌ **A cadeia para no primeiro comando** (`lint:all`) — `&&` interrompe antes de `build`/`test:unit`/`test:integration` completo rodarem juntos. Os 3 passos seguintes foram rodados **separadamente** por esta auditoria para não deixar a imagem incompleta:
  - `npm run lint:all` → **FALHA**, 2 erros ESLint, ambos em **arquivo desta feature**:
    ```
    supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts
      147:28  error  'produto' is defined but never used ...  @typescript-eslint/no-unused-vars
      148:25  error  'produto' is defined but never used ...  @typescript-eslint/no-unused-vars
    ```
    Causa: o padrão `.map(({ produto, ...resto }) => resto)` (linhas 147-148, usado para excluir o campo `produto` antes de comparar duas listas) — a regra `@typescript-eslint/no-unused-vars` do projeto não tem `ignoreRestSiblings` habilitado, então a variável extraída e descartada (`produto`) é sinalizada como não usada. **Isto é um gate obrigatório documentado em `CLAUDE.md` e no checklist de release (`docs/fluxo-de-trabalho.md`) — bloquearia qualquer PR para `master` hoje.**
  - `npm run build` → rodado isoladamente: ✅ sucesso, 0 erros de TypeScript/Next.js
  - `npm run test:unit` → rodado isoladamente: ✅ **93/93** passou (10 arquivos, nenhum desta feature — projeto não tem código de aplicação nesta fatia)
  - `npm run test:integration -- supabase/tests/catalogos` (fatia desta feature) → ✅ **45/45** passou (26 estrutura + 6 grants + 13 seed/coalizão), ~275s
  - `npm run test:integration` completo (todas as features) → **não rodado** nesta auditoria: a cadeia real já havia parado em `lint:all` (falha real, não "ruído de trabalho paralelo"), e a fatia desta feature já está confirmada verde isoladamente: rodar a suíte inteira não mudaria o veredito do gate de Build, que já reprovou no primeiro passo
- **Test count before feature**: 0 (arquivos novos, sem testes anteriores para estas 12 tabelas)
- **Test count after feature**: 45
- **Delta**: +45 novos testes
- **Skipped tests**: nenhum
- **Failures**: `lint:all` (2 erros, arquivo próprio da feature, ver acima) — **isto NÃO é poluição de trabalho paralelo alheio**, é código introduzido por esta feature (commit `93e5e67`, T4)

---

## Fix Plans

### Fix 1: `npm run lint:all` falha por 2 erros ESLint em código desta feature

- **Root cause**: `supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts:147-148` usa `.map(({ produto, ...resto }) => resto)` para excluir o campo `produto` da comparação — padrão idiomático de "descartar campo via rest spread", mas a config ESLint do projeto (`@typescript-eslint/no-unused-vars`) não tem `ignoreRestSiblings: true`, então a variável extraída e não referenciada é sinalizada como erro.
- **Fix task**: Renomear a variável descartada para satisfazer o padrão `/^_/u` que a própria regra já permite (ex.: `.map(({ produto: _produto, ...resto }) => resto)`) nas duas ocorrências (linhas 147 e 148), OU (decisão de projeto, fora do escopo desta auditoria decidir) habilitar `ignoreRestSiblings: true` na config ESLint se esse padrão for reaproveitado em testes futuros.
- **Priority**: **Blocker** — `npm run lint:all` é comando de rotina documentado em `CLAUDE.md` e gate obrigatório do checklist de release (`docs/fluxo-de-trabalho.md`); bloquearia merge para `master` hoje.

### Fix 2: `ref_etapa.uq_etapa_produto_ordem` sem teste

- **Root cause**: cobertura de teste incompleta — a constraint existe corretamente na migração (`20260810191659...sql:113`, verbatim contra `docs/schema_sistema.sql:179`), mas nenhum teste insere `ordem` duplicada para o mesmo `id_produto`.
- **Fix task**: Adicionar `it("CAT-01: uq_etapa_produto_ordem rejects duplicate (id_produto, ordem)")` em `catalogos-referencia.integration.test.ts`, mesmo padrão do teste de `uq_etapa_produto_codigo` já existente (linhas 122-134).
- **Priority**: Minor (DDL já correto e verificado manualmente; risco é só de regressão futura não detectada)

### Fix 3: `ref_tipo_registro.uq_tipo_registro_etapa_codigo` sem teste

- **Root cause**: idem Fix 2, para `ref_tipo_registro`.
- **Fix task**: Adicionar teste análogo inserindo `codigo` duplicado para o mesmo `id_etapa`.
- **Priority**: Minor

### Fix 4: `ref_formulario.id_etapa` (FK) sem teste de rejeição

- **Root cause**: só `UNIQUE(codigo)` e `CHECK respondente` são testados para `ref_formulario`; a FK para `ref_etapa` nunca é exercitada com um `id_etapa` inexistente.
- **Fix task**: Adicionar `it("CAT-03: ref_formulario.id_etapa rejects a non-existent FK")`, mesmo padrão de `catalogos-referencia.integration.test.ts:136-141` (CAT-01) e `:153-158` (CAT-02).
- **Priority**: Minor

### Fix 5: `ref_metrica_formulario.uq_metrica_form_campo` sem teste direto + índice parcial não discriminado (mutante sobrevivente)

- **Root cause**: nenhum teste insere `codigo_campo` duplicado sob o mesmo `id_formulario` (constraint plena); e o teste existente do índice parcial usa `codigo_campo` diferentes, então não prova que a cláusula `WHERE eh_nps` (vs. um UNIQUE pleno) é o que de fato restringe — ver Discrimination Sensor, mutação 2.
- **Fix task**: (a) adicionar teste de `UNIQUE(id_formulario, codigo_campo)` com `codigo_campo` repetido; (b) adicionar um teste **positivo** que insere uma 2ª linha com `eh_nps=false` (`codigo_campo` diferente) no mesmo `id_formulario` de uma linha `eh_nps=true` já existente, e confirma que o INSERT **sucede** — essa é a asserção que realmente prova que o índice é parcial, não pleno.
- **Priority**: **Major** — é o único mutante sobrevivente do sensor; a régua de negócio ("só a métrica NPS é única por formulário, outras podem coexistir") não está genuinamente comprovada pelos testes atuais.

### Fix 6: `ref_pilar_insight.nome` (UNIQUE) sem teste — só `codigo` é exercitado

- **Root cause**: o teste único de CAT-08 usa `codigo` duplicado com `nome` distinto nas duas linhas — só bate a UNIQUE de `codigo`; a UNIQUE de `nome` nunca é violada em nenhum teste.
- **Fix task**: Adicionar um segundo caso (ou dividir o teste em dois) que insere `nome` duplicado com `codigo` distinto, confirmando `23505` pela UNIQUE de `nome`.
- **Priority**: Minor

### Fix 7: `ref_tipologia` — 4 FKs sem teste de rejeição (`nivel_d2_padrao`, `nivel_d3_padrao`, `id_indicador`, `id_preditor_1`/`id_preditor_2` com valor inexistente)

- **Root cause**: só `nivel_d1_padrao` tem teste de FK; as outras 4 referências (`nivel_d2_padrao`, `nivel_d3_padrao`, `id_indicador → ref_indicador`, e a rejeição de `id_preditor_1`/`id_preditor_2` com id inexistente, distinta do `ck_tipologia_preditores` já testado) não têm teste próprio.
- **Fix task**: Adicionar testes análogos ao de `nivel_d1_padrao` (linhas 318-324) para cada uma das 4 referências restantes.
- **Priority**: Minor (mecanismo de FK do Postgres já comprovado repetidamente em outras tabelas do mesmo arquivo; risco de regressão específico é baixo, mas evidence-or-zero exige a citação)

### Fix 8: `CAT-15 AC10` — idempotência só verificada para 1 das 9 tabelas semeadas

- **Root cause**: o spec (User Story P1-seed, AC10) exige que "qualquer um dos 9 INSERTs" seja seguro para reaplicação; o teste (`:124-132`) só reaplica o INSERT de `ref_nivel_iip`.
- **Fix task**: Estender o `describe` de seed com reaplicação (mesma query de `INSERT ... ON CONFLICT DO NOTHING`) para as 8 tabelas restantes (`ref_preditor`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_dimensao_gip`, `ref_etapa` Estratégia+PLL, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`), confirmando contagem inalterada após a segunda execução — pode ser feito num único teste parametrizado ou um `it.each`.
- **Priority**: **Major** — é a garantia de idempotência central da migração de seed (roda em dev e produção), e hoje só 1/9 está empiricamente provada; as outras 8 dependem inteiramente de `ON CONFLICT DO NOTHING` estar sintaticamente correto no SQL, o que a leitura manual desta auditoria confirma, mas o teste automatizado não.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| CAT-01 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-02 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-03 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-04 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-05 | Implementing (`50640f7`) | ✅ Verified |
| CAT-06 | Implementing (`50640f7`) | ✅ Verified |
| CAT-07 | Implementing (`50640f7`) | ✅ Verified |
| CAT-08 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-09 | Implementing (`50640f7`) | ✅ Verified |
| CAT-10 | Implementing (`50640f7`) | ✅ Verified |
| CAT-11 | Implementing (`50640f7`) | ❌ Needs Fix |
| CAT-12 | Implementing (`50640f7`) | ✅ Verified |
| CAT-13 | Implementing (`d996a67`) | ✅ Verified |
| CAT-14 | Implementing (`50640f7`) | ✅ Verified |
| CAT-15 | Implementing (`e88ac11`) | ❌ Needs Fix |
| CAT-16 | Pending (rastreamento) | Pending (inalterado — não é requisito de código) |
| CAT-17 | Implementing (`93e5e67`) | ✅ Verified |
| CAT-18 | Implementing (`d996a67`) | ✅ Verified |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 11/17 ACs batem integralmente com o outcome do spec; 6/17 com cobertura parcial (evidence-or-zero: sub-cláusula sem `file:line` = não coberta)
**Sensor**: 2/3 mutações mortas, 1/3 sobreviveu (índice parcial `WHERE eh_nps` não discriminado — Fix 5)
**Gate**: build ✅ (0 erros) / test:unit ✅ (93/93) / test:integration fatia da feature ✅ (45/45) / **lint:all ❌ (2 erros, código desta feature)**

**What works**: DDL das 12 tabelas verbatim-correto contra `docs/schema_sistema.sql:170-301` (conferido linha a linha nesta auditoria); seed das 9 tabelas verbatim-correto contra `:2178-2316`; GRANT/RLS-disable (AD-030) e negação de `anon` corretos e bem testados (CAT-13/18, inclusive o achado real de T2 sobre `ALTER DEFAULT PRIVILEGES`); clonagem da régua da Coalizão (CAT-17) com cobertura completa (clone, idempotência, não-regressão); nenhuma das 4 tabelas antigas tocada; escopo de arquivo 100% respeitado (só os 8 arquivos desta feature).

**Issues found**:
1. **Blocker** — `npm run lint:all` falha por 2 erros ESLint no próprio arquivo de teste desta feature (Fix 1) — bloquearia PR para `master` hoje.
2. **Major** — mutante sobrevivente: teste de `uq_metrica_nps_por_formulario` não prova que o índice é parcial, não pleno (Fix 5).
3. **Major** — `CAT-15 AC10` (idempotência) só verificada para 1 de 9 tabelas semeadas (Fix 8).
4. **Minor** (5 ocorrências) — constraints/UNIQUE/FK corretas na DDL mas sem teste próprio: `uq_etapa_produto_ordem` (Fix 2), `uq_tipo_registro_etapa_codigo` (Fix 3), FK `ref_formulario.id_etapa` (Fix 4), `uq_metrica_form_campo` (parte do Fix 5), `ref_pilar_insight.nome` UNIQUE (Fix 6), 4 FKs de `ref_tipologia` (Fix 7).

**Next steps**: Rodar Fix 1 primeiro (Blocker, trivial — renomear variável descartada). Fixes 2-8 podem ser agrupados numa única task de "fortalecimento de cobertura" e rodados como fix→re-verify (máximo 3 iterações, conforme `validate.md`). Nenhum dos gaps encontrados indica DDL, GRANT ou seed incorretos em produção — todos os 6 gaps de AC e o mutante sobrevivente são de **profundidade de teste**, não de comportamento; risco de regressão futura não detectada, não de defeito já existente.
