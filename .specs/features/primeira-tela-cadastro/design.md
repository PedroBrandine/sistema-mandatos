# Primeira Tela de Cadastro Design

**Spec**: `.specs/features/primeira-tela-cadastro/spec.md`
**Status**: Draft

---

## Architecture Overview

Três peças relativamente independentes, todas puramente de leitura (nenhuma escrita nova):

```mermaid
graph TD
    subgraph "1. Tema + App Shell"
        Theme[globals.css: CSS vars da marca] --> AllPages[Toda tela, via shadcn]
        Fonts[layout.tsx: Anton + Commissioner via next/font] --> AllPages
        AppLayout["(app)/layout.tsx: Sidebar"] --> Mandatos[/mandatos, /mandatos/novo, /mandatos/id]
        AppLayout --> Coalizoes[/coalizoes, /coalizoes/novo, /coalizoes/id]
        AppLayout --> Usuarios[/usuarios]
        AppLayout --> Contratos[/contratos/id/vinculos]
    end

    subgraph "2. Listagem em cards"
        MandatosPage["/mandatos/page.tsx (novo)"] -->|"select * from dim_mandato join dim_contratante"| Supabase[(Supabase, RLS existente)]
        CoalizoesPage["/coalizoes/page.tsx (novo)"] --> Supabase
        MandatosPage --> CardMandato[MandatoCard]
        CoalizoesPage --> CardCoalizao[CoalizaoCard]
    end

    subgraph "3. Perfil TSE rico"
        DetalheMandato["/mandatos/[id]/page.tsx (existente, estendido)"] --> QueryVotacao["buscarPerfilVotacao() -- reusa mv_candidatura_resumo"]
        DetalheMandato --> QueryPessoal["buscarPerfilCandidatura() (novo) -- tse.dim_candidatura"]
        DetalheMandato --> QueryEleitorado["buscarPerfilEleitoradoCandidatura() (novo)"]
        QueryEleitorado --> NovaView["tse.mv_perfil_eleitorado_candidatura (nova, migração 0019)"]
        NovaView -.agrega uma vez, refresh raro.-> FatVotacaoZona[("tse.fat_votacao_zona -- NUNCA lida direto pela app")]
        NovaView -.agrega uma vez, refresh raro.-> PerfilEleitorado[("tse.dim_perfil_eleitorado")]
    end
```

**Recomendação de abordagem por peça** (3 decisões arquiteturais, cada uma com alternativas descartadas):

### 1. Tema visual — CSS custom properties em `globals.css` (recomendado)

- **Escolhido**: sobrescrever os valores de `:root` que já existem em `globals.css` (todos os componentes shadcn já leem essas variáveis — `cssVariables: true` em `components.json`). Zero mudança por componente.
- **Alternativa descartada A** — classes Tailwind explícitas (`bg-[#035252]`) espalhadas pelos componentes: exigiria tocar toda tela existente uma a uma, alto risco de inconsistência/drift.
- **Alternativa descartada B** — `ThemeProvider` em React Context com troca de tema em runtime: resolve um problema que não existe aqui (não há tema alternável pelo usuário nesta spec) — complexidade sem benefício.

### 2. App shell / sidebar — Route Group `(app)/layout.tsx` (recomendado)

- **Escolhido**: mover `mandatos/`, `coalizoes/`, `usuarios/`, `contratos/` para dentro de `app/(app)/` (route group — não aparece na URL, confirmado em `node_modules/next/dist/docs/.../route-groups.md`). `(app)/layout.tsx` é um layout **aninhado** (não um root layout alternativo — `app/layout.tsx` continua sendo o único root layout, então a ressalva de "full page reload entre root layouts diferentes" da doc não se aplica). `/login`, `/auth/*`, `/admin/acesso` e `/` ficam fora do grupo, sem sidebar.
- **Alternativa descartada A** — checar `pathname` num client component dentro do root layout único, escondendo a sidebar condicionalmente: frágil (flash da sidebar antes de esconder, hidratação client-only), não é o padrão idiomático do App Router pra isso.
- **Alternativa descartada B** — duplicar `<Sidebar>` manualmente em cada `page.tsx`: duplicação, fácil de esquecer numa tela nova.

### 3. Perfil do eleitorado — nova materialized view dedicada (recomendado)

- **Escolhido**: `tse.mv_perfil_eleitorado_candidatura`, formato longo (`ano_eleicao, sq_candidato, nr_turno, dimensao, categoria, qt_eleitores`), pré-calculando o município principal (mesma lógica de `mv_candidatura_resumo`, mas preservando `cd_municipio`) e agregando `tse.dim_perfil_eleitorado` por esse município, pra 3 dimensões (`genero`, `faixa_etaria`, `grau_escolaridade`). Consultada com uma única query por candidatura, chave idêntica à de `mv_candidatura_resumo`.
- **Por que não dá pra reusar `mv_candidatura_resumo` direto**: essa view só expõe `nm_municipio_principal` (nome), não `cd_municipio` (código) — e `tse.dim_perfil_eleitorado` é chaveada por código, não nome. Nomes de município não são uma chave de join segura (não há garantia de unicidade/normalização). Bloqueio técnico real, não só estilístico.
- **Alternativa descartada A** — alterar `mv_candidatura_resumo` pra também expor `cd_municipio`, e agregar o perfil do eleitorado ao vivo na camada de query (sem view nova): evita uma segunda migração, mas mistura duas responsabilidades na mesma view e recalcula a agregação (potencialmente dezenas de linhas por candidatura) a cada carregamento de tela, em vez de aproveitar o padrão já estabelecido de refresh raro (pós-carga de safra).
- **Alternativa descartada B** — ler `tse.dim_perfil_eleitorado` cru da camada de aplicação, agregando em JS: mesma classe de problema que motivou a proibição de ler `fat_votacao_zona` direto — tabela particionada, grande o bastante pra não ser prudente agregar no cliente a cada tela.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `mv_candidatura_resumo` + `buscarCandidaturas` pattern | `src/backend/queries/tse.ts` | Mesmo padrão (client recebido por parâmetro, leitura direta, nunca RPC) pras 2 novas funções de query |
| `mapeiaErroRpc` | `src/backend/rpc/errors.ts` | Não se aplica aqui (leitura, não RPC) — mas o padrão de "erro vira mensagem genérica, nunca crash" é o mesmo espírito aplicado nas novas queries (ausência de match = dado ausente, nunca throw visível à UI) |
| `dim_contratante`/`dim_mandato`/`dim_coalizao` (RLS já existente) | schema `public` | Listagem em cards lê exatamente essas tabelas — RLS que já governa `/mandatos/[id]` e `/coalizoes/[id]` passa a governar a listagem também, sem política nova |
| `ContratanteFields`, `MandatoWizard`, `CoalizaoForm`, `VinculoTable` (Fase 5 da Fundação) | `src/frontend/components/fundacao/` | Reaproveitados sem alteração — só ganham o tema novo por herança de CSS var, sem tocar no código deles |
| shadcn `Table`, `Badge`, `Button` | `src/frontend/components/ui/` | Reaproveitados no detalhe do mandato (blocos de votação/perfil) |
| `Database["tse"]["Views"]["mv_candidatura_resumo"]["Row"]` (tipos gerados) | `src/backend/supabase/database.types.ts` | Mesmo padrão de tipo pra `dim_candidatura` e pra nova view — exige `npm run db:types` depois da migração 0019 |

### Integration Points

| System | Integration Method |
| --- | --- |
| Supabase (`tse` schema) | Leitura direta via `client.schema("tse").from(...)`, mesmo padrão de `buscarCandidaturas` — nenhuma RPC nova (não há escrita) |
| Migração incremental (AD-025) | 1 migração nova (`0019_mv_perfil_eleitorado_candidatura.sql`): `CREATE MATERIALIZED VIEW` + `GRANT SELECT` pros mesmos 3 papéis já usados em `mv_candidatura_resumo` (`legisla_app`, `legisla_admin`, `legisla_gestora` — grant de T15/0010, precisa ser reemitido pra objeto novo, `GRANT ... ALL TABLES` não é retroativo) |
| `supabase gen types` | Roda depois da migração 0019, pra `Database["tse"]["Views"]["mv_perfil_eleitorado_candidatura"]` existir tipado |

---

## Components

### `(app)/layout.tsx` — App shell com sidebar

- **Purpose**: Envolve toda tela autenticada com a sidebar fixa (logo placeholder + nav) — layout aninhado, não root.
- **Location**: `src/frontend/app/(app)/layout.tsx`
- **Interfaces**: componente de layout padrão do Next.js (`{ children }: { children: React.ReactNode }`)
- **Dependencies**: `Sidebar` (novo componente)
- **Reuses**: nada preexistente (não havia shell nenhum) — mas o gate de auth continua 100% no `proxy.ts`, que já cobre essas rotas (AD-002); a sidebar não decide quem pode entrar, só decora quem já passou.

### `Sidebar`

- **Purpose**: Nav fixa com logo placeholder "Legisla Brasil" (ícone de bandeira/pennant) e links pra Mandatos, Coalizões, Usuários.
- **Location**: `src/frontend/components/app-shell/sidebar.tsx`
- **Interfaces**: sem props (lê a rota atual via `usePathname()` só pra destacar o item ativo — cosmético, não decide acesso)
- **Dependencies**: `next/link`, `lucide-react` (ícone de bandeira/pennant já disponível na lib de ícones em uso)
- **Reuses**: nenhum componente existente — primeira peça de navegação global do projeto.

### `MandatoCard` / `CoalizaoCard`

- **Purpose**: Card individual da listagem (nome, UF, dados mínimos — CAD-01/CAD-05).
- **Location**: `src/frontend/components/fundacao/mandato-card.tsx`, `coalizao-card.tsx`
- **Interfaces**: `{ mandato: {...campos mínimos} }` → `<Link href="/mandatos/[id]">`
- **Dependencies**: shadcn `Card` (**novo componente a instalar**, `npx shadcn add card` — não existe hoje em `components/ui/`)
- **Reuses**: `dim_mandato`/`dim_contratante` já lidos em outros pontos (mesmo shape de dado que `/mandatos/[id]` já busca).

### `/mandatos/page.tsx`, `/coalizoes/page.tsx` — Listagens

- **Purpose**: Busca a lista (client component, `createClient()` + `.from(...).select(...)`, mesmo padrão de `/usuarios/page.tsx` hoje) e renderiza grid de cards + estado vazio.
- **Location**: `src/frontend/app/(app)/mandatos/page.tsx`, `src/frontend/app/(app)/coalizoes/page.tsx`
- **Dependencies**: `MandatoCard`/`CoalizaoCard`
- **Reuses**: mesmo padrão de fetch direto + `useState` já usado em `/usuarios` (nenhuma lib nova de data-fetching, ver Out of Scope da spec sobre TanStack Query).

### `buscarPerfilCandidatura` (nova função de query)

- **Purpose**: Perfil pessoal da candidatura (CAD-10).
- **Location**: `src/backend/queries/tse.ts` (mesma arquivo de `buscarCandidaturas`)
- **Interfaces**: `buscarPerfilCandidatura(client: SupabaseClient<Database>, chave: {anoEleicao: number; sqCandidato: number; nrTurno: number}): Promise<PerfilCandidatura | null>`
- **Dependencies**: `tse.dim_candidatura` (tabela dimensão, segura de ler direto — não é a tabela grande `fat_votacao_zona`)
- **Reuses**: mesmo padrão de client-por-parâmetro de `buscarCandidaturas`; retorna `null` (não lança) quando não há linha — mesmo espírito de "ausência de match: nunca erro".

### `buscarPerfilEleitoradoCandidatura` (nova função de query)

- **Purpose**: Perfil demográfico do eleitorado do município principal (CAD-11).
- **Location**: `src/backend/queries/tse.ts`
- **Interfaces**: `buscarPerfilEleitoradoCandidatura(client: SupabaseClient<Database>, chave: {anoEleicao: number; sqCandidato: number; nrTurno: number}): Promise<PerfilEleitorado | null>` — retorna `null` quando não há município principal identificável (candidatura sem `fat_votacao_zona`) ou a view não tem linha pra essa chave.
- **Dependencies**: `tse.mv_perfil_eleitorado_candidatura` (nova)
- **Reuses**: mesmo padrão; agrupa o formato longo (`dimensao`/`categoria`/`qt_eleitores`) em 3 listas (`genero[]`, `faixaEtaria[]`, `grauEscolaridade[]`) do lado do TypeScript, não do SQL — mantém a view simples e genérica.

### Bloco de perfil TSE no detalhe do mandato (extensão de `/mandatos/[id]/page.tsx`)

- **Purpose**: Renderiza os 3 blocos (votação, pessoal, eleitorado) por candidatura, dentro da seção "Candidaturas TSE" que já existe.
- **Location**: `src/frontend/app/(app)/mandatos/[id]/page.tsx` (extensão do arquivo existente, só movido de pasta pelo route group)
- **Dependencies**: `buscarPerfilCandidatura`, `buscarPerfilEleitoradoCandidatura`, shadcn `Card`, um componente de mini-gráfico (ver Tech Decisions — `PerfilEleitoradoChart`)
- **Reuses**: a tabela de candidaturas já existente (ano, status, confiança, vigente) continua igual — os 3 blocos novos entram como conteúdo expandido por linha/candidatura, não substituem nada.

### `PerfilEleitoradoChart`

- **Purpose**: Mini-representação visual (gênero, faixa etária, escolaridade) do bloco de perfil do eleitorado — barras simples via CSS/Tailwind (`div` com `width` proporcional ao percentual da categoria), sem lib de gráfico.
- **Location**: `src/frontend/components/fundacao/perfil-eleitorado-chart.tsx`
- **Dependencies**: nenhuma nova — só Tailwind (cores do tema, `--chart-1..5` já mapeadas no design de tema)
- **Reuses**: nenhum componente existente — primeira peça de visualização de dado agregado no projeto, mas sem dependência nova.

---

## Data Models

### `PerfilCandidatura` (novo tipo, `src/backend/types/fundacao.ts` ou `tse.ts`)

```typescript
interface PerfilCandidatura {
  idade: number | null;           // calculada de dt_nascimento, null se dt_nascimento for null
  genero: string | null;          // ds_genero
  corRaca: string | null;         // ds_cor_raca
  grauInstrucao: string | null;   // ds_grau_instrucao
  ocupacao: string | null;        // ds_ocupacao
  coligacao: string | null;       // nm_coligacao
}
```

**Relationships**: chaveado por `(anoEleicao, sqCandidato, nrTurno)`, mesma chave de `CandidaturaSugerida` (`tse.ts` existente) e de `rel_mandato_candidatura`.

### `PerfilEleitorado` (novo tipo)

```typescript
interface PerfilEleitorado {
  genero: Array<{ categoria: string; qtEleitores: number }>;
  faixaEtaria: Array<{ categoria: string; qtEleitores: number }>;
  grauEscolaridade: Array<{ categoria: string; qtEleitores: number }>;
}
```

**Relationships**: agregado a partir de `tse.mv_perfil_eleitorado_candidatura`, agrupado em 3 listas no TypeScript a partir do formato longo (`dimensao`/`categoria`/`qt_eleitores`).

### `tse.mv_perfil_eleitorado_candidatura` (nova view — formato SQL, não TypeScript)

```
ano_eleicao SMALLINT, sq_candidato BIGINT, nr_turno SMALLINT,
dimensao TEXT   -- 'genero' | 'faixa_etaria' | 'grau_escolaridade'
categoria TEXT  -- valor da categoria (ex.: 'Feminino', '25 a 34 anos')
qt_eleitores BIGINT  -- soma agregada
```

**Relationships**: união (`UNION ALL`) de 3 agregações sobre `tse.dim_perfil_eleitorado`, cada uma pré-filtrada pelo `cd_municipio` principal de cada candidatura (mesma lógica de desempate — mais votos, `NULLS LAST` — já usada em `mv_candidatura_resumo`).

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Candidatura sem linha em `tse.dim_candidatura` | `buscarPerfilCandidatura` retorna `null` | Bloco de perfil pessoal não aparece pra essa candidatura (sem erro, sem `—` avulso — bloco inteiro omitido) |
| Candidatura sem município principal identificável (`mv_candidatura_resumo.nm_municipio_principal IS NULL`, ou sem linha na nova view) | `buscarPerfilEleitoradoCandidatura` retorna `null` | Bloco de perfil do eleitorado omitido (CAD-12/Edge Case da spec) |
| `dt_nascimento IS NULL` | Cálculo de idade retorna `null`, não lança | Campo "Idade" mostra `—` |
| Falha de rede/RLS ao consultar qualquer fonte TSE | `try/catch` na página de detalhe, mesmo padrão de `mensagem` já usado em `/mandatos/[id]` hoje | Mensagem de erro genérica na tela, resto da página continua funcional (não quebra a tela toda) |
| Listagem de mandatos/coalizões vazia | Array vazio da query, sem erro | Estado vazio com CTA "Cadastrar" (CAD-02/CAD-06) |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Cores da marca em hex podem não se comportar de forma idêntica a `oklch()` com modificadores de opacidade Tailwind (`bg-primary/50`) | `src/frontend/app/globals.css` (CSS vars a editar) | Pequeno risco visual (opacidade renderizar diferente do esperado) em usos que dependem de `/NN` — nenhum uso desse tipo foi encontrado nas telas existentes hoje | Verificar visualmente durante Execute; se algum `/NN` quebrar, converter esse valor específico pra `oklch()` (Tailwind v4 já faz a conversão internamente pra outras cores do tema) |
| `tse.fat_votacao_zona` documentada como "nunca lida direto" (~4,3GB em 2022) | `docs/schema_sistema.sql:582` | Se a nova migração acidentalmente agregar direto sem view, degrada performance/custo | Mitigado pelo próprio design: agregação acontece só dentro da definição da nova materialized view (SQL de migração), nunca numa query da aplicação |
| Nenhum teste automatizado cobre telas de frontend neste projeto até hoje (mesmo padrão da Fase 5 da Fundação — "Tests: none, gate de build") | `.specs/features/fundacao-entidades-pessoas/tasks.md` (T29-T37) | Validação desta feature também vai depender de build/lint + verificação visual manual, não de suíte automatizada | Consistente com o padrão já estabelecido no projeto — não é uma lacuna nova introduzida por esta feature |
| Mover `mandatos/`, `coalizoes/`, `usuarios/`, `contratos/` pra dentro de `(app)/` é um refactor de caminho de arquivo em cima de código já validado (Fundação) | `src/frontend/app/**` | Risco de quebrar um import relativo ou um link hardcoded durante a movimentação | Route group não muda a URL (confirmado na doc oficial) — só o caminho do arquivo no disco; nenhum `href`/import deveria mudar. Testar cada rota depois do move (gate de build já pega import quebrado). |

> Nenhum risco de segurança ou de RLS identificado — toda leitura nova passa pelas mesmas tabelas/RLS já em produção (nenhuma política nova) ou por uma view sem RLS (mesma situação de `mv_candidatura_resumo`, dado público do TSE, AD-019 não se aplica).

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Mapeamento das cores da marca pros tokens shadcn | `--primary`=verde `#035252`; `--secondary`=vinho `#571730`; `--destructive`=coral `#EB5454` (já é semanticamente "negativo/excluir" no shadcn, bate com a doc); `--background`=creme `#FBF7EF`; `--card`=branco `#FFFFFF`; `--border`=`#E7E0D3`; `--chart-1..5`=vinho/bege/coral/turquesa/roxo (as 5 cores de acento restantes, verde já é `--primary`); `--sidebar`=verde escuro, `--sidebar-foreground`=creme `#FBF3E4`, `--sidebar-primary` (item ativo)=vinho | Segue a codificação já definida em `Identidade Visual Legisla.md` (destrutivo=coral, produtos codificados por cor) mapeada pros papéis semânticos mais próximos do sistema shadcn já em uso |
| Fontes via tokens já existentes (`--font-sans`/`--font-heading`) | `globals.css:12` já define `--font-heading: var(--font-sans)` — só precisa apontar `--font-heading` pra Anton e `--font-sans` pra Commissioner (carregados via `next/font/google` no `layout.tsx`, substituindo Geist) | O hook pra separar título/corpo já existe no tema gerado pelo shadcn, sem precisar inventar um token novo |
| Perfil do eleitorado sem lib de gráfico | Barras simples via CSS/Tailwind (`div` com largura proporcional), sem `recharts`/shadcn `chart` | Perguntado ao usuário — escolheu manter simples, sem dependência nova. Ainda visualmente mais rico que uma tabela de números crus (barras coloridas com as cores do tema), só não usa uma lib de charting dedicada. |
| Dark mode (`.dark` em `globals.css`) não é tocado nesta feature | Mantém os valores neutros atuais em `.dark`, só `:root` (light) recebe a paleta da marca | `Identidade Visual Legisla.md` não menciona variante escura, e não existe hoje nenhum toggle de tema no app — fora do pedido |
| Rota `/` (hoje é o scaffold padrão do `create-next-app`, nunca customizado) | Passa a redirecionar pra `/mandatos` (dentro do grupo `(app)`) | Não fazia parte da spec construir uma home/dashboard nova (não pedido) — mas deixar o scaffold padrão visível seria estranho agora que a sidebar existe em volta dele. Redirect é a menor mudança que resolve a inconsistência sem inventar uma tela nova não pedida. |

> **Project-level**: o padrão "toda tela autenticada nova entra em `(app)/`, todo brand color novo entra como CSS var em `globals.css`" é um precedente que próximas features devem seguir — será registrado como `AD-027` em `.specs/STATE.md` após confirmação deste design.
