# Roadmap de Execução — Sistema Mandatos

Plano de trabalho sequenciado do que falta construir. Companheiro do `STATE.md` (decisões) e do
`overview.md` (arquitetura). **Este documento é vivo**: cada feature concluída atualiza o bloco
"Estado real" e risca a linha correspondente.

- **Reescrito em:** 2026-08-10, a partir de auditoria de código (não copiado da versão anterior)
- **Atualizado em:** 2026-08-10, fim do dia — Trilhas A, C e D (§4) fecharam Execute+Validate no
  mesmo dia. Ver §1 para o estado real pós-atualização; §4 mantém o texto original de cada trilha
  riscado, para histórico.
- **Atualizado em:** 2026-08-11 — nova Trilha F (§4), pedido direto de Pedro: substituir a landing
  page pós-login por um hub de produtos (Estratégia/PLL/Coalizão/Visão Gerencial) + ficha
  operacional por contrato. Em fase Specify (`.specs/features/navegacao-por-produto/spec.md`),
  priorizada para rodar agora, à frente da Trilha B na fila de atenção do Pedro.
- **Atualizado em:** 2026-08-11 — Pedro confirmou que quer a **Planilha de Monitoramento** (§6.1,
  PLN-01/02/03 — a grade de Sucessos Mensais) entregue junto da onda de amanhã, com exigência
  explícita de levantar **todos os campos e as diferenças reais entre Estratégia/PLL/Coalizão**
  antes de Design (AD-012 já resolve a base — tabela única discriminada por produto — mas isso não
  dispensa o levantamento fino por produto). Como §6.1 depende só de §5.1 (régua) existir, não de
  Kanban, entra como **fork paralelo** logo depois de 5.1: uma sessão segue 5.2→5.3 (Kanban/G1/G2),
  outra abre 6.1 (Planejamento/Planilha de Monitoramento) — não é mais só "segunda leva", vira parte
  da mesma onda de amanhã.
- **Sem cronograma.** Este plano é ordenado por dependência de camada e por oportunidade de
  paralelização, não por dia/semana — capacidade e ritmo variam, dependência estrutural não.
- **Fonte de prioridade:** Definição de Pronto (Constituição §6) + ordem de dependência das camadas
  (§2, AD-007)

---

## 1. Estado real (verificado em 2026-08-10)

### 1.1 Infraestrutura — não existia como preocupação na versão anterior deste documento

O ciclo completo rodou verde ponta a ponta pela primeira vez em 10/08: `ci.yml` (91 testes
unitários + integração contra banco efêmero), `deploy-db.yml` (aplica em produção só com CI verde
no commit) e `drift-check.yml` (sem deriva em dev nem produção). Dois ambientes Supabase distintos,
30/30 migrations idênticas nos dois. Detalhes operacionais completos em `docs/ambientes.md` e
`docs/fluxo-de-trabalho.md` — não duplicar aqui.

**O que isso muda para o roadmap:** o gargalo deixou de ser "o deploy quebra" e voltou a ser
"quais camadas de produto faltam construir". Também expôs uma prática a manter: toda migration
nova precisa continuar passando pelo `drift-check` antes de ser considerada terminada.

### 1.2 Banco — 29 das 51 tabelas do modelo aprovado (+12 hoje via Trilha C)

| Bloco | Provisionado | Falta |
| :---- | :---- | :---- |
| Catálogos `ref_*` | **16/16 — completo** (4 antigos + as 12 da Trilha C: `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip`) | — |
| Plataforma | 3/3 — `dim_usuario`, `rel_usuario_contrato`, `log_auditoria` | — |
| Fundação + Âncora | 5/5 — `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro` | — |
| TSE | 4 tabelas + `rel_mandato_candidatura` + 2 MVs, restrito ao Legislativo (AD-031) | — |
| Operação | 0 | 8 tabelas — **próximo gargalo estrutural, ver §5.1 (OPR-01)** |
| Planejamento | 0 | 7 tabelas |
| Incidência | **7/7 + 1 MV + 1 view — completo (2026-08-14, feature `incidencia-encontros`)** | — |
| Saída | 0 | 1 tabela + ~10 views/MVs |
| Staging | 0 | `stg.map_legado` |

**Leitura:** os catálogos deixaram de ser o gargalo. `ref_agenda_tematica`, `ref_indicador` e
`ref_tipologia` existem mas nascem **vazias de propósito** (CAT-16, levantamento humano com
Monitoramento — sem data). O novo primeiro gargalo estrutural é a camada de **Operação**: nenhuma
tabela de Planejamento ou Incidência pode existir sem `fat_etapa_contrato`/`dim_planejamento`
(§5.1) já provisionadas.

### 1.3 Frontend

**Atualizado pela Trilha F (2026-08-11):** `/` deixou de ser a landing page e virou o hub de 4
produtos; `sidebar.tsx` foi deletado, substituído por `Topbar` (marca + volta ao hub + "Usuários"
condicionado a `papel_global`). Navegação de topo agora é por produto
(`/produtos/[slug]/{dashboard,agenda,contratos,novo-contrato}`), não por entidade.

**Rotas em pé:** `/login` · `/` (hub) · `/produtos/[slug]/{dashboard,agenda,contratos,novo-contrato}`
(`slug` ∈ `estrategia`,`pll`,`coalizao`) · `/visao-gerencial` ·
`/contratos/[id]` (ficha operacional, redireciona pra 1ª etapa) ·
`/contratos/[id]/{etapas/[codigo],vinculos,formularios,planejamento}` ·
`/mandatos` (lista, novo, detalhe) · `/mandatos/[id]/contratos/novo` ·
`/coalizoes` (lista, novo, detalhe) · `/usuarios` · `/contratos` (lista)
(+ `/admin/acesso` dev-only e `/auth/*`). `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos`
(lista) continuam existindo, só deixaram de estar na navegação de topo (NAV-14/15) — alcançáveis
por link direto. Nenhum item de Operação/Planejamento/Incidência/Saída tem dado real ainda —
Agenda, Kanban, indicadores de planejamento, Insight/Fato Gerador, Formulários e Planejamento
Estratégico entram como placeholder "em desenvolvimento" explícito dentro da ficha/produto.

**Primitivos shadcn instalados:** alert, badge, breadcrumbs, button, card, command, confirm-delete-dialog,
dialog, form, input, input-group, label, popover, select, skeleton, table, textarea. Combobox (`command`+`popover`)
já está em uso real no wizard do TSE.

**Lacunas resolvidas hoje (Trilha D):** `@tanstack/react-query`+`@tanstack/react-table` instalados,
provider montado no `app/layout.tsx` raiz (AD-029); `<Toaster/>` do `sonner` finalmente montado —
os 5 toasts silenciosos (`mandatos`, `coalizoes`, `usuarios`, `contratos`, `mandatos/[id]`) agora
aparecem de fato; `<CarregandoSkeleton>`/`<ErroInline>`/`<EstadoVazio>` existem em `components/ui/`.

**Lacunas que ainda faltam:**

| Lacuna | Bloqueia | Custo de resolver agora |
| :---- | :---- | :---- |
| tabs, tooltip, dropdown-menu, alert-dialog, checkbox, date-picker, progress | Kanban, formulários, planejamento | baixo, mecânico — instalar sob demanda de cada feature |
| Nenhuma tela ainda **usa** `useQuery`/`useReactTable` de verdade (provider existe, sem consumidor) | — | esperado — primeiro consumidor real é a régua de etapas (§5.1) ou o Kanban (§5.2) |

### 1.4 Features spec-driven — status real

| Feature | Fase no `spec.md` | Situação real verificada em código |
| :---- | :---- | :---- |
| `fundacao-entidades-pessoas` | Validate | ✅ Concluída — 20/26 Verified, 5 Needs-Fix conhecidos (ver §1.5) |
| `primeira-tela-cadastro` | Validate | ✅ Concluída e verificada |
| `login-senha-interno-legisla` | Validate | ✅ Concluída (7/7) |
| `cadastro-mandato-contrato-unificado` | ✅ **Validate — PASS** | 16/16 requisitos (CMU-01 a CMU-16), Verifier independente, sensor 3/3 killed. `spec.md`/`validation.md` completos |
| `catalogos-referencia` | ✅ **Validate — PASS** | 17/17 requisitos de código (CAT-16 permanece `Pending` de propósito — levantamento humano). Verifier rodou 2 rodadas (FAIL 8 gaps → fix → PASS, sensor 3/3) |
| `plataforma-ui-tanstack` | ✅ **Validate — PASS (com 1 item de UAT manual)** | 11/12 ACs verificados por código; PUI-06 (toast visível) aguarda confirmação visual humana — não é gap de código |
| `navegacao-por-produto` | ✅ **Validate — PASS** (15/15) + NAV-16 pós-Validate | 15/15 requisitos (NAV-01 a NAV-15), Verifier independente, sensor 3/3 killed, 111 testes unitários (+18); 2 achados Minor corrigidos na mesma sessão. **NAV-16** (aba "Informações Gerais"/TSE na ficha de mandato) adicionado depois, a pedido de Pedro — gate verde, sem novo ciclo de Verifier |
| `convite-contrato` | ✅ **Validate — PASS** (rodada 2) | 11/11 requisitos (CVT-01 a CVT-11). Verifier independente rodou 2 rodadas — rodada 1 `FAIL` (1 Blocker: proxy de sessão bloqueava `/convite` inteiro; 3 Major; 3 Minor) → fix→re-verify → rodada 2 `PASS`. AD-033 registrada (5ª exceção da AD-010). Ver §4 Trilha B (histórico) e `.specs/features/convite-contrato/validation.md` |

**Trilha A deixou de ser a descoberta mais importante desta auditoria** — fechou o ciclo completo
Specify→Design→Tasks→Execute→Validate no mesmo dia (2026-08-10), junto de duas features novas
(Trilhas C e D). Ver §4 para o histórico de cada uma, riscado.

### 1.5 Débito conhecido

| Item | Situação | Observação |
| :---- | :---- | :---- |
| `FND-USR-02` — Gestora criando Gestora/Admin, sem `WITH CHECK` de RLS | ✅ Corrigido em 2026-08-10 (`20260810181508_fix_with_check_p_usuario.sql`, aplicado em dev) — WITH CHECK explícito impede papel_global 'admin'/'gestora' fora de quem já é Admin | Era mais grave que o registrado: a ausência de WITH CHECK deixava Gestora criar até Admin, não só Gestora. Teste de regressão em `supabase/tests/plataforma/usuario-with-check.integration.test.ts` (4/4 verde) + suíte de RLS/sessão existente sem regressão (13/13 verde) |
| `FND-COL-03` / `CMU-16` — seletor de membro da coalizão lista qualquer `fat_contrato` | ✅ Corrigido em 2026-08-10 — filtra `tipo_contratante = 'mandato'` | Fechado junto de CMU-15 (coalizão abre contrato próprio) |
| `FND-CTR-05` — snapshot de cargo/partido no contrato nunca populado | ✅ Corrigido em 2026-08-13 (`20260813180132_fnd_ctr_05_snapshot_cargo_partido_contrato.sql`, aplicado em dev) — os dois call-sites de insert em `fat_contrato` (`app.criar_mandato` e `ContratoForm`) passam a gravar `id_cargo_no_contrato`/`id_partido_no_contrato` a partir de `dim_mandato.id_cargo_atual`/`id_partido_atual` no momento da contratação | Fica `NULL` pra contrato de coalizão (sem `dim_mandato`), coerente com a coluna. 2 testes de integração novos em `fn-criar-mandato.integration.test.ts` (11/11 verde) — ver `.specs/STATE.md` |
| `FND-TSE-01`/`FND-TSM-01` — filtro de cargo/método de match não exposto na UI de busca | Minoritário, já mitigado em parte pela restrição na origem (migrations 0022/0026, AD-031) | Não bloqueia nada |
| ~~Dropdowns (Cargo/Partido/Produto/Projeto) relatados como quebrados numa sessão anterior~~ | ✅ Confirmado funcionando em 2026-08-13 | Reproduzido de verdade (não só leitura de código): navegador headless logado via bypass `/admin/acesso`, testado em `/mandatos/novo` (Cargo/Partido/Produto/Projeto) e no `ContratoForm` de um mandato existente (Produto/Projeto) — as 4 opções carregam dado real (`ref_cargo`/`ref_partido`/`ref_produto`/`ref_projeto`), zero erro de console. Item riscado da lista, ver `.specs/STATE.md` |
| Convite por contrato (acesso externo) | ✅ Concluída em 2026-08-11 — ver Trilha B e `.specs/features/convite-contrato/validation.md` | Verifier independente PASS (rodada 2), 11/11 CVT |
| `CNV04` — guarda de papel camada 2 (`app.consumir_convite`) sem teste de regressão | 🟡 Aceito como débito | Inalcançável em teste enquanto `ck_convite_papel` existir sem desabilitar a constraint no banco de dev compartilhado — baixo risco (defesa em profundidade sobre um `CHECK` já testado) |
| Edge case "Gestora perde vínculo antes do convite ser consumido" sem teste dedicado | 🟡 Aceito como débito | Correto por construção (consumo roda via `service_role`, nunca relê `id_usuario_convidou`) — confirmado por leitura de código pelo Verifier, não por teste |
| AD-021 (TanStack Query/Table) | ✅ Cumprida em 2026-08-12 — `useQuery` (`useProdutoAtual`, Trilha F) e `useTable` (`GradeSucessosMensais`, §6.1, `planejamento-planilha-monitoramento`) têm consumidor real | Achado ao implementar: o pacote instalado é `@tanstack/react-table@9`, API bem diferente de v8 (`useTable`, sem `getCoreRowModel`, `tableFeatures()`) — ver `.specs/STATE.md`, handoff da feature |
| `<ErroInline>` (AD-029) tinha zero consumidores em todo o repositório | ✅ Corrigido em 2026-08-11 (`b8b9445`) — achado pelo Verifier da Trilha F, corrigido na mesma sessão a pedido de Pedro | `ContratoForm`/`MandatoWizard` agora usam `<ErroInline>` no erro de RLS em vez do `<p>` bruto anterior |
| Aba "Nenhuma etapa cadastrada" da ficha do contrato levava a tela que nunca resolvia se `ref_etapa` vier vazio | ✅ Corrigido em 2026-08-11 (`61568ff`) — achado pelo Verifier da Trilha F, corrigido na mesma sessão a pedido de Pedro | `contratos/[id]/page.tsx` agora mostra a mensagem explicitamente em vez de ficar preso em `<CarregandoSkeleton>` |

---

## 2. Decisões pendentes que o plano depende

| # | Assunto | Situação |
| :---- | :---- | :---- |
| **AD-010** | ✅ Resolvida — **AD-033** (2026-08-11): 5ª exceção, criação de conta via convite por contrato (rota de servidor `service_role`) | Convite por contrato (Trilha B) concluída e validada |
| **AD-022** | ✅ Resolvida — superseded por **AD-028** (2026-08-10): gate de protótipo validado com assessor real foi dispensado | A grade de Sucessos Mensais (§6.1) deixa de depender do convite (Trilha B) pra avançar |
| **D9** | ✅ Resolvida por Pedro em 2026-08-10: régua da Coalizão clona a da Estratégia | CAT-17 (`.specs/features/catalogos-referencia/`) segue para Design/Tasks como seed migration normal, sem bloqueio |
| **D2** | Aritmética final do IIP | Não bloqueia — o número entra rotulado como provisório na onda de Incidência |

---

## 3. Como este plano se organiza: camadas em série, features em paralelo

A ordem entre **camadas** não é negociável — é dependência estrutural (§2 da Constituição, AD-007):
uma camada só depende do que está abaixo dela ou é transversal a ela, nunca do que está acima.

```
Fundação (pronta) ──► 12 catálogos ──► Operação: régua + instanciação ──► Operação: Kanban (escrita)
                                                    │
                                                    ├──► Planejamento (hierarquia + grade mensal)
                                                    ├──► Incidência (registro/insight/fato + IIP)
                                                    └──► Operação: Formulários
                                                                    │
                                                                    ▼
                                                                 Saída (consolidação, em fatias)
```

Mas **dentro** desse esqueleto, várias features não competem por dependência nem por arquivo — são
candidatas reais a specs paralelas, times/sessões diferentes ou pelo menos backlog intercalável.
O §4 é exatamente isso: uma trilha de trabalho que pode começar **agora, toda de uma vez**, porque
nenhum item depende de outro. O §5 é a onda de Operação (sequencial, pré-requisito de tudo depois).
O §6 é a segunda leva de paralelismo, maior: Planejamento, Incidência e Formulários são três ramos
irmãos que só dependem da régua de Operação existir — não umas das outras.

---

## 4. Trilhas imediatas — podem rodar em paralelo, a partir de agora

Nenhuma destas quatro trilhas depende de outra. Tocam tabelas, RLS e rotas praticamente disjuntas.
Se houver mais de uma pessoa/sessão disponível, é aqui que a paralelização rende mais: quatro specs
pequenas e independentes em vez de uma fila.

### Trilha F — ✅ CONCLUÍDA (2026-08-11) — Navegação por Produto (hub + ficha do contrato)

Ver `.specs/features/navegacao-por-produto/validation.md` (15/15 requisitos NAV-01 a NAV-15,
Verifier independente PASS, sensor 3/3 killed, 111 testes unitários — +18 desta feature). Texto
original abaixo, mantido para histórico.

`.specs/features/navegacao-por-produto/` (`spec.md`/`context.md` escritos em 2026-08-11, aguardando
Pedro confirmar os últimos itens abertos do `spec.md` antes de virar Design).

Substitui a landing page pós-login (`(app)/page.tsx`, hoje bento grid + explorador TSE) por:

1. Hub com 4 botões — Estratégia, PLL, Coalizão (os 3 produtos `operado_pelo_sistema = true` em
   `ref_produto`) e Visão Gerencial (placeholder "indicadores em desenvolvimento").
2. Área de cada produto com 4 abas fixas: Dashboard, Agenda, Contratos, Cadastro de novo Contrato.
3. Ficha operacional nova por **contrato** (`/contratos/[id]`, não por mandato/coalizão) —
   reaproveitada entre os dois tipos de contratante: abas por etapa real (`ref_etapa`, vazias de
   conteúdo), aba Assessores (funcional, reaproveita `/contratos/[id]/vinculos`), aba Formulários e
   botões de Insight/Fato Gerador (placeholder), link corrigido pro Planejamento (hoje uma rota
   quebrada, `/contratos/[id]/planejamento` não existe).

**Por que agora, fora de ordem com o resto do roadmap:** é 100% reorganização de frontend/rotas
sobre tabelas já provisionadas (`dim_mandato`, `dim_coalizao`, `dim_contratante`, `fat_contrato`,
`rel_usuario_contrato`, `ref_produto`, `ref_etapa`) — **nenhuma migration nova**. Não compete com
Trilha B nem com a onda de Operação (§5): pode rodar em paralelo com qualquer uma delas.

**Achado relevante pra quem pegar Design depois:** Kanban, indicadores de atingimento/metas,
Agenda com dado real, Insight/Fato Gerador e Planejamento funcional dependem de Operação (§5),
Planejamento (§6.1) e Incidência (§6.2) — nenhuma tem tabela provisionada hoje. Essas áreas nascem
como placeholder "em desenvolvimento" nesta trilha e viram consumidoras reais quando §5/§6
chegarem — não é regressão, é a mesma leitura que já valia pra Visão Gerencial, agora explícita pro
resto da tela também.

### Trilha A — ✅ CONCLUÍDA (2026-08-10) — Fechar `cadastro-mandato-contrato-unificado`

Ver `.specs/features/cadastro-mandato-contrato-unificado/validation.md` (16/16, PASS). Texto original
abaixo, mantido para histórico.

O trabalho de código já é ~90% feito (§1.4). O que falta:

1. **CMU-15** — Coalizão abre seu próprio contrato: ação "Novo contrato" em `/coalizoes/[id]`,
   reaproveitando `ContratoForm` com `idContratante` = o `id_contratante` da coalizão.
2. **CMU-16 / `FND-COL-03`** — corrigir o seletor "Adicionar membro" para filtrar
   `dim_contratante.tipo_contratante = 'mandato'`.
3. Rodar a fase **Validate** (Verifier independente) sobre os 16 requisitos, incluindo os 14 já
   implementados — hoje ninguém confirmou formalmente que cobrem os Acceptance Criteria do
   `spec.md`.
4. Atualizar `spec.md` (status de cada CMU-NN) e `STATE.md` (handoff) para refletir a realidade.

**Por que primeiro:** é a menor distância até destravar dívida de processo acumulada, e corrige um
bug de dado ativo (coalizão aparecendo como opção de membro de contrato).

### Trilha B — ✅ CONCLUÍDA (2026-08-11) — Convite por contrato (acesso externo)

Ver `.specs/features/convite-contrato/validation.md` (11/11 requisitos CVT-01 a CVT-11, Verifier
independente — rodada 1 `FAIL` com 1 Blocker real (proxy de sessão bloqueava `/convite` inteiro,
tornando o consumo inalcançável pra quem não tem sessão — exatamente o público da feature) → fix →
rodada 2 `PASS`). AD-033 registrada (5ª exceção da AD-010). Texto original abaixo, mantido para
histórico.

🟡 **Em fase Specify:** `.specs/features/convite-contrato/spec.md` (+ `context.md`) — não é magic
link (esclarecido direto ao Pedro): é criação de conta nova pra público que nunca teve caminho de
acesso, via token de uso único. Pontos mais sensíveis ainda sem confirmação: guarda explícita
contra criar papel admin/gestora via convite, e a nova AD (5ª exceção da AD-010).

Ainda não iniciada. Independente de OPR-01 (§5.1) — não toca tabela de Operação nem Planejamento —,
então pode rodar em paralelo numa sessão separada sem coordenação além do de sempre (`git status`
antes de escrever em arquivo compartilhado). Substitui o magic link removido pelo AD-026 para Mentor/Consultor e Assessor
externos.

Desenho já esboçado (herdado da versão anterior deste roadmap, ainda válido):

1. Gestora, na tela do contrato, clica "Convidar assessor" → e-mail, cargo, grau de
   responsabilidade, áreas.
2. Sistema gera token aleatório, grava **hash** em `convite_contrato` (tabela nova, migração
   incremental, AD-008/AD-025) com `id_contrato`, `papel_global` previsto, expiração, uso único.
3. Tela devolve a URL `/convite/<token>` para a Gestora copiar (mesmo padrão manual de
   `scripts/gerar-link-acesso.ts`, sem depender de SMTP).
4. Convidado abre a URL (rota pré-sessão), vê de qual mandato/contrato se trata, define nome+senha.
5. Route handler de servidor cria a conta (`email_confirm: true`) e chama RPC que grava
   `dim_usuario` + `rel_usuario_contrato` e consome o convite — numa transação só.

**Implicações a registrar na fase Specify, não detalhe:**
- Precisa de um **AD novo** que abra a 5ª exceção à lista fechada da AD-010.
- É um desvio deliberado do magic link previsto em §5.3 — mesmo rigor de registro que o AD-026 já
  teve.
- Mitigações obrigatórias: token de uso único, expiração curta, hash (nunca token em claro),
  rate limit por IP/token, auditoria de emissão e consumo (§5.5).
- **Bônus:** o mesmo mecanismo cobre o pareamento mentorado↔mentor do PLL — não vira feature
  separada depois.

**Por que agora:** é pequena, autocontida, e resolve o acesso externo de Mentor/Consultor e Assessor
que o AD-026 deixou pendente (magic link removido). **Não é mais pré-requisito da grade de Sucessos
Mensais** — o gate de protótipo da AD-022 caiu com a AD-028 — mas continua sendo o único caminho de
acesso pra esse público enquanto não existir.

### Trilha C — ✅ CONCLUÍDA (2026-08-10) — Catálogos (12 `ref_*` faltantes)

Ver `.specs/features/catalogos-referencia/validation.md` (17/17, PASS após fix→re-verify). Texto
original abaixo, mantido para histórico.

Pré-requisito estrutural de tudo que vem no §5 e §6 — nenhuma tabela de Operação, Planejamento ou
Incidência existe sem os catálogos que ela referencia.

1. **Levantamento de dado** (sem código): etapas por produto, os 16 formulários + métricas,
   tipologias (grupo/tipologia/estado + níveis padrão), níveis do IIP, indicadores com peso,
   preditores, agendas temáticas, perfis de atuação, pilares de insight, dimensões do GIP.
2. Fechar **D9** (régua da Coalizão clona a da Estratégia ou tem etapas próprias) junto deste
   levantamento — sem resposta, a instanciação de contrato de Coalizão no §5 não tem o que
   instanciar.
3. Migração das 12 tabelas + seed + RLS + grants + smoke test de leitura por papel.

> **Fora de escopo nesta fatia:** `/admin/catalogos` (CRUD administrado). A regra constitucional
> (§6.6, AD-004) exige tabela editável — que passa a existir aqui. A tela de edição é conveniência
> e entra quando o Admin tiver mais o que administrar.

### Trilha D — ✅ CONCLUÍDA (2026-08-10) — Plataforma de UI (AD-021 + estados padrão)

Ver `.specs/features/plataforma-ui-tanstack/validation.md` (11/12, PUI-06 aguarda UAT visual). Texto
original abaixo, mantido para histórico.

1. Instalar TanStack Query + TanStack Table e montar o provider — sem refatorar as telas de
   Fundação retroativamente (custo sem retorno, ver §7).
2. Instalar `sonner` (toast), `skeleton`, `tabs`, `tooltip`, `dropdown-menu`, `alert-dialog`,
   `checkbox`, `calendar`, `progress`.
3. Padronizar 3 componentes de estado (`<CarregandoSkeleton>`, `<ErroInline>`, `<EstadoVazio>`) +
   toast global, para toda feature nova herdar em vez de reinventar.

**Por que agora:** é dependência pura da grade de Sucessos Mensais (§6) e do Kanban (§5) — melhor
já estar pronta quando essas telas começarem, em vez de virar bloqueio de última hora.

### Trilha E (menor, pode entrar em qualquer uma das sessões acima como item avulso)

Correções pequenas e independentes entre si, encaixáveis em qualquer folga:

- ~~`FND-USR-02` — adicionar `WITH CHECK` explícito à policy `p_usuario`~~ ✅ **Resolvido em
  2026-08-10**, fora de ordem (não esperou nenhuma trilha) por ser falha de segurança ativa.
- ~~`FND-CTR-05` — popular `id_cargo_no_contrato`/`id_partido_no_contrato` no insert do
  contrato.~~ ✅ **Resolvido em 2026-08-13** — ver `.specs/STATE.md`.
- ~~Reproduzir e fechar (ou descartar formalmente) o relato de dropdowns quebrados — hoje parece
  resolvido, mas nunca foi confirmado nem riscado da lista.~~ ✅ **Confirmado funcionando em
  2026-08-13** (reprodução real em navegador, não só leitura de código) — ver `.specs/STATE.md`.

---

## 5. Onda de Operação — desbloqueada em 2026-08-10 (Trilha C concluída)

### 5.1 Régua de etapas e instanciação (OPR-01) — ✅ CONCLUÍDA (2026-08-12)

Ver `.specs/features/operacao-regua-instanciacao/validation.md` (10/10 requisitos, Verifier
independente PASS de primeira). **Desbloqueia 5.2 e 6.1** — `fat_etapa_contrato` e
`dim_planejamento` existem no banco agora. Texto original abaixo, mantido para histórico.

🟡 ~~Em fase Specify~~ — achado relevante já registrado lá: a função aprovada não marca nenhuma
etapa como iniciada nem grava `fat_contrato.id_etapa_atual` (isso passa a ser trabalho do Kanban,
§5.2). ~~Aguardando confirmação de Pedro no ponto de integração (trigger) e no backfill antes de
Design.~~ Confirmado (trigger + backfill na mesma migration, ambos como propostos).

⚠️ **Nota que a versão anterior já registrava e continua válida:** `dim_planejamento` referencia
`ref_perfil_atuacao` e é criado vazio na instanciação — ou seja, esta feature puxa junto uma fatia
da camada de Planejamento. Migrar só `dim_planejamento` aqui; as demais tabelas de Planejamento
entram no §6.

**Correção de nome (2026-08-10):** a função já está inteira, verbatim, em
`docs/schema_sistema.sql:1529-1559` — chama-se `app.instancia_contrato` (sem "r"), não
`app.instanciar_contrato` como uma versão anterior deste roadmap registrava. Não precisa reprojetar
nada, só provisionar exatamente o que já está aprovado: DDL de `fat_etapa_contrato` (`:708-727`),
`rel_formulario_contrato` (`:730-744`), `dim_planejamento` (`:877-889`), a view `vw_etapa_contrato`
(`:1186-1194`, `dias_atraso` derivado via `GREATEST`, nunca coluna gerada — nota C2 do schema) e a
função em si.

**Ponto de integração que a fase Specify precisa decidir:** `app.instancia_contrato(p_id_contrato)`
só roda se **alguém chamar**. Hoje `fat_contrato` nasce em 3 lugares: o wizard de mandato
(`mandato-wizard.tsx`), a ação "Novo contrato" da Coalizão (CMU-15, `coalizoes/[id]/page.tsx`, feita
hoje) e a rota antiga `/mandatos/[id]/contratos/novo` (órfã, ver pergunta Q4 do
`cadastro-mandato-contrato-unificado/spec.md`). A opção mais robusta é chamar a RPC **dentro** da
transação que cria `fat_contrato` (trigger `AFTER INSERT` ou a própria função de criação de
contrato) em vez de nos 3 call-sites do frontend — evita esquecer um caminho novo no futuro.

Trabalho: migração das 4 peças acima + trigger/wiring de chamada + tela da régua no detalhe do
contrato (previsto × realizado, atraso **derivado, nunca digitado** — AD-005; primeiro consumidor
real do TanStack Query/Table instalado hoje pela Trilha D).

**Entrega:** o contrato nasce com sua régua e seu planejamento vazio — primeira prova concreta da
Definição de Pronto ("no sistema o contrato já nasce com suas tabelas").

### 5.2 Kanban de etapas (AD-023) — continuação direta de 5.1, não trilha paralela

🟡 **Em fase Specify:** `.specs/features/kanban-etapas/spec.md` (+ `context.md`) — regra de
transição proposta (só colunas adjacentes; mover pra trás exclusivo de Admin/Gestora) ainda não
confirmada por Pedro.

Depende de 5.1 existir (`fat_etapa_contrato`) — por isso roda **em sequência** na mesma sessão de
amanhã, não como um segundo chat paralelo (o segundo escreveria numa tabela que ainda não existe).
É superfície de **escrita**: arrastar o card grava a transição com data e autor no fato de etapa —
exige RLS de escrita, validação de transição e auditoria (AD-006). Recortes por Gestora, Mentor,
produto e projeto.

⚠️ **Gap de dependência de frontend, achado em 2026-08-10:** nenhuma lib de drag-and-drop está
instalada (`package.json` conferido — zero ocorrência de `dnd`/`sortable`/`drag`). Entra no escopo
desta trilha, não é pré-requisito de outra.

**Entrega:** G1 (carteira ponderada) e G2 (tempo de ciclo) passam a acumular dado a partir daqui —
indicador histórico não se recupera depois, então quanto antes esta tela existir, mais cedo os
dois indicadores têm série real.

### 5.3 G1 + G2 — primeira fatia real de visão gerencial (AD-032)

🟡 **Em fase Specify:** `.specs/features/visao-gerencial-g1-g2/spec.md` (+ `context.md`) —
**achado novo, não previsto antes desta spec:** G1 exige "peso por etapa configurável em tabela de
referência" (Constituição §2.6) e essa tabela (`ref_peso_etapa`) não existe em nenhum dos 16
catálogos já provisionados pela Trilha C. Diferente do bloqueio de `mv_iip_contrato` (AD-032, esse
sim estrutural), aqui não há impedimento técnico — só falta criar a tabela, proposta com peso = 1
em toda linha até levantamento humano (mesmo padrão da CAT-16). Aguardando confirmação de Pedro.

Ainda dentro da mesma sequência de amanhã, logo depois do Kanban existir. **G2 (tempo de ciclo)** é
direto — mediana de `vw_etapa_contrato.dt_inicio`/`dt_conclusao` por etapa/Gestora/produto, sem
dependência extra. **G1 (carteira ponderada)** usa `vw_carteira` (`docs/schema_sistema.sql:1327`),
mas essa view aprovada faz `JOIN` com `mv_iip_contrato` — que só existe depois da Incidência (§6.2),
não planejada pra amanhã. **AD-032** resolve isso: `vw_carteira` nasce numa versão reduzida, sem a
coluna de IIP, substituída pela versão completa quando a Incidência existir — não é redesenho.

**Entrega:** uma tela mínima de visão gerencial (G1 + G2 + link pro Kanban) — não é a "visão
gerencial" completa da Constituição (§2.6), que só fecha com G3-G6 depois de Incidência/
Planejamento/Formulários (§6), mas é a primeira coisa real que uma Gestora pode olhar pra gerir a
operação, não só pra registrar contrato.

---

## 6. Segunda leva de paralelismo — Planejamento, Incidência e Formulários

As três dependem só da Fundação + dos catálogos (Trilha C) + da régua (§5.1) existirem — **não
dependem umas das outras** (§2 as define como camadas transversais irmãs, AD-007). É aqui que o
paralelismo de maior porte do roadmap acontece: três specs, três frentes, sem bloqueio cruzado.

### 6.1 Planejamento do contrato (PLN-01/02/03) — ✅ CONCLUÍDA (2026-08-12)

Ver `.specs/features/planejamento-planilha-monitoramento/validation.md` (11/11 requisitos PLM-01 a
PLM-11, Verifier independente PASS na rodada 2, 1 Major + 2 Minor corrigidos na rodada 1). A fórmula
de cascata Meta→Objetivo→Planejamento (única pendência real de confirmação) foi validada com Pedro
**e** coincide com `app.recalcula_atingimento`, já verbatim no schema aprovado (achado de Design —
o texto abaixo, que dizia "só o nível folha tem regra explícita", estava desatualizado). Handoff
completo em `.specs/STATE.md`.

Hierarquia Objetivo Específico → Meta → Sucesso Mensal (AD-012, um único conjunto de tabelas
discriminado por produto — nunca um schema por produto), preditores, agenda temática, SWOT no
objetivo. É esta hierarquia (§2.3 da Constituição) que sustenta a **Planilha de Monitoramento**
citada no RBAC (§3, papel do Assessor — "vê apenas a Planilha de Monitoramento à qual está
vinculado") — não é uma tela nova sem lastro de schema, é a grade sobre `fat_sucesso_mensal`.

**Diferenças reais entre produtos, já documentadas no schema aprovado (não redescobrir, só
provisionar):**
- `fat_meta.id_preditor_secundario` — só a Estratégia usa dois preditores; PLL usa só o primário
  (`docs/schema_sistema.sql:953`, comentário da coluna). É a única diferença estrutural entre os
  dois planejamentos, e o motivo de as tabelas serem unificadas em vez de duplicadas.
- `fat_sucesso_mensal.peso` — escala 0–100 pros dois produtos hoje, mas a carga histórica converteu
  de bases em escalas diferentes (Estratégia usava 0–1 na planilha antiga); a soma dos pesos de uma
  meta precisa fechar 100, validado na migração (`docs/schema_sistema.sql:976`).
- Coalizão **sem** planejamento próprio não usa nada disto — é visão filtrada por Projeto sobre o
  planejamento de Estratégia de cada mandato membro (Constituição §2.3/§2.4, OPR-06). Coalizão
  **com** planejamento próprio usa exatamente as mesmas tabelas que Estratégia/PLL (AD-012).
- `dim_planejamento.id_perfil_atuacao` referencia `ref_perfil_atuacao` (Trilha C, já provisionada) —
  é o catálogo que declara o que varia por produto sem precisar de coluna nova.

**Exigência de Pedro (2026-08-11):** antes de Design, a fase Specify precisa listar **todos os
campos** de `dim_planejamento`/`fat_objetivo_especifico`/`fat_meta`/`fat_sucesso_mensal`
(`docs/schema_sistema.sql:877-980`) num quadro por produto (Estratégia/PLL/Coalizão), marcando
quais são comuns, quais ficam nulos em qual produto, e quais — se houver algum não documentado
acima — são de fato uma diferença ainda não coberta pela AD-012. Não é permitido simplificar campo
por conveniência de UI sem essa checagem explícita.

A **grade editável de Sucessos Mensais** é a tela de maior frequência do sistema. O gate de
protótipo validado com assessor real que a AD-022 exigia foi **dispensado** (AD-028, 2026-08-10) —
a feature avança sem essa validação externa prévia e sem depender da Trilha B. O risco de adoção
descrito em §5.7 continua valendo como algo a observar (tabulação entre células, colar de uma
faixa, edição em massa precisam ser rápidos, ou os assessores voltam pra planilha) — a mitigação
agora é revisão pós-implementação, não gate prévio (trade-off registrado na AD-028).

### 6.2 Incidência + Encontros (INC-01/02/03, OPR-03) — ✅ Concluída (2026-08-14)

Registro, Insight, Fato Gerador, e o cálculo do IIP (AD-014 — calculado uma única vez aqui, a Saída
só lê). Encontros (OPR-03) entra junto por alimentar registros/insights diretamente. IIP entra
rotulado como provisório enquanto D2 (aritmética final) não fecha — isso não bloqueia a entrega.

**Entregue** (`.specs/features/incidencia-encontros/`, 35 tasks, Verifier independente — ver
handoff em `STATE.md`): as 7 tabelas verbatim (`fat_encontro`+`rel_encontro_participante`,
`fat_registro`, `fat_insight`+`rel_insight_origem`, `fat_fato_gerador`+`rel_fato_origem`) + a `mv_iip_contrato`
+ `vw_iip_contrato` (nova, grão por contrato) + refresh síncrono (`app.atualiza_iip_contrato`,
AD-035) + as 2 RPCs `SECURITY INVOKER` (AD-024, Fato Gerador/Insight) + `ref_tipologia` seedada com
as 51 linhas reais do CSV aprovado + UI completa (card de IIP, os 4 formulários, aba Encontros).
`iip_provisorio` fica `NULL` (nunca `0`, AD-005) até `ref_indicador` ganhar peso real (CAT-16, sem
data) — decisão confirmada com Pedro, não é lacuna desta feature. **AD-032 resolvida**: `vw_carteira`
trocada pela versão completa (ver `STATE.md`).

### 6.3 Formulários (OPR-02)

A mais pesada das três: 16 formulários, JSONB versionado, métricas calculadas via trigger. Depende
de `ref_formulario`/`ref_metrica_formulario` (Trilha C) e de `rel_formulario_contrato` (§5.1), mas
usa tabelas próprias (`fat_submissao`, `fat_resposta_metrica`) que não colidem com Planejamento nem
Incidência — pode correr ao lado das outras duas sem coordenação além do catálogo compartilhado.

---

## 7. Saída — última onda, mas entregável em fatias

Números de impacto, carteira, visão gerencial, evolução do GIP, snapshot mensal (AD-015: única
escrita autorizada na Saída é o job de fechamento mensal). Não precisa esperar as três frentes do
§6 chegarem 100% prontas — cada view/MV pode nascer assim que a camada de que depende estabiliza:
`vw_carteira` e `vw_etapa_contrato` já podem existir logo depois do §5; `mv_iip_contrato` só depois
de 6.2; `vw_sucesso_mensal`/GIP só depois de 6.1.

**Correção (2026-08-11):** a frase anterior aqui ("Home/dashboard real entra junto desta onda")
ficou desatualizada pela Trilha F (§4) — a raiz (`/`) vira o hub de produtos antes disso, fora de
ordem, por pedido direto do Pedro. O que **continua** valendo pra esta onda é a Visão Gerencial de
verdade (G1-G6) e os indicadores reais de Dashboard/Agenda que a Trilha F deixou como placeholder.

---

## 8. Rituais fixos (todo fim de feature)

1. **UAT manual** com roteiro acumulativo em `.specs/uat/roteiro-manual.md` — cresce a cada
   feature, nunca é reescrito.
2. **Verifier independente** (autor ≠ verificador, evidência-ou-zero) → `validation.md`. A Trilha A
   é o lembrete vivo do custo de pular esta etapa.
3. **Atualizar `STATE.md`**: handoff + qualquer AD novo (Trilha B precisa de um).
4. **Lição reutilizável** sempre que uma falha de verificação virar padrão a evitar.
5. **Backup do banco antes de toda migration destrutiva** (`docs/fluxo-de-trabalho.md` tem o
   comando pronto).
6. **`drift-check` mentalmente obrigatório** antes de considerar uma migration terminada — agora
   que o CI cobre isso automaticamente toda segunda, mas vale rodar sob demanda em mudança grande.

---

## 9. O que este plano deliberadamente **não** faz

- Não refatora as telas de Fundação para TanStack Query/Table retroativamente — custo sem retorno.
- Não constrói `/admin/catalogos` antes de haver o que administrar.
- Não fecha a aritmética do IIP (D2) — depende da área de conhecimento.
- Não toca em Mapa Político nem Diagnóstico de Organograma (AD-017, deferidos).
- Não implementa prospecção (decisão fechada: contrato existe quando há contrato).
- Não trata `FND-CTR-05` como bloqueante — é debito de baixo impacto, cabe como item avulso da
  Trilha E sempre que houver folga.
- Não assume que os dropdowns "quebrados" estão resolvidos só porque o código parece correto —
  fica como item explícito de confirmação (Trilha E) até alguém reproduzir ou descartar de fato.
