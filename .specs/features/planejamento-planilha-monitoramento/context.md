# Planejamento / Planilha de Monitoramento Context

**Gathered:** 2026-08-11
**Updated:** 2026-08-12 — confirmação de Pedro registrada abaixo; pré-requisito
`operacao-regua-instanciacao` verificado como commitado e concluído (§5.1 ✅ CONCLUÍDA,
`dim_planejamento` provisionada e vazia).
**Spec:** `.specs/features/planejamento-planilha-monitoramento/spec.md`
**Status:** Confirmado — pronto para Design.

---

## Confirmação de Pedro (2026-08-12)

Quatro pontos levantados como "n" (não confirmado) no `spec.md`; resposta de Pedro em cada um:

1. **Fórmula de cascata (Meta→Objetivo, Objetivo→Planejamento)**: confirmada a proposta do spec —
   **média simples** nos dois níveis de cima (só o nível folha, peso do Sucesso Mensal somando 100,
   tem regra explícita no schema). Sem ponderação por nº de filhos nem outra regra.
2. **`fat_meta.classe = 'governanca'` no PLL**: confirmado — restringir **só via UI**, sem CHECK novo
   no schema aprovado (AD-008 preservado, nenhuma migração de constraint necessária por esta
   feature).
3. **Escopo de escrita do Assessor em `fat_sucesso_mensal`**: **revisado**, não confirmado como
   proposto. A proposta original (`GRANT UPDATE (pct_atingimento, status)`, só 2 colunas) foi
   **substituída** — Pedro determinou que o Assessor deve poder editar **todas as colunas** da linha
   de Sucesso Mensal (`pct_atingimento`, `status`, `peso`, `descricao`, `mes_referencia`,
   `dt_limite`), não só o par valor/status. A fronteira de escrita passa a ser "a linha de Sucesso
   Mensal inteira" vs. "a estrutura acima dela" (`fat_meta`/`fat_objetivo_especifico`/
   `dim_planejamento`, que continuam exclusivas de Gestora/Mentor/Admin), e não mais um recorte de
   colunas dentro da mesma linha. Mecanismo continua nativo do Postgres (GRANT + RLS de linha
   herdada de `p_por_contrato`), sem abrir exceção nova à AD-010 — só o `GRANT` passa a cobrir a
   tabela inteira em vez de uma lista de 2 colunas. Isso reverteu a AC original da User Story "P1:
   Assessor só edita o valor, não a estrutura" (renomeada para "Assessor escreve o Sucesso Mensal
   por completo, mas não a estrutura acima" — ver `spec.md`).
4. **Validação de soma de `peso` = 100 por Meta**: confirmado — **alerta visual, sem bloqueio** da
   edição diária. Fica ainda mais relevante agora que o Assessor pode editar `peso` diretamente (item
   3): o alerta é o único mecanismo que sinaliza o desvio sem travar o uso do dia a dia.

---

## Feature Boundary

Provisionar a hierarquia Objetivo Específico → Meta → Sucesso Mensal, com grade editável rápida
(a "Planilha de Monitoramento") e cascata de atingimento assíncrona. Levantamento explícito de
campo × produto — entregue como parte do próprio `spec.md`, a pedido direto do Pedro, não adiado
pra Design.

---

## Implementation Decisions

### O quadro de campos por produto é o entregável central desta rodada

- Pedro pediu explicitamente: "todos os campos e diferenças entre os produtos" antes de Design.
- Metodologia usada: ler as 4 tabelas (`dim_planejamento`, `fat_objetivo_especifico`, `fat_meta`,
  `fat_sucesso_mensal`) coluna a coluna em `docs/schema_sistema.sql:877-980`, cruzando com os
  comentários de coluna que já existem (são a única fonte confiável de diferença documentada) e
  com a AD-012 (schema único, discriminado por produto via nulidade, nunca coluna por produto).
- Resultado: **uma diferença estrutural confirmada** (`fat_meta.id_preditor_secundario`, Estratégia
  usa 2 preditores, PLL usa 1) e **uma suspeita não confirmada** (`fat_meta.classe = 'governanca'`
  provavelmente nunca ocorre no PLL, mas nada no schema proíbe isso via CHECK). A suspeita foi
  registrada como Assumption, não como fato — não inventar uma regra que o schema não afirma.

### Cascata: a coluna já responde "quando", falta "como"

- `dim_planejamento.atingimento_desatualizado` e seu comentário (`docs/schema_sistema.sql:891-892`)
  já resolvem a pergunta "recalcular a cada edição ou não" — é assíncrono por desenho, não é uma
  decisão nova desta feature.
- O que o schema **não** resolve é a fórmula exata dos dois níveis intermediários (Meta→Objetivo,
  Objetivo→Planejamento) — só o nível folha (peso do Sucesso Mensal somando 100) tem regra
  explícita. Proposta (média simples nos dois níveis de cima) — **confirmada por Pedro em
  2026-08-12** (ver "Confirmação de Pedro" acima).

### Assessor escreve — a linha inteira, não uma fatia (revisado 2026-08-12)

- Jornada A6.1 (`docs/jornadas-de-usuario-v2.md:119`) documenta que Assessor E Gestora atualizam o
  % dos Sucessos Mensais — é a primeira vez no roadmap que o papel Assessor tem escrita real no
  sistema (hoje só existe como conceito de RBAC, sem superfície).
- Proposta original desta rodada (`GRANT UPDATE (pct_atingimento, status)`, só 2 colunas) foi
  **substituída** pela confirmação de Pedro: o Assessor grava **todas** as colunas de
  `fat_sucesso_mensal` (a linha inteira), não um subconjunto. O mecanismo continua o mesmo —
  `GRANT UPDATE ON fat_sucesso_mensal TO legisla_assessor` (agora sem lista de colunas, cobrindo a
  tabela toda) em vez de uma Edge Function nova, evitando abrir exceção à AD-010. A fronteira de
  RBAC que sobrevive é entre tabelas (`fat_sucesso_mensal` gravável, `fat_meta`/
  `fat_objetivo_especifico`/`dim_planejamento` não), não mais entre colunas de uma mesma tabela.

### Agent's Discretion

- Nome exato da tela/rota da grade — Design decide, dado que a Trilha F já reservou o link
  "Planejamento Estratégico" na ficha do contrato (hoje placeholder "em desenvolvimento").
- Job de recálculo da cascata (cron vs. trigger com debounce vs. cálculo on-demand ao abrir a tela)
  — mecanismo de implementação, não requisito de produto.

### Declined / Undiscussed Gray Areas → Assumptions

Rodada de Discuss síncrona aconteceu em 2026-08-12 (ver "Confirmação de Pedro" acima) para as 4 gray
areas mais sensíveis; as 2 restantes seguem sem dúvida levantada, com o default original mantido:

- ~~Uso de `classe = 'governanca'` restrito via UI, não via schema.~~ — confirmado.
- ~~Fórmula de cascata nos 2 níveis superiores (a mais crítica).~~ — confirmado.
- ~~Escopo exato de escrita do Assessor.~~ — confirmado, **revisado para todas as colunas** de
  `fat_sucesso_mensal` (não só `pct_atingimento`/`status`, como a proposta original desta seção
  dizia).
- ~~Mecanismo de restrição (`GRANT`).~~ — confirmado, ajustado para `GRANT` de tabela inteira.
- ~~Validação de soma de peso = 100 como alerta, não bloqueio de uso diário.~~ — confirmado.
- Leitura de Coalizão sem planejamento próprio (agregada, sem escrita nova) — sem dúvida levantada,
  default mantido.

---

## Specific References

- Comentário de `fat_meta.id_preditor_secundario` (`docs/schema_sistema.sql:953-954`) — citado
  literalmente no spec como a única diferença estrutural confirmada entre Estratégia e PLL.
- Jornada A6.1 (`docs/jornadas-de-usuario-v2.md`) — origem da regra "Assessor/Gestora atualizam o %".
- AD-028 (`.specs/STATE.md`) — origem do requisito de velocidade da grade (tabulação, colar,
  edição em massa) como risco de adoção registrado, não sugestão nova desta spec.

---

## Deferred Ideas

- Dialog "editar detalhes" por linha de Sucesso Mensal (`peso`/`descricao`/`mes_referencia`/
  `dt_limite`) — cortado do escopo em Execute (T15): nenhuma AC do `spec.md` exige uma UI pra esses
  campos; o GRANT completo do Assessor (PLM-05) já está provado no banco (T11), só não tem
  superfície de edição pra `peso`/`descricao`/`mes_referencia`/`dt_limite` fora da grade ainda.
  Candidato a entrar como task própria se a Gestora precisar corrigir esses campos sem SQL direto.
- GIP (`fat_gip`/`fat_gip_dimensao`) — tabela relacionada mas fora da hierarquia de Sucessos
  Mensais; candidata a feature própria.
- Migração do histórico das planilhas legadas (escalas 0–1 vs. 0–100) — é INT-04, projeto separado
  e descartável, não desta feature.
- Notificação de Sucesso Mensal não atualizado no mês — pertence a G5 (Saída), que só lê o dado que
  esta feature grava.
