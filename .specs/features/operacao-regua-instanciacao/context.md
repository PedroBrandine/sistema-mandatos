# Régua de Etapas e Instanciação Context

**Gathered:** 2026-08-11
**Spec:** `.specs/features/operacao-regua-instanciacao/spec.md`
**Status:** Aguardando confirmação de Pedro nos itens marcados "n" no spec (ponto de integração,
backfill, RLS explícito) antes de avançar pra Design.

---

## Feature Boundary

Provisionar `fat_etapa_contrato`, `rel_formulario_contrato`, `dim_planejamento` (vazia) e a função
`app.instancia_contrato` (já aprovada, verbatim), chamada automaticamente para todo contrato novo e
retroativamente para os já existentes. Sem tela de escrita (isso é o Kanban, feature separada) —
só leitura (régua no detalhe do contrato) e a garantia estrutural de que o contrato nasce completo.

---

## Implementation Decisions

### A função aprovada não "inicia" nada — só cria o esqueleto

- Lido linha a linha em `docs/schema_sistema.sql:1529-1559`: toda etapa nasce `nao_iniciada`,
  nenhuma coluna de `fat_contrato` é tocada (`id_etapa_atual` fica `NULL`).
- Decisão desta feature: **não alterar** esse comportamento — é schema aprovado (AD-008). Instanciar
  ≠ começar a trabalhar. "Começar" (primeira etapa em `em_andamento`, `id_etapa_atual` preenchido)
  passa a ser responsabilidade exclusiva do Kanban (feature separada, AD-023), quando a Gestora
  mover o primeiro card.
- Consequência prática: um contrato recém-criado mostra a régua inteira com todas as etapas
  "não iniciada" até alguém interagir com o Kanban. Isso é esperado, não é bug.

### RLS — lição da FND-USR-02 aplicada por antecipação

- O schema aprovado declara só `USING` na policy `p_por_contrato` (linha 1576-1580). Decisão desta
  feature: acrescentar `WITH CHECK` explícito e idêntico nas 3 tabelas novas, em vez de confiar no
  reuso implícito que uma policy `FOR ALL` faz da `USING`.
- Motivo: é exatamente a categoria de erro que a FND-USR-02 expôs nesta mesma sprint (ausência de
  `WITH CHECK` explícito permitiu escrita indevida em `dim_usuario`). Aqui a condição seria
  logicamente equivalente (`id_contrato` é a coluna certa a validar), mas "parecer equivalente" foi
  precisamente o que escondeu o bug da FND-USR-02 — não repetir o padrão.

### Backfill

- Decisão proposta (não confirmada por Pedro ainda): a própria migration que cria o trigger também
  chama `app.instancia_contrato` para todo `fat_contrato` já existente, uma vez.
- Idempotente por construção (`ON CONFLICT DO NOTHING` já na função) — segura de reaplicar.

### Agent's Discretion

- Nome exato do trigger e da função trigger wrapper (`app.instancia_contrato` espera `BIGINT`, um
  trigger `AFTER INSERT` precisa de uma função wrapper que leia `NEW.id_contrato`) — detalhe de
  implementação, resolvido na fase Design.
- Layout da tela da régua (lista vs. linha do tempo horizontal) — não discutido; Design decide
  usando os padrões shadcn já em uso (`Table`, `Badge` para status).

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma rodada de Discuss ao vivo aconteceu para esta feature (spec produzida em lote, a pedido do
Pedro, junto de outras 4). Todos os pontos abaixo foram gray areas identificadas durante a leitura
do schema aprovado e ficaram registradas como assumptions no `spec.md`, aguardando confirmação:

- Ponto de integração (trigger vs. call-site) — proposto trigger.
- Backfill dos contratos existentes — proposto sim, na mesma migration.
- Quem escreve `id_etapa_atual` depois — proposto: só o Kanban.
- Tratamento de etapa sem `duracao_prevista_dias` — proposto: comportamento literal da função
  (`COALESCE(...,0)`), sem correção.
- Edição manual de datas previstas (replanejamento) — proposto: fora do MVP.

---

## Specific References

- "no sistema o contrato já nasce com suas tabelas" — frase da Definição de Pronto (Constituição
  §6), citada no roadmap como motivo estrutural desta feature vir antes de qualquer outra da onda
  de Operação.

---

## Deferred Ideas

- Ajuste manual de datas previstas (replanejamento de régua) — mencionado como possível extensão
  futura ao ler a função, não pedido por Pedro; registrado como fora de escopo no `spec.md`.
- Notificação/alerta automático quando uma etapa fica atrasada — não discutido; pertenceria a
  Integrações ou a uma feature de notificação própria, não a esta.
