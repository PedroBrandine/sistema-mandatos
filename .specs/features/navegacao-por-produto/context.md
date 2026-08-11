# Navegação por Produto Context

**Gathered:** 2026-08-11
**Spec:** `.specs/features/navegacao-por-produto/spec.md`
**Status:** Aguardando confirmação de Pedro nos itens ainda abertos no spec (ver Assumptions &
Open Questions) antes de avançar pra Design.

---

## Feature Boundary

Substituir a landing page pós-login por um hub de 4 produtos (Estratégia, PLL, Coalizão, Visão
Gerencial) e dar a cada um dos 3 produtos operados pelo sistema uma área com 4 abas fixas
(Dashboard, Agenda, Contratos, Cadastro de novo Contrato). Introduzir uma ficha operacional por
contrato, reaproveitada entre mandato e coalizão. Sem migration nova — só reorganização de
frontend/rotas sobre tabelas já provisionadas.

---

## Implementation Decisions

### Unidade da ficha operacional (contrato vs. contratante)

- A ficha nasce por **contrato** (`/contratos/[id]`), não por contratante.
- Motivo do próprio Pedro, confirmado direto: etapa de implementação, assessores, formulários e
  planejamento são todos conceitos por contrato — um mandato pode ter um contrato de Estratégia
  hoje e abrir um de PLL depois, cada um com sua própria régua/planejamento.
- `/mandatos/[id]` e `/coalizoes/[id]` continuam existindo para dados cadastrais/TSE do
  contratante — não competem com a ficha nova, servem propósito diferente.

### Navegação de topo (sidebar vs. hub)

- O hub de produtos **substitui** a sidebar atual (Início/Mandatos/Contratos/Coalizões/Usuários)
  dentro da área autenticada.
- "Usuários" (gestão de equipe do sistema) não é produto — precisa de um lugar novo, fora dos 4
  botões (proposto: menu no cabeçalho, visível a admin/gestora — ver spec, item ainda "n" de
  confirmar).

### Cadastro de novo contrato

- Reaproveita o wizard/`ContratoForm` já existentes — não é um fluxo novo do zero.
- O campo produto vem pré-travado pelo produto da aba onde o usuário está (Estratégia/PLL/Coalizão
  já resolvidos, sem seleção manual).
- Cobre tanto "contratante novo" quanto "contrato novo pra contratante já existente" (mesma lógica
  já implementada para Coalizão em CMU-15).

### Escopo desta semana (o que é real vs. placeholder)

- Confirmado que quase todo o *conteúdo* das abas — Kanban, indicadores de atingimento/metas,
  Agenda, Insight, Fato Gerador, Planejamento — depende de camadas do banco que ainda têm 0
  tabelas provisionadas (Operação, Planejamento, Incidência — ver roadmap §1.2/§5/§6).
- Decisão: construir o shell de navegação inteiro agora, com dado real onde a tabela já existe
  (contagem de contratos ativos, contagem de assessores ativos, lista de contratos, gestão de
  assessores) e aviso explícito "em desenvolvimento" em tudo que dependeria de tabela ausente —
  nunca mockar número fictício nem inventar estrutura por antecipação (mesmo espírito do AD-017).

### Agent's Discretion

- Nomenclatura exata de rotas (`/produtos/[slug]/...`, `/contratos/[id]` como ficha nova) — Pedro
  ainda não confirmou, mas a lógica de evitar colisão com `/coalizoes` (lista de entidades) e
  reaproveitar `/contratos/[id]/vinculos` como base da aba Assessores foi deixada a critério do
  agente, sujeita a revisão no fechamento do spec.
- Layout visual dos 4 botões do hub e das abas (grid vs. tabs shadcn, cores por produto) — não
  discutido a fundo; será resolvido na fase Design usando os padrões já em uso (`Card`, `Tabs` do
  shadcn) e a identidade visual da AD-027.

### Declined / Undiscussed Gray Areas → Assumptions (todas confirmadas — ver rodada abaixo)

Estes pontos não foram levados como pergunta formal ao Pedro na rodada inicial (só as 4 decisões
de arquitetura acima foram); ficaram como default proposto, registrado na tabela de Assumptions do
`spec.md`, e foram confirmados na rodada final abaixo:

- Visibilidade condicional dos 4 botões do hub por papel/vínculo (proposto: sempre visíveis, RLS
  decide o que aparece dentro).
- Escopo do filtro mentor/gestora (proposto: vale pros 3 produtos, não só Estratégia).
- Critério exato da aba Contratos (`status = 'ativo'` apenas).
- Onde `/mandatos`, `/coalizoes` ficam alcançáveis depois de saírem da navegação de topo (proposto:
  só por link a partir da ficha do contrato).

### Rodada de confirmação final (2026-08-11)

Antes de avançar para Design, os 7 itens que constavam "n" na tabela de Assumptions do `spec.md`
foram apresentados a Pedro e confirmados, todos com o default já proposto — nenhum default foi
alterado:

1. **Visibilidade dos 4 botões do hub** — sempre visíveis; RLS decide o que aparece dentro do
   produto (consistente com AD-002).
2. **Escopo do filtro mentor/gestora** — vale para os 3 produtos (Estratégia, PLL, Coalizão), não
   só Estratégia (`rel_usuario_contrato` é genérico entre produtos, AD-012).
3. **Critério da aba Contratos** — só `status = 'ativo'`; concluído/não-concluído fica fora desta
   fatia.
4. **Onde `/mandatos`/`/coalizoes` ficam alcançáveis** — só via link "editar dados cadastrais" a
   partir da ficha do contrato; nenhum atalho extra no cabeçalho.
5. **Lugar do menu "Usuários"** — menu no cabeçalho, visível a Admin/Gestora, fora dos 4 botões de
   produto.
6. **Nomenclatura de rotas do hub/produto** — `/` = hub; `/produtos/[slug]/dashboard|agenda|
   contratos|novo-contrato`; `/visao-gerencial`. Sem objeção.
7. **Rota da ficha do contrato** — `/contratos/[id]` vira a ficha operacional nova;
   `/contratos/[id]/vinculos` continua como a implementação por trás da aba Assessores. Sem
   objeção.

Com isso, a feature está liberada para a fase Design.

---

## Specific References

- "Ficha do mandato" (termo do Pedro) — pediu explicitamente que seja "replicada para coalizões
  também": um único componente/rota de ficha operacional, não duas implementações paralelas.
- Visão Gerencial como "indicadores em desenvolvimento" foi a referência inicial que expôs, por
  extensão, que o mesmo tratamento vale pra Kanban/Agenda/Insight/Fato Gerador/Planejamento nesta
  fatia.

---

## Deferred Ideas

- Kanban de etapas funcional, indicadores reais de planejamento, Agenda com dado real, Insight e
  Fato Gerador funcionais, gestão de formulários funcional, planejamento estratégico funcional —
  todos pertencem às ondas de Operação/Planejamento/Incidência do roadmap (§5/§6), não a esta
  feature. Ver tabela "Out of Scope" do `spec.md`.
- Filtro por produto/projeto no Dashboard (além de mentor/gestora) — mencionado de passagem no
  roadmap (§5.2, Kanban) mas não pedido por Pedro nesta conversa; não incluído.
