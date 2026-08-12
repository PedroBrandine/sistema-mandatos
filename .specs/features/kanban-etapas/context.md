# Kanban de Etapas Context

**Gathered:** 2026-08-12
**Spec:** `.specs/features/kanban-etapas/spec.md`
**Status:** Ready for design

---

## Feature Boundary

O Kanban de Etapas é a superfície de **escrita** de `fat_etapa_contrato` (AD-023) — um board por
produto, uma coluna por `ref_etapa`, um card por `fat_contrato`. Arrastar um card entre colunas
adjacentes grava a transição (datas + status), atualiza `fat_contrato.id_etapa_atual` e audita em
`log_auditoria`. G1/G2 (cálculo de indicadores) e a biblioteca de drag-and-drop (decisão técnica) são
tratados fora desta conversa — a primeira é feature separada, a segunda é resolvida em Design via
pesquisa (Context7/web), não aqui.

---

## Implementation Decisions

Pedro confirmou, sem alteração, o default proposto para todos os 9 pontos que o `spec.md` listava como
"Confirmed? n" — nenhuma rodada de perguntas ao vivo foi necessária (instrução explícita: assumir
sempre a opção recomendada). Decisões, na íntegra:

### Transição válida

- Só entre colunas **adjacentes** (`ordem` N ↔ N+1). Pular uma etapa arrastando de N para N+2 é
  rejeitado — de ponta a ponta (UI trava o drag antes do request; RPC/RLS rejeita mesmo assim, defesa
  em profundidade).
- "Marcar como dispensada" (pular etapa de fato) é ação futura, fora deste MVP — não é uma posição de
  drag, é uma 3ª ação de UI ainda não desenhada.

### Mover pra frente (N → N+1)

- Etapa N: `status = 'concluida'`, `dt_conclusao = hoje` (só se ainda vazia).
- Etapa N+1: `status = 'em_andamento'`, `dt_inicio = hoje` (só se ainda vazia).
- `fat_contrato.id_etapa_atual` passa a ser a etapa N+1.
- Qualquer papel com vínculo ativo ao contrato (Gestora/Mentor/Assessor) ou Admin/Gestora pode mover
  pra frente.

### Mover pra trás (N+1 → N, correção de erro)

- Exclusivo de Admin/Gestora — Mentor/Assessor não conseguem, nem pela UI nem pelo banco.
- Reabre a etapa N (`em_andamento`, `dt_conclusao = NULL`) e zera as datas realizadas da etapa N+1
  (`nao_iniciada`, `dt_inicio = NULL`, `dt_conclusao = NULL`) — nunca deixa um `dt_inicio` "fantasma"
  de uma etapa que a régua real nunca viveu de fato.

### Primeira etapa (`id_etapa_atual IS NULL`)

- O card nasce na coluna 1 mesmo sem nenhuma transição ainda — a coluna 1 trata `NULL` como "está
  aqui". Sem isso, todo contrato recém-instanciado (todas as etapas `nao_iniciada`) ficaria invisível
  no board.

### Concorrência

- Sem lock otimista. Última escrita (`UPDATE`) vence. O board revalida ao reconectar/focar a aba
  (comportamento padrão do TanStack Query já instalado, AD-021). Risco aceito, não ausência de
  decisão — contratos raramente têm duas pessoas movendo o mesmo card no mesmo segundo.

### Filtros do board

- Gestora, Mentor, produto e projeto — combináveis por AND, não mutuamente exclusivos. Produto já
  vem do slug da rota (`/produtos/[slug]`), então na prática são 3 dimensões de filtro dentro da
  tela: papel+pessoa (reaproveitando o filtro já existente no Dashboard do produto), projeto, e
  "minha carteira" (P2, restringe a contratos com vínculo ativo do próprio usuário logado).

### Agent's Discretion

- Escolha da biblioteca de drag-and-drop — resolvida em Design via pesquisa (Context7 indisponível
  nesta sessão; Web search comparando `@dnd-kit/core`, `@dnd-kit/react` e
  `@atlaskit/pragmatic-drag-and-drop`).
- Layout exato do card (quais campos, ordem, badges) e onde o board vive dentro do hub de produto
  (qual aba) — Design decide usando os padrões shadcn já em uso e a estrutura de abas fixas de
  `navegacao-por-produto` (AD confirma abaixo).
- "Há quantos dias está na etapa atual" quando a etapa atual nunca teve `dt_inicio` setado (caso da
  etapa 1 com `id_etapa_atual IS NULL`) — spec não define a régua exata desse número; Design escolhe.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma — todos os 9 pontos do spec já tinham default proposto com rationale e foram confirmados
diretamente (ver acima), sem gray area nova surgindo durante a discussão. As 2 linhas "N/A" (rate
limit, data lifecycle) já vinham com razão registrada, sem necessidade de confirmação de produto.

---

## Specific References

- AD-023 (`.specs/STATE.md`) é a fonte da decisão de que o Kanban É escrita, não leitura — citada
  literalmente no `spec.md` como o "porquê" de cada User Story P1.
- roadmap §5.2 é a origem do requisito de filtros (Gestora/Mentor/produto/projeto) e do gap conhecido
  de biblioteca de drag-and-drop ("nenhuma lib está instalada", achado em 2026-08-10).

---

## Deferred Ideas

- Marcar etapa como "dispensada" (3ª ação de UI, fora do salto de drag) — já registrada em Out of
  Scope do `spec.md`.
- Notificação/alerta de etapa atrasada, histórico visual de transições passadas (linha do tempo),
  reordenar colunas (`ref_etapa.ordem`) — já registradas em Out of Scope do `spec.md`, nada novo
  surgiu aqui.
