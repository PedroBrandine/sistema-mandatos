# Convite por Contrato (Acesso Externo) Specification

## Problem Statement

Mentor/Consultor e Assessor externos **nunca tiveram nenhum caminho de acesso ao sistema** — nem
magic link, nem senha. O magic link foi removido (AD-026, 31/07) só pro público interno Legisla,
que hoje usa e-mail+senha repassada manualmente; isso não resolve o público externo, que não tem
conta prévia nem senha combinada por Slack. Sem convite, toda a Fundação de RBAC pro papel Mentor e
pro papel Assessor (Constituição §3) existe só no modelo de dados, sem porta de entrada real.

## Goals

- [ ] Gestora convida um Mentor ou Assessor pra um contrato específico, informando e-mail, papel,
      cargo (quando Assessor) e áreas de atuação.
- [ ] Convite é um token de uso único, com hash gravado (nunca o token em claro), expiração curta.
- [ ] Convidado abre a URL, define nome e senha, e a conta nasce já vinculada ao contrato certo —
      sem depender de SMTP (URL copiada e repassada manualmente, mesmo padrão de
      `scripts/gerar-link-acesso.ts`).
- [ ] Novo AD que abre a 5ª exceção à lista fechada da AD-010 (criação de conta via rota de
      servidor com `service_role`).
- [ ] **Não é magic link.** É explicitamente um desvio diferente do fluxo removido pela AD-026 —
      resolve um público (externo, sem conta prévia) que o AD-026 nunca cobriu.

## Out of Scope

| Item | Reason |
| --- | --- |
| Envio de e-mail automático (SMTP) | Mesma razão da AD-026 — rate limit de e-mail do plano free da Supabase. A Gestora copia e repassa a URL manualmente (Slack/WhatsApp), como já acontece hoje com o acesso interno. |
| Pareamento automático mentor↔mentorado do PLL | O mesmo mecanismo de convite **serve** pra isso depois (roadmap §4, "bônus"), mas a lógica de pareamento (quem vira mentor de quem) não está definida nesta rodada — vira extensão do convite existente, não uma feature nova, quando for especificada. |
| Convite para papel Admin ou Gestora | Esses papéis continuam pelo fluxo manual existente (AD-026) — o convite por contrato só cria `mentor`/`assessor`, nunca eleva pra papel interno. |
| Reenvio/renovação de convite expirado pela própria pessoa convidada | Só a Gestora pode gerar um novo convite — a pessoa convidada não tem nenhuma superfície antes de logar. |
| Revogação de convite já enviado, mas ainda não usado | Fica como ação manual via SQL/admin nesta primeira fatia — uma tela de "cancelar convite" é extensão natural, não incluída aqui. |
| Login subsequente do Mentor/Assessor (depois da conta criada) | Usa o fluxo de login já existente (e-mail+senha, `signInWithPassword`) — esta feature só cobre o primeiro acesso. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmado? |
| --- | --- | --- | --- |
| **Auth boundary — quem pode ser convidado** | Só `papel_no_contrato IN ('mentor','assessor')`. O RPC de consumo do convite SHALL rejeitar qualquer tentativa de gravar `papel_global IN ('admin','gestora')` | Lição direta da FND-USR-02 desta mesma sprint: todo caminho que cria/eleva papel precisa de guarda explícita, nunca confiar em "a UI não oferece essa opção" | **y** — confirmado por Pedro 2026-08-11. Guarda em 2 camadas: `CHECK` na tabela (`ck_convite_papel`) + validação redundante no RPC de consumo antes de gravar |
| **Quem pode convidar** | Gestora ou Admin, restrito ao contrato onde a Gestora tem vínculo ativo (RLS já existente de `rel_usuario_contrato`) | Convidar pra um contrato de fora da própria carteira seria uma escrita privilegiada sem RLS por trás | **y** — confirmado, com um ajuste de Design: reusa a política `p_por_contrato` já padrão em toda tabela com `id_contrato` (`papel_atual() IN ('admin','gestora') OR id_contrato = ANY(contratos_do_usuario())`), não uma checagem de vínculo bespoke — Gestora já é tratada como acesso interno de portfólio em todas as outras tabelas, não só nesta. Ver design.md Tech Decisions |
| **Geração e armazenamento do token** | Token aleatório (≥32 bytes de entropia), hash (SHA-256 ou equivalente) gravado em `convite_contrato.token_hash`; o token em claro só existe na URL devolvida uma vez, nunca persistido | Mitigação obrigatória já citada no roadmap §4 — hash nunca token em claro | y |
| **Expiração** | 7 dias corridos a partir da emissão | Prazo curto o suficiente pra reduzir janela de exposição, longo o suficiente pra não expirar antes de a pessoa abrir o WhatsApp/Slack (mesmo espírito do link de 1h do `gerar-link-acesso.ts`, mas mais longo porque aqui não há reenvio fácil) | **y** — confirmado por Pedro 2026-08-11 |
| **Uso único** | `convite_contrato.dt_uso` (nullable) — convite com `dt_uso IS NOT NULL` é rejeitado em qualquer tentativa de reconsumo | Mitigação obrigatória citada no roadmap; simetria com o padrão de token de uso único já usado no fluxo de auth existente | y |
| **Falha parcial** — conta criada em `auth.users` mas a transação que grava `dim_usuario`/`rel_usuario_contrato`/consome o convite falha depois | A rota de servidor SHALL verificar, antes de chamar `auth.admin.createUser`, se já existe `dim_usuario` com aquele e-mail; se existir, pula `createUser` e completa o restante via RPC idempotente — nunca sobrescreve senha de conta Auth pré-existente (ver design.md Error Handling Strategy pro detalhe de por que a checagem é por `dim_usuario`, não por `auth.users` — o SDK admin não tem `getUserByEmail`) | `auth.admin.createUser` e o `INSERT` em `dim_usuario` não são a mesma transação (um é chamada de API, outro é SQL) — sem essa verificação, uma falha a meio caminho deixaria um usuário Auth "fantasma", sem `dim_usuario`, e a pessoa nunca mais conseguiria usar o convite (e-mail já existe em Auth) nem logar (sem `dim_usuario`) | **y** — confirmado por Pedro 2026-08-11; mecanismo exato refinado em Design (ver abaixo) |
| **Rate limit / abuso** | Limitar tentativas de acesso a `/convite/<token>` por IP (ex.: N por minuto) — não é o rate limit de e-mail da Supabase (não há envio de e-mail aqui), é proteção contra força bruta no espaço de tokens | Mitigação obrigatória citada no roadmap §4; dimensão de auth boundary explícita do skill (nenhuma superfície pré-sessão deve ficar sem limite) | **y** — confirmado por Pedro 2026-08-11. Mecanismo: tabela Postgres (`convite_tentativa`) + RPC, checado antes do lookup do token — não há Redis/Upstash no projeto, então o limitador não pode ser em memória (serverless multi-instância) |
| **Observabilidade / auditoria** | Emissão e consumo do convite geram linha em `log_auditoria` (`tabela = 'convite_contrato'`, ação `insert` na emissão, `update` no consumo) | Mitigação obrigatória citada no roadmap §4; mesmo padrão já usado no restante do sistema (AD-006) | **y** — confirmado; implementado reusando o trigger genérico `app.trg_auditoria()` já existente (mesmo mecanismo de `rel_usuario_contrato`/`fat_contrato`), sem código novo de auditoria |
| **5ª exceção da AD-010** | Nova AD explícita cobrindo "criação de conta a partir de convite por contrato" como rota de servidor com `service_role`, auditada, com as mitigações acima | AD-010 é lista fechada por design — qualquer novo caminho privilegiado exige decisão registrada, não uma exceção implícita | **y** — confirmado por Pedro 2026-08-11. Registrado como **AD-033** em `.specs/STATE.md` |
| Convite duplicado pro mesmo e-mail+contrato ainda pendente | Novo convite invalida (marca como expirado) qualquer convite anterior pendente pro mesmo e-mail+contrato+papel | Evita múltiplos tokens válidos simultâneos pra mesma combinação, reduzindo superfície de ataque e confusão de qual link é o vigente | **y** — confirmado por Pedro 2026-08-11. Mecanismo: `UPDATE dt_expiracao = now()` no(s) convite(s) pendente(s) anterior(es), reusando o mesmo predicado de "expirado" pro usuário final — não precisa de coluna nova |

**Open questions:** nenhuma. Todas as 6 confirmadas por Pedro em 2026-08-11 (assumindo a opção
recomendada em cada uma, sem rodada de discussão ao vivo) — ver `context.md` para o registro da
sessão. Segue para Design.

---

## User Stories

### P1: Gestora convida Mentor ou Assessor ⭐ MVP

**User Story**: Como Gestora, na tela do contrato, quero convidar um Mentor ou Assessor
informando e-mail, papel, cargo e áreas, e receber um link único pra repassar manualmente.

**Why P1**: É o ponto de entrada de toda a feature — sem emissão não há convite pra consumir.

**Acceptance Criteria**:

1. WHEN a Gestora (com vínculo ativo ao contrato) ou Admin preenche o formulário de convite
   (e-mail, papel `mentor`/`assessor`, cargo quando aplicável, grau de responsabilidade, áreas)
   THEN o sistema SHALL gerar um token, gravar seu hash em `convite_contrato` junto com
   `id_contrato`, o papel previsto e os dados do vínculo, com expiração de 7 dias.
2. WHEN o convite é criado THEN o sistema SHALL devolver a URL `/convite/<token>` uma única vez na
   tela (nunca reexibida depois, já que só o hash fica gravado).
3. WHEN já existe um convite pendente (não usado, não expirado) pro mesmo e-mail + contrato + papel
   THEN o sistema SHALL expirar o anterior automaticamente ao criar o novo.
4. WHEN um usuário sem vínculo ao contrato (nem Admin/Gestora) tenta convidar THEN o sistema SHALL
   rejeitar via RLS.

**Independent Test**: Como Gestora com vínculo, convidar um e-mail de teste pra Assessor; confirmar
a URL gerada, o hash em `convite_contrato` (nunca o token puro) e a expiração em 7 dias.

---

### P1: Convidado define nome e senha, conta nasce vinculada ⭐ MVP

**User Story**: Como Mentor ou Assessor convidado, ao abrir o link recebido, quero ver de qual
contrato se trata e definir meu nome e senha, pra começar a usar o sistema imediatamente.

**Why P1**: É o momento em que o convite se torna acesso real — sem isso, a emissão (US anterior)
não tem propósito.

**Acceptance Criteria**:

1. WHEN o convidado abre `/convite/<token>` com um token válido (hash bate, não usado, não
   expirado) THEN o sistema SHALL mostrar o nome do contratante e do produto do contrato, e um
   formulário pra nome e senha.
2. WHEN o convidado submete nome e senha válidos THEN o sistema SHALL criar a conta em
   `auth.users` (`email_confirm: true`), inserir `dim_usuario` (`papel_global` = o papel do
   convite) e `rel_usuario_contrato` (papel, cargo, grau de responsabilidade, áreas do convite),
   marcar o convite como usado (`dt_uso = now()`) e registrar em `log_auditoria` — nessa ordem, com
   verificação de idempotência caso a etapa de criar a conta já tenha rodado numa tentativa anterior.
3. WHEN o RPC de consumo tenta gravar `papel_global` fora de `('mentor','assessor')` (nunca deveria
   acontecer, mas é validado de qualquer forma) THEN o sistema SHALL rejeitar — guarda explícita,
   não confiança na origem da chamada.
4. WHEN o convidado submete com sucesso THEN o sistema SHALL redirecionar pro login (ou logar
   automaticamente) com acesso já restrito ao contrato do convite.

**Independent Test**: Abrir a URL de um convite de teste, definir nome+senha, confirmar
`dim_usuario`/`rel_usuario_contrato` criados corretamente e login subsequente funcionando.

---

### P1: Token inválido, expirado ou já usado é rejeitado com clareza ⭐ MVP

**User Story**: Como convidado, se meu link expirou ou já foi usado, quero uma mensagem clara —
não um erro genérico ou uma tela quebrada.

**Why P1**: É a superfície pré-sessão mais exposta desta feature (qualquer um com a URL chega
nela) — precisa se comportar bem em todos os casos de falha, não só no caminho feliz.

**Acceptance Criteria**:

1. WHEN o token não corresponde a nenhum hash gravado THEN o sistema SHALL mostrar "convite
   inválido", sem detalhar o motivo (não vazar se o token "quase" bateu).
2. WHEN o token corresponde mas `dt_expiracao < now()` THEN o sistema SHALL mostrar "convite
   expirado", orientando a pedir um novo à Gestora.
3. WHEN o token corresponde mas `dt_uso IS NOT NULL` (já consumido) THEN o sistema SHALL mostrar
   "convite já utilizado" — nunca permitir criar uma segunda conta com o mesmo convite.
4. WHEN a mesma rota recebe requisições em volume anormal (tentativas de força bruta no espaço de
   tokens) THEN o sistema SHALL aplicar rate limit por IP, devolvendo erro de limite excedido antes
   de consultar o banco.

**Independent Test**: Testar as 3 respostas (inválido, expirado, já usado) com tokens fabricados
pra cada caso; confirmar que nenhuma mensagem revela detalhe que ajude a adivinhar um token válido.

---

## Edge Cases

- WHEN a criação da conta em `auth.users` sucede mas a inserção de `dim_usuario` falha (ex.: e-mail
  já existe em `dim_usuario` de outro convite anterior nunca consumido) THEN o sistema SHALL
  detectar o conflito e reaproveitar a conta existente, atualizando apenas `rel_usuario_contrato` —
  nunca deixar duas contas Auth pro mesmo e-mail.
- WHEN o e-mail convidado já existe em `dim_usuario` com um `papel_global` diferente (ex.: já é
  `mentor` e agora é convidado como `assessor` de outro contrato) THEN o sistema SHALL adicionar o
  novo vínculo em `rel_usuario_contrato` sem alterar o `papel_global` existente — convite nunca
  reduz nem eleva um papel já estabelecido.
- WHEN a Gestora que emitiu o convite perde o vínculo com o contrato antes do convite ser usado
  (ex.: transferência de carteira) THEN o convite SHALL continuar válido — a autorização foi
  checada na emissão, não é revalidada contra o estado atual da Gestora no consumo.
- WHEN o convidado já tem uma sessão ativa (ex.: é Admin testando o link) THEN o sistema SHALL
  ainda processar o convite normalmente, sem misturar com a sessão corrente (fluxo pré-sessão,
  isolado).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CVT-01 | P1: Emissão do convite | Tasks | In Tasks (T2, T8, T11, T12) |
| CVT-02 | P1: Token — hash, nunca claro | Tasks | In Tasks (T1, T2, T6, T8) |
| CVT-03 | P1: Expiração de 7 dias | Tasks | In Tasks (T1, T2) |
| CVT-04 | P1: Invalida convite pendente duplicado | Tasks | In Tasks (T1, T2) |
| CVT-05 | P1: RLS — só quem tem vínculo/Admin convida | Tasks | In Tasks (T1, T2) |
| CVT-06 | P1: Consumo — cria conta + vínculo numa passagem | Tasks | In Tasks (T3, T10, T14, T15) |
| CVT-07 | P1: Guarda de papel — nunca admin/gestora via convite | Tasks | In Tasks (T1, T3, T7, T10) |
| CVT-08 | P1: Falha parcial — idempotência de conta já criada | Tasks | In Tasks (T3, T10, T15) |
| CVT-09 | P1: Token inválido/expirado/usado — mensagens distintas | Tasks | In Tasks (T3, T9, T10, T13) |
| CVT-10 | P1: Rate limit na rota de consumo | Tasks | In Tasks (T4, T9, T13, T15) |
| CVT-11 | P1: Auditoria de emissão e consumo | Tasks | In Tasks (T1 — reusa `app.trg_auditoria()`) |

**ID format:** `CVT-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 11 mapped to tasks, 0 unmapped — ver `tasks.md` (T1-T16, 5 fases)

---

## Success Criteria

- [ ] Um Mentor e um Assessor de teste, sem conta prévia, conseguem acessar o sistema de ponta a
      ponta só com o link de convite.
- [ ] Nenhum convite consumido cria papel `admin`/`gestora`, comprovado por teste de integração.
- [ ] Token nunca aparece em claro em nenhuma tabela — só o hash.
- [ ] Convite expirado/usado/inválido tratado com mensagem específica, sem 500 nem tela branca.
- [ ] Nova AD registrada em `.specs/STATE.md` cobrindo a 5ª exceção à AD-010.
