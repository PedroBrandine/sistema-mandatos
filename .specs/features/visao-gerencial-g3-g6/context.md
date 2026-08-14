# Visão Gerencial G3-G6 (Tela Gerencial completa) — Context

**Gathered:** 2026-08-14
**Spec:** `.specs/features/visao-gerencial-g3-g6/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Completar a Tela Gerencial (Constituição §2.6) estendendo a rota `/visao-gerencial`
já existente (G1+G2 em produção, `visao-gerencial-g1-g2`, concluída e validada) com:
barra de recorte global sticky, gate de papel real (mentor/assessor bloqueados),
Bloco 0 (G3+G4, saúde da operação), Bloco 1 (distribuição por etapa), Bloco 2
completo (G1 evolução, G2 evolução, G5, G6, IIP consolidado) e Bloco 3 (gargalos).
A Saída só lê e agrega — nenhuma escrita nesta feature (AD-015).

---

## Implementation Decisions

### Filtro "Período" da barra de recorte

- Período **não** reconstrói o estado da tela inteira num ponto passado. Todo
  card de "estado atual" sempre reflete HOJE, independente do Período selecionado.
- Período controla exclusivamente o **range do eixo X** dos gráficos de evolução
  mensal (G1, G2, G3, G4 — ver decisão de evolução abaixo).
- Efeito prático: mudar Período nunca muda o número herói de G3, a lista do
  Bloco 1, os valores de G5/G6 ou as linhas do Bloco 3 — só encurta/alonga
  quantos meses aparecem nos gráficos de linha/small multiples.

### Evolução mensal — quais indicadores reconstroem histórico agora

- **G1 (carteira ponderada)**: constrói agora. Sem tabela de snapshot, a
  evolução mensal é uma **reconstrução histórica via `generate_series` de
  meses sobre `fat_etapa_contrato`** — para cada mês de referência M, qual
  etapa cada contrato estava (`dt_inicio <= fim_do_mês(M) AND (dt_conclusao IS
  NULL OR dt_conclusao > fim_do_mês(M))`), ponderada por `ref_peso_etapa`, somada
  por Gestora com vínculo ativo naquele mês (`rel_usuario_contrato.dt_inicio <=
  fim_do_mês(M) AND (dt_fim IS NULL OR dt_fim > fim_do_mês(M))`). Detalhe exato
  da view/função fica para Design.
- **G2 (tempo de ciclo)**: já resolvido por alteração aditiva de `vw_ciclo_etapa`
  (expõe a data de conclusão da etapa) — bucket por mês de `dt_conclusao`, sem
  reconstrução, é o mês em que o ciclo realmente terminou.
- **G3 (cobertura de registro) e G4 (taxa de resposta)**: mesma classe de
  reconstrução "como estava no mês M" de G1, mas mais simples — não dependem de
  peso de etapa, só de comparar datas de evento (`fat_registro.ocorrido_em`,
  `fat_submissao.enviada_em`/`rel_formulario_contrato.dt_abertura`) contra o
  fim de cada mês de referência. Confirmar viabilidade exata em Design; se
  aparecer um obstáculo técnico real (não previsto agora), documentar como novo
  achado, não assumir que "já está resolvido" só por analogia com G1.
- **G5 (atingimento)**: **não** constrói agora — decisão já tomada antes desta
  sessão de Discuss. `fat_snapshot_mensal` (OUT-06, job de fechamento mensal)
  não existe; G5 nasce com estado atual real e evolução como placeholder
  explícito, `TODO(OUT-06)`.
- **G6 (completude de cadastro)**: **assumption do agente, não perguntado ao
  Pedro nesta rodada** — evolução de G6 exigiria saber *quando* cada campo de
  cadastro foi preenchido, o que só existe (se existir) em `log_auditoria`
  (granularidade por campo, não confirmada). Até a fase de Design confirmar
  isso, G6 nasce **sem** evolução, `TODO(G6-evolucao)`, mesmo padrão de G5.
  Reavaliar em Design antes de aceitar como definitivo — pode ser mais barato
  do que parece, ou pode não ser.

### Combinação Gestora + Mentor no filtro

- **E lógico, só vínculo ativo**: quando os dois filtros estão preenchidos,
  só aparecem contratos onde a Gestora selecionada E o Mentor selecionado têm
  `rel_usuario_contrato` com `dt_fim IS NULL` (vínculo ativo) hoje.
- `rel_usuario_contrato` não limita a 1 mentor por contrato (`UNIQUE
  (id_contrato, id_usuario, papel_no_contrato)`, não `UNIQUE (id_contrato,
  papel_no_contrato)`) — um contrato pode ter mais de um Mentor simultâneo. O
  filtro por Mentor sempre restringe à interseção com esse Mentor específico,
  nunca "qualquer Mentor".
- Consistente com a decisão de Período acima: vínculo **histórico** (`dt_fim`
  preenchido) nunca entra no filtro, porque Período não reconstrói estado
  passado da tela.

### Bloco 3 — comportamento de "agrupar por"

- Agrupar por categoria ou por Gestora reorganiza a tabela em **seções
  colapsáveis (accordion)** — cada seção com cabeçalho + contagem de linhas,
  podendo abrir/fechar independentemente.
- Ordenação padrão dentro de cada seção continua "dias em aberto, decrescente"
  (regra já fixada no pedido original, não reaberta aqui).

### Agent's Discretion

- Nome exato de `vw_resposta_formulario` (ou equivalente) e desenho fino de
  `vw_pendencias` (colunas, ordem das 6 uniões) — Design decide.
- Biblioteca de gráfico: Recharts via primitivos de chart do shadcn/ui
  (decisão de baixo risco, mesmo tipo de precedente que gerou a AD-034 do
  `@dnd-kit` para o Kanban) — não foi perguntado ao Pedro, será registrado como
  nova AD se confirmado em Design.
- Página 403 para mentor/assessor: não existe nenhum precedente no projeto
  (grep confirmou zero rota "não autorizado" hoje). Agente decide o componente
  exato em Design, respeitando só a AC literal ("recebem 403").

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma área foi recusada — as 4 discutidas cobriram os pontos que o agente
identificou como genuinamente ambíguos. A decisão de G6 acima é uma assumption
do agente (não uma pergunta feita), registrada explicitamente aqui e em
`spec.md` conforme a Requirement Closure Gate exige.

---

## Specific References

Nenhuma referência visual/de produto externa foi trazida pelo Pedro nesta
sessão — o desenho de layout já vem inteiramente especificado no pedido
original (seções 1-13, barra sticky, sem painel lateral, Bloco 0 no topo).

---

## Deferred Ideas

- Exportação (OUT-04) — sub-sistema próprio (rate limit + auditoria), spec
  separada depois desta.
- GIP e NPS agregado (`formularios-produto` fases 2/3, não migradas ainda).
- `fat_snapshot_mensal`/OUT-06 (job de fechamento mensal) — spec própria,
  fora desta fatia; G5 só consome quando existir.
