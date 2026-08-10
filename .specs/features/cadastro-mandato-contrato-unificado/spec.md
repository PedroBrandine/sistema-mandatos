# Cadastro de Mandato e Contrato Unificado Specification

## Problem Statement

O wizard de cadastro (`MandatoWizard`, `/mandatos/novo`) só cobre a criação da **pessoa** (`dim_contratante` + `dim_mandato` + `rel_mandato_candidatura`) e não sabe lidar com um parlamentar que já está cadastrado: como `app.criar_mandato` sempre tenta `INSERT` em `dim_mandato`, tentar reaproveitar um mandato existente (reeleição, segundo produto) esbarra no `UNIQUE` de `nr_titulo_eleitoral` e morre em erro, em vez de abrir um **novo contrato** para a pessoa já cadastrada — que é o que a Gestora realmente quer. Além disso, Produto/Projeto/Coalizão (a abertura do contrato em si) vivem numa tela totalmente separada (`/mandatos/[id]/contratos/novo`), a busca de candidatura do TSE é 3 campos de texto + tabela (não um combobox/autocomplete), o título eleitoral vindo do TSE continua editável, a Coalizão nunca teve seu próprio fluxo de abertura de contrato, e a base do TSE hoje inclui cargos fora do escopo de interesse (Executivo) que a operação não usa e não quer mais carregar.

## Goals

- [ ] Uma Gestora cadastra um mandato (via TSE ou manual) **e** abre o contrato dele (Produto, Projeto, Coalizão opcional) numa única tela, sem passar por uma segunda tela separada.
- [ ] Buscar e re-selecionar um parlamentar já cadastrado (mesmo título eleitoral) nunca mais gera erro de duplicata — o sistema reconhece o mandato existente e oferece abrir um novo contrato para ele.
- [ ] A busca de candidatura do TSE dentro do wizard é um combobox/autocomplete (digitar e escolher), não mais um formulário de filtro + tabela de resultados.
- [ ] O título eleitoral confirmado pelo TSE nunca é editável na tela.
- [ ] A base `tse.*` só contém candidaturas de cargos do Legislativo (Vereador(a), Deputado(a) Estadual, Deputado(a) Federal, Senador(a)) — o restante (Executivo e demais) é removido na origem.
- [ ] Uma Coalizão também consegue abrir seu próprio contrato (hoje só mandato tem essa tela).

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| ------- | ------ |
| Reimplementar os blocos de perfil TSE rico (votação, perfil pessoal, perfil do eleitorado) | Já existe em `/mandatos/[id]` (feature `primeira-tela-cadastro`, CAD-09 a CAD-12, Verified nesta mesma sessão). Esta feature só garante que o **wizard** não duplique esse conteúdo — a ficha detalhada continua sendo o único lugar que mostra isso. |
| Redesenho de `/mandatos` e `/coalizoes` (listagem em cards) | Já existe e já funciona (feature `primeira-tela-cadastro`). Não mexe. |
| Cadastro/edição de uma Coalizão como entidade (`CoalizaoForm`, `/coalizoes/novo`) | Fora do pedido — esta feature só adiciona a **abertura de contrato** para uma coalizão já cadastrada, não o cadastro da coalizão em si. |
| Gestão de assessores/vínculos de usuário dentro deste wizard | Fluxo próprio já existente (`/contratos/[id]/vinculos`), fora do pedido. |
| RBAC, papéis, MFA, impersonation | Fora do domínio desta feature (Plataforma, §3 da Constituição). |
| Reescrita integral da Constituição ou das Jornadas de Usuário | Só emenda pontual onde uma lacuna real for encontrada (ex.: deixar explícito 1 mandato : N contratos) — os documentos não serão redesenhados do zero. |
| Correção dos demais itens "Needs Fix" da feature Fundação não relacionados a esta (`FND-TSE-01`/`FND-TSM-01` filtro de cargo na busca — resolvido de outra forma aqui via restrição da base; `FND-CTR-05` snapshot de cargo/partido nunca populado; `FND-USR-02` RLS de Gestora criando Gestora) | Débito conhecido, documentado em `validation.md` da Fundação, não bloqueante e fora do pedido desta feature — exceto `FND-COL-03`, que entra em escopo aqui (ver User Stories) por passar a ser ativamente alcançável quando Coalizão ganhar contrato próprio. |
| Backfill/CSV do Mural, planejamento, incidência, indicadores de gestão | Camadas futuras (§2.3–2.6 da Constituição), não tocadas por esta feature. |
| Deduplicar no combobox candidaturas do mesmo `sq_candidato` em 2 turnos | Mantém o comportamento atual (uma opção por `ano_eleicao`+`sq_candidato`+`nr_turno`) — juntar por pessoa entre turnos é um refinamento futuro, não pedido. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| ---------------------- | --------------- | --------- | ---------- |
| Escopo do filtro TSE (Legislativo) | Restringir **na origem**: apagar de `tse.dim_candidatura`/`tse.fat_votacao_zona`/`tse.dim_perfil_eleitorado` os cargos fora de Vereador(a)/Deputado(a) Estadual/Deputado(a) Federal/Senador(a), e refazer as materialized views (`tse.mv_candidatura_resumo`, `tse.mv_perfil_eleitorado_candidatura`) | Perguntado direto ao usuário — escolheu a origem em vez de filtro só na aplicação, para não manter dado que a operação decidiu que não interessa mais | y |
| Chave exata de cargo pra filtrar (`cd_cargo` vs `ds_cargo`) | Confirmar contra `SELECT DISTINCT cd_cargo, ds_cargo FROM tse.dim_candidatura` **antes** de escrever o `DELETE`, na fase Design/Tasks — não assumir os códigos de `ref_cargo.cd_cargo_tse` (13/7/6/5) sem checar contra o dado real carregado | `ref_cargo.cd_cargo_tse` foi semeado por referência à documentação pública do TSE (layout `consulta_cand`), mas esta feature não confia em memória para uma operação destrutiva — precisa de confirmação factual contra a base carregada | n (vira passo obrigatório da fase Design) |
| Unificação mandato+contrato: escopo do wizard único | Um wizard só: buscar TSE (combobox) ou manual → dados do mandato → Produto/Projeto do contrato → Coalizão (opcional, se existente) | Perguntado ao usuário — escolheu wizard único em vez de dois passos conectados | y |
| Vínculo com Coalizão dentro do wizard do mandato | Sim, como passo opcional dentro do mesmo wizard (selecionar coalizão existente + papel) | Perguntado ao usuário — escolheu trazer para o wizard em vez de manter só na tela da coalizão | y |
| Abertura de contrato para Coalizão como contratante | Sim, nova tela/fluxo — reaproveita `ContratoForm` (já é agnóstico de tipo de contratante, só recebe `idContratante`) | Perguntado ao usuário — escolheu incluir, hoje essa tela não existe pra coalizão | y |
| Chave de detecção de "mandato já existe" | `dim_mandato.nr_titulo_eleitoral` — a "única chave estável de pessoa entre eleições" já documentada no próprio schema (`COMMENT ON COLUMN dim_mandato.nr_titulo_eleitoral`). Se o título vier vazio/nulo (candidatura sem título ou cadastro manual sem título), não há como detectar duplicidade de pessoa — tratado sempre como mandato novo | O schema já define essa coluna como a chave estável; usar `sq_candidato`/`rel_mandato_candidatura` não ajudaria porque `sq_candidato` muda a cada eleição para a mesma pessoa | y |
| `FND-COL-03` (seletor de membro da coalizão lista `fat_contrato` sem filtrar `tipo_contratante='mandato'`) | Corrigir nesta feature | Estava documentado como débito não-bloqueante porque nenhuma coalizão tinha contrato próprio ainda — ao dar contrato próprio à Coalizão (Goal desta feature), o bug passa a ser ativamente alcançável (uma coalizão apareceria como opção de "membro" de si mesma ou de outra), então precisa ser corrigido junto | y (decorre da escolha acima) |
| Dropdowns que o usuário reporta como quebrados (Cargo/Partido/Produto/Projeto) | Reproduzir no navegador durante Design/Execute antes de decidir a causa — grants/RLS de `ref_cargo`/`ref_partido`/`ref_produto`/`ref_projeto` já conferidos no SQL e parecem corretos (leitura ampla, sem RLS, catálogo) | Não assumir causa-raiz sem reproduzir; pode ser estado do ambiente do usuário (banco sem seed) ou bug de runtime do componente | n (vira passo obrigatório da fase Design/Execute) |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Reaproveitar mandato existente ao abrir um novo contrato ⭐ MVP

**User Story**: Como Gestora, quero que o sistema reconheça um parlamentar já cadastrado (mesmo título eleitoral) e me leve direto para abrir um novo contrato para ele, para poder registrar reeleição ou um segundo produto sem esbarrar em erro de duplicata.

**Why P1**: É o bug relatado diretamente pelo usuário — hoje é impossível dar continuidade a um segundo contrato do mesmo mandato pelo wizard.

**Acceptance Criteria**:

1. WHEN a Gestora seleciona, no combobox de busca do TSE, uma candidatura cujo `nr_titulo_eleitoral` já existe em `dim_mandato.nr_titulo_eleitoral` THEN o sistema SHALL pular a etapa de criação do mandato, exibir um aviso ("Este mandato já está cadastrado — você está abrindo um novo contrato para ele") com o nome e dados básicos do mandato existente, e levar direto para a etapa de abertura de contrato (Produto/Projeto/Coalizão) associada a esse `id_contratante` existente.
2. WHEN a Gestora está no cadastro manual (sem TSE) e digita um `nr_titulo_eleitoral` que já existe em `dim_mandato.nr_titulo_eleitoral` THEN o sistema SHALL aplicar o mesmo comportamento do item 1 (detecção e redirecionamento para novo contrato), em vez de deixar o formulário prosseguir para um `INSERT` que falharia.
3. WHEN a Gestora confirma a abertura do novo contrato para um mandato existente (itens 1/2) THEN o sistema SHALL criar apenas um novo `fat_contrato` (e, se selecionado, um `rel_coalizao_membro`) — nenhuma linha nova é criada em `dim_contratante`, `dim_mandato` ou `rel_mandato_candidatura`.
4. WHEN o `nr_titulo_eleitoral` da candidatura selecionada ou digitada é nulo/vazio THEN o sistema SHALL seguir o fluxo normal de cadastro de mandato novo (sem checagem de duplicidade por título, já que não há chave estável para comparar).
5. WHEN, apesar da checagem prévia (itens 1/2), a criação ainda assim colidir com `dim_mandato_nr_titulo_eleitoral_key` (condição de corrida: outra sessão cadastrou o mesmo título entre a checagem e o envio) THEN o sistema SHALL mostrar a mesma mensagem amigável já mapeada em `mapeiaErroRpc` ("Já existe um mandato cadastrado com este título eleitoral.") com uma ação para "ver mandato existente / abrir contrato para ele", nunca um erro cru de banco.

**Independent Test**: Cadastrar um mandato pelo wizard (via TSE ou manual) com um título eleitoral X; reabrir o wizard e buscar/selecionar (ou digitar manualmente) a mesma pessoa/título X; confirmar que o sistema pula direto para a etapa de contrato, sem tentar recriar o mandato, e que ao final existe um segundo `fat_contrato` para o mesmo `id_contratante`.

---

### P1: Wizard único — mandato + contrato numa tela só ⭐ MVP

**User Story**: Como Gestora, quero cadastrar o mandato e já abrir o contrato dele (Produto, Projeto, e opcionalmente vincular a uma Coalizão existente) na mesma tela, para terminar o cadastro de ponta a ponta sem navegar para uma segunda página.

**Why P1**: Pedido direto do usuário — hoje Produto/Projeto/Coalizão exigem uma navegação e um clique adicional depois que o mandato é salvo.

**Acceptance Criteria**:

1. WHEN a Gestora termina a etapa de dados do mandato (seja por match do TSE, seja manual) THEN o sistema SHALL exibir, na mesma tela/wizard, uma etapa seguinte com os campos do contrato: Produto (`ref_produto`, obrigatório), Projeto (`ref_projeto`, opcional), Data de início (obrigatório) — mesmos campos e mesmas regras de `contratoSchema` já usados por `ContratoForm`.
2. WHEN a Gestora está na etapa de contrato THEN o sistema SHALL oferecer um campo opcional "Vincular a uma coalizão existente" que, se preenchido, exige também o Papel (`membro`/`secretaria_executiva`/`grupo_trabalho`, espelhando `ck_membro_papel`) e, quando o papel for `grupo_trabalho`, o Nome do grupo (espelhando `ck_membro_grupo`).
3. WHEN a Gestora confirma o envio final do wizard (mandato novo + contrato, ou mandato existente + contrato — ver história anterior) THEN o sistema SHALL persistir, numa única operação transacional, tudo o que foi preenchido (mandato quando novo, `fat_contrato` sempre, `rel_coalizao_membro` quando a coalizão foi selecionada) — nunca em chamadas separadas que possam deixar estado parcial (mandato criado sem contrato, ou contrato criado sem o vínculo de coalizão escolhido).
4. WHEN a criação é concluída com sucesso THEN o sistema SHALL navegar para a tela de detalhe do mandato (`/mandatos/[id]`), onde o novo contrato já aparece listado.
5. WHEN qualquer etapa do envio final falha (validação de banco, permissão) THEN o sistema SHALL exibir a mensagem de erro mapeada (mesmo padrão de `mapeiaErroRpc`) sem ter persistido nada — nenhuma escrita parcial.

**Independent Test**: Abrir `/mandatos/novo`, buscar e selecionar uma candidatura do TSE, preencher Produto (obrigatório) e opcionalmente Projeto/Coalizão, enviar, e confirmar em `/mandatos/[id]` que o mandato e o contrato (e o vínculo de coalizão, se preenchido) existem — sem visitar `/mandatos/[id]/contratos/novo`.

---

### P1: Busca de candidatura do TSE em combobox/autocomplete ⭐ MVP

**User Story**: Como Gestora, quero digitar o nome do parlamentar num campo único e escolher entre sugestões que aparecem conforme eu digito, para não precisar preencher 3 campos e clicar em "Buscar" toda vez.

**Why P1**: Pedido direto do usuário — a busca hoje é 3 `Input`s (Nome/UF/Ano) + botão + tabela de resultados com botão "Selecionar" por linha.

**Acceptance Criteria**:

1. WHEN a Gestora digita ao menos 3 caracteres no campo de busca THEN o sistema SHALL consultar `buscarCandidaturas` (mesma função e mesma fonte, `tse.mv_candidatura_resumo`) com debounce (evitar 1 requisição por tecla) e exibir as sugestões num popover de combobox (padrão `Command`/`Popover` do shadcn/Radix), cada opção mostrando nome de urna, UF, partido e ano — mesmas colunas já exibidas na tabela atual.
2. WHEN a Gestora seleciona uma opção do combobox THEN o sistema SHALL preencher a etapa seguinte do wizard exatamente como o botão "Selecionar" faz hoje (mesmo `onSelecionar`/`CandidaturaSugerida`), sem alterar o formato de dado consumido pelo restante do wizard.
3. WHEN a busca não retorna nenhuma sugestão THEN o sistema SHALL manter o comportamento de `modoManual` já existente (FND-TSM-01/02): liberar o cadastro manual pela mesma tela, com `metodoMatch: "manual"` na seleção seguinte.
4. WHEN os filtros de UF e/ou ano de eleição forem informados (opcionais) THEN o sistema SHALL manter a possibilidade de refinar a busca por esses campos, sem exigir preenchê-los antes de digitar o nome.
5. WHEN a consulta ao TSE falhar (erro de rede) THEN o sistema SHALL exibir mensagem de erro genérica no próprio combobox, sem quebrar o restante do wizard — mesmo padrão de tratamento já usado em `TseMatchSearch`.

**Independent Test**: Abrir `/mandatos/novo`, digitar um nome parcial no campo de busca, ver sugestões aparecerem sem clicar em nenhum botão de busca, selecionar uma e confirmar que os dados aparecem preenchidos na etapa seguinte do wizard.

---

### P1: Título eleitoral travado quando vem do TSE ⭐ MVP

**User Story**: Como Gestora, quero que o título eleitoral confirmado pelo TSE não possa ser editado, para não correr o risco de digitar um valor divergente do que o próprio TSE informou.

**Why P1**: Bug relatado diretamente pelo usuário — hoje o campo `mandato.nr_titulo_eleitoral` é editável mesmo depois de vir do TSE (`mandato-wizard.tsx:242-254`, sem `disabled`/`readOnly` no passo "revisar").

**Acceptance Criteria**:

1. WHEN o wizard está na etapa de dados do mandato E a origem é uma candidatura do TSE (`passo.tipo === "revisar"`) THEN o campo Título Eleitoral SHALL ser exibido como somente leitura (não editável), preenchido com o valor vindo do TSE.
2. WHEN o wizard está na etapa de dados do mandato E a origem é cadastro manual (`passo.tipo === "manual"`) THEN o campo Título Eleitoral SHALL continuar editável normalmente, com a mesma validação de 12 dígitos já existente (`ck_mandato_titulo`/`mandatoSchema`).
3. WHEN o campo está travado (item 1) THEN o sistema SHALL deixar visualmente claro que o valor não é editável (ex.: estilo desabilitado + texto auxiliar "vindo do TSE"), não apenas remover a interatividade sem indicação.

**Independent Test**: Buscar e selecionar uma candidatura do TSE que tenha `nr_titulo_eleitoral` preenchido, confirmar que o campo aparece travado com esse valor; cancelar e escolher "Cadastro manual", confirmar que o mesmo campo aparece editável e vazio.

---

### P1: Base do TSE restrita a cargos do Legislativo ⭐ MVP

**User Story**: Como Gestora, só me interessam candidatos do Legislativo (vereador, deputado estadual, deputado federal, senador) — quero que o restante (Executivo e outros cargos) seja removido da base, para que buscas e relatórios não misturem cargos que a operação não usa.

**Why P1**: Pedido explícito do usuário — decisão de escopo de dado, confirmada via pergunta direta (filtrar na origem, não só na aplicação).

**Acceptance Criteria**:

1. WHEN a migração desta feature roda THEN o sistema SHALL remover de `tse.dim_candidatura`, `tse.fat_votacao_zona` e `tse.dim_perfil_eleitorado` todas as linhas cujo cargo não corresponda a Vereador(a), Deputado(a) Estadual, Deputado(a) Federal ou Senador(a), usando a chave de cargo confirmada contra o dado real (`SELECT DISTINCT cd_cargo, ds_cargo`) antes da escrita do `DELETE` — não os códigos assumidos de memória.
2. WHEN a migração remove linhas de `tse.dim_candidatura`/`tse.fat_votacao_zona`/`tse.dim_perfil_eleitorado` THEN o sistema SHALL recriar (`REFRESH`/recriar) `tse.mv_candidatura_resumo` e `tse.mv_perfil_eleitorado_candidatura` para que as materialized views reflitam só o dado remanescente.
3. WHEN existir algum `rel_mandato_candidatura` (mandato já cadastrado e vinculado) apontando para uma candidatura que seria removida por não ser do Legislativo THEN a migração SHALL reportar essas linhas antes de apagar (consulta de verificação document ada na própria migração) — a remoção só prossegue silenciosamente para candidaturas sem nenhum vínculo confirmado; qualquer vínculo existente encontrado é decisão a levar de volta ao usuário antes do `DELETE` final, não uma automação silenciosa.
4. WHEN a busca de candidaturas do TSE (`buscarCandidaturas`, usada pelo combobox) roda após a migração THEN o sistema SHALL naturalmente só retornar candidaturas do Legislativo, sem precisar de nenhum filtro adicional na query da aplicação (o filtro já está na origem).
5. WHEN o processo de carga (ETL) do TSE rodar novamente no futuro (nova safra) THEN o sistema SHALL importar só os 4 cargos do Legislativo daqui em diante — documentado como decisão de projeto (candidato a novo AD em `.specs/STATE.md`), não uma limpeza pontual que a próxima carga desfaz sem querer.

**Independent Test**: Rodar a migração num ambiente de dev com dado real carregado; conferir com `SELECT DISTINCT ds_cargo FROM tse.dim_candidatura` que só os 4 cargos do Legislativo restam; buscar por um nome que antes só existia como candidato a Prefeito e confirmar que não aparece mais no combobox.

---

### P2: Coalizão também abre seu próprio contrato

**User Story**: Como Gestora, quero abrir um contrato (Produto/Projeto) para uma Coalizão já cadastrada, do mesmo jeito que já faço para um mandato, para registrar formalmente quando uma coalizão vira cliente de um produto (ex.: planejamento estratégico próprio).

**Why P2**: Pedido do usuário ("a lógica de + contrato, coalizão ou mandato") — hoje essa tela não existe para coalizão, só para mandato.

**Acceptance Criteria**:

1. WHEN a Gestora está na tela de detalhe de uma coalizão (`/coalizoes/[id]`) THEN o sistema SHALL exibir uma ação "Novo contrato" que abre o mesmo formulário já usado para mandato (`ContratoForm`, modo `abrir`), com `idContratante` = o `id_contratante` da coalizão.
2. WHEN o contrato de uma coalizão é aberto com sucesso THEN o sistema SHALL listar esse contrato na própria tela de detalhe da coalizão (hoje a tela não lista nenhum contrato da coalizão, só os contratos-membro).
3. WHEN a Gestora está no formulário de "Novo contrato" de uma coalizão THEN o campo "Contrato anterior" (`id_contrato_anterior`) SHALL listar apenas contratos da própria coalizão (mesmo `id_contratante`), nunca contratos de mandatos.

**Independent Test**: Abrir uma coalizão já cadastrada, clicar em "Novo contrato", preencher Produto/Data de início, salvar, e confirmar que o contrato aparece na tela de detalhe da coalizão.

---

### P2: Corrigir o seletor de membro da coalizão (FND-COL-03)

**User Story**: Como Gestora, ao vincular um contrato como membro de uma coalizão, quero ver na lista só contratos de mandato, para não escolher por engano o contrato da própria coalizão ou de outra coalizão.

**Why P2**: Débito conhecido (`FND-COL-03`) que passa a ser ativamente alcançável quando Coalizão ganha contrato próprio (história anterior) — sem essa correção, o contrato de uma coalizão passaria a aparecer como opção de "membro".

**Acceptance Criteria**:

1. WHEN a Gestora abre o seletor "Contrato do mandato" em "Adicionar membro" (`/coalizoes/[id]`) THEN o sistema SHALL listar apenas contratos cujo `dim_contratante.tipo_contratante = 'mandato'`, nunca contratos de `dim_contratante.tipo_contratante = 'coalizao'`.

**Independent Test**: Com pelo menos 1 contrato de mandato e 1 contrato de coalizão existentes, abrir "Adicionar membro" numa coalizão e confirmar que só o contrato de mandato aparece na lista.

---

## Edge Cases

- WHEN o usuário reporta que nenhum `Select` (Cargo/Partido/Produto/Projeto) carrega opções THEN a fase de Design/Execute SHALL reproduzir o problema no navegador antes de propor correção — não presumir causa (grants/RLS já conferidos no SQL como corretos) — e a correção encontrada SHALL virar parte desta feature.
- WHEN a candidatura selecionada no combobox tem `nr_titulo_eleitoral` nulo THEN o sistema SHALL seguir como mandato novo, sem checagem de duplicidade por título (não há chave estável a comparar).
- WHEN a migração de restrição de cargo encontra um `rel_mandato_candidatura` já confirmado apontando para uma candidatura fora do Legislativo THEN o sistema SHALL reportar antes de apagar, nunca apagar silenciosamente um vínculo já confirmado por alguém.
- WHEN o envio final do wizard (mandato novo ou existente + contrato + coalizão opcional) falha no meio THEN o sistema SHALL garantir que nenhuma escrita parcial fique persistida (ver P1 "Wizard único", AC5) — a operação é atômica.
- WHEN a Gestora cancela o wizard depois de escolher uma candidatura do TSE mas antes de enviar o contrato THEN o sistema SHALL descartar tudo sem ter escrito nada no banco (mesmo comportamento atual de "Cancelar e buscar novamente").
- WHEN o campo "Vincular a uma coalizão existente" é deixado em branco THEN o sistema SHALL abrir o contrato normalmente, sem nenhum `rel_coalizao_membro` — o vínculo com coalizão nunca é obrigatório.

---

## Requirement Traceability

> **Nota de método (auditoria de 2026-08-10, Trilha A do roadmap):** os status abaixo vêm de
> **leitura direta do código real** (não da auditoria anterior do roadmap, que foi conferida item a
> item nesta sessão) — não do sub-agente Verifier formal da skill. Por isso o rótulo usado é
> **"Implemented"**, nunca **"Verified"**: "Verified" fica reservado pra depois que a fase Validate
> (Verifier independente, autor ≠ verificador) rodar de fato sobre os 16 requisitos — item 3 da
> Trilha A em `.specs/roadmap.md`, ainda não executado, fora do escopo desta sessão. Toda divergência
> encontrada contra a letra do Acceptance Criteria está documentada na célula correspondente, com
> arquivo:linha como evidência, e as que exigem decisão de produto/processo (não só código) estão
> listadas em **Perguntas abertas para Pedro**, abaixo.

| Requirement ID | Story | Phase | Status |
| --------------- | ----- | ----- | ------- |
| CMU-01 | P1: reaproveitar mandato existente (AC1/AC2 — detecção por título) | Implement | ✅ Implemented — `checkExistente` roda dentro de `iniciarRevisao` (fluxo TSE) e no início de `submeter` (fluxo manual), pula a criação do mandato e mostra o passo `"existente"` com aviso antes de ir pro contrato — `mandato-wizard.tsx:151-176` |
| CMU-02 | P1: reaproveitar mandato existente (AC3 — só cria contrato, nunca recria mandato) | Implement | ✅ Implemented — `app.criar_mandato` só entra no branch de `INSERT` em `dim_contratante`/`dim_mandato`/`rel_mandato_candidatura` quando `p_id_contratante_existente` é nulo; caso contrário só resolve `v_id_mandato` por `SELECT` — `0022_cadastro_mandato_contrato_unificado.sql:47-115` |
| CMU-03 | P1: reaproveitar mandato existente (AC4 — título nulo = mandato novo) | Implement | ✅ Implemented — `checkExistente` retorna `false` sem consultar o banco quando `nrTituloEleitoral` é nulo/vazio, seguindo fluxo normal — `mandato-wizard.tsx:152` |
| CMU-04 | P1: reaproveitar mandato existente (AC5 — condição de corrida tratada com mensagem amigável) | Implement | ⚠️ Implementado parcialmente — a mensagem amigável aparece (`mapeiaErroRpc` já mapeia a constraint `dim_mandato_nr_titulo_eleitoral_key` pra essa frase, `errors.ts:70`), mas a **ação** "ver mandato existente / abrir contrato para ele" exigida pela letra do AC5 não existe: o `catch` de `submeter` trata qualquer erro que não seja `DuplicataDetectadaError` só como texto simples (`setErro`), sem nenhum botão/link de ação — `mandato-wizard.tsx:287-295`. Ver **Perguntas abertas para Pedro** (Q1). |
| CMU-05 | P1: wizard único (AC1/AC2 — etapa de contrato com Produto/Projeto/Coalizão na mesma tela) | Implement | ✅ Implemented — bloco "Abertura de Contrato" dentro do mesmo `<form>` do wizard, incluindo regra de `papel`/`nome_grupo` da coalizão — `mandato-wizard.tsx:711-858` |
| CMU-06 | P1: wizard único (AC3/AC5 — persistência atômica, sem escrita parcial) | Implement | ✅ Implemented — uma única chamada RPC (`app.criar_mandato`) cobre mandato (quando novo) + contrato + vínculo de coalizão (quando selecionado) dentro da mesma função Postgres — atomicidade vem de ser uma função só, sem sequência de chamadas soltas do cliente — `0022...sql:27-146`, `rpc/mandato.ts:43-66` |
| CMU-07 | P1: wizard único (AC4 — navega pro detalhe do mandato ao concluir) | Implement | ✅ Implemented — `router.push(\`/mandatos/${resultado.idMandato}\`)` após sucesso, inclusive no ramo de mandato existente (RPC resolve `v_id_mandato` por `SELECT` mesmo nesse ramo) — `mandato-wizard.tsx:286` |
| CMU-08 | P1: combobox TSE (AC1/AC2 — autocomplete com debounce substitui filtro+tabela) | Implement | ✅ Implemented — `Command`/`Popover` do shadcn, debounce de 500ms (`use-debounce`), colunas nome de urna/UF/partido/ano/confiança — `tse-match-search.tsx:34-156` |
| CMU-09 | P1: combobox TSE (AC3/AC4 — modo manual e filtros opcionais preservados) | Implement | ✅ Implemented — `modoManual` ativa quando a busca retorna vazio; UF/ano continuam opcionais ao lado do combobox — `tse-match-search.tsx:63,139-152` |
| CMU-10 | P1: combobox TSE (AC5 — erro de rede tratado) | Implement | ✅ Implemented — `try/catch` em torno de `buscarCandidaturas` seta mensagem genérica sem propagar exceção pro resto do wizard — `tse-match-search.tsx:52-69` |
| CMU-11 | P1: título eleitoral travado (AC1/AC2/AC3) | Implement | ✅ Implemented — `readOnly={passo.tipo === "revisar"}` + estilo `bg-muted/50` + legenda "Vindo do TSE" só nesse passo; editável normalmente no passo `"manual"` — `mandato-wizard.tsx:405-422` |
| CMU-12 | P1: base TSE restrita ao Legislativo (AC1/AC2 — migração + refresh das MVs) | Implement | ⚠️ Implementado, mas o passo de verificação exigido pela própria assumption do spec não está documentado — a migration apaga `cd_cargo NOT IN (5,6,7,13)` de `dim_candidatura`/`fat_votacao_zona` e refresca as 2 MVs (`0022...sql:1-22`); os códigos batem com o seed de `ref_cargo` (`0007_catalogos_fundacao.sql:73-80`), mas a assumption do spec (linha "Chave exata de cargo pra filtrar") exigia confirmar contra `SELECT DISTINCT cd_cargo, ds_cargo FROM tse.dim_candidatura` **antes** do `DELETE` — não há essa evidência na migration, nem em `tasks.md`/`validation.md` (que não existem para esta feature, porque nenhuma fase Tasks foi aberta). Ver **Perguntas abertas para Pedro** (Q3). |
| CMU-13 | P1: base TSE restrita ao Legislativo (AC3 — checagem de vínculo existente antes de apagar) | Implement | ✅ Resolvido retroativamente — `0022...sql:11-15` apagou o vínculo de `rel_mandato_candidatura` de um cargo fora do Legislativo sem decisão documentada antes (comentário da própria migration: "we know there's one for Prefeito"), mas Pedro confirmou em 2026-08-10 que Executivo está fora de escopo (**AD-031**). Débito histórico aceito, dado já apagado não é restaurado. |
| CMU-14 | P1: base TSE restrita ao Legislativo (AC4/AC5 — busca já filtrada + regra do ETL futuro) | Implement | ⚠️ Parcial — AC4 ✅ Implemented (a busca sai naturalmente filtrada da origem; `buscarCandidaturas` não precisa de filtro adicional). AC5 ❌ Needs Fix — nem `public.carrega_tse` (`0027_carrega_tse.sql`) nem `DADOS TSE/carga_amostral.js` filtram por cargo, e não existe nenhum AD em `.specs/STATE.md` documentando essa regra pra cargas futuras; uma nova safra do TSE carregada hoje reintroduziria os cargos que 0022/0026 removeram. Ver **Perguntas abertas para Pedro** (Q2). |
| CMU-15 | P2: contrato próprio da Coalizão (AC1/AC2/AC3) | Design | Design concluído nesta sessão — ver `design.md`. Não implementado: confirmado que `/coalizoes/[id]/page.tsx` hoje não tem nenhuma ação "Novo contrato" nem lista os contratos da própria coalizão (só a lista de membros). Tasks/Execute ainda não rodaram. |
| CMU-16 | P2: correção FND-COL-03 (AC1) | Design | Design concluído nesta sessão — ver `design.md`. Não implementado: confirmado no código que o seletor de `"Adicionar membro"` (`coalizoes/[id]/page.tsx:82-87`) carrega `fat_contrato` sem nenhum filtro por `tipo_contratante`, exatamente o débito `FND-COL-03` que o comentário do próprio arquivo já admite (linha 79-82). Tasks/Execute ainda não rodaram. |

**ID format:** `CMU-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 16 total. CMU-01 a CMU-14 auditados nesta sessão contra o código real: 10 ✅ Implemented,
3 ⚠️ implementados com lacuna ou passo de processo não documentado (CMU-04, CMU-12, CMU-14-AC5), 1 ❌
divergência real de spec já ocorrida e não reversível (CMU-13). CMU-15/16: Design concluído nesta
sessão (ver `design.md`), 0 implementado — Tasks/Execute pendentes. **Nenhum dos 16 passou pela fase
formal de Validate** (Verifier independente, autor ≠ verificador) — essa auditoria de código é
evidência, não substitui o Verifier (Trilha A, item 3, `.specs/roadmap.md`).

---

## Perguntas abertas para Pedro

Encontradas durante a auditoria de código desta sessão (2026-08-10) — nenhuma foi decidida
unilateralmente aqui; ficam registradas para decisão antes de fechar a Trilha A.

1. **CMU-04 — ação ausente na condição de corrida.** Hoje, quando a checagem prévia passa mas o
   `INSERT` ainda assim colide com `dim_mandato_nr_titulo_eleitoral_key` (duas sessões cadastrando o
   mesmo título ao mesmo tempo), o sistema mostra a mensagem amigável certa, mas não oferece a ação
   "ver mandato existente / abrir contrato para ele" que o AC5 pede literalmente — só texto. Duas
   saídas: (a) fechar isso quando a Trilha A entrar em Tasks/Execute (acréscimo pequeno de UI —
   reconhecer `ViolacaoUnicaError` com `constraint === "dim_mandato_nr_titulo_eleitoral_key"` e
   oferecer o mesmo botão que o passo `"existente"` já tem); ou (b) relaxar a letra do AC5 pra bater
   com o comportamento atual (mensagem apenas) e registrar como debt aceito, já que é uma condição de
   corrida rara. Qual?
2. **CMU-14 AC5 — carga futura do TSE sem filtro de cargo.** Nem `public.carrega_tse` nem
   `DADOS TSE/carga_amostral.js` restringem a carga a cargos do Legislativo hoje. A regra em si já
   está fechada (**AD-031**, 2026-08-10, Legislativo-only) — o que falta é só o filtro de código no
   loader, pra uma carga futura não reintroduzir Prefeito/Governador silenciosamente. Ainda em
   aberto: corrigir o loader agora (parte do fechamento da Trilha A) ou aceitar como débito separado
   (Trilha E), já que não há carga nova do TSE prevista no curto prazo?
3. ~~**CMU-12/13 — verificação retroativa e exclusão silenciosa já ocorridas.**~~ **RESOLVIDA por
   Pedro em 2026-08-10**: Prefeito/Governador (Executivo) não são necessários — a restrição ao
   Legislativo (Vereador, Dep. Estadual, Dep. Federal, Senador) é a decisão correta, aceita como
   débito histórico documentado, sem ação corretiva sobre o dado já apagado. Registrado
   retroativamente como **AD-031** em `.specs/STATE.md`. O `cd_cargo` do `DELETE` de CMU-12
   permanece não confirmado contra `SELECT DISTINCT` — aceito como parte do mesmo débito, não
   corrigido agora.
4. **(Baixa prioridade, FYI) `/mandatos/[id]/contratos/novo` parece órfã.** Nenhum lugar do código
   linka mais pra essa rota desde que o wizard (`/mandatos/novo`) passou a cobrir reaproveitamento de
   mandato existente — o botão "Abrir Novo Contrato" em `/mandatos/[id]` já aponta pro wizard, não
   pra essa página (confirmado por busca no código, nenhum outro arquivo referencia
   `contratos/novo`). O design de CMU-15 (`design.md`) propõe **não** replicar esse padrão de rota
   dedicada pra Coalizão — abre inline em `/coalizoes/[id]`. Quer que uma trilha futura avalie
   remover a rota órfã do mandato, ou ela fica de propósito como fallback?

---

## Success Criteria

Como sabemos que a feature foi bem-sucedida:

- [ ] Uma Gestora cadastra um mandato reeleito (mesmo título eleitoral de um já cadastrado) e consegue abrir um segundo contrato para ele sem nenhum erro, tudo dentro de `/mandatos/novo`.
- [ ] Nenhum cadastro de mandato termina sem passar pela etapa de Produto do contrato — as duas telas viraram uma.
- [ ] A busca de candidatura do TSE se comporta como um combobox de autocomplete, não como um formulário de filtro com botão.
- [ ] `SELECT DISTINCT ds_cargo FROM tse.dim_candidatura` retorna só os 4 cargos do Legislativo.
- [ ] Uma coalizão cadastrada consegue ter um contrato próprio, visível na sua tela de detalhe.
