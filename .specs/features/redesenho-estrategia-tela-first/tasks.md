# Redesenho tela-first do produto Estratégia — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo de
Execute e as Critical Rules dela.** Não procure os arquivos da skill por caminho de sistema de
arquivos. A skill é a fonte de verdade do fluxo completo (ciclo por task, delegação a
sub-agentes, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise o usuário — não prossiga sem ela.**

---

**Design**: `.specs/features/redesenho-estrategia-tela-first/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada a partir do codebase, das guidelines do projeto e do spec — confirmar antes de Execute.
> Guidelines encontradas: `CLAUDE.md`, `vitest.config.ts`, `vitest.integration.config.ts`,
> `.github/workflows/ci.yml`, `docs/fluxo-de-trabalho.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| :-- | :-- | :-- | :-- | :-- |
| Migration / DDL / RLS / GRANT | integration | Toda tabela nova: estrutura, CHECKs, índice parcial, trigger de auditoria. Toda RLS/GRANT: uma asserção por role × operação | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| View / RPC Postgres | integration | Todo caminho da view (as 6 categorias de `vw_pendencias`); RPC: caminho feliz + cada erro tipado + idempotência | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| Seed / catálogo `ref_*` | integration | Valores esperados + contagem de linhas dependentes inalterada | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| `src/backend/queries/**` | unit | Todas as ramificações; 1:1 com ACs do spec; todo edge case listado. Cliente Supabase mockado por nome de tabela (padrão de `queries/kanban.test.ts`) | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| `src/backend/rpc/**` | unit | Parâmetros passados verbatim (L-004) + mapeamento de cada erro de constraint (L-003) | `src/backend/rpc/*.test.ts` | `npm run test:unit` |
| `src/backend/schemas/**` | unit | Aceite e recusa por campo, incluindo limites | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| Funções puras de frontend | unit | Todas as ramificações, incluindo os dois lados de comparação de data (L-001) | `src/frontend/**/*.test.ts` | `npm run test:unit` |
| **Componentes React** | **unit (novo — AD-042)** | Todo elemento que uma AC nomeia é asserido; toda ramificação de render tem caso dos dois lados; estado vazio e estado de erro cobertos | `src/frontend/**/*.test.tsx` | `npm run test:unit` |
| Config / tipos gerados | none | — (build gate) | — | build gate |

**Nota de provenance:** o piso de qualidade vem dos testes existentes (13 em `queries/`, 13 em
`rpc/`, 12 em `schemas/`, e o padrão "Spec anchor" no cabeçalho de cada um, que amarra o teste ao
ID de requisito). A linha de **Componentes React** não tem piso no repo — é o débito L-006/L-007
que AD-042 encerra, e é alvo, não reflexo do que existe.

## Gate Check Commands

> Extraídos de `package.json` e `.github/workflows/ci.yml` — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| :-- | :-- | :-- |
| **quick** | Tasks só com teste unitário (queries, rpc, schemas, componentes) | `npm run test:unit` |
| **full** | Tasks com migration, view, RPC Postgres, RLS ou GRANT | `npm run test:unit && npm run test:integration` |
| **build** | Fim de fase, ou task de config | `npm run lint && npm run test:unit && npm run build` |

**Regra de lint desta feature:** `lint-frontend` é `continue-on-error: true` no CI, com o
comentário *"as telas de `src/frontend` ainda vão ser redesenhadas"* — que descreve exatamente
esta feature. Dos 30 problemas atuais, **~13 estão em arquivos que esta feature toca**
(`tse-match-search.tsx`, `mandato-wizard.tsx`, `contrato-form.tsx`, `contratante-fields.tsx`,
`mandato-card.tsx`, `encontro-form.tsx`, `encontros-lista.tsx`). **Todo arquivo criado ou
modificado por esta feature sai com `npm run lint:frontend` limpo.** Os problemas restantes
vivem em telas fora do escopo (`mandatos/`, `contratos/`, `coalizoes/`, `usuarios/`); remover o
`continue-on-error` global é decisão separada, depois que a UI estabilizar.

---

## Execution Plan

Fases são ordenadas e rodam em sequência; tasks dentro de uma fase rodam em ordem.

### Fase 0: Harness de teste de componente
```
T1
```

### Fase 1: Banco — limiares e renome da régua
```
T2 → T3 → T4 → T4b
```

### Fase 2: Banco — Prospecção pré-contrato
```
T5 → T6 → T7 → T8 → T9
```

### Fase 3: Shell — Topbar, Hub e aba Mandatos
```
T10 → T11 → T12 → T13
```

### Fase 4: Dashboard — Quadro de Acompanhamento e Pendências
```
T14 → T15 → T16 → T17 → T18
```

### Fase 5: Mandatos — lista e filtros
```
T19 → T20 → T21
```

### Fase 6: Novo Contrato — busca TSE e formulário
```
T22 → T23 → T24
```

### Fase 7: Agenda — calendário, registros e presença
```
T25 → T26 → T27 → T28 → T29 → T30
```

### Fase 8: KPIs do Dashboard
```
T31 → T32 → T33
```

---

## Task Breakdown

### T1: Harness de teste de componente

**What**: Instalar `@testing-library/react` (linha compatível com React 19), `@testing-library/jest-dom` e `jsdom`; incluir `**/*.test.tsx` em `vitest.config.ts` com ambiente `jsdom` via `environmentMatchGlobs` (API válida no Vitest 2.1.9); escrever um teste de componente de fumaça sobre um componente já existente.
**Where**: `package.json`, `vitest.config.ts`, `src/frontend/components/ui/estado-vazio.test.tsx`
**Depends on**: None
**Reuses**: `components/ui/estado-vazio.tsx` como alvo do smoke test
**Requirement**: EST-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run test:unit` coleta e executa `.test.tsx` (EST-01 AC1)
- [ ] O smoke test renderiza via `@testing-library/react` em `jsdom` (EST-01 AC2)
- [ ] Remover o texto renderizado de `estado-vazio.tsx` faz o teste falhar (EST-01 AC3) — verificado manualmente e desfeito
- [ ] `.test.ts` existentes continuam em `node`; contagem de testes anterior preservada
- [ ] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `chore(teste): harness de componente -- jsdom + testing-library (AD-042)`

---

### T2: `ref_limiar_pendencia` — estrutura, GRANT e seed

**What**: Migration criando a tabela de limiares, com GRANT-only (AD-030) e seed dos 4 limiares.
**Where**: `supabase/migrations/<ts>_estrategia_ref_limiar_pendencia.sql`, `supabase/tests/estrategia/ref-limiar-pendencia.integration.test.ts`
**Depends on**: None
**Reuses**: padrão de `20260810192209_catalogos_referencia_grants.sql`; teste espelha `catalogos-referencia-grants.integration.test.ts`
**Requirement**: EST-06

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] Tabela criada com `CHECK (dias > 0)` e `codigo` UNIQUE
- [ ] Seed: `formulario_aberto=30`, `sem_registro_recente=45`, `etapa_atencao`, `etapa_atrasado`
- [ ] GRANT SELECT para `authenticated` + as 5 roles `legisla_*`; `anon` sem SELECT (AD-030)
- [ ] Teste de integração assere estrutura, seed e uma linha por role × privilégio
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): ref_limiar_pendencia com GRANT-only (AD-041)`

---

### T3: `vw_pendencias` passa a ler os limiares

**What**: Migration substituindo os `INTERVAL` cravados por leitura de `ref_limiar_pendencia`.
**Where**: `supabase/migrations/<ts>_estrategia_vw_pendencias_limiar.sql`, `supabase/tests/estrategia/vw-pendencias-limiar.integration.test.ts`
**Depends on**: T2
**Reuses**: corpo atual da view (`20260814162237_visao_gerencial_vw_pendencias.sql`)
**Requirement**: EST-06

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Nenhum literal `INTERVAL '<n> days'` permanece no corpo da view (AD-004)
- [ ] As 6 categorias continuam retornando as mesmas linhas com o seed padrão (não-regressão)
- [ ] Alterar `ref_limiar_pendencia.dias` muda o resultado da view sem deploy (EST-06 / edge case)
- [ ] `security_invoker = true` preservado
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `refactor(estrategia): vw_pendencias le limiares de tabela (AD-041)`

---

### T4: Renome Raio-X → Diagnóstico

**What**: Migration de seed renomeando `ref_etapa.nome` de "Raio-X" para "Diagnóstico" nos produtos Estratégia e Coalizão, preservando `codigo = 'raio_x'`.
**Where**: `supabase/migrations/<ts>_estrategia_renomeia_raio_x_diagnostico.sql`, `supabase/tests/estrategia/renome-etapa-diagnostico.integration.test.ts`, `docs/schema_sistema.sql`
**Depends on**: None
**Reuses**: padrão de `20260812163617_kanban_etapas_correcao_ref_etapa.sql` (correção de conteúdo, não de estrutura)
**Requirement**: EST-14

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] `SELECT nome FROM ref_etapa WHERE codigo='raio_x'` retorna "Diagnóstico" nos 2 produtos (EST-14 AC1, AC4)
- [ ] `codigo` inalterado; contagem de `ref_tipo_registro`, `ref_formulario` e `fat_etapa_contrato` por etapa idêntica à de antes (EST-14 AC2)
- [ ] Migration é idempotente sob `supabase db reset` (roda do zero no CI)
- [ ] `docs/schema_sistema.sql` (bloco de seed de `ref_etapa`, ~linha 2234) passa a dizer "Diagnóstico" — o modelo aprovado não pode divergir do banco (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): renomeia etapa Raio-X para Diagnostico (EST-14)`

---

### T4b: Limiar de etapa passa a ser percentual da duração prevista

**What**: Migration ajustando `ref_limiar_pendencia` para que os limiares de etapa (`etapa_atencao`, `etapa_atrasado`) sejam **percentuais de `ref_etapa.duracao_prevista_dias`**, não dias absolutos. Os limiares de pendência (`formulario_aberto`, `sem_registro_recente`) continuam em dias absolutos.
**Where**: `supabase/migrations/<ts>_estrategia_limiar_etapa_percentual.sql`, `supabase/tests/estrategia/limiar-etapa-percentual.integration.test.ts`, `docs/schema_sistema.sql`
**Depends on**: T2
**Reuses**: `ref_limiar_pendencia` (T2), `ref_etapa.duracao_prevista_dias`
**Requirement**: EST-06, EST-07

**Tools**: MCP: NONE · Skill: `supabase`

**Contexto da decisão (Pedro, 2026-09-10):** limiar absoluto não distingue contexto — 120 dias em Monitoramento é normal, em Pontapé é abandono. O corte escolhido é **70% da duração prevista para Atenção** e **100% para Atrasado**. Ex.: Diagnóstico (21 dias) → amarelo aos 15, vermelho aos 22; Monitoramento (120) → amarelo aos 84.

**Done when**:
- [ ] A tabela distingue as duas bases de limiar (dias absolutos × percentual da duração da etapa), sem coluna ambígua
- [ ] `etapa_atencao = 70`, `etapa_atrasado = 100`, ambos expressos como percentual
- [ ] `formulario_aberto = 30` e `sem_registro_recente = 45` seguem em dias absolutos e a `vw_pendencias` da T3 continua verde (não-regressão)
- [ ] Nenhum percentual e nenhuma duração fica escrita em código (AD-004)
- [ ] `docs/schema_sistema.sql` reflete a forma final da tabela (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): limiar de etapa como percentual da duracao prevista (AD-045)`

---

### T5: `fat_prospeccao` — estrutura, índice parcial e auditoria

**What**: Migration criando a tabela de prospecção pré-contrato, com o índice parcial de unicidade e o trigger de auditoria.
**Where**: `supabase/migrations/<ts>_estrategia_fat_prospeccao_estrutura.sql`, `supabase/tests/estrategia/fat-prospeccao-estrutura.integration.test.ts`
**Depends on**: None
**Reuses**: `app.trg_auditoria()`; padrão de `20260813191715_incidencia_encontros_estrutura.sql`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Tabela criada **sem** `id_contrato`, com os 3 CHECKs do design
- [ ] `uq_prospeccao_aberta_contratante` recusa a 2ª prospecção aberta do mesmo contratante+produto (EST-04 edge case)
- [ ] `trg_audit_fat_prospeccao` grava em `log_auditoria` no INSERT e no UPDATE (EST-04 AC2 / AD-006)
- [ ] `docs/schema_sistema.sql` recebe a tabela com comentário referenciando AD-040 (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): fat_prospeccao -- prospeccao pre-contrato (AD-040)`

---

### T6: RLS e GRANT de `fat_prospeccao`

**What**: Migration com as políticas de RLS e os GRANTs da tabela, no espírito de AD-001.
**Where**: `supabase/migrations/<ts>_estrategia_fat_prospeccao_rls.sql`, `supabase/tests/estrategia/fat-prospeccao-rls.integration.test.ts`
**Depends on**: T5
**Reuses**: padrão de `20260813192341_incidencia_encontros_rls.sql`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] RLS habilitada; leitura permitida a Gestora/Admin e ao `id_usuario_resp`; negada às demais (EST-04 AC6)
- [ ] Escrita restrita às roles que podem criar contrato; `anon` sem nenhum privilégio (AD-002)
- [ ] Teste com sessão JWT real por papel, não só `has_table_privilege`
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): RLS e grants de fat_prospeccao (AD-001)`

---

### T7: RPC `app.converter_prospeccao`

**What**: Função Postgres `SECURITY INVOKER` que cria o `fat_contrato` e marca a prospecção como convertida, na mesma transação.
**Where**: `supabase/migrations/<ts>_estrategia_fn_converter_prospeccao.sql`, `supabase/tests/estrategia/fn-converter-prospeccao.integration.test.ts`
**Depends on**: T6
**Reuses**: padrão de `app.mover_etapa_kanban` (`20260812091115`); AD-024
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] `SECURITY INVOKER` explícito; `SECURITY DEFINER` ausente (AD-024)
- [ ] Caminho feliz: cria contrato, seta `status='convertida'`, `id_contrato_gerado` e `dt_desfecho` (EST-04 AC3)
- [ ] Segunda conversão da mesma prospecção falha com erro tipado, sem criar contrato (EST-04 AC4)
- [ ] Falha no meio não deixa contrato órfão — asserido com rollback forçado
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): RPC converter_prospeccao transacional (AD-024)`

---

### T8: `queries/prospeccao.ts`

**What**: Leitura das prospecções abertas de um produto, para alimentar a raia do Quadro.
**Where**: `src/backend/queries/prospeccao.ts`, `src/backend/queries/prospeccao.test.ts`
**Depends on**: T6
**Reuses**: padrão de mock por nome de tabela de `queries/kanban.test.ts`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna só `status='aberta'` do produto pedido
- [ ] Produto sem prospecção retorna `[]`, nunca lança (padrão de `buscarBoardKanban`)
- [ ] Erro do PostgREST propaga como `throw` (padrão do projeto)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query de prospeccoes abertas`

---

### T9: `rpc/prospeccao.ts`

**What**: Wrapper TypeScript da RPC de conversão, com mapeamento dos erros para mensagem.
**Where**: `src/backend/rpc/prospeccao.ts`, `src/backend/rpc/prospeccao.test.ts`
**Depends on**: T7, T8
**Reuses**: `rpc/errors.ts` (`mapearErroConstraint`); padrão de `rpc/kanban.ts`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada parâmetro é repassado verbatim à RPC e asserido individualmente (lição L-004)
- [ ] Cada erro tipado da T7 mapeia para mensagem própria, uma asserção por erro (lição L-003)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): wrapper TS de converter_prospeccao`

---

### T10: Topbar sem "Gestão de Usuários"

**What**: Remover o item da Topbar, deixando marca + "Hub" + avatar.
**Where**: `src/frontend/components/app-shell/topbar.tsx`, `topbar.test.tsx`
**Depends on**: T1
**Reuses**: `Topbar` atual
**Requirement**: EST-05

**Tools**: MCP: `Figma` (T1 `59:4` para conferir a barra) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Topbar renderiza marca, "Hub" e avatar (EST-05 AC1)
- [ ] Topbar **não** renderiza "Gestão de Usuários" — asserção negativa explícita (EST-05 AC2)
- [ ] `npm run lint:frontend` limpo neste arquivo
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(shell): Gestao de Usuarios sai da topbar (EST-05)`

---

### T11: `queries/hub.ts` — cards derivados por leitura

**What**: Montar a lista de cards do Hub, omitindo aquele cuja consulta de contador é negada pelo banco.
**Where**: `src/backend/queries/hub.ts`, `src/backend/queries/hub.test.ts`
**Depends on**: T1
**Reuses**: `PRODUTO_SLUGS`; `mv_numeros_impacto`, `mv_avaliacao_nps`
**Requirement**: EST-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Ordem fixa: Estratégia, PLL, Coalizão, Visão Gerencial, Números de Impacto, Gestão de Usuários (EST-02 AC6)
- [ ] Consulta negada por permissão → card omitido; erro de outra natureza → propaga (EST-02 AC2, AC7)
- [ ] `tipo: 'produto' | 'ferramenta'` correto por card
- [ ] Contagens de mandatos ativos e fatos geradores vêm da consulta, nunca fixas (EST-02 AC3, AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(hub): cards derivados do que a role consegue ler (AD-001)`

---

### T12: Hub com 6 cards e contadores

**What**: Reescrever a página do Hub consumindo `buscarCardsHub`.
**Where**: `src/frontend/app/(app)/page.tsx`, `src/frontend/components/app-shell/hub-card.tsx`, `hub-card.test.tsx`
**Depends on**: T11
**Reuses**: `Card`, `EstadoVazio`, `CarregandoSkeleton`
**Requirement**: EST-02

**Tools**: MCP: `Figma` (T1 `59:4`) · Skill: `ui-ux-pro-max`, `frontend-design`

**Done when**:
- [ ] Renderiza um card por item retornado, na ordem recebida (EST-02 AC1, AC6)
- [ ] Card exibe badge de contador quando presente e o omite quando ausente — caso de teste dos dois lados
- [ ] Subtítulo revisto: não diz mais "Escolha um produto" (risco registrado no design)
- [ ] Clique navega para a rota do destino (EST-02 AC5)
- [ ] `lint:frontend` limpo nos arquivos tocados
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(hub): 6 cards com contadores reais (EST-02)`

---

### T13: Aba "Contratos" vira "Mandatos"

**What**: Renomear a aba no `ProdutoShell` e mover a rota `contratos/` para `mandatos/` no produto.
**Where**: `src/frontend/components/produtos/produto-shell.tsx`, `produto-shell.test.tsx`, `src/frontend/app/(app)/produtos/[slug]/mandatos/page.tsx`
**Depends on**: T1
**Reuses**: `RouteTabs`, `ProdutoShell`
**Requirement**: EST-03

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: NONE

**Done when**:
- [ ] As 4 abas renderizam com "Mandatos" no lugar de "Contratos" (EST-03 AC1)
- [ ] Aba ativa marcada e as demais não — teste dos dois lados (EST-03 AC2)
- [ ] "Voltar ao hub" navega para `/` (EST-03 AC3)
- [ ] Slug inválido retorna 404 (EST-03 AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(estrategia): aba Contratos vira Mandatos (EST-03)`

---

### T14: `classificarLimiar` — função pura

**What**: Traduzir dias na etapa + limiares em `normal | atencao | atrasado`.
**Where**: `src/frontend/lib/limiar.ts`, `src/frontend/lib/limiar.test.ts`
**Depends on**: T2
**Reuses**: padrão de utilitário puro ao lado do consumidor (`planejamento-formato.ts`)
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Um caso de teste **de cada lado** de cada limiar, incluindo o valor exato de fronteira (lição L-001)
- [ ] Limiar ausente ou nulo devolve `normal`, nunca lança
- [ ] Nenhum número mágico no arquivo — limiares chegam por parâmetro (AD-004)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): classificacao de limiar de etapa`

---

### T15: `queries/quadro.ts` — colunas com raia de Prospecção

**What**: Compor as colunas de `ref_etapa` com a raia de prospecção numa estrutura só.
**Where**: `src/backend/queries/quadro.ts`, `src/backend/queries/quadro.test.ts`
**Depends on**: T8, T14
**Reuses**: `buscarBoardKanban`, `ColunaKanban`, `CardKanban`, `buscarProspeccoesAbertas`
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Raia de Prospecção vem primeiro; demais colunas por `ref_etapa.ordem` (EST-07 AC1)
- [ ] Para a Estratégia com o seed atual retorna **7 colunas** (EST-07 AC1)
- [ ] Etapa sem contrato retorna coluna vazia com contador 0 (edge case)
- [ ] Contrato sem `id_etapa_atual` cai em coluna "Sem etapa", nunca some (edge case)
- [ ] Adicionar linha em `ref_etapa` muda a contagem de colunas sem tocar em código (EST-07 AC1b)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): quadro com raia de prospeccao e colunas data-driven`

---

### T16: Componente `QuadroAcompanhamento`

**What**: Renderizar o board com badge de estado por limiar; prospect não arrastável.
**Where**: `src/frontend/components/estrategia/quadro-acompanhamento.tsx`, `.test.tsx`
**Depends on**: T15
**Reuses**: `KanbanBoard`, `KanbanColuna`, `KanbanCard`, `moverEtapaKanban`, `classificarLimiar`
**Requirement**: EST-07

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Card exibe contratante, cargo/partido e dias na etapa (EST-07 AC2)
- [ ] Badge reflete o estado do limiar — um caso de teste por estado (EST-07 AC3)
- [ ] Card da raia de Prospecção não é arrastável para coluna de etapa (AD-040)
- [ ] Estado vazio por coluna renderiza, não some
- [ ] `lint:frontend` limpo
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): Quadro de Acompanhamento (EST-07)`

---

### T17: `queries/pendencias.ts`

**What**: Ler `vw_pendencias` com os filtros do Dashboard.
**Where**: `src/backend/queries/pendencias.ts`, `.test.ts`
**Depends on**: T3
**Reuses**: consumo já existente em `queries/visao-gerencial.ts`
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna as 5 categorias com mandato, tipo, detalhe e data de referência (EST-07 AC4)
- [ ] Sem pendências retorna `[]` (EST-07 AC6)
- [ ] Filtros de gestora e projeto aplicam AND, não OR
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query de pendencias do dashboard`

---

### T18: Componente `TabelaPendencias`

**What**: Tabela acionável das pendências.
**Where**: `src/frontend/components/estrategia/tabela-pendencias.tsx`, `.test.tsx`
**Depends on**: T17
**Reuses**: `Table`, `Badge`, `EstadoVazio`
**Requirement**: EST-07

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Uma linha por pendência, com badge por tipo (EST-07 AC4)
- [ ] Clique navega para o contrato correspondente (EST-07 AC5)
- [ ] Lista vazia renderiza `EstadoVazio`, não tabela vazia (EST-07 AC6)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): tabela de pendencias acionavel (EST-07)`

---

### T19: `queries/mandatos-lista.ts`

**What**: Listar contratos do produto com os 5 filtros do Figma.
**Where**: `src/backend/queries/mandatos-lista.ts`, `.test.ts`
**Depends on**: T13
**Reuses**: `queries/contrato.ts`, `vw_contrato`
**Requirement**: EST-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada filtro (data, gestora, projeto, etapa, status) restringe isoladamente (EST-09 AC3)
- [ ] Dois filtros juntos aplicam AND
- [ ] Prospecções **não** aparecem (EST-04 AC5)
- [ ] Contagem total acompanha o filtro (EST-09 AC2)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query da lista de mandatos com filtros`

---

### T20: Componente `ListaMandatos`

**What**: Grade de cards de contrato.
**Where**: `src/frontend/components/estrategia/lista-mandatos.tsx`, `.test.tsx`
**Depends on**: T19
**Reuses**: `Card`, `Badge`, `EstadoVazio`
**Requirement**: EST-09

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Card exibe contratante, vigência, status, gestora, projeto, etapa e responsável (EST-09 AC1)
- [ ] `dt_fim` nula renderiza "—" (EST-09 AC5 / AD-005)
- [ ] Status traduz `ativo|concluido|nao_concluido` para Ativo|Finalizado|Desligado — um caso por status
- [ ] Lista vazia renderiza estado vazio explicativo (EST-09 AC6)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): lista de mandatos em cards (EST-09)`

---

### T21: Barra de filtros da lista

**What**: Os 5 filtros mais "Limpar filtros" e a contagem.
**Where**: `src/frontend/components/estrategia/filtros-mandatos.tsx`, `.test.tsx`
**Depends on**: T20
**Reuses**: `Select`, `Input`
**Requirement**: EST-09

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Cada filtro altera a consulta e a contagem exibida (EST-09 AC2, AC3)
- [ ] "Limpar filtros" devolve todos ao estado inicial (EST-09 AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): filtros da lista de mandatos (EST-09)`

---

### T22: Novo Contrato — estado de busca TSE

**What**: Estado inicial da tela: busca com mínimo de 3 letras e saída para cadastro manual.
**Where**: `src/frontend/components/produtos/novo-contrato-view.tsx`, `.test.tsx`, `components/fundacao/tse-match-search.tsx`
**Depends on**: T13
**Reuses**: `queries/tse.ts`, `TseMatchSearch`
**Requirement**: EST-10

**Tools**: MCP: `Figma` (T4 `188:192`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Menos de 3 letras não dispara busca; 3 ou mais dispara — teste dos dois lados (EST-10 AC1, AC2)
- [ ] Falha da busca renderiza `ErroInline` e mantém "Cadastro manual" acessível (EST-10 AC8)
- [ ] `lint:frontend` limpo em `tse-match-search.tsx` (2 problemas atuais resolvidos)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): busca TSE do Novo Contrato (EST-10)`

---

### T23: Novo Contrato — formulário em 4 seções

**What**: Formulário preenchido, com campos do TSE somente leitura.
**Where**: `src/frontend/components/fundacao/mandato-wizard.tsx`, `.test.tsx`
**Depends on**: T22
**Reuses**: `schemas/mandato.ts`, `schemas/contrato.ts`, `contratante-fields.tsx`, `contrato-form.tsx`
**Requirement**: EST-10, EST-11

**Tools**: MCP: `Figma` (T2 `188:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] As 4 seções do Figma renderizam com os campos do design
- [ ] Campos vindos do TSE são `readOnly`; no modo manual são editáveis — teste dos dois lados (EST-10 AC3, AC4)
- [ ] "Cancelar e buscar novamente" desfaz o vínculo e reabre a busca (EST-10 AC5)
- [ ] Schema Zod **importado**, não redeclarado inline (lição L-005)
- [ ] `lint:frontend` limpo nos arquivos tocados
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): formulario de Novo Contrato em 4 secoes (EST-10)`

---

### T24: Novo Contrato — submissão transacional

**What**: Ligar o formulário à RPC que cria mandato e contrato juntos, com tratamento de erro.
**Where**: `src/frontend/components/fundacao/mandato-wizard.tsx` (modificar), `.test.tsx`
**Depends on**: T23
**Reuses**: `rpc/mandato.ts`, `rpc/errors.ts`
**Requirement**: EST-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Submissão chama a RPC única; nunca dois inserts sequenciais (EST-11 AC6 / AD-024)
- [ ] Título duplicado exibe mensagem específica e preserva o formulário (EST-11 AC7)
- [ ] Erro propaga por `ErroInline`, o componente padrão (lição L-008)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): submissao transacional de mandato e contrato (EST-11)`

---

### T25: `queries/agenda.ts` — encontros do mês

**What**: Buscar encontros de um mês para o produto, com os filtros da tela.
**Where**: `src/backend/queries/agenda.ts`, `.test.ts`
**Depends on**: T13
**Reuses**: `queries/incidencia.ts`, `fat_encontro`
**Requirement**: EST-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna só encontros dentro do intervalo do mês pedido — teste de fronteira nos dois extremos (lição L-001)
- [ ] Mês sem encontros retorna `[]`, nunca lança (EST-12 / edge case)
- [ ] Filtros de gestora, projeto e contrato aplicam AND
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): query de encontros do mes`

---

### T26: Componente `AgendaMes`

**What**: Grade mensal com os encontros posicionados e navegação entre meses.
**Where**: `src/frontend/components/estrategia/agenda-mes.tsx`, `.test.tsx`
**Depends on**: T25
**Reuses**: `Card`, `Badge`
**Requirement**: EST-12

**Tools**: MCP: `Figma` (T5 `163:4`) · Skill: `ui-ux-pro-max`, `frontend-design`

**Done when**:
- [ ] Encontro aparece na célula do dia correto (EST-12 AC1)
- [ ] Cor reflete o status Agendada/Realizada — um caso por status (EST-12 AC2)
- [ ] Navegar de mês recarrega os encontros (EST-12 AC3)
- [ ] Célula de hoje destacada; caso de teste com hoje dentro e fora do mês exibido (EST-12 AC6, lição L-002 — data de referência explícita, nunca `now()` implícito)
- [ ] Mês vazio renderiza a grade completa (edge case)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): grade mensal de encontros (EST-12)`

---

### T27: `queries/registros-agenda.ts`

**What**: Listar registros, opcionalmente filtrados por encontro.
**Where**: `src/backend/queries/registros-agenda.ts`, `.test.ts`
**Depends on**: T25
**Reuses**: `fat_registro`, `ref_tipo_registro`
**Requirement**: EST-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sem filtro retorna todos do recorte; com `idEncontro` retorna só os dele (EST-12 AC5)
- [ ] Retorna tipo, data, descrição e responsável
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): query de registros da agenda`

---

### T28: Componente `EncontroPopover`

**What**: Popover de detalhe do encontro (leitura).
**Where**: `src/frontend/components/estrategia/encontro-popover.tsx`, `.test.tsx`
**Depends on**: T26, T27
**Reuses**: `Popover`, `Badge`, `encontros-lista.tsx`
**Requirement**: EST-13

**Tools**: MCP: `Figma` (T7 `90:206`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes (EST-13 AC1)
- [ ] Contagem de registros vinculados e link aparecem quando há registros e somem quando não há — teste dos dois lados (EST-13 AC2)
- [ ] Campo nulo renderiza ausência, nunca string vazia (AD-005)
- [ ] `lint:frontend` limpo em `encontros-lista.tsx`
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): popover de detalhe do encontro (EST-13)`

---

### T29: RPC `app.marcar_presenca` + wrapper

**What**: Função Postgres que fecha o encontro como realizado e grava presença, mais o wrapper TS.
**Where**: `supabase/migrations/<ts>_estrategia_fn_marcar_presenca.sql`, `supabase/tests/estrategia/fn-marcar-presenca.integration.test.ts`, `src/backend/rpc/encontro.ts`, `.test.ts`
**Depends on**: T28
**Reuses**: `app.trg_auditoria()`, padrão de `app.mover_etapa_kanban`
**Requirement**: EST-13

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] `SECURITY INVOKER` (AD-024); grava `status='realizado'` e `dt_realizada` (EST-13 AC4)
- [ ] Autor e timestamp registrados em `log_auditoria` (AD-006)
- [ ] Chamada em encontro já realizado é idempotente — não duplica transição (EST-13 AC5)
- [ ] Wrapper assere cada parâmetro repassado (lição L-004)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration + unit · **Gate**: full
**Commit**: `feat(agenda): RPC marcar_presenca idempotente (EST-13)`

---

### T30: Ação de presença e registro no popover

**What**: Ligar "Marcar presença" e "Adicionar registro" no popover.
**Where**: `src/frontend/components/estrategia/encontro-popover.tsx` (modificar), `.test.tsx`
**Depends on**: T29
**Reuses**: `rpc/encontro.ts`, `encontro-form.tsx`
**Requirement**: EST-13

**Tools**: MCP: `Figma` (T7 `90:206`) · Skill: NONE

**Done when**:
- [ ] Aviso e ação aparecem só quando a data passou e o status é `planejado` — teste dos dois lados (EST-13 AC3)
- [ ] Marcar presença atualiza o status na grade (EST-13 AC4)
- [ ] "Adicionar registro" abre a criação já vinculada ao encontro e contrato (EST-13 AC6)
- [ ] `lint:frontend` limpo em `encontro-form.tsx`
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): marcar presenca e adicionar registro no popover (EST-13)`

---

### T31: View `vw_estrategia_kpi`

**What**: Agregar por produto os 6 números do topo do Dashboard.
**Where**: `supabase/migrations/<ts>_estrategia_vw_kpi.sql`, `supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts`
**Depends on**: T3, T5
**Reuses**: `mv_iip_contrato`, `mv_avaliacao_nps`, `vw_pendencias`, `dim_planejamento`
**Requirement**: EST-08

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Os 6 KPIs saem da view, nenhum calculado fora dela (AD-003)
- [ ] View só lê e agrega; não recalcula o IIP (AD-014, AD-015)
- [ ] Sem dado suficiente devolve `NULL`, nunca `0` (AD-005 / EST-08 AC2)
- [ ] `security_invoker = true`; grants coerentes com os `REVOKE` existentes
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): vw_estrategia_kpi na camada Saida (AD-003)`

---

### T32: `queries/estrategia-kpi.ts`

**What**: Ler a view com os filtros de gestora e projeto.
**Where**: `src/backend/queries/estrategia-kpi.ts`, `.test.ts`
**Depends on**: T31
**Reuses**: padrão de `queries/numeros-impacto.ts`
**Requirement**: EST-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Filtros recalculam o recorte (EST-08 AC3)
- [ ] `NULL` do banco chega como ausência, não como `0` (EST-08 AC2)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query dos KPIs do dashboard`

---

### T33: Componente `KpiRow`

**What**: Faixa dos 6 KPIs no topo do Dashboard.
**Where**: `src/frontend/components/estrategia/kpi-row.tsx`, `.test.tsx`
**Depends on**: T32
**Reuses**: `Card`, `chart.tsx`
**Requirement**: EST-08

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`, `dataviz`

**Done when**:
- [ ] Os 6 KPIs renderizam com os rótulos do Figma (EST-08 AC1)
- [ ] Ausência renderiza "—" e presença renderiza o número — teste dos dois lados (EST-08 AC2)
- [ ] `lint:frontend` limpo
- [ ] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `feat(estrategia): faixa de KPIs do dashboard (EST-08)`

---

## Phase Execution Map

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8

Fase 0:  T1
Fase 1:  T2 ──→ T3 ──→ T4
Fase 2:  T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9
Fase 3:  T10 ─→ T11 ─→ T12 ─→ T13
Fase 4:  T14 ─→ T15 ─→ T16 ─→ T17 ─→ T18
Fase 5:  T19 ─→ T20 ─→ T21
Fase 6:  T22 ─→ T23 ─→ T24
Fase 7:  T25 ─→ T26 ─→ T27 ─→ T28 ─→ T29 ─→ T30
Fase 8:  T31 ─→ T32 ─→ T33
```

Dependências que cruzam fases: T14←T2 · T15←T8,T14 · T16←T15 · T17←T3 · T19←T13 ·
T22←T13 · T25←T13 · T31←T3,T5 · T10/T11/T13←T1

---

## Task Granularity Check

| Task | Escopo | Status |
| :-- | :-- | :-- |
| T1 | config + 1 smoke test | ✅ coeso |
| T2, T3, T4 | 1 migration cada | ✅ granular |
| T5, T6, T7 | 1 migration cada | ✅ granular |
| T8, T9 | 1 módulo cada | ✅ granular |
| T10–T13 | 1 componente/módulo cada | ✅ granular |
| T14–T18 | 1 função/módulo/componente cada | ✅ granular |
| T19–T21 | 1 módulo/componente cada | ✅ granular |
| T22–T24 | 1 estado/seção/ligação cada | ✅ granular |
| T25–T28, T30 | 1 módulo/componente cada | ✅ granular |
| T29 | RPC + wrapper (2 arquivos, 1 conceito) | ⚠️ coeso — wrapper sem RPC é intestável |
| T31–T33 | 1 view/módulo/componente cada | ✅ granular |

Nenhum ❌. T29 é a única task multi-arquivo, justificada pela regra de resolução de dependência
de compilação: o wrapper não é testável antes da RPC existir, então merge backward.

---

## Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama | Status |
| :-- | :-- | :-- | :-- |
| T1 | None | início da Fase 0 | ✅ |
| T2 | None | início da Fase 1 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | None | T3→T4 (ordem, não dependência) | ✅ |
| T5 | None | início da Fase 2 | ✅ |
| T6 | T5 | T5→T6 | ✅ |
| T7 | T6 | T6→T7 | ✅ |
| T8 | T6 | T7→T8 (ordem) + nota de cruzamento | ✅ |
| T9 | T7, T8 | T8→T9 | ✅ |
| T10 | T1 | Fase 0→3, nota de cruzamento | ✅ |
| T11 | T1 | T10→T11 (ordem) + nota | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T1 | T12→T13 (ordem) + nota | ✅ |
| T14 | T2 | nota de cruzamento T14←T2 | ✅ |
| T15 | T8, T14 | T14→T15 + nota | ✅ |
| T16 | T15 | T15→T16 | ✅ |
| T17 | T3 | nota de cruzamento T17←T3 | ✅ |
| T18 | T17 | T17→T18 | ✅ |
| T19 | T13 | nota de cruzamento T19←T13 | ✅ |
| T20 | T19 | T19→T20 | ✅ |
| T21 | T20 | T20→T21 | ✅ |
| T22 | T13 | nota de cruzamento T22←T13 | ✅ |
| T23 | T22 | T22→T23 | ✅ |
| T24 | T23 | T23→T24 | ✅ |
| T25 | T13 | nota de cruzamento T25←T13 | ✅ |
| T26 | T25 | T25→T26 | ✅ |
| T27 | T25 | T26→T27 (ordem) + nota | ✅ |
| T28 | T26, T27 | T27→T28 | ✅ |
| T29 | T28 | T28→T29 | ✅ |
| T30 | T29 | T29→T30 | ✅ |
| T31 | T3, T5 | nota de cruzamento | ✅ |
| T32 | T31 | T31→T32 | ✅ |
| T33 | T32 | T32→T33 | ✅ |

Nenhuma dependência aponta para fase posterior. Nenhum ❌.

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matrix exige | Task diz | Status |
| :-- | :-- | :-- | :-- | :-- |
| T1 | config + componente | unit | unit | ✅ |
| T2 | migration/DDL/GRANT | integration | integration | ✅ |
| T3 | view | integration | integration | ✅ |
| T4 | seed | integration | integration | ✅ |
| T5 | migration/DDL | integration | integration | ✅ |
| T6 | RLS/GRANT | integration | integration | ✅ |
| T7 | RPC Postgres | integration | integration | ✅ |
| T8 | `queries/**` | unit | unit | ✅ |
| T9 | `rpc/**` | unit | unit | ✅ |
| T10 | componente React | unit | unit | ✅ |
| T11 | `queries/**` | unit | unit | ✅ |
| T12 | componente React | unit | unit | ✅ |
| T13 | componente React | unit | unit | ✅ |
| T14 | função pura frontend | unit | unit | ✅ |
| T15 | `queries/**` | unit | unit | ✅ |
| T16 | componente React | unit | unit | ✅ |
| T17 | `queries/**` | unit | unit | ✅ |
| T18 | componente React | unit | unit | ✅ |
| T19 | `queries/**` | unit | unit | ✅ |
| T20 | componente React | unit | unit | ✅ |
| T21 | componente React | unit | unit | ✅ |
| T22 | componente React | unit | unit | ✅ |
| T23 | componente React | unit | unit | ✅ |
| T24 | componente React | unit | unit | ✅ |
| T25 | `queries/**` | unit | unit | ✅ |
| T26 | componente React | unit | unit | ✅ |
| T27 | `queries/**` | unit | unit | ✅ |
| T28 | componente React | unit | unit | ✅ |
| T29 | RPC Postgres + `rpc/**` | integration (mais alto) | integration + unit | ✅ |
| T30 | componente React | unit | unit | ✅ |
| T31 | view | integration | integration | ✅ |
| T32 | `queries/**` | unit | unit | ✅ |
| T33 | componente React | unit | unit | ✅ |

Nenhuma ❌ VIOLATION. Nenhum `Tests: none`.

---

## Empacotamento em batches

33 tasks. Empacotando fases inteiras a ~7 tasks por worker, sem nunca dividir uma fase:

| Batch | Fases | Tasks | N |
| :-- | :-- | :-- | :-- |
| 1 | F0 + F1 | T1–T4 | 4 |
| 2 | F2 | T5–T9 | 5 |
| 3 | F3 | T10–T13 | 4 |
| 4 | F4 | T14–T18 | 5 |
| 5 | F5 + F6 | T19–T24 | 6 |
| 6 | F7 | T25–T30 | 6 |
| 7 | F8 | T31–T33 | 3 |

Batches rodam em sequência. Depois do último commit, o **Verifier** roda automaticamente.
