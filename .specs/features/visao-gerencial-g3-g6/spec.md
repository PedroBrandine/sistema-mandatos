# Visão Gerencial G3-G6 (Tela Gerencial completa) Specification

## Problem Statement

A coordenação de Mandatos hoje só enxerga G1 (carteira ponderada) e G2 (tempo de
ciclo) em `/visao-gerencial` — o resto da Definição de Pronto constitucional
("a coordenação acompanha a operação pelos indicadores de gestão sem
consolidação manual") continua atrás de um placeholder `<EmDesenvolvimento
titulo="G3-G6 em desenvolvimento" />`. Sem G3/G4 (saúde do próprio sistema —
"o sistema está sendo usado de verdade ou a operação voltou pra planilha por
baixo do pano?"), sem visão de onde os mandatos estão na régua, sem G5/G6/IIP e
sem uma tabela única de gargalos, a Gestora continua dependendo de
levantamento manual pra saber onde intervir.

## Goals

- [ ] Bloco 0 (G3+G4) visível acima de qualquer indicador de mandato, com
      estado atual + evolução mensal reais.
- [ ] Barra de recorte única (Produto/Projeto/Gestora/Mentor/Período), na URL,
      aplicada a todos os blocos — nenhum bloco com filtro próprio contraditório.
- [ ] G1/G2 (já validados) passam a consumir esse filtro global; G1 ganha
      evolução mensal real (reconstruída, sem depender de snapshot).
- [ ] Bloco 1 (distribuição por etapa), G5, G6 e IIP consolidado com leitura
      real, cada um com as duas leituras exigidas (estado atual + evolução, ou
      TODO explícito quando genuinamente bloqueado).
- [ ] Bloco 3 (gargalos) — tabela única, agrupável, navegável, alimentada por
      uma `vw_pendencias` nova com as 6 categorias fechadas do domínio.
- [ ] Papéis mentor/assessor bloqueados de verdade (hoje não há gate nenhum
      nesta rota — falha de acesso real, não só um gap de UX).

## Out of Scope

| Item | Reason |
| --- | --- |
| Rota `/gerencial` nova | Decidido com o Pedro: estende `/visao-gerencial` existente (G1+G2 já em produção lá) em vez de duplicar rota. |
| Exportação (OUT-04) | Sub-sistema com rate limit e auditoria próprios — tamanho de spec separada. |
| `fat_snapshot_mensal` / job de fechamento mensal (OUT-06) | Não existe hoje, nenhuma feature ativa está construindo. G5 nasce sem evolução mensal, `TODO(OUT-06)`. |
| GIP e NPS agregado | `formularios-produto` fases 2/3 (schema ainda não migrado) — G4 nasce só com taxa de resposta por formulário. |
| Reconstrução histórica da tela inteira via filtro Período | Decidido: Período só controla o range dos gráficos de evolução, nunca "estado atual" retroativo. |
| Fórmula final do IIP (D2) | Pendente com a área de conhecimento — exibido como `iip_provisorio`, rotulado. |
| CRUD de `vw_pendencias`/pendência (marcar como resolvida, ignorar) | Proibido pela Constituição — pendência é sempre derivada, nunca digitada. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Evolução de G6 (completude de cadastro) | Nasce sem evolução, `TODO(G6-evolucao)`, a menos que Design confirme que `log_auditoria` tem granularidade por campo suficiente pra reconstruir "quando cada campo foi preenchido" | Não perguntado ao Pedro nesta rodada — é uma lacuna técnica que só apareceu ao desenhar G1/G3/G4; mesma classe de risco de G1 mas sem confirmação de viabilidade ainda | n (assumption do agente, revisitar em Design) |
| Biblioteca de gráfico | Recharts, via primitivos de chart do shadcn/ui | Nenhuma lib de gráfico está instalada; Recharts é o padrão do ecossistema shadcn, mesmo tipo de decisão de baixo risco que gerou a AD-034 (`@dnd-kit`) | n (agente decide, registra como AD nova se confirmado em Design) |
| Componente de bloqueio 403 para mentor/assessor | Componente novo, sem precedente no projeto (grep confirmou zero rota "não autorizado" hoje) | A AC original só exige "recebem 403 mesmo com URL direta" — não especifica UI | n (agente decide o componente exato em Design) |
| Padrão Server Component + `<Suspense>` por bloco | Primeiro do tipo no projeto (hoje toda tela é 100% Client Component + `useQuery`) | O pedido original exige explicitamente esse padrão por performance ("a tela pinta em partes"); é uma mudança de convenção que precisa ser documentada como SPEC_DEVIATION do padrão vigente, não tratada como bug | y (exigência literal do pedido original, não é uma escolha aberta) |
| G3/G4 evolução mensal são reconstrutíveis sem snapshot (mesma técnica de G1) | Sim, por padrão — mas Design deve confirmar antes de assumir como resolvido | São indicadores derivados de tabelas de evento com timestamp (`fat_registro`, `fat_submissao`, `rel_formulario_contrato`), não de coluna recalculada in-place como `pct_atingimento` — mas isso é inferência do agente, não uma prova | n (Design confirma; se houver obstáculo real, documentar como achado novo) |

**Open questions:** nenhuma sem resposta — todas resolvidas com o Pedro (ver `context.md`) ou registradas acima como assumption explícita.

---

## User Stories

### P1: Barra de recorte + gate de papel + Bloco 0 (Saúde da operação) ⭐ MVP

**User Story**: Como Gestora/Admin, quero abrir `/visao-gerencial` e ver
imediatamente se a operação está de fato usando o sistema (G3+G4), com um
recorte que se aplica a tudo, sem que Mentor/Assessor consigam ver a mesma
tela.

**Why P1**: G3/G4 são constitucionalmente o que vem primeiro — medem o próprio
sistema, não os mandatos. Também é a fatia que constrói a infraestrutura
(barra de recorte, gate de papel, `vw_pendencias` parcial, `vw_resposta_formulario`)
de que todos os outros blocos dependem.

**Acceptance Criteria**:

1. WHEN um usuário com `papel_global` `mentor` ou `assessor` acessa
   `/visao-gerencial`, inclusive por URL direta, THEN o sistema SHALL bloquear
   com 403 antes de renderizar qualquer bloco de dado.
2. WHEN a tela carrega sem filtro na URL THEN a barra de recorte SHALL exibir
   os 5 filtros vazios (Produto, Projeto, Gestora, Mentor, Período) e todos os
   blocos SHALL considerar o universo completo permitido pela RLS do usuário.
3. WHEN o usuário muda qualquer filtro da barra THEN a URL (`searchParams`)
   SHALL refletir o novo estado e todo bloco vigente SHALL recarregar com o
   recorte novo.
4. WHEN existe ao menos um filtro ativo THEN a barra SHALL exibir um chip
   removível por filtro e um botão "limpar tudo".
5. WHEN Gestora e Mentor estão ambos preenchidos THEN o recorte SHALL
   considerar só contratos onde os dois têm vínculo ativo (`dt_fim IS NULL`)
   simultaneamente.
6. WHEN a tela renderiza THEN o Bloco 0 (G3+G4) SHALL aparecer acima de
   qualquer indicador de mandato (G1/G2/G5/G6), sempre.
7. WHEN o Bloco 0 renderiza THEN G3 SHALL mostrar: (a) % de contratos ativos
   com registro nos últimos 45 dias como número herói, (b) contagem absoluta
   dos que estão sem, (c) contagem de etapas concluídas sem registro lançado,
   e (d) gráfico de linha da cobertura mês a mês no range do filtro Período.
8. WHEN o Bloco 0 renderiza THEN G4 SHALL mostrar: (a) barras horizontais da
   taxa de resposta por formulário, ordenadas pela taxa, (b) contagem de
   formulários abertos há mais de 30 dias, e (c) linha da taxa média de
   resposta mês a mês no range do filtro Período.
9. WHEN G1 ou G2 (já existentes) estão na tela THEN eles SHALL consumir o
   filtro global da barra, sem manter seletor próprio de papel/produto/gestora
   independente.

**Independent Test**: Logar como Gestora, abrir `/visao-gerencial`, confirmar
Bloco 0 no topo com número real; logar como Mentor, tentar acessar a mesma URL
direto, confirmar 403; mudar filtro de Produto na barra, confirmar que G3/G4/G1/G2
recarregam e a URL muda.

---

### P2: Bloco 1 + Bloco 2 completo (G1 evolução, G5, G6, IIP)

**User Story**: Como Gestora, quero ver onde os mandatos estão na régua, a
evolução real da carteira ponderada, o atingimento, a completude de cadastro e
o IIP consolidado do recorte atual.

**Why P2**: Depende da barra de recorte e do gate já existirem (P1). Fecha a
leitura de "estado atual" de toda a operação — só falta o consolidado de
gargalos (P3).

**Acceptance Criteria**:

1. WHEN o Bloco 1 renderiza THEN SHALL mostrar barras horizontais de
   contratos ativos por etapa, ordenadas por `ref_etapa.ordem` (nunca por
   valor), com o segmento de atrasados destacado e rotulado dentro de cada barra.
2. WHEN o usuário clica numa etapa do Bloco 1 THEN SHALL abrir modal com a
   lista de contratos naquela etapa, cada um linkando pro Kanban do produto.
3. WHEN o card de G1 renderiza THEN SHALL mostrar evolução mensal da carteira
   ponderada por Gestora (linha, 1 série por pessoa, máx. 8 + "Outras"),
   reconstruída a partir de `fat_etapa_contrato`, no range do filtro Período.
4. WHEN o card de G2 renderiza THEN SHALL mostrar small multiples de mediana
   mensal por etapa, no range do filtro Período.
5. WHEN o Bloco 2 renderiza THEN G5 SHALL mostrar % de atingimento por
   produto e por projeto, mais a contagem de Sucessos Mensais não atualizados
   no mês corrente.
6. WHEN o card de G5 renderiza THEN a área de evolução SHALL mostrar
   placeholder explícito "aguardando fechamento mensal (OUT-06)" — nunca
   gráfico vazio silencioso.
7. WHEN parte dos contratos do recorte tem `atingimento_desatualizado = true`
   THEN G5 SHALL sinalizar quantos são, nunca mostrar o agregado como se
   estivesse fresco.
8. WHEN o Bloco 2 renderiza THEN G6 SHALL mostrar barras pelos 5 campos fixos
   (`ds_genero`, `ds_raca`, `fl_pcd`, `confianca`, `nr_titulo_eleitoral`) com a
   contagem de contratos afetados por campo.
9. WHEN o Bloco 2 renderiza THEN o card de IIP SHALL mostrar distribuição por
   nível + valor consolidado do recorte, rotulado "provisório" (D2), lendo
   `iip_provisorio` de `mv_iip_contrato`, com o timestamp do último refresh
   visível ao lado.

**Independent Test**: Filtrar por um produto específico, confirmar que Bloco 1
reordena por etapa (não por volume), abrir uma etapa e ver a lista de
contratos; confirmar que G1 mostra um gráfico de linha com histórico real (não
vazio) para um período com dado.

---

### P3: Bloco 3 — Gargalos

**User Story**: Como Gestora, quero uma tabela única de tudo que está
pendente na operação, agrupável, que me leve direto pra onde o problema se
resolve.

**Why P3**: Consome `vw_pendencias` já construída pelas fatias anteriores
(P1 criou as categorias de G3/G4, P2 as de G6/G5) — fecha a tela.

**Acceptance Criteria**:

1. WHEN o Bloco 3 renderiza THEN SHALL mostrar tabela única com as 6
   categorias exatas de `vw_pendencias` (`cadastro`, `formulario_aberto`,
   `etapa_atrasada`, `encontro_vencido`, `sem_registro_recente`,
   `sucesso_mensal_atrasado`), colunas mandato/categoria/detalhe/data de
   referência/dias em aberto/Gestora responsável, ordenação padrão por dias em
   aberto decrescente.
2. WHEN o usuário agrupa por categoria ou por Gestora THEN a tabela SHALL
   reorganizar em seções colapsáveis (accordion), mantendo a ordenação por
   dias em aberto dentro de cada seção.
3. WHEN o usuário clica numa linha THEN SHALL navegar pra tela de origem do
   dado que gerou a pendência — nunca abre modal, nunca oferece
   "resolver"/"ignorar".
4. WHEN o recorte não retorna nenhuma pendência THEN o Bloco 3 SHALL mostrar
   estado vazio "sem pendências neste recorte", distinto de erro.

**Independent Test**: Sem nenhum filtro, confirmar que a tabela lista
pendências reais das 6 categorias; agrupar por Gestora, confirmar seções
colapsáveis; clicar numa linha de `etapa_atrasada`, confirmar que abre o
Kanban do contrato, não um modal.

---

## Edge Cases

- WHEN um indicador não tem amostra (ex.: etapa sem nenhum ciclo concluído)
  THEN SHALL mostrar "—", nunca `0` (AD-005) — regra que vale pra G1/G2/G3/G4/G5/G6.
- WHEN um contrato é de Coalizão (sem `dim_mandato`) THEN a categoria
  `cadastro` de `vw_pendencias` SHALL simplesmente não gerar linha pra ele
  (join contra `dim_mandato` não casa) — comportamento correto por construção,
  não um bug a esconder.
- WHEN mais de 8 Gestoras aparecem na evolução de G1 THEN as excedentes SHALL
  ser agrupadas em uma série "Outras", nunca 9+ cores.
- WHEN `mv_iip_contrato` está desatualizada THEN a tela SHALL mostrar o
  timestamp do último refresh — número velho declarado, nunca disfarçado de
  fresco.
- WHEN o filtro Período é alterado THEN SHALL afetar apenas os gráficos de
  evolução — nenhum número de "estado atual" em nenhum bloco muda.
- WHEN um bloco falha (erro de query) THEN os outros 3 blocos SHALL continuar
  renderizando normalmente — falha isolada por bloco (`<Suspense>`/`ErroInline`
  próprios), nunca a tela inteira quebrada por um bloco.
- WHEN um usuário Gestora/Admin acessa a tela sem nenhum contrato no seu
  escopo de RLS THEN cada bloco SHALL mostrar seu próprio estado vazio
  explicando a ausência — nunca omitir o bloco inteiro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GER-01 | P1: Barra + gate + Bloco 0 | Design | Pending |
| GER-02 | P1 | Design | Pending |
| GER-03 | P1 | Design | Pending |
| GER-04 | P1 | Design | Pending |
| GER-05 | P1 | Design | Pending |
| GER-06 | P1 | Design | Pending |
| GER-07 | P1 (G3) | Design | Pending |
| GER-08 | P1 (G4) | Design | Pending |
| GER-09 | P1 (G1/G2 refactor) | Design | Pending |
| GER-10 | P2 (Bloco 1) | Design | Pending |
| GER-11 | P2 (Bloco 1 modal) | Design | Pending |
| GER-12 | P2 (G1 evolução) | Design | Pending |
| GER-13 | P2 (G2 evolução) | Design | Pending |
| GER-14 | P2 (G5 estado atual) | Design | Pending |
| GER-15 | P2 (G5 evolução TODO) | Design | Pending |
| GER-16 | P2 (G5 desatualizado) | Design | Pending |
| GER-17 | P2 (G6 estado atual) | Design | Pending |
| GER-18 | P2 (IIP) | Design | Pending |
| GER-19 | P3 (tabela) | Design | Pending |
| GER-20 | P3 (accordion) | Design | Pending |
| GER-21 | P3 (navegação) | Design | Pending |
| GER-22 | P3 (vazio) | Design | Pending |

**ID format:** `GER-NN` (Gerencial — segue a numeração de `visao-gerencial-g3-g6`, distinta do prefixo `GG-` já usado por `visao-gerencial-g1-g2`).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 22 total, 0 mapped to tasks yet, 22 unmapped ⚠️ (aguardando fase Tasks)

---

## Success Criteria

- [ ] Mentor/Assessor recebem 403 real (server-side), inclusive por URL direta.
- [ ] Mudar qualquer filtro da barra atualiza todos os blocos vigentes e a URL.
- [ ] G3 e G4 aparecem acima de qualquer indicador de mandato, sempre.
- [ ] G1, G2, G3, G4 têm evolução mensal real (não placeholder) sem depender de
      `fat_snapshot_mensal`.
- [ ] G5 e (condicionalmente) G6 documentam seu TODO de evolução de forma
      explícita, nunca como gráfico vazio silencioso.
- [ ] Bloco 3 lista as 6 categorias reais de `vw_pendencias`, agrupável,
      navegável, sem nenhuma ação de "resolver"/"ignorar" em nenhum lugar do
      código.
- [ ] Nenhuma query de escrita em todo o código desta feature (AD-015).
- [ ] `npm run build && npm run lint:all && npm run test:unit && npm run
      test:integration` verdes, mesma baseline de problemas pré-existentes.
