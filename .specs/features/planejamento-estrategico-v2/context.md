# Planejamento Estratégico v2 — Context

**Gathered:** 2026-09-15
**Spec:** `.specs/features/planejamento-estrategico-v2/spec.md` (ainda não escrito — bloqueado pelas decisões abertas abaixo)
**Status:** Revisão de mockup concluída · aguardando decisão de Pedro nos itens D-1 a D-4

---

## Feature Boundary

Redesenho da tela `/contratos/[id]/planejamento` e dos três modais de edição
(Objetivo Específico, Meta, Sucesso Mensal), a partir das telas do Figma de
set/2026.

**Telas de origem:**

| Nó Figma | Tela |
| --- | --- |
| `227:194` | Planejamento Estratégico — KPIs, filtro por objetivo, árvore-grade, evolução mensal |
| `271:808` | Modal Editar Objetivo Específico |
| `271:724` | Modal Editar Meta |
| `271:856` | Modal Editar Sucesso Mensal |

**O que este redesenho supersede:** a apresentação entregue por
`planejamento-estrategico-redesenho` (PLR-01..PLR-16, Verifier PASS). Nenhum
contrato de backend daquela feature muda, salvo onde uma decisão abaixo disser
o contrário. A cascata `app.recalcula_atingimento` e a RLS herdada seguem
intactas.

---

## Revisão de mockup (gate `figma-dominio-legisla`, modo 3)

Percorrido o checklist da skill. **17 divergências**, separadas por natureza.

### A. Termo inventado — o canônico vence, corrige no desenho e na spec

Nenhuma destas precisa de decisão: o banco já decidiu.

| Tela | Veio assim | É assim | Prova |
| --- | --- | --- | --- |
| `227:194`, `271:724`, `271:808` | Status de Meta **"Em planejamento"** | **Ativa · Pausada · Descartada** | `ck_meta_status` |
| `227:194`, `271:724` | **"Tipo: Institucional"** | O campo é **Classe**: Programática · Governança | `ck_meta_classe` |
| `227:194` | Chips de Classe **"Comunicação"**, **"Presencial"** | Não existem. "Presencial" é **Canal de Registro**, outra entidade | `ck_meta_classe` |
| `271:724` | **"Predicado 1º" / "Predicado 2º"** | **Preditor primário / Preditor secundário** | `fat_meta.id_preditor_primario/_secundario` |
| `227:194`, `271:724` | Preditores **"Articulação Política"**, **"Visibilidade Pública"**, **"Entrega de Resultados"**, **"Construindo o Partido"** | As 5 frases do catálogo: *Priorizam sua Agenda · Pautam os Debates · Ocupam lugar nos espaços de decisão · Constroem Partido · Articulam e mobilizam para a entrega de resultados* | seed `20260810193327` |
| `227:194`, `271:724` | Agenda **"Segurança Pública"**, **"Educação e Primeira Infância"** | Rótulo certo (**Agenda temática**), valores inventados — catálogo **vazio de propósito** (CAT-16) | `ref_agenda_tematica` |
| `227:194`, `271:724`, `271:856` | Status de Sucesso Mensal **"Em andamento"**, **"Concluído"** | **Pendente · Realizado · Não realizado** | `ck_sucesso_status` |
| `271:724`, `271:856`, `227:194` | Rótulo **"Progresso"** / **"% concluído"** | **% de atingimento** | `fat_meta.pct_atingimento` |
| `271:808` | Rótulo **"DESCRIÇÃO"** | **Descrição do Objetivo** | glossário §3.2 |
| `227:194` | Segundo card rotulado **"META 1.1"** (duplicado) | Erro de numeração — é 1.2 | — |

### B. Campo obrigatório ausente — a tela não fecha sem ele

| Tela | Falta | Por quê |
| --- | --- | --- |
| `271:856`, `227:194` | **Peso (0–100)** do Sucesso Mensal | `NOT NULL` em `fat_sucesso_mensal.peso`. É o que pondera a cascata — sem ele o `INSERT` estoura e o % da Meta não fecha |
| `271:856`, `227:194` | **Mês de referência** | `NOT NULL`, sempre dia 1 (`ck_sucesso_mes`). A grade mostra só **Prazo** (`dt_limite`), que é outro campo |
| `271:808` | **Preditor primário/secundário** e **Agenda temática** do Objetivo | Existem em `fat_objetivo_especifico` e estão no formulário atual; o modal novo os perdeu |

### C. Regra de apresentação violada

| Tela | Problema | Regra |
| --- | --- | --- |
| `271:856` | **% de atingimento do Sucesso Mensal aparece como barra de leitura.** Está invertido: o SM é o **único** nível onde o % é digitado | glossário §3.4 |
| `271:724`, `271:808` | % da Meta e do Objetivo sem hachura + marcador `fx` — parecem editáveis | AD-003, PLR-10 |
| `227:194` | Coluna **ATRASO** ("5 dias") — derivado legítimo, mas a regra de cálculo não está definida em lugar nenhum | AD-003 (precisa sair de view) |
| `227:194` | Gráfico **Evolução mensal** (Esperado × Atingido) e o seletor "Assessores" | AD-003 — número de gestão tem de vir de view/Saída, não de agregação na tela |

### D. Capacidade nova — **decisão de schema, não de desenho**

Estas quatro pararam o desenho. Cada uma pede coluna ou tabela que não existe.

**D-1 · Status no Objetivo Específico** (`271:808`)
O modal traz um select **Status: "Ativo"**. `fat_objetivo_especifico` **não tem
coluna `status`** — só Meta tem. Ou é coluna nova (migration + constraint +
efeito na cascata: objetivo pausado entra na média?), ou o campo sai do modal.

**D-2 · Responsável no Sucesso Mensal** (`271:856`)
O modal traz um person picker **Responsável**. `fat_sucesso_mensal` tem
`atualizado_por` (auditoria, AD-006) — que é *quem mexeu por último*, não *de
quem é a tarefa*. Responsável hoje é campo de **Meta**. Ou vira coluna nova
`id_usuario_responsavel`, ou o modal herda e exibe o responsável da Meta como
leitura.

**D-3 · Atribuição de vários meses a um Sucesso Mensal** (`271:856`)
A grade "Atribuição de Meses" permite marcar **Jul, Ago, Set, Out, Nov, Dez** —
múltipla escolha. Mas `mes_referencia` é **um** `DATE` obrigatório, dia 1.
Isso não é ajuste de UI: ou um SM passa a ter N meses (tabela de ligação nova,
e a cascata de peso precisa ser redefinida — o peso é por SM ou por mês?), ou a
grade vira seletor de **um** mês.

**D-4 · Reordenar Sucesso Mensal arrastando** (`227:194`)
O rodapé diz "Arraste os itens para reordenar". `fat_objetivo_especifico` e
`fat_meta` têm coluna `ordem`; **`fat_sucesso_mensal` não tem**. Ou entra
coluna `ordem`, ou o arrastar vale só para Objetivo e Meta e o SM ordena por
`mes_referencia`.

### E. Vinculação hierárquica editável — comportamento a definir

`271:724` traz select **"Vinculação → Objetivo Específico"** e `271:856` traz
**dois** selects (Objetivo + Meta). Isso é **reparentar** (mover uma Meta de
objetivo, mover um SM de meta) — capacidade que a tela atual não tem. O schema
aceita (basta `UPDATE` da FK), mas dispara recálculo nos **dois** lados
(objetivo/meta de origem e de destino) e não há RPC para isso hoje.

No `271:856` o select de **Objetivo** é redundante e perigoso: o objetivo do SM
é derivado da Meta. Como select editável, sugere que dá para pendurar SM direto
no Objetivo — o que a FK não permite.

---

## Implementation Decisions

Decididas com Pedro em 2026-09-15.

### D-1 · Status no Objetivo Específico → **criar, espelhando a Meta**

- Coluna `status TEXT NOT NULL DEFAULT 'ativo'` em `fat_objetivo_especifico`,
  com `ck_objetivo_status CHECK (status IN ('ativo','pausado','descartado'))`.
  Gênero masculino — a Meta usa o feminino (`ativa/pausada/descartada`).
- **Consequência não-óbvia, verificada no código:** a cascata já exclui Metas
  não-ativas da média do Objetivo (`mm.status = 'ativa'`, nível 2), mas o nível
  raiz — Planejamento = média dos Objetivos — **não filtra nada**. Para o
  Objetivo se comportar como a Meta, `app.recalcula_atingimento` precisa ganhar
  `AND o.status = 'ativo'` no nível raiz.
- Isso **emenda deliberadamente** a decisão de `planejamento-estrategico-redesenho`
  de não tocar na função. Migration forward-only nova, com o motivo no arquivo.

### D-2 · Responsável no Sucesso Mensal → **coluna própria**

- `id_usuario_responsavel BIGINT REFERENCES dim_usuario(id_usuario)` em
  `fat_sucesso_mensal`. Não confundir com `atualizado_por`, que é auditoria
  (AD-006) e continua existindo em paralelo.
- Vazio exibe o responsável da **Meta** como fallback visual, marcado como
  herdado. Ausência real de ambos é `—` (AD-005).
- A tela `227:194` já mostra avatares distintos por linha de SM (JM, MS, CR),
  então o desenho depende disso.

### D-3 · Grade de meses → **atalho de criação em lote**

- `mes_referencia` continua sendo **um** mês por Sucesso Mensal. Nada muda no
  schema nem na cascata.
- Marcar N meses no modal cria **N Sucessos Mensais irmãos**: ids distintos,
  mesma descrição, cada um com seu próprio peso e seu próprio %.
- É conveniência de cadastro — poupa a Gestora de repetir o mesmo sucesso mês a
  mês. Depois de criados são registros independentes: editar um não toca nos
  outros, e não existe vínculo de "irmandade" persistido.
- Na **edição** de um SM existente, o seletor é de **um mês só** — a grade
  múltipla aparece apenas na criação.

### D-4 · Reordenar arrastando → ~~coluna `ordem`~~ → **CORTADO**

**Revertido em 2026-09-16.** A decisão original (15/09) era criar
`ordem SMALLINT` em `fat_sucesso_mensal` para persistir o arrastar. Pedro
cortou a capacidade: *"não precisamos de mover os itens nesta página"*.

Com o arrastar fora, a coluna perde o único consumidor. Ela **não é criada** —
migration é forward-only, então uma coluna morta só sairia com outro arquivo
depois. O corte pegou a tempo: o worker do Lote 1 ainda não tinha escrito a
migration quando a decisão chegou.

Consequências:
- `fat_objetivo_especifico` e `fat_meta` mantêm as colunas `ordem` que **já
  tinham** — nada é removido de nada.
- A grade ordena Sucesso Mensal por `mes_referencia`.
- O texto "Arraste os itens para reordenar" do mockup **não é renderizado** —
  a tela não pode prometer o que não faz.
- `reordenaItens` sai de `PERMISSOES`; só `moveHierarquia` (PLV-09) entra.

### E · Vinculação hierárquica → **permitir mover, recalculando os dois lados**

- RPC nova que move Meta entre Objetivos e SM entre Metas, marcando origem
  **e** destino como desatualizados.
- No modal de Sucesso Mensal o select de **Objetivo vira leitura**: o objetivo
  é derivado da Meta. Como select editável, sugeria pendurar SM direto no
  Objetivo — o que a FK não permite.

---

## Declined / Undiscussed Gray Areas → Assumptions

| Assunto | Default adotado | Por quê |
| --- | --- | --- |
| Coluna ATRASO (`227:194`) | Derivada em view: `dt_limite < current_date AND status = 'pendente'`, em dias corridos. SM sem `dt_limite` mostra `—` | AD-003 proíbe agregação na tela; AD-005 proíbe sentinela |
| ~~Gráfico Evolução mensal~~ | **Revertido em 2026-09-15** — entra como PLV-13. A série "Esperado" sai do **peso**, que já é obrigatório: fração do peso total cujo `mes_referencia` já chegou. Ver AD-056 | O corte original estava errado: eu procurei uma coluna "esperado" em vez de derivar da que existe |
| Denominador de "METAS PRIORITÁRIAS 3 de 7" | Total = Metas **ativas** do plano; numerador = ativas com `prioridade = 'alta'` | Única leitura que fecha com a legenda "4 em alta prioridade" |

---

## Deferred Ideas

- `fat_snapshot_mensal` + job de fechamento mensal (AD-015). A série histórica
  desta feature é **derivada** (AD-056): editar o % de um mês passado reescreve
  o ponto daquele mês. Retomar quando for preciso auditar o que foi reportado
  numa reunião passada — é feature de Saída, não desta tela.

---

## Segunda rodada de decisão — 2026-09-15

### Diagnóstico do plano (nó `57:671`) → **PLV-14, custo quase zero**

Eu tinha cortado por "tela própria, não desenhada". O mockup chegou e mostrou
que **não é feature nova**: é uma aba com os três campos de contexto estratégico
de `dim_planejamento` — **Legado**, **Objetivo do ano**, **Análise de
conjuntura** — que já existem, já têm Zod, já têm formulário
(`contexto-estrategico.tsx` / `DadosPlanejamentoForm`, entregues em PLR-05). O
redesenho os move da coluna esquerda colapsável para uma aba própria, ao lado de
"Construir a estrutura".

**Conferido contra o glossário §3.1:** o quarto campo do grupo, **Perfil de
atuação**, está ausente do mockup — e está **certo**: ele é gateado a PLL
(`dados-planejamento-form.tsx:161-189`) e a tela desenhada é de Estratégia.

### Evolução mensal → **PLV-13, AD-056**

Ver a definição das séries no `spec.md`. O ponto que exigiu decisão não foi a
matemática, foi a honestidade da série: `pct_atingimento` guarda o valor atual,
então a curva do passado se move quando alguém preenche um mês antigo. Pedro
escolheu **curva viva agora, snapshot depois**.

O filtro "Assessores" do mockup só é possível porque PLV-03 cria
`id_usuario_responsavel` no Sucesso Mensal — sem essa coluna, não haveria por
onde filtrar.

---

## Restrição de verificação conhecida

L-006 / L-007 (`.specs/LESSONS.md`): o projeto **não tem harness de teste de
componente** (`vitest.config.ts` inclui só `src/backend/**/*.test.ts`). Toda AC
satisfeita puramente por JSX chega ao Verifier sem evidência automatizada. Como
esta feature é quase toda UI, a spec precisa empurrar o máximo de regra para
funções puras testáveis (formatação, permissões, ordenação, cálculo de atraso)
em vez de deixá-las inline no componente.
