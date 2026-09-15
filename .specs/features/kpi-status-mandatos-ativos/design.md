# KPI de situação dos mandatos ativos — Design

Spec: [spec.md](spec.md) · Decisões: AD-050, AD-051 (`.specs/STATE.md`)

## Princípio que governa este design

A view agrega, a tela mostra (AD-003). O fechamento exigido por KSM-03
(`atrasados + atenção + normal = mandatos ativos`) é responsabilidade do
**SQL**, não do componente: somar as três linhas no cliente para "garantir"
que batem seria a agregação inventada pela tela que AD-003 proíbe, e
esconderia justamente o defeito que esta feature existe para corrigir. O
componente renderiza quatro números que já chegam coerentes — e o teste de
integração é quem prova a coerência.

---

## Camadas alteradas

| Camada | Arquivo | Mudança |
| --- | --- | --- |
| Banco | `supabase/migrations/<novo>_estrategia_kpi_situacao_mandatos.sql` | `CREATE OR REPLACE VIEW vw_estrategia_kpi` com a classificação por etapa de referência (AD-051) |
| Dados de dev | `supabase/seed_cenarios_estrategia.sql` (novo) | Recompõe os contratos de teste cobrindo os 4 casos de classificação |
| Query | `src/backend/queries/estrategia-kpi.ts` | Remove `mandatosEmAtraso` do tipo e do `select` |
| Componente | `src/frontend/components/estrategia/kpi-row.tsx` | `KpiMandatosAtraso` → `KpiMandatosAtivos`; faixa de 6 → 5 cards |
| Componente | `src/frontend/components/estrategia/quadro-acompanhamento.tsx` | Card vira `<Link>` para `/contratos/[id]` |

Não mudam: `vw_pendencias`, `ref_limiar_pendencia`, `classificarLimiar`
(`lib/limiar.ts`), `app.mover_etapa_kanban`, a página do Dashboard.

---

## 1. A view (KSM-02 a KSM-06)

### Etapa de referência — o coração da mudança

Hoje `etapa_classificacao` exige `c.id_etapa_atual IS NOT NULL` e descarta o
resto. AD-051 troca o descarte por um fallback, replicando **verbatim** a
regra que `buscarBoardKanban` já usa (`kanban.ts:172-178`):

- etapa de referência = `id_etapa_atual`, ou a etapa de **menor `ordem`** do
  produto quando não há transição registrada;
- âncora de contagem = `fat_etapa_contrato.dt_inicio` daquela etapa, ou
  `fat_contrato.dt_inicio` quando não existe linha de transição.

```sql
etapa_referencia AS (
  SELECT
    c.id_contrato,
    COALESCE(e_atual.duracao_prevista_dias, e_ordem1.duracao_prevista_dias) AS duracao_ref,
    COALESCE(fec.dt_inicio, c.dt_inicio)                                    AS dt_ancora
  FROM fat_contrato c
  LEFT JOIN ref_etapa e_atual
         ON e_atual.id_etapa = c.id_etapa_atual
  -- Só materializa a etapa de ordem 1 quando não há etapa atual: o LEFT JOIN
  -- LATERAL com condição falsa devolve NULL sem custo de subconsulta.
  LEFT JOIN LATERAL (
    SELECT e.duracao_prevista_dias
      FROM ref_etapa e
     WHERE e.id_produto = c.id_produto
     ORDER BY e.ordem
     LIMIT 1
  ) e_ordem1 ON c.id_etapa_atual IS NULL
  -- Não casa quando id_etapa_atual é NULL (NULL = NULL é desconhecido), e é
  -- justamente por isso que dt_ancora cai em c.dt_inicio nesse caso.
  LEFT JOIN fat_etapa_contrato fec
         ON fec.id_contrato = c.id_contrato
        AND fec.id_etapa    = c.id_etapa_atual
  WHERE c.status = 'ativo'
),
etapa_classificacao AS (
  SELECT
    er.id_contrato,
    CASE
      WHEN le.atrasado_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref * 100) >= le.atrasado_pct_ativo
        THEN 'atrasado'
      WHEN le.atencao_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref * 100) >= le.atencao_pct_ativo
        THEN 'atencao'
      ELSE 'normal'
    END AS estado
  FROM etapa_referencia er
  CROSS JOIN limiar_etapa le
  WHERE er.duracao_ref IS NOT NULL
    AND er.duracao_ref > 0
)
```

Preservado de `20260914161230`: ordem de prioridade (atrasado antes de
atenção), `>=` e não `>`, os dois percentuais vindos de
`ref_limiar_pendencia` (AD-004/AD-045), e `CREATE OR REPLACE` para não
derrubar a ACL da view.

### Por que o fechamento passa a valer

`mandatos_ativos` conta `ce.status = 'ativo'`; `etapa_referencia` filtra pelo
mesmo predicado; o `CASE` é total (todo contrato que chega nele sai com
exatamente um dos três estados). Logo as três contagens particionam o mesmo
conjunto que o número grande conta — **exceto** pelo contrato cuja etapa de
referência não tem `duracao_prevista_dias`, único vazamento possível e
declarado no spec (Edge Cases).

### Limiar inativo (KSM-05)

Mantido de `20260914161230`: a coluna inteira vira `NULL` quando o limiar
correspondente está desligado. O fechamento sobrevive porque o `CASE` também
deixa de produzir aquele estado — os contratos que cairiam nele descem para
`atencao`/`normal`, e as colunas com valor continuam somando o total. Mesma
semântica de `classificarLimiar` quando recebe um parâmetro nulo.

### `mandatos_em_atraso`

Permanece na view (remover exigiria `DROP VIEW`, que derrubaria a ACL —
`Out of Scope`). Perde todo consumidor. O `COMMENT ON VIEW` é reescrito para
registrar que a coluna está órfã e que a definição vigente de atraso é a da
quebra, evitando que alguém a reintroduza numa tela achando que é o número
bom.

---

## 2. Query (`estrategia-kpi.ts`)

`EstrategiaKpi` perde `mandatosEmAtraso`; `RowEstrategiaKpi`,
`KPI_AUSENTE`, a lista literal do `.select()` e o mapeamento perdem
`mandatos_em_atraso`. O `.select()` continua sendo string literal inline — a
inferência de tipo do supabase-js depende disso (comentário já no arquivo).

Nenhuma mudança na escolha de linha por escopo: o recorte de KSM-07 já é
"uma coordenada da própria linha" e está correto. O sintoma de incoerência
sob filtro é consequência dos contratos não classificados — o número grande
se movia com o filtro e a quebra ficava quase parada, porque quase todos os
contratos estavam fora dela. AD-051 remove a causa; KSM-07/KSM-08 provam o
resultado.

---

## 3. Componente (`kpi-row.tsx`)

`KpiMandatosAtraso` é substituído por `KpiMandatosAtivos`, que herda o layout
do Figma `86:44` (número grande + 3 linhas com dot colorido), agora com
`mandatosAtivos` no número grande. `ESTADO_BREAKDOWN`, `ValorOuAusencia` e
`formatar` são reaproveitados sem mudança — inclusive a regra de que só
`null` vira `—` e `0` é número medido (AD-005).

A faixa passa de 6 para 5 cards: `lg:grid-cols-6` → `lg:grid-cols-5`. O
`sm:col-span-2 lg:col-span-1` do card de NPS é mantido.

---

## 4. Card clicável (`quadro-acompanhamento.tsx`, KSM-16 a KSM-19)

O `<div>` com `ref={setNodeRef}` e os listeners do dnd-kit passa a envolver
um `<Link href={/contratos/${card.idContrato}}>`, como em `kanban-card.tsx`.
O link vai **dentro** do nó arrastável, não em volta dele: inverter isso
faria o dnd-kit aplicar o transform sobre o elemento de navegação e o
arrasto passaria a disparar navegação.

Isto só funciona porque o `PointerSensor` já usa
`activationConstraint: { distance: 8 }` (`quadro-acompanhamento.tsx:63`) —
sem essa distância o dnd-kit consome o `pointerdown` e o clique nunca chega
ao link. É a mesma dependência que `kanban-card.tsx` documenta, e a razão de
KSM-17 existir como critério separado.

Teclado (KSM-18): o `<Link>` é focável por padrão; os `{...attributes}` do
dnd-kit já colocam `role`/`tabIndex` no nó externo. O design mantém os dois
focáveis e confia no foco nativo — nenhum `tabIndex` manual.

---

## 5. Dados de dev (KSM-11 a KSM-13)

**Não** é `supabase db reset`: o CLAUDE.md trata `db reset` como operação de
risco, e um reset apagaria dados de outras features que compartilham o
ambiente. O desenho é um seed de cenários idempotente, no mesmo padrão de
`seed_test.sql` (resolve por chave estável antes de inserir):

`supabase/seed_cenarios_estrategia.sql` cria contratos de teste identificáveis
por nome (`KPI Cenario <caso>`), cobrindo:

| Caso | Como | Estado esperado |
| --- | --- | --- |
| atrasado | etapa atual com `dt_inicio` além do limiar `etapa_atrasado` | atrasados |
| atenção | etapa atual entre os dois limiares | atenção |
| normal | etapa atual recém-iniciada | normal |
| sem transição | `id_etapa_atual` nulo, contrato iniciado há muito tempo | atrasados (via AD-051) |
| não ativo | `status = 'concluido'` | fora de tudo |

A recomposição dos dados **já existentes** (os 12 contratos incoerentes) é
uma operação destrutiva sobre o banco compartilhado de dev e **não roda sem
confirmação explícita do Pedro na hora**, com a lista do que será apagado à
vista — mesmo com a aprovação em princípio já dada.

---

## Estratégia de teste

| Requisito | Onde | Como |
| --- | --- | --- |
| KSM-02, KSM-03 | integração (`vw-estrategia-kpi`) | reconstrói as 4 contagens por query independente escrita a partir do spec, e assere `atrasados + atenção + normal = mandatos_ativos` em **toda** linha da view |
| KSM-04 | integração | fixture com `id_etapa_atual` nulo e início antigo → aparece em `atrasados` |
| KSM-05 | integração | desliga `etapa_atrasado`, assere coluna `NULL` e fechamento mantido nas restantes |
| KSM-06 | unit (query) | linha ausente → todos os campos `null` |
| KSM-01, KSM-02 | componente (`kpi-row.test.tsx`) | 5 cards, nenhum rótulo "Mandatos em atraso", número grande e 3 linhas com valor e com `—` |
| KSM-07, KSM-08 | integração | recorte de projeto e de gestora: fecha, e nenhum valor excede a linha total |
| KSM-09 | validação ao vivo (P4) | contagem dos chips do Quadro contra o card, mesmo filtro |
| KSM-10 | por construção | `queryKey` já inclui `filtro`; lição L-017 (propriedade arquitetural, não valor) |
| KSM-16, KSM-17, KSM-19 | componente (`quadro-acompanhamento.test.tsx`) | `href` correto por card, inclusive em contrato não ativo |
| KSM-18 | componente | link alcançável e com `href` — foco nativo |
| KSM-11 a KSM-13 | integração | após o seed, os 5 casos aparecem na view |
| KSM-14, KSM-15 | `validation.md` | números observados na tela, por recorte |

O harness de componente existe (`@testing-library/react` + `jsdom` via
`environmentMatchGlobs`) — as lições **L-006 e L-007 estão desatualizadas**
neste ponto e não devem ser aplicadas como "não há como testar render".

**Cobertura de mutação relevante** (o que o Verifier deve conseguir matar):
trocar `>=` por `>` nos limiares; inverter a ordem atrasado/atenção; trocar
`COALESCE(fec.dt_inicio, c.dt_inicio)` por só `c.dt_inicio`; remover o
`WHERE status = 'ativo'`; apontar o `href` do card para o id errado.

---

## Riscos

| Risco | Mitigação |
| --- | --- |
| Apagar dados de dev quebra outras features | Seed idempotente por chave estável; destruição só com confirmação na hora e lista à vista |
| O sintoma de incoerência sob filtro ter **outra** causa além dos não classificados | KSM-07/KSM-08 testam o recorte diretamente; se falharem depois de AD-051, a causa é outra e vira task nova em vez de ajuste silencioso |
| Dev compartilhado com outra sessão | Conferir `supabase/.temp/project-ref` e combinar a janela antes de escrever |
| `CURRENT_DATE` torna o teste dependente do dia | Fixtures ancoradas em datas relativas (`CURRENT_DATE - N`), nunca literais |
