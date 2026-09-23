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

- [ ] `/contratos/[id]/diagnostico` mostra o Diagnóstico do Mentorado (Dados
      TSE, Composição Partidária da Casa, Afinidade de Agenda, Desafios,
      Destaques, Ambição Política, SWOT) quando `contrato.nomeProduto ===
      "PLL"`, sem alterar o comportamento existente para Estratégia/Coalizão.
- [ ] Nenhuma duplicação de query: a lógica de busca já escrita para a página
      standalone é extraída para `src/backend/queries/pll-ficha.ts` e
      reaproveitada pelas duas rotas.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Aposentar/redirecionar `/produtos/pll/participantes/[id]` | Ela continua sendo o único caminho de ficha para um registro de staging AINDA sem `id_contrato` (antes do vínculo TSE) — não pode sumir. Ficam as duas rotas coexistindo; decisão de unificação de navegação é de produto, não desta task. |
| Aba "Agenda" com grade fixa de 5 Mentorias (Figma 328:1262) | `/contratos/[id]/agenda` já é genérica por contrato (calendário + registros, `buscarEncontrosDoMes`/`buscarRegistrosDaAgenda` com `idsContrato=[idContrato]`) e cobre o mesmo dado real (`ref_tipo_registro` PLL/mentorias, `qtd_prevista=5`). Redesenhar essa aba como tabela de 5 linhas fixas é mudança de UI própria, não decorre de nenhum campo/tabela faltando — fica para quando Pedro confirmar que quer esse layout especificamente. |
| Aba "Informações Gerais" com Dados Pessoais/Mandato/Mentor Responsável/Vínculo de Acesso/Edição Vinculada/Histórico de Participação/Status (Figma 449:4) | Vários campos aparentes no frame 449:4 (Status Ativo/Desistente/Desligado + Motivo) não têm coluna correspondente hoje em `fat_cadastro_participante` nem em `fat_contrato` — é decisão de schema (regra invionável nº1 da skill `figma-dominio-legisla`), fica registrada como pergunta em aberto, não implementada em silêncio. |
| Editar Análise SWOT/Desafios/Destaques/Ambição pelo Assessor | Já decidido fora de escopo em `pll-cadastro-participantes/spec.md` (Out of Scope) — mantido aqui. |

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
| DPP-01 | P1 | Implementing | Pending |
| DPP-02 | P1 | Implementing | Pending |
| DPP-03 | P1 | Implementing | Pending |
| DPP-04 | P1 | Implementing | Pending |

**Coverage:** 4 total, 4 mapped (execução inline, sem `tasks.md` formal — escopo Medium, <10 passos).

---

## Success Criteria

- [ ] `/contratos/[id]/diagnostico` de um contrato PLL mostra o mesmo
      conteúdo (com o mesmo dado) que `/produtos/pll/participantes/[id]`.
- [ ] Nenhuma regressão nos testes existentes de
      `diagnostico/page.test.tsx` (Estratégia/Coalizão) nem de
      `produtos/pll/participantes/[id]/page.test.tsx`.
- [ ] `npm run lint:all && npm run test:unit` verdes.
