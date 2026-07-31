# Login com senha (Interno Legisla) Specification

## Problem Statement

O rate limit de e-mail do plano free da Supabase (~2 e-mails/hora) inviabiliza login via magic link em equipe — a equipe interna `@legislabrasil.org` não consegue testar as telas de Fundação no Preview da Vercel. O método formalmente correto pra esse público (§5.3 da Constituição) é SSO Google Workspace, mas configurá-lo (OAuth no Google Cloud Console + Supabase Auth) não foi feito ainda. Login com e-mail+senha é um desvio deliberado e temporário (registrado em `AD-026`) pra destravar o teste agora, sem esperar o SSO.

## Goals

- [ ] Um colega `@legislabrasil.org` com senha já provisionada consegue logar no Preview via e-mail+senha e acessar as telas de Fundação.
- [ ] Pedro (Admin) consegue provisionar a mesma senha pra toda a equipe de uma vez, rodando um único comando local, sem depender de nenhum envio de e-mail.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| ------- | ------ |
| SSO Google Workspace (§5.3) | Seria o método formalmente correto pra este público, mas exige configuração de OAuth ainda não feita. Login com senha é o desvio deliberado registrado em `AD-026` — SSO continua sendo o alvo de longo prazo. |
| Recuperação de senha por e-mail ("esqueci minha senha") | Dependeria do mesmo envio de e-mail com rate limit — mesmo problema de origem que esta feature existe pra contornar. Redefinição fica só via a ferramenta do admin (P2). |
| Autocadastro (self-signup, colega escolhe a própria senha) | Decisão do usuário: o admin define e repassa a senha manualmente, não o colega escolhendo na primeira vez. |
| Login com senha pra Mentor/Consultor externo ou Assessor do mandato | Fora do público-alvo do desvio `AD-026` — esses papéis continuam previstos para magic link (§5.3) quando restaurado na tela de login. |
| Remover/limpar `scripts/gerar-link-acesso.ts` e `/admin/acesso` (bypasses dev anteriores) | Ferramentas dev-only inofensivas (guardadas por `NODE_ENV`/domínio); cleanup fica pra depois, fora desta feature. |
| Rate limiting customizado de tentativas de login com senha | Supabase Auth já aplica proteção padrão contra força bruta; §5.5 (transversal) já cobre isso — nada novo é construído aqui. |
| Mudança de schema/RLS | `dim_usuario` e o trigger de auto-provisionamento (migração 0018) já cobrem o caso — nenhuma migração nova é necessária. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| ---------------------- | --------------- | --------- | ---------- |
| Como a senha inicial é definida e distribuída | Admin (Pedro) roda um comando local **uma única vez**, passando uma lista de e-mails `@legislabrasil.org` e **uma senha compartilhada** via `service_role`; repassa essa senha manualmente (Slack/WhatsApp), uma vez, pra todo mundo | Perguntado diretamente ao usuário entre 3 opções (self-signup, lote com senha individual, lote com senha única) — escolheu lote com senha única pela simplicidade de distribuição (evita self-signup, que exigiria desligar `enable_confirmations` do projeto inteiro) | y |
| Risco de senha compartilhada entre todos os colegas | Aceito conscientemente pro cenário atual (equipe pequena, interna, uso temporário sob `AD-026`) | Uma senha vazada ou uma saída de equipe exige rodar o comando de novo pra toda a lista com senha nova — não há individualização de quem vazou, mas o escopo é temporário e o acesso real ainda é decidido pela RLS/`dim_usuario`, não pela senha | y (default, risco aceito explicitamente pelo usuário) |
| Convivência com magic link na tela `/login` | Substitui completamente por enquanto (magic link sai da tela) | Perguntado diretamente ao usuário — escolheu simplicidade visual sobre manter os dois métodos coexistindo | y |
| Requisito mínimo de senha | Usa o mínimo padrão da Supabase (6 caracteres), sem regra adicional | Caso de uso interno temporário, sem exigência de compliance documentada além disso | y (default, sem objeção levantada) |
| Mensagem de erro de credencial inválida | Repassa `error.message` da Supabase (inglês, ex. "Invalid login credentials"), igual ao padrão já usado hoje pra erros de magic link em `login-form.tsx` | Consistência com o código existente; tradução de mensagens de erro está fora de escopo | y (default) |
| `dim_usuario` continua auto-provisionado como `gestora` no primeiro login | Sim, sem mudança — o trigger da migração 0018 dispara em qualquer `INSERT` em `auth.users`, independente do método de criação | Já implementado e testado nesta sessão (script `gerar-link-acesso.ts`); nenhuma migração nova necessária | y (default) |
| Onde roda a ferramenta de provisionamento de senha | Script CLI local em `scripts/`, reaproveitando `src/backend/supabase/admin.ts` já existente — nunca uma rota HTTP | Mesmo padrão e mesma razão já aplicados a `scripts/gerar-link-acesso.ts` nesta sessão (nunca expor `service_role` como rota pública) | y (default) |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Colega loga com e-mail e senha ⭐ MVP

**User Story**: Como colega `@legislabrasil.org` com senha já provisionada, quero entrar no Preview com e-mail e senha, para testar as telas de Fundação sem esperar e-mail nenhum.

**Why P1**: É o objetivo direto do pedido — "preciso que as outras pessoas acessem as telas".

**Acceptance Criteria**:

1. WHEN um usuário com senha provisionada submete e-mail e senha corretos na tela `/login` THEN o sistema SHALL autenticar e redirecionar pro destino pós-login já existente hoje (comportamento inalterado em relação ao fluxo de magic link).
2. WHEN um usuário submete e-mail ou senha incorretos THEN o sistema SHALL exibir uma mensagem de erro genérica (sem indicar se o e-mail existe ou não) e permanecer na tela de login.
3. WHEN a tela `/login` é carregada THEN o sistema SHALL exibir apenas o formulário de e-mail e senha — o formulário de magic link é removido desta tela enquanto `AD-026` estiver ativo.

**Independent Test**: Provisionar uma senha de teste (via P2), abrir `/login` no Preview (não localhost), logar com e-mail+senha, confirmar redirecionamento e sessão válida (cookie `httpOnly`, mesmo mecanismo de sessão do §5.3).

---

### P2: Admin provisiona uma senha compartilhada pra vários colegas de uma vez

**User Story**: Como Pedro (Admin), quero rodar um único comando local que define a mesma senha pra uma lista de e-mails `@legislabrasil.org`, para repassar essa senha uma única vez (ex.: no Slack) sem depender de e-mail nenhum e sem rodar o comando pessoa por pessoa.

**Why P1 na prática**: pré-requisito direto do P1 — sem isso, ninguém tem senha pra usar. Listado como história separada porque é independentemente testável.

**Acceptance Criteria**:

1. WHEN o admin roda o comando com uma senha e uma lista de e-mails `@legislabrasil.org` THEN o sistema SHALL, pra cada e-mail que ainda não existe em `auth.users`, criar o usuário já com e-mail confirmado e essa senha, sem enviar nenhum e-mail.
2. WHEN um e-mail da lista já existe em `auth.users` THEN o sistema SHALL redefinir a senha desse usuário pra mesma senha informada, sem duplicar ou alterar a linha correspondente em `dim_usuario`.
3. WHEN algum e-mail da lista está fora de `@legislabrasil.org` THEN o sistema SHALL recusar especificamente esse e-mail (pular e avisar) sem abortar o processamento dos demais e-mails válidos da lista.
4. WHEN o comando termina THEN o sistema SHALL imprimir um resumo (quais e-mails foram criados, quais foram redefinidos, quais foram recusados) e a senha em texto claro, só no terminal local (nunca gravada em arquivo, nunca enviada a serviço externo).

**Independent Test**: Rodar o comando com uma senha de teste e uma lista de 2-3 e-mails de teste, confirmar em `auth.users` (via client `service_role`) que todos existem com a mesma senha, sem nenhum e-mail disparado; rodar de novo com um e-mail já existente e confirmar que a senha foi redefinida, não duplicada.

---

## Edge Cases

- WHEN o comando roda sem nenhum e-mail na lista (ou sem argumentos) THEN o sistema SHALL exibir instrução de uso e não fazer nenhuma chamada à API.
- WHEN `dim_usuario` já tem `papel_global` diferente de `gestora` pro e-mail (ex.: alterado manualmente depois do auto-provisionamento) THEN redefinir a senha SHALL preservar o papel existente — a ferramenta nunca escreve em `dim_usuario`, só em `auth.users`.
- WHEN o login por senha é bem-sucedido no Preview THEN o comportamento do `proxy.ts` (sessão via cookie `httpOnly`) permanece inalterado — diferente da mini feature anterior (`/admin/acesso`), esta feature não precisa de nenhuma exceção no gate de auth do proxy, porque `/login` já é rota pública.
- WHEN Pedro precisa trocar a senha compartilhada depois (ex.: vazamento, alguém saiu da equipe) THEN a rotação é manual — rodar o mesmo comando de novo com a lista de e-mails atualizada e uma senha nova; não há automação ou expiração adicional nesta feature.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --------------- | ----- | ----- | ------- |
| AUTHPWD-01 | P1: login com senha (AC1 — sucesso) | Execute | Pending |
| AUTHPWD-02 | P1: login com senha (AC2 — erro genérico) | Execute | Pending |
| AUTHPWD-03 | P1: login com senha (AC3 — magic link removido) | Execute | Pending |
| AUTHPWD-04 | P2: provisionamento em lote (AC1 — criação nova) | Execute | Pending |
| AUTHPWD-05 | P2: provisionamento em lote (AC2 — redefinição) | Execute | Pending |
| AUTHPWD-06 | P2: provisionamento em lote (AC3 — gate de domínio por item, não aborta o lote) | Execute | Pending |
| AUTHPWD-07 | P2: provisionamento em lote (AC4 — resumo final impresso) | Execute | Pending |

**ID format:** `AUTHPWD-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 7 total, 7 mapeados pra Execute (escopo Medium — Design/Tasks inline, sem documentos separados), 0 sem mapeamento.

---

## Success Criteria

Como sabemos que a feature foi bem-sucedida:

- [ ] Pedro provisiona a senha compartilhada pra toda a equipe em uma única execução do comando, sem depender de nenhum e-mail.
- [ ] Pelo menos um colega real (não o Pedro) confirma login bem-sucedido no Preview usando e-mail e a senha compartilhada.
- [ ] Nenhuma senha aparece em log persistente, arquivo commitado, ou qualquer serviço externo além do terminal local do admin no momento da execução.
