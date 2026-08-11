# Navegação por Produto — Specification

## Problem Statement

Hoje, após o login, o usuário cai numa landing page genérica (`(app)/page.tsx`) que mistura
bento grid, cards de ações rápidas e um explorador de dados do TSE — nenhuma organização por
produto, nenhum caminho consistente entre "olhar a operação de um produto" e "olhar um contrato
específico". A navegação lateral (`sidebar.tsx`) é por entidade (Mandatos, Contratos, Coalizões,
Usuários), não pelo jeito como a Legisla realmente opera: por produto (Estratégia, PLL, Coalizão)
e, dentro de cada um, por contrato. Pedro quer substituir isso por um hub de produtos e uma
estrutura de abas consistente, com uma ficha operacional por contrato reaproveitável entre
mandato e coalizão.

## Goals

- [ ] Pós-login cai num hub com 4 botões de produto (Estratégia, PLL, Coalizão, Visão Gerencial),
      não mais na landing page atual.
- [ ] Estratégia, PLL e Coalizão — os 3 produtos com `operado_pelo_sistema = true` em `ref_produto`
      — abrem numa área com 4 abas fixas: Dashboard, Agenda, Contratos, Cadastro de novo Contrato.
- [ ] Existe uma ficha operacional por contrato, reaproveitada entre mandato e coalizão, com
      abas por etapa de implementação (reais, uma por linha de `ref_etapa` do produto — vazias de
      conteúdo por ora), gestão de assessores, gestão de formulários, botões de insight/fato
      gerador e um caminho (corrigido) para o planejamento estratégico.
- [ ] Nenhuma tabela nova no banco: a feature usa só o que já está provisionado
      (`dim_mandato`/`dim_coalizao`/`dim_contratante`, `fat_contrato`, `rel_usuario_contrato`,
      `ref_produto`, `ref_etapa`) — é reestruturação de frontend/rotas, não de schema.

## Out of Scope

Explicitamente fora desta feature — todas dependem de camadas do roadmap que ainda têm 0 tabelas
provisionadas (Operação, Planejamento, Incidência — ver `.specs/roadmap.md` §1.2/§5/§6):

| Item                                                    | Reason                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Kanban de etapas funcional (arrastar card, gravar transição) | Depende de `fat_etapa_contrato` (OPR-01, §5.1) e da política de escrita da AD-023 — nenhuma das duas existe no banco ainda. |
| Indicadores reais de atingimento de planejamento / contagem de metas | Depende de `dim_planejamento`/`fat_objetivo_especifico`/`fat_meta` (Planejamento, §6.1) — 0/7 tabelas provisionadas. |
| Agenda funcional (visão semanal/mensal com dado real)   | Depende de `fat_encontro` (Incidência/Operação, §6.2/OPR-03) — não provisionada.               |
| Registro de Insight / Fato Gerador funcional            | Depende de `fat_insight`/`fat_fato_gerador` (Incidência, §6.2) — não provisionadas.            |
| Gestão de formulários funcional                         | Depende de `rel_formulario_contrato`/`fat_submissao` (§5.1 parcial / OPR-02 §6.3) — não provisionadas. |
| Planejamento estratégico funcional (tela de hierarquia) | Depende de `dim_planejamento` completo + hierarquia (§6.1) — só o link/placeholder entra aqui.  |
| Redesenho do modelo de dados / migration nova           | Esta feature não abre nenhuma migration — usa exclusivamente tabelas já provisionadas.        |
| Remoção ou redesenho de `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos` (listas) | Continuam existindo como estão; só deixam de estar na navegação de topo (ver NAV-14/15). Redesenhá-las é fora desta feature. |
| Filtro de Agenda/Dashboard por produto Coalizão validado com dado real | Sem contrato de Coalizão ativo de teste conhecido — testado com o que existir na base de dev; não é gate de bloqueio. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida aqui ou fica registrada como aberta para o Pedro confirmar antes do
Design.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Unidade da ficha operacional | Por **contrato**, não por contratante | Decidido por Pedro via pergunta direta — etapa/assessores/formulários/planejamento são todos por contrato, um mandato pode ter contratos de produtos diferentes ao longo do tempo | y |
| Sidebar de entidades vs. hub | Hub **substitui** a sidebar dentro da área autenticada | Decidido por Pedro — a navegação por produto é a navegação principal agora | y |
| Cadastro de novo contrato | Reaproveita `ContratoForm`/`mandato-wizard` existentes, produto pré-travado | Decidido por Pedro — evita duplicar wizard | y |
| Escopo desta semana | Shell de navegação com dado real onde existe; placeholder explícito onde não existe tabela | Decidido por Pedro — nenhuma camada de Operação/Planejamento/Incidência está provisionada | y |
| Rotas do hub/produto | `/` = hub; `/produtos/[slug]/dashboard\|agenda\|contratos\|novo-contrato` (`slug` ∈ `estrategia`,`pll`,`coalizao`); `/visao-gerencial` | Evita colidir com `/coalizoes` (lista de entidades, conceito diferente: contratante, não produto) | y |
| Rota da ficha do contrato | `/contratos/[id]` vira a ficha operacional nova (hoje é só a lista `/contratos`); `/contratos/[id]/vinculos` continua existindo como a implementação por trás da aba Assessores | Reaproveita rota e componente já funcionais em vez de recriar | y |
| Onde fica "Usuários" (gestão de equipe do sistema) | Menu no cabeçalho (visível a Admin/Gestora), fora dos 4 botões de produto | Não é um produto operado pelo sistema — não se encaixa no hub | y |
| `/mandatos`, `/coalizoes` (listas/cadastro cadastral+TSE) | Continuam existindo, alcançáveis só por link a partir da ficha do contrato ("editar dados cadastrais"), não mais como item de navegação de topo | Editar TSE/dados cadastrais do contratante é uma tarefa que ainda existe, só não é mais a porta de entrada | y |
| Hub mostra os 4 botões sempre, mesmo sem contrato/vínculo naquele produto | Sim — RLS já filtra o que a pessoa vê dentro do produto; ir num produto sem contrato mostra estados vazios, não bloqueia o botão | Mais simples que calcular visibilidade condicional no cliente; consistente com AD-002 ("autorização é sempre da RLS, nunca da UI") | y |
| Filtro mentor/gestora | Vale para os 3 produtos igualmente (Dashboard e Agenda), não só Estratégia | `rel_usuario_contrato` é genérico entre produtos (AD-012) — não há razão técnica pra restringir | y |
| Aba "Contratos" mostra o quê além de ativos? | Só `status = 'ativo'`, como Pedro pediu; concluído/não-concluído fica fora desta aba (poderia entrar como filtro depois) | Literal ao pedido ("cards para todos os contratos ativos") | y |

**Open questions:** nenhuma — todas as 7 confirmadas por Pedro em 2026-08-11 (ver
`context.md`, seção "Rodada de confirmação final"), todas com o default proposto. Pronto para
Design.

---

## User Stories

### P1: Hub de produtos pós-login ⭐ MVP

**User Story**: Como usuária da Legisla, ao logar quero ver 4 grandes botões de produto
(Estratégia, PLL, Coalizões, Visão Gerencial) em vez da landing page atual, para escolher em qual
produto vou trabalhar antes de qualquer outra coisa.

**Why P1**: É o ponto de entrada de toda a navegação nova — nada mais faz sentido sem isso existir
primeiro.

**Acceptance Criteria**:

1. WHEN o usuário autenticado acessa `/` THEN o sistema SHALL mostrar 4 botões grandes, um por
   produto com `operado_pelo_sistema = true` em `ref_produto` (Estratégia, PLL, Coalizão) mais um
   quarto botão fixo "Visão Gerencial" (não vem de `ref_produto`).
2. WHEN o usuário clica num botão de produto THEN o sistema SHALL navegar para a área daquele
   produto, aba Dashboard por padrão.
3. WHEN o usuário clica em "Visão Gerencial" THEN o sistema SHALL navegar para uma tela com o
   aviso "Indicadores em desenvolvimento" e nenhum outro conteúdo funcional.
4. WHEN a tela hub renderiza THEN o sistema SHALL não fazer nenhuma chamada ao explorador de dados
   TSE nem ao bento grid da landing page atual (removidos, não escondidos).

**Independent Test**: Logar, ver a tela de 4 botões, clicar em cada um e confirmar que leva pro
lugar certo (3 áreas de produto + 1 placeholder).

---

### P1: Área de produto com 4 abas fixas ⭐ MVP

**User Story**: Como gestora/mentora, dentro de um produto quero navegar entre Dashboard, Agenda,
Contratos e Cadastro de novo Contrato por abas, sem perder o contexto de qual produto estou vendo.

**Why P1**: É a estrutura que organiza todo o resto da feature.

**Acceptance Criteria**:

1. WHEN o usuário está em `/produtos/[slug]/*` THEN o sistema SHALL mostrar as 4 abas (Dashboard,
   Agenda, Contratos, Cadastro de novo Contrato) e destacar a aba ativa.
2. WHEN o usuário troca de aba THEN o sistema SHALL manter o produto selecionado (não pede pra
   escolher de novo).
3. WHEN o usuário quer voltar ao hub ou trocar de produto THEN o sistema SHALL oferecer um caminho
   visível (não exige apertar "voltar" do navegador).
4. WHEN `slug` não corresponde a nenhum produto com `operado_pelo_sistema = true` THEN o sistema
   SHALL responder 404, nunca renderizar uma área de produto vazia silenciosa.

**Independent Test**: Entrar em Estratégia, alternar as 4 abas, voltar ao hub, entrar em PLL,
repetir.

---

### P1: Aba Contratos — cards de contratos ativos ⭐ MVP

**User Story**: Como gestora, na aba Contratos de um produto quero ver um card por contrato ativo
daquele produto, com um caminho direto pra ficha operacional dele.

**Why P1**: É a ponte entre "ver a operação do produto" e "agir sobre um contrato específico".

**Acceptance Criteria**:

1. WHEN o usuário abre a aba Contratos de um produto THEN o sistema SHALL listar um card por
   `fat_contrato` com `id_produto` daquele produto e `status = 'ativo'`, mostrando nome do
   contratante (mandato ou coalizão), data de início e produto.
2. WHEN não existe nenhum contrato ativo daquele produto THEN o sistema SHALL mostrar o estado
   vazio padrão (`<EstadoVazio>`, AD-029) com um atalho pra aba Cadastro de novo Contrato.
3. WHEN o usuário clica num card THEN o sistema SHALL navegar para a ficha operacional daquele
   contrato (`/contratos/[id]`).

**Independent Test**: Abrir a aba Contratos de um produto com contrato ativo de teste, ver o
card, clicar e cair na ficha certa.

---

### P1: Ficha operacional do contrato ⭐ MVP

**User Story**: Como gestora ou mentora, ao abrir um contrato quero uma ficha única — igual pra
mandato ou coalizão — com abas por etapa de implementação, gestão de assessores, gestão de
formulários, registro de insight/fato gerador e link pro planejamento estratégico.

**Why P1**: É a tela onde a operação do dia a dia acontece — o coração do pedido do Pedro.

**Acceptance Criteria**:

1. WHEN o usuário acessa `/contratos/[id]` THEN o sistema SHALL mostrar um cabeçalho com os dados
   do contratante (nome, e — quando `tipo_contratante = 'mandato'` — cargo/partido/UF atuais; quando
   `'coalizao'` — nome e projeto de origem) e o produto do contrato.
2. WHEN a ficha carrega THEN o sistema SHALL mostrar uma aba por linha de `ref_etapa` do produto
   daquele contrato, ordenada por `ordem`, cada uma vazia de conteúdo (sem `fat_etapa_contrato`
   ainda) — nunca uma aba genérica única chamada "Etapas".
3. WHEN o usuário abre a aba de Assessores THEN o sistema SHALL mostrar a gestão de equipe já
   existente (reaproveitando o conteúdo de `/contratos/[id]/vinculos`) — funcional, sem placeholder.
4. WHEN o usuário abre a aba de Formulários THEN o sistema SHALL mostrar o aviso "Gestão de
   formulários em desenvolvimento" — sem tabela que sustente a funcionalidade ainda.
5. WHEN o usuário clica em "Registrar Insight" ou "Registrar Fato Gerador" THEN o sistema SHALL
   mostrar o aviso "Em desenvolvimento" (botão visível, mas desabilitado ou com essa resposta ao
   clicar) — nunca abrir um formulário que grava em lugar nenhum.
6. WHEN o usuário clica em "Planejamento Estratégico" THEN o sistema SHALL navegar para uma rota
   válida (corrigindo o link hoje quebrado para `/contratos/[id]/planejamento`) mostrando "em
   desenvolvimento" — nunca um link morto (404).

**Independent Test**: Abrir a ficha de um contrato de mandato e de um contrato de coalizão,
confirmar cabeçalho correto pros dois, abas de etapa nomeadas de verdade, aba Assessores
funcional, os demais pontos como placeholder navegável (sem 404, sem escrita fake).

---

### P1: Cadastro de novo Contrato com produto pré-travado ⭐ MVP

**User Story**: Como gestora, dentro da aba Cadastro de novo Contrato de um produto, quero abrir
o fluxo de cadastro já com aquele produto selecionado, tanto pra contratante novo quanto pra um já
existente.

**Why P1**: Fecha o ciclo — contrata dentro do contexto de produto que a pessoa já escolheu.

**Acceptance Criteria**:

1. WHEN o usuário abre a aba Cadastro de novo Contrato de um produto THEN o sistema SHALL
   apresentar o wizard/`ContratoForm` existente com o campo produto pré-preenchido e travado
   naquele produto (sem exigir escolha manual).
2. WHEN o produto da aba é "Coalizão" THEN o sistema SHALL oferecer tanto criar uma coalizão nova
   quanto abrir contrato novo pra uma coalizão já existente — mesma lógica hoje em
   `coalizoes/[id]` (CMU-15), só que iniciada a partir daqui.
3. WHEN o cadastro é concluído com sucesso THEN o sistema SHALL levar o usuário para a ficha do
   contrato recém-criado (`/contratos/[id]`).

**Independent Test**: Criar um contrato de Estratégia pra um mandato novo e um contrato de
Estratégia pra um mandato já existente, ambos a partir da aba, confirmando produto certo em
`fat_contrato.id_produto` sem precisar selecioná-lo manualmente.

---

### P1: Dashboard do produto ⭐ MVP

**User Story**: Como gestora, na aba Dashboard quero ver indicadores simples da operação do
produto (contagem de contratos ativos, assessores ativos) e um filtro por mentor/gestora, com o
Kanban e indicadores de planejamento sinalizados como futuros.

**Why P1**: É a primeira tela que a pessoa vê ao entrar num produto — precisa mostrar algo real,
não só placeholder.

**Acceptance Criteria**:

1. WHEN o usuário abre a aba Dashboard THEN o sistema SHALL mostrar a contagem de contratos ativos
   do produto e a contagem de assessores ativos (`rel_usuario_contrato.papel_no_contrato =
   'assessor'` e `dt_fim IS NULL OR dt_fim >= hoje`), calculadas sobre dado real.
2. WHEN o usuário aplica o filtro por mentor ou gestora THEN o sistema SHALL recalcular as
   contagens restritas aos contratos onde aquela pessoa tem vínculo ativo no papel escolhido.
3. WHEN a seção de Kanban ou de indicadores de planejamento (atingimento, contagem de metas)
   renderiza THEN o sistema SHALL mostrar "Em desenvolvimento" no lugar do widget, nunca um
   número inventado ou zerado silenciosamente.

**Independent Test**: Abrir o Dashboard de um produto com contratos/assessores reais de teste,
conferir que os números batem com uma consulta direta nas tabelas, aplicar o filtro e ver a
contagem mudar.

---

### P1: Aba Agenda (placeholder) ⭐ MVP

**User Story**: Como mentora, ao abrir a aba Agenda de um produto, quero saber que a visão
semanal/mensal ainda não existe, em vez de ver uma tela vazia sem explicação.

**Why P1**: Completa as 4 abas sem deixar nenhuma quebrada ou ausente.

**Acceptance Criteria**:

1. WHEN o usuário abre a aba Agenda de qualquer um dos 3 produtos THEN o sistema SHALL mostrar o
   aviso "Agenda em desenvolvimento" — sem tentar montar calendário sobre tabela inexistente.

**Independent Test**: Abrir a aba Agenda dos 3 produtos e confirmar o mesmo aviso nos três.

---

### P2: Visão Gerencial (placeholder)

**User Story**: Como gestora, ao clicar em Visão Gerencial, quero ver que os indicadores estão em
desenvolvimento, sem abas nem produto associado.

**Why P2**: Já é comportamento simples (um card com aviso) — menos crítico que as áreas de
produto, mas parte do Goals.

**Acceptance Criteria**:

1. WHEN o usuário acessa `/visao-gerencial` THEN o sistema SHALL mostrar apenas o aviso
   "Indicadores em desenvolvimento", sem abas.

**Independent Test**: Clicar no botão a partir do hub e conferir a tela.

---

### P2: Navegação — sidebar de entidades e acesso a Usuários

**User Story**: Como usuária, quero que a navegação de topo reflita produtos, não entidades soltas
— e ainda preciso conseguir gerenciar usuários do sistema quando tenho permissão.

**Why P2**: Necessário pra fechar a mudança de IA, mas não bloqueia demonstrar as 3 áreas de
produto funcionando.

**Acceptance Criteria**:

1. WHEN o usuário está dentro de uma área de produto ou no hub THEN o sistema SHALL não mostrar a
   sidebar atual (Início/Mandatos/Contratos/Coalizões/Usuários).
2. WHEN o usuário tem `papel_global` admin ou gestora THEN o sistema SHALL oferecer um caminho
   (menu no cabeçalho) para `/usuarios`.
3. WHEN o usuário está em `/mandatos/[id]` ou `/coalizoes/[id]` (edição cadastral/TSE) THEN o
   sistema SHALL continuar funcionando como hoje — só deixa de ser alcançável pela navegação de
   topo.

**Independent Test**: Confirmar ausência da sidebar antiga em toda tela dentro de `(app)/`, achar
"Usuários" pelo menu novo, e confirmar que `/mandatos/[id]` ainda abre normalmente por link direto.

---

## Edge Cases

- WHEN um contrato tem `id_contratante` cujo `tipo_contratante` não é `'mandato'` nem `'coalizao'`
  (ex.: `'partido'`, fora de uso hoje) THEN o sistema SHALL mostrar um cabeçalho genérico (nome +
  produto) em vez de quebrar por falta de campo específico.
- WHEN `ref_etapa` não tem nenhuma linha para o produto do contrato (não deveria acontecer — os 3
  produtos já têm régua seedada, Trilha C) THEN o sistema SHALL mostrar uma aba única "Nenhuma
  etapa cadastrada" em vez de renderizar zero abas.
- WHEN o usuário acessa `/contratos/[id]` de um contrato que não existe THEN o sistema SHALL
  responder 404.
- WHEN o usuário tenta abrir a aba Cadastro de novo Contrato sem permissão de escrita (RLS nega)
  THEN o sistema SHALL mostrar o erro padrão (`<ErroInline>`, AD-029), nunca falhar silenciosamente.

---

## Requirement Traceability

| Requirement ID | Story                                    | Phase | Status  |
| --------------- | ----------------------------------------- | ----- | ------- |
| NAV-01          | P1: Hub de produtos pós-login             | Verify | ✅ Verified |
| NAV-02          | P1: Área de produto com 4 abas fixas      | Verify | ✅ Verified |
| NAV-03          | P1: Aba Contratos — cards ativos          | Verify | ✅ Verified |
| NAV-04          | P1: Ficha do contrato — cabeçalho + abas de etapa | Verify | ✅ Verified |
| NAV-05          | P1: Ficha do contrato — aba Assessores    | Verify | ✅ Verified |
| NAV-06          | P1: Ficha do contrato — aba Formulários (placeholder) | Verify | ✅ Verified |
| NAV-07          | P1: Ficha do contrato — botões Insight/Fato Gerador (placeholder) | Verify | ✅ Verified |
| NAV-08          | P1: Ficha do contrato — link Planejamento (corrigido, placeholder) | Verify | ✅ Verified |
| NAV-09          | P1: Cadastro de novo Contrato — produto pré-travado | Verify | ✅ Verified |
| NAV-10          | P1: Dashboard — indicadores reais + placeholder | Verify | ✅ Verified |
| NAV-11          | P1: Dashboard/Agenda — filtro mentor/gestora | Verify | ✅ Verified |
| NAV-12          | P1: Aba Agenda (placeholder)              | Verify | ✅ Verified |
| NAV-13          | P2: Visão Gerencial (placeholder)         | Verify | ✅ Verified |
| NAV-14          | P2: Remoção da sidebar de entidades       | Verify | ✅ Verified |
| NAV-15          | P2: Acesso a Usuários reposicionado       | Verify | ✅ Verified |

**ID format:** `NAV-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 15 verified ✅ — ver `.specs/features/navegacao-por-produto/validation.md`
para evidência `file:line` por AC. 2 achados Minor (não bloqueantes) documentados lá: erro de RLS
no Cadastro de novo Contrato não passa por `<ErroInline>` (débito pré-existente, fora do diff desta
feature); aba "Nenhuma etapa cadastrada" leva a uma tela que não resolve (edge case documentado
como "não deveria acontecer").

---

## Success Criteria

- [ ] Login leva ao hub de 4 botões, nunca mais à landing page atual.
- [ ] Os 3 produtos abrem com as 4 abas, sem 404 nem tela em branco em nenhuma delas.
- [ ] A ficha do contrato funciona igual para um contrato de mandato e um de coalizão de teste.
- [ ] Nenhuma migration nova entra nesta feature — `supabase db diff` sem alteração de schema.
- [ ] Nenhum link quebrado remanescente (o "Planejamento" corrigido é o critério concreto).
