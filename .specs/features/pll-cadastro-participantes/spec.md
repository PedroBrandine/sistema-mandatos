# PLL — Cadastro de Participantes e Ficha do Mentorado Specification

- **Gate AD-039:** ✅ satisfeito — mesma validação com a operação PLL confirmada por Pedro em 2026-09-22
  para o conjunto de telas do PLL, que inclui este frame (`387:4`).
- **Origem:** desdobrada de `.specs/features/pll-dashboard-agenda/` em 2026-09-22 — o frame `387:4`
  ("participantes-pll" + "Ficha do Mentorado - Diagnóstico") é maior que as duas telas daquela spec e
  resolve D-2/D-3 de lá com um mecanismo próprio (import de planilha), não com o formulário genérico
  proposto originalmente.
- **Status:** rascunho — 5 perguntas em aberto (D-1 a D-5 abaixo), nenhuma delas bloqueante no sentido de
  "falta desenho"; são decisões de schema que o Design vai formalizar.

## Problem Statement

A jornada B do PLL (`docs/jornadas-de-usuario-v2.md` §3) descreve a inscrição de mentorados como
**importação manual** (B1.2, INT-04) — hoje sem tela nenhuma. Pedro explicou o mecanismo real: a
inscrição acontece em **duas etapas**. Primeiro, uma planilha preenchida externamente (Google Forms ou
equivalente) é importada em lote, trazendo dado pessoal do participante e dado do mandato que ele
assessora — já auto-declarado, sem passar pelo TSE. Depois, cada linha é **vinculada** manualmente ao
mandato oficial do espelho TSE, o mesmo movimento que a Estratégia já faz ao criar um mandato
(`rel_mandato_candidatura`, `app.criar_mandato`), só que disparado a partir da lista de participantes já
importados, não de um wizard de cadastro do zero.

O Figma (`387:4`) desenha essa lista, o painel de import e, no mesmo frame, a **Ficha do Mentorado —
Diagnóstico**: a tela de detalhe de um participante depois de vinculado, com dado do TSE, composição
partidária da Casa legislativa, afinidade de agenda temática, texto livre (desafios, destaques, ambição
política) e uma Análise SWOT do perfil político do parlamentar.

## Goals

- [ ] Importar uma planilha `.xlsx`/`.csv` com até 25 campos (3 grupos: Dados Pessoais, Dados do
      Mandato, Pautas Prioritárias) para uma tabela de staging por edição (contrato) do PLL.
- [ ] Lista de participantes com busca, filtro por partido/UF, status de completude do cadastro e
      indicador de vínculo com o TSE.
- [ ] Vincular manualmente cada participante importado ao mandato oficial do TSE, reaproveitando
      `TseMatchSearch`/`buscarCandidaturas` e `app.criar_mandato` já existentes — sem RPC nova para o
      match em si.
- [ ] Ficha do Mentorado com os dados do TSE, a Afinidade de Agenda Temática do participante,
      Configuração Partidária da Casa (capacidade nova), e três blocos de texto livre editáveis no
      sistema (Desafios, Destaques, Ambição Política).
- [ ] Nenhum rótulo, número ou campo do TSE aparece na Ficha sem existir no espelho `tse.*`.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Desenho da planilha de origem em si (Google Forms etc.) | Fora do sistema; o sistema só recebe o arquivo exportado |
| Migração retroativa das planilhas legadas do PLL | É INT-04 "Migração das planilhas legadas", projeto descartável e separado (`planejamento-planilha-monitoramento/spec.md`, Out of Scope) — esta feature cobre entrada de dado **nova**, recorrente, não carga histórica |
| Edição de Análise SWOT / Desafios / Destaques / Ambição Política pelo próprio Mentorado ou Assessor | Nesta fase, edição é de Mentor/Gestora (jornada C: "preparar" e "registrar" são do Mentor); abrir para o Assessor é decisão de produto futura |
| Pareamento automático mentorado↔mentor | Continua manual (`rel_usuario_contrato`), como hoje — B3.2 da jornada |
| Composição partidária de Casas fora do recorte dos parlamentares importados | Não pré-carrega todas as Casas do Brasil; calcula só quando um mandato é vinculado |
| Exportar/imprimir a Ficha do Mentorado | Não desenhado |
| Excluir participante importado | Fluxo de correção fica em "editar", exclusão fica para quando houver caso de uso real |

---

## Revisão de mockup — o que a tela trouxe e o que não bate

### Vocabulário

| Veio assim | É assim | Onde | Decisão |
| --- | --- | --- | --- |
| Coluna **"Deputado(a)"** na tabela, e campo **"Nome do Deputado(a)"** no grupo Dados do Mandato | Reincidência do Dashboard (`pll-dashboard-agenda` D-5): a lista mostra "Sen. João Silva". Rótulo canônico: **Parlamentar** | `dim_mandato`, glossário | D-1 |
| **"Cor/Raça do Deputado(a)"** | **Cor/raça do parlamentar** — mesma reincidência | `dim_mandato.ds_raca` | D-1 |
| Painel "Dados TSE": **Número do Candidato**, **Classificação na Lista**, **Despesa de Campanha** | Nenhum dos três existe em `tse.dim_candidatura` nem em qualquer tabela do espelho. O TSE público carrega número de candidato e despesa em arquivos que este sistema **não importa** (`docs/schema_sistema.sql` §5, TSE) | `tse.dim_candidatura` | **D-2 (aberta)** |
| **"Coligação"**, **"Situação Eleitoral"**, **"Votos Recebidos"**, **"Evolução de Votos"** | Batem: `nm_coligacao`, `ds_situacao_candidatura`/`ds_sit_tot_turno`, soma de `tse.fat_votacao_zona`, série por `ano_eleicao` ✅ | `tse.dim_candidatura`, `tse.fat_votacao_zona` | — |
| Tabela: coluna **"Mentor"** ao lado de "TSE" | Nome ambíguo — é o **mentor pareado** daquele mentorado (`rel_usuario_contrato`), não o "Tipo" da própria linha (que também usa "Mentor" como valor). Manter rótulo, mas nunca as duas coisas na mesma tela sem contexto — aqui já há distância suficiente (colunas diferentes) | `rel_usuario_contrato` | — |
| Status de linha **Completo / Incompleto / Pendente** | Não é `fat_contrato.status` (Ativo/Desistente/Desligado, D-1 da spec-irmã) — é a **completude do cadastro** na etapa de staging, categoria própria | — | D-3 |
| **"Análise SWOT"** no perfil do participante | O glossário registra Oportunidade/Ameaça (SWOT) **removido** do Objetivo Específico. Pedro confirmou (2026-09-22): este é um **conceito novo e distinto** — SWOT do perfil político do parlamentar, não da Meta/Objetivo. Convive sem reabrir a remoção anterior | `fat_objetivo_especifico.oportunidade/ameaca` (removido, não relacionado) | Resolvida — confirmado |
| **Desafios / Destaques / Ambição Política** (texto livre) | Pedro confirmou (2026-09-22): **não vêm da planilha** — são preenchidos depois, dentro do sistema, por Mentor/Gestora | — | Resolvida — confirmado |
| **"Configuração Partidária da Casa"** | Capacidade nova (agregação de TSE por Casa/UF/ano). Pedro confirmou (2026-09-22): **entra no escopo** desta spec | `tse.dim_candidatura` | Resolvida — confirmado, vira US própria (PLL-CP-*) |

### O que veio certo

Os três grupos de campo da planilha (Pessoais/Mandato/Pautas) são um levantamento concreto, não um chute
de UI — cada campo é nomeável e mapeável. O indicador ✓/✕ de vínculo TSE por linha é a forma certa de
mostrar "falta vincular" sem travar a lista. As 4 pautas prioritárias (Educação, Segurança Pública,
Modernização do Estado, Clima) batem exatamente com o painel de Afinidade do Dashboard (`44:477`) — é o
mesmo dado, mesma origem, consistente entre as duas telas.

---

## Assumptions & Open Questions

| # | Decisão / ambiguidade | Default proposto | Justificativa | Confirmed? |
| --- | --- | --- | --- | --- |
| **D-1** | Rótulo "Deputado(a)" → "Parlamentar" | Igual à correção já feita no Dashboard (`pll-dashboard-agenda` D-5): coluna da tabela e campo do grupo Dados do Mandato usam "Parlamentar" | Consistência entre as 3 telas do PLL | y (mesma base da spec-irmã) |
| **D-2** | Número do Candidato / Classificação na Lista / Despesa de Campanha não existem no espelho TSE | **Removidos** da Ficha do Mentorado. O bloco "Dados TSE" mostra só o que `tse.dim_candidatura`/`tse.fat_votacao_zona` sustentam: Situação Eleitoral, Coligação, Votos Recebidos, Evolução de Votos | Regra 1 do glossário: todo campo em tela mapeia para uma coluna real. Sem coluna, sem campo — e não é caso de "vira pergunta de schema", porque o dado nem está na carga do TSE que o sistema importa | **y (Pedro, 2026-09-22)** |
| **D-3** | Enum de completude do cadastro (Completo/Incompleto/Pendente) | Coluna nova `status_cadastro` na tabela de staging (ver D-4), `CHECK IN ('completo','incompleto','pendente_revisao')`. **Completo** = todos os campos obrigatórios preenchidos **e** vinculado ao TSE; **Incompleto** = falta campo obrigatório da planilha; **Pendente de revisão** = campos completos, falta só o vínculo TSE | Replica a leitura das 3 métricas do topo da tela (`42` cadastrados, `3` pendentes, `2` incompletos) como estados mutuamente exclusivos e deriváveis, não 3 contagens soltas | n |
| **D-4** | Onde a planilha pousa antes do vínculo TSE confirmar o mandato oficial | Decisão de Pedro (2026-09-22): **tabela de staging própria do PLL** (nome de trabalho `fat_participante_pll`, ligada a `fat_contrato` do produto PLL). Guarda os 19 campos autodeclarados (Pessoais + Mandato) e o `status_cadastro`. O vínculo ao TSE **promove** os dados: chama `app.criar_mandato` com `p_candidatura` preenchido (mesma RPC que a Estratégia usa hoje) para materializar `dim_contratante`/`dim_mandato`/`fat_contrato`/`rel_mandato_candidatura`, e a linha de staging passa a apontar para o `id_contrato` resultante | Reaproveita a única RPC de criação de mandato que já existe (`src/backend/rpc/mandato.ts`), em vez de inventar uma segunda via de gravar `dim_mandato`. O "não confirmado, mas com dado" é exatamente o que staging resolve, sem sujar as tabelas definitivas com registro não vinculado | y (Pedro, 2026-09-22) |
| **D-5** | As 6 "Pautas Prioritárias" da planilha (4 fixas + outras + especifique) | **Não usam `ref_agenda_tematica`** (catálogo de outro produto, vazio por CAT-16). São 6 colunas fixas da tabela de staging: 4 notas 1–5 (Educação, Segurança Pública, Modernização do Estado, Clima) + 1 seleção múltipla de "outras pautas" (lista fixa: Saúde, Infraestrutura, Economia, Direitos Humanos, Tecnologia) + 1 texto livre "Especifique a pauta" | O conjunto de 4 pautas é específico do formulário de diagnóstico do PLL, não do catálogo genérico de Agenda Temática usado em Meta/Objetivo — são conceitos com o mesmo nome, produtos diferentes | n |

**Open questions:** nenhuma bloqueia o Design. D-2, D-3, D-5 têm default técnico direto (mapeamento de
campo existente ou ausente); D-4 já tem decisão de Pedro. Revisar D-3 e D-5 na fase Design ao desenhar a
tabela de staging por completo.

---

## User Stories

### P1: Importar planilha de cadastro ⭐ MVP

**User Story**: Como Gestora/coordenação do PLL, quero subir a planilha de inscrição de mentorados e
mentores de uma vez, para não digitar cada participante manualmente.

**Why P1**: É a única porta de entrada de dado desta feature — sem ela não há lista para vincular.

**Acceptance Criteria**:

1. **PLL-CP-01** — WHEN o usuário arrasta ou seleciona um arquivo `.xlsx`/`.csv` THEN o sistema SHALL
   validar as colunas contra os 3 grupos de campo (Anexo A) e, se todas as obrigatórias existirem, SHALL
   importar uma linha de staging por participante.
2. **PLL-CP-02** — WHEN o arquivo tem coluna obrigatória faltando ou tipo inválido (ex.: texto onde
   espera nota 1–5) THEN o sistema SHALL rejeitar a importação **inteira** com a lista de erros por
   coluna/linha — nunca importar parcialmente sem avisar o que ficou de fora.
3. **PLL-CP-03** — WHEN uma linha da planilha corresponde a um participante já importado (mesmo e-mail,
   mesmo contrato) THEN o sistema SHALL **atualizar** a linha de staging existente, não duplicar.
4. **PLL-CP-04** — WHEN a importação termina com sucesso THEN o sistema SHALL exibir "Última importação:
   DD/MM/AAAA por ‹nome de quem importou›" e atualizar as 3 métricas de cadastro.

**Independent Test**: Importar uma planilha de 5 linhas, conferir 5 linhas de staging; reimportar com 1
linha alterada e 1 nova, conferir 1 update + 1 insert; importar arquivo com coluna faltando e ver o erro.

---

### P1: Lista de participantes ⭐ MVP

**User Story**: Como Gestora ou Mentor(a), quero ver todos os participantes importados, com o status de
cadastro e o vínculo TSE, para saber quem falta revisar.

**Why P1**: É o hub de trabalho desta feature — de onde nasce toda ação (editar, ver, vincular).

**Acceptance Criteria**:

1. **PLL-CP-05** — WHEN a lista renderiza THEN o sistema SHALL exibir uma linha por participante com Nome
   Completo, Tipo (Mentorado/Mentor), Partido, UF, Parlamentar (D-1), E-mail, Telefone, Mentor(a) pareado,
   indicador **TSE** (✓ vinculado / ✕ não vinculado), Status de cadastro (D-3) e ações (editar, ver ficha).
2. **PLL-CP-06** — WHEN o usuário digita em **Buscar por nome, e-mail ou parlamentar…** THEN o sistema
   SHALL filtrar as linhas por qualquer um dos três campos.
3. **PLL-CP-07** — WHEN o usuário usa os filtros **Partido** ou **UF** THEN o sistema SHALL restringir a
   lista, combináveis com a busca.
4. **PLL-CP-08** — WHEN a lista tem mais de uma página THEN o sistema SHALL paginar com "Mostrando X–Y de N
   registros" e navegação anterior/próxima.
5. **PLL-CP-09** — WHEN um campo obrigatório está vazio na linha de staging THEN a célula correspondente
   SHALL exibir `—` (AD-005), nunca célula em branco.

**Independent Test**: Base com 8 participantes de partidos/UFs variados; buscar por parte de um nome;
filtrar por partido; conferir paginação com página de 6.

---

### P1: Vincular participante ao mandato do TSE ⭐ MVP

**User Story**: Como Gestora, quero abrir um participante importado e escolher a candidatura correta do
TSE, para confirmar oficialmente o mandato dele, do mesmo jeito que já faço na Estratégia.

**Why P1**: Sem vínculo, o dado do mandato fica só na palavra do formulário — o vínculo é o que valida.

**Acceptance Criteria**:

1. **PLL-CP-10** — WHEN o usuário clica em "vincular TSE" de uma linha sem vínculo THEN o sistema SHALL
   abrir a mesma busca de candidatura já usada na Estratégia (`TseMatchSearch`/`buscarCandidaturas`), com
   os campos autodeclarados (nome, partido, UF) pré-preenchendo a busca.
2. **PLL-CP-11** — WHEN o usuário confirma uma candidatura THEN o sistema SHALL chamar `app.criar_mandato`
   com `p_candidatura` preenchido (D-4), materializando `dim_contratante`/`dim_mandato`/`fat_contrato`
   ligados ao produto PLL, e SHALL marcar a linha de staging como vinculada (✓).
3. **PLL-CP-12** — WHEN o participante já tem vínculo TSE THEN o sistema SHALL permitir **trocar** o
   vínculo (mesma tela), preservando o histórico em `rel_mandato_candidatura` como a Estratégia já faz.
4. **PLL-CP-13** — WHEN o usuário tenta salvar sem selecionar nenhuma candidatura E sem marcar "não
   encontrado" THEN o sistema SHALL impedir o fechamento sem uma decisão explícita (vinculado ou
   assumidamente não encontrado) — nunca fechar em estado ambíguo.

**Independent Test**: Vincular um participante de teste a uma candidatura real da base de dev; conferir
`dim_mandato`, `fat_contrato` e `rel_mandato_candidatura` criados; trocar o vínculo e ver o histórico.

---

### P2: Ficha do Mentorado — Dados do TSE e Afinidade de Agenda

**User Story**: Como Mentor(a), quero ver o perfil eleitoral do parlamentar do meu mentorado e a
afinidade dele com as pautas do programa, para preparar a mentoria.

**Why P2**: É leitura — só faz sentido depois que existe participante vinculado (P1 anterior).

**Acceptance Criteria**:

1. **PLL-CP-14** — WHEN a Ficha abre para um participante vinculado ao TSE THEN o sistema SHALL exibir
   Situação Eleitoral, Coligação, Votos Recebidos e Evolução de Votos por ano de eleição (D-2 — sem
   Número do Candidato/Classificação/Despesa, que não existem no espelho).
2. **PLL-CP-15** — WHEN o participante não está vinculado ao TSE THEN o bloco "Dados TSE" SHALL exibir o
   estado vazio "Ainda não vinculado ao TSE" com atalho para vincular, nunca campos em branco.
3. **PLL-CP-16** — WHEN o bloco Afinidade de Agenda Temática renderiza THEN o sistema SHALL exibir as 4
   notas (D-5) em escala 1–5 e os chips de "outras pautas" selecionadas.

**Independent Test**: Abrir a Ficha de um participante vinculado e de um não vinculado; conferir os dois
estados do bloco TSE.

---

### P2: Ficha do Mentorado — Configuração Partidária da Casa

**User Story**: Como Mentor(a), quero ver a composição partidária da Casa legislativa do meu mentorado,
para entender o cenário político em que ele atua.

**Why P2**: Capacidade nova (Pedro confirmou escopo em 2026-09-22), mas depende só de leitura agregada do
TSE — sem escrita nova.

**Acceptance Criteria**:

1. **PLL-CP-17** — WHEN o participante está vinculado ao TSE THEN o sistema SHALL agregar, por
   Casa/UF/ano de eleição do mandato vigente, a contagem de candidatos **eleitos** (`ds_sit_tot_turno`
   indicando eleito) por partido, e exibir como barra empilhada + legenda com contagem e percentual.
2. **PLL-CP-18** — WHEN um partido tem menos de 3% da composição THEN o sistema SHALL agrupá-lo em
   "Outros" na legenda (evita legenda com 20+ linhas).
3. **PLL-CP-19** — WHEN não há dado suficiente do TSE para a Casa (ano/cargo sem carga) THEN o sistema
   SHALL exibir "Dados indisponíveis para esta Casa/ano", nunca gráfico vazio sem explicação.

**Independent Test**: Parlamentar de teste vinculado a uma eleição carregada na base de dev; conferir
contagem por partido contra `SELECT` direto em `tse.dim_candidatura`.

---

### P2: Ficha do Mentorado — Desafios, Destaques e Ambição Política

**User Story**: Como Mentor(a), quero registrar os principais desafios, destaques e a ambição política do
meu mentorado, para acompanhar a evolução dele ao longo da edição.

**Why P2**: Confirmado (2026-09-22): são campos preenchidos **no sistema**, não vindos da planilha —
depende de UI de edição, não só de leitura.

**Acceptance Criteria**:

1. **PLL-CP-20** — WHEN Mentor ou Gestora abre a Ficha de um participante vinculado THEN o sistema SHALL
   permitir adicionar, editar e remover itens de **Desafios** e de **Destaques** (listas de texto curto).
2. **PLL-CP-21** — WHEN Mentor ou Gestora edita **Ambição Política** THEN o sistema SHALL salvar um texto
   livre e até 3 marcadores (chips) associados.
3. **PLL-CP-22** — WHEN nenhum desafio/destaque/ambição foi registrado ainda THEN o sistema SHALL exibir o
   estado vazio "Nada registrado ainda", com o atalho para adicionar — nunca seção ausente.
4. **PLL-CP-23** — WHEN o Assessor abre a Ficha (se tiver acesso a ela) THEN estes três blocos SHALL ser
   **somente leitura** (fora de escopo de escrita do Assessor, ver Out of Scope).

**Independent Test**: Adicionar 2 desafios e 1 destaque como Mentor; reabrir a Ficha e ver persistido;
confirmar Assessor não vê botão de editar.

---

### P3: Ficha do Mentorado — Análise SWOT

**User Story**: Como Mentor(a), quero registrar Forças, Fraquezas, Oportunidades e Ameaças do perfil
político do meu mentorado, para orientar o planejamento da mentoria.

**Why P3**: Conceito novo confirmado (2026-09-22), mas de menor urgência que os blocos de leitura e o
fluxo de import/vínculo — pode entrar depois do MVP.

**Acceptance Criteria**:

1. **PLL-CP-24** — WHEN Mentor ou Gestora edita a Análise SWOT THEN o sistema SHALL permitir até N itens
   de texto curto por quadrante (Forças/Fraquezas/Oportunidades/Ameaças), editáveis independentemente.
2. **PLL-CP-25** — WHEN nenhum item foi registrado num quadrante THEN o sistema SHALL exibir o estado
   vazio daquele quadrante, sem esconder os outros três já preenchidos.

**Independent Test**: Preencher só o quadrante "Forças" e ver os outros três em estado vazio.

---

## Edge Cases

- WHEN a planilha tem uma linha com e-mail duplicado dentro do **mesmo arquivo** THEN o sistema SHALL
  rejeitar a importação inteira, apontando as linhas em conflito (mesma regra de PLL-CP-02).
- WHEN o usuário vincula ao TSE uma candidatura que já está vinculada a **outro** participante do mesmo
  contrato THEN o sistema SHALL bloquear com mensagem clara — mesma unicidade que `dim_mandato` já impõe
  hoje (`id_contratante UNIQUE`).
- WHEN um participante é reimportado (PLL-CP-03) depois de já vinculado ao TSE THEN o sistema SHALL manter
  o vínculo — reimportação **nunca** desfaz um vínculo confirmado, só atualiza os campos autodeclarados.
- WHEN o usuário exporta dados (botão "Exportar dados") THEN o sistema SHALL gerar `.xlsx`/`.csv` com as
  mesmas colunas da tela — mecânica simples, mas fora do MVP se não houver tempo (marcar como P3 no Design
  se necessário).
- WHEN o mandato vinculado ao TSE muda de Casa/partido entre eleições (reeleito em cargo diferente) THEN a
  Ficha SHALL refletir a candidatura **vigente** (`eh_mandato_vigente`), nunca uma anterior por engano.

---

## Requirement Traceability

| Requirement ID | Story | Depende de | Status |
| --- | --- | --- | --- |
| PLL-CP-01 … 04 | P1: Importar planilha | D-3, D-4, D-5 | Pending |
| PLL-CP-05 … 09 | P1: Lista de participantes | D-1, D-3 | Pending |
| PLL-CP-10 … 13 | P1: Vincular ao TSE | D-4 | Pending |
| PLL-CP-14 … 16 | P2: Dados TSE + Afinidade | D-2, D-5 | Pending |
| PLL-CP-17 … 19 | P2: Configuração Partidária da Casa | — | Pending |
| PLL-CP-20 … 23 | P2: Desafios/Destaques/Ambição | — | Pending |
| PLL-CP-24 … 25 | P3: Análise SWOT | — | Pending |

**ID format:** `PLL-CP` (cadastro de participantes).

**Coverage:** 25 requisitos; nenhum bloqueado — D-2, D-3, D-4, D-5 têm default técnico ou decisão já
tomada por Pedro.

**Schema previsto:** 1 tabela nova de staging (`fat_participante_pll` ou nome equivalente, ligada a
`fat_contrato`), com colunas para os 19 campos autodeclarados + `status_cadastro` + FK opcional para
`fat_contrato`/`rel_mandato_candidatura` após o vínculo; possivelmente 1 tabela pequena para
Desafios/Destaques (lista) e Análise SWOT (4 quadrantes), a definir em Design. **Nenhuma dessas entra sem
AD registrada** — mesma regra da spec-irmã `pll-dashboard-agenda`.

---

## Success Criteria

- [ ] Uma planilha de teste com 10 linhas importa em uma chamada, sem digitação manual.
- [ ] Todo participante vinculado ao TSE aparece com `dim_mandato`/`fat_contrato` idênticos ao que o fluxo
      de cadastro da Estratégia produziria para o mesmo mandato.
- [ ] Nenhum campo do bloco "Dados TSE" existe fora de `tse.dim_candidatura`/`tse.fat_votacao_zona`.
- [ ] As telas ficam comparadas com `387:4` via `get_screenshot` antes de dar por prontas (CLAUDE.md).

---

## Anexo A — Campos da planilha de importação (conforme `387:4`)

**Dados Pessoais (12):** Você é um(a) [Mentorado/Mentor], Nome Completo, Data de nascimento, E-mail,
Telefone (com DDD), Identidade de gênero, Orientação sexual, Cor/raça, Deficiências, Partido filiado,
Tempo na política, Já conhecia a Legisla.

**Dados do Mandato (7):** Nome do Parlamentar (D-1), Cor/raça do parlamentar (D-1), Partido do parlamentar,
Estado de eleição, Cargos anteriores, Mandatos anteriores, Instagram/rede social.

**Pautas Prioritárias (6, D-5):** Educação (1–5), Segurança pública (1–5), Modernização do Estado (1–5),
Clima (1–5), Outras pautas prioritárias (múltipla escolha), Especifique a pauta (texto livre).
