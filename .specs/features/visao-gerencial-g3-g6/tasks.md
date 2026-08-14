# Visão Gerencial G3-G6 (Tela Gerencial completa) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name
and follow its Execute flow and Critical Rules.** Do not search for skill
files by filesystem path. The skill is the source of truth for the full flow
(per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/visao-gerencial-g3-g6/design.md`
**Status**: In Progress -- Phases 1-4 concluídas, Phase 5 pendente (últimos 7 tasks)

## Progresso -- Phase 4 (T18-T23) -- ✅ concluída

T18 `7369312` → T19 `9f2afdf` → T20 `41dfc95` → T21 `d941284` → T22 `22b0cfd`
→ adendo `buscarCicloEtapaMensal` `6ddac10` (lacuna real: G2 evolução nunca
tinha função de query, achada só ao implementar T23) → T23 `d082bfe` → fix
`3ffbd27`. Paleta categórica nova (`--series-1..8` + `--series-outras`,
`globals.css`) via skill `dataviz` (`references/palette.md`) -- marca só
define 5 cores não-reservadas (Coral é reservado pra status/alerta),
insuficiente pras até 8 séries de G1; cor por `id % 8` (nunca por ranking).

**Achado real crítico, só apareceu testando ao vivo no navegador** (`npm run
dev` + login via `/admin/acesso`, bypass dev-only): passar uma função
(`formatarValor`) como prop de um Server Component (`SaudeOperacaoBloco`)
pro Client Component `ChartLinhaEvolucao`/`ChartBarraHorizontal` quebrava em
runtime ("Functions cannot be passed directly to Client Components") --
`npm run build`/`tsc`/lint não pegam esse erro, só a execução real. Corrigido
substituindo `formatarValor: function` por `unidade: "pct"|"dias"|"numero"`
(discriminador serializável) nos dois componentes de gráfico -- lição válida
pra T24-T29 (todo prop de Server pra Client precisa ser serializável).

---

## Progresso

- **Phase 1 (T1-T7) -- ✅ concluída.** T1 `1a0624e`(T2)/commitado dentro de
  `66cc2ab` (T1, bundled -- corrida com commit direto do usuário, ver nota
  abaixo) → T2 `1a0624e` → T3 `7e1a2c6` → T4 commitado dentro de `61ea838`
  (bundled -- corrida com `formularios-produto` T9, ver nota abaixo) → T5
  `00e3b39` → T6 `44c76e9` → T7 `a60c209`. 6 views novas/alteradas, todas com
  teste de integração verde, `npm run build` limpo (16 rotas).
  - **Nota de processo**: o worker de sub-agente original desta fase (T1-T7)
    travou repetidamente num loop de "aguardando teste em background" e foi
    encerrado por limite de sessão da API sem produzir o resumo esperado --
    T1 já estava escrito no disco (consolidado de ~13 pra 5 chamadas
    `runSql`, achado real próprio) mas não commitado; o restante (T2-T7) foi
    implementado diretamente pelo orquestrador. Duas corridas de commit
    aconteceram com sessões paralelas ativas no mesmo `develop` (T1 dentro do
    commit `66cc2ab` do usuário, T4 dentro do commit `61ea838` de
    `formularios-produto`) -- conteúdo íntegro nos dois casos, só a mensagem
    de commit não reflete o escopo real.
  - **2 achados reais corrigidos durante a fase** (nenhum estava no
    `design.md`): (1) `fat_submissao.enviada_em` é `NOT NULL DEFAULT now()`,
    não nullable como o design assumia -- `respondido` em
    `vw_resposta_formulario`/`vw_resposta_formulario_mensal` virou "existe
    submissão" / "existe submissão até aquele mês", não uma checagem de
    campo; (2) `vw_cobertura_registro_mensal` e `vw_resposta_formulario_mensal`
    tinham o mesmo bug -- `GROUP BY` direto omitia o mês inteiro quando zero
    linhas existiam, violando AD-005 (nunca omitir, sempre NULL/0 explícito)
    -- corrigido com `LEFT JOIN` contra a série completa de 12 meses.
- **Phase 2 (T8-T12) -- ✅ concluída.** T8 `8ad099a` → T9 `310e0bf` → T10
  `ee4594d` → T11 `59112ba` → T12 `1fb08b5`. `FiltroRecorte` compartilhado +
  `resolverIdsContratoDoRecorte` (helper interno, E lógico Gestora+Mentor) +
  `buscarSaudeCobertura`/`buscarSaudeFormularios`/`buscarCarteiraPonderadaMensal`.
  - **Achado real durante T9, corrigido antes do commit**: `vw_cobertura_registro_mensal`/
    `vw_resposta_formulario_mensal` (T5/T6) pré-agregavam por mês em SQL,
    perdendo `id_contrato`/`id_produto` -- impossível filtrar a evolução pela
    barra de recorte depois, e contradizia o próprio padrão já estabelecido
    no arquivo ("agregação em TS, nunca em SQL"). Nova migration
    `20260814213130_visao_gerencial_fix_grao_fino_evolucao_mensal.sql`
    (`DROP`+`CREATE`, não `CREATE OR REPLACE` -- Postgres recusa renomear/
    remover coluna de view existente, erro `42P16`) refaz as duas com grão
    fino (1 linha por contrato/abertura × mês). `db:types` re-executado.
  - **Achado real durante o teste de T11, corrigido antes do commit**:
    `resolverIdsContratoDoRecorte` consultava `fat_contrato` incondicionalmente
    e interseccionava com o resultado -- quando só `idGestora`/`idMentor`
    eram passados (sem `idProduto`/`idProjeto`), a interseção sempre zerava
    (começava de um `Set` vazio). Corrigido: cada filtro só interssecciona
    com o que já foi restringido; `fat_contrato` só é consultada quando
    `idProduto`/`idProjeto` está presente.
- **Phase 3 (T13-T17) -- ✅ concluída.** T13 `e55cef3` → T14 `66b88b5` → T15
  `25fe2e9` → T16 `05f65f7` → T17 `3b5658f`. `buscarDistribuicaoEtapas`/
  `buscarAtingimentoPorRecorte`/`buscarCompletudeCadastro`/`buscarIipConsolidado`/
  `buscarPendencias`. IIP: "nível" bucketizado contra `ref_nivel_iip.valor`
  (não é FK direta na MV, `TODO(D2)`); timestamp de refresh vira
  `dtDadoMaisRecente` (proxy via `MAX(dt_ultimo_fato)` -- Postgres não expõe
  timestamp de `REFRESH MATERIALIZED VIEW` em catálogo nenhum, documentado
  no código). **Backend 100% completo**: 6 views + 9 funções de query, 141
  testes unitários novos nesta feature (`visao-gerencial-g3-g6.test.ts` +
  `usuario.test.ts` + ajustes em `visao-gerencial.test.ts`), `npm run
  test:unit` (438/438) e `npm run build` verdes a cada task.
- **Phase 4-5 (T18-T30)**: pendentes -- frontend (gate de papel, barra de
  recorte, Recharts, 4 blocos, wire final).

---

---

## Test Coverage Matrix

> Generated from codebase sampling (`supabase/tests/visao-gerencial/*.integration.test.ts`,
> `src/backend/queries/visao-gerencial.test.ts`, `CLAUDE.md`). No dedicated
> testing-standards doc beyond `CLAUDE.md`'s command list — coverage
> expectations below are inferred from the closest analogous feature,
> `visao-gerencial-g1-g2` (same domain, same file layout), which is the floor,
> not a ceiling.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| DB views/migrations (Saída) | integration | Por view nova/alterada: `security_invoker=true`, GRANT correto por papel, colunas essenciais presentes, e pelo menos 1 caso real de filtro/agregação (não só "a view existe") | `supabase/tests/visao-gerencial/*.integration.test.ts` | `npm run test:integration` |
| Backend queries (`src/backend/queries/visao-gerencial.ts`, `usuario.ts`) | unit | 1:1 com cada AC de `GER-01` a `GER-22` que a função cobre, mais os Edge Cases listados no `spec.md` que se apliquem (NULL ≠ 0, amostra vazia, >8 séries → "Outras", Coalizão sem `dim_mandato`) | `src/backend/queries/*.test.ts` (mock de `SupabaseClient`, mesmo padrão de `visao-gerencial.test.ts`/`kanban.test.ts` — sem chamada real) | `npm run test:unit` |
| Frontend components (Server/Client, `.tsx`) | none | Build+lint gate only — nenhum harness de componente React no projeto (débito conhecido, lições `L-006`/`L-007`); mesma mitigação usada por toda feature anterior (`kanban-etapas`, `visao-gerencial-g1-g2`) | `src/frontend/**/*.tsx` | `npm run build && npm run lint:all` |
| Tipos gerados (`database.types.ts`) | none | Build gate only | `src/backend/supabase/database.types.ts` | `npm run build` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Depois de task só com unit test (query TS pura, sem DDL) | `npm run test:unit` |
| Full | Depois de task com integration test (migration/view nova ou alterada) | `npm run test:integration && npm run test:unit` |
| Build | Fim de fase, ou task só de frontend/tipos | `npm run build && npm run lint:all` |

---

## Execution Plan

Phases são ordenadas e rodam em sequência — cada fase completa antes da
próxima começar, e as tasks dentro de uma fase rodam em ordem.

### Phase 1: Fundação de banco (Saída)

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 2: Queries — infraestrutura + Bloco 0 (P1)

```
T8 → T9 → T10 → T11 → T12
```

### Phase 3: Queries — Bloco 1 + Bloco 2 + Bloco 3 (P2/P3)

```
T13 → T14 → T15 → T16 → T17
```

### Phase 4: Frontend — infraestrutura + Bloco 0 (P1)

```
T18 → T19 → T20 → T21 → T22 → T23
```

### Phase 5: Frontend — Bloco 1 + Bloco 2 + Bloco 3 + wiring final (P2/P3)

```
T24 → T25 → T26 → T27 → T28 → T29 → T30
```

---

## Task Breakdown

### T1: Migration `vw_pendencias`

**What**: Nova view `vw_pendencias` (`security_invoker=true`), `UNION ALL` das
6 categorias fechadas (`cadastro`, `formulario_aberto`, `etapa_atrasada`,
`encontro_vencido`, `sem_registro_recente`, `sucesso_mensal_atrasado`),
colunas `id_contrato, nome_contratante, categoria, detalhe, dt_referencia,
dias_em_aberto, id_usuario_gestora, nome_gestora`. Limiares 30/45 dias
escritos na própria view, comentário `-- TODO(limiares): mover pra tabela de
referência quando existir` (AD-004, exceção v1 documentada no pedido original).
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_pendencias.sql`
**Depends on**: None
**Reuses**: `dim_mandato`, `rel_formulario_contrato`, `vw_etapa_contrato`,
`fat_encontro`, `fat_registro`, `fat_contrato`, `fat_sucesso_mensal`,
`rel_usuario_contrato` (padrão de JOIN já usado em `vw_carteira`)
**Requirement**: GER-19

**Tools**:
- MCP: NONE
- Skill: `supabase` (convenções de migration/RLS), `supabase-postgres-best-practices`

**Done when**:
- [ ] `supabase migration new visao_gerencial_vw_pendencias` gera o arquivo com prefixo de timestamp correto
- [ ] As 6 categorias retornam linha só quando a condição real existe (nenhuma categoria hardcoded a `false`)
- [ ] `security_invoker=true` explícito no `CREATE VIEW`
- [ ] Aplicada no Supabase de dev via `supabase db push` (confere `cat supabase/.temp/project-ref` antes, regra de ouro do `CLAUDE.md`)
- [ ] Integration test cobre: cada uma das 6 categorias aparece quando o dado-gatilho existe e não aparece quando não existe; contrato de Coalizão nunca gera linha `cadastro` (Edge Case)
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T1 -- migration vw_pendencias`

---

### T2: Migration `vw_resposta_formulario`

**What**: Nova view `vw_resposta_formulario` (`security_invoker=true`), 1
linha por (`id_contrato`, `id_formulario`): `id_formulario, nome_formulario,
id_contrato, id_produto, estado, dt_abertura, respondido` (`respondido` =
`EXISTS` `fat_submissao` com `enviada_em IS NOT NULL` pra esse par).
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_resposta_formulario.sql`
**Depends on**: None
**Reuses**: `rel_formulario_contrato`, `fat_submissao`, `ref_formulario`
**Requirement**: GER-08

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] View criada com `security_invoker=true`, GRANT a `legisla_gestora`/`legisla_admin` (mesmo padrão de `vw_carteira`)
- [ ] `respondido` reflete corretamente presença de `enviada_em`, não só existência de rascunho
- [ ] Integration test: formulário aberto sem submissão → `respondido=false`; com submissão enviada → `true`; com só rascunho (`enviada_em NULL`) → `false`
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T2 -- migration vw_resposta_formulario`

---

### T3: Migration `vw_ciclo_etapa` — adiciona `dt_conclusao`

**What**: `CREATE OR REPLACE VIEW vw_ciclo_etapa` (forward-only — arquivo
novo, não edita a migration antiga) adicionando a coluna `dt_conclusao` (de
`vw_etapa_contrato`), aditiva, sem remover nenhuma coluna existente.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_ciclo_etapa_dt_conclusao.sql`
**Depends on**: None
**Reuses**: `vw_ciclo_etapa` existente (`20260812180419_visao_gerencial_vw_ciclo_etapa.sql`)
**Requirement**: GER-13

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] Todas as colunas antigas continuam presentes e com o mesmo significado (regressão zero pra `buscarCicloEtapa` existente)
- [ ] `dt_conclusao` presente e correta (mesma data que `vw_etapa_contrato.dt_conclusao` da linha de origem)
- [ ] Integration test novo cobre a coluna nova; suíte existente de `vw-ciclo-etapa.integration.test.ts` continua verde sem alteração
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T3 -- vw_ciclo_etapa ganha dt_conclusao`

---

### T4: Migration `vw_carteira_ponderada_mensal`

**What**: Nova view `vw_carteira_ponderada_mensal` (`security_invoker=true`)
— para os últimos 12 meses (`generate_series` mensal), reconstrói por
Gestora com vínculo ativo naquele mês qual etapa cada contrato estava
(`fat_etapa_contrato.dt_inicio <= fim_do_mês AND (dt_conclusao IS NULL OR
dt_conclusao > fim_do_mês)`), ponderada por `ref_peso_etapa`. Colunas:
`mes_referencia, id_usuario_gestora, nome_gestora, soma_peso`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_carteira_ponderada_mensal.sql`
**Depends on**: None
**Reuses**: `fat_etapa_contrato`, `ref_peso_etapa`, `rel_usuario_contrato` (mesma lógica de "vínculo ativo" de `vw_carteira_ponderada`)
**Requirement**: GER-12

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] `EXPLAIN ANALYZE` rodado contra o banco de dev, tempo registrado no commit message (Risk do `design.md` — medir antes de considerar pronto)
- [ ] Contrato concluído/encerrado num mês do meio da série deixa de contar nos meses seguintes (não fica "preso" pra sempre)
- [ ] Integration test: um contrato que mudou de etapa entre 2 meses tem peso diferente em cada mês da série
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T4 -- migration vw_carteira_ponderada_mensal (G1 evolução)`

---

### T5: Migration `vw_cobertura_registro_mensal`

**What**: Nova view `vw_cobertura_registro_mensal` (`security_invoker=true`)
— por mês dos últimos 12, `% de contratos ativos naquele mês com registro nos
45 dias anteriores ao fim do mês`. Colunas: `mes_referencia, pct_cobertura,
qtd_ativos, qtd_com_registro`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_cobertura_registro_mensal.sql`
**Depends on**: None
**Reuses**: `fat_contrato`, `fat_registro` (mesma janela de 45 dias que `vw_pendencias` categoria `sem_registro_recente`, T1)
**Requirement**: GER-07

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Mês sem nenhum contrato ativo retorna `pct_cobertura NULL`, nunca `0` (AD-005)
- [ ] Integration test: contrato com registro há 40 dias do fim do mês conta como coberto; há 50 dias não conta
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T5 -- migration vw_cobertura_registro_mensal (G3 evolução)`

---

### T6: Migration `vw_resposta_formulario_mensal`

**What**: Nova view `vw_resposta_formulario_mensal` (`security_invoker=true`)
— por mês dos últimos 12, taxa média de resposta (mesma definição de
`respondido` de T2) entre formulários abertos até o fim daquele mês. Colunas:
`mes_referencia, taxa_media`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_resposta_formulario_mensal.sql`
**Depends on**: None
**Reuses**: `rel_formulario_contrato`, `fat_submissao` (mesma lógica de T2, bucketizada por mês)
**Requirement**: GER-08

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Mês sem nenhum formulário aberto ainda retorna `taxa_media NULL`, nunca `0`
- [ ] Integration test: formulário respondido depois do fim de um mês não conta como respondido *naquele* mês (a data de corte é respeitada)
- [ ] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(visao-gerencial): T6 -- migration vw_resposta_formulario_mensal (G4 evolução)`

---

### T7: `db:types`

**What**: Regenera `src/backend/supabase/database.types.ts` a partir do
projeto linkado, tipando as 6 views novas/alteradas de T1-T6.
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T1, T2, T3, T4, T5, T6
**Reuses**: `npm run db:types` (script já existente)
**Requirement**: infra (sem GER dedicado)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npm run db:types` executado com o projeto de dev linkado (confere `cat supabase/.temp/project-ref`)
- [ ] As 6 views novas/alteradas aparecem em `database.types.ts`
- [ ] `npm run build` continua limpo (nenhum tipo quebrado em consumidor existente)

**Tests**: none
**Gate**: build

**Commit**: `chore(visao-gerencial): T7 -- db:types pós vw_pendencias/vw_resposta_formulario/vw_*_mensal`

---

### T8: `FiltroRecorte` + `buscarPapelGlobalAtual`

**What**: Tipo `FiltroRecorte` compartilhado (`idProduto?, idProjeto?,
idGestora?, idMentor?, mesesEvolucao?`) em `visao-gerencial.ts`, e função
`buscarPapelGlobalAtual(client): Promise<PapelGlobal | null>` (server-safe,
mesmo shape de `use-papel-global.ts:30-38`) em `src/backend/queries/usuario.ts`.
**Where**: `src/backend/queries/visao-gerencial.ts`, `src/backend/queries/usuario.ts` (criar se não existir)
**Depends on**: None
**Reuses**: `use-papel-global.ts` (shape de query), `PapelGlobal` type
**Requirement**: GER-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `FiltroRecorte` exportado, usado por toda função nova de T9 em diante
- [ ] `buscarPapelGlobalAtual` funciona com `SupabaseClient<Database>` de servidor ou browser (mesma assinatura)
- [ ] Unit test: usuário sem `dim_usuario` correspondente retorna `null`; papel correto é devolvido pros 4 valores possíveis
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T8 -- FiltroRecorte + buscarPapelGlobalAtual`

---

### T9: `buscarSaudeCobertura` (G3)

**What**: Lê `vw_pendencias` (categoria `sem_registro_recente`) +
`vw_etapa_contrato` + `fat_registro` pro estado atual (número herói, contagem
absoluta, etapas concluídas sem registro) e `vw_cobertura_registro_mensal`
pra evolução, ambos filtrados por `FiltroRecorte`.
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T1, T5, T7
**Reuses**: padrão de agregação em TS de `buscarCarteiraPonderada`
**Requirement**: GER-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna `SaudeCobertura` (`design.md` Data Models) com `pctCobertura: null` quando zero contratos ativos no recorte (AD-005)
- [ ] Unit test cobre: cálculo correto do %, contagem absoluta, etapas concluídas sem registro, e evolução mensal populada a partir da view de T5
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T9 -- buscarSaudeCobertura (G3)`

---

### T10: `buscarSaudeFormularios` (G4)

**What**: Lê `vw_resposta_formulario` (agregação por formulário em TS) +
`vw_pendencias` (categoria `formulario_aberto`) pro estado atual, e
`vw_resposta_formulario_mensal` pra evolução.
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T2, T6, T7
**Reuses**: mesmo padrão de agregação em TS de `buscarCarteiraPonderada`
**Requirement**: GER-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna `SaudeFormularios` ordenado por taxa de resposta (decrescente)
- [ ] Unit test cobre: ordenação, contagem de abertos >30 dias vindo só de `vw_pendencias` (sem duplicar o limiar), evolução mensal
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T10 -- buscarSaudeFormularios (G4)`

---

### T11: Refatora `buscarCarteiraPonderada`/`buscarCicloEtapa` pro `FiltroRecorte` compartilhado

**What**: Troca a assinatura das duas funções existentes de filtros locais
(`FiltroCarteiraPonderada`/`FiltroCicloEtapa`) pra aceitar `FiltroRecorte`
(adiciona `idProjeto`/`idMentor` ao `WHERE`, mantém `papel` de
`buscarCarteiraPonderada` como parâmetro separado — é o alternador
Gestora/Mentor de exibição, não um filtro de recorte, ver `design.md`).
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T3, T7
**Reuses**: `buscarCarteiraPonderada`/`buscarCicloEtapa` existentes (só a assinatura muda, a lógica de agregação em TS não)
**Requirement**: GER-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `idProjeto`/`idMentor` (novos no filtro) restringem corretamente o resultado das duas funções
- [ ] Testes unitários existentes de `visao-gerencial.test.ts` continuam verdes (ajustados só na forma de passar o filtro, nenhuma asserção de comportamento removida)
- [ ] Novo teste unitário cobre `idProjeto`/`idMentor` isoladamente e em combinação com `idGestora` (E lógico, `context.md`)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(visao-gerencial): T11 -- buscarCarteiraPonderada/buscarCicloEtapa usam FiltroRecorte`

---

### T12: `buscarCarteiraPonderadaMensal` (G1 evolução)

**What**: Lê `vw_carteira_ponderada_mensal`, agrega em TS por Gestora (máx.
8 séries, excedente agrupado em `"Outras"`), filtrado por `FiltroRecorte`.
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T4, T7
**Reuses**: `buscarCarteiraPonderada` (padrão de agregação por `dim_usuario` como backbone)
**Requirement**: GER-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Mais de 8 Gestoras no recorte → série `"Outras"` soma o excedente, nunca 9+ séries nomeadas (Edge Case do `spec.md`)
- [ ] Unit test cobre agrupamento em "Outras" e a leitura mês a mês de uma Gestora com histórico real
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T12 -- buscarCarteiraPonderadaMensal (G1 evolução)`

---

### T13: `buscarDistribuicaoEtapas` (Bloco 1)

**What**: Lê `vw_etapa_contrato` (linha aberta = etapa atual) + `ref_etapa`
como backbone (garante toda etapa do produto aparecer, mesmo com 0
contratos), ordenado por `ordem`. Retorna `qtdAtiva`/`qtdAtrasada` por etapa.
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T7
**Reuses**: padrão de backbone `ref_etapa` de `buscarCicloEtapa`/`buscarBoardKanban`
**Requirement**: GER-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Etapa sem nenhum contrato aparece com `qtdAtiva: 0`, nunca omitida
- [ ] Ordenação é sempre por `ref_etapa.ordem`, nunca por `qtdAtiva`
- [ ] Unit test cobre as duas regras acima + contagem de atrasados dentro da contagem ativa
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T13 -- buscarDistribuicaoEtapas (Bloco 1)`

---

### T14: `buscarAtingimentoPorRecorte` (G5)

**What**: Lê `vw_carteira` (`pct_atingimento`, `atingimento_desatualizado`)
agregando por produto e projeto em TS; conta Sucessos Mensais com
`status='pendente' AND mes_referencia = mês corrente` direto de
`fat_sucesso_mensal` (join por carteira do recorte, sem view nova — RLS já
escopa).
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: None
**Reuses**: `vw_carteira` já tipada; padrão de agregação por produto de `buscarCarteiraPonderada`
**Requirement**: GER-14, GER-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] % de atingimento por produto/projeto calculado ignorando `NULL` (nunca conta como 0)
- [ ] Contagem de `atingimento_desatualizado=true` exposta separadamente do agregado
- [ ] Unit test cobre as duas regras + contagem de SM não atualizados no mês corrente
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T14 -- buscarAtingimentoPorRecorte (G5)`

---

### T15: `buscarCompletudeCadastro` (G6)

**What**: Lê `vw_pendencias` (categoria `cadastro`), agrega em TS contagem de
contratos afetados por um dos 5 campos fixos (`ds_genero`, `ds_raca`,
`fl_pcd`, `confianca`, `nr_titulo_eleitoral`).
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T1, T7
**Reuses**: mesmo padrão de leitura de `vw_pendencias` de T9/T10
**Requirement**: GER-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna contagem por campo, os 5 campos sempre presentes mesmo com contagem 0 (backbone fixo, não derivado da presença de dado)
- [ ] Unit test cobre isso + confirma que contrato de Coalizão nunca entra (Edge Case, já garantido pela view em T1, testado aqui na função consumidora também)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T15 -- buscarCompletudeCadastro (G6)`

---

### T16: `buscarIipConsolidado` (IIP)

**What**: Lê `mv_iip_contrato` (server-only) filtrado por `FiltroRecorte`,
distribuição por nível (`ref_nivel_iip`) + valor consolidado + timestamp do
último refresh (`pg_stat_user_tables`/coluna de refresh, o que a MV já expuser).
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: None
**Reuses**: `mv_iip_contrato` já tipada (`incidencia-encontros`)
**Requirement**: GER-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Nunca chamado de client component (comentário/nota no arquivo reforçando a regra de segurança §9 do pedido original)
- [ ] Retorna `iip_provisorio` rotulável como provisório + timestamp de refresh
- [ ] Unit test cobre distribuição por nível e o valor consolidado do recorte
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T16 -- buscarIipConsolidado`

---

### T17: `buscarPendencias` (Bloco 3)

**What**: Lê `vw_pendencias` completa, filtrada por `FiltroRecorte` +
paginação + agrupamento (categoria ou Gestora) + ordenação por
`dias_em_aberto` decrescente dentro de cada grupo.
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T1, T7
**Reuses**: nenhuma agregação nova — a ordenação/paginação já vem da própria view; a função só filtra e formata pro shape de `LinhaPendencia`
**Requirement**: GER-19

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtro por `FiltroRecorte` restringe corretamente as 6 categorias
- [ ] Ordenação padrão é sempre `dias_em_aberto` decrescente
- [ ] Unit test cobre paginação (não traz a tabela inteira de uma vez — regra de performance do pedido original) e cada uma das 6 categorias presente no shape de retorno
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visao-gerencial): T17 -- buscarPendencias (Bloco 3)`

---

### T18: `NaoAutorizado`

**What**: Componente de bloqueio 403 — primeiro do projeto, título +
mensagem + link de volta ao hub (`/`).
**Where**: `src/frontend/components/app-shell/nao-autorizado.tsx`
**Depends on**: None
**Reuses**: `Card`/`Button` de `components/ui`
**Requirement**: GER-01

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max`

**Done when**:
- [ ] Componente renderiza sem props obrigatórias (título/mensagem com default)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T18 -- componente NaoAutorizado (403)`

---

### T19: `page.tsx` — Server Component, gate + shell de `searchParams`

**What**: Converte `visao-gerencial/page.tsx` de Client pra Server Component.
`await searchParams`, parseia pra `FiltroRecorte`, chama
`buscarPapelGlobalAtual` — se `mentor`/`assessor`, renderiza `NaoAutorizado`
e para (sem montar nenhum bloco). Monta o shell dos 4 `<Suspense>` (blocos em
si vêm em T22-T29).
**Where**: `src/frontend/app/(app)/visao-gerencial/page.tsx`
**Depends on**: T8, T18
**Reuses**: `createClient` (server), estrutura de rota existente (`(app)/`)
**Requirement**: GER-01, GER-02, GER-03, GER-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Papel `mentor`/`assessor` (inclusive por URL direta) nunca renderiza nenhum bloco de dado
- [ ] `searchParams` vazio → `FiltroRecorte` vazio, sem erro
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T19 -- page.tsx vira Server Component com gate de papel`

---

### T20: `BarraRecorte`

**What**: Client component com os 5 filtros (Produto, Projeto, Gestora,
Mentor, Período), grava em `searchParams` via `useRouter`/`usePathname`,
chips removíveis + "limpar tudo".
**Where**: `src/frontend/components/visao-gerencial/barra-recorte.tsx`
**Depends on**: None
**Reuses**: `PRODUTO_SLUGS`, `Select`/`Badge`/`Button`
**Requirement**: GER-02, GER-03, GER-04, GER-05

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max`

**Done when**:
- [ ] Mudar um filtro atualiza a URL sem recarregar a página inteira (`router.push` shallow)
- [ ] Chip individual remove só aquele filtro; "limpar tudo" zera todos
- [ ] Barra é `sticky` no topo (regra de layout do pedido original)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T20 -- BarraRecorte (5 filtros, URL, chips)`

---

### T21: `ChartLinhaEvolucao` / `ChartBarraHorizontal` + instala Recharts

**What**: Instala `recharts` + copia os primitivos `chart` do shadcn/ui;
dois wrappers genéricos (linha de evolução mensal, barra horizontal) com
tooltip, cor categórica fixa por entidade, e toggle "ver como tabela"
embutido. Nunca dois eixos Y (garantido pela própria interface — um wrapper
só aceita 1 métrica por instância).
**Where**: `src/frontend/components/visao-gerencial/chart-linha-evolucao.tsx`,
`.../chart-barra-horizontal.tsx`, `src/frontend/components/ui/chart.tsx` (primitivo shadcn)
**Depends on**: None
**Reuses**: nenhum — primeira lib de gráfico do projeto (AD nova candidata, ver `design.md`)
**Requirement**: infra (consumido por GER-07, GER-08, GER-10, GER-12, GER-13, GER-14, GER-17)

**Tools**:
- MCP: NONE
- Skill: `dataviz`, `frontend-design`

**Done when**:
- [ ] `recharts` instalado (`package.json` do workspace `frontend`)
- [ ] Os 2 wrappers renderizam com dado de exemplo, toggle "ver como tabela" funcional, acessível por teclado
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T21 -- Recharts + ChartLinhaEvolucao/ChartBarraHorizontal`

---

### T22: `SaudeOperacaoBloco` (G3+G4)

**What**: Server Component, Bloco 0 — dois cards (G3, G4) usando
`buscarSaudeCobertura`/`buscarSaudeFormularios` + os charts de T21.
**Where**: `src/frontend/components/visao-gerencial/saude-operacao-bloco.tsx`
**Depends on**: T9, T10, T21
**Reuses**: `CarregandoSkeleton`/`ErroInline`/`EstadoVazio`
**Requirement**: GER-06, GER-07, GER-08

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max`

**Done when**:
- [ ] G3 mostra número herói + gráfico de linha; G4 mostra barras horizontais ordenadas pela taxa + gráfico de linha
- [ ] Bloco aparece sempre acima de qualquer indicador de mandato na composição final (garantido pela ordem em `page.tsx`, T30)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T22 -- SaudeOperacaoBloco (G3+G4)`

---

### T23: Refatora `CarteiraPonderadaCard`/`CicloEtapaCard` pro filtro global + evolução

**What**: Remove os `Select` próprios de produto/papel/Gestora dos dois
cards; passam a receber `FiltroRecorte` via prop do pai. G1 ganha gráfico de
linha de evolução (`buscarCarteiraPonderadaMensal`, T12); G2 ganha small
multiples por etapa (bucket por `dt_conclusao` de T3). Mantém o alternador
Gestora/Mentor de G1 como controle client-side (não é recorte, é modo de
agregação — `design.md`/`context.md`).
**Where**: `src/frontend/components/visao-gerencial/carteira-ponderada-card.tsx`,
`.../ciclo-etapa-card.tsx`
**Depends on**: T11, T12, T21
**Reuses**: os próprios componentes existentes (refactor, não reescrita)
**Requirement**: GER-09, GER-12, GER-13

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `dataviz`

**Done when**:
- [ ] Nenhum `Select` de produto/Gestora independente sobrevive nos dois cards
- [ ] G1 mostra linha de evolução (máx. 8 séries + "Outras"); G2 mostra small multiples, um mini-gráfico por etapa
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `refactor(visao-gerencial): T23 -- G1/G2 consomem FiltroRecorte + evolução real`

---

### T24: `DistribuicaoEtapasBloco` + `EtapaContratosModal` (Bloco 1)

**What**: Server Component com barras horizontais por etapa (ordem da
régua), segmento de atraso rotulado; Client Component de modal (Dialog) com
a lista de contratos da etapa clicada, cada um linkando pro Kanban do produto.
**Where**: `src/frontend/components/visao-gerencial/distribuicao-etapas-bloco.tsx`,
`.../etapa-contratos-modal.tsx`
**Depends on**: T13, T21
**Reuses**: `Dialog` de `components/ui`, rota `/produtos/{slug}/dashboard`
**Requirement**: GER-10, GER-11

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `dataviz`

**Done when**:
- [ ] Barras sempre na ordem de `ref_etapa.ordem`, nunca reordenadas por valor
- [ ] Clicar numa etapa abre modal com a lista real de contratos daquela etapa
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T24 -- DistribuicaoEtapasBloco + modal (Bloco 1)`

---

### T25: `g5-atingimento-card.tsx`

**What**: Card G5 — barras de % de atingimento por produto/projeto, contagem
de SM não atualizados no mês, sinalização de `atingimento_desatualizado`, e
placeholder explícito de evolução (`TODO(OUT-06)`).
**Where**: `src/frontend/components/visao-gerencial/g5-atingimento-card.tsx`
**Depends on**: T14, T21
**Reuses**: `Alert` (mesmo padrão de aviso de `CarteiraPonderadaCard`, linha ~102-109)
**Requirement**: GER-14, GER-15, GER-16

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `dataviz`

**Done when**:
- [ ] Placeholder de evolução é visível e explícito ("aguardando fechamento mensal — OUT-06"), nunca um gráfico vazio silencioso
- [ ] Contagem de desatualizados aparece separada do % agregado
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T25 -- g5-atingimento-card`

---

### T26: `g6-completude-card.tsx`

**What**: Card G6 — barras pelos 5 campos fixos com contagem de contratos
afetados, e placeholder explícito `TODO(G6-evolucao)`.
**Where**: `src/frontend/components/visao-gerencial/g6-completude-card.tsx`
**Depends on**: T15, T21
**Reuses**: mesmo padrão visual de `g5-atingimento-card.tsx`
**Requirement**: GER-17

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `dataviz`

**Done when**:
- [ ] Os 5 campos sempre aparecem, mesmo com contagem 0
- [ ] Placeholder de evolução explícito, nunca vazio silencioso
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T26 -- g6-completude-card`

---

### T27: `iip-consolidado-card.tsx`

**What**: Card IIP — distribuição por nível + valor consolidado, rotulado
"provisório" (D2), timestamp do último refresh de `mv_iip_contrato` visível.
**Where**: `src/frontend/components/visao-gerencial/iip-consolidado-card.tsx`
**Depends on**: T16
**Reuses**: `ChartBarraHorizontal` (T21) pra distribuição por nível
**Requirement**: GER-18

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Rótulo "provisório" sempre visível junto do valor
- [ ] Timestamp de refresh sempre visível
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T27 -- iip-consolidado-card`

---

### T28: `IndicadoresBloco` — composição (Bloco 2)

**What**: Server Component que compõe G1, G2 (T23), G5 (T25), G6 (T26), IIP
(T27) numa grade de 2 colunas.
**Where**: `src/frontend/components/visao-gerencial/indicadores-bloco.tsx`
**Depends on**: T23, T25, T26, T27
**Reuses**: os 5 cards acima, sem lógica própria além do grid
**Requirement**: infra (wiring de GER-09, GER-12 a GER-18)

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Grade 2 colunas responsiva, nenhum card com 2 eixos Y
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T28 -- IndicadoresBloco (grade 2 colunas)`

---

### T29: `GargalosBloco` + `GargalosTabela` (Bloco 3)

**What**: Server Component (busca dado) + Client Component (`GargalosTabela`
— accordion por categoria/Gestora, toggle "ver como tabela", navegação por
linha pra tela de origem, sem nenhuma ação de "resolver"/"ignorar").
**Where**: `src/frontend/components/visao-gerencial/gargalos-bloco.tsx`,
`.../gargalos-tabela.tsx`
**Depends on**: T17, T21
**Reuses**: `Table` de `components/ui`, mesmo padrão de link-por-linha do Kanban
**Requirement**: GER-19, GER-20, GER-21, GER-22

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max`

**Done when**:
- [ ] Agrupar por categoria/Gestora reorganiza em seções colapsáveis (accordion), mantendo ordenação por dias em aberto dentro de cada seção
- [ ] Clicar numa linha navega pra tela de origem — confirma que não existe nenhum botão "resolver"/"ignorar" em nenhum lugar do componente
- [ ] Recorte sem pendências mostra `EstadoVazio`, distinto de erro
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(visao-gerencial): T29 -- GargalosBloco + GargalosTabela (Bloco 3)`

---

### T30: Wire final — `page.tsx` monta os 4 blocos reais

**What**: Substitui o shell de `<Suspense>` provisório de T19 pelos 4 blocos
de verdade (`SaudeOperacaoBloco`, `DistribuicaoEtapasBloco`,
`IndicadoresBloco`, `GargalosBloco`), cada um com seu skeleton próprio,
remove o `<EmDesenvolvimento titulo="G3-G6 em desenvolvimento" />`.
**Where**: `src/frontend/app/(app)/visao-gerencial/page.tsx`
**Depends on**: T19, T20, T22, T24, T28, T29
**Reuses**: os 4 blocos + `BarraRecorte`, todos já prontos
**Requirement**: todas as GER (wiring final)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `<EmDesenvolvimento>` removido — nenhum resquício de placeholder
- [ ] Ordem visual: `BarraRecorte` (sticky) → Bloco 0 → Bloco 1 → Bloco 2 → Bloco 3, exatamente como o pedido original
- [ ] Um bloco falhando (erro simulado) não derruba os outros 3 (Edge Case do `spec.md`)
- [ ] `npm run build && npm run lint:all` limpos, mesma baseline de problemas pré-existentes
- [ ] `npm run test:unit && npm run test:integration` verdes (suíte inteira, não só os arquivos novos)

**Tests**: none (wiring puro — cobertura já veio dos blocos individuais)
**Gate**: build

**Commit**: `feat(visao-gerencial): T30 -- wire final, Tela Gerencial completa em /visao-gerencial`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6 → T7
Phase 2:  T8 → T9 → T10 → T11 → T12
Phase 3:  T13 → T14 → T15 → T16 → T17
Phase 4:  T18 → T19 → T20 → T21 → T22 → T23
Phase 5:  T24 → T25 → T26 → T27 → T28 → T29 → T30
```

Execução é estritamente sequencial dentro de cada fase.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1-T6 | 1 migration/view cada | ✅ Granular |
| T7 | 1 comando (db:types) | ✅ Granular |
| T8 | 1 tipo + 1 função (cohesos, mesmo arquivo/conceito de "identidade do recorte") | ✅ OK (2-3 relacionados) |
| T9, T10, T12, T13, T14, T15, T16, T17 | 1 função cada | ✅ Granular |
| T11 | 2 funções existentes, mesmo refactor de assinatura | ✅ OK (2-3 relacionados, mesma mudança) |
| T18 | 1 componente | ✅ Granular |
| T19 | 1 arquivo (page.tsx), 1 responsabilidade (gate+shell) | ✅ Granular |
| T20 | 1 componente | ✅ Granular |
| T21 | 1 instalação + 2 componentes-wrapper genéricos cohesos | ✅ OK (2-3 relacionados, mesma dependência nova) |
| T22, T24, T27, T28, T29 | 1 bloco (Server) + no máx. 1 componente auxiliar coheso | ✅ Granular/OK |
| T23 | 2 componentes existentes, mesmo refactor | ✅ OK (2-3 relacionados) |
| T25, T26 | 1 componente cada | ✅ Granular |
| T30 | 1 arquivo (page.tsx), wiring final | ✅ Granular |

Nenhuma task ultrapassa "2-3 coisas relacionadas no mesmo arquivo/conceito" —
nenhuma precisou ser dividida.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (Phase 1 start) | ✅ Match |
| T2 | None | T1→T2 (sequência de fase) | ✅ Match |
| T3 | None | T2→T3 | ✅ Match |
| T4 | None | T3→T4 | ✅ Match |
| T5 | None | T4→T5 | ✅ Match |
| T6 | None | T5→T6 | ✅ Match |
| T7 | T1,T2,T3,T4,T5,T6 | T6→T7 (fim de fase, todas as anteriores já rodaram em ordem) | ✅ Match |
| T8 | None | (Phase 2 start) | ✅ Match |
| T9 | T1,T5,T7 | T8→T9; T1/T5/T7 são de fase anterior, já concluída | ✅ Match |
| T10 | T2,T6,T7 | T9→T10; T2/T6/T7 de fase anterior | ✅ Match |
| T11 | T3,T7 | T10→T11; T3/T7 de fase anterior | ✅ Match |
| T12 | T4,T7 | T11→T12; T4/T7 de fase anterior | ✅ Match |
| T13 | T7 | (Phase 3 start); T7 de fase anterior | ✅ Match |
| T14 | None | T13→T14 | ✅ Match |
| T15 | T1,T7 | T14→T15; T1/T7 de fase anterior | ✅ Match |
| T16 | None | T15→T16 | ✅ Match |
| T17 | T1,T7 | T16→T17; T1/T7 de fase anterior | ✅ Match |
| T18 | None | (Phase 4 start) | ✅ Match |
| T19 | T8,T18 | T18→T19; T8 de fase anterior | ✅ Match |
| T20 | None | T19→T20 | ✅ Match |
| T21 | None | T20→T21 | ✅ Match |
| T22 | T9,T10,T21 | T21→T22; T9/T10 de fase anterior | ✅ Match |
| T23 | T11,T12,T21 | T22→T23; T11/T12 de fase anterior | ✅ Match |
| T24 | T13,T21 | (Phase 5 start); T13 de fase anterior, T21 de fase anterior | ✅ Match |
| T25 | T14,T21 | T24→T25; T14 de fase anterior | ✅ Match |
| T26 | T15,T21 | T25→T26; T15 de fase anterior | ✅ Match |
| T27 | T16 | T26→T27; T16 de fase anterior | ✅ Match |
| T28 | T23,T25,T26,T27 | T27→T28; T23 de fase anterior, T25-T27 da mesma fase já rodadas | ✅ Match |
| T29 | T17,T21 | T28→T29; T17/T21 de fases anteriores | ✅ Match |
| T30 | T19,T20,T22,T24,T28,T29 | T29→T30; todas as demais de fases anteriores ou já rodadas nesta fase | ✅ Match |

Nenhuma task depende de uma task de fase posterior — todas as dependências
apontam pra trás ou dentro da mesma fase.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1-T6 | DB views/migrations | integration | integration | ✅ OK |
| T7 | Tipos gerados | none | none | ✅ OK |
| T8-T17 | Backend queries | unit | unit | ✅ OK |
| T18-T30 | Frontend components | none | none | ✅ OK |

Nenhuma violação — toda task de view/migration carrega seu próprio teste de
integração na mesma task (nunca "testado depois"); toda task de query carrega
seu próprio teste unitário; frontend segue o piso já estabelecido pelo resto
do projeto (build+lint, sem harness de componente).

---

## Tips

Nenhuma nota adicional além do template padrão da skill.
