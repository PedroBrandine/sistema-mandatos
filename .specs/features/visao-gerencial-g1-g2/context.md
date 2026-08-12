# G1 + G2 Context

**Gathered:** 2026-08-11
**Spec:** `.specs/features/visao-gerencial-g1-g2/spec.md`
**Status:** Confirmado por Pedro em 2026-08-12 — criação de `ref_peso_etapa` (GRANT-only, AD-030,
peso=1 default), tratamento de `id_etapa_atual IS NULL` (1ª etapa) e de lacuna de seed (exclui da
soma) aprovados. Pré-requisito verificado nesta sessão: `kanban-etapas` commitado em `develop`
(`ed0abb6` é o HEAD da feature) e `validation.md` confirma `app.mover_etapa_kanban` gravando
transições reais em `fat_etapa_contrato` (teste de integração ao vivo contra o Supabase de dev,
15/15 verde). Pronto para Design.

---

## Feature Boundary

G2 (mediana de tempo de ciclo por etapa) e G1 (carteira ponderada por Gestora/Mentor, com
atingimento médio acessório), mais uma página mínima que junta os dois com link pro Kanban. Não é
a visão gerencial completa (G3-G6 ficam para depois de Incidência/Planejamento/Formulários).

---

## Implementation Decisions

### O achado que muda o escopo: falta uma tabela de peso por etapa

- G1, como a Constituição define (§2.6), pondera cada contrato pelo **peso da etapa** em que ele
  está — não é uma contagem simples. Ao verificar os 16 catálogos já provisionados pela Trilha C
  (`ref_etapa` incluída), nenhum tem essa coluna.
- Diferente do bloqueio de `mv_iip_contrato` (AD-032), que é uma dependência estrutural real (a
  view não compila sem o objeto existir), aqui não existe impedimento técnico — é só uma tabela de
  catálogo que faltou nascer. Decisão proposta: criar `ref_peso_etapa` nesta feature, seguindo o
  padrão GRANT-only já estabelecido (AD-030) pra catálogos, com peso = 1 em toda linha até o
  levantamento humano (mesmo padrão da CAT-16: `ref_agenda_tematica`/`ref_indicador`/
  `ref_tipologia` nasceram vazias de propósito).

### G2 não precisa de nada novo

- A definição da Constituição ("entrada na etapa seguinte − entrada na etapa anterior") e o
  comportamento real do Kanban (que grava `dt_conclusao` da etapa N e `dt_inicio` da etapa N+1 no
  mesmo instante, numa transição de avanço) colapsam pro mesmo cálculo:
  `dt_conclusao - dt_inicio` da própria etapa concluída. Não há ambiguidade real aqui — só
  confirmação de leitura, registrada como assumption "y" (não "n") no spec.

### `vw_carteira` reduzida

- Decisão já tomada por Pedro em 2026-08-10 (AD-032) — esta feature só implementa, não reabre a
  discussão. Ver `.specs/STATE.md`.

### Agent's Discretion

- Nome exato da view/query que agrega G1 (`vw_g1_carteira_ponderada` foi só um exemplo no spec) —
  Design decide se cabe como view SQL ou agregação na camada de backend, respeitando a regra "só
  via view, nunca direto em tabela transacional".
- Layout dos dois indicadores na página mínima (lado a lado vs. um abaixo do outro) — não
  discutido; Design usa os padrões shadcn já em uso.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma rodada de Discuss ao vivo aconteceu — spec produzida em lote a pedido do Pedro. Gray areas
registradas como assumptions no `spec.md`, confirmadas por Pedro em 2026-08-12:

- Criação de `ref_peso_etapa` (a mais importante — muda o escopo de migration da feature). ✅
- Peso inicial = 1 pra todas as etapas. ✅
- Tratamento de contrato sem `id_etapa_atual` ainda (conta na 1ª etapa). ✅
- Tratamento de lacuna de seed em `ref_peso_etapa` (exclui da soma, não assume peso 1). ✅

---

## Specific References

- Constituição §2.6, bloco "Indicadores de gestão" — fonte literal das definições de G1 e G2,
  citada linha a linha no `spec.md`.

---

## Deferred Ideas

- Evolução mês a mês de G1/G2 (série histórica reconstruída das datas de transição) — a
  Constituição permite (classifica os dois como "Derivada", sem precisar de snapshot), mas a
  reconstrução temporal é trabalho de agregação não-trivial; registrada como fora de escopo desta
  fatia, candidata natural a uma próxima.
- Tela de administração do peso por etapa — mesma lógica da Trilha C: entra quando houver mais
  catálogo pra administrar, não agora.
