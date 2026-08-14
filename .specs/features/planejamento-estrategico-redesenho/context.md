# Planejamento Estratégico — Redesenho da Tela — Discuss

Decisões capturadas em conversa direta com Pedro (2026-08-13/14), antes de Design. Nenhum default
foi assumido sem confirmação nos 6 pontos abaixo — os únicos 2 pontos sem confirmação síncrona
(D-C, D-D) já vinham marcados como "não invente, deixe TODO" pelo próprio pedido original de Pedro,
e são tratados como tal (default documentado, sinalizado, não decidido).

## Achado 1 — a tela já existe e já foi validada

Antes de qualquer pergunta, a investigação desta sessão achou que `/contratos/[id]/planejamento`
não era placeholder: é a feature `planejamento-planilha-monitoramento`, concluída e validada em
2026-08-12 (PLM-01 a PLM-18). O pedido original de Pedro não referenciava esse código — coerente com
ele não ter em mente o estado exato do repositório ao escrever a especificação, não com um erro dele.

**Pergunta**: como enquadrar o trabalho, dado que a tela já existe?
**Resposta de Pedro**: Feature formal de redesenho — Discuss → Design → Tasks → Execute (não pular
para Design/Tasks direto).

## Achado 2 — papel `legisla` conflita com AD-018 e com o schema

O pedido original define `legisla` como 5º papel, com menos capacidade que `gestora` (só Ler, sem
CRUD, sem auditoria). Isso conflita com:
- **AD-018** (`.specs/STATE.md`, ativa): *"Papéis são quatro (...); 'Interno Legisla' recebe acesso
  de Gestora"* — não é um papel separado.
- `CONSTRAINT ck_usuario_papel CHECK (papel_global IN ('admin','gestora','mentor','assessor'))`
  (`docs/schema_sistema.sql:319`) — `'legisla'` não é um valor aceito hoje.

Restringir `legisla` só na UI mantendo o papel Postgres real como `gestora` violaria a própria regra
do pedido original (§4: "a UI reflete a RLS; ela não é o mecanismo de segurança") — a restrição
seria cosmética, não real.

**Pergunta**: criar papel real novo (migration + RLS/GRANT + AD que emenda AD-018) ou descartar a
distinção?
**Resposta de Pedro**: Descartar a distinção, usar `gestora`. AD-018 continua valendo como está —
Interno Legisla é `papel_global='gestora'`. Onde o pedido original queria um modo restrito para esse
público, a tela oferece o modo **Ler** como escolha de UI para quem tem papel `gestora` (não como
segurança adicional) — qualquer `gestora` pode escolher o modo Ler; nenhum papel novo é criado.

**Consequência para `design.md`**: `PERMISSOES` tem 4 chaves (`gestora`/`mentor`/`assessor`/`admin`),
não 5. `admin` replica o perfil de `gestora` nesta tela (impersonation é gap de plataforma — Achado
4 abaixo).

## Achado 3 — GIP já é escopo de outra feature (Design aprovado)

`.specs/features/formularios-produto/design.md`/`spec.md` (FRM-15 a FRM-19) já é dono de provisionar
`fat_gip`/`fat_gip_dimensao`/`vw_gip_evolucao`, incluindo o único caminho de escrita real
(`app.trg_deriva_gip`, disparado por submissão do formulário GIP — sem essa feature, as tabelas
ficariam vazias, sem consumidor de escrita). Descoberto **depois** de Pedro já ter respondido
"provisionar agora" a esta mesma pergunta — a resposta original foi dada sem essa informação.

**Pergunta (revisada)**: tratar GIP como IIP (esperar) ou provisionar aqui mesmo com o risco de
duplicar/colidir com `formularios-produto`?
**Resposta de Pedro**: Tratar como o IIP — esperar. Esta feature entrega a seção GIP como
placeholder "em desenvolvimento" na coluna esquerda; liga a leitura real (`vw_gip_evolucao`) quando
`formularios-produto` concluir.

## Achado 4 — IIP/Insight/Fato Gerador dependem de feature em execução agora

`.specs/features/incidencia-encontros/` está em execução (T1-T15/35 concluídas nesta sessão de
outra pessoa/janela — commits de hoje). O schema de IIP (`mv_iip_contrato`/`vw_iip_contrato`) e de
Insight/Fato Gerador já existe e está testado, mas a UI de leitura (`IipCard`, formulários, T28-T35)
ainda não foi construída — é trabalho já planejado e sequenciado naquela feature.

**Pergunta**: esperar aquela feature terminar ou construir aqui, em paralelo (risco de conflito de
arquivo/duplicação)?
**Resposta de Pedro**: Esperar. Esta feature nasce sem IIP/incidência (placeholders), liga quando
`incidencia-encontros` concluir T16-T35.

## Achado 5 — Admin impersonation não existe em nenhuma tela do projeto

Grep confirmado em `src/` inteiro: nenhuma infraestrutura de impersonation (`"atuando como X"`,
`id_usuario_impersonado` em escrita de UI) existe hoje, apesar de AD-018 prever isso como modo de
operação do Admin. Não foi levado como pergunta formal — registrado como Out of Scope em `spec.md`
(é feature de plataforma própria, não cabe dentro de um redesenho de tela). `admin` nesta tela
recebe o mesmo perfil de `gestora`, sem faixa de impersonation.

## Achado 6 — D-B (tratamento de `NULL` na cascata) diverge do default do pedido original

`app.recalcula_atingimento` (`20260812145917_planejamento_planilha_cascata.sql:17-53`, já em
produção, testado) usa `COALESCE(pct_atingimento, 0)` nos 3 níveis — um Sucesso Mensal pendente
**conta como 0** na média, não fica fora dela. O pedido original propõe o oposto como default
("SMs com `pct_atingimento IS NULL` ficam fora da média").

**Pergunta**: manter o comportamento em produção ou migrar a função para o novo default (muda os
números que a Gestora vê hoje em contratos com SM pendente)?
**Resposta de Pedro**: Manter como está (conta como 0). Nenhuma migration nova em
`app.recalcula_atingimento`. A tela nova mostra a cobertura n/N ao lado do % para deixar claro
quantos SM entraram — mitigação de UI, não mudança de fórmula.

## Pontos sem decisão síncrona — default documentado, TODO no código (per pedido original)

### D-C — Escopo do mês em Monitorar

- **Hoje**: `buscarGradeSucessosMensais` filtra só o mês de referência corrente
  (`mesReferenciaCorrente()`, `contratos/[id]/planejamento/page.tsx:42-47`).
- **Default do pedido original, adotado aqui**: mostrar todos os Sucessos Mensais do ciclo, com a
  data limite (`dt_limite`) visível — não só o mês corrente.
- **Marcar**: `// TODO(D-C)` no ponto de query que decide o filtro (`design.md` → Data/Queries).
- Pedro pode reverter para "só mês corrente" a qualquer momento sem custo de migration — é filtro de
  query, não mudança de schema.

### D-D — Mecanismo de undo no backend

- **Não existe hoje** nenhuma forma de undo na tela.
- **Default adotado aqui**: pilha de undo **client-side** (sessão do navegador, não persistida) —
  cada escrita bem-sucedida (célula única, faixa colada, edição em massa) empilha
  `{ tabela, chave, valorAnterior }`; `Ctrl+Z` reescreve o valor anterior **pelo mesmo caminho de
  escrita já validado** (UPDATE direto ou RPC de lote, conforme o caso) — nunca via
  `DELETE`/`UPDATE` direto em `log_auditoria`.
- **Por que este default**: `log_auditoria` é append-only por desenho (AD-006) — apagar ou editar
  uma linha de auditoria pra "desfazer" quebraria essa garantia em qualquer feature que dependa da
  trilha completa. Reescrever pelo caminho normal produz uma **nova** linha de auditoria (mostrando
  a reversão como o que ela é: mais uma escrita), o que satisfaz literalmente "revertendo também o
  registro de auditoria correspondente" do pedido original sem violar o append-only.
- **Marcar**: `// TODO(D-D)` no hook `use-undo-planejamento.ts` (`design.md` → Components).
- Se Pedro preferir um mecanismo diferente (ex.: buffer de sessão do servidor, ou desfazer que
  também anota "desfeito por X" na própria linha), é troca isolada nesse hook — não afeta o resto do
  redesenho.
