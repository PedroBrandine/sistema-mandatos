# Diagnóstico do Participante PLL na Ficha do Contrato — Specification

## Problem Statement

A Ficha do Mentorado (PLL) já existe em duas encarnações que não se falam:
(1) a página standalone `/produtos/pll/participantes/[id]` (feature
`pll-cadastro-participantes`, T14/T15/T19) com Dados TSE, Composição
Partidária, Afinidade de Agenda e os blocos editáveis (Desafios, Destaques,
Ambição Política, SWOT); (2) a aba "Diagnóstico" da ficha genérica de
contrato (`/contratos/[id]/diagnostico`, feature `diagnostico-mandato-
estrategia`), que só sabe mostrar o Diagnóstico de MANDATO da Estratégia
(`CardDiagnosticoMandato`/`CardSwotMandato`/`InformacoesTseMandato`) — para
um contrato de produto PLL, essa aba mostra conteúdo de Estratégia (campos
que não existem/não fazem sentido para o mentorado) em vez do que já foi
construído para ele.

Pedro pediu a ficha dos participantes do PLL "parecida com a da Estratégica,
mas com os elementos individuais do produto" — a ficha de contrato
(`FichaContratoChrome`, 8 abas) já é essa casca compartilhada; falta só a
aba Diagnóstico saber renderizar o conteúdo certo quando o contrato é do
PLL, em vez de duplicar uma segunda ficha paralela.

## Goals

- [x] `/contratos/[id]/diagnostico` mostra o Diagnóstico do Mentorado (Dados
      TSE, Composição Partidária da Casa, Afinidade de Agenda, Desafios,
      Destaques, Ambição Política, SWOT) quando `contrato.nomeProduto ===
      "PLL"`, sem alterar o comportamento existente para Estratégia/Coalizão.
- [x] Nenhuma duplicação de query: a lógica de busca já escrita para a página
      standalone é extraída para `src/backend/queries/pll-ficha.ts` e
      reaproveitada pelas duas rotas.
- [x] `/contratos/[id]/agenda` mostra a grade fixa de Mentorias (Figma
      328:1262) quando o contrato é do PLL — decisão do Pedro, 23/09:
      substitui inteiramente o calendário genérico (não convive com ele).
- [x] `/contratos/[id]/informacoes` mostra o painel de Informações Gerais do
      PLL (Figma 449:4, restilizado pra Anton/Commissioner/paleta oficial)
      quando o contrato é do PLL, com Status de participação ampliado
      (AD-066: Ativo/Desistente/Desligado/Concluído).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Aposentar/redirecionar `/produtos/pll/participantes/[id]` | Ela continua sendo o único caminho de ficha para um registro de staging AINDA sem `id_contrato` (antes do vínculo TSE) — não pode sumir. Ficam as duas rotas coexistindo; decisão de unificação de navegação é de produto, não desta task. |
| "Registro do Mentor"/"Registro do Mandato" como 2 caixas de texto por Mentoria (Figma 328:1262) | `fat_registro` só permite 1 registro por (contrato, tipo_registro, nr_sequencia) — decisão do Pedro (23/09): mostra o registro real único, sem inventar a 2ª caixa. |
| Editar Análise SWOT/Desafios/Destaques/Ambição pelo Assessor | Já decidido fora de escopo em `pll-cadastro-participantes/spec.md` (Out of Scope) — mantido aqui. |
| "Base Eleitoral" em Dados do Mandato (Figma 449:4) | Não existe coluna correspondente em `dim_mandato` nem em `fat_cadastro_participante` — omitida (regra nº1 de `figma-dominio-legisla`), não implementada por invenção. |
| "Parear mentor" (ação) e "Ver visão agregada da edição" (link) do Figma 449:4 | O painel de Informações Gerais mostra o mentor/edição atuais só leitura; construir os 2 fluxos de escrita/navegação é aumento de escopo não pedido nesta rodada. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Contrato PLL sem linha correspondente em `fat_cadastro_participante` (ex.: criado por outro caminho que não o cadastro/planilha) | Mostra `EstadoVazio` explicativo, nunca a tela de Estratégia por engano nem crash | Mesmo padrão AD-005 (ausência é estado, não sentinela) | n — assumido, baixo risco (fluxo real de criação de contrato PLL sempre passa pelo vínculo TSE, que grava `id_contrato` na linha de staging) |
| Onde a nova aba entra na hierarquia de arquivos | `src/frontend/components/pll/diagnostico-participante-pll.tsx`, componente puro que recebe os dados já resolvidos (mesmo padrão presentational de `FichaDadosTse`/`FichaAfinidadeAgenda`) | Reuso pelas duas páginas sem duplicar JSX | n — decisão técnica de baixo risco |
| Frame 449:4 (Informações Gerais) — pedido explicitamente ao usuário nesta sessão | Usar a estrutura de campos do frame, restilizada para Anton/Commissioner/paleta oficial, quando essa aba for implementada | Resposta do Pedro via AskUserQuestion nesta sessão | y |

**Open questions:** nenhuma bloqueante para o escopo desta spec (Diagnóstico). As 2 pendências de schema (Status de participação; grade fixa de Agenda) ficam registradas em Out of Scope, não bloqueiam este incremento.

---

## User Stories

### P1: Diagnóstico do Mentorado na ficha de contrato ⭐ MVP

**User Story**: Como Mentor/Gestora, quero abrir a aba Diagnóstico de um
contrato do PLL e ver os dados TSE, a composição partidária, a afinidade de
agenda e os blocos editáveis (Desafios/Destaques/Ambição/SWOT) do mentorado
— não o Diagnóstico de Mandato da Estratégia.

**Why P1**: É o gap real hoje — a ficha compartilhada existe, mas mostra
conteúdo errado (ou incompleto) para um contrato PLL.

**Acceptance Criteria**:

1. WHEN a Gestora/Mentor abre `/contratos/[id]/diagnostico` de um contrato
   cujo produto é "PLL" THEN o sistema SHALL renderizar Dados TSE, Composição
   Partidária da Casa, Afinidade de Agenda e os 4 blocos editáveis
   (Desafios, Destaques, Ambição Política, SWOT), com os MESMOS dados que a
   página `/produtos/pll/participantes/[id]` já mostra para o mesmo
   participante.
2. WHEN o contrato é de Estratégia ou Coalizão THEN o comportamento atual
   (`CardDiagnosticoMandato`/`CardSwotMandato`/`InformacoesTseMandato`, ou o
   placeholder `EmDesenvolvimento` para coalizão) SHALL permanecer idêntico,
   sem regressão.
3. WHEN o Assessor abre a aba de um contrato PLL THEN os 4 blocos editáveis
   SHALL aparecer somente leitura (mesma regra PLL-CP-23 já implementada em
   `usePapelGlobal`), sem nenhum botão de editar.
4. WHEN o contrato é PLL mas não existe linha correspondente em
   `fat_cadastro_participante` (edge case) THEN o sistema SHALL mostrar um
   estado vazio explicativo, nunca o conteúdo de Estratégia nem uma tela
   quebrada.

**Independent Test**: Abrir a Ficha de um contrato PLL já vinculado ao TSE
pela aba Diagnóstico; comparar lado a lado com
`/produtos/pll/participantes/[id]` do mesmo participante — mesmo dado, duas
rotas.

---

### P2: Agenda do PLL como grade fixa de Mentorias

**User Story**: Como Mentor/Gestora, quero ver as 5 Mentorias do contrato PLL
numa tabela fixa (status, data, mentor, ações), em vez do calendário
genérico, e poder agendar, marcar presença, remarcar ou cancelar cada uma.

**Why P2**: Pedro pediu explicitamente o modelo do Figma 328:1262 — a Agenda
genérica não expressa o conceito de "5 slots fixos" que já existe no schema
(`ref_tipo_registro.qtd_prevista=5`).

**Acceptance Criteria**:

1. WHEN o contrato é do PLL THEN `/contratos/[id]/agenda` SHALL mostrar a
   tabela de Mentorias (`TabelaMentoriasPll`) no lugar do calendário —
   nenhuma chamada a `buscarEncontrosDoMes`/`buscarRegistrosDaAgenda`.
2. WHEN um slot não tem encontro THEN a linha SHALL mostrar "Não preenchido"
   e só o botão "Agendar".
3. WHEN um slot está planejado THEN a linha SHALL mostrar "Marcar
   presença"/"Remarcar"/"Cancelar" (via `atualizarStatusEncontro`, UPDATE
   direto — mesmo padrão de `encontros-lista.tsx`, sem RPC nova).
4. WHEN "Agendar" é confirmado THEN `criarEncontro` SHALL gravar
   `nr_sequencia` (parâmetro novo `p_nr_sequencia` de `app.criar_encontro`,
   migration `20260923185944`) igual ao slot clicado.
5. WHEN existe mais de um `fat_encontro` pro mesmo slot (ex.: um cancelado e
   um novo planejado) THEN o slot SHALL mostrar o "vivo" (planejado/
   realizado), nunca o cancelado.

**Independent Test**: Abrir a Agenda de um contrato PLL; agendar a Mentoria 3;
marcar presença; conferir que a Mentoria 1 (com registro real) mostra o texto
do registro, não uma segunda caixa inventada.

---

### P3: Informações Gerais do PLL

**User Story**: Como Mentor/Gestora, quero ver Dados Pessoais, Dados do
Mandato, Mentor Responsável, Vínculo de Acesso, Edição Vinculada, Histórico
de Participação e controlar o Status (Ativo/Desistente/Desligado/Concluído)
do mentorado na aba Informações Gerais.

**Why P3**: Completa o Figma 449:4 — é a única aba que ainda mostrava (ou
nem tinha) conteúdo específico do PLL.

**Acceptance Criteria**:

1. WHEN o contrato é do PLL THEN `/contratos/[id]/informacoes` SHALL
   renderizar `InformacoesGeraisPllPainel`, nunca os cards genéricos de
   mandato (`CardSobreMandato`, `CardStatusEtapa` etc.).
2. WHEN a Gestora troca o Status para "Desistente" ou "Desligado" THEN o
   Motivo SHALL ser obrigatório antes de habilitar "Salvar status" (mesma
   regra de `nao_concluido`, AD-066).
3. WHEN o contrato PLL não tem linha correspondente em
   `fat_cadastro_participante` THEN a aba SHALL mostrar erro explicativo,
   nunca o conteúdo de Estratégia.
4. WHEN o mesmo e-mail aparece em mais de uma edição THEN o Histórico de
   Participação SHALL listar todas, mais recente primeiro.

**Independent Test**: Abrir Informações Gerais de um contrato PLL; trocar o
Status para Desligado sem motivo (botão desabilitado); preencher motivo e
salvar; conferir que Estratégia continua com "Status e Etapa" inalterado.

---

## Edge Cases

- WHEN `id_vinculo_tse` da linha de staging é `null` (participante ainda não
  vinculado, mas por algum motivo já tem `id_contrato`) THEN Dados TSE SHALL
  mostrar o estado "Ainda não vinculado ao TSE" (mesmo comportamento hoje da
  página standalone), sem o atalho "Vincular ao TSE" (que navega para a
  lista de participantes — aqui о contrato já existe, então o atalho não se
  aplica; basta omitir o botão).
- WHEN a query de contrato falha (RLS, rede) THEN a aba SHALL mostrar
  `ErroInline` com retry, mesmo padrão das demais sub-rotas da ficha.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DPP-01 | P1 | Implementing | Verified |
| DPP-02 | P1 | Implementing | Verified |
| DPP-03 | P1 | Implementing | Verified |
| DPP-04 | P1 | Implementing | Verified |
| DPP-05..09 | P2 (Agenda) | Implementing | Verified |
| DPP-10..13 | P3 (Informações Gerais) | Implementing | Verified |

**Coverage:** 13 total, 13 mapped (execução inline, sem `tasks.md` formal — escopo Medium por incremento, <10 passos cada).

---

## Success Criteria

- [x] `/contratos/[id]/diagnostico` de um contrato PLL mostra o mesmo
      conteúdo (com o mesmo dado) que `/produtos/pll/participantes/[id]`.
- [x] `/contratos/[id]/agenda` de um contrato PLL mostra a grade fixa de
      Mentorias, com Agendar/Marcar presença/Remarcar/Cancelar funcionais.
- [x] `/contratos/[id]/informacoes` de um contrato PLL mostra o painel de
      Informações Gerais do PLL, com Status ampliado (AD-066) editável.
- [x] GIP/Formulários/Gestão da equipe não aparecem na navegação de um
      contrato PLL (`FichaContratoChrome`).
- [x] Nenhuma regressão nos testes existentes (Estratégia/Coalizão
      inalterados em todas as abas tocadas).
- [x] `npm run test:unit` verde (1890 testes, 15 falhas pré-existentes e não
      relacionadas em `fatos-registros/page.test.tsx`, confirmadas via
      `git stash` antes desta sessão). Lint dos arquivos desta feature limpo
      (1 erro pré-existente de `react-hooks/set-state-in-effect`, mesmo
      padrão já presente em `informacoes/page.tsx` antes desta sessão, não
      introduzido por ela).
