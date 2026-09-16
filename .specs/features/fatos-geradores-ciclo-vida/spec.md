# Fatos Geradores — Linha do Tempo e Ciclo de Vida Specification

- **Gate AD-039:** ✅ satisfeito — Pedro validou as telas com a operação antes desta spec (2026-09-15).

## Problem Statement

`incidencia-encontros` (2026-08-14) provisionou todo o dado de Incidência —
`fat_fato_gerador`, `rel_fato_origem`, `fat_insight`, `fat_registro`,
`mv_iip_contrato` — mas a UI de leitura ficou como placeholder. Pedro desenhou
em set/2026 as quatro telas que fecham essa lacuna: uma **Linha do Tempo**
cronológica, um **Ciclo de Vida** que mostra como um sinal vira resultado, e um
wizard de dois passos para registrar o Fato Gerador.

O desenho trouxe **cinco capacidades novas** — Pré-Insight como entidade, fato
que ainda não aconteceu, título no fato, cadeias, e Registro como origem — todas
decididas com Pedro antes desta spec (`context.md`).

A revisão de mockup achou **19 divergências**, e quatro são **reincidências** já
catalogadas na skill `figma-dominio-legisla`: os nomes das dimensões D1/D2/D3
voltaram — e voltaram **diferentes entre as duas telas**, o que é a própria
prova de que são invenção; a régua voltou com 5 níveis quando `ref_nivel_iip`
tem 4; e `dt_ocorrencia` voltou com hora.

## Goals

- [ ] Linha do Tempo (`108:4`) com feed cronológico filtrável por tipo e painel
      de detalhe lateral.
- [ ] Ciclo de Vida (`109:4`) com KPIs e cadeias derivadas por view.
- [ ] Wizard de dois passos (`118:6`, `118:96`) com a tripla encadeada e os
      níveis/preditores como leitura derivada.
- [ ] `fat_pre_insight` provisionada com RLS no mesmo DDL (AD-001).
- [ ] Fato projetado que vira realizado sem perder rastro, e **sem entrar no
      IIP** enquanto projetado.
- [ ] Vocabulário canônico: dimensões sem nome, 4 níveis, datas sem hora.
- [ ] **A aba vira a casa única da Incidência**: criar, editar e ler Registro,
      Pré-Insight, Insight e Fato Gerador num lugar só, aposentando os três
      pontos de entrada espalhados de hoje.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Fórmula do IIP | Decisão D2 segue com a área de conhecimento. A tela exibe o que `vw_iip_contrato` devolve, sempre rotulado **(provisório)** |
| Aba "Planejado" (3º modo em `108:4`) | Só o rótulo foi desenhado, sem conteúdo |
| Badges isolados D1/D2/D3 nos cards de `109:4` | Significado não definido; se for "dimensão dominante" é derivação nova, sem regra aprovada |
| KPI "12/15" com denominador | O 15 não tem origem no schema. Vira contagem absoluta + "N projeções em aberto" |
| Nomear/curar cadeias à mão | Cadeia é derivada (D-8). Nomear exigiria entidade persistida |
| Alinhar o nome da aba entre as duas telas | `108:4` diz "Fatos Geradores e Registros", `109:4` diz "Fatos Geradores". É spec de navegação |
| Listagem de Registros da Agenda (`/produtos/[slug]/agenda`) | **Permanece como está.** A Agenda é visão de calendário (mês, presença em Encontro); a aba é visão de incidência. Consolidar as duas seria fundir propósitos diferentes |
| Encontro (`fat_encontro`) e participantes | Entregue por `incidencia-encontros`, vive na Agenda. Registro pode apontar para Encontro, mas gerenciar Encontro não é desta aba |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Pré-Insight é entidade | Tabela `fat_pre_insight`, escopada por contrato | Decisão de Pedro | y |
| Fato futuro | `situacao` (`projetado`/`realizado`) + `dt_prevista` | Decisão de Pedro | y |
| Projeção no IIP | **Não entra** — `mv_iip_contrato` filtra `situacao = 'realizado'` | A tela `109:4` já declara "Somente realizados" | y |
| Cadeia | Derivada por view; "Cadeia A/B/C" é rótulo posicional, não identidade | Decisão de Pedro; respeita AD-003 | y |
| Origens do fato | As quatro (Pré-Insight, Registro, Insight, Meta) | Decisão de Pedro | y |
| Título do fato | Coluna nullable no banco, obrigatória no formulário novo; fatos antigos exibem `descricao_evidencia` truncada | `NOT NULL` quebraria fatos já gravados, e forward-only não volta atrás | n |
| Pré-Insight vira Insight? | **Coexistem** — promover não apaga o Pré-Insight | A timeline mostra os dois tipos lado a lado. Revisitar em Design |  n |

**Open questions:** nenhuma bloqueante. As duas linhas `n` são assunções com
default escolhido; a segunda é reaberta explicitamente em Design.

---

## User Stories

### P1: Registrar Fato Gerador pelo wizard ⭐ MVP

**User Story**: Como Mentor, quero registrar um Fato Gerador em dois passos —
primeiro de onde ele nasce, depois o que ele é — para não ter que preencher um
formulário longo sem contexto.

**Why P1**: É o único caminho de escrita da feature.

**Acceptance Criteria**:

1. WHEN o passo 1 abre THEN o sistema SHALL perguntar a natureza
   (**Já aconteceu** / **Ainda vai acontecer**) e se nasce de algo já registrado.
2. WHEN o usuário escolhe vincular a uma origem THEN o sistema SHALL oferecer
   as quatro abas **Pré-Insight · Registro · Insight · Meta**, com busca textual.
3. WHEN o usuário escolhe "fato sem origem" THEN o sistema SHALL permitir
   concluir o cadastro — fato sem origem é **caso válido**, nunca marcado como
   erro ou pendência.
4. WHEN a origem é listada THEN SHALL conter apenas itens do **mesmo contrato**.
5. WHEN o passo 2 abre THEN o sistema SHALL exigir **Título**, e exibir a
   tripla **Grupo › Tipologia › Estado** como três selects encadeados.
6. WHEN o usuário escolhe um Grupo THEN o select de Tipologia SHALL oferecer
   somente as tipologias daquele grupo, e o de Estado somente os estados
   daquela tipologia (as 51 combinações de `uq_tipologia_tripla`).
7. WHEN a tripla fica completa THEN o sistema SHALL preencher **Nível D1, D2, D3
   e Preditor 1 e 2** a partir dos padrões da tipologia, exibidos como
   **leitura** — nunca selects livres.
8. WHEN os níveis são exibidos THEN a régua SHALL ter **4 posições** e usar os
   rótulos **Baixo · Médio · Alto · Máximo** — não existe Nível 5.
9. WHEN as dimensões são rotuladas THEN SHALL aparecer **Nível D1**, **Nível D2**,
   **Nível D3**, sem legenda descritiva.
10. WHEN a natureza é **Já aconteceu** THEN **Data de ocorrência** SHALL ser
    obrigatória, como data sem hora.
11. WHEN a natureza é **Ainda vai acontecer** THEN o sistema SHALL pedir
    **Data prevista** e SHALL NOT pedir data de ocorrência.
12. WHEN **Contribuição Legisla** é exibida THEN SHALL ser opcional, de 0 a 5.

**Independent Test**: registrar um fato escolhendo
`2. Produção Legislativa › Projeto de lei / proposição › Em tramitação ativa`;
os níveis exibidos são **Baixo / Médio / Médio**, conforme o seed.

---

### P1: Pré-Insight como entidade ⭐ MVP

**User Story**: Como Assessor, quero registrar um sinal bruto que ainda não
amadureceu em Insight, para não perder a informação enquanto ela não se
qualifica.

**Why P1**: Três das quatro telas dependem dele.

**Acceptance Criteria**:

1. WHEN a migration é aplicada THEN `fat_pre_insight` SHALL existir escopada por
   contrato, com política de RLS **no mesmo DDL** (AD-001) e com autor +
   timestamp (AD-006).
2. WHEN um Pré-Insight é criado THEN o autor SHALL ser resolvido pela sessão,
   nunca digitado.
3. WHEN a Linha do Tempo carrega THEN Pré-Insights SHALL aparecer com
   identidade visual própria, distinta de Insight e de Registro.
4. WHEN um Pré-Insight é usado como origem de Fato Gerador THEN SHALL continuar
   existindo por si — não é consumido pelo vínculo.

**Independent Test**: criar Pré-Insight com um usuário sem vínculo no contrato;
a RLS recusa.

---

### P1: Fato projetado e sua realização ⭐ MVP

**User Story**: Como Mentor, quero registrar o que **esperamos** que aconteça e
depois marcá-lo como realizado, para que a projeção não se misture ao resultado.

**Why P1**: A cadeia projetada e o KPI de projeções dependem disso.

**Acceptance Criteria**:

1. WHEN a migration é aplicada THEN `fat_fato_gerador` SHALL ter
   `situacao` restrita a `projetado | realizado`, default `realizado`, e
   `dt_prevista DATE` nullable.
2. WHEN a migration é aplicada THEN a constraint SHALL exigir `dt_ocorrencia`
   quando realizado e `dt_prevista` quando projetado, e os fatos já existentes
   SHALL continuar válidos como `realizado`.
3. WHEN o IIP é calculado THEN `mv_iip_contrato` SHALL considerar **somente**
   fatos `realizado`.
4. WHEN o usuário aciona **Registrar como realizado** THEN o sistema SHALL
   exigir a data de ocorrência no ato e SHALL mudar `situacao`.
5. WHEN um fato é projetado THEN o card SHALL exibi-lo como **PROJETADO** e
   SHALL NOT contá-lo nos números de impacto.
6. WHEN o KPI de fatos é exibido THEN SHALL mostrar a contagem de realizados e,
   em separado, **"N projeções em aberto"**.

**Independent Test**: criar um fato projetado; o IIP não se move. Realizá-lo; o
IIP recalcula.

---

### P1: Linha do Tempo ⭐ MVP

**User Story**: Como Gestora, quero ver tudo que aconteceu no contrato em ordem
cronológica, para reconstruir a história sem abrir quatro telas.

**Acceptance Criteria**:

1. WHEN a tela carrega THEN SHALL listar Pré-Insights, Registros, Insights e
   Fatos Geradores do contrato em ordem cronológica decrescente, agrupados por
   mês.
2. WHEN o usuário desmarca um tipo THEN o feed SHALL ocultá-lo, mantendo a
   ordem dos demais.
3. WHEN o usuário escolhe um período THEN o feed SHALL respeitá-lo.
4. WHEN um item é selecionado THEN o painel lateral SHALL exibir seu detalhe,
   com os atributos de classificação quando for Fato Gerador.
5. WHEN uma data de ocorrência é exibida THEN SHALL ser **sem hora**
   (`05/09/2026`). Hora aparece somente em metadado de auditoria.
6. WHEN um Registro é exibido THEN seu tipo SHALL vir de `ref_tipo_registro` —
   nunca "Reunião", "Ofício" ou "Nota de Reunião".
7. WHEN um Insight é exibido THEN seu Pilar SHALL vir dos 4 de
   `ref_pilar_insight` — "Financeiro" não é um deles.
8. WHEN um fato não tem origem THEN o card SHALL NOT exibir marca de falha
   (o badge "Não Conectado" sai).
9. WHEN o período não tem itens THEN o feed SHALL exibir estado vazio explícito.

**Independent Test**: contrato com um item de cada tipo; desmarcar "Registro"
remove só os registros.

---

### P2: Ciclo de Vida com cadeias

**User Story**: Como Gestora, quero ver como um sinal virou resultado, agrupado
em cadeias, para mostrar à área cliente o caminho da incidência.

**Why P2**: É leitura analítica — a Linha do Tempo já entrega o essencial.

**Acceptance Criteria**:

1. WHEN a view de cadeias é consultada THEN SHALL agrupar itens por origem
   comum, **sem** persistir objeto "cadeia".
2. WHEN as cadeias são exibidas THEN o rótulo (Cadeia A, B, C...) SHALL ser
   **posicional**, derivado da ordenação — não identidade estável.
3. WHEN uma cadeia tem mais de um Fato Gerador THEN SHALL exibi-los juntos,
   marcados como **Origem comum**.
4. WHEN uma cadeia começa direto num Fato Gerador THEN SHALL ser exibida
   normalmente, sem marca de incompletude.
5. WHEN uma cadeia contém apenas fatos projetados THEN SHALL aparecer na seção
   **Cadeia Projetada (em análise)**.
6. WHEN o IIP é exibido THEN SHALL estar rotulado **(provisório)** e SHALL vir
   de `vw_iip_contrato` (AD-003/AD-014) — a tela nunca recalcula.

**Independent Test**: dois fatos com o mesmo Insight de origem aparecem numa
cadeia só, marcada "Origem comum".

---

### P1: A aba como casa única da Incidência ⭐ MVP

**User Story**: Como Mentor, quero criar e editar Registro, Pré-Insight, Insight
e Fato Gerador na mesma aba onde os leio, para não caçar o formulário em três
telas diferentes.

**Why P1**: A aba se chama "Fatos Geradores **e Registros**" e a timeline já
mostra os quatro juntos. Ler num lugar e escrever em outro é a incoerência que
este redesenho existe para resolver.

**Estado de origem** — hoje a Incidência está espalhada:

| Entidade | Onde se cria hoje | Destino |
| --- | --- | --- |
| Registro | `/contratos/[id]/etapas/[codigo]` (`RegistroForm`) | Migra para a aba |
| Insight | `ficha-contrato-chrome.tsx` (`InsightForm`) | Migra para a aba |
| Fato Gerador | `ficha-contrato-chrome.tsx` (`FatoGeradorForm`) | Substituído pelo wizard |
| Listagem de Registros | `/produtos/[slug]/agenda` | **Permanece** — a Agenda é visão de calendário, não de incidência |

**Acceptance Criteria**:

1. WHEN o usuário aciona criar THEN a aba SHALL oferecer as quatro entidades —
   Registro, Pré-Insight, Insight e Fato Gerador.
2. WHEN um item da timeline é acionado para edição THEN SHALL abrir o
   formulário da sua própria entidade, sem sair da aba.
3. WHEN um **Registro** é criado pela aba THEN o sistema SHALL exigir
   **Tipo de Registro** e **Ocorrido em**, e SHALL resolver o **Autor** pela
   sessão, nunca por digitação.
4. WHEN o Registro é criado fora do contexto de uma etapa THEN o sistema SHALL
   pedir a etapa explicitamente — o vínculo com `fat_etapa_contrato` não pode
   ser perdido na migração do formulário.
5. WHEN um Registro é criado THEN o campo de texto SHALL se chamar **Resumo**, e
   o **Canal** SHALL oferecer Sistema · Slack · Presencial.
6. WHEN um **Insight** é criado THEN SHALL oferecer Pilar (os 4 de
   `ref_pilar_insight`), Registro de origem, Meta de origem e Sucesso Mensal de
   origem — estes dois últimos **independentes** entre si.
7. WHEN os formulários migram THEN `ficha-contrato-chrome.tsx` e a tela de etapa
   SHALL deixar de renderizá-los, sem deixar ponto de entrada órfão.
8. WHEN um formulário é salvo THEN a timeline SHALL refletir o item novo sem
   recarregar a página inteira.
9. WHEN a RLS nega a escrita THEN o erro SHALL aparecer via `ErroInline` (L-008).

**Independent Test**: criar um Registro pela aba, conferir que ele aparece na
timeline **e** na Agenda, e que a tela de etapa não oferece mais o formulário.

---

### P2: Registro e Pré-Insight como origem

**User Story**: Como Mentor, quero vincular um Fato Gerador ao Registro ou ao
Pré-Insight que o originou.

**Acceptance Criteria**:

1. WHEN a migration é aplicada THEN `rel_fato_origem` SHALL ter
   `id_pre_insight` e `id_registro`, ambos nullable.
2. WHEN a constraint é avaliada THEN SHALL exigir **ao menos uma** das quatro
   origens quando existe linha de vínculo.
3. WHEN um fato não tem linha de vínculo THEN SHALL permanecer válido.
4. WHEN a origem referenciada é apagada THEN o vínculo SHALL ser removido sem
   apagar o Fato Gerador.

---

## Edge Cases

- WHEN uma tipologia tem preditor secundário `NULL` no seed THEN a tela SHALL
  exibir `—` no Preditor 2, nunca campo vazio.
- WHEN a tripla escolhida tem algum nível padrão `NULL` THEN a régua daquela
  dimensão SHALL exibir `—`, respeitando `ck_fato_niveis` (ao menos um dos três
  preenchido).
- WHEN um fato projetado passa da data prevista sem ser realizado THEN SHALL
  continuar listado como projetado — nenhuma transição automática.
- WHEN o mesmo Insight origina fatos em contratos diferentes THEN cada contrato
  SHALL ver apenas os seus (RLS).
- WHEN `mv_iip_contrato` está desatualizada THEN a tela SHALL exibir o valor
  conhecido, marcado, sem recalcular na leitura.
- WHEN a busca de origem não retorna nada THEN SHALL oferecer "fato sem origem"
  como saída, não bloquear o wizard.
- WHEN o usuário volta do passo 2 ao passo 1 THEN os dados já preenchidos
  SHALL ser preservados.

---

## Requirement Traceability

| ID | Story | Fase | Status |
| --- | --- | --- | --- |
| FGC-01 | P1: Wizard passo 1 (natureza + origem) | Design | Pending |
| FGC-02 | P1: Wizard passo 2 (tripla encadeada) | Design | Pending |
| FGC-03 | P1: Níveis/preditores derivados, leitura, régua de 4 | Design | Pending |
| FGC-04 | P1: Dimensões sem nome descritivo | Design | Pending |
| FGC-05 | P1: `fat_pre_insight` + RLS | Design | Pending |
| FGC-06 | P1: `situacao` + `dt_prevista` + constraint | Design | Pending |
| FGC-07 | P1: IIP só com realizados | Design | Pending |
| FGC-08 | P1: Transição projetado → realizado | Design | Pending |
| FGC-09 | P1: Título do Fato Gerador | Design | Pending |
| FGC-10 | P1: Linha do Tempo (feed, filtros, período) | Design | Pending |
| FGC-11 | P1: Painel de detalhe | Design | Pending |
| FGC-12 | P1: Datas sem hora | Design | Pending |
| FGC-13 | P2: View de cadeias | Design | Pending |
| FGC-14 | P2: Ciclo de Vida (KPIs + cadeias + IIP provisório) | Design | Pending |
| FGC-15 | P2: `rel_fato_origem` com 4 origens | Design | Pending |
| FGC-16 | P1: Criar/editar as 4 entidades na aba | Design | Pending |
| FGC-17 | P1: Migrar `RegistroForm` preservando o vínculo de etapa | Design | Pending |
| FGC-18 | P1: Migrar `InsightForm`; aposentar os pontos de entrada antigos | Design | Pending |

**Coverage:** 18 total, 0 mapeados a tasks, 18 não mapeados ⚠️ (normal antes de Tasks)

---

## Success Criteria

- [ ] Nenhuma dimensão D1/D2/D3 exibe legenda descritiva em nenhuma das quatro
      telas — a reincidência mais cara da revisão não volta.
- [ ] A régua de níveis tem 4 posições em todo lugar; "Nível 5" não existe.
- [ ] Escolher a tripla `Produção Legislativa › Projeto de lei / proposição ›
      Em tramitação ativa` mostra **Baixo / Médio / Médio**, batendo com o seed.
- [ ] Fato sem origem completa o cadastro e aparece na timeline sem marca de erro.
- [ ] Fato projetado não move o IIP; realizá-lo move.
- [ ] `dt_ocorrencia` nunca aparece com hora.
- [ ] As quatro entidades da Incidência se criam e se editam na mesma aba, e
      nenhum formulário órfão sobra em `ficha-contrato-chrome` ou na tela de etapa.
- [ ] Registro criado pela aba mantém o vínculo com a etapa — a migração do
      formulário não pode perder o contexto da régua.
- [ ] `drift-check` verde nos dois ambientes após as migrations.

---

## Nota de verificação

**Corrigido em 2026-09-15.** A versão anterior dizia que o projeto não tem
harness de teste de componente (L-006/L-007). **Está desatualizada**: AD-042
provisionou `@testing-library/react` + `jsdom` em 2026-09-10, com `.test.tsx`
já coletado em `vitest.config.ts` e as dependências na raiz (AD-044).

Vale a profundidade integral de AD-042 — os dois lados de cada condicional,
estado vazio e estado de erro. O corte de AD-046 é restrito a
`redesenho-estrategia-tela-first` e não alcança esta feature. E aqui isso é
particularmente exigível: com AD-057, a aba passa a ser superfície de
**escrita** das quatro entidades, que é precisamente onde AD-046 manteve a
profundidade integral mesmo durante o corte de ritmo.

Continua valendo extrair regra para função pura — o encadeamento
Grupo→Tipologia→Estado, a derivação de níveis/preditores a partir da tripla, o
agrupamento de cadeias, a ordenação da timeline, a formatação de data. A régua
de 5 níveis que passou pelo mockup teria morrido num teste desses.
