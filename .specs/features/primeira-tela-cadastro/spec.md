# Primeira Tela de Cadastro Specification

## Problem Statement

A feature Fundação (cadastro de Mandato/Coalizão, edição de detalhe, gestão de assessores) já existe e funciona, mas não tem porta de entrada: não existe nenhuma tela de listagem — só `/mandatos/novo` e `/mandatos/[id]` (idem `/coalizoes`). Além disso, a tela de detalhe do mandato mostra só *metadados do match* TSE (ano, status, confiança), nunca os dados reais de votação — apesar de o schema TSE ter muito mais disponível (perfil completo da candidatura em `tse.dim_candidatura`, perfil demográfico do eleitorado em `tse.dim_perfil_eleitorado`) que hoje não é consumido em lugar nenhum. E o app inteiro, incluindo o `/login`, ainda usa o tema padrão do shadcn (cinza/zinco, fonte Geist) — nada da identidade visual da marca (`Identidade Visual Legisla.md`) está aplicado em lugar nenhum.

## Goals

- [ ] Gestora/Admin consegue ver todos os mandatos e todas as coalizões cadastrados numa tela de cards, e navegar de lá pro detalhe de qualquer um ou pro cadastro de um novo.
- [ ] O detalhe do mandato mostra um perfil TSE rico e visualmente interessante pra cada candidatura vinculada — total de votos e município principal em destaque, perfil pessoal da candidatura (idade, gênero, raça/cor, escolaridade, ocupação, coligação) e um retrato do perfil demográfico do eleitorado do município principal — não só o status do match.
- [ ] Todo o app (incluindo `/login`) usa a identidade visual da marca (cores, tipografia Anton/Commissioner, cards arredondados) através de um tema global, com uma sidebar fixa de navegação.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| ------- | ------ |
| Redesenho funcional do wizard de cadastro (`MandatoWizard`/`CoalizaoForm`) ou das telas de detalhe existentes | Decisão do usuário: reaproveitar como estão, só ganham o tema novo por cima. Já validados (`validation.md` da feature Fundação), reabrir a UX arriscaria reintroduzir os 5 itens "Needs Fix" já fechados como débito conhecido. |
| Contrato próprio + gestão de assessores para Coalizão | Schema permite (uma coalizão pode ter `fat_contrato` como qualquer `dim_contratante`), mas a UI de Fundação nunca expôs esse fluxo pra coalizão (só mandato tem "Novo contrato" → vínculos). Não foi pedido nesta feature — só o caso de mandato ("no caso dos mandatos consumir as bases do tse"). |
| Filtro/busca textual ou paginação na listagem em cards | V1 lista tudo sem filtro. Se o volume de mandatos/coalizões crescer a ponto de a lista ficar pesada, isso vira uma feature própria depois. |
| Logo oficial da Legisla Brasil | A própria doc de identidade visual diz que o usuário substitui o placeholder pelo SVG oficial depois — aqui entra só o ícone de bandeira/pennant como marcador. |
| Corrigir os 5 itens "Needs Fix" da feature Fundação (FND-TSE-01/FND-TSM-01, FND-CTR-05, FND-USR-02, FND-COL-03) | Débito conhecido e documentado em `validation.md` daquela feature, não bloqueante. Fora do pedido desta feature. |
| Itens de navegação na sidebar além do que já existe hoje (Mandatos, Coalizões, Usuários) | Não existem outras telas ainda (Planejamento, Incidência, Operação são camadas futuras, §2 da Constituição). Sidebar cresce quando essas features existirem. |
| Adoção de `@tanstack/react-table`/`@tanstack/react-query` (AD-021) | A tela de cards é um grid de cards, não uma tabela editável (o caso de uso que AD-021 mira) — segue o padrão já usado nas telas de Fundação (fetch direto + `useState`). Fica pra quando uma tela realmente precisar de tabela grande/editável. |
| Redes sociais declaradas da candidatura (`tse.rel_rede_social`) | Perguntado ao usuário entre 4 blocos de conteúdo TSE — não foi escolhido. Fica disponível pra entrar depois, se quiser. |
| Leitura direta de `tse.fat_votacao_zona` (voto por zona/município) em qualquer camada da aplicação | O próprio schema documenta essa tabela como grande (~4,3GB na safra 2022) e determina que "a operação nunca lê esta tabela direto" — todo dado de votação exibido nesta feature vem de `tse.mv_candidatura_resumo` (já agregada) ou de uma nova view agregada equivalente, nunca de uma query direta a `fat_votacao_zona`. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| ---------------------- | --------------- | --------- | ---------- |
| Reaproveitar cadastro/detalhe existentes vs. redesenhar | Reaproveitar como estão; a feature nova só adiciona o que falta (listagem + dados TSE) e aplica o tema por cima | Perguntado direto ao usuário — escolheu reaproveitar | y |
| Escopo da identidade visual | App inteiro (tema global via CSS vars), não só telas novas | Perguntado direto ao usuário — escolheu app inteiro, inclusive telas já existentes (cadastro, vínculos, usuários) | y |
| Sidebar/app shell | Montar agora, com os itens de nav que já existem hoje (Mandatos, Coalizões, Usuários) + logo placeholder | Perguntado direto ao usuário — escolheu montar agora | y |
| Acesso a assessores no detalhe do mandato | Link pra tela já existente (`/contratos/[id]/vinculos`), que já existe e funciona por contrato do mandato | Perguntado direto ao usuário — escolheu reaproveitar o link existente, sem embutir a gestão inline | y |
| Filtro/busca/paginação na listagem em cards | Nenhum em V1 — lista completa, sem paginação | Não perguntado explicitamente; risco baixo (poucos mandatos/coalizões esperados no uso atual), decisão documentada para não bloquear a spec. Revisitar se a lista crescer. | n (default, sem objeção esperada) |
| Quais campos aparecem no card de mandato/coalizão | Mandato: nome (nome de urna se houver, senão nome do contratante), UF, partido atual, cargo atual (campos ausentes por `NULL`, AD-005, aparecem como "—"). Coalizão: nome, UF, município. | Campos mínimos já disponíveis em `dim_contratante`/`dim_mandato` sem exigir novas queries; suficiente pra reconhecer o card antes de abrir o detalhe. | n (default) |
| Quais blocos de conteúdo TSE aparecem no detalhe do mandato | 3 blocos, escolhidos pelo usuário entre 4 opções apresentadas: (1) KPI de total de votos + município principal (`tse.mv_candidatura_resumo`); (2) perfil pessoal da candidatura — idade calculada de `dt_nascimento`, `ds_genero`, `ds_cor_raca`, `ds_grau_instrucao`, `ds_ocupacao`, `nm_coligacao` (`tse.dim_candidatura`); (3) perfil demográfico do eleitorado do município principal — gênero, faixa etária e escolaridade agregados (nova view sobre `tse.dim_perfil_eleitorado`). Redes sociais (`tse.rel_rede_social`) foi oferecido e **não** escolhido — fica de fora (ver Out of Scope). | Perguntado diretamente ao usuário com um menu de 4 blocos possíveis — pedido explícito era "trazer total de votos, perfil eleitorado e outra info que achar pertinente" pra uma entrega esteticamente interessante | y |
| Nova view agregada sobre `tse.dim_perfil_eleitorado` (perfil do eleitorado do município) | Migração nova, incremental (AD-025), somando `qt_eleitores` por `sg_uf`+`cd_municipio`+`ano_eleicao`+`ds_genero`/`ds_faixa_etaria`/`ds_grau_escolaridade` — nunca lida crua da UI | Necessária porque não existe hoje nenhuma consulta pronta pra esse agregado, e a tabela é particionada/grande o bastante pra não ser prudente agregar no cliente a cada carregamento de tela | y (decorre da escolha acima) |
| Onde a sidebar aparece | Em toda tela autenticada (reaproveitando o gate de auth já existente no `proxy.ts`); `/login` fica sem sidebar (rota pública, pré-sessão) | Consistente com o padrão já usado no app — sidebar de navegação não faz sentido antes de ter sessão | n (default) |
| Anton só em títulos grandes/KPIs, Commissioner no resto | Segue literalmente a regra da `Identidade Visual Legisla.md` | Documento fornecido pelo usuário já define isso explicitamente | y (fonte: doc anexado) |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Visualizar mandatos e coalizões cadastrados em cards ⭐ MVP

**User Story**: Como Gestora/Admin, quero ver todos os mandatos e todas as coalizões já cadastrados numa tela de cards, para ter uma visão rápida de quem já está no sistema e navegar direto pro cadastro de um novo ou pro detalhe de um existente.

**Why P1**: É o pedido direto do usuário — hoje não existe nenhuma porta de entrada visual pro que já foi cadastrado.

**Acceptance Criteria**:

1. WHEN a Gestora/Admin acessa `/mandatos` THEN o sistema SHALL exibir um card por mandato cadastrado, mostrando nome (nome de urna se preenchido, senão o nome do contratante), UF, partido atual e cargo atual (cada campo ausente exibido como `—`, nunca string vazia — AD-005).
2. WHEN a Gestora/Admin acessa `/coalizoes` THEN o sistema SHALL exibir um card por coalizão cadastrada, mostrando nome, UF e município (mesma regra de campo ausente).
3. WHEN não há nenhum mandato (ou nenhuma coalizão) cadastrado THEN o sistema SHALL exibir um estado vazio com um botão "Cadastrar mandato" (ou "Cadastrar coalizão"), sem exibir erro.
4. WHEN a Gestora/Admin clica em um card THEN o sistema SHALL navegar pra tela de detalhe correspondente já existente (`/mandatos/[id]` ou `/coalizoes/[id]`), sem alteração nessas telas.
5. WHEN a Gestora/Admin clica no botão "Novo" na listagem THEN o sistema SHALL navegar pro wizard de cadastro já existente (`/mandatos/novo` ou `/coalizoes/novo`), sem alteração nesses fluxos.

**Independent Test**: Cadastrar 1 mandato e 1 coalizão (fluxo já existente), abrir `/mandatos` e `/coalizoes`, confirmar que cada um aparece como card com os dados corretos, clicar no card e confirmar que abre o detalhe certo; com o banco vazio, confirmar o estado vazio com CTA.

---

### P1: Ver um perfil TSE rico no detalhe do mandato ⭐ MVP

**User Story**: Como Gestora/Admin, quero ver um perfil eleitoral rico de cada candidatura TSE vinculada ao mandato — votação, perfil pessoal da candidatura e perfil do eleitorado que a elegeu — para entender o histórico eleitoral da pessoa de forma visualmente interessante, não só se o sistema conseguiu confirmar o match.

**Why P1**: É o pedido direto do usuário — "consumir as bases do TSE" de um jeito que demonstre isso de forma estética e funcional, não só um campo de status.

**Acceptance Criteria**:

1. WHEN a Gestora/Admin abre `/mandatos/[id]` THEN o sistema SHALL exibir, para cada candidatura vinculada em `rel_mandato_candidatura`, um bloco de **votação** com `qt_votos_total` em destaque e o município principal (`nm_municipio_principal`), consultados em `tse.mv_candidatura_resumo` (chave: `ano_eleicao`+`sq_candidato`+`nr_turno`) — junto com os campos que já existem hoje (ano, status do match, confiança, vigente).
2. WHEN a Gestora/Admin abre `/mandatos/[id]` THEN o sistema SHALL exibir, para cada candidatura vinculada, um bloco de **perfil pessoal da candidatura**: idade (calculada a partir de `dt_nascimento`), `ds_genero`, `ds_cor_raca`, `ds_grau_instrucao`, `ds_ocupacao` e `nm_coligacao`, consultados em `tse.dim_candidatura`.
3. WHEN a Gestora/Admin abre `/mandatos/[id]` THEN o sistema SHALL exibir, para cada candidatura vinculada com município principal identificado, um bloco de **perfil do eleitorado** desse município no ano da eleição — distribuição por gênero, faixa etária e escolaridade — consultado numa view agregada sobre `tse.dim_perfil_eleitorado` (nunca lendo a tabela particionada crua).
4. WHEN qualquer campo de qualquer um dos 3 blocos não tem correspondência ou está ausente (candidatura sem match real, `tse.dim_candidatura`/`tse.dim_perfil_eleitorado` sem linha correspondente, ou o próprio dado de origem é `NULL`) THEN o sistema SHALL exibir esse campo/bloco como indisponível (`—` no campo, ou o bloco inteiro omitido quando não há município principal), sem quebrar a tela nem lançar erro.
5. WHEN as fontes TSE (`mv_candidatura_resumo`, `dim_candidatura`, ou a nova view de perfil do eleitorado) estão vazias ou inacessíveis (falha externa) THEN o sistema SHALL aplicar a mesma regra do item 4 para todas as candidaturas da tela — nenhum crash, mesmo comportamento de dado ausente.

**Independent Test**: Abrir o detalhe de um mandato com uma candidatura vinculada cujo `sq_candidato`/`ano_eleicao`/`nr_turno` bate com uma linha real de `tse.dim_candidatura`/`mv_candidatura_resumo`, confirmar que os 3 blocos aparecem com dado real (votos, perfil pessoal, perfil do eleitorado do município); testar também com uma candidatura vinculada manualmente (sem match TSE real) e confirmar que os blocos aparecem como indisponíveis/omitidos sem quebrar a tela.

---

### P1: Aplicar a identidade visual da marca no app inteiro ⭐ MVP

**User Story**: Como usuário de qualquer papel, quero que o app (incluindo o login) use a identidade visual da Legisla Brasil, para que a ferramenta pareça pertencer à organização, não ao template padrão do Next.js/shadcn.

**Why P1**: Pedido explícito do usuário, incluindo atualizar a tela de login já existente.

**Acceptance Criteria**:

1. WHEN qualquer tela do app carrega THEN o sistema SHALL usar a paleta de cores da marca (verde `#035252`, vinho `#571730`, bege `#FFD278`, coral `#EB5454`, turquesa `#4ABFB2`, roxo `#BA6BED`, neutros de `Identidade Visual Legisla.md`) via variáveis de tema globais — sem exigir alteração individual em cada tela existente.
2. WHEN qualquer tela do app carrega THEN o sistema SHALL usar Anton (Google Fonts) para títulos grandes de página e números de KPI (caixa alta) e Commissioner (Google Fonts) para o restante do texto.
3. WHEN a Gestora/Admin está autenticado e navega por qualquer tela THEN o sistema SHALL exibir uma sidebar fixa com um espaço reservado pro logo "Legisla Brasil" (ícone de bandeira/pennant como marcador) e links para Mandatos, Coalizões e Usuários.
4. WHEN um usuário não autenticado acessa `/login` THEN o sistema SHALL exibir essa tela com a identidade visual nova, sem a sidebar (rota pública, pré-sessão).
5. WHEN um card (de mandato, coalizão, ou qualquer outro) é exibido THEN o sistema SHALL usar cantos arredondados (raio ~12–16px) e sombra leve, com hover perceptível.
6. WHEN a tela de detalhe do mandato (já existente) é exibida após esta mudança THEN o link "Vínculos" de cada contrato SHALL continuar funcionando exatamente como hoje — reskin visual não pode quebrar navegação existente.

**Independent Test**: Abrir `/login`, `/mandatos`, `/mandatos/[id]`, `/coalizoes`, `/usuarios` e confirmar visualmente a paleta/tipografia/sidebar em todas; clicar no link "Vínculos" de um contrato e confirmar que ainda navega corretamente.

---

## Edge Cases

- WHEN há muitos mandatos ou coalizões cadastrados THEN o sistema SHALL exibir a lista completa sem paginação em V1 (Out of Scope: filtro/paginação — ver tabela acima).
- WHEN um usuário não autenticado tenta acessar `/mandatos` ou `/coalizoes` THEN o sistema SHALL redirecionar pro login (comportamento já existente do `proxy.ts`, AD-002 — sem mudança).
- WHEN qualquer fonte TSE (`mv_candidatura_resumo`, `dim_candidatura`, view de perfil do eleitorado) está vazia, indisponível, ou sem correspondência pra uma candidatura THEN o sistema SHALL tratar como dado ausente (`—`) ou bloco omitido, nunca erro — ver AC4/AC5 da história de perfil TSE.
- WHEN `dt_nascimento` é `NULL` em `tse.dim_candidatura` THEN o sistema SHALL exibir a idade como indisponível (`—`), nunca calcular uma idade errada.
- WHEN não há município principal identificável pra uma candidatura (sem linhas em `tse.fat_votacao_zona`, refletido em `mv_candidatura_resumo.nm_municipio_principal = NULL`) THEN o sistema SHALL omitir o bloco de perfil do eleitorado por completo pra essa candidatura, em vez de mostrar um bloco vazio.
- WHEN um campo do card (partido, cargo, UF, município) é `NULL` no banco THEN o sistema SHALL exibir `—`, nunca string vazia (AD-005).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --------------- | ----- | ----- | ------- |
| CAD-01 | P1: cards de mandato (AC1 — dados do card) | Execute | ✅ Verified |
| CAD-02 | P1: cards de mandato (AC3 — estado vazio) | Execute | ✅ Verified |
| CAD-03 | P1: cards de mandato (AC4 — navega pro detalhe) | Execute | ✅ Verified |
| CAD-04 | P1: cards de mandato (AC5 — navega pro cadastro) | Execute | ✅ Verified |
| CAD-05 | P1: cards de coalizão (AC2 — dados do card) | Execute | ✅ Verified |
| CAD-06 | P1: cards de coalizão (AC3 — estado vazio) | Execute | ✅ Verified |
| CAD-07 | P1: cards de coalizão (AC4 — navega pro detalhe) | Execute | ✅ Verified |
| CAD-08 | P1: cards de coalizão (AC5 — navega pro cadastro) | Execute | ✅ Verified |
| CAD-09 | P1: perfil TSE (AC1 — bloco de votação: total + município principal) | Execute | ✅ Verified (live-confirmado contra dado real) |
| CAD-10 | P1: perfil TSE (AC2 — bloco de perfil pessoal da candidatura) | Execute | ✅ Verified (spec-precision gap não-bloqueante: data de referência da idade) |
| CAD-11 | P1: perfil TSE (AC3 — bloco de perfil do eleitorado do município, nova view) | Execute | ✅ Verified (live-confirmado contra dado real) |
| CAD-12 | P1: perfil TSE (AC4/AC5 — dado ausente/bloco omitido sem quebrar) | Execute | ✅ Verified |
| CAD-13 | P1: identidade visual (AC1/AC2 — cores/tipografia globais) | Execute | ✅ Verified |
| CAD-14 | P1: identidade visual (AC3 — sidebar fixa) | Execute | ✅ Verified |
| CAD-15 | P1: identidade visual (AC4 — login com identidade nova, sem sidebar) | Execute | ✅ Verified |
| CAD-16 | P1: identidade visual (AC5/AC6 — cards estilizados + sem regressão em Vínculos) | Execute | ⚠️ Verified — Needs Fix não-bloqueante (sombra leve ausente em repouso) |

**ID format:** `CAD-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 16 total, 16 mapeados pra Design, 0 sem mapeamento. **Verificação (2026-07-31):** 16/16 Verified — 14 sem ressalva, 1 com spec-precision gap documentado (CAD-10), 1 com Needs-Fix cosmético não-bloqueante (CAD-16). Ver `validation.md`.

---

## Success Criteria

Como sabemos que a feature foi bem-sucedida:

- [ ] Gestora/Admin abre a sidebar e chega em qualquer mandato/coalizão cadastrado em no máximo 2 cliques.
- [ ] O detalhe de um mandato com candidatura TSE real mostra votação, perfil pessoal da candidatura e perfil do eleitorado do município principal — não só o status do match.
- [ ] `/login` e todas as telas de Fundação já existentes usam a paleta de cores e tipografia da marca, sem regressão funcional (cadastro, edição, vínculos continuam funcionando).
