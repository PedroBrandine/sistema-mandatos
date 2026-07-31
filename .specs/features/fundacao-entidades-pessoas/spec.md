# Fundação — entidades & pessoas Specification

## Problem Statement

Hoje mandatos, coalizões e pessoas (Gestoras, Mentores, Assessores) vivem em planilhas conectadas por Apps Script, sem cadastro único, sem histórico de vínculo e sem ligação confiável com a base do TSE. A Fundação é a camada que define **quem e o quê existe** no sistema — o pré-requisito de tudo que vem depois (planejamento, incidência, operação). Sem ela cadastrada corretamente, nenhuma outra camada tem em que se apoiar.

## Goals

- [ ] Um mandato é cadastrado uma vez — via importação TSE revisada por pessoa ou cadastro manual — e vira contratante que pode abrir contrato com qualquer produto.
- [ ] Uma coalizão é cadastrada a partir de um Projeto, com ou sem planejamento próprio, e agrega mandatos-membro por contrato, com papel e período.
- [ ] Gestoras, Mentores e Assessores têm cadastro próprio, vinculado a contratos com papel, cargo e período — sustentando RLS e carteira sem depender de desativação manual.
- [ ] Um contrato (contratante × produto × edição) é a âncora que materializa o vínculo do mandato com Produto e Projeto, e encadeia renovação sem coluna digitada.
- [ ] Substituir, editar ou encerrar o vínculo de um assessor (ou qualquer papel) funciona igual nos três produtos, preservando histórico.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Operação de produto (etapas, formulários, Kanban, encontros) | Camada Operação (§2.5) — usa a Fundação, não a reimplementa |
| Cálculo de atingimento (Objetivo/Meta/Sucesso Mensal) | Camada Planejamento (§2.3) |
| Incidência (registros, insights, fatos geradores, IIP) | Camada Incidência (§2.4) |
| CRUD de catálogos `ref_*` via UI (FND-05) | Não pedido no escopo original; catálogos são pré-requisito seedado via migração/SQL, não tela desta feature — ver `context.md` |
| Exclusão física de contratante/mandato/coalizão já cadastrado | Não pedida; `ON DELETE RESTRICT` já impede apagar entidade com contrato vinculado; correção é por edição, não exclusão de linha |
| ETL de importação TSE (carga de safra, particionamento, refresh de `tse.mv_candidatura_resumo`) | Camada Integrações, INT-03 — esta spec só **consome** `tse.mv_candidatura_resumo` para sugerir match |
| Administração de RBAC (criar papéis novos, alterar `ck_usuario_papel`) | Papéis são fechados na Constituição (§3, AD-018); esta spec opera dentro deles, não os redesenha |
| Rate limiting de magic link / autenticação | Plataforma (§5.5), transversal a todo login |
| Pareamento mentorado↔mentor do PLL, confirmação/desistência de participante | OPR-05 — específico da operação da edição de PLL |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| ---------------------- | --------------- | --------- | ---------- |
| Escopo do contrato (FND-04) dentro desta spec | Incluído | É o mecanismo que materializa o vínculo de Produto/Projeto pedido; sem ele o requisito não é especificável | y |
| Match TSE — origem da sugestão | Automática (nome+UF+cargo), Gestora confirma/rejeita | Evita busca manual em base de centenas de milhares de candidatos a cada mandato | y |
| Troca de candidatura vigente | Automática na mesma transação ao confirmar a nova | Evita duas ações manuais e estado inconsistente temporário | y |
| Substituir/excluir vínculo usuário↔contrato | Modelo temporal — fecha (`dt_fim`), nunca apaga linha; excluir não desativa a pessoa | Consistente com "Desvinculação encerra acesso" (§5.3) e com RLS por `dt_fim`; preserva histórico para G1/G2 | y |
| Quem cadastra `dim_usuario` | Gestora e Admin | Consistente com §3: Gestora "vê e edita tudo" | y |
| Duplicata de contratante no cadastro manual | Aviso não bloqueante, com confirmação explícita | `nome_normalizado` existe no schema para isso; bloqueio duro atrasa cadastro em caso de falso positivo | y |
| Renovação de contrato | Campo opcional no fluxo normal de abertura (`id_contrato_anterior` escolhido entre contratos existentes do contratante) — sem ação "renovar" dedicada | Confirmado pelo usuário: não existe ação de renovar separada | y |
| `possui_planejamento_proprio` da coalizão | Editável a qualquer momento após a criação | Confirmado pelo usuário | y |
| CRUD de catálogos `ref_*` (FND-05) | Fora de escopo | Não mencionado no pedido original; ver Out of Scope | y (assumption logged, not asked) |
| Exclusão física de contratante/mandato/coalizão | Fora de escopo | Não pedida; `ON DELETE RESTRICT` já impede quando há contrato | y (assumption logged, not asked) |
| Concorrência em edição simultânea | Último `UPDATE` vence, sem lock otimista | Equipe pequena (Monitoramento), `log_auditoria` preserva histórico de qualquer forma | y (agent's discretion) |
| Algoritmo exato de match TSE (pesos, limiares de confiança) | Fica com o Design | Contrato de dados (`metodo_match`, `confianca`, `status`) já fechado no schema; o algoritmo em si é decisão de implementação | y (agent's discretion) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Cadastrar mandato via TSE com revisão humana ⭐ MVP

**User Story**: Como Gestora, quero cadastrar um mandato a partir de uma candidatura do TSE já sugerida pelo sistema, para não digitar dados públicos que já existem e não confiar em nenhum match automático não revisado.

**Why P1**: Sem contratante e mandato cadastrados, nenhum contrato pode ser aberto — é o alicerce de qualquer produto.

**Acceptance Criteria**:

1. WHEN a Gestora busca por nome/UF/cargo na tela de novo mandato THEN o sistema SHALL exibir candidaturas de `tse.mv_candidatura_resumo` sugeridas por algoritmo de nome+UF+cargo, cada uma com `metodo_match` e `confianca` (alta/média/baixa) visíveis.
2. WHEN a Gestora confirma uma candidatura sugerida THEN o sistema SHALL criar `dim_contratante` (`tipo_contratante='mandato'`), `dim_mandato` e `rel_mandato_candidatura` com `status='confirmado'`, `id_usuario_validou` e `validado_em` preenchidos, numa única transação.
3. WHEN a Gestora rejeita uma candidatura sugerida THEN o sistema SHALL gravar `rel_mandato_candidatura.status='rejeitado'` sem criar mandato, e permitir nova busca.
4. WHEN a Gestora confirma uma segunda candidatura como `eh_mandato_vigente=true` para um mandato que já tem uma vigente THEN o sistema SHALL desmarcar a candidatura vigente anterior na mesma transação, nunca deixando duas vigentes simultâneas.
5. WHEN o `nome_normalizado` do novo contratante bate com um contratante já cadastrado na mesma UF/município THEN o sistema SHALL exibir o(s) contratante(s) parecido(s) e exigir confirmação explícita antes de salvar.
6. WHEN nenhuma candidatura do TSE corresponde ao mandato (nunca eleito, cargo de indicação, ou match não encontrado) THEN o sistema SHALL permitir cadastro manual completo, gravando `dim_mandato.origem_partido_cargo='manual'` e nenhuma linha em `rel_mandato_candidatura`.

**Independent Test**: Cadastrar um mandato reeleito (duas candidaturas no TSE) do zero, confirmar a mais recente como vigente, e verificar que a anterior perdeu o flag automaticamente — sem tocar em nenhuma outra camada.

---

### P1: Abrir contrato vinculando Produto e Projeto ⭐ MVP

**User Story**: Como Gestora, quero abrir um contrato para um mandato já cadastrado, escolhendo o produto e opcionalmente o projeto, para que o mandato passe a operar dentro do sistema.

**Why P1**: É o vínculo de primeira classe que a Constituição exige (§2.2) e o que faz o mandato "existir" para efeito de operação, planejamento e incidência.

**Acceptance Criteria**:

1. WHEN a Gestora abre um novo contrato para um contratante THEN o sistema SHALL exigir `id_produto` e `dt_inicio`, aceitar `id_projeto` como opcional, e criar `fat_contrato` com `status='ativo'`.
2. WHEN a Gestora escolhe um contrato existente do mesmo contratante como anterior THEN o sistema SHALL gravar `id_contrato_anterior` no novo contrato, sem exigir nenhuma ação dedicada de "renovar".
3. WHEN a Gestora encerra um contrato com `status='nao_concluido'` THEN o sistema SHALL exigir `motivo_encerramento` não vazio antes de salvar.
4. WHEN a Gestora tenta definir `id_contrato_anterior` como o próprio contrato THEN o sistema SHALL rejeitar a operação.
5. WHEN um contrato é criado THEN o sistema SHALL preencher `id_cargo_no_contrato` e `id_partido_no_contrato` como snapshot do cargo/partido atual do mandato — sem recalcular retroativamente se o mandato trocar de cargo ou partido depois.

**Independent Test**: Abrir um contrato de Estratégia para um mandato, encerrá-lo como `nao_concluido` com motivo, e abrir um segundo contrato do mesmo produto apontando o primeiro como anterior — confirmar que a cadeia é consultável sem coluna extra.

---

### P1: Cadastrar e gerenciar usuários com papel e vínculo ⭐ MVP

**User Story**: Como Gestora ou Admin, quero cadastrar Mentores e Assessores e vinculá-los a um contrato com papel e cargo, para que carteira, RLS e organograma tenham dado confiável.

**Why P1**: Sem usuário e vínculo, não há RLS possível — nenhuma tela do sistema é utilizável por ninguém além do Admin.

**Acceptance Criteria**:

1. WHEN uma Gestora cadastra um novo Mentor ou Assessor THEN o sistema SHALL criar `dim_usuario` com `papel_global` correspondente, exigindo e-mail único e válido.
2. WHEN uma Gestora tenta cadastrar uma nova Gestora (`papel_global='gestora'`) THEN o sistema SHALL recusar, permitindo essa ação somente ao Admin.
3. WHEN um usuário é vinculado a um contrato THEN o sistema SHALL criar `rel_usuario_contrato` com `papel_no_contrato`, `dt_inicio` (default hoje), e opcionalmente `cargo`, `grau_responsabilidade`, `areas`.
4. WHEN a Gestora edita cargo, grau de responsabilidade ou áreas de um vínculo já aberto THEN o sistema SHALL fazer `UPDATE` na mesma linha, sem alterar `dt_inicio`/`dt_fim` e sem criar linha nova.
5. WHEN a Gestora substitui o assessor (ou mentor) de um contrato THEN o sistema SHALL gravar `dt_fim = hoje` na linha antiga de `rel_usuario_contrato` e criar uma linha nova para a pessoa nova, nunca apagando a antiga.
6. WHEN a Gestora exclui o vínculo de um assessor (ou mentor) de um contrato THEN o sistema SHALL gravar `dt_fim = hoje` na linha existente, nunca apagar a linha e nunca alterar `dim_usuario.ativo`.
7. WHEN a mesma pessoa e o mesmo contrato e o mesmo papel já têm um vínculo aberto (`dt_fim IS NULL`) THEN o sistema SHALL impedir um segundo vínculo idêntico simultâneo (`uq_vinculo`).
8. WHEN um Assessor mentorado do PLL é vinculado a um mandato THEN o sistema SHALL permitir o vínculo manual (cadastro do usuário se ainda não existir + `rel_usuario_contrato` com `papel_no_contrato='assessor'` no contrato de PLL), sem nenhuma importação ou matching automático.

**Independent Test**: Cadastrar um Mentor, vinculá-lo a um contrato, editar seu cargo, depois substituí-lo por outro Mentor — confirmar que o vínculo antigo aparece fechado (`dt_fim` preenchido) e o RLS do Mentor antigo não enxerga mais o contrato.

---

### P2: Cadastrar e gerenciar coalizões

**User Story**: Como Gestora, quero cadastrar uma coalizão a partir de um Projeto e agregar mandatos-membro por contrato, para que a coalizão funcione com ou sem planejamento próprio.

**Why P2**: Coalizão é um produto real (§2.2), mas depende de mandatos e contratos já existirem — vem depois do fluxo P1 de mandato/contrato.

**Acceptance Criteria**:

1. WHEN a Gestora cadastra uma coalizão THEN o sistema SHALL criar `dim_contratante` (`tipo_contratante='coalizao'`) e `dim_coalizao` vinculada a um `id_projeto_origem`, com `possui_planejamento_proprio` definido.
2. WHEN a Gestora altera `possui_planejamento_proprio` de uma coalizão já existente THEN o sistema SHALL permitir a mudança a qualquer momento.
3. WHEN a Gestora adiciona um mandato como membro de uma coalizão THEN o sistema SHALL exigir um contrato do mandato (não o contratante direto), `papel` (membro, secretaria executiva ou grupo de trabalho) e `dt_entrada` (default hoje).
4. WHEN o papel do membro é `grupo_trabalho` THEN o sistema SHALL exigir `nome_grupo` preenchido; para os demais papéis, `nome_grupo` SHALL permanecer nulo.
5. WHEN a Gestora encerra a participação de um mandato na coalizão THEN o sistema SHALL gravar `dt_saida >= dt_entrada`, sem apagar a linha de `rel_coalizao_membro`.
6. WHEN o mesmo contrato já é membro da coalizão com o mesmo papel THEN o sistema SHALL impedir duplicidade (`uq_coalizao_membro`).

**Independent Test**: Cadastrar uma coalizão sem planejamento próprio, adicionar dois mandatos-membro com papéis diferentes, e depois ligar `possui_planejamento_proprio` — confirmar que a mudança não exige recriar a coalizão.

---

### P3: Revisão manual de match TSE sem sugestão automática

**User Story**: Como Gestora, quero buscar manualmente uma candidatura do TSE quando a sugestão automática não encontrar nada ou for rejeitada, para não ficar travada esperando um match perfeito do algoritmo.

**Why P3**: Cobre o caminho de exceção do fluxo P1 — não bloqueia o MVP, mas evita que um mandato sem match óbvio fique sem cadastro.

**Acceptance Criteria**:

1. WHEN a busca automática não retorna nenhuma candidatura THEN o sistema SHALL permitir busca manual por nome/UF/cargo/ano de eleição sobre `tse.mv_candidatura_resumo`.
2. WHEN a Gestora seleciona manualmente uma candidatura na busca THEN o sistema SHALL gravar `rel_mandato_candidatura.metodo_match='manual'`.

**Independent Test**: Buscar um mandato com nome incomum que a sugestão automática não encontra, localizar manualmente a candidatura certa e confirmar o vínculo.

---

## Edge Cases

- WHEN um mandato não tem nenhuma candidatura confirmada (nunca disputou eleição, cargo de indicação) THEN o sistema SHALL permitir que `rel_mandato_candidatura` não tenha nenhuma linha para esse mandato — ausência de vínculo TSE não é erro.
- WHEN a Gestora tenta abrir um segundo contrato ativo do mesmo produto para o mesmo contratante THEN o sistema SHALL permitir (não há UNIQUE que impeça — regra de negócio de "só um ativo por produto" fica fora desta spec; ver Assumptions) — **N/A explícito**: nenhuma regra de exclusividade de contrato ativo por produto foi pedida; se necessária, é decisão futura.
- WHEN `tse.mv_candidatura_resumo` está desatualizada (safra nova ainda não refletida) THEN o sistema SHALL exibir a data do último refresh, sem tratar isso como erro — a atualização é responsabilidade de INT-03, fora desta spec.
- WHEN a Gestora tenta editar `dim_mandato.nr_titulo_eleitoral` para um valor com CPF (11 dígitos) THEN o sistema SHALL rejeitar (`ck_mandato_titulo` exige 12 dígitos).
- WHEN um campo de atributo (ex. `grau_responsabilidade`, `nm_municipio`) recebe string vazia ou um sentinela conhecido ("Pendente de Atualização", "Não Coletado" etc.) THEN o sistema SHALL rejeitar a gravação — o domínio `texto_limpo` já impõe isso no schema (AD-005).
- WHEN dois usuários editam o mesmo `dim_mandato` ao mesmo tempo THEN o sistema SHALL aceitar o último `UPDATE` sem lock — `log_auditoria` preserva ambas as versões no histórico.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FND-TSE-01 | P1: Cadastrar mandato via TSE | Verify | ❌ Needs Fix — `metodo_match` nunca exibido na tela de busca (só `confianca`); filtro de cargo (`buscarCandidaturas` já suporta `idCargo`) nunca exposto na UI — ver `validation.md` |
| FND-TSE-02 | P1: Cadastrar mandato via TSE | Verify | ✅ Verified |
| FND-TSE-03 | P1: Cadastrar mandato via TSE | Verify | ⚠️ Spec/schema conflict — `rel_mandato_candidatura.id_mandato NOT NULL` torna o AC3 literal ("gravar status='rejeitado' sem criar mandato") estruturalmente insatisfazível no fluxo `/mandatos/novo`; comportamento atual (descartar no cliente, sem persistir) satisfaz a intenção funcional mas não a letra do AC — decisão de produto pendente, ver `validation.md` |
| FND-TSE-04 | P1: Cadastrar mandato via TSE | Verify | ✅ Verified |
| FND-TSE-05 | P1: Cadastrar mandato via TSE | Verify | ✅ Verified |
| FND-TSE-06 | P1: Cadastrar mandato via TSE | Verify | ✅ Verified |
| FND-CTR-01 | P1: Abrir contrato | Verify | ✅ Verified |
| FND-CTR-02 | P1: Abrir contrato | Verify | ✅ Verified |
| FND-CTR-03 | P1: Abrir contrato | Verify | ✅ Verified |
| FND-CTR-04 | P1: Abrir contrato | Verify | ✅ Verified |
| FND-CTR-05 | P1: Abrir contrato | Verify | ❌ Needs Fix — `id_cargo_no_contrato`/`id_partido_no_contrato` nunca preenchidos ao abrir contrato (nem trigger, nem payload do insert) — ver `validation.md` |
| FND-USR-01 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-02 | P1: Cadastrar usuários | Verify | ❌ Needs Fix — política RLS `p_usuario` não tem `WITH CHECK` sobre o valor de `papel_global`; Gestora consegue cadastrar outra Gestora apesar do AC — só existe gate de UI, contornável — ver `validation.md` |
| FND-USR-03 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-04 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-05 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-06 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-07 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-USR-08 | P1: Cadastrar usuários | Verify | ✅ Verified |
| FND-COL-01 | P2: Cadastrar coalizões | Verify | ✅ Verified |
| FND-COL-02 | P2: Cadastrar coalizões | Verify | ✅ Verified |
| FND-COL-03 | P2: Cadastrar coalizões | Verify | ❌ Needs Fix — seletor de contrato-membro (`coalizoes/[id]`) lista todos os `fat_contrato` sem filtrar por `tipo_contratante='mandato'` — bug real de correção, não cosmético — ver `validation.md` |
| FND-COL-04 | P2: Cadastrar coalizões | Verify | ✅ Verified |
| FND-COL-05 | P2: Cadastrar coalizões | Verify | ✅ Verified |
| FND-COL-06 | P2: Cadastrar coalizões | Verify | ✅ Verified |
| FND-TSM-01 | P3: Match manual | Verify | ❌ Needs Fix — mesma lacuna de filtro de cargo de FND-TSE-01 (raiz comum) — ver `validation.md` |
| FND-TSM-02 | P3: Match manual | Verify | ✅ Verified |

**ID format:** `FND-[SUBÁREA]-[NÚMERO]` — TSE (match/cadastro de mandato via TSE), CTR (contrato), USR (usuário e vínculo), COL (coalizão), TSM (match manual, P3). Sub-áreas escolhidas em vez de numeração única porque a feature cobre 5 sub-domínios distintos do schema (FND-01, FND-02, FND-03, FND-04 na numeração de `features-e-camadas-v3.md`).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 26 total, 26 mapped to tasks (T1-T37) and independently verified — 20 Verified, 5 Needs Fix (FND-TSE-01, FND-CTR-05, FND-USR-02, FND-COL-03, FND-TSM-01), 1 flagged as a spec/schema conflict pending a product decision (FND-TSE-03). See `.specs/features/fundacao-entidades-pessoas/validation.md` for full evidence.

---

## Success Criteria

How we know the feature is successful:

- [ ] Uma Gestora cadastra um mandato reeleito do zero (sugestão TSE → confirmação → contrato → vínculo de assessor) sem tocar em nenhuma planilha.
- [ ] Substituir um assessor no meio de um contrato não perde o histórico de quem esteve vinculado antes, nem exige apagar nada.
- [ ] Uma coalizão pode nascer sem planejamento próprio e ganhar planejamento depois, sem recriar cadastro.
- [ ] Nenhuma tabela desta camada aceita string vazia ou sentinela de ausência em coluna de atributo (domínio `texto_limpo` aplicado).
- [ ] Toda escrita desta camada é atribuível a um usuário autenticado e a um timestamp (via `log_auditoria`, PLT-02).
