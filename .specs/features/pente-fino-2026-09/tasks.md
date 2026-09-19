# Pente-Fino 2026-09 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/pente-fino-2026-09/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerado por amostragem do repositório (`src/backend/rpc/kanban.test.ts`, `supabase/tests/kanban/*.integration.test.ts`, `src/frontend/components/**/*.test.tsx`) — sem guideline de cobertura formal em `CLAUDE.md`/CI além dos scripts abaixo. Confirmar antes de Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| RPC wrapper (client → `supabase.schema("app").rpc(...)`) | unit | Todos os ramos de erro mapeados (`mapeiaErroRpc`) + chamada com os params corretos | `src/backend/rpc/*.test.ts` | `npm run test:unit` |
| RPC de banco / migration (`app.*`) | integration | Caminho feliz + violação de constraint relevante (ex.: `uq_gip_contrato_momento`, `ck_contrato_status`) | `supabase/tests/<area>/*.integration.test.ts` | `npm run test:integration` |
| Schema Zod | unit | Só quando o schema muda de fato (nenhum PF muda schema existente) | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| Componente React (form/card/toolbar) | unit | 1:1 com as ACs da story que o componente implementa + estado vazio/erro já coberto pelo padrão existente | `src/frontend/components/**/*.test.tsx` | `npm run test:unit` |
| Página (App Router) | unit | Smoke test de render + integração com o(s) componente(s) que ela monta, no padrão já usado por `*/page.test.tsx` | `src/frontend/app/**/*.test.tsx` | `npm run test:unit` |
| Config/rota estática (ex.: nova entrada em `todasAbas`) | none | — coberto pelo teste da página que a rota monta | — | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após task só com teste unit | `npm run test:unit` |
| Full | Após task com migration/RPC de banco (integration) | `npm run test:unit && npm run test:integration` |
| Build | Fim de cada fase | `npm run lint:all && npm run build` |

---

## Execution Plan

Fases rodam em sequência; tasks dentro de uma fase rodam em ordem. Contagem enxuta por pedido do usuário — tasks foram mantidas atômicas (1 componente/função/endpoint), mas duas mudanças no mesmo arquivo/mesmo commit lógico foram mantidas juntas quando são a mesma entrega coesa (regra "2-3 coisas relacionadas no mesmo arquivo = OK se coeso").

### Fase 1: Vínculos (PF-05, PF-06)
```
T1 → T2
```

### Fase 2: Status/Etapa do mandato (PF-04)
```
T3 → T4
```

### Fase 3: Edição de GIP (PF-01)
```
T5 → T6
```

### Fase 4: Sucesso Mensal (PF-02, PF-03)
```
T7 → T8
T9
```

### Fase 5: Filtro do planejamento (PF-09)
```
T10
```

### Fase 6: Aba Gestão da Equipe (PF-10)
```
T11
```

### Fase 7: Remoção do IIP provisório (PF-11)
```
T12
```

### Fase 8: Fatos Geradores (PF-07, PF-08)
```
T13
T14 → T15 → T16
```

---

## Task Breakdown

### T1: Campo de gestoras no formulário de novo contrato

**What**: Adicionar seleção multi-usuário de gestoras ao formulário de novo contrato e persistir o vínculo (`rel_usuario_contrato`, `papel_no_contrato: "gestora"`) ao criar.
**Where**: `src/frontend/app/(app)/produtos/[slug]/novo-contrato/` (componente de formulário existente)
**Depends on**: None
**Reuses**: `vinculoSchema` (`src/backend/schemas/vinculo.ts`), seletor de pessoa já usado em `vinculo-form.tsx`
**Requirement**: PF-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Campo de gestoras aparece no formulário, opcional (não bloqueia submit vazio)
- [ ] Ao criar contrato com gestoras selecionadas, cada uma vira uma linha em `rel_usuario_contrato`
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T2: Vincular usuário na seção Gestoras da Ficha

**What**: Estender `CardPontoFocal` — seção "Gestoras" ganha ação de vincular usuário (multi-seleção, adiciona à lista em vez de substituir).
**Where**: `src/frontend/components/fundacao/card-ponto-focal.tsx`
**Depends on**: None
**Reuses**: mesmo `Select` + botão "Vincular usuário" já usado na seção "Ponto Focal" (linhas 96-139)
**Requirement**: PF-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Seção Gestoras exibe ação de vincular usuário quando vazia ou com gestoras existentes
- [ ] Vínculo novo aparece na lista sem remover as gestoras já vinculadas
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T3: RPC/caminho de escrita para Status do contrato

**What**: Confirmar se já existe caminho de update de `contrato.status`; se não existir, criar `atualizarStatusContrato(client, idContrato, status, motivoEncerramento?)` em `src/backend/rpc/contrato.ts`, respeitando `ck_contrato_motivo`.
**Where**: `src/backend/rpc/contrato.ts` (novo arquivo, ou extensão do existente se a investigação achar um)
**Depends on**: None
**Reuses**: `contratoSchema` (`src/backend/schemas/contrato.ts`)
**Requirement**: PF-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Investigação registrada no commit (achou caminho existente ou confirmou que precisava de um novo)
- [ ] Update rejeita `status = 'nao_concluido'` sem `motivo_encerramento`
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T4: Edição de Status e Etapa na página de informações

**What**: Adicionar campos de edição de Status (via T3) e Etapa (via `moverEtapaKanban` já existente) na página de informações gerais.
**Where**: `src/frontend/app/(app)/contratos/[id]/informacoes/page.tsx`
**Depends on**: T3
**Reuses**: `moverEtapaKanban` (`src/backend/rpc/kanban.ts`) sem mudança
**Requirement**: PF-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Editar Etapa pela Ficha reflete no Kanban do mesmo contrato (mesma fonte de dados)
- [ ] Transição de etapa inválida é recusada com a mesma regra do Kanban
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T5: RLS de UPDATE em `fat_submissao` para GIP aplicado

**What**: Migration permitindo `UPDATE` em `fat_submissao` pela mesma regra de papel que já permite `INSERT`, sem tocar `uq_gip_contrato_momento`.
**Where**: `supabase/migrations/<timestamp>_gip_fat_submissao_update_rls.sql`
**Depends on**: None
**Reuses**: policy de `INSERT` já existente como referência de papel/critério
**Requirement**: PF-01

**Tools**:
- MCP: `supabase` (se disponível na sessão) ou CLI `supabase migration new`
- Skill: NONE

**Done when**:
- [ ] Migration criada via `supabase migration new`, aplicada em dev (`supabase db push`, ambiente de dev confirmado)
- [ ] Teste de integração cobre: papel autorizado consegue `UPDATE` na própria submissão; `uq_gip_contrato_momento` continua bloqueando um segundo `INSERT`
- [ ] `npm run test:integration` passa

**Tests**: integration
**Gate**: full

---

### T6: Ação de editar momento de GIP aplicado

**What**: `gip-regua.tsx` troca o estado somente-leitura de um momento aplicado por uma ação de edição que faz `UPDATE` em `fat_submissao` (T5), reaproveitando `formulario-gip-form.tsx`.
**Where**: `src/frontend/components/produtos/gip-regua.tsx`
**Depends on**: T5
**Reuses**: `formulario-gip-form.tsx`
**Requirement**: PF-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Momento já aplicado mostra ação de edição em vez de só o texto "já aplicado"
- [ ] Salvar edição persiste via `UPDATE`, sem criar segunda linha nem mudar tipo/status do momento
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T7: RPC `atualiza_sucesso_mensal` (mês, data-limite, peso)

**What**: Nova função de banco `app.atualiza_sucesso_mensal(p_id_sucesso, p_mes, p_dt_limite, p_peso)` (SECURITY INVOKER) + wrapper `atualizarSucessoMensal` em `src/backend/rpc/planejamento.ts`.
**Where**: `supabase/migrations/<timestamp>_planejamento_atualiza_sucesso_mensal.sql`, `src/backend/rpc/planejamento.ts`
**Depends on**: None
**Reuses**: padrão `SECURITY INVOKER` já usado por `atualiza_sucessos_mensais_lote`
**Requirement**: PF-02

**Tools**:
- MCP: `supabase` (se disponível) ou CLI
- Skill: NONE

**Done when**:
- [ ] Migration aplicada em dev via `supabase db push`
- [ ] Wrapper chama a RPC com os params corretos, erros mapeados por `mapeiaErroRpc`
- [ ] Teste de integração cobre update de mês/data-limite/peso numa linha existente
- [ ] `npm run test:integration` passa

**Tests**: integration
**Gate**: full

---

### T8: Edição de Sucesso Mensal na planilha de estrutura

**What**: `sucesso-mensal-form.tsx` ganha `modo: "editar"` (mesmo padrão de `VinculoFormModo`) usando T7; Situação passa a ser exibida como derivada do `pct_atingimento` corrente, nunca setada manualmente no form de edição.
**Where**: `src/frontend/components/planejamento/sucesso-mensal-form.tsx`
**Depends on**: T7
**Reuses**: `VinculoFormModo` como referência de padrão
**Requirement**: PF-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sucesso Mensal existente pode ter mês, data-limite e peso editados
- [ ] Situação exibida muda de acordo com o `pct_atingimento` corrente após a edição, sem input manual
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T9: Prazo relativo ao mês em `cria_sucessos_mensais_lote`

**What**: Alterar `app.cria_sucessos_mensais_lote` para aplicar o **dia** do prazo informado a cada mês de `p_meses`, em vez de uma data fixa única.
**Where**: `supabase/migrations/<timestamp>_planejamento_prazo_relativo_ao_mes.sql`
**Depends on**: None
**Reuses**: mesma função, mesmo client wrapper (`criarSucessosEmLote`) — sem mudança de assinatura
**Requirement**: PF-03

**Tools**:
- MCP: `supabase` (se disponível) ou CLI
- Skill: NONE

**Done when**:
- [ ] Migration aplicada em dev via `supabase db push`
- [ ] Teste de integração: lote de 3 meses com prazo "dia 10" gera vencimento dia 10 em cada mês; lote de 1 mês mantém comportamento atual (sem regressão)
- [ ] `npm run test:integration` passa

**Tests**: integration
**Gate**: full

---

### T10: Filtro por mês no planejamento estratégico

**What**: `PlanejamentoToolbar` ganha `mes`/`onMesChange` (mesmo padrão de `busca`/`onBuscaChange`); `PlanejamentoGrade` aplica o filtro e formata a coluna Mês como "Mês/Ano".
**Where**: `src/frontend/components/planejamento/planejamento-toolbar.tsx`, `planejamento-grade.tsx`
**Depends on**: None
**Reuses**: predicado de filtro já existente em `PlanejamentoGrade`; formatter de data existente no projeto (confirmar antes de criar um novo)
**Requirement**: PF-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtrar por mês mostra só os itens daquele mês
- [ ] Coluna Mês exibe formato "Mês/Ano" (ex.: "Junho/26")
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T11: Aba Gestão da Equipe — CANCELADA

**Status**: ❌ Cancelada na Execute, nenhum código escrito.
**Motivo**: investigação do worker (Batch 2) achou que `todasAbas` em
`ficha-contrato-chrome.tsx` já tem `{ href: "${base}/vinculos", label:
"Gestão da equipe" }`, rota real e funcional (não placeholder), da feature
`ficha-mandato-contrato` (comentário no código: substituiu o rótulo antigo
"Assessores", AC4/FMC-03). Implementar T11 como especificada criaria uma
segunda aba com o mesmo rótulo — regressão de navegação, não fix. Pedro
confirmou (2026-09-18) que o pedido original já está resolvido por essa aba.
Ver `spec.md` PF-10 para o registro completo.
**Requirement**: PF-10

---

### T12: Remover IIP provisório, adicionar link + voltar

**What**: Remove `<IipCard>` de `ficha-contrato-chrome.tsx`; adiciona botão/link para a aba "Fatos Geradores e Registros" e botão voltar para `/produtos/[slug]/estrategia/dashboard`. Confirma se `iip-card.tsx`/`buscarIipContrato`/`atualizaIipContrato` ficam sem outro consumidor e, se sim, remove o código morto junto.
**Where**: `src/frontend/components/produtos/ficha-contrato-chrome.tsx`
**Depends on**: None
**Reuses**: nenhum componente novo
**Requirement**: PF-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Card IIP não aparece mais em nenhuma subtela do contrato
- [ ] Link para a aba de Incidência e botão voltar funcionam
- [ ] Investigação de consumidor órfão registrada no commit (removeu ou justificou manter)
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T13: Redesenho do formulário de Fato Gerador conforme Figma

**What**: Ajusta layout de `fato-gerador-form.tsx`/`fato-gerador-wizard.tsx` para bater com os 2 frames do Figma (node-id 118-6 e 118-96), sem sobreposição de campos e sem mudar campos/validação.
**Where**: `src/frontend/components/incidencia/fato-gerador-form.tsx`
**Depends on**: None
**Reuses**: todos os campos/validações atuais
**Requirement**: PF-07

**Tools**:
- MCP: `Figma` (get_design_context / get_screenshot nos 2 node-ids)
- Skill: `figma-dominio-legisla`

**Done when**:
- [ ] Layout confere visualmente com os 2 frames (checado via screenshot do Figma lado a lado)
- [ ] Nenhum campo sobreposto a outro em nenhuma resolução suportada
- [ ] `npm run test:unit` passa (nenhum teste de campo/validação quebrado)

**Tests**: unit
**Gate**: quick

---

### T14: Card de fato gerador — identificação visual + ação "realizado" + remoção do botão indevido

**What**: No componente de card usado pela Linha do Tempo e pelo Ciclo de Vida: diferencia visualmente "projetado" de "realizado", adiciona ação de marcar como realizado (reusando `RealizarFatoDialog`, já existente conforme handoff de `fatos-geradores-ciclo-vida`), remove o botão "Registrar Registro" das duas visões.
**Where**: componente de card compartilhado da feature `fatos-geradores-ciclo-vida` (confirmar arquivo exato lendo `.specs/features/fatos-geradores-ciclo-vida/design.md` antes de editar)
**Depends on**: None
**Reuses**: `RealizarFatoDialog`
**Requirement**: PF-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Fato "projetado" visualmente diferente de "realizado" nas duas visões
- [ ] Ação de marcar como realizado funciona a partir do card nas duas visões
- [ ] Botão "Registrar Registro" não aparece mais em nenhuma das duas visões (continua existindo na Agenda)
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T15: KPIs no Ciclo de Vida

**What**: Exibe os KPIs já definidos para a página de Ciclo de Vida (hoje ausentes) — reusa query existente se houver uma pronta sem consumidor.
**Where**: componente/página do Ciclo de Vida (feature `fatos-geradores-ciclo-vida`)
**Depends on**: T14
**Reuses**: query de KPI existente, se confirmada em `estrategia-kpi.ts` ou equivalente
**Requirement**: PF-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] KPIs visíveis na página de Ciclo de Vida
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

### T16: Clique no card abre detalhe da origem no Ciclo de Vida

**What**: Clicar em um card no Ciclo de Vida abre o detalhe da origem e do fato gerador associado.
**Where**: componente do Ciclo de Vida (feature `fatos-geradores-ciclo-vida`)
**Depends on**: T14
**Reuses**: modal/dialog de detalhe já existente, se houver (confirmar antes de criar um novo)
**Requirement**: PF-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Clique no card abre o detalhe correto (origem + fato gerador)
- [ ] `npm run test:unit` passa

**Tests**: unit
**Gate**: quick

---

## Phase Execution Map

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8

Fase 1:  T1 ──→ T2
Fase 2:  T3 ──→ T4
Fase 3:  T5 ──→ T6
Fase 4:  T7 ──→ T8       T9 (independente de T7/T8, mesma fase)
Fase 5:  T10
Fase 6:  T11
Fase 7:  T12
Fase 8:  T13       T14 ──→ T15 ──→ T16
```

Execução é sequencial dentro da fase. Fases entre si não têm dependência de dados — a ordem acima é só a ordem de execução escolhida, não uma cadeia obrigatória (poderiam rodar em qualquer ordem entre fases).

**16 tasks totais** — abaixo do threshold de sub-agentes múltiplos (~8) só por pouco; empacotamento em ~7/lote deve gerar **2-3 lotes** (ex.: Fases 1-4 = 9 tasks, Fases 5-8 = 7 tasks — ou Fases 1-3+parte de 4 conforme o corte real no Execute).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Campo de gestoras no cadastro | 1 formulário + 1 insert | ✅ Granular (coeso, mesmo arquivo) |
| T2: Vincular usuário — Gestoras | 1 componente | ✅ Granular |
| T3: RPC Status do contrato | 1 função/RPC | ✅ Granular |
| T4: Edição Status/Etapa na Ficha | 1 página | ✅ Granular |
| T5: RLS UPDATE `fat_submissao` | 1 migration | ✅ Granular |
| T6: Ação editar GIP aplicado | 1 componente | ✅ Granular |
| T7: RPC `atualiza_sucesso_mensal` | 1 migration + 1 wrapper | ✅ Granular (coeso, mesma entrega) |
| T8: Edição de Sucesso Mensal | 1 componente | ✅ Granular |
| T9: Prazo relativo ao mês | 1 migration | ✅ Granular |
| T10: Filtro por mês | 2 componentes irmãos, 1 concern | ✅ Granular (coeso, acoplados) |
| T11: Aba Gestão da Equipe | 1 rota + 1 entrada de nav | ✅ Granular (coeso, mesma entrega) |
| T12: Remover IIP | 1 componente | ✅ Granular |
| T13: Redesenho form Fato Gerador | 1 componente (layout) | ✅ Granular |
| T14: Card — visual + realizado + botão | 1 componente | ✅ Granular |
| T15: KPIs Ciclo de Vida | 1 componente/página | ✅ Granular |
| T16: Clique → detalhe | 1 componente/página | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | None | Nenhuma seta de entrada | ✅ Match |
| T3 | None | Nenhuma seta de entrada | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | None | Nenhuma seta de entrada | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | None | Nenhuma seta de entrada | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | None | Nenhuma seta de entrada (paralelo a T7→T8 na mesma fase) | ✅ Match |
| T10 | None | Nenhuma seta de entrada | ✅ Match |
| T11 | None | Nenhuma seta de entrada | ✅ Match |
| T12 | None | Nenhuma seta de entrada | ✅ Match |
| T13 | None | Nenhuma seta de entrada | ✅ Match |
| T14 | None | Nenhuma seta de entrada | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |
| T16 | T14 | T14 → T16 | ✅ Match |

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Componente (form) | unit | unit | ✅ OK |
| T2 | Componente | unit | unit | ✅ OK |
| T3 | RPC wrapper | unit | unit | ✅ OK |
| T4 | Página | unit | unit | ✅ OK |
| T5 | RPC de banco/migration | integration | integration | ✅ OK |
| T6 | Componente | unit | unit | ✅ OK |
| T7 | RPC de banco + wrapper | integration (maior exigência entre as 2 camadas) | integration | ✅ OK |
| T8 | Componente | unit | unit | ✅ OK |
| T9 | RPC de banco/migration | integration | integration | ✅ OK |
| T10 | Componente | unit | unit | ✅ OK |
| T11 | Página + config de rota | unit (página) | unit | ✅ OK |
| T12 | Componente | unit | unit | ✅ OK |
| T13 | Componente | unit | unit | ✅ OK |
| T14 | Componente | unit | unit | ✅ OK |
| T15 | Componente/página | unit | unit | ✅ OK |
| T16 | Componente/página | unit | unit | ✅ OK |

Nenhuma violação — todas as tasks com migration/RPC de banco (T5, T7, T9) carregam teste de integração na mesma task, não numa task separada.
