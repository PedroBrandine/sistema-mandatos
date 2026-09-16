# Planejamento Estratégico v2 Specification

- **Gate AD-039:** ✅ satisfeito — Pedro validou as telas com a operação antes desta spec (2026-09-15).

## Problem Statement

A tela de planejamento entregue por `planejamento-estrategico-redesenho`
(PLR-01..PLR-16, Verifier PASS) resolveu a mecânica de grade, mas Pedro
redesenhou a apresentação em set/2026: KPIs no topo, filtro por Objetivo,
árvore com classificações visíveis na própria linha da Meta, e os três
formulários viram modais focados.

O redesenho também trouxe **cinco capacidades que o schema ainda não tem** —
status no Objetivo, responsável no Sucesso Mensal, criação de SM em lote,
reordenação de SM e movimentação de itens na hierarquia. Todas decididas com
Pedro antes desta spec (ver `context.md`), porque migration aqui é
forward-only e um campo desenhado errado vira coluna errada em produção.

A revisão de mockup (gate `figma-dominio-legisla`) achou **17 divergências** —
10 de vocabulário, 3 de campo obrigatório ausente, 4 de regra de apresentação.
Esta spec já nasce com o vocabulário canônico; o mockup é que precisa ser
corrigido, não o contrário.

## Goals

- [ ] Tela `227:194` em pé: 4 KPIs, filtro por Objetivo Específico, árvore-grade
      com classificações na linha da Meta, rodapé de auditoria por Meta.
- [ ] Três modais (`271:808`, `271:724`, `271:856`) substituindo os formulários
      atuais, com **todos** os campos obrigatórios presentes — inclusive Peso e
      Mês de referência, hoje ausentes do desenho.
- [ ] Vocabulário canônico em 100% dos rótulos, badges e selects: zero termo que
      não exista em `docs/schema_sistema.sql` ou nos enums.
- [ ] `%` editável **apenas** no Sucesso Mensal; Meta, Objetivo e Planejamento
      recebem por cascata e aparecem travados (hachura + `fx`, AD-003/PLR-10).
- [ ] Cinco mudanças de schema aplicadas por migrations forward-only, incluindo
      a emenda a `app.recalcula_atingimento` exigida pelo status do Objetivo.
- [ ] Gráfico Evolução mensal respondendo **"quanto avancei no mês X?"** —
      curvas Esperado × Atingido derivadas do peso, mais o avanço do mês.
- [ ] Tela em duas abas: **Diagnóstico (Análise de Conjuntura)** e
      **Construir a estrutura**.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Job de fechamento mensal (`fat_snapshot_mensal`, AD-015) | A série histórica nesta feature é **derivada** (PLV-13). O snapshot congelado é feature própria de Saída, retomada quando for preciso auditar o que foi reportado num mês passado |
| **Reordenar itens arrastando (ex-PLV-10)** | **Cortado em 2026-09-16, decisão de Pedro**: não é preciso mover itens nesta página. Cortada junto a coluna `ordem` em `fat_sucesso_mensal`, que existia só para servi-lo — migration é forward-only, e coluna sem consumidor só sairia com outro arquivo depois. Objetivo e Meta mantêm as colunas `ordem` que **já tinham**; a grade ordena SM por `mes_referencia`. O texto "Arraste os itens para reordenar" do mockup **não é renderizado** |
| Rever a fórmula da cascata (`COALESCE(...,0)` conta SM vazio como 0) | Comportamento aprovado e testado em produção. A única mudança autorizada na função é o filtro de status do Objetivo (PLV-02) |
| SWOT no Objetivo Específico | Removido do produto (AD-049). A coluna segue no banco com dado histórico, o que **não** autoriza redesenhar o campo |
| Agenda temática com valores reais | `ref_agenda_tematica` está vazia de propósito (CAT-16, levantamento humano pendente). O select existe, marcado como catálogo pendente |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Status do Objetivo espelha a Meta | `ativo/pausado/descartado` (masculino) | A Meta usa feminino; concordância importa no rótulo | y |
| Objetivo não-ativo sai da média do Planejamento | `app.recalcula_atingimento` ganha `AND o.status = 'ativo'` no nível raiz | Espelha o que o nível 2 já faz com Metas. Sem isso, "pausar" um objetivo não teria efeito nenhum no número | y |
| SM sem responsável próprio | Exibe o da Meta, marcado como herdado; ausência de ambos é `—` | AD-005 | y |
| Criação em lote de SM | N meses marcados → N registros irmãos independentes, sem vínculo persistido | Decisão de Pedro: é conveniência de cadastro, não modelo novo | y |
| Edição de SM existente | Seletor de **um** mês; a grade múltipla só aparece na criação | Um SM já criado pertence a um mês só | y |
| Coluna ATRASO | View: `dt_limite < current_date AND status = 'pendente'`, dias corridos. Sem `dt_limite` → `—` | AD-003 (sai de view) + AD-005 (sem sentinela) | n |
| "METAS PRIORITÁRIAS 3 de 7" | Denominador = Metas ativas; numerador = ativas com `prioridade = 'alta'` | Única leitura que fecha com a legenda "4 em alta prioridade" | n |
| Série "Esperado" do gráfico | Derivada do **peso**: fração do peso total cujo `mes_referencia` já chegou | O peso já é obrigatório e já é o que pondera a cascata — nenhuma coluna nova, e a curva sobe como o mockup desenha | y |
| Curva reescreve o passado | Aceito. `pct_atingimento` é valor atual; editar um SM antigo move o ponto daquele mês | Decisão de Pedro: curva viva agora, `fat_snapshot_mensal` (AD-015) como feature de Saída depois | y |
| Filtro "Assessores" do gráfico | Filtra por `id_usuario_responsavel` do Sucesso Mensal, com `P` recalculado sobre o subconjunto | Só é possível porque PLV-03 cria a coluna. Sem ela o filtro não teria por onde | y |
| Aba Diagnóstico | Reapresenta `contexto-estrategico.tsx` (PLR-05), não constrói campo novo | Os 3 campos já existem em `dim_planejamento` com formulário pronto | y |

**Open questions:** nenhuma — as duas linhas com `Confirmed? = n` são
assunções registradas com default escolhido, não pendências bloqueantes.

---

## User Stories

### P1: Vocabulário canônico em toda a tela ⭐ MVP

**User Story**: Como Gestora, quero que cada rótulo, badge e opção de select use
o termo que o sistema realmente grava, para que o que eu leio na tela seja o que
está no banco.

**Why P1**: É o gate do projeto. Termo inventado vira spec errada e custa
migration em produção — e este mockup reincidiu em erros já catalogados.

**Acceptance Criteria**:

1. WHEN a tela exibe o status de uma Meta THEN o sistema SHALL usar exatamente
   **Ativa**, **Pausada** ou **Descartada** — nunca "Em planejamento".
2. WHEN a tela exibe a classificação binária da Meta THEN o sistema SHALL
   rotulá-la **Classe** com valores **Programática** ou **Governança** — nunca
   "Tipo", nunca "Institucional", "Comunicação" ou "Presencial".
3. WHEN o contrato é do produto **PLL** THEN o select de Classe SHALL omitir
   **Governança**.
4. WHEN a tela exibe os campos de preditor THEN o sistema SHALL rotulá-los
   **Preditor primário** e **Preditor secundário**, e SHALL oferecer somente as
   5 frases de `ref_preditor`, sem abreviar.
5. WHEN o usuário escolhe um Preditor secundário sem primário preenchido THEN o
   sistema SHALL manter o select do secundário desabilitado, e SHALL omitir do
   secundário o valor já escolhido no primário (`ck_*_preditores`).
6. WHEN a tela exibe o status de um Sucesso Mensal THEN o sistema SHALL usar
   **Pendente**, **Realizado** ou **Não realizado**.
7. WHEN a tela exibe um percentual de atingimento THEN o rótulo SHALL ser
   **% de atingimento** — nunca "Progresso" nem "% concluído".
8. WHEN qualquer campo está vazio THEN o sistema SHALL exibir `—` (AD-005).
9. WHEN o select de Agenda temática é aberto THEN o sistema SHALL apresentá-lo
   como catálogo pendente (CAT-16), sem oferecer valor de exemplo.

**Independent Test**: abrir a tela com um contrato semeado e conferir cada
rótulo/badge contra `references/glossario-campos.md`; nenhum termo fora da lista.

---

### P1: Modais completos de Objetivo, Meta e Sucesso Mensal ⭐ MVP

**User Story**: Como Gestora, quero editar cada nível da hierarquia num modal
focado que contenha **todos** os campos do registro, para não precisar salvar um
item incompleto.

**Why P1**: O mockup perdeu três campos obrigatórios. Sem Peso, o `INSERT`
estoura `NOT NULL` e a cascata não fecha.

**Acceptance Criteria**:

1. WHEN o modal de Sucesso Mensal abre THEN o sistema SHALL exibir campo
   **Peso (0–100)**, obrigatório, e SHALL bloquear o salvamento sem ele.
2. WHEN o modal de Sucesso Mensal abre THEN o sistema SHALL exibir
   **Mês de referência** distinto de **Prazo (opcional)** — são campos
   diferentes (`mes_referencia` e `dt_limite`).
3. WHEN o usuário escolhe o mês de referência THEN o seletor SHALL oferecer
   mês/ano (`set/2026`), nunca um datepicker de dia, e SHALL gravar dia 1
   (`ck_sucesso_mes`).
4. WHEN o modal de Objetivo Específico abre THEN o sistema SHALL exibir
   **Descrição do Objetivo**, **Preditor primário**, **Preditor secundário**,
   **Agenda temática** e **Status** — e SHALL NOT exibir Oportunidade ou Ameaça
   (AD-049).
5. WHEN o modal de Meta abre THEN o sistema SHALL exibir Descrição, Vinculação,
   Responsável, Preditores, Agenda temática, Prioridade, Classe e Status.
6. WHEN o modal exibe o **% de atingimento** de Meta ou Objetivo THEN a célula
   SHALL ser não-focável por Tab, sem clique, com fundo hachurado e marcador
   `fx` (AD-003, PLR-10).
7. WHEN o modal de Sucesso Mensal exibe o **% de atingimento** THEN o campo
   SHALL ser **editável** — é o único nível onde o número é digitado.
8. WHEN o usuário pressiona Esc THEN o modal SHALL fechar e devolver o foco ao
   elemento que o abriu.

**Independent Test**: criar um Sucesso Mensal pelo modal informando só a
descrição; o salvamento é recusado citando Peso e Mês de referência.

---

### P1: Status no Objetivo Específico ⭐ MVP

**User Story**: Como Gestora, quero pausar ou descartar um Objetivo inteiro sem
apagá-lo, para tirar do número do plano o que saiu da mesa sem perder o histórico.

**Why P1**: É campo do modal desenhado e não existe no banco — sem ele o modal
não fecha.

**Acceptance Criteria**:

1. WHEN a migration é aplicada THEN `fat_objetivo_especifico` SHALL ter
   `status TEXT NOT NULL DEFAULT 'ativo'` restrito a
   `ativo | pausado | descartado`.
2. WHEN `app.recalcula_atingimento` roda THEN o nível raiz SHALL considerar
   **somente** Objetivos com `status = 'ativo'` na média do Planejamento.
3. WHEN um Objetivo passa a não-ativo THEN o sistema SHALL marcar o
   planejamento como `atingimento_desatualizado = true`.
4. WHEN todos os Objetivos de um plano estão não-ativos THEN o
   `pct_atingimento` do Planejamento SHALL ser `NULL`, exibido `—` — nunca `0%`.

**Independent Test**: plano com 2 objetivos (100% e 0%) marca 50%; pausar o de
0% e recalcular leva o plano a 100%.

---

### P1: Responsável por Sucesso Mensal ⭐ MVP

**User Story**: Como Gestora, quero atribuir cada Sucesso Mensal a uma pessoa
distinta da responsável pela Meta, para que a coluna RESP. da grade reflita quem
de fato toca aquela entrega.

**Why P1**: A tela mostra avatares diferentes por linha (JM, MS, CR) — o
desenho depende disso.

**Acceptance Criteria**:

1. WHEN a migration é aplicada THEN `fat_sucesso_mensal` SHALL ter
   `id_usuario_responsavel` referenciando `dim_usuario`, sem substituir
   `atualizado_por` (auditoria, AD-006).
2. WHEN o SM tem responsável próprio THEN a grade SHALL exibi-lo.
3. WHEN o SM não tem responsável próprio THEN a grade SHALL exibir o da Meta,
   visualmente marcado como herdado.
4. WHEN nem o SM nem a Meta têm responsável THEN a grade SHALL exibir `—`.
5. WHEN o picker é aberto THEN SHALL oferecer somente usuários com vínculo
   ativo no contrato.

**Independent Test**: criar 2 SMs na mesma Meta, atribuir responsável só ao
primeiro; a grade mostra pessoas diferentes, a segunda marcada como herdada.

---

### P1: Criação de Sucessos Mensais em lote ⭐ MVP

**User Story**: Como Gestora, quero marcar vários meses ao criar um Sucesso
Mensal que se repete, para não cadastrar o mesmo item doze vezes.

**Why P1**: É a razão de existir da grade de meses do modal.

**Acceptance Criteria**:

1. WHEN o modal está em modo **criação** THEN a grade de meses SHALL permitir
   seleção múltipla.
2. WHEN o usuário salva com N meses marcados THEN o sistema SHALL criar
   **N registros** em `fat_sucesso_mensal`, um por mês, com a mesma descrição,
   o mesmo peso e o mesmo responsável.
3. WHEN os N registros são criados THEN cada um SHALL ser independente: editar
   um SHALL NOT alterar os demais.
4. WHEN o modal está em modo **edição** THEN o seletor SHALL ser de **um** mês.
5. WHEN nenhum mês está marcado THEN o salvamento SHALL ser recusado.
6. WHEN a criação em lote termina THEN a cascata SHALL rodar **uma vez** para o
   planejamento, não N vezes.

**Independent Test**: criar um SM marcando Jul/Ago/Set; a grade passa a mostrar
3 linhas, e mudar o % de uma não mexe nas outras.

---

### P2: Mover itens na hierarquia

**User Story**: Como Gestora, quero mover uma Meta para outro Objetivo (e um
Sucesso Mensal para outra Meta) pelo próprio modal, para corrigir a estrutura
sem apagar e recriar.

**Why P2**: Melhora real de operação, mas a tela funciona sem isso — hoje o
caminho é apagar e recriar.

**Acceptance Criteria**:

1. WHEN o usuário muda a Vinculação de uma Meta THEN o sistema SHALL atualizar
   `id_objetivo` e SHALL marcar origem **e** destino como desatualizados.
2. WHEN o usuário muda a Vinculação de um Sucesso Mensal THEN o sistema SHALL
   atualizar `id_meta` e marcar as duas Metas envolvidas.
3. WHEN o modal de Sucesso Mensal exibe o Objetivo THEN SHALL ser **leitura**,
   derivado da Meta — nunca select editável.
4. WHEN o destino escolhido pertence a outro contrato THEN o sistema SHALL
   recusar a operação.

**Independent Test**: mover uma Meta de 100% do Objetivo A para o B; os dois
objetivos ficam marcados como desatualizados e recalculam corretamente.

---

### P2: KPIs e filtro por Objetivo

**User Story**: Como Gestora, quero ver o estado do plano em quatro números e
poder filtrar a árvore por Objetivo.

**Acceptance Criteria**:

1. WHEN a tela carrega THEN SHALL exibir Atingimento total do plano, Metas
   prioritárias, Sucessos Mensais e Fatos Geradores.
2. WHEN os KPIs são calculados THEN SHALL vir de view (AD-003) — nunca de
   agregação no cliente.
3. WHEN o usuário clica num card de Objetivo THEN a árvore SHALL filtrar para
   aquele Objetivo, e o card SHALL indicar o estado ativo.
4. WHEN o plano não tem nenhuma Meta THEN os KPIs SHALL exibir `—`, não `0`.

**Independent Test**: contrato sem metas mostra `—` em todos os KPIs.

---

### P1: Evolução mensal — Esperado × Atingido ⭐ MVP

**User Story**: Como Gestora, quero ver a curva do que era esperado contra o que
foi atingido mês a mês, para responder **"quanto eu avancei no mês X?"** sem
montar planilha.

**Why P1**: É a pergunta que Pedro faz mensalmente. Sem isso a tela mostra o
estado atual mas não o movimento.

**Definição das séries** — `P` = soma dos pesos de todos os Sucessos Mensais
ativos do plano:

```
Esperado(M)  =  Σ peso  dos SM com mes_referencia ≤ M                  ÷ P × 100
Atingido(M)  =  Σ (peso × pct_atingimento/100) dos SM com mes_ref ≤ M  ÷ P × 100
Avanço(M)    =  Atingido(M) − Atingido(M−1)
```

**Acceptance Criteria**:

1. WHEN o gráfico é renderizado THEN SHALL exibir duas séries acumuladas,
   **Esperado** e **Atingido**, uma por mês do período.
2. WHEN as séries são calculadas THEN SHALL vir de view (AD-003) — nunca de
   agregação no cliente.
3. WHEN o usuário inspeciona um mês THEN o sistema SHALL exibir o **avanço
   daquele mês** (`Atingido(M) − Atingido(M−1)`), não apenas o acumulado.
4. WHEN um Sucesso Mensal pertence a uma Meta **não-ativa** THEN SHALL ser
   excluído das duas séries, coerente com a cascata (`mm.status = 'ativa'`).
5. WHEN o filtro de responsável é aplicado THEN as duas séries SHALL considerar
   apenas SMs daquele responsável, com o mesmo `P` recalculado sobre o
   subconjunto.
6. WHEN um SM não tem `pct_atingimento` THEN SHALL contar como 0 no Atingido,
   coerente com `COALESCE(...,0)` da cascata já aprovada.
7. WHEN `P` é 0 (nenhum SM, ou todos com peso 0) THEN o gráfico SHALL exibir
   estado vazio explícito — nunca uma linha em 0%.
8. WHEN o plano tem SMs em meses futuros THEN a curva Esperado SHALL se
   estender até o último mês com SM, e a Atingido SHALL parar no mês corrente.

**Independent Test**: plano com 2 SMs de peso 50 (ago e set), o de agosto a
100% e o de setembro a 0% — Esperado(ago)=50, Atingido(ago)=50,
Esperado(set)=100, Atingido(set)=50, Avanço(set)=0.

> **Limite conhecido e aceito** (decisão de Pedro, 2026-09-15): `pct_atingimento`
> guarda o valor **atual**, não o histórico. Preencher hoje o % de um SM de
> agosto **muda o ponto de agosto**. A curva reflete o melhor conhecimento
> presente, não o que foi reportado na época. Série congelada exige
> `fat_snapshot_mensal` (AD-015), que é feature própria de Saída — fora daqui.

---

### P1: Aba Diagnóstico (Análise de Conjuntura) ⭐ MVP

**User Story**: Como Gestora, quero ler e editar o contexto estratégico do plano
numa aba própria, separada da estrutura de objetivos.

**Why P1**: É a primeira aba da tela desenhada (`57:671`) — o usuário cai nela.

**Nota de custo**: os três campos **já existem** em `dim_planejamento` e já têm
formulário (`contexto-estrategico.tsx` / `DadosPlanejamentoForm`, entregues em
PLR-05). Esta story **reapresenta**, não constrói do zero.

**Acceptance Criteria**:

1. WHEN a aba **Diagnóstico (Análise de Conjuntura)** abre THEN SHALL exibir
   **Legado**, **Objetivo do ano** e **Análise de conjuntura**, cada um em seu
   cartão com ação **Editar**.
2. WHEN o contrato é do produto **PLL** THEN SHALL exibir também
   **Perfil de atuação** (Fiscalizadora · Legisladora · Articuladora/Mobilizadora);
   nos demais produtos SHALL omiti-lo (comportamento já existente).
3. WHEN um campo está vazio THEN o cartão SHALL exibir `—` (AD-005) e manter a
   ação Editar disponível — nunca esconder o cartão.
4. WHEN o usuário está em modo **Ler** THEN a ação Editar SHALL estar ausente.
5. WHEN a aba **Construir a estrutura** é selecionada THEN SHALL exibir a
   árvore-grade, e a aba ativa SHALL persistir na navegação.

**Independent Test**: plano sem `legado` preenchido mostra o cartão com `—` e o
botão Editar funcionando.

---

### P3: Coluna de atraso

**User Story**: Como Gestora, quero ver quantos dias um Sucesso Mensal está
atrasado.

**Acceptance Criteria**:

1. WHEN `dt_limite < current_date` E status é **Pendente** THEN a coluna SHALL
   exibir os dias corridos de atraso, com destaque coral.
2. WHEN o SM não está atrasado ou não tem `dt_limite` THEN SHALL exibir `—`.
3. WHEN o valor é calculado THEN SHALL vir de view (AD-003).

---

## Edge Cases

- WHEN uma Meta não tem nenhum Sucesso Mensal THEN `pct_atingimento` SHALL ser
  `NULL`, exibido `—` — nunca `0%`.
- WHEN a soma dos pesos dos SMs de uma Meta é 0 THEN a cascata SHALL deixar o %
  da Meta como `NULL` (comportamento atual do `CASE WHEN SUM(peso) > 0`).
- WHEN o usuário cola um valor com vírgula ou sufixo `%` numa célula de % THEN
  o sistema SHALL normalizar (`normalizaEntradaPct`, já existente).
- WHEN a criação em lote é interrompida no meio THEN o sistema SHALL não deixar
  registros parciais — a operação é atômica.
- WHEN dois usuários editam o mesmo Sucesso Mensal ao mesmo tempo THEN a última
  escrita vence, e `atualizado_por`/`atualizado_em` SHALL registrar quem foi.
- WHEN a RLS nega a escrita THEN o erro SHALL aparecer via `ErroInline` (L-008).
- WHEN um Objetivo descartado tem Metas ativas THEN as Metas SHALL continuar
  editáveis, mas fora do número do plano.

---

## Requirement Traceability

| ID | Story | Fase | Status |
| --- | --- | --- | --- |
| PLV-01 | P1: Vocabulário canônico | Design | Pending |
| PLV-02 | P1: Status no Objetivo (coluna + emenda à cascata) | Design | Pending |
| PLV-03 | P1: Responsável no Sucesso Mensal | Design | Pending |
| PLV-04 | P1: Peso e Mês de referência nos modais | Design | Pending |
| PLV-05 | P1: % editável só no SM; travado nos demais | Design | Pending |
| PLV-06 | P1: Criação de SM em lote | Design | Pending |
| PLV-07 | P1: Modal de Objetivo completo, sem SWOT | Design | Pending |
| PLV-08 | P1: Modal de Meta completo | Design | Pending |
| PLV-09 | P2: Mover Meta/SM na hierarquia | Tasks (T10, T14, T20) | Pending |
| ~~PLV-10~~ | ~~Coluna `ordem` no SM + arrastar~~ | **Cortado 2026-09-16** | Out of Scope |
| PLV-11 | P2: KPIs de view + filtro por Objetivo | Tasks (T7, T21, T22) | Pending |
| PLV-12 | P3: Coluna de atraso | Tasks (T4, T9, T23) | Pending |
| PLV-13 | P1: Evolução mensal (Esperado × Atingido + avanço do mês) | Tasks (T4, T8, T11, T25) | Pending |
| PLV-14 | P1: Aba Diagnóstico (contexto estratégico reapresentado) | Tasks (T15, T16) | Pending |

**Coverage:** 13 ativos (PLV-10 cortado), 13 mapeados a tasks, 0 não mapeados ✅

---

## Success Criteria

- [ ] Zero termo fora de `references/glossario-campos.md` em rótulo, badge ou
      select — conferido item a item na revisão final.
- [ ] Nenhum Sucesso Mensal pode ser salvo sem Peso e Mês de referência.
- [ ] `%` só aceita digitação no Sucesso Mensal; nos outros três níveis a
      célula não recebe foco por Tab nem responde a clique.
- [ ] Pausar um Objetivo muda o número do plano (prova de que PLV-02 fechou
      ponta a ponta, da migration à tela).
- [ ] Criar um SM em 6 meses gera 6 registros independentes e dispara **uma**
      cascata.
- [ ] A pergunta "quanto avancei em setembro?" é respondida em um clique, com o
      número do mês — não só o acumulado.
- [ ] `drift-check` verde nos dois ambientes após as migrations.

---

## Nota de verificação

**Corrigido em 2026-09-15.** A versão anterior desta seção dizia que o projeto
não tem harness de teste de componente, citando L-006/L-007. **Está
desatualizada**: AD-042 (2026-09-10) provisionou `@testing-library/react` +
`jsdom`, e `vitest.config.ts` já coleta `src/frontend/**/*.test.tsx` com
`environmentMatchGlobs`. As dependências vivem no `package.json` da **raiz**
(AD-044), não no do frontend.

O que isso impõe a esta feature, pela AD-042 ativa:

> "Critério de aceite que descreve comportamento de tela só conta como pronto
> com teste de componente passando; **leitura de código deixa de ser evidência
> suficiente** para AC de UI."

A profundidade reduzida da AD-046 (só caminho feliz em telas de leitura)
**não se aplica aqui** — ela é explicitamente restrita a
`redesenho-estrategia-tela-first` e diz "não se aplica a nenhuma feature futura
sem decisão própria". Portanto, para esta feature vale a profundidade integral:
os dois lados de cada condicional, estado vazio e estado de erro.

Isso pesa mais nesta feature do que em telas de leitura, porque aqui **quase
tudo é escrita** — modais, grade editável, criação em lote, reparent. É
exatamente o escopo onde AD-046 manteve a profundidade integral mesmo durante o
corte de ritmo.

Continua valendo a boa prática de extrair regra para função pura testável
(normalização de %, cálculo de atraso, responsável herdado, expansão do lote de
meses, ordenação com desempate, séries do gráfico) — mas agora como escolha de
design, não como substituto de teste de render.
