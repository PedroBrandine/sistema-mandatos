# Régua de Etapas e Instanciação — Design

**Status:** todos os pontos "n" do `spec.md`/`context.md` confirmados por Pedro nesta sessão, assumindo
o default já proposto em cada um (instrução explícita: "assuma todas as decisões recomendadas, não me
pergunte nada"). Este documento registra as decisões como confirmadas e resolve os detalhes de
implementação deixados a critério do agente.

---

## Confirmed Decisions (spec.md "Confirmed?" n → y)

| Assumption | Default proposto | Confirmado |
| --- | --- | --- |
| Ponto de integração | Trigger `AFTER INSERT ON fat_contrato` | y |
| Backfill na mesma migration do trigger | Sim, `ON CONFLICT DO NOTHING` | y |
| RLS das 3 tabelas novas — `WITH CHECK` explícito | Réplica literal da `USING`, não reuso implícito | y |
| Etapa sem `duracao_prevista_dias` | Comportamento literal da função (`COALESCE(...,0)`) | y |
| Quem escreve `id_etapa_atual` depois | Só o Kanban (feature separada) | y |
| Tela da régua — edição manual de datas previstas | Fora do MVP | y |

Nenhum ponto teve default alterado.

---

## Architecture

```
INSERT fat_contrato (wizard mandato | CMU-15 coalizão | qualquer futuro)
        │
        ▼ AFTER INSERT trigger (novo, não é schema aprovado — é wiring desta feature)
app.trg_instancia_contrato()
        │
        ▼ PERFORM
app.instancia_contrato(NEW.id_contrato)   -- verbatim, docs/schema_sistema.sql:1529-1559
        │
        ├──► fat_etapa_contrato   (1 linha por ref_etapa do produto, nao_iniciada)
        ├──► dim_planejamento     (1 linha, demais colunas NULL)
        └──► rel_formulario_contrato (1 linha por ref_formulario ativo do produto)
```

A função aprovada não muda. O trigger e seu wrapper são a única peça nova de arquitetura — não
existem no schema aprovado porque o documento nunca especificou *como* a função seria chamada; essa é
exatamente a decisão que esta feature resolve.

`SECURITY INVOKER` (default do Postgres, sem cláusula `SECURITY DEFINER`) em ambas as funções — AD-024
proíbe `SECURITY DEFINER` em escrita de negócio multi-tabela, e nem precisa aqui: quem cria um
`fat_contrato` hoje só consegue passar pelo RLS de `fat_contrato` (`p_por_carteira`) sendo
`admin`/`gestora` (a branch de vínculo não pode ser satisfeita por um `id_contrato` que acabou de
nascer). O trigger herda esse mesmo papel, e a `WITH CHECK` das 3 tabelas novas passa trivialmente pela
mesma branch de papel — nenhum privilégio novo é necessário.

---

## Data Model

Zero desenho novo — as 3 tabelas + a view são extraídas verbatim de `docs/schema_sistema.sql:708-889`
(`fat_etapa_contrato`, `rel_formulario_contrato`, `dim_planejamento`) e `:1185-1194` (`vw_etapa_contrato`),
mesmo padrão de extração incremental (AD-025) já usado em `0011_fundacao_rls.sql` e nos catálogos da
Trilha C. `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE VIEW`, mesma idempotência dessas migrations.

---

## Migrations Plan (4 arquivos, `supabase migration new <nome>`)

1. **`regua_instanciacao_estrutura`** — DDL: `fat_etapa_contrato`, `rel_formulario_contrato`,
   `dim_planejamento` (`CREATE TABLE IF NOT EXISTS`, verbatim) + `vw_etapa_contrato`
   (`CREATE OR REPLACE VIEW ... WITH (security_invoker = true)`, verbatim).
2. **`regua_instanciacao_rls`** — `ENABLE`/`FORCE ROW LEVEL SECURITY` nas 3 tabelas + policy
   `p_por_contrato` com `USING` **e** `WITH CHECK` explícitos, predicado idêntico
   (`app.papel_atual() IN ('admin','gestora') OR id_contrato = ANY(app.contratos_do_usuario())`) —
   mesma categoria de correção da FND-USR-02, aplicada por antecipação em vez de descoberta depois.
   `vw_etapa_contrato` não leva policy própria (é `security_invoker`, herda a RLS de
   `fat_etapa_contrato` via `JOIN`).
3. **`regua_instanciacao_grants`** — re-`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
   public TO legisla_app, legisla_admin, legisla_gestora` (AD-025 — obrigatório sempre que uma tabela
   nova entra em `public`, mesmo padrão de 0007/0008/0009/0010/catálogos) + `GRANT SELECT` a
   `legisla_mentor` em `fat_etapa_contrato, rel_formulario_contrato, dim_planejamento,
   vw_etapa_contrato` e a `legisla_assessor` em `dim_planejamento, rel_formulario_contrato` —
   exatamente as linhas do GRANT aprovado (`docs/schema_sistema.sql:2084-2098`) que passam a ter
   tabela para apontar agora que estas 3 existem.
4. **`regua_instanciacao_trigger_backfill`** — `app.instancia_contrato` (verbatim) + `app.
   trg_instancia_contrato()` (wrapper novo) + `CREATE TRIGGER ... AFTER INSERT ON fat_contrato` +
   backfill (`DO $$ ... FOR r IN SELECT id_contrato FROM fat_contrato LOOP PERFORM
   app.instancia_contrato(r.id_contrato) ...`) — trigger e backfill na mesma migration (RGI-06,
   AC1, literal).

Não há decisão de GRANT-only/RLS-disable aqui (AD-030 não se aplica — as 3 tabelas têm `id_contrato`,
então seguem o modelo padrão AD-001, igual a `rel_coalizao_membro`). Também não há revogação de `anon`
via `ALTER DEFAULT PRIVILEGES`: esse endurecimento (feito na Trilha C, `20260810193545_...sql`) é
específico de tabela `ref_*` sem RLS nenhuma, onde o GRANT é o único controle de acesso — aqui,
`FORCE ROW LEVEL SECURITY` já barra `anon`/qualquer papel sem vínculo na prática (`app.papel_atual()`
e `app.contratos_do_usuario()` resolvem vazio sem `app.id_usuario` setado), mesmo padrão que
`fat_contrato`/`dim_mandato` já operam sem essa camada extra. Fica registrado aqui para não silenciar
a leitura, não para agir sobre ela — é o mesmo debt documentado no handoff da Trilha C, fora do escopo
desta feature.

---

## Achado de Design — FK `ON DELETE RESTRICT` quebra 3 fluxos de exclusão existentes

Não estava no `spec.md`. As 3 tabelas novas referenciam `fat_contrato(id_contrato) ON DELETE
RESTRICT` (verbatim, `docs/schema_sistema.sql:710,732,879`) — e `dim_planejamento` nasce **sempre**,
incondicionalmente, para todo contrato (`INSERT ... ON CONFLICT DO NOTHING` sem depender de nenhum
catálogo ter linha). A partir do momento em que o trigger existir, **todo** `fat_contrato` novo ganha
uma linha em `dim_planejamento` (e, como os 3 produtos já têm `ref_etapa`/`ref_formulario` seedados
pela Trilha C, também em `fat_etapa_contrato`/`rel_formulario_contrato`) — e qualquer tentativa de
`DELETE FROM fat_contrato` sem apagar esses filhos primeiro passa a falhar com `23503`.

Isso quebra, sem nenhuma mudança própria neles, todo fluxo existente que apaga um `fat_contrato`:

- **3 rotas de frontend em produção**: `handleExcluirContrato` (`contratos/page.tsx:92-114`),
  `handleExcluir` (`mandatos/[id]/page.tsx:295-...`), `handleExcluirMandato` (`mandatos/page.tsx:81-...`)
  — todas já apagam `rel_usuario_contrato`/`rel_coalizao_membro` antes de `fat_contrato`, pelo mesmo
  motivo (essas duas também são `ON DELETE RESTRICT`); só precisam de mais 3 linhas cada.
- **6 arquivos de teste de integração** (`plataforma-tabelas`, `fundacao-tabelas` ×2,
  `fundacao-rls`, `fn-substituir-vinculo`, `fn-criar-mandato`, `auditoria-gap` ×3), ~9 call-sites de
  `DELETE FROM fat_contrato` em `afterAll`/inline, todos criados antes desta feature existir.

Escopo desta feature: corrigir os 9 pontos (3 frontend + ~9 SQL de teste) na mesma leva de tasks —
sem isso, `npm run test:integration` (o próprio gate desta feature) e a exclusão de contrato em
produção quebram no primeiro push. Não é redesenho de nada — é a mesma tabela e a mesma FK do schema
aprovado, só que agora com um filho de verdade a apagar primeiro. Tratado como task própria por
arquivo/grupo (ver `tasks.md`), não espalhado silenciosamente dentro de outras tasks.

---

## Frontend — Tela da régua (P2, RGI-09/RGI-10)

**Onde:** `src/frontend/app/(app)/contratos/[id]/etapas/[codigo]/page.tsx` — já existe como placeholder
(`<EmDesenvolvimento>`) da Trilha F (`navegacao-por-produto`), com o comentário "vazia de conteúdo por
ora (que dependeria de `fat_etapa_contrato`, não provisionada)". Esta feature preenche exatamente esse
placeholder — não cria rota nova, não toca `ficha-contrato-chrome.tsx` nem `contratos/[id]/page.tsx`
(ambos com edição não commitada de outra sessão em andamento — `git status` no início desta sessão já
mostrava os dois como `M`; fora do escopo e do risco desta feature tocar).

**Layout:** tabela única (shadcn `Table` + `Badge`, como `context.md` já apontou) listando **todas**
as etapas do produto — não só a etapa do `codigo` da URL — ordenadas por `ordem`, com a linha cuja
`codigo_etapa` bate com o `codigo` da rota destacada (`bg-muted`/`ring`). Colunas: Etapa, Status
(`Badge`, variante por status), Previsto (início → conclusão), Realizado (início → conclusão, `—`
quando `NULL`), Atraso (Badge destrutivo só quando `esta_atrasada`, valor de `dias_atraso` — nunca
recalculado no cliente, AD-005/RGI-10 literal).

Cada aba de etapa mostrar a régua inteira (não só a própria linha) resolve a ambiguidade do AC1
("SHALL listar as etapas do produto... com status, data prevista e data realizada") sem inventar uma
rota nova: a barra de abas (já ordenada por `ordem`, T14 da Trilha F) já é a navegação; o conteúdo de
cada aba é a mesma tabela completa, só a linha em foco muda. Uma tabela só, sem estado de carregamento
por etapa individual, também é a leitura mais simples do "AC3: mostrar a régua completa mesmo com
tudo `nao_iniciada`, nunca tratar como vazio".

**Sem TanStack Query/Table.** O `roadmap.md` (§1.3) registra esta tela como candidata a "primeiro
consumidor real" do TanStack Query/Table instalado pela Trilha D — mas isso é uma nota de
oportunidade no documento de planejamento, não um requisito desta spec (nenhum AC menciona TanStack) e
`context.md` já resolveu o layout apontando para os padrões shadcn simples em uso. O componente pai
direto desta página (`FichaContratoChrome`) e a própria página hoje usam `useEffect`+`useState` manual
— migrar só esta folha para `useQuery` criaria uma inconsistência de padrão de fetch dentro da mesma
árvore de componentes sem nenhum ganho pedido pela spec. **SPEC_DEVIATION registrada, não decretada**:
fica como próximo candidato natural para adotar TanStack de verdade quando uma feature *pedir*
cache/refetch entre telas (ex.: Kanban, que vai escrever na mesma tabela e precisa invalidar essa
leitura) — não antecipado aqui.

**Backend query:** `src/backend/queries/etapa-contrato.ts`, função
`buscarReguaDoContrato(client, idContrato): Promise<EtapaRegua[]>`, uma única leitura de
`vw_etapa_contrato` filtrada por `id_contrato`, ordenada por `ordem` — a view já entrega
`codigo_etapa`/`nome_etapa`/`ordem`/`dias_atraso`/`esta_atrasada` prontos, sem join manual no cliente
(mesmo padrão de `buscarEtapasDoProduto`, `contrato.ts`).

**Types:** `npm run db:types` precisa rodar depois do `db push` das migrations 1-4, antes deste
arquivo existir de verdade tipado — mesma pendência que a Trilha C deixou registrada para "quem
construir a primeira tela que leia estas tabelas".

---

## Testing Strategy

- **Integração, RLS** (`supabase/tests/operacao/regua-rls.integration.test.ts`): réplica do padrão
  `usuario-with-check.integration.test.ts` — Gestora/Mentor sem vínculo tenta `INSERT` direto em
  `fat_etapa_contrato` de um contrato de outra carteira → `42501`; com vínculo ou Admin/Gestora →
  sucesso. Cobre as 3 tabelas nos dois sentidos (leitura filtrada, escrita rejeitada/aceita), RGI-07/08.
- **Integração, instanciação** (`supabase/tests/operacao/regua-instanciacao.integration.test.ts`):
  cria `fat_contrato` via SQL cru (mesma técnica de `fundacao-rls`) e confirma que o trigger populou
  as 3 tabelas com as contagens/status/datas esperadas (RGI-01 a 04); chama `app.instancia_contrato`
  de novo manualmente e confirma zero linha duplicada (RGI-05); roda o backfill novamente
  (`SELECT app.instancia_contrato(id_contrato) FROM fat_contrato WHERE id_contrato = ...`) e confirma
  o mesmo (RGI-06 AC2).
- **Unit** (`src/backend/queries/etapa-contrato.test.ts`): mock de client, mesmo padrão de
  `contrato.test.ts` — mapeamento de coluna→campo, ordenação por `ordem`, lista vazia sem lançar.
- **Regressão dos 9 call-sites de FK** (task própria): os testes de integração pré-existentes
  continuam verdes com a limpeza extra — não precisam de teste novo, o gate `npm run test:integration`
  já prova isso.

---

## Non-Goals (reafirmados do spec.md)

Kanban (escrita de transição), G1/G2, hierarquia de Planejamento, gestão de Formulários, edição manual
de data prevista — nenhum tocado aqui.
