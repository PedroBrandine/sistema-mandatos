# Saída — Números de Impacto, Visão do Mandato e Evolução do GIP Context

**Gathered:** 2026-08-30
**Spec:** `.specs/features/saida-numeros-impacto/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Provisionar `mv_numeros_impacto` e `vw_visao_mandato` (verbatim, AD-008 — nunca migradas antes
desta feature) e conectar uma tela nova de Números de Impacto + Visão do Mandato a elas; substituir
o placeholder de GIP em `ContextoEstrategico` pela leitura real de `vw_gip_evolucao` (já
provisionada por `formularios-produto`, T9 — achado desta sessão que corrige o brief original, que
afirmava incorretamente que ela nunca tinha sido migrada). Constituição §2.6/§2.3. AD-015 (Saída só
lê e agrega) e AD-008 (extração verbatim, sem redesenho) são inegociáveis nesta feature.

---

## Implementation Decisions

### Exceção de acesso GRANT-only para `mv_numeros_impacto`

- Registrar como **nova entrada AD-036** em `.specs/STATE.md`, escrita na fase Design antes de
  qualquer migration — não estender AD-030 por analogia.
- Razão explícita a documentar na AD-036: AD-030 cobre catálogos `ref_*` que **não têm** coluna de
  carteira/contrato para RLS filtrar por linha. `mv_numeros_impacto` é o oposto — ela **tem**
  `id_contrato`/`id_contratante`, mas a leitura é deliberadamente organização-inteira (números de
  impacto para áreas clientes), não escopada à carteira pessoal de quem lê. GRANT-only aqui é
  escolha de produto (mesma leitura para todo Interno Legisla), não ausência de coluna.
- `vw_visao_mandato` **não** precisa da mesma exceção — é `security_invoker = true`, herda a RLS de
  `fat_contrato`/`dim_contratante` por baixo. Confirmado por leitura de código nesta sessão, sem
  necessidade de levar ao Pedro (mecânica técnica, não decisão de produto).

### Refresh de `mv_numeros_impacto`

- Síncrono ao abrir a tela: uma função Postgres roda `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  (com fallback não-concorrente na 1ª vez, já que a MV nasce `WITH NO DATA`) e a query do frontend
  chama essa função antes de ler a MV — mesmo padrão de `app.atualiza_iip_contrato`
  (`incidencia-encontros`) e do refresh de `mv_avaliacao_nps` (`formularios-produto`).
- `pg_cron` continua fora do projeto — não introduzir essa dependência nesta feature.

### Rota e navegação

- Novo tile no Hub (`src/frontend/app/(app)/page.tsx`), ao lado do tile "Visão Gerencial" já
  existente (mesmo padrão visual: `Card` com ícone, `BarChart3` ou similar a decidir em Design).
- Rota própria: **`/numeros-impacto`** (kebab-case, sem acento, fora do padrão `/produtos/[slug]`
  — Números de Impacto atravessa produtos).
- Visão do Mandato é uma sub-rota ou modal a partir daí (decisão de UI fina — layout exato — fica
  para Design, sem gray area de produto pendente: o comportamento "clicar num contratante abre a
  timeline consolidada" já está fechado no spec.md, P2).

### Acesso — papel autorizado

- Login como Gestora (ou Admin) já resolve o acesso de "áreas clientes" — nenhum papel de RBAC
  novo. Constituição §3 (linha 190) já agrupa "Interno Legisla (Gestora, Admin, áreas clientes)"
  sob o mesmo método de autenticação (SSO Google Workspace, hoje substituído por senha via
  AD-026). AD-018 já mapeia esse conjunto para o papel Gestora.
- Mentor e Assessor **não** têm acesso a `/numeros-impacto` nem à Visão do Mandato — nenhum dos
  dois é "área cliente" nem "Interno Legisla" (Constituição §3).

### Evolução do GIP

- Substitui o placeholder existente em `ContextoEstrategico`
  (`src/frontend/components/planejamento/contexto-estrategico.tsx:89-99`) — não é uma seção nova
  nem uma tela separada. `design.md` de `planejamento-estrategico-redesenho` já reserva esse
  espaço ("Seção GIP - placeholder", nó K do diagrama de componentes) — Design desta feature deve
  ler aquele `design.md` antes de propor a prop nova que `ContextoEstrategico` vai precisar
  (provavelmente `evolucaoGip` ou equivalente, buscado no `page.tsx` pai por `id_contrato`).
- Sem GIP nenhum aplicado (`fat_gip` vazio para o contrato) → `<EstadoVazio>` (AD-029), nunca a
  tabela vazia nem o texto placeholder atual.

### Agent's Discretion

- Layout exato da tela `/numeros-impacto` (tabela vs. cards, paginação, filtros) e da Visão do
  Mandato (linha do tempo horizontal vs. lista vertical) — Design decide, dentro do que o spec.md
  já fixa em termos de conteúdo mínimo por linha/card (P1.AC1, P2.AC2).
- Mecanismo exato de lock/idempotência do refresh síncrono sob concorrência (2 abas abrindo ao
  mesmo tempo) — Edge Case do spec.md, resolvido em Design.
- Nome exato da função de refresh e da rota de sub-navegação da Visão do Mandato (`/numeros-
  impacto/[idContratante]` vs. modal) — Design decide, sem gray area de produto pendente.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma — os 4 gray areas identificados na fase Specify (exceção GRANT, refresh, rota, papel de
acesso) foram todos discutidos e decididos nesta sessão (ver acima). Os demais itens da tabela de
Assumptions do `spec.md` (filtro de status, `vw_visao_mandato` sem exceção GRANT, placeholder de
GIP, `EstadoVazio`) foram resolvidos por leitura de código/schema, sem ambiguidade de produto a
discutir com o usuário.

---

## Specific References

Nenhuma referência externa/produto específico mencionada durante a discussão — as 4 decisões
seguiram os padrões já estabelecidos em features anteriores do próprio projeto (AD-030 como
precedente de estrutura, ainda que não de conteúdo; padrão de refresh síncrono de
`incidencia-encontros`/`formularios-produto`; padrão de tile do Hub já usado por "Visão Gerencial").

---

## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo do `spec.md` (Números de Impacto, Visão do Mandato,
Evolução do GIP). Nenhuma ideia de escopo maior (ex.: exportação, snapshot mensal) foi levantada
como candidata a esta feature.
