# PLL — Dashboard e Agenda Specification

- **Gate AD-039:** ✅ satisfeito — Pedro confirmou que as telas (`44:477` Dashboard, `379:4` Agenda) já foram
  validadas com a operação PLL (2026-09-22).
- **Status:** ✅ todas as decisões fechadas (D-1 resolvida em 2026-09-22: `fat_contrato.origem_encerramento`
  nova, coluna nullable, obrigatória só quando `status = 'nao_concluido'`). Pronta para Design. D-8 resolvida
  (2026-09-22): ausência de Kanban/Pendências/KPIs de atraso no PLL é decisão de produto, não lacuna do
  desenho. D-9 resolvida (2026-09-22): a aba Participantes ganhou spec própria,
  `.specs/features/pll-cadastro-participantes/`, que também resolveu D-2 e D-3 abaixo (a origem real do
  dado demográfico e da afinidade de agenda é a planilha de importação do PLL, não o formulário genérico
  `fat_submissao` proposto originalmente).

## Problem Statement

Hoje o PLL não tem tela própria. `/produtos/pll/dashboard` e `/produtos/pll/agenda` reaproveitam as telas da
Estratégia: Quadro de Acompanhamento por etapa, Tabela de Pendências e KPIs de mandatos em atraso. Nada ali
responde às perguntas de quem opera uma **edição** do PLL: quantos mentorados estão ativos, quantos
desistiram, quantas mentorias aconteceram, quem são os participantes e seus mandatos, quais pautas eles
querem trabalhar.

Pedro desenhou em set/2026 as duas primeiras telas de uma área de produto PLL própria, com cinco abas
(Dashboard, Agenda, Participantes, Avaliações, Fatos Geradores). Esta spec cobre **Dashboard** e **Agenda**.
As outras três abas são fase seguinte.

O desenho introduz cinco pontos que o banco não sustenta hoje — a origem dos dados demográficos e de
afinidade, o status Desistente/Desligado, e três divergências de vocabulário com o glossário. Estão
listados abaixo, um por um, para não virarem migration corretiva depois.

## Goals

- [ ] Área de produto PLL com título **Programa de Liderança Parlamentar (PLL)** e abas
      Dashboard · Agenda · Participantes · Avaliações · Fatos Geradores, sem quebrar Estratégia e Coalizão.
- [ ] Dashboard (`44:477`) com filtros, 5 KPIs, gráfico de status por mês, tabela de mentorados, feed de
      registros dos mentores e três painéis analíticos (participante, mandato, afinidade de agenda temática).
- [ ] Agenda (`379:4`) com grade mensal de Encontros, legenda por status, filtros por mentor(a), mentorado e
      edição, e lista dos encontros do mês.
- [ ] Todo número exibido vem de coluna, view ou agregação de leitura — nenhum é calculado no componente (AD-003).
- [ ] Nenhum rótulo, enum ou valor de catálogo inventado pelo mockup chega em produção.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Aba **Participantes** — conteúdo funcional (import, lista, vínculo TSE, Ficha do Mentorado) | Tem spec própria, `.specs/features/pll-cadastro-participantes/`. Aqui só entra a existência da aba (PLL-SH-02) |
| Aba **Avaliações** | Tela ainda não desenhada. Entra com estado padrão "em desenvolvimento" |
| Aba **Fatos Geradores** do PLL | Já existe (`fatos-geradores-ciclo-vida`); só ganha a posição nova na barra |
| Formulário "Novo agendamento" | Só o botão foi desenhado. Reaproveita o fluxo existente (ver D-10) |
| Definição do formulário **Diagnóstico e Temáticas de Interesse** | Pré-requisito de dado dos painéis de análise, mas é feature própria (D-2, D-3) |
| Popover de detalhe do Encontro e "marcar presença" | Já entregues (`redesenho-estrategia-tela-first`, EST-13); a Agenda PLL os reutiliza |
| Navegação por produto de Estratégia e Coalizão | Continuam com o conjunto de abas atual |
| Popular `ref_agenda_tematica` | Catálogo pendente de levantamento humano (CAT-16) |
| Exportar / imprimir os painéis | Não desenhado |

---

## O que a revisão de mockup achou

Feita contra `docs/schema_sistema.sql`, as migrations, o glossário (`figma-dominio-legisla`) e as telas em
produção. **Cada linha é uma divergência que o desenho trouxe.** As decisões de cada uma estão na seção
seguinte.

### Vocabulário e enums

| Veio assim | É assim | Onde | Decisão |
| --- | --- | --- | --- |
| Seção "Registros de Agenda" listando encontros marcados, com colunas **Tipo / Data / Descrição / Responsável** | Reincidência. Encontro e Registro são entidades distintas. Cada linha aqui é um **Encontro** (`status` planejado/realizado/remarcado). "Tipo" guarda um **status**, "Descrição" é `titulo`, "Responsável" é o mentor do contrato | `fat_encontro`, `fat_registro` | D-6 |
| Contador "6 mentorias agendadas", com 5 linhas na tabela | O contador não bate com a lista, e "mentorias agendadas" exclui realizadas e canceladas, que a própria lista mostra. Mentoria é **um dos tipos** de encontro (`ref_tipo_registro`), ao lado de Pontapé e Imersão | `ref_tipo_registro` | D-6 |
| Chip do calendário "Mentoria Realizada" (dia 1) e "Mentoria - Lucas A..." (demais) | Dois formatos no mesmo componente: um mostra o **status**, os outros o **mentorado**. Padronizar em "‹tipo› – ‹mentorado›", com o status na **cor** | — | D-6 |
| Coluna **Tipo** com Planejado/Realizado/Remarcado | O campo é **Status** | `ck_encontro_status` | D-6 |
| Status de mentorado **Ativo / Desistente / Desligado** | `fat_contrato.status` só tem `ativo / concluido / nao_concluido`. Desistente e Desligado caem **ambos** em `nao_concluido`; o banco não os distingue. E falta **Concluído** (quem terminou a edição) | `ck_contrato_status`, jornada B1.4 | **D-1 (bloqueante)** |
| Gráfico "Status da mentoria por data" com barras por **mês** | Título diz "por data", eixo é mês. O status é de **Encontro** | `fat_encontro` | D-6 |
| Painel "Registros e comentários dos mentores" | "Comentário" não é entidade. O que existe é **Registro** (`resumo`, `id_usuario_autor`) | `fat_registro` | D-7 |
| Título do painel "Cor/Raça do **Deputado**" | Há Senadores na tabela (`Sen. João Silva`). O campo é **parlamentar**. Rótulo canônico: "Cor/raça do parlamentar" | `dim_mandato.ds_raca` | D-5 |
| Legenda "Prefere não informar" (gênero, orientação, cor/raça) e "Não informado" (cor/raça do parlamentar) | Ausência de dado é `—` (AD-005). "Prefere não informar" é **resposta** de formulário, não ausência; "Não informado" é ausência. São categorias diferentes e o mockup usa as duas sem distinção | AD-005 | D-5 |
| Cor/raça com valores Branca, Parda, Preta, Indígena, Amarela | Bate com o CHECK de `dim_mandato.ds_raca` (Branca, Preta, Parda, Amarela, Indígena) ✅ | `ck_mandato_raca` | — |
| Cargo anterior **Secretário** | Cargo por nomeação não existe no espelho TSE (só cargos eletivos). Não é derivável do dado disponível | `tse.mv_candidatura_resumo.ds_cargo` | D-5 |
| Afinidade com **Educação, Segurança Pública, Clima, Modernização do Estado** e pautas **Saúde, Infraestrutura, Economia, Direitos Humanos, Tecnologia** | Reincidência de "Agenda: Segurança Pública". `ref_agenda_tematica` está **vazio de propósito** (CAT-16). O campo certo (**Agenda temática**) veio, os valores não são aprovados | `ref_agenda_tematica`, CAT-16 | D-3 |
| Pergunta de formulário como texto do card ("Além das pautas anteriormente mencionadas, seu mandato prioriza outras pautas? Destaque até 3…") | É o enunciado do formulário vazando para o dashboard. O card mostra o **resultado**, não a pergunta | — | D-3 |
| Rosca com **"100%"** no centro em todos os gráficos | O centro da rosca nunca é ≠ 100% num gráfico de partes; não informa. O que falta é o **n** | — | D-5 |
| Edição **2026.1 / 2025.2** | Edição é `ref_projeto.nome` (jornada B: "a edição é um Projeto"). O formato "AAAA.S" não existe em catálogo; é valor de exemplo | `ref_projeto` | D-4 |
| Atingimento "68%", "Ating. (%)" com barra | Número calculado, **nunca editável**. Sem afordância de edição | `dim_planejamento.pct_atingimento`, AD-003, PLR-10 | D-11 |
| Título "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)" | `ref_produto.nome` é `PLL`. O nome por extenso não existe no banco | `ref_produto` | D-4 |

### Coerência entre as duas telas

| Divergência | Detalhe | Decisão |
| --- | --- | --- |
| **Mesmo status, cor diferente** | Dashboard: Planejado = verde `#035252`, Realizado = vinho, Cancelado = coral, Remarcado = dourado. Agenda: Planejado = vinho, Realizado = verde-esmeralda, Remarcado = âmbar, Cancelado = cinza. **Realizado é vinho num frame e verde no outro** | D-6 |
| Mesmo dado, dois recortes | Filtro **Mentorado** existe só na Agenda; o Dashboard filtra mentor(a) e edição | D-4 |
| Tabela de mentorados: **Mentorias** = 8, 5, 3, **10**, 6, 7 | A régua do PLL tem **5** mentorias (`ref_tipo_registro.qtd_prevista = 5`). Valores 8 e 10 não cabem numa contagem de Mentoria. E cada "Ating. (%)" é exatamente Mentorias × 10 — padrão de dado de exemplo, não de dado real | D-11 |
| KPI "Mentorias realizadas **x** planejadas" mostra um número só (187) | O rótulo promete dois valores; o desenho mostra um | D-11 |

### O que a tela tem hoje e o desenho novo NÃO mostra

Ausência é decisão, e não se anuncia sozinha. Cada item abaixo existe em produção para o PLL e sumiu do
desenho. **Quadro de Acompanhamento, Pendências e KPIs de atraso** foram checados com Pedro (2026-09-22) e
são remoção **intencional**: PLL não opera por quadro de etapa — é carteira de mentorados/edição — então o
componente da Estratégia nunca fez sentido aqui. Vira D-8 resolvida (ver abaixo). O restante segue
levantado, um por um:

| Some | Hoje | Decisão |
| --- | --- | --- |
| **Quadro de Acompanhamento** (colunas por etapa: Recrutamento → Mentorias, drag entre etapas) | Dashboard do PLL herda o quadro da Estratégia (`moverEtapaKanban`) | **D-8 — resolvida: remoção intencional** |
| **Tabela de Pendências** | Idem | **D-8 — resolvida: remoção intencional** |
| Faixa de KPIs de mandatos em atraso / limiares | `vw_estrategia_kpi` | **D-8 — resolvida: remoção intencional** |
| Abas **Mandatos** e **Novo Contrato** | Únicos pontos de entrada para criar contrato PLL | **D-9 — resolvida: Participantes assume provisoriamente** |
| Filtro por **gestora** | Filtro atual do dashboard e da agenda | D-4 |
| Filtro por **contrato** na Agenda | Idem | D-4 |

### O que veio certo

Registrar o acerto também calibra: filtros por **mentor(a)** e **edição** (mapeiam `rel_usuario_contrato` e
`ref_projeto`); a legenda de status **Planejado / Realizado / Remarcado / Cancelado** bate exatamente com
`ck_encontro_status`; **Agenda temática** como nome do painel; cor/raça do parlamentar com os 5 valores do
CHECK; datas de encontro sem hora na lista; semana começando na segunda.

### Defeitos de layout do próprio frame

- `44:477`: o 5º KPI ("Fatos geradores registrados") ultrapassa a margem direita do contêiner (x + largura > 1344).
  Implementar como 5 colunas iguais dentro do contêiner.
- `379:4`: a grade de outubro mostra 4 semanas (29/set–26/out); outubro/2025 tem 5 (falta 27–31). A grade deve
  mostrar **todas** as semanas que tocam o mês.
- `379:4` mostra "Outubro 2025" e `44:477` mostra datas de set/2026. Datas de exemplo; a implementação usa a data real.
- Card do feed em `44:477` termina com ~50px de vazio abaixo do último item. Não é requisito.

---

## Assumptions & Open Questions

Todas com **Confirmed? = n**: nada foi confirmado com Pedro ainda. As linhas **bloqueantes** impedem o Design
porque decidem schema (forward-only, AD-025) ou removem capacidade existente.

| # | Decisão / ambiguidade | Default proposto | Justificativa | Bloqueia? | Confirmed? |
| --- | --- | --- | --- | --- | --- |
| **D-1** | Status do mentorado: **Ativo / Desistente / Desligado** | Coluna nova `fat_contrato.origem_encerramento` (`desistencia` \| `desligamento`), **obrigatória quando `status = 'nao_concluido'`**. Rótulos: `ativo` → Ativo; `nao_concluido` + `desistencia` → Desistente; `nao_concluido` + `desligamento` → Desligado; `concluido` → **Concluído** (fora do desenho, mas existe) | O banco não distingue os dois. A jornada B1.4 já prevê "registrar desistência, com motivo", então a distinção é intenção do produto | Não (resolvida) | **y (Pedro, 2026-09-22)** |
| **D-2** | ~~De onde vêm gênero, orientação sexual, cor/raça e tempo na política do participante~~ | **Superada** (2026-09-22) pelo Figma `387:4`: vêm da planilha de importação do PLL, coluna de staging (`Dados Pessoais`, Anexo A de `.specs/features/pll-cadastro-participantes/spec.md`), não de `fat_submissao` | Pedro mostrou o mecanismo real: import em lote + vínculo manual ao TSE, não formulário genérico | y — resolvida em spec irmã |
| **D-3** | ~~De onde vem a Afinidade de agenda temática~~ | **Superada** (2026-09-22): as 4 pautas fixas (Educação, Segurança Pública, Modernização do Estado, Clima) vêm da mesma planilha (`Pautas Prioritárias`, Anexo A de `pll-cadastro-participantes`), **não** de `ref_agenda_tematica` — são um conjunto fixo do formulário de diagnóstico do PLL, produto diferente do catálogo genérico usado em Meta/Objetivo | Confirmado por Pedro ao mostrar `387:4`; painel do Dashboard (PLL-DB-17) passa a ler a agregação dessa tabela de staging, não mais um formulário `fat_submissao` | y — resolvida em spec irmã |
| D-4 | Filtros | **Dashboard:** mentor(a) e edição. **Agenda:** mentor(a), mentorado e edição. Mentor(a) = usuário com vínculo `papel_no_contrato = 'mentor'` em contrato PLL; Mentorado = usuário com vínculo `assessor` em contrato PLL; Edição = `ref_projeto` com contrato PLL. Seleção múltipla, como os filtros atuais. Os filtros **gestora** e **contrato** deixam de existir **no PLL** | O desenho os omite e "mentorado" faz o papel de "contrato" (1 mentorado ↔ 1 contrato, ver D-12). Estratégia e Coalizão mantêm os seus | Não | n |
| D-5 | Painéis de análise: rótulos, categorias e rosca | (a) "Cor/raça do **parlamentar**". (b) Centro da rosca = **n** de respondentes, não "100%". (c) "Prefere não informar" é categoria própria; ausência de resposta não entra no gráfico e o card mostra "N sem resposta". (d) **Cargos anteriores** = só cargos eletivos do TSE; "Secretário" não aparece. (e) **Mandatos anteriores** = nº de candidaturas eleitas confirmadas em `rel_mandato_candidatura` antes do contrato. (f) **Partido** = `fat_contrato.id_partido_no_contrato` (snapshot do contrato, não o atual), com "Outros" agrupando além dos 8 maiores. (g) **Estado de eleição** = `dim_contratante.sg_uf` | Cada item é derivação de coluna existente; nenhum inventa campo. (f) segue o padrão de snapshot de `fat_contrato` | Não | n |
| D-6 | Encontro × Registro; cores de status | (a) A lista "Registros de Agenda" vira **"Encontros do mês"**, colunas **Status / Data / Título / Mentor(a)**, contador **"N encontros neste mês"**. (b) Chip = "‹tipo› – ‹mentorado›", cor pelo status. (c) **Uma paleta de status para as duas telas**: a da Agenda (Planejado vinho, Realizado verde, Remarcado âmbar, Cancelado cinza) | (a)(b) corrigem invenção já catalogada. (c) Dois mapeamentos para o mesmo enum fazem o leitor errar a leitura entre telas. A da Agenda tem semântica clara (feito = verde, adiado = âmbar, fora = cinza) e não usa coral, que é cor de alerta. **Pedro precisa atualizar o `44:477`** | Não | n |
| D-7 | Feed "Registros e comentários dos mentores" | Título **"Registros dos mentores"**. Item = `fat_registro` dos contratos do recorte, mais recente primeiro, **10 itens**. Autor = `id_usuario_autor`; "Mentorado" = assessor do contrato; texto = `resumo`; hora = `ocorrido_em` (é `TIMESTAMPTZ` em `fat_registro`, então "Ontem às 18:30" é real). Registro sem `resumo` mostra `—` | "Comentário" não existe. O limite de 10 não está no desenho: valor razoável, ajustável | Não | n |
| D-8 | **Quadro de Acompanhamento, Pendências e KPIs de atraso** somem do Dashboard PLL | Confirmado: os três saem **só para o PLL**; permanecem na Estratégia e na Coalizão. As etapas do PLL continuam existindo em `ref_etapa` e `fat_etapa_contrato`, só sem visão de quadro | Decisão de Pedro (2026-09-22): PLL opera por carteira de mentorados/edição, não por quadro de etapa — o componente da Estratégia não se aplica ao produto. Vira **AD** no Design, não repetição do padrão da Estratégia | Não (resolvida) | **y** |
| D-9 | Abas **Mandatos** e **Novo Contrato** somem da barra do PLL | **Superada** (2026-09-22): a aba Participantes tem desenho próprio (Figma `387:4`, spec `.specs/features/pll-cadastro-participantes/`) — import de planilha + lista + vínculo TSE + Ficha do Mentorado. Não é mais "conteúdo atual de Mandatos" provisório; é a tela definitiva | O frame `387:4`, mostrado depois desta decisão, já resolve o que preencheria a aba | Não (resolvida) | **y** |
| D-10 | Botão **"Novo agendamento"** (formulário não desenhado) | Habilitado quando exatamente **1 mentorado** está no filtro; leva ao fluxo de criação de Encontro daquele contrato (`/contratos/[id]/encontros`), como hoje. Sem mentorado único: desabilitado com motivo no `title` (AD-005) | É o comportamento atual (`produtos/[slug]/agenda/page.tsx`), trocando "contrato" por "mentorado". UX fraca — pede tela própria depois | Não | n |
| D-11 | Definição dos números | **Mentorias** (tabela) = Encontros `realizado` do tipo Mentoria no contrato. **Ating. (%)** = `dim_planejamento.pct_atingimento` (leitura). **Atingimento Plan.** (KPI) = média simples de `pct_atingimento` dos contratos do recorte. **Mentorias realizadas x planejadas** = "realizadas / planejadas": realizadas = Encontros `realizado`, planejadas = Encontros `planejado` + `realizado`; remarcado e cancelado ficam fora do denominador. **Fatos geradores registrados** = `fat_fato_gerador` com `situacao = 'realizado'` dos contratos do recorte | Nenhum número é definido no desenho. Os defaults usam só colunas existentes e evitam os valores do mockup, que são inconsistentes (ver "Coerência"). Mentorias > 5 indicam dado errado, não gráfico | Não | n |
| D-12 | Quem é o **mentorado** | Usuário com vínculo `papel_no_contrato = 'assessor'` em contrato PLL ativo ou encerrado (jornada B1.3: "vincular o assessor mentorado ao mandato"). **Uma linha por (mentorado, contrato)**. "Parlamentar" = nome de urna do mandato do contrato, com prefixo do cargo (`Sen.`, `Dep.`) vindo de `id_cargo_no_contrato` | O schema permite mais de um assessor por contrato. Se houver, o KPI "Total de mentorados" conta os dois. **Verificar na base de dev** antes do Design | Não | n |
| D-13 | Privacidade das agregações demográficas | Painel sem **respondentes suficientes** (n < 5 no recorte) mostra "Dados insuficientes (n < 5)" em vez do gráfico. Vale para os três painéis | Um recorte por mentor(a) pode ter 2 participantes; "Prefere não informar 3%" com 42 pessoas já é **1 pessoa**. Percentual sobre grupo pequeno identifica indivíduo, e são dados sensíveis. O RLS do Mentor reduz o recorte à carteira dele, então o limiar age de fato | Não | n |
| D-14 | Quem vê o quê | **Gestora e Admin:** tudo. **Mentor:** só a própria carteira (RLS); os painéis analíticos seguem D-13. **Assessor:** sem acesso à área PLL. Autorização é sempre do RLS, nunca da UI (AD-002) | Jornada C: o Mentor vê analytics **recortado pela carteira** | Não | n |

**Open questions bloqueantes:** nenhuma. D-1, D-2, D-3, D-8 e D-9 resolvidas em 2026-09-22 (D-2/D-3 pela
spec irmã, `pll-cadastro-participantes`). As demais têm default e podem ser refutadas na revisão de Design.

**Sobre nomenclatura e números (cargo, contagem de encontros, indicadores):** Pedro confirmou (2026-09-22)
que essas divergências são esperadas — a tela validada trata da estrutura e do fluxo, não da nomenclatura
exata nem dos valores de exemplo. A tabela "Vocabulário e enums" acima e a definição de números em D-11 são,
portanto, as correções a aplicar, não pontos de dúvida sobre se algo está errado.

---

## User Stories

### P1: Área de produto PLL com abas próprias ⭐ MVP

**User Story**: Como gestora ou mentor(a), quero entrar no PLL e ver as abas do programa, para navegar entre
Dashboard, Agenda e as demais áreas sem passar pelo vocabulário da Estratégia.

**Why P1**: É o chrome das duas telas. Sem ele, nenhuma das duas se encaixa.

**Acceptance Criteria**:

1. **PLL-SH-01** — WHEN o usuário está em `/produtos/pll/*` THEN o sistema SHALL exibir o título
   "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)" e as abas, nesta ordem: **Dashboard, Agenda, Participantes,
   Avaliações, Fatos Geradores**, com a aba da rota atual destacada.
2. **PLL-SH-02** — WHEN o usuário abre **Participantes** THEN o sistema SHALL exibir a tela funcional de
   cadastro de participantes, especificada em `.specs/features/pll-cadastro-participantes/spec.md`
   (D-9, resolvida 2026-09-22 — `/produtos/pll/mandatos` e `/produtos/pll/novo-contrato` continuam
   existindo por URL direta, mas deixam de ser a aba). WHEN abre **Avaliações** THEN SHALL exibir o
   estado padrão "em desenvolvimento". Nenhuma das cinco abas responde 404.
3. **PLL-SH-03** — WHEN o usuário está em `/produtos/estrategia/*` ou `/produtos/coalizao/*` THEN o sistema
   SHALL exibir o título e as abas de hoje, **sem alteração**.
4. **PLL-SH-04** — WHEN o usuário acessa `/produtos/pll/mandatos` ou `/produtos/pll/novo-contrato` por URL THEN
   o sistema SHALL responder normalmente (as rotas continuam existindo).

**Independent Test**: Entrar em PLL, percorrer as cinco abas; entrar em Estratégia e confirmar que a barra não mudou.

---

### P1: Dashboard do PLL — KPIs, gráfico e filtros ⭐ MVP

**User Story**: Como gestora, quero ver de relance o estado da edição — quantos mentorados, quantos ativos,
quantas mentorias, quanto do planejamento avançou — e recortar por mentor(a) e edição.

**Why P1**: É a primeira tela da área e a pergunta que a coordenação faz todo dia.

**Acceptance Criteria**:

1. **PLL-DB-01** — WHEN o dashboard abre THEN o sistema SHALL exibir dois filtros — **Filtrar por mentor(a)** e
   **Filtrar por edição** — sem seleção (todos). WHEN o usuário seleciona valores THEN **todos** os blocos da tela
   (KPIs, gráfico, tabela, feed, três painéis) SHALL refletir o recorte.
2. **PLL-DB-02** — WHEN o dashboard carrega THEN o sistema SHALL exibir 5 KPIs, nesta ordem e com estes rótulos:
   **Total de mentorados**, **Distribuição de status**, **Mentorias realizadas x planejadas**,
   **Atingimento Plan.**, **Fatos geradores registrados**, cada um definido em D-11.
3. **PLL-DB-03** — WHEN **Distribuição de status** renderiza THEN o sistema SHALL exibir a barra segmentada e a
   legenda com o **percentual de cada status** sobre o total de mentorados do recorte. Os rótulos e a existência de
   "Desistente" dependem de D-1 (bloqueante).
4. **PLL-DB-04** — WHEN **Atingimento Plan.** renderiza THEN o sistema SHALL exibir o percentual **sem
   afordância de edição** e vindo de leitura (AD-003). WHEN nenhum contrato do recorte tem planejamento THEN
   SHALL exibir `—`, nunca `0%`.
5. **PLL-DB-05** — WHEN o gráfico **Status da mentoria por data** renderiza THEN o sistema SHALL exibir barras
   empilhadas **por mês** com 4 séries — Planejado, Realizado, Remarcado, Cancelado — cores conforme D-6 e eixo Y
   na contagem de Encontros. O mês de um Encontro `realizado` é o de `dt_realizada`; nos demais, o de
   `dt_prevista_inicio`. Meses sem Encontro aparecem com barra vazia.
6. **PLL-DB-06** — WHEN os 5 KPIs renderizam THEN o sistema SHALL dispô-los em 5 colunas iguais **dentro** do
   contêiner (o `44:477` estoura a margem direita).

**Independent Test**: Com 3 contratos PLL de teste (2 ativos, 1 `nao_concluido`) e Encontros em 3 meses,
conferir cada KPI contra `SELECT` direto; filtrar por 1 mentor(a) e ver todos os blocos mudarem.

---

### P1: Dashboard do PLL — tabela de mentorados ⭐ MVP

**User Story**: Como gestora, quero listar os mentorados da edição com seu parlamentar, mentor(a), progresso e
status, para achar quem precisa de atenção.

**Why P1**: É o bloco que leva ao detalhe de cada participante.

**Acceptance Criteria**:

1. **PLL-DB-07** — WHEN a tabela **Mentorados participantes** renderiza THEN o sistema SHALL exibir uma linha por
   (mentorado, contrato PLL) com as colunas **Nome do mentorado, Parlamentar, Partido, UF, Mentor(a), Mentorias,
   Ating. (%), Status, Edição** e um indicador de navegação (D-12).
2. **PLL-DB-08** — WHEN o usuário clica no cabeçalho de uma coluna ordenável (Nome, Parlamentar, Partido, UF,
   Mentor(a), Mentorias, Ating., Status, Edição) THEN o sistema SHALL ordenar as linhas por ela, alternando
   crescente/decrescente.
3. **PLL-DB-09** — WHEN o usuário digita em **Buscar por participante ou parlamentar…** THEN o sistema SHALL
   filtrar as linhas pelo nome do mentorado **ou** do parlamentar (sem diferenciar maiúsculas e acentos). A busca
   afeta **só** a tabela.
4. **PLL-DB-10** — WHEN uma célula não tem valor (ex.: contrato sem mentor pareado) THEN o sistema SHALL exibir
   `—`, nunca célula vazia nem "N/A" (AD-005).
5. **PLL-DB-11** — WHEN o usuário clica numa linha THEN o sistema SHALL navegar para `/contratos/[id]` daquele
   contrato.

**Independent Test**: Buscar "ana" e ver só as linhas de "Ana …"; ordenar por Partido; clicar numa linha e
cair na ficha do contrato certo.

---

### P1: Dashboard do PLL — feed de registros dos mentores ⭐ MVP

**User Story**: Como gestora, quero ler os últimos registros lançados pelos mentores, para acompanhar o que
está acontecendo nas mentorias sem abrir contrato por contrato.

**Why P1**: É a janela para o dia a dia da edição.

**Acceptance Criteria**:

1. **PLL-DB-12** — WHEN o feed renderiza THEN o sistema SHALL listar os **10 Registros** mais recentes dos
   contratos do recorte (`ocorrido_em` decrescente), cada item com: nome do **autor**, `Mentorado: ‹nome›`,
   data/hora e `resumo` (D-7).
2. **PLL-DB-13** — WHEN o `ocorrido_em` é de hoje ou ontem THEN o sistema SHALL exibir "Hoje às HH:mm" ou "Ontem
   às HH:mm"; nos demais casos, "DD Mmm, AAAA", no fuso do produto.
3. **PLL-DB-14** — WHEN um Registro não tem `resumo` THEN o sistema SHALL exibir `—`.

**Independent Test**: Criar 12 Registros em contratos do recorte e ver só os 10 mais recentes, na ordem certa.

---

### P2: Dashboard do PLL — painéis de análise ⭐ depende de D-2 e D-3

**User Story**: Como coordenação, quero ver o perfil dos participantes, dos mandatos e a afinidade de agenda
temática, para desenhar a mentoria da edição.

**Why P2**: O desenho é rico, mas **dois dos três painéis não têm origem de dado hoje** (D-2, D-3). O painel de
mandato (D-5) é o único que sai de colunas existentes e pode ir primeiro.

**Acceptance Criteria**:

1. **PLL-DB-15** — WHEN **Análise do participante** renderiza THEN o sistema SHALL exibir o selo
   **"N Participantes Ativos"** (contratos `ativo` do recorte) e 4 gráficos de rosca — **Identidade de gênero,
   Orientação sexual, Cor/raça, Tempo na política** — cada um com legenda de categorias e percentuais, lendo a
   tabela de staging de `pll-cadastro-participantes` (D-2, resolvida 2026-09-22 — origem real é a planilha de
   importação, não `fat_submissao`).
2. **PLL-DB-16** — WHEN **Análise do mandato** renderiza THEN o sistema SHALL exibir 5 gráficos de rosca —
   **Cor/raça do parlamentar, Partido político, Estado de eleição, Cargos anteriores, Mandatos anteriores** —
   com as origens de D-5. WHEN o parlamentar não tem `ds_raca` THEN SHALL entrar em "sem resposta", não em
   categoria inventada.
3. **PLL-DB-17** — WHEN **Afinidade de agenda temática** renderiza THEN o sistema SHALL exibir, para as 4
   pautas fixas do PLL (Educação, Segurança Pública, Modernização do Estado, Clima — Anexo A de
   `pll-cadastro-participantes`), a distribuição percentual das notas **5, 4, 3, 2, 1**, e o gráfico
   **Outras pautas prioritárias** (D-3, resolvida 2026-09-22 — **não** usa `ref_agenda_tematica`).
4. **PLL-DB-18** — WHEN o recorte tem menos de 5 respondentes para um painel THEN o sistema SHALL substituir os
   gráficos por "Dados insuficientes (n < 5)" (D-13).
5. **PLL-DB-19** — WHEN qualquer rosca renderiza THEN o sistema SHALL exibir no centro o **n** de respondentes,
   e a soma dos percentuais da legenda SHALL fechar 100% (±1 por arredondamento).

**Independent Test**: Base com 8 respondentes → 3 painéis com gráfico; filtrar por um mentor com 2 → "Dados
insuficientes". Painel de mandato conferido contra `SELECT` em `dim_mandato`/`fat_contrato`.

---

### P1: Agenda do PLL — grade mensal ⭐ MVP

**User Story**: Como mentor(a) ou gestora, quero ver os encontros do mês num calendário, com o status de cada
um, para saber o que está marcado, o que aconteceu e o que foi remarcado.

**Why P1**: Substitui a agenda herdada da Estratégia por uma visão de encontros de mentoria.

**Acceptance Criteria**:

1. **PLL-AG-01** — WHEN a Agenda abre THEN o sistema SHALL exibir o **mês corrente** no fuso do produto, com o
   título "Mês AAAA", setas anterior/próximo, e a semana **começando na segunda** (Seg … Dom).
2. **PLL-AG-02** — WHEN o mês renderiza THEN o sistema SHALL exibir **todas as semanas que tocam o mês**
   (5 ou 6 linhas), com dias de outros meses e sábados/domingos em fundo diferenciado.
3. **PLL-AG-03** — WHEN um dia tem Encontros THEN o sistema SHALL exibir um **chip por Encontro** no formato
   "‹tipo› – ‹mentorado›", truncado com reticências, com a **cor do status** (D-6). O dia de um Encontro é o de
   `dt_realizada` se `realizado`, senão o de `dt_prevista_inicio`.
4. **PLL-AG-04** — WHEN um dia tem mais Encontros do que cabem na célula THEN o sistema SHALL exibir "+N mais"
   e SHALL permitir abrir todos; nenhum Encontro fica inacessível.
5. **PLL-AG-05** — WHEN o usuário clica num chip THEN o sistema SHALL abrir o detalhe do Encontro já existente
   (com "marcar presença"), sem criar tela nova.
6. **PLL-AG-06** — WHEN o usuário troca de mês pelas setas THEN o sistema SHALL buscar os Encontros do mês novo;
   a grade nunca exibe mês novo com dado do anterior.
7. **PLL-AG-07** — WHEN a legenda renderiza THEN o sistema SHALL exibir exatamente **Planejado, Realizado,
   Remarcado, Cancelado**, com as mesmas cores dos chips.

**Independent Test**: Encontros em 3 dias e 4 status diferentes; conferir chip, cor e dia. Navegar para o mês
seguinte e voltar.

---

### P1: Agenda do PLL — filtros, lista e novo agendamento ⭐ MVP

**User Story**: Como mentor(a), quero filtrar a agenda por mentorado e ver a lista dos encontros do mês, para
achar rápido o que preciso e marcar um novo encontro.

**Why P1**: Completa a tela; sem lista e sem ação de criar, a Agenda é só leitura.

**Acceptance Criteria**:

1. **PLL-AG-08** — WHEN a Agenda abre THEN o sistema SHALL exibir três filtros — **Filtrar por mentor(a),
   Filtrar por mentorado, Filtrar por edição** — e aplicá-los à grade **e** à lista (interseção).
2. **PLL-AG-09** — WHEN a lista **Encontros do mês** renderiza THEN o sistema SHALL exibir uma linha por Encontro
   do recorte, ordenada por data, com **Status** (selo colorido), **Data** (`DD/mmm`), **Título** e **Mentor(a)**,
   e o contador "N encontros neste mês" (D-6).
3. **PLL-AG-10** — WHEN o mês não tem Encontro no recorte THEN o sistema SHALL exibir a grade vazia com o estado
   explicativo na lista, nunca grade muda (AD-005).
4. **PLL-AG-11** — WHEN o usuário clica em **Novo agendamento** com exatamente 1 mentorado no filtro THEN o
   sistema SHALL levar ao fluxo de criação de Encontro daquele contrato. WHEN não há mentorado único THEN o botão
   SHALL estar **desabilitado** (nunca escondido) com o motivo no `title` (D-10).
5. **PLL-AG-12** — WHEN o usuário é **Assessor** THEN o sistema SHALL não exibir a Agenda do PLL (D-14).

**Independent Test**: Filtrar por mentorado, ver grade e lista mudarem juntas; botão "Novo agendamento"
desabilitado sem mentorado e habilitado com um.

---

## Edge Cases

- WHEN não há contrato PLL visível ao usuário (RLS) THEN o sistema SHALL exibir estado vazio por bloco, não erro.
- WHEN um bloco do Dashboard falha ao carregar THEN o sistema SHALL exibir `ErroInline` **naquele bloco**, com
  "tentar de novo"; os demais blocos continuam (um KPI quebrado não derruba a tabela).
- WHEN o recorte tem 0 mentorados THEN os KPIs SHALL exibir `0` (contagens) ou `—` (percentuais), sem divisão
  por zero.
- WHEN um contrato PLL não tem mentor pareado THEN a linha entra na tabela com Mentor(a) = `—`, e **não** aparece
  em nenhum recorte por mentor(a).
- WHEN um Encontro `remarcado` e o novo `planejado` coexistem THEN o sistema SHALL exibir os dois, cada um no seu
  dia e com o seu status (`uq_encontro_sequencia` só protege os vivos).
- WHEN o usuário troca de mês com o popover de Encontro aberto THEN o sistema SHALL fechá-lo.
- WHEN o título de um Encontro é longo THEN o chip SHALL truncar e o título completo SHALL estar no `title`.
- WHEN a fonte de um painel demográfico (D-2) não tem nenhuma submissão THEN o painel SHALL exibir o estado
  vazio "Nenhuma resposta ao formulário de diagnóstico", não gráficos zerados.

---

## Requirement Traceability

| Requirement ID | Story | Depende de | Status |
| --- | --- | --- | --- |
| PLL-SH-01 … 04 | P1: Área de produto PLL | D-9, `pll-cadastro-participantes` | Pending |
| PLL-DB-01 … 06 | P1: KPIs, gráfico e filtros | D-1 (03), D-4, D-11 | Pending |
| PLL-DB-07 … 11 | P1: Tabela de mentorados | D-1, D-11, D-12 | Pending |
| PLL-DB-12 … 14 | P1: Feed de registros | D-7 | Pending |
| PLL-DB-15 | P2: Análise do participante | `pll-cadastro-participantes` (staging) | Pending |
| PLL-DB-16 | P2: Análise do mandato | D-5 | Pending |
| PLL-DB-17 | P2: Afinidade de agenda temática | `pll-cadastro-participantes` (Anexo A) | Pending |
| PLL-DB-18 … 19 | P2: Painéis de análise | D-13 | Pending |
| PLL-AG-01 … 07 | P1: Grade mensal | D-6 | Pending |
| PLL-AG-08 … 12 | P1: Filtros, lista e novo agendamento | D-4, D-10, D-14 | Pending |

**ID format:** `PLL-SH` (shell), `PLL-DB` (dashboard), `PLL-AG` (agenda).

**Coverage:** 35 requisitos (4 + 19 + 12); 0 bloqueados por decisão de dado (D-2/D-3 resolvidas pela spec
irmã); PLL-DB-03 parcialmente bloqueado por D-1.

**Schema previsto (depende de D-1):** 1 coluna nova em `fat_contrato` (D-1). PLL-DB-15 e PLL-DB-17 leem a
tabela de staging que `pll-cadastro-participantes` provisiona — nenhuma tabela nova nasce **nesta** spec
por causa deles. Leitura agregada por mês de `fat_encontro` (view, sem tabela nova). **Nada disso entra
sem AD registrada.**

---

## Success Criteria

- [ ] Um `SELECT` direto no banco de dev reproduz cada KPI, cada linha da tabela e cada barra do gráfico.
- [ ] Nenhum rótulo, enum ou valor de catálogo na tela existe fora de `figma-dominio-legisla` ou do banco.
- [ ] Nenhum percentual demográfico é exibido para grupo com menos de 5 respondentes.
- [ ] `/produtos/estrategia/*` e `/produtos/coalizao/*` idênticas ao estado anterior (teste de regressão do shell).
- [ ] Nenhuma migration entra sem decisão de Pedro sobre D-1 e D-2.
- [ ] As telas ficam comparadas com `44:477` e `379:4` via `get_screenshot` antes de dar por prontas (CLAUDE.md).
