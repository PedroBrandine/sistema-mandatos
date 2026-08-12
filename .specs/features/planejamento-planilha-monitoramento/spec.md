# Planejamento do Contrato / Planilha de Monitoramento Specification

## Problem Statement

Hoje o planejamento estratégico de cada contrato — a hierarquia Objetivo Específico → Meta →
Sucesso Mensal que Gestoras e Assessores atualizam mensalmente — vive em planilha. É, por frequência
de uso, **a tela mais acessada do sistema** (Constituição §5.1/roadmap §6.1): a Assessora do
mandato só tem acesso a essa planilha (não ao resto do sistema), e a Gestora edita a de toda a sua
carteira todo mês. As tabelas já estão desenhadas e aprovadas (`docs/schema_sistema.sql:877-980`,
AD-012) mas nenhuma está provisionada. Pedro pediu explicitamente que, antes de Design, todos os
campos e as diferenças reais entre Estratégia/PLL/Coalizão sejam levantados — não simplificados por
conveniência de UI.

## Goals

- [ ] Provisionar `dim_planejamento` (populada por `operacao-regua-instanciacao`, vazia),
      `rel_planejamento_preditor`, `fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal` e
      `vw_sucesso_mensal`, com RLS herdada corretamente (cadeia de `EXISTS`, não tabelas soltas).
- [ ] Grade editável de Sucessos Mensais (a "Planilha de Monitoramento") via TanStack Table —
      rápida o suficiente para tabulação entre células e edição de várias linhas (risco de adoção
      da AD-028: se for lenta, os Assessores voltam pra planilha de verdade).
- [ ] Cascata de atingimento (Sucesso Mensal → Meta → Objetivo → `dim_planejamento`), usando o
      mecanismo já desenhado no schema (`atingimento_desatualizado`) — sem recálculo síncrono a
      cada tecla.
- [ ] Levantamento completo de campo × produto (Estratégia/PLL/Coalizão), documentado abaixo —
      entrega explícita desta fase Specify, não adiada pra Design.

## Out of Scope

| Item | Reason |
| --- | --- |
| Preditores, agenda temática, perfis de atuação (conteúdo dos catálogos) | Já seedados pela Trilha C — esta feature só referencia, não edita catálogo. |
| GIP (`fat_gip`/`fat_gip_dimensao`) | Tabela separada, fora da hierarquia de Sucessos Mensais — candidata a feature própria depois. |
| Migração do histórico das planilhas legadas (Estratégia 0–1, PLL 0–100) | É INT-04 (Migração das planilhas legadas), projeto descartável e separado — esta feature só cobre entrada de dado nova, não carga retroativa. |
| Tela de gestão de Objetivo/Meta pela Gestora fora da grade (criar/editar hierarquia) | Entra como User Story própria abaixo, mas a reordenação em lote/drag de objetivos fica fora do MVP. |
| Notificação de Sucesso Mensal não atualizado no mês corrente | Isso é G5 (Saída, §6/roadmap), não desta feature — lê o mesmo dado, não escreve aqui. |

---

## Levantamento de campos por produto (exigência de Pedro)

Tabela única, discriminada por produto (AD-012) — **nenhum schema por produto, nenhuma coluna
nova**. O que muda entre Estratégia/PLL/Coalizão está documentado abaixo, campo a campo, distinguindo
o que o schema aprovado já resolve do que ainda não tem resposta.

| Tabela.Campo | Estratégia | PLL | Coalizão (com planejamento próprio) | Coalizão (sem planejamento próprio) |
| --- | --- | --- | --- | --- |
| `dim_planejamento.*` (objetivo_ano, legado, analise_conjuntura, id_perfil_atuacao) | Usa todos | Usa todos — **sem diferença documentada no schema aprovado** | Usa todos, mesma tabela | Não instancia — é visão filtrada por Projeto sobre o planejamento de cada mandato membro (Constituição §2.3/§2.4, OPR-06) |
| `rel_planejamento_preditor` (até 3 preditores prioritários) | Usa | Usa — sem diferença documentada | Usa, mesma tabela | N/A (herda dos membros) |
| `fat_objetivo_especifico.oportunidade`/`ameaca` (SWOT) | Usa | Usa — comentário do schema cita a base de PLL (`f_swot`) como origem histórica do dado, 88%/72% preenchido | Usa, mesma tabela | N/A |
| `fat_meta.id_preditor_secundario` | **Usa** (2 preditores) | **Não usa** — só `id_preditor_primario` (diferença estrutural documentada no schema, `docs/schema_sistema.sql:953`) | Usa (mesma regra de Estratégia, herdada) | N/A |
| `fat_meta.classe` (`programatica`/`governanca`) | Provavelmente usa `'governanca'` — Estratégia tem etapa própria de Governança/Organograma | **Não documentado se PLL usa `'governanca'`** — PLL não tem etapa de Governança na régua (`ref_etapa` seedado só com Pontapé/Imersão/Mentorias) | Herdado de Estratégia | N/A |
| `fat_sucesso_mensal.peso` (escala 0–100, soma 100 por meta) | Escala unificada 0–100 hoje; legado da planilha era 0–1 | Escala unificada 0–100 hoje; legado da planilha já era 0–100 | Mesma regra | N/A |
| `fat_sucesso_mensal.status`/`pct_atingimento` | Usa | Usa | Usa | N/A |

**Diferenças confirmadas pelo schema aprovado** (não são pergunta, são leitura): `id_preditor_secundario`
exclusivo de Estratégia (e Coalizão-com-planejamento-próprio, por herdar a mesma regra).

**Diferenças NÃO documentadas, levantadas nesta spec e sinalizadas para confirmação:** uso de
`classe = 'governanca'` no PLL (provavelmente nunca ocorre, mas nenhum comentário do schema afirma
isso) e qualquer outro campo que a fase Design encontrar ao montar os formulários reais — este
quadro é o ponto de partida, não o fechamento definitivo.

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmada? |
| --- | --- | --- | --- |
| `fat_meta.classe = 'governanca'` no PLL | Tratar como caminho não usado no PLL mas não bloqueado por CHECK — a UI do PLL simplesmente não oferece essa opção no formulário de Meta | Não há CHECK constraint que impeça `'governanca'` fora de Estratégia; sem confirmação, a via mais segura é UI restringindo, não schema restringindo (schema já é aprovado, AD-008) | **y (Pedro, 2026-08-12)** |
| **Cascata de atingimento é assíncrona** (Sucesso Mensal → Meta → Objetivo → `dim_planejamento`) | Ao editar `pct_atingimento` de um Sucesso Mensal, marca `dim_planejamento.atingimento_desatualizado = true` (trigger leve); o recálculo de fato roda ao abrir a tela do planejamento ou em job curto — nunca na mesma transação da edição | É o propósito documentado da própria coluna (`docs/schema_sistema.sql:891-892`: "Evita cascata síncrona quando a Gestora edita 20 sucessos mensais de uma vez") — não é uma escolha desta feature, é leitura do schema aprovado | y |
| **Fórmula exata da cascata Meta → Objetivo → Planejamento** — não documentada no schema (só o nível folha, `peso` de Sucesso Mensal somando 100 por Meta, está definido) | Objetivo.pct_atingimento = média simples (não ponderada) dos `pct_atingimento` de suas Metas ativas (`status = 'ativa'`); `dim_planejamento.pct_atingimento` = média simples dos seus Objetivos | Sem coluna de peso em `fat_objetivo_especifico`/`fat_meta` que sustente uma média ponderada nesses dois níveis — média simples é o default mais defensável até a área de conhecimento definir diferente | **y (Pedro, 2026-08-12)** |
| Quem pode editar o quê na grade | **Revisado**: Assessor escreve **todas as colunas** de `fat_sucesso_mensal` (`pct_atingimento`, `status`, `peso`, `descricao`, `mes_referencia`, `dt_limite`) de um contrato ao qual está vinculado — não só o par `pct_atingimento`/`status` como o draft original propunha. Definição da hierarquia acima (`fat_meta`, `fat_objetivo_especifico`, `dim_planejamento` — Objetivo, Meta, pesos, preditores) continua exclusiva de Gestora/Mentor/Admin, sem mudança. | Decisão explícita do Pedro em 2026-08-12, supersede a leitura literal da jornada A6.1 (que citava só "% dos Sucessos Mensais"): o Assessor é dono operacional da linha de Sucesso Mensal por completo; o que fica fora do alcance dele é a estrutura acima (Meta/Objetivo/Planejamento), não as colunas da própria linha. | **y (Pedro, 2026-08-12) — reverte a AC original da US "Assessor só edita o valor, não a estrutura" (ver abaixo)** |
| Mecanismo pra restringir Assessor à linha de `fat_sucesso_mensal` (sem acesso a `fat_meta`/`fat_objetivo_especifico`/`dim_planejamento`) | RLS de linha (herdada de `p_por_contrato`, já usada em `operacao-regua-instanciacao`) decide **quais linhas**; `GRANT UPDATE` — agora em **todas** as colunas de `fat_sucesso_mensal`, não um subconjunto — decide que a tabela é gravável pelo papel. `fat_meta`/`fat_objetivo_especifico`/`dim_planejamento` seguem sem nenhum `GRANT` de escrita pra `legisla_assessor`. | Evita abrir uma 5ª/6ª exceção à lista fechada da AD-010 — GRANT é mecanismo nativo do Postgres, compatível com a RLS de linha já herdada. Como o escopo de colunas mudou pra "todas", a coluna vira `GRANT UPDATE ON fat_sucesso_mensal TO legisla_assessor` sem lista de colunas (equivalente a liberar todas, mais simples que enumerar). | **y (Pedro, 2026-08-12)** |
| Soma de `peso` fechando 100 por Meta | Validado em `CHECK` a nível de aplicação (trigger ou validação no formulário), não em `CONSTRAINT` de tabela — Postgres não valida `SUM()` de linhas-irmãs em `CHECK` de coluna. Confirmado: **alerta visual, nunca bloqueio** — inclusive agora que o Assessor pode editar `peso` diretamente, o alerta é o único mecanismo que o avisa do desvio, sem travar a edição do dia a dia. | A soma só é conhecida ao ver todos os Sucessos Mensais de uma Meta ao mesmo tempo; `CHECK` de linha não alcança isso | **y (Pedro, 2026-08-12)** |
| UX da grade (tabulação, colar de faixa, edição em massa) | TanStack Table (já instalada, AD-021) com células editáveis controladas; colar de múltiplas células é meta explícita, não "bônus" — é o risco de adoção citado na própria AD-028 | Literal ao texto da AD-028: "tabulação entre células, colar de uma faixa, edição em massa precisam ser rápidos, ou os assessores voltam pra planilha" | n |
| Onde a Coalizão-sem-planejamento-próprio mostra "sua" planilha | Não mostra grade própria — mostra a planilha de Estratégia de cada mandato membro, uma aba/seção por membro, sem agregação nova nesta feature | Consistente com "visão filtrada por Projeto", que já é leitura, não escrita nova | n |

**Open questions:** nenhuma sem dono — as 4 mais sensíveis foram confirmadas pelo Pedro em
2026-08-12 (fórmula de cascata, `classe='governanca'` só via UI, escopo de escrita do Assessor —
**revisado para todas as colunas de `fat_sucesso_mensal`, não só `pct_atingimento`/`status`** — e
validação de soma de peso como alerta). As duas linhas restantes (UX da grade, leitura de Coalizão
sem planejamento próprio) não tiveram dúvida levantada e seguem com o default proposto.

---

## User Stories

### P1: Grade editável de Sucessos Mensais ⭐ MVP

**User Story**: Como Assessora do mandato, quero atualizar o % de atingimento dos Sucessos Mensais
do mês numa grade rápida, célula a célula ou em bloco, sem precisar abrir um formulário por linha.

**Why P1**: É a tela de maior frequência do sistema (roadmap §6.1) — sem ela rápida o bastante, a
AD-028 já registra o risco de os Assessores voltarem pra planilha.

**Acceptance Criteria**:

1. WHEN o usuário abre a grade de um contrato THEN o sistema SHALL listar os Sucessos Mensais do
   mês de referência corrente, agrupados por Meta, com `pct_atingimento`, `status` e `dias_atraso`
   (de `vw_sucesso_mensal`, derivado — nunca digitado).
2. WHEN o usuário edita `pct_atingimento` de uma célula e sai dela (tab/clique fora) THEN o sistema
   SHALL salvar aquela célula sem recarregar a grade inteira.
3. WHEN o usuário seleciona um intervalo de células e cola um valor (ou uma faixa de valores)
   copiada de outra ferramenta THEN o sistema SHALL distribuir os valores nas células
   correspondentes, respeitando a ordem visual da grade.
4. WHEN uma célula recebe um valor fora de 0–100 THEN o sistema SHALL rejeitar a edição e mostrar o
   erro inline, sem salvar o valor inválido (`ck_sucesso_pct` já garante isso no banco; a grade
   SHALL replicar a validação no cliente pra feedback imediato).

**Independent Test**: Editar 5 Sucessos Mensais em sequência via tab, depois colar uma faixa de 3
valores de uma vez; confirmar que `fat_sucesso_mensal` reflete exatamente os valores esperados e
que um valor `150` é rejeitado antes de chegar ao banco.

---

### P1: Assessor escreve o Sucesso Mensal por completo, mas não a estrutura acima ⭐ MVP

**User Story**: Como Admin de segurança, quero que o Assessor consiga atualizar qualquer coluna de
um Sucesso Mensal (`pct_atingimento`, `status`, `peso`, `descricao`, `mes_referencia`, `dt_limite`)
de um contrato ao qual está vinculado, mas não consiga mudar a estrutura de Meta/Objetivo
(descrição, peso agregado, preditor) nem criar/apagar Metas ou Objetivos — isso continua decisão da
Gestora.

**Why P1**: É superfície de escrita nova pro papel Assessor (hoje ele não escreve em nada) — sem
essa restrição, um Assessor poderia reescrever a estrutura de planejamento inteira.

**Revisão (2026-08-12)**: o draft original desta US restringia o Assessor a só
`pct_atingimento`/`status`. Pedro confirmou explicitamente que o escopo correto é a linha inteira de
`fat_sucesso_mensal` — a fronteira de escrita fica entre "a linha de Sucesso Mensal" (Assessor
grava) e "a estrutura acima dela" (Meta/Objetivo/Planejamento, exclusiva de Gestora/Mentor/Admin),
não entre colunas dentro da mesma linha.

**Acceptance Criteria**:

1. WHEN um Assessor tenta `UPDATE` em qualquer coluna de `fat_sucesso_mensal`
   (`pct_atingimento`, `status`, `peso`, `descricao`, `mes_referencia`, `dt_limite`) de um contrato
   ao qual está vinculado THEN o sistema SHALL permitir.
2. WHEN um Assessor tenta qualquer escrita em `fat_meta`, `fat_objetivo_especifico` ou
   `dim_planejamento` THEN o sistema SHALL rejeitar — essas tabelas continuam exclusivas de
   Gestora/Mentor/Admin.
3. WHEN um Assessor tenta `UPDATE`/`INSERT`/`DELETE` em `fat_sucesso_mensal` de um contrato ao qual
   **não** está vinculado THEN o sistema SHALL rejeitar — o `GRANT` de tabela libera a coluna, mas a
   RLS de linha (`p_por_contrato`) continua decidindo o contrato.

**Independent Test**: Como Assessor de teste, tentar `UPDATE` direto (via chamada autenticada) em
todas as colunas de `fat_sucesso_mensal` do contrato vinculado (sucesso esperado), em
`fat_meta`/`fat_objetivo_especifico`/`dim_planejamento` do mesmo contrato (falha esperada) e em
`fat_sucesso_mensal` de um contrato não vinculado (falha esperada).

---

### P1: Cascata de atingimento ⭐ MVP

**User Story**: Como Gestora, ao atualizar vários Sucessos Mensais, quero que o atingimento da Meta,
do Objetivo e do Planejamento reflita isso — sem esperar um recálculo lento a cada célula que edito.

**Why P1**: É o valor que sustenta G5 (Saída) e a visão geral de cada contrato — sem cascata, os
níveis acima da grade ficam sempre desatualizados.

**Acceptance Criteria**:

1. WHEN um Sucesso Mensal é editado THEN o sistema SHALL marcar
   `dim_planejamento.atingimento_desatualizado = true` para o planejamento daquele contrato, sem
   recalcular a cascata inteira na mesma transação.
2. WHEN a tela do planejamento (ou uma job curta) recalcula THEN o sistema SHALL atualizar
   `fat_meta.pct_atingimento` (média ponderada pelo `peso` dos seus Sucessos Mensais),
   `fat_objetivo_especifico.pct_atingimento` (média das Metas ativas) e
   `dim_planejamento.pct_atingimento` (média dos Objetivos), nessa ordem, e então limpar
   `atingimento_desatualizado`.
3. WHEN uma Meta está `status = 'pausada'` ou `'descartada'` THEN o sistema SHALL excluí-la do
   cálculo de `pct_atingimento` do Objetivo — só Metas `'ativa'` contam.

**Independent Test**: Editar 3 Sucessos Mensais de Metas diferentes de um mesmo contrato, abrir a
tela do planejamento e confirmar que os 3 níveis acima batem com o cálculo manual esperado.

---

### P2: Gestão da hierarquia (criar e editar Objetivo/Meta)

**REVISADO (2026-08-12, achado ao entregar P1)**: o texto original desta US só cobria criação —
Pedro apontou, ao revisar a tela entregue, que faltava **editar** o que já existe (nenhum campo era
editável depois de criado, inclusive o SWOT do Objetivo e o responsável/status da Meta, que o schema
já suportava mas o formulário original nunca expôs). Revisado para cobrir o ciclo completo.

**User Story**: Como Gestora, quero criar **e editar** Objetivos Específicos e Metas do planejamento
de um contrato — descrição, preditores, agenda, SWOT (Objetivo) e responsável/status (Meta) — e (quando
Estratégia/Coalizão-com-planejamento-próprio) o preditor secundário.

**Why P2**: É pré-requisito de dado pra US 1 ter o que mostrar, mas a estrutura de um contrato de
teste pode ser inserida via seed/SQL pra desbloquear as ACs de P1 — não é o caminho crítico de
demonstrar a grade em si.

**Acceptance Criteria**:

1. WHEN uma Gestora cria um Objetivo Específico THEN o sistema SHALL exigir descrição e permitir
   preditor primário/secundário/agenda/oportunidade/ameaça, todos opcionais exceto descrição.
2. WHEN o produto do contrato é PLL THEN o formulário de Meta SHALL não oferecer o campo preditor
   secundário — só Estratégia e Coalizão-com-planejamento-próprio o oferecem.
3. WHEN a Gestora tenta salvar um preditor secundário igual ao primário THEN o sistema SHALL
   rejeitar (`ck_meta_preditores`/`ck_objetivo_preditores` já garantem isso no banco).
4. WHEN uma Gestora ou Admin edita um Objetivo Específico existente THEN o sistema SHALL permitir
   alterar descrição, preditores, agenda, oportunidade e ameaça — os mesmos campos da criação.
5. WHEN uma Gestora ou Admin edita uma Meta existente THEN o sistema SHALL permitir alterar
   descrição, classe, prioridade, preditores, agenda, **responsável** (`id_usuario_responsavel`,
   dentre as pessoas vinculadas ao contrato) e **status** (`ativa`/`pausada`/`descartada`) — os dois
   últimos nunca estiveram editáveis antes desta revisão.
6. WHEN um Mentor abre a tela do planejamento THEN o sistema SHALL **não** oferecer os controles de
   criar/editar Objetivo/Meta — o GRANT aprovado só dá `SELECT` a Mentor em `fat_objetivo_especifico`/
   `fat_meta` (`docs/schema_sistema.sql:2084-2089`), então oferecer o botão seria mostrar uma ação
   que sempre falha com `42501`. Achado de bug real: a primeira versão da tela mostrava o botão pro
   Mentor também (mesmo gate de `mentor`/`gestora`/`admin` usado pra escrita de Sucesso Mensal, onde
   Mentor de fato tem `GRANT`) — corrigido nesta revisão.

**Independent Test**: Criar um Objetivo e uma Meta em um contrato de Estratégia (com secundário) e
em um de PLL (sem o campo aparecer); editar um Objetivo já existente alterando o SWOT; editar uma
Meta já existente mudando o responsável e o status pra `pausada`; confirmar que o botão de
criar/editar não aparece pro Mentor.

---

### P2: Editar dados do Planejamento (objetivo do ano, legado, conjuntura, preditores prioritários)

**Achado ao entregar P1 (2026-08-12)**: `dim_planejamento.objetivo_ano`/`legado`/
`analise_conjuntura`/`id_perfil_atuacao` e os até-3 preditores prioritários (`rel_planejamento_preditor`)
fazem parte do "levantamento de campos por produto" do próprio `spec.md` original ("Usa todos" pros
3 produtos) mas nenhuma User Story chegou a pedir uma tela pra eles — lacuna do Specify original, não
scope creep do usuário.

**User Story**: Como Gestora, quero editar o objetivo do ano, o legado, a análise de conjuntura e o
perfil de atuação do planejamento de um contrato, e definir até 3 preditores prioritários — os
campos de topo da hierarquia, acima do primeiro Objetivo Específico.

**Why P2**: Mesma razão da gestão de Objetivo/Meta — estrutura, não a grade do dia a dia.

**Acceptance Criteria**:

1. WHEN uma Gestora ou Admin edita os dados do Planejamento THEN o sistema SHALL permitir
   `objetivo_ano`, `legado`, `analise_conjuntura` (texto livre, opcionais) e `id_perfil_atuacao`
   (seleção de `ref_perfil_atuacao`, opcional).
2. WHEN uma Gestora ou Admin define os preditores prioritários THEN o sistema SHALL permitir até 3,
   sem repetir um preditor já escolhido (`uq_planejamento_preditor_ordem`/PK compostos já garantem
   isso no banco).
3. WHEN um Mentor ou Assessor abre a tela THEN esses campos SHALL aparecer só como leitura — mesmo
   motivo da AC6 da US anterior (`GRANT SELECT` apenas em `dim_planejamento`/`rel_planejamento_preditor`
   pros dois papéis, nenhum `INSERT`/`UPDATE`).

**Independent Test**: Editar objetivo do ano/legado/conjuntura de um planejamento, definir 2
preditores prioritários, recarregar a página e confirmar que persistiu; confirmar que Mentor/Assessor
veem os mesmos campos sem conseguir editá-los.

---

### P2: Gerenciar Sucesso Mensal por completo (criar novo mês, editar detalhes)

**Achado ao entregar P1 (2026-08-12)**: a grade (US 1) só edita `pct_atingimento` de Sucessos Mensais
que **já existem** para o mês corrente — não existia nenhuma forma de criar um Sucesso Mensal novo
(pra um mês futuro, ou a estrutura inicial de uma Meta) nem de corrigir `peso`/`descrição`/
`mes_referencia`/`dt_limite` depois de criado. O Edge Case "a UI SHALL sempre oferecer seletor de
mês, nunca campo de data livre" do `spec.md` original já antecipava que create existiria — só nunca
virou User Story própria.

**User Story**: Como Gestora ou Mentor, quero criar um novo Sucesso Mensal pra uma Meta (mês,
descrição, peso, prazo); como qualquer papel com permissão de escrita na linha (Gestora/Mentor/Admin
em qualquer contrato, Assessor no seu contrato vinculado), quero editar peso, descrição, mês de
referência, prazo e status de um Sucesso Mensal existente — fora da edição rápida de % na grade.

**Why P2**: A grade (P1) cobre o uso diário (bater o %); esta US cobre a montagem/correção da
estrutura por trás dela — mesma relação que Objetivo/Meta tem com a US anterior.

**Acceptance Criteria**:

1. WHEN uma Gestora ou Mentor cria um novo Sucesso Mensal THEN o sistema SHALL exigir mês de
   referência (seletor de mês, nunca campo de data livre — `ck_sucesso_mes` exige dia 1), descrição
   e peso, com prazo (`dt_limite`) opcional.
2. WHEN um Assessor tenta criar um novo Sucesso Mensal THEN o sistema SHALL **não** oferecer a ação
   — o GRANT aprovado do Assessor em `fat_sucesso_mensal` é só `SELECT, UPDATE`
   (`docs/schema_sistema.sql:2093`), sem `INSERT`.
3. WHEN qualquer papel com `GRANT UPDATE` na linha (Gestora/Admin em qualquer uma, Mentor/Assessor
   só na do próprio contrato vinculado) abre o detalhe de um Sucesso Mensal existente THEN o sistema
   SHALL permitir editar peso, descrição, mês de referência, prazo e status — os mesmos campos que a
   decisão do Pedro de 2026-08-12 já autorizou pro Assessor gravar, só sem superfície de UI até agora.

**Independent Test**: Criar um Sucesso Mensal novo pra um mês futuro numa Meta existente; abrir o
detalhe de um Sucesso Mensal já existente e editar peso/descrição/prazo/status; confirmar que
Assessor não vê o botão de criar, mas vê e usa o de editar detalhes na sua própria carteira.

---

## Edge Cases

- WHEN a soma dos `peso` dos Sucessos Mensais de uma Meta não fecha 100 (erro de cadastro) THEN o
  sistema SHALL alertar visualmente na tela de gestão da hierarquia, mas SHALL não bloquear a
  edição de `pct_atingimento` individual — o alerta é sobre a estrutura, não sobre o uso diário.
- WHEN um contrato de Coalizão sem planejamento próprio é aberto nesta tela THEN o sistema SHALL
  mostrar a leitura agregada dos mandatos membros, nunca um formulário de criação de Objetivo (não
  existe `dim_planejamento` própria pra escrever).
- WHEN `mes_referencia` de um novo Sucesso Mensal não é o primeiro dia do mês THEN o sistema SHALL
  rejeitar (`ck_sucesso_mes` já garante isso no banco) — a UI SHALL sempre oferecer seletor de mês,
  nunca campo de data livre, pra não gerar esse erro na prática.
- WHEN dois usuários editam Sucessos Mensais diferentes da mesma Meta ao mesmo tempo THEN cada
  edição SHALL salvar independentemente — não há lock de Meta inteira, só de célula.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PLM-01 | P1: Grade — leitura agrupada por Meta | Execute | ✅ Verified |
| PLM-02 | P1: Grade — edição célula a célula | Execute | ✅ Verified |
| PLM-03 | P1: Grade — colar em faixa | Execute | ✅ Verified |
| PLM-04 | P1: Grade — validação 0–100 no cliente e no banco | Execute | ✅ Verified |
| PLM-05 | P1: GRANT — Assessor escreve todas as colunas de `fat_sucesso_mensal` (linha vinculada) | Execute | ✅ Verified |
| PLM-06 | P1: RLS/GRANT — Assessor bloqueado em Meta/Objetivo/Planejamento e em contrato não vinculado | Execute | ✅ Verified |
| PLM-07 | P1: Cascata — marca desatualizado, sem recálculo síncrono | Execute | ✅ Verified |
| PLM-08 | P1: Cascata — fórmula Meta→Objetivo→Planejamento | Execute | ✅ Verified |
| PLM-09 | P1: Cascata — só Metas ativas contam | Execute | ✅ Verified |
| PLM-10 | P2: Criar Objetivo Específico | Execute | ✅ Verified |
| PLM-11 | P2: Meta — preditor secundário condicional ao produto | Execute | ✅ Verified |
| PLM-12 | P2: Editar Objetivo Específico existente (descrição/preditores/agenda/SWOT) | Execute | Implementing |
| PLM-13 | P2: Editar Meta existente (descrição/classe/prioridade/preditores/agenda/responsável/status) | Execute | Implementing |
| PLM-14 | P2: Gate de papel — Mentor não vê criar/editar Objetivo/Meta (sem GRANT) | Execute | Implementing (corrige bug real de T15) |
| PLM-15 | P2: Editar dados do Planejamento (objetivo_ano/legado/analise_conjuntura/perfil de atuação) | Execute | Implementing |
| PLM-16 | P2: Preditores prioritários do Planejamento (até 3) | Execute | Implementing |
| PLM-17 | P2: Criar novo Sucesso Mensal (mês/descrição/peso/prazo) | Execute | Implementing |
| PLM-18 | P2: Editar detalhes de Sucesso Mensal existente (peso/descrição/mês/prazo/status) | Execute | Implementing |

**Coverage:** 11/11 da rodada P1 `✅ Verified` (Verifier independente, 2 rodadas, PASS —
`validation.md`). PLM-12 a PLM-18 são a extensão pedida por Pedro em 2026-08-12 ("cadê a tela de
CRUD do planejamento com todos os campos") — implementadas (T18-T27), aguardando Verifier
independente desta rodada.

**ID format:** `PLM-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

---

## Success Criteria

- [ ] Uma Assessora de teste edita 5+ Sucessos Mensais numa sessão sem perceber lentidão perceptível
      (critério qualitativo da AD-028 — vira UAT manual, não teste automatizado).
- [ ] Assessor de teste não consegue alterar estrutura (Meta/Objetivo/peso) por nenhum caminho, só
      `pct_atingimento`/`status`, comprovado por teste de integração.
- [ ] Cascata calculada bate com verificação manual em pelo menos 2 contratos de teste (um
      Estratégia com preditor secundário, um PLL sem).
- [ ] Quadro de campo × produto deste `spec.md` é a referência usada em Design — nenhum campo novo
      aparece na UI sem estar listado aqui ou justificado como achado novo.
