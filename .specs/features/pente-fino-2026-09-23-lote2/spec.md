# Pente-Fino 2026-09-23 (Lote 2) Specification

## Problem Statement

5 bugs abertos por Pedro em `docs/pente-fino-backup-2026-09-23.json`, todos
no produto PLL, reportados via screenshot contra o preview de `develop`.
Investigação de código + comparação com os screenshots mostrou que 2 dos 5
itens (rota duplicada, campo "Etapa do produto") já foram resolvidos pela
feature `diagnostico-participante-pll` (commit `2c1080d`, ainda não
propagado ao preview no momento dos screenshots) — ficam só como
confirmação/ajuste fino, não reimplementação.

## Goals

- [ ] PF3-01: "Ver ficha" na lista de participantes do PLL leva pra ficha do
      contrato (`/contratos/[id]/informacoes`) quando o participante já tem
      `id_contrato`; mantém a página standalone só como fallback pra quem
      ainda não tem contrato.
- [ ] PF3-02: "Composição Partidária da Casa" na ficha do participante PLL
      vira gráfico donut (reusa `RoscaAnalise`), em vez de lista de texto.
- [ ] PF3-03: Filtro "Gestora" em `/produtos/pll/fatos-geradores` vira
      "Mentor" para o produto PLL (PLL não tem gestora).
- [ ] PF3-04: Confirmar que "Etapa do produto" não aparece mais na ficha de
      Informações Gerais de um contrato PLL (já resolvido por
      `InformacoesGeraisPllPainel` — sem código novo).
- [ ] PF3-05: Coluna "Edição" na tabela de Mentorados do Dashboard PLL passa
      a mostrar o nome real da edição (`fat_edicao.nome`, ex. "PLL 2026.1"),
      não o nome do projeto (`ref_projeto.nome`).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Unificar navegação de Mandatos/outros produtos que também usam `FiltrosFatosGeradores` | Bug reportado é só de `/produtos/pll/fatos-geradores`; `mandatos/page.tsx` não foi citado e continua com "Gestora" (mesmo comportamento de hoje). |
| Filtro "Filtrar por edição" do Dashboard PLL (`dashboard/page.tsx:364-369`, hoje usa `ref_projeto` com comentário "Edição é ref_projeto (D-4)") | Mesma causa raiz de PF3-05, mas é decisão de design já registrada (D-4) fora do escopo do bug relatado (coluna da tabela, não o filtro) — sinalizar ao Pedro depois, não mudar em silêncio. |
| Migração de dado histórico (`fat_contrato` sem `id_edicao` retroativo) | Nenhuma migration nesta rodada — leitura só segue o vínculo que já existe via `fat_cadastro_participante.id_edicao`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| PF3-01: critério de "já vinculado" | `fat_cadastro_participante.id_contrato IS NOT NULL` (mesmo campo que já resolve elegibilidade de vínculo TSE) | Único sinal disponível hoje sem nova coluna | y — Pedro escolheu "Unificar por vínculo" via pergunta |
| PF3-02: forma do gráfico | Donut via `RoscaAnalise` (mesmo componente do Dashboard PLL), mapeando `siglaPartido→categoria`, `quantidade`, `percentual`; `n` = soma de `quantidade` | Reuso de padrão já validado, consistência visual | y — Pedro escolheu via pergunta |
| PF3-03: fonte do filtro de Mentor | `buscarOpcoesMentorPll` (já existe, usado no Dashboard PLL) | Mesmo padrão D-4 já estabelecido pro produto | n — decisão técnica de baixo risco, sem ambiguidade de produto |
| PF3-05: qual nome de edição exibir quando `id_edicao` é nulo (contrato antigo, pré-migration `fat_edicao`) | Mostra "—" (mesmo padrão AD-005 de ausência), nunca volta a mostrar o nome do projeto | Evita reintroduzir o bug relatado como fallback silencioso | n — assumido, baixo risco (edge case já coberto pelo padrão geral do código) |

**Open questions:** nenhuma bloqueante.

---

## User Stories

### P1: Corrigir dado errado exibido (PF3-05) ⭐ MVP

**User Story**: Como Gestora/Mentor, quero que a coluna "Edição" da tabela
de Mentorados do Dashboard PLL mostre o código real da edição (ex. "PLL
2026.1"), não o nome do projeto vinculado ao contrato.

**Acceptance Criteria**:

1. WHEN um contrato tem `fat_cadastro_participante.id_edicao` preenchido
   THEN a coluna "Edição" SHALL mostrar `fat_edicao.nome` desse registro.
2. WHEN `id_edicao` é nulo THEN a coluna SHALL mostrar "—" (nunca o nome do
   projeto).

**Independent Test**: Abrir `/produtos/pll/dashboard`, conferir que a coluna
"Edição" mostra o mesmo valor que aparece no seletor de edição da aba
Participantes (`buscarEdicoesPll`), para o mesmo contrato.

---

### P1: Filtro Mentor em Fatos Geradores do PLL (PF3-03)

**User Story**: Como Gestora/Mentor do PLL, quero filtrar
`/produtos/pll/fatos-geradores` por Mentor (não por Gestora, papel que o PLL
não usa).

**Acceptance Criteria**:

1. WHEN o produto é PLL THEN a barra de filtros SHALL mostrar "Mentor" no
   lugar de "Gestora", com as opções vindas de `buscarOpcoesMentorPll`.
2. WHEN um ou mais mentores são selecionados THEN a lista de mandatos SHALL
   ficar restrita aos contratos com vínculo ativo (`papel_no_contrato =
   'mentor'`, `dt_fim IS NULL`) de algum dos mentores marcados.
3. WHEN o produto NÃO é PLL THEN o filtro SHALL continuar "Gestora", igual a
   hoje (sem regressão em Estratégia/Coalizão/Mandato).

**Independent Test**: Abrir `/produtos/pll/fatos-geradores`, selecionar um
mentor, conferir que só os contratos dele aparecem; comparar com
`/produtos/estrategia/fatos-geradores` (se existir) continuando com
"Gestora".

---

### P1: Gráfico de Composição Partidária (PF3-02)

**User Story**: Como Mentor/Gestora, quero ver a Composição Partidária da
Casa como gráfico visual (não uma lista de texto crua) na ficha do
participante PLL.

**Acceptance Criteria**:

1. WHEN a ficha do participante PLL mostra Composição Partidária da Casa
   THEN o bloco SHALL renderizar um donut (`RoscaAnalise`) com as mesmas
   siglas/quantidades/percentuais já calculados.
2. WHEN a composição está vazia THEN o bloco SHALL continuar mostrando
   `EstadoVazio` (sem regressão do estado já tratado).
3. WHEN o bloco renderiza em `/produtos/pll/participantes/[id]` e em
   `/contratos/[id]/diagnostico` (mesmo componente reaproveitado) THEN
   ambos SHALL mostrar o gráfico igual.

**Independent Test**: Abrir a ficha de um participante PLL vinculado ao TSE
com composição partidária carregada; conferir o donut nas duas rotas que
reaproveitam `ComposicaoPartidariaCasa`.

---

### P2: Rota única para participante já vinculado (PF3-01)

**User Story**: Como Gestora/Mentor, ao clicar "Ver ficha" num participante
do PLL que já tem contrato, quero ir direto pra ficha completa do contrato
(com Agenda/Diagnóstico/Informações Gerais), não pra página standalone
limitada.

**Acceptance Criteria**:

1. WHEN o participante tem `id_contrato` preenchido THEN "Ver ficha" SHALL
   navegar para `/contratos/[idContrato]/informacoes`.
2. WHEN o participante NÃO tem `id_contrato` (ainda não vinculado ao TSE)
   THEN "Ver ficha" SHALL continuar navegando para
   `/produtos/pll/participantes/[idCadastroParticipante]`, igual a hoje.

**Independent Test**: Na lista de participantes do PLL, um participante já
vinculado (✓ na coluna TSE) leva pra ficha de contrato; um não vinculado (✕)
continua indo pra página standalone.

---

### P3: Confirmar remoção de "Etapa do produto" (PF3-04)

**User Story**: Como Gestora, não quero ver "Etapa do produto" na ficha de
Informações Gerais de um contrato PLL, já que o produto não usa esse campo
nessa tela.

**Acceptance Criteria**:

1. WHEN a aba Informações Gerais de um contrato PLL renderiza THEN o campo
   "Etapa do produto" SHALL estar ausente (já resolvido por
   `InformacoesGeraisPllPainel` — validar com teste existente, sem UI nova).

**Independent Test**: Abrir `/contratos/[id]/informacoes` de um contrato
PLL; confirmar ausência do campo (revisão de código + teste já existente de
`informacoes-gerais-pll.test.tsx`, sem screenshot novo necessário).

---

## Edge Cases

- WHEN `fat_cadastro_participante` tem mais de uma linha pro mesmo
  `id_contrato` (troca de vínculo) THEN a busca de `id_edicao` (PF3-05)
  SHALL usar a mesma linha "mais recente" que `buscarMentoradosPll` já
  escolhe pra `nomeMentorado` (mesmo `atualizado_em` já ordenado).
- WHEN nenhum mentor tem vínculo ativo em nenhum contrato PLL (produto novo,
  sem mentor ainda) THEN o filtro de Mentor (PF3-03) SHALL mostrar lista
  vazia, sem erro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PF3-01 | P2: Rota única | Verified | Verified |
| PF3-02 | P1: Gráfico Composição | Verified | Verified (gap AC3 fechado) |
| PF3-03 | P1: Filtro Mentor | Verified | Verified (gaps de KPI/edge case fechados) |
| PF3-04 | P3: Confirmar Etapa | Verified | Verified |
| PF3-05 | P1: Coluna Edição | Verified | Verified |

**Coverage:** 5 total, 5 mapped (execução inline, sem `tasks.md` formal —
escopo Medium, cada item ≤3 arquivos).

---

## Success Criteria

- [ ] `npm run test:unit` verde nos arquivos tocados, sem regressão nos
      testes existentes de Mandatos/Fatos Geradores/Dashboard PLL.
- [ ] `npm run lint:all && npm run build` verde ao final.
