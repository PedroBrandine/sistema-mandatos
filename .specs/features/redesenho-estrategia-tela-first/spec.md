# Redesenho tela-first do produto Estratégia — Specification

> **Primeira aplicação do protocolo `docs/redesenho-tela-first.md` (AD-038).**
> A checagem de conformidade do §3 está embutida na seção *Checagem de conformidade*,
> conforme exige o §4 ("`spec.md` — contrato da tela, com a checagem do §3 dentro").

- **Insumo de origem:** 7 telas do Figma (`Sistema Gestão de Mandatos | Legisla Brasil`,
  file `eS5CdQrl6yUdYctZwlDzps`)
- **Gate AD-039:** ✅ satisfeito — Pedro validou as 7 telas com a operação antes desta spec.
- **Data:** 2026-09-10

| # | Tela | Node |
| :-- | :-- | :-- |
| T1 | Hub de produtos | `59:4` |
| T2 | Estratégia · Novo Contrato — formulário vinculado ao TSE | `188:5` |
| T3 | Estratégia · Dashboard — KPIs + Quadro de Acompanhamento + Pendências | `44:5` |
| T4 | Estratégia · Novo Contrato — estado inicial (busca TSE) | `188:192` |
| T5 | Estratégia · Agenda — calendário mensal + Registros | `163:4` |
| T6 | Estratégia · Mandatos — lista de contratos com filtros | `202:554` |
| T7 | Popover de encontro — detalhe, presença, registro | `90:206` |

---

## Problem Statement

Em 2026-09-02 o dono do produto relatou que **nenhuma tarefa da operação roda no sistema**,
apesar de 26 das 28 telas estarem classificadas como funcionais (`docs/mapa-de-telas.md`).
O diagnóstico registrado em AD-038 é de **aderência**, não de implementação incompleta: as
telas existem, mas não correspondem ao dia a dia de quem opera. Estas 7 telas são a primeira
jornada redesenhada a partir da operação real — Hub → produto Estratégia → as quatro
superfícies onde a Gestora passa o dia (acompanhar, agendar, listar, cadastrar).

## Goals

- [ ] A Gestora completa o ciclo *ver o que precisa de atenção → agir* sem abrir a planilha.
- [ ] Prospecção deixa de ser um vazio do modelo e passa a ser registrada no sistema (AD-040).
- [ ] Limiares de pendência tornam-se editáveis pela operação, sem deploy (corrige violação de AD-004).
- [ ] ACs de tela passam a ter gate automático de teste — encerra o débito L-006/L-007.

## Out of Scope

| Item | Motivo |
| :-- | :-- |
| Produtos PLL, Coalizão e Visão Gerencial | Os cards existem no Hub (T1), mas só a rota da Estratégia é redesenhada nesta leva. Os demais seguem apontando para as telas atuais. |
| Tela de administração de limiares | `ref_limiar_pendencia` nasce editável por SQL/seed. Superfície de edição não está nos 7 designs. |
| Fórmula final do IIP | Permanece com a área de conhecimento (D2 do schema). O dashboard consome `mv_iip_contrato` como está. |
| Edição de encontro pelo popover | T7 permite marcar presença e adicionar registro; editar título/data/local não aparece no design. |
| Substituição de `docs/jornadas-de-usuario-v2.md` | Documento congelado (AD-038). A v3 é derivada depois das telas validadas, não nesta feature. |
| Reescrita das telas antigas de `produtos/[slug]` | Convivem até a jornada nova estar validada em uso. |

---

## Checagem de conformidade (protocolo §3)

### Travas técnicas

| Trava | Tela | Veredito |
| :-- | :-- | :-- |
| **AD-002** · sem acesso anônimo | todas | ✅ nenhuma das 7 telas é pública ou tem formulário por link |
| **AD-006** · autor + timestamp | T2, T7 | ✅ `trg_audit_fat_encontro` e `trg_audit_rel_encontro_participante` já existem (`20260813192032`); `fat_prospeccao` nasce com o mesmo trigger |
| **AD-005** · pendência é derivada | T3 | ✅ as 5 pendências vêm de `vw_pendencias`; nenhuma é campo digitado |
| **AD-003** · número novo exige camada Saída | T1, T3 | ✅ `mv_iip_contrato`, `mv_avaliacao_nps`, `mv_numeros_impacto`, `vw_pendencias` provisionadas. Agregação por produto é nova → **EST-08** |
| **AD-001** · restrição mora na RLS | T1, T3 | ⚠️ visibilidade dos cards do Hub deve derivar do que a role lê (`REVOKE` já existente sobre `mv_numeros_impacto`/`mv_avaliacao_nps` para `legisla_mentor`/`legisla_assessor`), nunca de `if` no componente → **EST-02** |
| **AD-004** · limiar em tabela editável | T3 | 🔴 **violada** — `vw_pendencias` tem `INTERVAL '30 days'` e `INTERVAL '45 days'` cravados no SQL → **EST-06** |

### Cobertura de dado (contra `docs/schema_sistema.sql`)

| Campo da tela | Situação |
| :-- | :-- |
| T2 §2 — Etnia/Raça, Identidade de Gênero, Orientação Sexual, PcD | ✅ existe: `dim_mandato.ds_raca`, `ds_identidade_genero`, `ds_orientacao_sexual`, `fl_pcd` |
| T2 §3 — Potencial de futuro, Relevância política, Confiança, Risco democrático | ✅ existe: `dim_mandato.potencial_futuro`, `relevancia_politica`, `confianca`, `risco_democratico` |
| T2 §1 — Nome, UF, município, título, cargo, partido (somente leitura do TSE) | ✅ existe: `tse.dim_candidatura` + `rel_mandato_candidatura` |
| T2 §4 — Produto, Projeto, Data de início, Coalizão | ✅ existe: `fat_contrato`, `rel_coalizao_membro` |
| T7 — etapa, tipo, data/horário, modalidade, local, tema, participantes | ✅ existe: `fat_encontro` + `rel_encontro_participante` |
| T7 — "N registros vinculados" | ✅ existe: `fat_registro` vinculado a contrato/encontro |
| T5 — tipos de registro (Mentoria, Monitoramento, Diagnóstico, Planejamento, Encontro) | ✅ existe: `ref_tipo_registro` |
| T3 — Pendências (5 tipos) | ✅ existe: `vw_pendencias` retorna exatamente `cadastro`, `formulario_aberto`, `etapa_atrasada`, `encontro_vencido`, `sem_registro_recente` |
| T3 — NPS, IIP, Fatos geradores, Atingimento | ✅ dado existe; **agregação por produto é nova** → EST-08 |
| T3/T6 — coluna/etapa **Prospecção** | 🔴 **não existe** — removida deliberadamente por D4 → **AD-040 + EST-04** |
| T3/T6 — etapa **Rota-X** | ✅ existe como `raio_x` / "Raio-X" — "Rota-X" foi **erro de digitação no Figma** (confirmado por Pedro em 2026-09-10). Nenhuma mudança de dado; a correção é no desenho |
| T3 — limiares "30 / 45 / 60 dias" | 🔴 cravados na view → **EST-06** |

### Inventário coberto (§10 das jornadas)

| Item | Situação |
| :-- | :-- |
| Registros por tipo | **cobre** (T5) |
| Encontros e presença | **cobre** (T5, T7) |
| Métricas de formulário / NPS | **cobre** parcialmente (T3 mostra o agregado; a submissão segue nas telas atuais) |
| Fatos geradores | **cobre** como contador (T3); a tela de registro segue em `numeros-impacto` |
| Planejamento / metas | **descarta nesta leva** — T3 mostra só `% atingimento`; a superfície de planejamento não faz parte destes 7 designs |

### Jornadas afetadas

Blocos de `docs/jornadas-de-usuario-v2.md` que estas telas reescrevem: **A1** (entrada e escolha
de produto), **A2** (cadastro de mandato/contrato), **A4** (agenda e encontros), **A6** (ciclo de
acompanhamento). A v3 desses blocos é derivada **depois** desta feature entrar em uso (AD-038).

### Veredito

**Vira spec agora**, com duas condições já resolvidas por decisão de Pedro em 2026-09-10:
AD-040 (Prospecção pré-contrato) e a correção da violação de AD-004 (limiares).

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Rationale | Confirmado? |
| :-- | :-- | :-- | :-- |
| Prospecção é entidade **pré**-contrato | `fat_prospeccao`, sem `id_contrato`; converte criando `fat_contrato` | Decisão de Pedro 2026-09-10; reabre D4, que já previa "volta como tabela própria" | ✅ sim |
| "Rota-X" no Figma | **Erro de digitação.** A etapa é "Raio-X" e fica como está — nenhuma migration, nenhum renome | Confirmado por Pedro em 2026-09-10. A correção acontece no Figma, não no banco | ✅ sim |
| "Gestão de Usuários" sai da Topbar | Vira card do Hub, posicionado **depois** de "Números de Impacto" | Decisão de Pedro em 2026-09-10. Consequência: o Hub deixa de ser só seletor de produto e passa a ser ponto de entrada de produtos **e** ferramentas | ✅ sim |
| Limiares de pendência | `ref_limiar_pendencia` editável; valores iniciais = os da view atual (30/45) | AD-004 / §6 regra 6 | ✅ sim |
| Gate de teste de UI | Instalar `@testing-library/react` + `jsdom`, abrir `.test.tsx` no vitest | Decisão de Pedro 2026-09-10; encerra L-006/L-007 | ✅ sim |
| **Pontapé não aparece em nenhum dos 7 designs** | Quadro de Acompanhamento é **data-driven** a partir de `ref_etapa` — renderiza as 6 etapas reais + a raia de Prospecção (7 colunas), não as 6 do Figma | Colunas cravadas repetiriam o erro que a correção `20260812163617` já teve de desfazer. Se Pontapé deve sumir, é migration de seed, não `if` na tela | ⚠️ **pendente de Pedro ao ver o board** |
| Status `Ativo / Finalizado / Desligado` (T6) | Rótulos de exibição para `ativo / concluido / nao_concluido` | Nenhum status novo aparece no CHECK; a tradução é de apresentação | ⚠️ assumido |
| KPI "Mandatos em Atraso: 8" com legenda somando 13 | Implementar o número como **contagem de contratos com pendência de etapa atrasada**; legenda mostra a distribuição real | Inconsistência aritmética do desenho; o dado manda | ⚠️ assumido |
| Aba chamada "Contratos" (T3/T5) vs "Mandatos" (T6) | **"Mandatos"** — é o vocabulário da operação e o título da própria página em T6 | T6 é a tela mais recente e a que nomeia a página | ⚠️ assumido |
| Prospect na lista de Mandatos (T6) | Prospect **não** aparece em T6; T6 lista `fat_contrato`. Prospects vivem na raia Prospecção do T3 | Coerência com AD-040: sem contrato, não há vigência/gestora/status para exibir | ✅ sim |

**Open questions:** nenhuma bloqueante. As três marcadas ⚠️ têm default aplicado e são
confirmáveis na primeira demo — nenhuma altera contrato de banco.

---

## User Stories

### P0: Gate de teste de componente ⭐ pré-requisito

**User Story**: Como time, queremos que ACs de tela tenham gate automático, para que "tela
funcional" volte a significar "tela verificada".

**Why P0**: O contrato de execução do skill exige que o test runner decida se uma task está
pronta. Sem harness, 7 telas de UI entrariam sem gate — o mesmo ponto cego que produziu 26
telas funcionais e nenhuma em uso.

**Acceptance Criteria**:

1. WHEN `npm run test:unit` roda THEN o runner SHALL coletar arquivos `.test.tsx` sob `src/frontend/`.
2. WHEN um teste de componente renderiza uma tela desta feature THEN ele SHALL usar `@testing-library/react` em ambiente `jsdom`.
3. WHEN um elemento renderizado é removido do componente THEN ao menos um teste SHALL falhar.

**Independent Test**: apagar um `<h1>` de qualquer tela nova e ver o gate quebrar.

---

### P1: Hub de produtos ⭐ MVP

**User Story**: Como usuária autenticada, quero escolher o produto na entrada do sistema, para
chegar ao meu contexto de trabalho em um clique.

**Acceptance Criteria**:

1. WHEN a usuária acessa a raiz autenticada THEN o sistema SHALL exibir um card por destino que ela pode acessar — produtos e ferramentas.
2. WHEN a usuária tem papel sem acesso a um destino THEN o card correspondente SHALL não ser renderizado, **e a restrição SHALL vir do que a role lê no banco**, não de condicional na UI (AD-001).
3. WHEN o card "Estratégia" é exibido THEN ele SHALL mostrar a contagem real de mandatos ativos.
4. WHEN o card "Números de Impacto" é exibido THEN ele SHALL mostrar a contagem real de fatos geradores registrados.
5. WHEN a usuária clica em um card THEN o sistema SHALL navegar para a rota daquele destino.
6. WHEN o Hub é renderizado THEN o card "Gestão de Usuários" SHALL aparecer **depois** de "Números de Impacto" na ordem dos cards.
7. WHEN a usuária não é Admin do Sistema THEN o card "Gestão de Usuários" SHALL não ser renderizado, pela mesma regra da AC2 (AD-001 + AD-018).

**Independent Test**: logar com dois papéis diferentes e comparar os cards visíveis e sua ordem.

---

### P1: Topbar enxuta ⭐ MVP

**User Story**: Como usuária, quero que a barra superior carregue só navegação global, para que
funções administrativas não fiquem competindo com o contexto de trabalho.

**Acceptance Criteria**:

1. WHEN qualquer tela autenticada é renderizada THEN a Topbar SHALL exibir a marca, o link "Hub" e o avatar da usuária.
2. WHEN qualquer tela autenticada é renderizada THEN a Topbar SHALL **não** exibir "Gestão de Usuários".
3. WHEN a rota `/usuarios` é acessada diretamente por quem não é Admin THEN o acesso SHALL ser recusado pelo banco, não apenas pela ausência do link (AD-001).

**Independent Test**: percorrer as 7 telas e conferir que a Topbar é idêntica em todas e sem o item removido.

---

### P1: Shell do produto Estratégia ⭐ MVP

**User Story**: Como Gestora, quero navegar entre Dashboard, Agenda, Mandatos e Novo Contrato
sem perder o contexto do produto.

**Acceptance Criteria**:

1. WHEN a usuária entra em qualquer rota da Estratégia THEN o sistema SHALL exibir o título do produto e as 4 abas.
2. WHEN uma aba está ativa THEN ela SHALL estar visualmente marcada e as demais não.
3. WHEN a usuária clica em "Voltar ao hub" THEN o sistema SHALL navegar para o Hub.
4. WHEN a rota não corresponde a um produto válido THEN o sistema SHALL retornar 404.

**Independent Test**: percorrer as 4 abas e conferir a marcação ativa em cada uma.

---

### P1: Lista de Mandatos com filtros ⭐ MVP

**User Story**: Como Gestora, quero ver todos os contratos com vigência, etapa e responsável,
filtrando pelo recorte que me interessa.

**Acceptance Criteria**:

1. WHEN a aba Mandatos abre THEN o sistema SHALL listar os contratos que a usuária pode ler, com contratante, vigência, status, gestora, projeto, etapa atual e responsável.
2. WHEN nenhum filtro está aplicado THEN o sistema SHALL exibir a contagem total ("N mandatos").
3. WHEN a usuária aplica um filtro (data, gestora, projeto, etapa, status) THEN a lista e a contagem SHALL refletir apenas os contratos correspondentes.
4. WHEN a usuária clica em "Limpar filtros" THEN todos os filtros SHALL voltar ao estado inicial.
5. WHEN um contrato tem `dt_fim` nula THEN o campo Data Final SHALL exibir "—", nunca uma data inventada.
6. WHEN a lista está vazia após filtro THEN o sistema SHALL exibir estado vazio explicativo, não uma tabela em branco.

**Independent Test**: filtrar por uma etapa e conferir que a contagem bate com o SQL equivalente.

---

### P1: Quadro de Acompanhamento e Pendências ⭐ MVP

**User Story**: Como Gestora, quero ver num só lugar onde cada mandato está e o que está
pendente, para saber onde agir hoje.

**Why P1**: É o teste do gate 4 do protocolo — a pessoa passar a semana sem abrir a planilha.

**Acceptance Criteria**:

1. WHEN o Dashboard abre THEN o Quadro SHALL renderizar **uma coluna por `ref_etapa` do produto**, mais a raia de Prospecção — nunca uma lista fixa no código.
2. WHEN um contrato está em uma etapa THEN seu card SHALL aparecer na coluna daquela etapa com contratante, cargo/partido e dias na etapa.
3. WHEN os dias na etapa ultrapassam o limiar lido de `ref_limiar_pendencia` THEN o card SHALL exibir o estado correspondente (`Normal`, `Atenção`, `Atrasado`).
4. WHEN a tabela de Pendências carrega THEN ela SHALL exibir os 5 tipos de `vw_pendencias`, com mandato, tipo, detalhe e data de referência.
5. WHEN a usuária clica em uma linha de pendência THEN o sistema SHALL navegar para o contrato correspondente.
6. WHEN não há pendências THEN o sistema SHALL exibir estado vazio, não uma tabela vazia.

**Independent Test**: mover um contrato de etapa e ver o card trocar de coluna e recalcular dias.

---

### P1: Prospecção como entidade pré-contrato ⭐ MVP

**User Story**: Como Gestora, quero registrar um mandato em prospecção antes de existir
contrato, para não perder o trabalho anterior à assinatura.

**Why P1**: É a lacuna que D4 deixou explícita ("o sistema não guarda material anterior à
assinatura") e a razão de AD-040.

**Acceptance Criteria**:

1. WHEN uma prospecção é criada THEN o sistema SHALL persistir sem `id_contrato` e sem exigir data de vigência.
2. WHEN uma prospecção é criada ou alterada THEN a linha SHALL registrar autor e timestamp (AD-006).
3. WHEN uma prospecção é convertida THEN o sistema SHALL criar o `fat_contrato` e marcar a prospecção como convertida, **na mesma transação**.
4. WHEN uma prospecção já convertida recebe nova tentativa de conversão THEN o sistema SHALL recusar e informar, sem criar contrato duplicado.
5. WHEN a lista de Mandatos (T6) carrega THEN prospecções SHALL não aparecer nela.
6. WHEN a usuária não tem permissão de leitura sobre a prospecção THEN a RLS SHALL impedir a leitura no banco.

**Independent Test**: criar prospect, converter, e conferir que o contrato nasceu e o prospect saiu da raia.

---

### P2: Novo Contrato — busca TSE e cadastro

**User Story**: Como Gestora, quero abrir mandato e contrato numa tela só, partindo da base
oficial do TSE quando ela cobre a pessoa.

**Acceptance Criteria**:

1. WHEN a usuária digita menos de 3 letras THEN o sistema SHALL não disparar busca.
2. WHEN a usuária digita 3 letras ou mais THEN o sistema SHALL buscar candidaturas no espelho TSE e listar os resultados.
3. WHEN a usuária seleciona uma candidatura THEN os campos vindos do TSE (nome, UF, município, título, cargo, partido) SHALL ser preenchidos e ficar **somente leitura**.
4. WHEN a usuária escolhe "Cadastro manual" THEN o formulário SHALL abrir com os mesmos campos editáveis e `origem_partido_cargo = 'manual'`.
5. WHEN a usuária clica em "Cancelar e buscar novamente" THEN o vínculo TSE SHALL ser desfeito e a busca reaberta.
6. WHEN o formulário é submetido THEN mandato e contrato SHALL ser criados na mesma transação — nunca mandato sem contrato.
7. WHEN o título eleitoral já existe THEN o sistema SHALL recusar com mensagem específica, sem criar duplicata.
8. WHEN a busca ao TSE falha THEN o sistema SHALL informar o erro e oferecer o cadastro manual, sem travar a tela.

**Independent Test**: cadastrar via TSE e via manual, e conferir as duas linhas no banco.

---

### P2: Agenda — calendário e registros

**User Story**: Como Gestora, quero ver os encontros do mês e os registros vinculados, para
preparar e fechar cada encontro.

**Acceptance Criteria**:

1. WHEN a Agenda abre THEN o sistema SHALL exibir o mês corrente com os encontros posicionados no dia correto.
2. WHEN um encontro é exibido THEN sua cor SHALL refletir o status (`Agendada` / `Realizada`).
3. WHEN a usuária navega entre meses THEN os encontros SHALL recarregar para o mês exibido.
4. WHEN a usuária clica em um encontro THEN o sistema SHALL abrir o popover de detalhe (T7).
5. WHEN um encontro é selecionado THEN a lista de Registros SHALL filtrar por ele e exibir o filtro ativo, removível.
6. WHEN o dia é hoje THEN a célula SHALL estar visualmente destacada.

**Independent Test**: navegar dois meses para trás e conferir que a grade e a lista mudam juntas.

---

### P2: Popover de encontro — presença e registro

**User Story**: Como Gestora, quero marcar presença e registrar o que aconteceu no próprio
encontro, sem sair da agenda.

**Acceptance Criteria**:

1. WHEN o popover abre THEN ele SHALL exibir status, etapa, tipo, data/horário, modalidade, local, tema e participantes.
2. WHEN o encontro tem registros vinculados THEN o popover SHALL exibir a contagem e o link para eles.
3. WHEN a data prevista do encontro já passou e o status é `planejado` THEN o popover SHALL exibir o aviso e a ação "Marcar presença".
4. WHEN a usuária marca presença THEN o sistema SHALL gravar `status = 'realizado'` e `dt_realizada`, registrando autor e timestamp (AD-006).
5. WHEN a usuária marca presença em encontro já realizado THEN o sistema SHALL não duplicar a transição.
6. WHEN a usuária clica em "Adicionar registro" THEN o sistema SHALL abrir a criação de registro já vinculada àquele encontro e contrato.

**Independent Test**: marcar presença num encontro vencido e ver o status virar Realizada na grade.

---

### P3: KPIs do Dashboard

**User Story**: Como Gestora, quero os números do produto no topo do Dashboard, para ter a
leitura do conjunto antes de olhar caso a caso.

**Acceptance Criteria**:

1. WHEN o Dashboard abre THEN o sistema SHALL exibir mandatos ativos, IIP, mandatos em atraso, NPS das imersões, atingimento do planejamento e fatos geradores.
2. WHEN um KPI não tem dado suficiente THEN o sistema SHALL exibir ausência explícita ("—"), nunca zero (AD-005).
3. WHEN os filtros de gestora/projeto são aplicados THEN os KPIs SHALL recalcular para o recorte.
4. WHEN um KPI vem de agregação por produto THEN ele SHALL ser lido de uma view da camada Saída, não calculado no componente (AD-003).

**Independent Test**: conferir cada KPI contra a query equivalente rodada à mão.

---

## Edge Cases

- WHEN o contrato não tem etapa atual THEN o card SHALL aparecer numa coluna "Sem etapa", nunca desaparecer silenciosamente.
- WHEN `ref_etapa` tem etapa sem nenhum contrato THEN a coluna SHALL renderizar vazia, com contador zero.
- WHEN dois usuários convertem a mesma prospecção simultaneamente THEN apenas uma conversão SHALL criar contrato; a outra SHALL falhar com mensagem.
- WHEN o espelho TSE está indisponível THEN a busca SHALL degradar para o cadastro manual, sem erro não tratado.
- WHEN o mês da Agenda não tem nenhum encontro THEN a grade SHALL renderizar completa e vazia, com estado explicativo na lista.
- WHEN um limiar é editado em `ref_limiar_pendencia` THEN a classificação dos cards SHALL mudar sem deploy.
- WHEN a usuária perde permissão sobre um contrato entre o carregamento e a ação THEN a RLS SHALL recusar a escrita no banco.

---

## Requirement Traceability

| ID | Story | Fase | Status |
| :-- | :-- | :-- | :-- |
| EST-01 | P0: Gate de teste de componente | Design | Pending |
| EST-02 | P1: Hub de produtos | Design | Pending |
| EST-03 | P1: Shell do produto Estratégia | Design | Pending |
| EST-04 | P1: Prospecção pré-contrato (`fat_prospeccao`, AD-040) | Design | Pending |
| EST-05 | P1: Topbar enxuta — "Gestão de Usuários" migra para card do Hub | Design | Pending |
| EST-06 | P1: `ref_limiar_pendencia` + refactor de `vw_pendencias` (AD-004) | Design | Pending |
| EST-07 | P1: Quadro de Acompanhamento + Pendências | Design | Pending |
| EST-08 | P3: View de KPIs agregados por produto (AD-003) | Design | Pending |
| EST-09 | P1: Lista de Mandatos com filtros | Design | Pending |
| EST-10 | P2: Novo Contrato — busca TSE | Design | Pending |
| EST-11 | P2: Novo Contrato — formulário e transação | Design | Pending |
| EST-12 | P2: Agenda — calendário e registros | Design | Pending |
| EST-13 | P2: Popover de encontro — presença e registro | Design | Pending |

**Coverage:** 13 total, 0 mapeados para tasks, 13 não mapeados ⚠️ (normal antes da fase Tasks)

---

## Implicit-Requirement Dimensions Sweep

Escopo Complex — toda dimensão resolve em requisito ou `N/A` justificado.

| Dimensão | Resolução |
| :-- | :-- |
| Input validation & bounds | EST-10 AC1 (mín. 3 letras), EST-11 AC7 (título único), schemas Zod em `src/backend/schemas/` |
| Failure / partial-failure | EST-11 AC6 (transação única mandato+contrato), EST-04 AC3 (conversão transacional), EST-10 AC8 (falha do TSE) |
| Idempotency / retry / duplicados | EST-04 AC4 (conversão dupla), EST-13 AC5 (presença dupla), EST-11 AC7 (título duplicado) |
| Auth boundaries & rate limits | EST-02 AC2, EST-04 AC6 — restrição na RLS (AD-001). Rate limit: `N/A` — sem superfície pública (AD-002) |
| Concurrency / ordering | Edge case de conversão simultânea; `uq_encontro_sequencia` já protege ordem de encontros |
| Data lifecycle / expiry | Prospecção sem conversão permanece indefinidamente — decisão explícita: prospect é histórico, não expira. Limiares versionados por `log_auditoria` |
| Observability | `log_auditoria` via `app.trg_auditoria()` em `fat_prospeccao` (EST-04 AC2); demais tabelas já cobertas |
| External-dependency failure | EST-10 AC8 — espelho TSE indisponível degrada para cadastro manual |
| State-transition integrity | EST-04 AC3/AC4 (prospect → contrato, mão única), EST-13 AC4/AC5 (planejado → realizado) |

---

## Success Criteria

- [ ] A Gestora completa *abrir Hub → Estratégia → identificar pendência → agir* sem planilha.
- [ ] Um prospect é registrado, convertido em contrato e o contrato aparece no Quadro.
- [ ] Um limiar editado em `ref_limiar_pendencia` muda a classificação dos cards sem deploy.
- [ ] `npm run test:unit` coleta e executa testes `.test.tsx`; remover um elemento renderizado quebra o gate.
- [ ] Nenhuma coluna do Quadro é fixa no código — trocar `ref_etapa` muda a tela.
