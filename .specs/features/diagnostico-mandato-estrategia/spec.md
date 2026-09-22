# Diagnóstico do Mandato (Estratégia) Specification

## Problem Statement

A aba "Diagnóstico" da ficha do mandato (produto Estratégia,
`/contratos/[id]/diagnostico`) existe hoje só como placeholder
(`EmDesenvolvimento`) — autorizado explicitamente como tal pela feature-mãe
`ficha-mandato-contrato` (FMC-04, AC6: "conteúdo é spec própria"). O time de
consultoria precisa de um retrato consolidado do cenário eleitoral e
legislativo do parlamentar num único lugar, hoje espalhado (TSE na aba
"Informações Gerais") ou inexistente (composição partidária da casa,
destaques, SWOT).

## Goals

- [ ] Consolidar todo conteúdo de diagnóstico eleitoral/legislativo do
      mandato na aba "Diagnóstico", tirando o bloco de TSE da aba
      "Informações Gerais"
- [ ] Mostrar a composição partidária da casa legislativa do mandato vigente
      (Congresso/Assembleia/Câmara Municipal, conforme o cargo)
- [ ] Permitir registrar, em texto livre editável, Principais Destaques,
      Cargos na Legislatura, Principais PLs, Principais Notícias e uma
      Análise SWOT do mandato

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Novo componente de gráfico (chart lib) para a composição partidária | Pedro escolheu manter o padrão de lista com barras já usado no PLL (`ComposicaoPartidariaCasa`), não um chart via Recharts. Reaproveitar, não recriar. |
| Histórico de diagnóstico por ano/candidatura | Pedro confirmou que os campos novos (destaques, cargos, PLs, notícias, SWOT) são por mandato (`dim_mandato`), um valor vigente só, sem versionamento por ciclo eleitoral. |
| Consumo dos registros operacionais de Diagnóstico já existentes (Mapa Político, Escuta Diagnóstica, Diagnóstico de Organograma — `fat_registro`/`fat_artefato`) | Pedro não mencionou esses registros; o pedido é conteúdo estático novo. Ver nota em Assumptions. |
| Edição/remoção do card "Análise SWOT" já usado no PLL (`editor-swot.tsx`) | Componente é reaproveitado como está (props já genéricas), não alterado. |
| Alterar a ordem/nome das 8 abas da ficha do contrato | Fora do escopo — só o conteúdo interno da aba Diagnóstico muda. |
| Validação de URL "ao vivo" (fetch/HEAD request) em Principais Notícias | Validação é só de formato (URL bem formada), sem checar se o link resolve. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Forma visual da composição partidária | Lista com barras (reaproveita o padrão de `produtos/pll/participantes/[id]/page.tsx:177-202`, extraído para componente compartilhado) | Decisão explícita do Pedro via pergunta direta | y |
| Granularidade dos campos novos | Por mandato (`dim_mandato`), não por candidatura/ano | Decisão explícita do Pedro via pergunta direta | y |
| Estrutura de "Principais Notícias" | Lista de itens `{titulo, url}` | Decisão explícita do Pedro via pergunta direta | y |
| Tipo de coluna para Principais Destaques / Cargos na Legislatura / Principais PLs | `TEXT[]`, editor de tags (mesmo padrão de `principais_pautas` em `card-sobre-mandato.tsx`) | Mesma natureza de dado (lista curta de itens de texto), reaproveita padrão já validado no sistema; nenhum desses 3 campos precisa de estrutura além de um rótulo | Não perguntado à parte — assumido por analogia direta com `principais_pautas`, mesmo card de referência que o Pedro já usa hoje |
| Tipo de coluna para "Principais Notícias" | `JSONB` (array de objetos `{titulo, url}`), com `CHECK (jsonb_typeof(...) = 'array')` | Único campo novo que não é lista de string simples; `TEXT[]` não comporta par título+URL. JSONB para conteúdo de exibição (não pesquisado por chave) já tem precedente em `fat_registro.conteudo` | Não perguntado à parte — decorre diretamente da decisão "lista de título + URL" já confirmada |
| SWOT do mandato reaproveita `EditorSwot`/`editor-lista-texto.tsx` como estão | Sim, sem alterar os componentes; só nova instância com props ligadas a `dim_mandato` | Componente já é genérico (`forcas/fraquezas/oportunidades/ameacas: string[]`), testado, e é o mesmo card do Figma (4 quadrantes) | Assumido — nenhuma divergência de forma encontrada entre o Figma e o componente existente |
| Terceiro uso do conceito "SWOT" no sistema | Registrar como terceiro uso independente (após SWOT antigo removido do Planejamento por AD-049, e SWOT atual do PLL em `cad_participante_pll`) | Evita reabrir AD-049 ou confundir o SWOT do mandato com o do PLL — são conceitos análogos mas armazenados em tabelas/entidades diferentes | Assumido, a registrar como decisão nova (não reabre AD-049) |
| Diagnóstico "operacional" (Mapa Político, Escuta Diagnóstica, Organograma) | Fora de escopo desta feature — aba Diagnóstico passa a ter conteúdo estático (TSE + composição partidária + campos livres + SWOT), sem tocar nos registros de `fat_registro`/`fat_artefato` | Pedro não mencionou esses registros no pedido; misturar os dois exigiria decisão de produto não solicitada | Assumido, sinalizado ao Pedro no fechamento da spec — avisar se for divergência não desejada |
| Remoção total do bloco TSE da aba "Informações Gerais" | Sim — bloco `InformacoesTseMandato` sai inteiramente de `informacoes/page.tsx` e passa a ser renderizado só em `diagnostico/page.tsx` | Pedro foi explícito: "as informações do TSE agora pertencem a esta aba e não mais a aba de informações gerais" | y (literal no pedido) |
| Cargo → tipo de casa (rótulo de contexto do gráfico) | Deputado Federal → "Congresso Nacional"; Deputado Estadual/Distrital → "Assembleia Legislativa"; Vereador → "Câmara Municipal" | Mapeamento literal dado pelo Pedro no pedido | y (literal no pedido) |
| Permissão de edição dos campos novos | Mesma regra de acesso já aplicada a `CardSobreMandato` (usuário autenticado com acesso à ficha do contrato; sem papel/role adicional) | Nenhum papel novo foi pedido; os campos são análogos a `minibiografia`/`principais_pautas`, que não têm controle de acesso diferenciado hoje | Assumido — sinalizar se Pedro quiser diferenciar |
| Mandato sem candidatura vigente com `cd_cargo`/`sg_uf`/`ano_eleicao` resolvíveis | Gráfico de composição partidária mostra estado vazio (`EstadoVazio`), sem quebrar a aba | Mesmo padrão defensivo já usado em `buscarComposicaoPartidariaCasa` (retorna `[]`, nunca lança erro) e em outros cards da ficha (`CardHistoricoContratos`, etc.) | Assumido por consistência com o resto do sistema |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Mover TSE para Diagnóstico ⭐ MVP

**User Story**: Como consultor político, quero ver as candidaturas do TSE do
parlamentar na aba Diagnóstico (não mais em Informações Gerais), para que o
histórico eleitoral fique junto do resto do diagnóstico do mandato.

**Why P1**: É a mudança estrutural pedida primeiro pelo Pedro; sem ela, as
duas abas ficam com conteúdo duplicado/mal posicionado.

**Acceptance Criteria**:

1. WHEN um usuário abre a aba "Diagnóstico" de um contrato do tipo mandato
   THEN o sistema SHALL exibir o card "Candidaturas no TSE"
   (`InformacoesTseMandato`) com o mesmo comportamento de hoje (accordion por
   ano, 3 sub-cards: Desempenho Eleitoral, Perfil Pessoal, Eleitorado da
   Base)
2. WHEN um usuário abre a aba "Informações Gerais" do mesmo contrato THEN o
   sistema SHALL **não** exibir mais o card "Candidaturas no TSE"
3. WHEN o mandato não tem nenhuma candidatura no TSE THEN o card em
   Diagnóstico SHALL mostrar o mesmo estado vazio que `InformacoesTseMandato`
   já trata hoje (sem alterar esse comportamento interno)

**Independent Test**: Abrir a ficha de um mandato com candidaturas TSE
cadastradas; verificar que o card aparece em Diagnóstico e não aparece mais
em Informações Gerais.

---

### P1: Composição Partidária da Casa ⭐ MVP

**User Story**: Como consultor político, quero ver o percentual de cadeiras
por partido na casa legislativa do mandato vigente, para entender o cenário
de forças com que o parlamentar convive.

**Why P1**: É o pedido central da feature — dado que já existe no TSE
(`buscarComposicaoPartidariaCasa`) mas nunca foi exposto na ficha do mandato
em Estratégia.

**Acceptance Criteria**:

1. WHEN a aba Diagnóstico carrega e o mandato tem uma candidatura vigente
   (`eh_mandato_vigente = true`) com `cd_cargo`/`sg_uf`/`ano_eleicao`
   resolvíveis THEN o sistema SHALL exibir um card "Configuração Partidária
   da Casa" com a lista de partidos e seus percentuais de cadeiras,
   ordenados do maior para o menor percentual (reaproveitando
   `buscarComposicaoPartidariaCasa`)
2. WHEN o cargo da candidatura vigente é Deputado Federal THEN o rótulo de
   contexto do card SHALL ser "Congresso Nacional"
3. WHEN o cargo é Deputado Estadual ou Distrital THEN o rótulo SHALL ser
   "Assembleia Legislativa"
4. WHEN o cargo é Vereador THEN o rótulo SHALL ser "Câmara Municipal"
5. WHEN o mandato não tem candidatura vigente, ou a candidatura vigente não
   tem `cd_cargo`/`sg_uf`/`ano_eleicao` resolvíveis, ou a query retorna lista
   vazia THEN o sistema SHALL exibir um estado vazio no card, sem lançar
   erro nem quebrar o restante da aba
6. WHEN a lista de partidos inclui o agregado "Outros" (partidos <3%, já
   calculado por `buscarComposicaoPartidariaCasa`) THEN o sistema SHALL
   exibi-lo como um item normal da lista, ao final

**Independent Test**: Abrir a ficha de um mandato com candidatura vigente
conhecida (cargo, UF, ano); verificar que o card mostra os partidos e
percentuais corretos e o rótulo de casa esperado para aquele cargo.

---

### P1: Campos de texto livre do Diagnóstico ⭐ MVP

**User Story**: Como consultor político, quero registrar Principais
Destaques, Cargos na Legislatura, Principais PLs e Principais Notícias do
mandato, para consolidar essas informações num lugar único e editável.

**Why P1**: Parte central do pedido — sem esses campos a aba não cumpre o
propósito de "diagnóstico consolidado".

**Acceptance Criteria**:

1. WHEN um usuário abre a aba Diagnóstico THEN o sistema SHALL exibir um
   card com os campos Principais Destaques, Cargos na Legislatura e
   Principais PLs, cada um como lista de tags de texto curto (mesmo padrão
   visual/interação de "Principais Pautas" em `CardSobreMandato`)
2. WHEN um usuário clica em "Editar" nesse card THEN o sistema SHALL permitir
   adicionar/remover itens de cada uma das 3 listas independentemente
3. WHEN um usuário salva o card THEN o sistema SHALL persistir os 3 campos
   em `dim_mandato` (colunas `TEXT[]`, `NULL` quando lista vazia — nunca
   array vazio, mesma convenção de `principais_pautas`)
4. WHEN um usuário abre a aba Diagnóstico THEN o sistema SHALL exibir um
   card "Principais Notícias" com a lista de notícias já cadastradas (título
   como texto do link, apontando para a URL)
5. WHEN um usuário adiciona uma notícia THEN o sistema SHALL exigir título
   (texto não vazio) e URL; a URL SHALL ser validada como URL bem formada
   (`http://` ou `https://`) antes de permitir salvar
6. WHEN a URL informada não é válida THEN o sistema SHALL mostrar erro
   inline e impedir o salvamento até corrigir
7. WHEN um usuário salva THEN o sistema SHALL persistir a lista de notícias
   em `dim_mandato.principais_noticias` (`JSONB`, array de
   `{titulo, url}`, `NULL` quando lista vazia)
8. WHEN nenhum dos campos acima tem valor THEN o sistema SHALL mostrar "—"
   ou estado vazio equivalente ao padrão já usado em `CardSobreMandato`,
   nunca uma seção quebrada ou undefined visível

**Independent Test**: Editar e salvar cada um dos 4 campos numa ficha de
mandato; recarregar a página e confirmar que os valores persistiram.
Tentar salvar uma notícia com URL inválida e confirmar que é bloqueado.

---

### P1: Análise SWOT do mandato ⭐ MVP

**User Story**: Como consultor político, quero registrar a análise SWOT
(Forças, Fraquezas, Oportunidades, Ameaças) do mandato na aba Diagnóstico,
reaproveitando o card já usado no PLL, para consolidar essa visão
estratégica no mesmo lugar.

**Why P1**: É o card mostrado no mockup do Figma anexado ao pedido do Pedro;
o componente já existe pronto (`EditorSwot`), só falta a nova coluna e a
integração na ficha do mandato.

**Acceptance Criteria**:

1. WHEN um usuário abre a aba Diagnóstico THEN o sistema SHALL exibir o card
   "Análise SWOT" com os 4 quadrantes (Forças, Fraquezas, Oportunidades,
   Ameaças), reaproveitando `EditorSwot` sem alterar seu comportamento
2. WHEN um usuário edita e salva qualquer quadrante THEN o sistema SHALL
   persistir os 4 campos em `dim_mandato` (colunas `TEXT[]`:
   `swot_forcas`, `swot_fraquezas`, `swot_oportunidades`, `swot_ameacas`),
   seguindo a mesma convenção de nulo-quando-vazio dos demais campos desta
   feature
3. WHEN o mandato não tem nenhum item cadastrado em um quadrante THEN esse
   quadrante SHALL aparecer vazio (sem itens), não com erro

**Independent Test**: Adicionar itens nos 4 quadrantes de uma ficha de
mandato, salvar, recarregar a página e confirmar que os itens persistiram
exatamente como cadastrados.

---

## Edge Cases

- WHEN o contrato não é do tipo `mandato` (ex.: coalizão) THEN a aba
  Diagnóstico SHALL continuar funcionando como hoje para esse tipo — esta
  feature só adiciona conteúdo para contratos de mandato (o chrome já
  restringe "Informações Gerais" a mandato; Diagnóstico é comum a ambos, mas
  os novos cards desta feature só fazem sentido/são buscados para mandato)
- WHEN dois usuários editam o mesmo card simultaneamente THEN o sistema
  SHALL seguir o padrão já existente no projeto para esse cenário (last
  write wins via `update` direto no Supabase — mesmo comportamento de
  `CardSobreMandato` hoje; não é escopo desta feature introduzir lock
  otimista)
- WHEN a lista de "Principais Notícias" tem uma URL com espaços em branco
  nas pontas THEN o sistema SHALL aparar (`trim()`) antes de validar e
  salvar (mesma convenção de `adicionarPauta` em `CardSobreMandato`)
- WHEN o título de uma notícia é só espaços em branco THEN o sistema SHALL
  tratar como vazio e impedir adicionar o item (mesma convenção de
  `adicionarPauta`)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DIAG-01 | P1: Mover TSE para Diagnóstico | Design | Pending |
| DIAG-02 | P1: Mover TSE para Diagnóstico | Design | Pending |
| DIAG-03 | P1: Mover TSE para Diagnóstico | Design | Pending |
| DIAG-04 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-05 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-06 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-07 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-08 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-09 | P1: Composição Partidária da Casa | Design | Pending |
| DIAG-10 | P1: Campos de texto livre | Design | Pending |
| DIAG-11 | P1: Campos de texto livre | Design | Pending |
| DIAG-12 | P1: Campos de texto livre | Design | Pending |
| DIAG-13 | P1: Campos de texto livre | Design | Pending |
| DIAG-14 | P1: Campos de texto livre | Design | Pending |
| DIAG-15 | P1: Campos de texto livre | Design | Pending |
| DIAG-16 | P1: Campos de texto livre | Design | Pending |
| DIAG-17 | P1: Campos de texto livre | Design | Pending |
| DIAG-18 | P1: Análise SWOT | Design | Pending |
| DIAG-19 | P1: Análise SWOT | Design | Pending |
| DIAG-20 | P1: Análise SWOT | Design | Pending |

**ID format:** `DIAG-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 total, 0 mapped to tasks, 20 unmapped ⚠️ (mapeamento ocorre
na fase Design)

---

## Success Criteria

- [ ] Ficha de mandato com candidaturas TSE mostra o card só em Diagnóstico,
      nunca mais em Informações Gerais
- [ ] Card "Configuração Partidária da Casa" mostra dados corretos para os 3
      tipos de cargo (federal/estadual/vereador) e trata ausência de
      candidatura vigente sem quebrar a tela
- [ ] Os 5 campos novos (Destaques, Cargos, PLs, Notícias, SWOT) são
      editáveis, persistem em `dim_mandato` e sobrevivem a reload de página
- [ ] Nenhuma regressão nos demais cards de Informações Gerais nem nos
      testes existentes de `informacoes-tse-mandato.tsx`,
      `card-sobre-mandato.tsx`, `editor-swot.tsx` e `tse.ts`
