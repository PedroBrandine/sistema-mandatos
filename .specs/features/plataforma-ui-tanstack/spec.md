# Plataforma de UI — TanStack + Estados Padrão Specification

## Problem Statement

AD-021 fecha a stack de frontend e nomeia explicitamente **TanStack Query** (dados no cliente) e
**TanStack Table** (grades editáveis) — mas nenhuma tela cumpre essa decisão até hoje. Todas as telas
de Fundação (`/mandatos`, `/coalizoes`, `/usuarios`, `/contratos`) usam fetch direto via
`createClient()` + `useState`/`useEffect`, e nem `@tanstack/react-query` nem `@tanstack/react-table`
estão em `src/frontend/package.json`. Isso bloqueia a próxima peça de maior risco do projeto (a grade
editável de Sucessos Mensais, §5.7 da Constituição) de ter onde nascer.

A auditoria de código desta spec também encontrou dois problemas correlatos, nunca registrados em
nenhum spec anterior:

1. **`sonner` já está instalado** (`"sonner": "^2.0.7"` em `src/frontend/package.json`) e **já é
   chamado** — `toast.success`/`toast.error` aparecem em 5 arquivos (`mandatos/page.tsx`,
   `coalizoes/page.tsx`, `usuarios/page.tsx`, `contratos/page.tsx`, `mandatos/[id]/page.tsx`) — mas
   **nenhum `<Toaster/>` é montado em lugar nenhum da árvore** (`app/layout.tsx` nem
   `(app)/layout.tsx` o fazem). Ou seja: essas 5 chamadas de toast não produzem nenhum feedback visual
   hoje — um bug de produção silencioso, não um item de instalação pendente como o roadmap descreve.
2. Cada tela reinventa seu próprio padrão de loading (`animate-pulse` ad hoc) e de estado vazio (`div`
   com borda pontilhada), duplicado sem componente compartilhado, e **nenhuma tela trata erro de fetch
   inicial de forma visível** — `mandatos/page.tsx#carregar()`, por exemplo, não tem `try/catch`; uma
   falha de rede hoje deixa a tela como "lista vazia", indistinguível de "não há dados".

Esta feature instala as duas peças de plataforma (provider de TanStack Query + dependência de
TanStack Table) e padroniza 3 componentes de estado + o toast global — **sem tocar em nenhuma tela
existente** (roadmap `.specs/roadmap.md` §9: refatorar Fundação retroativamente é custo sem retorno).

## Goals

- [ ] Um único `QueryClientProvider` envolve o app inteiro (montado no layout raiz), disponível para
      qualquer tela **nova** usar `useQuery`/`useMutation`, sem que nenhuma tela existente precise
      mudar uma linha.
- [ ] `@tanstack/react-query` e `@tanstack/react-table` aparecem em
      `src/frontend/package.json["dependencies"]` e resolvem em `npm run build`.
- [ ] 3 componentes de estado (`<CarregandoSkeleton>`, `<ErroInline>`, `<EstadoVazio>`) existem,
      tipados, documentados e importáveis por qualquer feature nova.
- [ ] O `<Toaster/>` do `sonner` é montado globalmente — as 5 chamadas de toast já existentes passam
      a aparecer de fato, sem editar nenhum dos 5 arquivos.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Refatorar `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos`, `/mandatos/[id]` para usar TanStack Query | Roadmap §9 ("não refatora as telas de Fundação retroativamente — custo sem retorno"). Esta feature prepara a plataforma; não migra consumidores existentes. |
| Construir a grade editável de Sucessos Mensais (o consumidor real de TanStack Table) | Feature própria, roadmap §6.1. Aqui a dependência só fica instalada e pronta para import — zero linha de grade construída. |
| Instalar `tabs`, `tooltip`, `dropdown-menu`, `alert-dialog`, `checkbox`, `calendar`/date-picker, `progress` | Citados no roadmap (Trilha D, item 2) mas fora do que esta tarefa pediu explicitamente (TanStack + 3 componentes de estado + toast). Nenhuma tela hoje os consome; entram quando uma feature concreta precisar — mesmo critério já usado em `primeira-tela-cadastro` para excluir TanStack Table na época. |
| `next-themes` / alternância de tema no `<Toaster/>` | O app não tem toggle de tema hoje (mesma constatação já registrada em `primeira-tela-cadastro/design.md`). Adicionar uma dependência nova só para theming que não existe seria injustificado. |
| Prefetch/hidratação SSR de queries (`dehydrate`/`HydrationBoundary`, streaming) | Nenhuma tela usa `useQuery` ainda — infraestrutura de hidratação só se justifica quando a primeira query real existir. O provider desta feature é client-side puro. |
| Corrigir a ausência de `try/catch` em `carregar()` de `/mandatos` (e páginas irmãs) | Bug real, encontrado nesta auditoria (ver Problem Statement) — mas está dentro de uma tela de Fundação já validada. Corrigi-lo é editar código existente, o que o primeiro item desta tabela já exclui. Fica registrado como débito para quem tocar essas telas depois; os componentes desta feature (`<ErroInline>`) são o que essa correção usaria. |
| CRUD administrado dos 3 componentes ou de temas de toast (ex.: variantes de cor por tipo de ação) | Não pedido; os 3 componentes têm API fixa em código, sem painel de configuração. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde o `QueryClientProvider`/`<Toaster/>` são montados | Layout raiz (`src/frontend/app/layout.tsx`), não `(app)/layout.tsx` | Toast e (futuramente) queries são infraestrutura transversal a toda rota, inclusive pré-sessão (`/login`, `/auth/*`, `/admin/acesso`) — `(app)/layout.tsx` (AD-027) é especificamente a sidebar autenticada, não infra de dados/feedback | n (default, detalhado no `design.md`) |
| Local dos 3 componentes de estado no código | `src/frontend/components/ui/` (mesma pasta de `confirm-delete-dialog.tsx`, que já é um composto app-specific não-primitivo) | Precedente já existente no projeto — evita criar uma terceira convenção de pasta (`fundacao/`, `app-shell/`, `ui/` já existem) | n (default, detalhado no `design.md`) |
| Versão exata de `@tanstack/react-query`/`@tanstack/react-table` | Faixa `^5`/`^8` (caret) — o patch exato só é fixado quando `npm install` real rodar na fase Tasks (fora desta spec) | Verificado via busca na Web em 2026-08-10 (Context7 MCP indisponível nesta sessão): `@tanstack/react-query` v5.101.x e `@tanstack/react-table` v8.21.x/v9.x, ambos com suporte a React 18/19 — compatíveis com React 19.2.4/Next 16.2.12 já em uso | y (fonte: npm/GitHub releases, ver `design.md`) |
| `<Toaster/>` com ou sem `next-themes` | Sem — tema fixo (claro), wrapper próprio em vez do recipe padrão do shadcn (que assume `next-themes`) | App não tem alternância de tema hoje; adicionar dependência nova só para isso não se justifica (ver Out of Scope) | y |
| API do `<CarregandoSkeleton>` | Prop `variante: "cards" \| "table" \| "list"` (+ `linhas?: number`) — generaliza o padrão de grid de cards já usado em `mandatos/page.tsx` e antecipa o formato de linha de tabela para consumidores futuros (Kanban, grade de Sucessos Mensais) | Nenhuma tela ainda usa layout de tabela real, então a variante `table` fica pronta mas sem consumidor imediato — coerente com "instalar sem forçar adoção" | n (default, decisão de API do componente) |
| `<ErroInline>` é componente de página (não `error.tsx`/`loading.tsx` do App Router) | Componente React comum, renderizado condicionalmente dentro da própria página — mesmo padrão que as telas existentes já usam para loading/vazio | Nenhuma tela do projeto usa hoje as convenções de arquivo `error.tsx`/`loading.tsx` do Next.js (confirmado: não existem no repo); introduzir esse padrão seria uma mudança arquitetural maior, fora do pedido desta feature | n (default) |
| Alcance da correção do bug do toast | Só montar o `<Toaster/>` globalmente — nenhuma edição nos 5 arquivos que já chamam `toast.success`/`toast.error` | O bug (toast nunca aparece) se resolve inteiramente do lado do provider; os call sites já estão corretos | y (decorre da checagem de código) |

**Open questions:** nenhuma — todas resolvidas ou registradas acima. Dimensões restantes do sweep de
requisitos implícitos (idempotência, concorrência, rate limit, ciclo de vida de dado) são **N/A para
este escopo** — feature é puramente de frontend/apresentação, sem escrita nova, sem RPC, sem RLS.

---

## User Stories

### P1: Plataforma de dados no cliente pronta para uso ⭐ MVP

**User Story**: Como desenvolvedor de qualquer feature nova, quero um `QueryClientProvider` e a lib
`@tanstack/react-table` já disponíveis no app, para poder usar `useQuery`/`useMutation`/tabelas do
TanStack sem montar minha própria infraestrutura, e sem quebrar nenhuma tela que já existe.

**Why P1**: É o que a tarefa pede e o que AD-021 exige — e é pré-requisito direto da grade de Sucessos
Mensais (§5.7 da Constituição, risco nº 1 de adoção do projeto).

**Acceptance Criteria**:

1. WHEN o app carrega qualquer rota THEN o layout raiz SHALL envolver `{children}` num único
   `QueryClientProvider`, instanciado por uma função `getQueryClient()` (uma instância por aba no
   navegador; uma instância nova por request no servidor — nunca reaproveitada entre requests).
2. WHEN uma tela já existente que usa fetch direto + `useState` (`/mandatos`, `/coalizoes`,
   `/usuarios`, `/contratos`, `/mandatos/[id]`) é carregada depois desta mudança THEN ela SHALL
   continuar funcionando exatamente como antes — zero import de `@tanstack/react-query` nesses 5
   arquivos, zero mudança de comportamento visível ou de dado exibido.
3. WHEN `npm run build` (workspace `frontend`) roda THEN SHALL terminar com sucesso, com
   `@tanstack/react-query` e `@tanstack/react-table` declarados em
   `src/frontend/package.json["dependencies"]`.
4. WHEN uma tela futura importa `useQuery`/`useMutation` de `@tanstack/react-query`, ou um hook de
   `@tanstack/react-table` (ex.: `useReactTable`) THEN a importação SHALL resolver e funcionar sem
   essa tela precisar declarar ou montar nenhum provider próprio.

**Independent Test**: Rodar `npm run build`; abrir `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos`
e confirmar que listam/filtram/excluem exatamente como antes da mudança; escrever um componente de
smoke-test isolado que chama `useQuery` dentro de uma rota do app e confirmar que funciona sem
provider extra (componente descartável, não faz parte da entrega).

---

### P1: Toast global de fato visível ⭐ MVP

**User Story**: Como qualquer usuário que dispara uma ação que já chama `toast.success`/`toast.error`
hoje (ex.: excluir um mandato em `/mandatos`), quero ver o toast de confirmação/erro na tela, porque
hoje ele é chamado mas nunca aparece.

**Why P1**: Corrige um bug de produção real (achado nesta auditoria, não documentado antes) e entrega
o "toast global" pedido explicitamente na tarefa.

**Acceptance Criteria**:

1. WHEN o layout raiz renderiza, em qualquer rota (`/login`, `/auth/*`, `/admin/acesso` e qualquer
   rota dentro de `(app)/`) THEN o sistema SHALL montar exatamente um `<Toaster/>` (sonner) global.
2. WHEN qualquer uma das 5 chamadas `toast.success`/`toast.error` já existentes dispara (ex.: excluir
   mandato em `/mandatos`, alterar status de contrato em `/contratos`) THEN um toast visível SHALL
   aparecer na tela — sem nenhuma edição nesses 5 arquivos.
3. WHEN uma feature futura chama `toast(...)` de `sonner` a partir de qualquer parte do app THEN o
   toast SHALL renderizar pelo mesmo `<Toaster/>` único — nunca precisando montar outro.

**Independent Test**: Em `/mandatos`, excluir um mandato de teste e confirmar visualmente que o toast
de sucesso aparece (hoje **não** aparece — é o bug que esta história corrige); forçar uma falha (ex.:
excluir algo que a RLS bloqueia) e confirmar que o toast de erro aparece.

---

### P1: 3 componentes de estado padronizados ⭐ MVP

**User Story**: Como desenvolvedor de qualquer feature nova, quero `<CarregandoSkeleton>`,
`<ErroInline>` e `<EstadoVazio>` prontos, para não reinventar `animate-pulse`/`div` com borda
pontilhada em cada tela nova, e para poder mostrar erro de fetch de forma visível (o que nenhuma tela
faz hoje).

**Why P1**: Pedido explícito da tarefa; sem isso, toda feature nova (Operação, Planejamento,
Incidência) continua reinventando o mesmo padrão.

**Acceptance Criteria**:

1. WHEN uma tela (nova ou futura) precisa de um placeholder de carregamento THEN ela SHALL poder
   renderizar `<CarregandoSkeleton variante="cards" | "table" | "list" />` em vez de recriar divs
   `animate-pulse` manualmente.
2. WHEN uma query/fetch falha THEN a tela SHALL poder renderizar `<ErroInline mensagem={string}
   onRetry={() => void} />`, exibindo uma mensagem **persistente** (não auto-esconde, ao contrário do
   toast) com um botão opcional de "Tentar novamente".
3. WHEN uma lista/query retorna vazia THEN a tela SHALL poder renderizar `<EstadoVazio titulo={string}
   mensagem={string?} acao={ReactNode?} />`, com CTA opcional.
4. WHEN qualquer um dos 3 componentes é importado, por qualquer tela existente ou futura THEN ele
   SHALL ser puramente apresentacional — nenhum deles lê banco, chama RPC ou depende de RLS.
5. WHEN os 3 componentes existem THEN SHALL estar em `src/frontend/components/ui/`, com props
   tipadas em TypeScript e nome de arquivo em kebab-case (mesmo padrão de `confirm-delete-dialog.tsx`).

**Independent Test**: Montar uma tela de smoke-test temporária (ou reaproveitar uma existente em modo
de desenvolvimento) que renderiza os 3 componentes com dados de exemplo — confirmar visualmente os 3
estados (carregando, erro com retry, vazio com CTA); a tela de smoke-test é descartável, não é parte
da entrega funcional.

---

## Edge Cases

- WHEN o `QueryClientProvider` é instanciado durante o render inicial de uma rota no servidor (SSR)
  THEN `getQueryClient()` SHALL sempre criar uma instância nova nesse contexto — nunca reaproveitar
  uma instância de outro request (evita cache de um usuário aparecer para outro).
- WHEN dois toasts disparam quase simultaneamente (ex.: duplo clique num botão de exclusão) THEN o
  comportamento de empilhamento SHALL ser o padrão nativo do `sonner` — nenhuma deduplicação
  customizada é construída nesta feature.
- WHEN `<ErroInline>` é renderizado sem a prop `onRetry` THEN SHALL exibir só a mensagem, sem botão
  vazio ou quebrado.
- WHEN `<EstadoVazio>` é renderizado sem a prop `acao` THEN SHALL exibir só título/mensagem, sem
  espaço reservado vazio para o CTA ausente.
- WHEN uma tela existente (fora do escopo desta feature) continua sem nenhum dos 3 componentes novos
  THEN isso SHALL ser aceitável — nada nesta feature força adoção retroativa (ver Out of Scope).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PUI-01 | P1: plataforma de dados (AC1 — provider único no layout raiz) | Design | In Design |
| PUI-02 | P1: plataforma de dados (AC2 — telas existentes inalteradas) | Design | In Design |
| PUI-03 | P1: plataforma de dados (AC3 — build com as 2 deps declaradas) | Design | In Design |
| PUI-04 | P1: plataforma de dados (AC4 — tela futura resolve sem provider próprio) | Design | In Design |
| PUI-05 | P1: toast global (AC1 — `<Toaster/>` único montado) | Design | In Design |
| PUI-06 | P1: toast global (AC2 — 5 toasts existentes passam a aparecer) | Design | In Design |
| PUI-07 | P1: toast global (AC3 — toast futuro usa o mesmo `<Toaster/>`) | Design | In Design |
| PUI-08 | P1: 3 componentes de estado (AC1 — `<CarregandoSkeleton>`) | Design | In Design |
| PUI-09 | P1: 3 componentes de estado (AC2 — `<ErroInline>`) | Design | In Design |
| PUI-10 | P1: 3 componentes de estado (AC3 — `<EstadoVazio>`) | Design | In Design |
| PUI-11 | P1: 3 componentes de estado (AC4 — puramente apresentacional) | Design | In Design |
| PUI-12 | P1: 3 componentes de estado (AC5 — local/tipagem) | Design | In Design |

**ID format:** `PUI-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 total, 12 mapeados para `design.md`, 0 sem mapeamento. Fase Tasks/Execute **não**
roda nesta sessão (parada deliberada em Design, ver handoff a ser registrado por quem retomar).

---

## Success Criteria

Como saberemos que a feature foi bem-sucedida:

- [ ] Uma feature nova (ex.: a grade de Sucessos Mensais, quando ela nascer) consegue importar
      `useQuery`/`useReactTable` no primeiro commit dela, sem nenhum passo de instalação/configuração
      de plataforma antes.
- [ ] O bug do toast (chamadas que hoje não aparecem) para de existir — confirmável em 1 clique
      (excluir um mandato de teste) sem editar nenhum dos 5 arquivos que já chamam `toast`.
- [ ] Nenhuma das 5 telas existentes muda de comportamento — `npm run build` e uma passada manual
      pelas rotas de Fundação continuam idênticos ao estado anterior a esta feature.
