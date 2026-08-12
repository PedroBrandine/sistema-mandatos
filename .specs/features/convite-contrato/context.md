# Convite por Contrato Context

**Gathered:** 2026-08-11
**Spec:** `.specs/features/convite-contrato/spec.md`
**Status:** ✅ Confirmado por Pedro em 2026-08-11 — as 6 questões sensíveis (5ª exceção da AD-010,
guarda de papel no RPC de consumo, expiração de 7 dias, invalidação de convite duplicado, rate
limit por IP, tratamento de e-mail já existente com outro papel) foram todas assumidas com a opção
recomendada, sem rodada de discussão ao vivo — Pedro instruiu seguir direto para Design → Tasks →
Execute → Validate sem pausar para novas confirmações. Independente das outras 4 specs desta
rodada — não toca tabela de Operação/Planejamento.

---

## Feature Boundary

Convite por token (hash, uso único, expiração de 7 dias) pra Mentor/Assessor externos criarem
conta e já nascerem vinculados a um contrato específico. Não é reenvio de e-mail, não é
pareamento automático do PLL, não é convite pra papel interno (admin/gestora).

---

## Implementation Decisions

### Por que não é magic link (esclarecido direto ao Pedro antes desta spec)

- AD-026 removeu magic link só pro público interno Legisla, por causa do rate limit de e-mail do
  plano free da Supabase — foi substituído por e-mail+senha repassada manualmente.
- Essa troca nunca resolveu o público externo (Mentor/Assessor), que não tem conta prévia nem
  senha combinada por Slack. O convite por token é um mecanismo diferente, desenhado pra criar a
  conta pela primeira vez, não pra autenticar uma já existente — daí não competir com a AD-026, e
  precisar de uma decisão registrada própria (a 5ª exceção da AD-010), não uma reversão da AD-026.

### Guarda de papel é a lição da FND-USR-02, aplicada por antecipação

- A FND-USR-02 (corrigida nesta mesma sprint) mostrou que confiar em "a UI não oferece essa opção"
  pra impedir escalada de papel não é suficiente — precisa de guarda explícita na escrita.
- Decisão: o RPC de consumo do convite valida `papel_global IN ('mentor','assessor')`
  explicitamente, independente do que o formulário de convite já restringe no lado da Gestora.

### Falha parcial entre Auth API e transação SQL

- `auth.admin.createUser` (API) e o `INSERT` em `dim_usuario`/`rel_usuario_contrato` (SQL) não
  compartilham transação — é uma fronteira real do modelo Supabase, não uma escolha desta feature.
- Decisão: a rota de consumo verifica existência prévia antes de criar, pra ser segura de
  reexecutar se a etapa anterior tiver rodado mas a seguinte falhado. Sem isso, um erro de rede no
  meio do fluxo deixaria a pessoa convidada permanentemente travada (conta Auth existe, mas sem
  `dim_usuario`, e o convite já foi "gasto" tentando).

### Agent's Discretion

- Algoritmo exato de hash do token (SHA-256 é a proposta, mas Design pode escolher outro
  equivalente) — detalhe de implementação.
- Texto exato das 3 mensagens de erro (inválido/expirado/usado) — copy, resolvido em Design.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma rodada de Discuss ao vivo aconteceu — spec produzida em lote a pedido do Pedro, com base no
desenho já esboçado no `roadmap.md` §4 (herdado de uma versão anterior do documento). Gray areas
registradas como assumptions no `spec.md`, aguardando confirmação:

- Expiração de 7 dias (o roadmap só dizia "expiração curta", sem número).
- Convite duplicado invalida o anterior automaticamente.
- Rate limit por IP na rota de consumo (mecanismo, não só o requisito já citado no roadmap).
- Tratamento de e-mail já existente em `dim_usuario` com outro papel.

---

## Specific References

- `.specs/roadmap.md` §4, Trilha B — desenho original dos 5 passos (convidar → gerar token →
  devolver URL → convidado define senha → RPC cria conta), citado quase literalmente no `spec.md`.
- `scripts/gerar-link-acesso.ts` — padrão de referência pra "URL copiada manualmente, sem SMTP",
  já em uso no fluxo interno (AD-026).

---

## Deferred Ideas

- Pareamento automático mentor↔mentorado do PLL reaproveitando este mecanismo — citado no roadmap
  como "bônus", mas sem lógica de pareamento definida; registrado como extensão futura no
  `spec.md`, não desenhado aqui.
- Tela de revogação/listagem de convites pendentes — não pedida, ação manual via SQL nesta fatia.
- Reenvio de convite expirado pela própria pessoa convidada — a Gestora reemitir é o caminho
  aceito por ora.
