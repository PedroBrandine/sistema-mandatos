# Plataforma de UI — TanStack + Estados Padrão Design

**Spec**: `.specs/features/plataforma-ui-tanstack/spec.md`
**Status**: Draft

---

## Architecture Overview

Duas peças independentes, nenhuma com escrita nova em banco (feature 100% frontend — AD-001/AD-010/
AD-024 não se aplicam, não há DDL nem RPC aqui):

```mermaid
graph TD
    subgraph "1. Layout raiz -- novo -- boundary client unico"
        RootLayout["app/layout.tsx (Server Component, inalterado por fora)"] --> Providers["components/providers.tsx (novo, use client)"]
        Providers --> QCP["QueryClientProvider (@tanstack/react-query)"]
        Providers --> ToasterNovo["components/ui/sonner.tsx: Toaster (sonner, sem next-themes)"]
        QCP --> GetQC["lib/query-client.ts: getQueryClient() -- singleton browser / novo por request no servidor"]
        QCP --> Children["{children} -- toda rota, autenticada ou nao"]
    end

    subgraph "2. Telas existentes -- zero mudanca"
        Children --> Mandatos["/mandatos, /coalizoes, /usuarios, /contratos (fetch direto + useState)"]
        Mandatos -.chama toast.success/error hoje.-> ToasterNovo
    end

    subgraph "3. Telas futuras -- consomem a plataforma"
        Children --> FeatureFutura["ex: grade de Sucessos Mensais (fora desta feature)"]
        FeatureFutura -.useQuery/useMutation.-> QCP
        FeatureFutura -.useReactTable.-> TableLib["@tanstack/react-table (dependencia instalada, sem wrapper)"]
        FeatureFutura -.estados.-> Estados["components/ui/: CarregandoSkeleton, ErroInline, EstadoVazio"]
    end
```

**Recomendação de abordagem por peça** (4 decisões arquiteturais, cada uma com alternativas
descartadas — pesquisadas via Web em 2026-08-10, Context7 MCP indisponível nesta sessão, ver fontes no
Tech Decisions):

### 1. `QueryClient` — factory `getQueryClient()` (recomendado), não `useState` dentro do componente

- **Escolhido**: módulo `lib/query-client.ts` com `makeQueryClient()` + `getQueryClient()` — no
  servidor sempre cria uma instância nova; no browser reaproveita uma instância de módulo (uma por
  aba). É o padrão atual recomendado pelo próprio TanStack Query para Next.js App Router.
- **Alternativa descartada** — `const [client] = useState(() => new QueryClient())` dentro do
  `Providers`: era o padrão mais antigo; a orientação mais recente evita `useState` aqui porque, se o
  componente suspender antes do commit, o React descarta o estado e recria o `QueryClient` — perdendo
  qualquer assinatura já em andamento. `getQueryClient()` não depende do ciclo de vida do componente.

### 2. `<Toaster/>` — wrapper próprio sem `next-themes` (recomendado)

- **Escolhido**: `components/ui/sonner.tsx` reexporta o `Toaster` de `sonner` com `theme="light"`
  fixo e classes que já leem os tokens de `globals.css` (AD-027) — sem instalar `next-themes`.
- **Alternativa descartada** — seguir o *recipe* padrão do shadcn (`npx shadcn add sonner`), que
  assume `next-themes` (`useTheme()` para sincronizar claro/escuro): o app não tem alternância de tema
  hoje (mesma constatação já registrada em `primeira-tela-cadastro/design.md` — "não existe hoje
  nenhum toggle de tema no app"). Adicionar `next-themes` só para isso é dependência nova sem uso real.

### 3. Ponto de montagem — layout raiz (`app/layout.tsx`), não `(app)/layout.tsx`

- **Escolhido**: `Providers` entra dentro do `<body>` do layout raiz, envolvendo `{children}` — cobre
  `/login`, `/auth/*`, `/admin/acesso` e tudo dentro de `(app)/`.
- **Alternativa descartada** — montar em `src/frontend/app/(app)/layout.tsx` (onde a `Sidebar` já
  entra, AD-027): deixaria `/login` e `/auth/*` sem `<Toaster/>` nem `QueryClientProvider`. AD-027
  reserva o route group `(app)/` para a decisão de sidebar/tema visual da área autenticada — não para
  infraestrutura de dados/feedback, que é transversal a toda rota por natureza.

### 4. Local dos 3 componentes de estado — `components/ui/` (recomendado), não uma pasta nova

- **Escolhido**: `src/frontend/components/ui/carregando-skeleton.tsx`, `erro-inline.tsx`,
  `estado-vazio.tsx` — mesma pasta de `confirm-delete-dialog.tsx`.
- **Alternativa descartada** — pasta nova `src/frontend/components/estado/`: o projeto já tem um
  precedente direto para "composto app-specific que não é primitivo shadcn puro, mas mora em `ui/`"
  (`confirm-delete-dialog.tsx`, que compõe `Dialog`+`Button` com uma API própria). Criar uma quarta
  convenção de pasta (depois de `ui/`, `fundacao/`, `app-shell/`) sem necessidade real fragmentaria a
  descoberta desses componentes por features futuras.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `Alert`, `AlertTitle`, `AlertDescription` | `src/frontend/components/ui/alert.tsx` | Base do `<ErroInline>` (`variant="destructive"`) — primeiro uso desse variant no projeto; até hoje só `variant="default"` era usado (`mandato-wizard.tsx`) |
| `Button` | `src/frontend/components/ui/button.tsx` | CTA de retry em `<ErroInline>` (`variant="outline"`) e CTA em `<EstadoVazio>` (reaproveitado pelo *caller*, que passa o botão via prop `acao`) |
| `cn` | `src/frontend/lib/utils.ts` | Usado pelos 3 componentes novos, mesmo padrão de todo componente em `components/ui/` |
| Padrão de skeleton ad hoc | `src/frontend/app/(app)/mandatos/page.tsx:199-204` (`h-44 animate-pulse rounded-xl bg-muted`, grid) | Generalizado como a variante `"cards"` de `<CarregandoSkeleton>` |
| Padrão de estado vazio ad hoc | `src/frontend/app/(app)/mandatos/page.tsx:205-218` (`rounded-xl border border-dashed border-border p-12 text-center`) | Generalizado, duplicado hoje 2x na mesma tela ("nenhum cadastrado" / "nenhum encontrado com filtros") — vira `<EstadoVazio>` |
| `sonner` (já instalado, `^2.0.7`) | `src/frontend/package.json` | Não precisa instalar — só falta o `<Toaster/>` ser montado (o bug desta spec) |
| CSS vars de tema (`--popover`, `--border`, `--destructive`, etc.) | `src/frontend/app/globals.css` (AD-027) | `sonner` lê essas variáveis quando as classes do `Toaster` apontam para os tokens shadcn — nenhuma cor nova precisa ser inventada |
| `components.json` (aliases, `cssVariables: true`, style `radix-nova`) | `src/frontend/components.json` | Usado para instalar o primitivo `Skeleton` via `npx shadcn add skeleton` (fase Tasks) — mesma via já usada para `alert`, `dialog`, `card`, etc. |

### Integration Points

| System | Integration Method |
| --- | --- |
| `src/frontend/package.json["dependencies"]` | Duas entradas novas: `@tanstack/react-query` (`^5`), `@tanstack/react-table` (`^8` ou `^9` — ambas suportam React 19; fixar a exata na fase Tasks via `package-lock.json`) |
| shadcn CLI | `npx shadcn add skeleton` (fase Tasks) — único primitivo novo necessário; os outros 2 componentes (`ErroInline`, `EstadoVazio`) só compõem primitivos já instalados |
| `app/layout.tsx` (Server Component) | Ganha um único import novo (`Providers`) envolvendo `{children}` dentro do `<body>` já existente — `className`/`next/font` variables do `<html>` não mudam |
| Banco/RLS/RPC | Nenhuma integração — feature não lê nem escreve em nenhuma tabela; AD-001, AD-005, AD-010, AD-024 não se aplicam |

---

## Components

### `Providers`

- **Purpose**: Única fronteira `"use client"` no topo da árvore — instancia o `QueryClient` (via
  `getQueryClient()`) e monta o `<Toaster/>` global, envolvendo `{children}`.
- **Location**: `src/frontend/components/providers.tsx` (raiz de `components/`, não em `app-shell/` —
  ver Tech Decisions)
- **Interfaces**:
  - `Providers({ children }: { children: React.ReactNode }): JSX.Element`
- **Dependencies**: `@tanstack/react-query` (`QueryClientProvider`), `lib/query-client.ts`
  (`getQueryClient`), `components/ui/sonner.tsx` (`Toaster`)
- **Reuses**: nada preexistente — primeira fronteira client no topo da árvore (hoje toda tela já é
  `"use client"` individualmente, ex. `mandatos/page.tsx:1`; isto não muda esse padrão, só adiciona uma
  camada acima)

### `getQueryClient()` / `makeQueryClient()`

- **Purpose**: Factory SSR-safe do `QueryClient` — nova instância a cada request no servidor,
  instância única por aba no navegador.
- **Location**: `src/frontend/lib/query-client.ts`
- **Interfaces**:
  - `makeQueryClient(): QueryClient` — cria uma instância com `defaultOptions` conservadores (ex.:
    `staleTime` não-zero, para não refetch imediato ao montar; valor exato é detalhe de Tasks)
  - `getQueryClient(): QueryClient` — `typeof window === "undefined"` → sempre `makeQueryClient()`
    novo; caso contrário, reaproveita uma variável de módulo (`browserQueryClient`) já criada
- **Dependencies**: `@tanstack/react-query`
- **Reuses**: nenhum (peça nova de infraestrutura, sem equivalente anterior no projeto)

### `components/ui/sonner.tsx` (Toaster)

- **Purpose**: Ponto único de renderização de todo toast do app — sem alternância de tema (app só
  tem tema claro hoje).
- **Location**: `src/frontend/components/ui/sonner.tsx`
- **Interfaces**:
  - `Toaster(props: React.ComponentProps<typeof SonnerToaster>): JSX.Element` — reexporta o `Toaster`
    de `sonner` com `theme="light"` fixo e `className`/`style` mapeados nos tokens CSS já existentes
- **Dependencies**: `sonner` (já instalado, `^2.0.7`)
- **Reuses**: tokens de `globals.css` (`--popover`, `--popover-foreground`, `--border`,
  `--destructive`) — mesmos usados por `Alert`/`Dialog`, garante que o toast já nasce visualmente
  consistente com o resto do tema (AD-027)

### `<CarregandoSkeleton>`

- **Purpose**: Placeholder de carregamento padronizado — substitui os `div`s `animate-pulse`
  duplicados hoje.
- **Location**: `src/frontend/components/ui/carregando-skeleton.tsx`
- **Interfaces**:
  - `CarregandoSkeleton({ variante = "cards", linhas = 3 }: { variante?: "cards" | "table" | "list"; linhas?: number }): JSX.Element`
- **Dependencies**: shadcn `Skeleton` (novo primitivo, `npx shadcn add skeleton`), `cn`
- **Reuses**: generaliza o grid exato já usado em `mandatos/page.tsx` (variante `"cards"`); `"table"` e
  `"list"` ficam prontas para consumidores futuros (Kanban §5.2 do roadmap, grade de Sucessos Mensais
  §6.1) sem consumidor imediato nesta feature

### `<ErroInline>`

- **Purpose**: Mensagem de erro persistente (não auto-esconde, ao contrário do toast) + botão opcional
  de retry — cobre o caso que nenhuma tela trata hoje (fetch inicial falho e silencioso).
- **Location**: `src/frontend/components/ui/erro-inline.tsx`
- **Interfaces**:
  - `ErroInline({ titulo = "Não foi possível carregar", mensagem, onRetry }: { titulo?: string; mensagem: string; onRetry?: () => void }): JSX.Element`
- **Dependencies**: `Alert`, `AlertTitle`, `AlertDescription` (`variant="destructive"`), `Button`
  (`variant="outline"`, só quando `onRetry` é passado), ícone `AlertCircle`/`RefreshCw` de
  `lucide-react` (já dependência)
- **Reuses**: mesma família de componente já usada em `mandato-wizard.tsx` (`Alert`), agora no variant
  `destructive`, ainda não usado em produção

### `<EstadoVazio>`

- **Purpose**: Estado vazio padronizado com CTA opcional — generaliza a caixa de borda pontilhada
  duplicada 2x em `mandatos/page.tsx`.
- **Location**: `src/frontend/components/ui/estado-vazio.tsx`
- **Interfaces**:
  - `EstadoVazio({ titulo, mensagem, acao }: { titulo: string; mensagem?: string; acao?: React.ReactNode }): JSX.Element`
- **Dependencies**: `cn`
- **Reuses**: classes Tailwind exatas já em uso ad hoc (`rounded-xl border border-dashed border-border
  p-12 text-center text-sm text-muted-foreground`, `grid justify-items-center gap-4`) — `acao` aceita
  qualquer `ReactNode` (ex.: `<Link><Button/></Link>`), sem o componente precisar conhecer rotas

---

## Data Models

N/A — feature não introduz nem consome dado novo (sem migração, sem tabela, sem RPC, sem alteração de
RLS). Nenhum dos 3 componentes de estado lê banco; recebem tudo via props.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Query futura falha (`useQuery` numa tela que ainda não existe) | Tela consumidora usa `isError`/`error`/`refetch` do próprio TanStack Query e renderiza `<ErroInline mensagem={...} onRetry={refetch}/>` | Usuário vê mensagem persistente + botão "Tentar novamente" em vez de tela quebrada ou vazia sem explicação |
| Uma das 5 chamadas `toast.error` já existentes dispara | Nenhuma mudança de código nesses 5 arquivos — passam a renderizar porque o `<Toaster/>` finalmente existe | Usuário vê o toast que já devia aparecer desde antes desta feature |
| `QueryClient` instanciado mais de uma vez por engano (causa clássica de perda de cache/memory churn) | `getQueryClient()` é singleton por aba no navegador — nunca recriado a cada render/navegação | Nenhum impacto visível (é a própria mitigação) |
| `@tanstack/react-table` importado numa tela sem nenhum dado ainda | N/A nesta feature — nenhuma tela consome a lib; a única garantia aqui é que o import resolve em build | N/A |
| `<ErroInline>`/`<EstadoVazio>` renderizados com props mínimas (sem `onRetry`/`acao`) | Componentes toleram ausência dessas props (ver Edge Cases do spec) | Layout não quebra, só omite o elemento opcional |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| `carregar()` de `/mandatos` (e telas irmãs) não tem `try/catch` — falha de fetch inicial já é bug hoje, silenciosa, independente desta feature | `src/frontend/app/(app)/mandatos/page.tsx:35-75` | Usuário vê lista vazia sem saber se é "sem dados" ou "erro de rede" | Fora do escopo editar essa tela (Out of Scope da spec) — mas `<ErroInline>` construído aqui é exatamente o que essa correção usaria quando outra feature tocar esse arquivo. Registrado como débito, não escondido. |
| `toast.error`/`toast.success` chamados em 5 arquivos hoje sem nenhum `<Toaster/>` montado | `src/frontend/app/(app)/{mandatos,coalizoes,usuarios,contratos}/page.tsx`, `mandatos/[id]/page.tsx` | Usuários nunca veem confirmação/erro de exclusão hoje — bug de produção real, não documentado antes desta auditoria | É exatamente o que a história P1 "Toast global de fato visível" (PUI-05/06/07) corrige |
| Nenhum teste automatizado cobre componentes de frontend no projeto (mesmo padrão já registrado em `fundacao-entidades-pessoas/tasks.md` T29-T37 e `primeira-tela-cadastro/design.md`) | — (ausência de suíte, não um arquivo específico) | Verificação depende de build/lint + inspeção visual manual, não de suíte automatizada | Consistente com o padrão já estabelecido no projeto — não é lacuna nova introduzida aqui; Tasks (fase futura) deve incluir ao menos uma tela de smoke-test manual antes de Validate |
| Versão exata de `@tanstack/react-query`/`@tanstack/react-table` não é fixada neste Design (faixas `^5`/`^8`) | `src/frontend/package.json` (a editar na fase Tasks) | Risco baixo de o `npm install` real resolver uma versão ligeiramente diferente da pesquisada em 2026-08-10 | Tasks deve registrar a versão exata instalada (via `package-lock.json`) no handoff — mesmo rigor já usado no handoff de Fundação (`AD-021... nunca foi instalada`) |
| `app/layout.tsx` hoje é Server Component puro (sem `"use client"`); `Providers` é a primeira fronteira client logo no topo da árvore | `src/frontend/app/layout.tsx` | Na prática, baixo — toda tela do projeto já é `"use client"` individualmente (`mandatos/page.tsx:1` etc.) — mas é o primeiro precedente formal de um client boundary acima de todas as rotas | `Providers` só envolve `{children}`; não substitui `<html>`/`<body>` nem os `next/font` variables já ali. Layout raiz continua Server Component por fora — só o miolo ganha a fronteira nova, seguindo o padrão oficial recomendado pelo TanStack Query para App Router |

> Nenhum risco de segurança ou de RLS identificado — feature não introduz superfície de leitura/escrita
> nova em nenhuma tabela (AD-001, AD-009, AD-010 não se aplicam).

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| `QueryClient` via factory (`getQueryClient()`) em vez de `useState(() => new QueryClient())` | `lib/query-client.ts` com `makeQueryClient()`/`getQueryClient()` | Padrão atual recomendado pelo TanStack Query para Next.js App Router (verificado via busca na Web em 2026-08-10 — Context7 MCP indisponível nesta sessão; ver [Using TanStack Query with Next.js — LogRocket](https://blog.logrocket.com/using-tanstack-query-next-js/) e [The Complete Guide to TanStack Query in Next.js App Router](https://ihsaninh.dev/blog/the-complete-guide-to-tanstack-query-next.js-app-router)): evita que o React descarte a instância se o componente suspender antes do commit |
| `Providers` mora em `components/providers.tsx` (raiz de `components/`), não em `components/app-shell/` | `components/providers.tsx` | `app-shell/` hoje é especificamente a sidebar autenticada (AD-027, escopo `(app)/`); `Providers` precisa cobrir `/login`/`/auth/*` também — misturar as duas coisas na mesma pasta sugeriria um escopo menor do que o real |
| Provider/Toaster montados no layout raiz (`app/layout.tsx`), não em `(app)/layout.tsx` | Layout raiz | Toast e (futuramente) queries são infraestrutura transversal a toda rota, inclusive pré-sessão; AD-027 reserva `(app)/` só para a decisão de sidebar/tema visual da área autenticada |
| `<Toaster/>` sem `next-themes` | `components/ui/sonner.tsx` fixa `theme="light"`, sem dependência nova | Confirmado via busca na Web que o *recipe* padrão do shadcn para sonner assume `next-themes` ([Shadcn Sonner — Base UI and Radix UI](https://shadcnstudio.com/docs/components/sonner)); o app não tem alternância de tema hoje (mesma constatação já registrada em `primeira-tela-cadastro/design.md`) |
| 3 componentes de estado em `components/ui/`, não em pasta nova `components/estado/` | `components/ui/` | Precedente já existente: `confirm-delete-dialog.tsx` é um composto app-specific (não primitivo shadcn puro) e já mora em `components/ui/` — seguir o mesmo lugar evita uma quarta convenção de pasta |
| `@tanstack/react-table` entra só como dependência instalada, sem nenhum wrapper construído nesta feature | Import direto quando a primeira tela precisar (fora desta feature) | Nenhuma tela consome a lib ainda (Sucessos Mensais é feature futura, roadmap §6.1); construir um wrapper especulativo sem consumidor real violaria o mesmo princípio do roadmap §9 |
| Versão pesquisada: `@tanstack/react-query` ~5.101.x, `@tanstack/react-table` ~8.21.x/9.x, ambas com suporte a React 19 | Faixas `^5`/`^8` no `package.json` (fase Tasks fixa o patch real) | Confirmado via [npm — @tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) e [npm — @tanstack/react-table](https://www.npmjs.com/package/@tanstack/react-table) em 2026-08-10; compatível com React 19.2.4/Next 16.2.12 já em uso no projeto |
| shadcn `Skeleton` instalado via CLI (`npx shadcn add skeleton`), `<CarregandoSkeleton>` construído por cima | Instalar via CLI, nunca copiar manualmente | Mesmo caminho já usado para todo primitivo existente (`alert`, `dialog`, `card`, etc.) — mantém `components.json`/registries consistentes |

> **Project-level:** os 4 pontos de "Architecture Overview" acima (localização de `Providers`, ponto
> de montagem no layout raiz, `Toaster` sem `next-themes`, e "componentes app-specific reutilizáveis
> moram em `components/ui/`") são precedentes que próximas features devem seguir. Recomenda-se
> registrá-los como `AD-029` em `.specs/STATE.md` — **não registrado por este agente**, por restrição
> explícita da tarefa (não editar `STATE.md`); fica como ação de quem revisar/aprovar este design.
