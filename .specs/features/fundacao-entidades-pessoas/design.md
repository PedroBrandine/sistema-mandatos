# Fundação — entidades & pessoas Design

**Spec**: `.specs/features/fundacao-entidades-pessoas/spec.md`
**Status**: Approved

---

## Architecture Overview

O projeto é **greenfield**: `src/frontend/`, `src/backend/` e `supabase/` existem vazios (sem scaffold de Next.js, sem migração local ainda). `docs/schema_sistema.sql` é o modelo **aprovado por inteiro** (AD-008), mas o provisionamento no projeto Supabase (`mgoeloqdlpgkofgqqbjs`) é **incremental por feature** (AD-025) — não se pode assumir que as tabelas de Fundação já existem lá. A fase Tasks começa checando o que já está provisionado antes de gerar a migração — ver `## Risks & Concerns`.

**Decisão central confirmada com o usuário:** escritas que tocam mais de uma linha/tabela (criar mandato = `dim_contratante`+`dim_mandato`; confirmar candidatura + desmarcar a vigente anterior; substituir vínculo = fechar linha antiga + criar nova) usam **funções Postgres RPC `SECURITY INVOKER`** — nunca Edge Function/`service_role` (que ficariam fora das 4 exceções fechadas em AD-010) e nunca sequência de chamadas soltas do Server Action (que não garante atomicidade — várias ACs do spec exigem "numa única transação").

`SECURITY INVOKER` é o padrão do Postgres (não é preciso declarar) e é o que faz a função herdar o papel de quem chama — a RLS das tabelas internas (`dim_contratante`, `dim_mandato`, `rel_usuario_contrato`...) continua decidindo quem pode escrever, exatamente como se o cliente chamasse a tabela direto. Nenhuma função desta feature declara `SECURITY DEFINER`.

RPC é usado **só onde a atomicidade cruza linha/tabela**. Tudo que é escrita de uma linha só (editar cargo do vínculo, encerrar vínculo, rejeitar candidatura, abrir contrato, alternar `possui_planejamento_proprio`) é uma chamada PostgREST direta (`insert`/`update`), sem função — mantém a maior parte da superfície simples e inspecionável.

```mermaid
graph TD
    UI[Next.js — src/frontend] -->|supabase.from(...).select/insert/update| PostgREST
    UI -->|supabase.rpc(...)| PostgREST
    PostgREST -->|RLS do papel do usuário logado| DB[(Postgres · schema public)]
    PostgREST -->|RLS do papel do usuário logado| RPC[app.* funções SECURITY INVOKER]
    RPC --> DB
    UI -->|leitura| TSEMV[tse.mv_candidatura_resumo]
```

---

## Approach Considered and Rejected

| Approach | Por que não |
| -------- | ------------ |
| Edge Function com `service_role` orquestrando as escritas | Fora das 4 exceções fechadas em AD-010 (Integrações, impersonation do Admin, importação TSE, exportação). Fundação não é nenhuma delas — usar `service_role` aqui violaria AD-009/AD-010/AD-011 sem necessidade, já que RPC resolve a atomicidade sem sair da RLS. |
| Server Action com sequência de chamadas Supabase (sem função no banco) | Sem transação real entre chamadas PostgREST — uma falha no meio (ex.: fechar vínculo antigo e falhar ao criar o novo) deixa estado parcial que o spec explicitamente proíbe ("numa única transação" em FND-TSE-02/04, FND-USR-05, contrato de criação do mandato). |

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `app.normaliza_nome(text)` / `app.f_unaccent(text)` | `docs/schema_sistema.sql:99-109` | Reusado tal como está para detectar duplicata de contratante (já é o que popula `dim_contratante.nome_normalizado` e sustenta `ix_contratante_nome_norm`) |
| Domínio `texto_limpo` | `docs/schema_sistema.sql:114-125` | Já aplicado nas colunas de atributo relevantes (`grau_responsabilidade`, `nm_municipio`, etc.) — nenhuma validação extra de "sentinela" é necessária no formulário além de espelhar o domínio no Zod |
| `dim_contratante` / `dim_mandato` / `dim_coalizao` / `fat_contrato` / `rel_coalizao_membro` / `rel_mandato_candidatura` / `dim_usuario` / `rel_usuario_contrato` | `docs/schema_sistema.sql:391-712` | Fonte de verdade aprovada (AD-008) — schema referenciado, não redesenhado |
| `tse.mv_candidatura_resumo` | `docs/schema_sistema.sql:625-670` | Única superfície de leitura do TSE permitida pela Constituição (INT-03) — usada para a busca/sugestão de match |

### Integration Points

| System | Integration Method |
| ------ | ------------------- |
| Supabase (Postgres + PostgREST) | `@supabase/ssr` client, chamadas diretas (`select`/`insert`/`update`) e `supabase.rpc(...)` para as 4 funções `app.*` desta feature — sem Edge Function, sem `service_role` (AD-011) |
| RLS | As políticas de todas as tabelas de Fundação **já existem** em `docs/schema_sistema.sql:1615-1656` (`p_usuario`, `p_vinculo_proprio`, `p_por_carteira` sobre `dim_contratante`/`dim_mandato`/`dim_coalizao`/`rel_mandato_candidatura`/`fat_contrato`) — esta feature aplica essa fatia, não desenha política nova |
| Sessão RLS ↔ Supabase Auth | `app.papel_atual()`/`app.id_usuario()` leem uma *session variable* (`app.id_usuario`) e há 5 ROLES reais do Postgres (`legisla_gestora`/`mentor`/`assessor`/`admin`/`app`) com GRANT próprio — **essa ligação com o Supabase Auth ainda não existe** (é PLT-01/PLT-03, não Fundação). Ver `## Risks & Concerns` e Fase 0 das tasks |

---

## Components

### `TseMatchSearch`

- **Purpose**: Buscar candidaturas em `tse.mv_candidatura_resumo` por nome/UF/cargo e listar sugestões com método e confiança.
- **Location**: `src/frontend/components/fundacao/tse-match-search.tsx`
- **Interfaces**:
  - `buscarCandidaturas(filtros: { nome?: string; sgUf?: string; idCargo?: number; anoEleicao?: number }): Promise<CandidaturaSugerida[]>` — consulta direta a `tse.mv_candidatura_resumo` (sem RPC — é leitura, sem escrita)
- **Dependencies**: cliente Supabase tipado (`src/backend/supabase/client.ts`)
- **Reuses**: nenhum componente existente (greenfield)

### `MandatoWizard`

- **Purpose**: Fluxo de cadastro de mandato — busca TSE → confirmar/rejeitar sugestão → aviso de duplicata → fallback manual. Cobre FND-TSE-01 a 06 e FND-TSM-01/02.
- **Location**: `src/frontend/app/mandatos/novo/page.tsx` + `src/frontend/components/fundacao/mandato-wizard.tsx`
- **Interfaces**:
  - `onConfirmarSugestao(candidatura: CandidaturaSugerida): Promise<MandatoCriado>` → chama `criarMandato()` (RPC)
  - `onRejeitarSugestao(idVinculoTse: number): Promise<void>` → `update` direto em `rel_mandato_candidatura`
  - `onCadastroManual(dados: MandatoManualInput): Promise<MandatoCriado>` → chama `criarMandato()` (RPC) sem candidatura
- **Dependencies**: `TseMatchSearch`, `DuplicataWarningDialog`
- **Reuses**: —

### `DuplicataWarningDialog`

- **Purpose**: Exibir contratante(s) parecido(s) por `nome_normalizado` + UF/município e exigir confirmação explícita antes de salvar. Compartilhado entre cadastro de mandato e de coalizão (ambos criam `dim_contratante`).
- **Location**: `src/frontend/components/fundacao/duplicata-warning-dialog.tsx`
- **Interfaces**:
  - `props: { candidatos: ContratanteSimilar[]; onConfirmar: () => void; onCancelar: () => void }`
- **Dependencies**: nenhuma
- **Reuses**: —

### `CoalizaoForm`

- **Purpose**: Cadastro e edição de coalizão (`dim_contratante` + `dim_coalizao`), incluindo alternar `possui_planejamento_proprio` a qualquer momento. Cobre FND-COL-01/02.
- **Location**: `src/frontend/app/coalizoes/**`
- **Interfaces**:
  - `onCriar(dados: CoalizaoInput): Promise<CoalizaoCriada>` → chama `criarCoalizao()` (RPC)
  - `onAlternarPlanejamentoProprio(idCoalizao: number, valor: boolean): Promise<void>` → `update` direto em `dim_coalizao`
- **Dependencies**: `DuplicataWarningDialog`
- **Reuses**: mesmos campos de contratante do `MandatoWizard` (UF, município — componente de formulário de contratante compartilhado, ver `ContratanteFields` abaixo)

### `ContratanteFields`

- **Purpose**: Campos comuns de `dim_contratante` (nome, UF, município) — extraído para reuso entre `MandatoWizard` e `CoalizaoForm`, já que ambos criam o mesmo supertipo.
- **Location**: `src/frontend/components/fundacao/contratante-fields.tsx`
- **Interfaces**: componente de formulário controlado (React Hook Form `Control`)
- **Dependencies**: Zod schema `contratanteSchema` (`src/backend/schemas/contratante.ts`)
- **Reuses**: —

### `ContratoForm`

- **Purpose**: Abrir contrato para um contratante (produto obrigatório, projeto opcional, contrato anterior opcional escolhido entre os existentes do mesmo contratante) e encerrar contrato com motivo. Cobre FND-CTR-01 a 05.
- **Location**: `src/frontend/app/mandatos/[id]/contratos/**`
- **Interfaces**:
  - `onAbrir(dados: ContratoInput): Promise<Contrato>` → `insert` direto em `fat_contrato` (single-table, sem RPC)
  - `onEncerrar(idContrato: number, status: 'concluido' | 'nao_concluido', motivo?: string): Promise<void>` → `update` direto (CHECK `ck_contrato_motivo` é o backstop)
- **Dependencies**: seletor de contratos existentes do contratante (para `id_contrato_anterior`)
- **Reuses**: —

### `VinculoTable` / `VinculoForm`

- **Purpose**: Listar, adicionar, editar, substituir e encerrar vínculos usuário↔contrato de um contrato — genérico para papel `gestora`/`mentor`/`assessor`, incluindo o caso do assessor mentorado do PLL (vínculo manual, sem matching). Cobre FND-USR-03 a 08.
- **Location**: `src/frontend/app/contratos/[id]/vinculos/**`
- **Interfaces**:
  - `onAdicionar(dados: VinculoInput): Promise<Vinculo>` → `insert` direto (`uq_vinculo` é o backstop de FND-USR-07)
  - `onEditar(idVinculo: number, dados: VinculoEditavel): Promise<void>` → `update` direto (cargo/grau/áreas — nunca toca `dt_inicio`/`dt_fim`)
  - `onSubstituir(idVinculoAntigo: number, idUsuarioNovo: number, dados: VinculoEditavel): Promise<void>` → chama `substituirVinculo()` (RPC)
  - `onEncerrar(idVinculo: number): Promise<void>` → `update` direto (`dt_fim = hoje`)
- **Dependencies**: seletor de `dim_usuario` (busca por nome/e-mail)
- **Reuses**: —

### `UsuarioForm`

- **Purpose**: Cadastro de `dim_usuario` (Mentor/Assessor por Gestora; Gestora só por Admin). Cobre FND-USR-01/02.
- **Location**: `src/frontend/app/usuarios/**`
- **Interfaces**:
  - `onCriar(dados: UsuarioInput): Promise<Usuario>` → `insert` direto (RLS decide se `papel_global='gestora'` é permitido para quem chama — ver Error Handling)
- **Dependencies**: —
- **Reuses**: —

### RPC layer (`src/backend/rpc/`)

- **Purpose**: Wrappers tipados sobre as 4 funções `app.*` — único ponto de chamada `supabase.rpc(...)` desta feature.
- **Location**: `src/backend/rpc/mandato.ts`, `src/backend/rpc/coalizao.ts`, `src/backend/rpc/vinculo.ts`
- **Interfaces**:
  - `criarMandato(input: CriarMandatoInput): Promise<MandatoCriado>` → `app.criar_mandato(p_contratante, p_mandato, p_candidatura, p_ignorar_duplicata)`
  - `marcarCandidaturaVigente(idVinculoTse: number): Promise<void>` → `app.marcar_candidatura_vigente(p_id_vinculo_tse)`
  - `criarCoalizao(input: CriarCoalizaoInput): Promise<CoalizaoCriada>` → `app.criar_coalizao(p_contratante, p_coalizao)`
  - `substituirVinculo(input: SubstituirVinculoInput): Promise<void>` → `app.substituir_vinculo(p_id_vinculo_antigo, p_id_usuario_novo, p_cargo, p_grau_responsabilidade, p_areas)`
- **Dependencies**: cliente Supabase tipado
- **Reuses**: —

---

## Data Models

Tipos de tabela vêm de `supabase gen types typescript` (gerado, não redigitado — `src/backend/supabase/database.types.ts`). Abaixo, só os tipos **compostos** que a UI consome e que não existem 1:1 numa tabela.

```typescript
// src/backend/types/fundacao.ts

interface CandidaturaSugerida {
  anoEleicao: number
  sqCandidato: number
  nrTurno: number
  nrTituloEleitoral: string | null
  nmCandidato: string | null
  nmUrna: string | null
  sgUf: string | null
  nmMunicipioPrincipal: string | null
  sgPartido: string | null
  qtVotosTotal: number
  metodoMatch: 'titulo_eleitoral' | 'nome_uf_cargo' | 'manual'
  confianca: 'alta' | 'media' | 'baixa'
}

interface ContratanteSimilar {
  idContratante: number
  nome: string
  sgUf: string | null
  nmMunicipio: string | null
}

interface MandatoCriado {
  idContratante: number
  idMandato: number
  idVinculoTse: number | null
}

interface CoalizaoCriada {
  idContratante: number
  idCoalizao: number
}

interface VinculoEditavel {
  cargo?: 'parlamentar' | 'chefe_gabinete' | 'assessor' | 'secretaria_executiva' | 'nao_se_aplica'
  grauResponsabilidade?: string | null
  areas?: string[]
}
```

**Relationships**: `CandidaturaSugerida` é a projeção de `tse.mv_candidatura_resumo` mais os campos de match ainda não persistidos (antes de confirmar). `MandatoCriado`/`CoalizaoCriada` são o retorno das funções RPC — a UI navega para `/mandatos/[idMandato]` ou `/coalizoes/[idCoalizao]` com o id devolvido.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --------------- | -------- | ----------- |
| Duplicata de contratante detectada (`app.criar_mandato`/`app.criar_coalizao` sem `p_ignorar_duplicata`) | Função levanta exceção com código próprio (`RAISE EXCEPTION ... USING ERRCODE = 'MDU01'`); wrapper RPC captura e retorna lista de similares | UI abre `DuplicataWarningDialog`; usuário confirma e a chamada é refeita com `p_ignorar_duplicata = true` |
| Violação de CHECK (`ck_contrato_motivo`, `ck_mandato_titulo`, `ck_membro_grupo`, domínio `texto_limpo`, etc.) | Postgres retorna `23514`; wrapper mapeia para mensagem de campo via tabela de correspondência constraint→mensagem | Erro inline no campo do formulário, nunca um toast genérico |
| Violação de UNIQUE (`uq_vinculo`, `uq_coalizao_membro`, `uq_mandato_candidatura`, `email` de `dim_usuario`) | Postgres retorna `23505`; wrapper mapeia para mensagem específica ("já existe um vínculo aberto para esta pessoa/papel/contrato") | Erro inline apontando o vínculo/linha conflitante |
| RLS nega a escrita (ex.: Gestora tentando cadastrar outra Gestora, ou usuário sem vínculo tentando editar contrato de terceiros) | Postgres/PostgREST retorna `42501`/`PGRST301` | Mensagem genérica de permissão — nunca revela dado da linha negada |
| Nenhuma candidatura sugerida na busca automática | Lista vazia, sem erro | UI oferece busca manual (FND-TSM-01) diretamente, sem tela de erro |
| `tse.mv_candidatura_resumo` desatualizada (safra nova ainda não refletida) | Não é erro — fora do controle desta feature (INT-03) | UI mostra a data do último refresh da MV, discreta, sem bloquear a busca |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | --------------------- | ------ | ---------- |
| Projeto é greenfield: `src/frontend/`, `src/backend/`, `supabase/` vazios; nenhuma migração local existe ainda; e o provisionamento no Supabase remoto é **incremental por feature** (AD-025) — não se pode assumir que as tabelas de Fundação já existem lá | `supabase/` (vazio) | Escrever migração assumindo que a tabela já existe (ou não existe) sem checar primeiro pode colidir com o que outra feature já criou, ou tentar recriar o que já está lá | Primeiro passo da fase Tasks: introspectar o projeto Supabase remoto (`supabase db diff` ou `supabase db pull` contra um schema vazio local) para saber exatamente quais das tabelas de Fundação (catálogos `ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`, `dim_usuario`, `rel_usuario_contrato`, `log_auditoria`, `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro`, schema `tse` completo, `rel_mandato_candidatura`) já existem antes de gerar a migração desta feature — só a fatia que faltar entra na migração nova, extraída de `docs/schema_sistema.sql` |
| `.specs/overview.md` afirmava 32 tabelas e só 2 tabelas TSE, todas "provisionadas" | `.specs/overview.md` | Já corrigido nesta sessão — passou a refletir as 51 tabelas + 11 views/MVs de `docs/schema_sistema.sql` e a deixar explícito que o provisionamento é incremental (AD-025), não um fato consumado | Resolvido — nenhuma ação pendente desta feature além de manter o documento atualizado se novas tabelas forem provisionadas |
| Busca de match TSE por nome (`nm_candidato`/`nm_urna`) em `tse.mv_candidatura_resumo` não tem índice de texto — só existe `uq_mv_candidatura_resumo` (ano/candidato/turno) | `docs/schema_sistema.sql:666-667` | Busca por nome pode ficar lenta à medida que a MV cresce (~centenas de milhares de candidaturas por safra) | Adicionar, nas tasks desta feature: extensão `pg_trgm` + índice GIN trigram sobre `app.normaliza_nome(nm_urna)` em `tse.mv_candidatura_resumo`, e índice B-tree em `(sg_uf, cd_cargo)` — mesma técnica já usada em `app.f_unaccent`/`app.normaliza_nome` para `dim_contratante` |
| Nenhuma função `app.*` de negócio existe ainda (só `app.normaliza_nome`/`app.f_unaccent`) | `docs/schema_sistema.sql` (schema `app`) | — | Esperado — as 4 funções desta feature (`criar_mandato`, `marcar_candidatura_vigente`, `criar_coalizao`, `substituir_vinculo`) são trabalho novo das tasks, não reuso |
| Zod schemas espelham CHECK constraints manualmente — sem geração automática | `src/backend/schemas/**` (a criar) | Constraint alterada no schema sem atualizar o Zod correspondente passa despercebida até falhar em produção | Cada schema Zod leva um comentário apontando o nome da constraint espelhada (`// espelha ck_mandato_titulo`); considerar um teste de smoke que insere um valor inválido por constraint e confere que o Zod barra o mesmo caso — candidato a task, não bloqueia o design |
| **RLS de Fundação depende de sessão que ainda não existe.** `app.papel_atual()`/`app.id_usuario()` leem `current_setting('app.id_usuario')`, e o GRANT por tabela depende de PostgREST autenticar como um dos 5 ROLES (`legisla_gestora`/`mentor`/`assessor`/`admin`/`app`) — nada disso está ligado ao Supabase Auth hoje; `dim_usuario` também não tem coluna alguma que amarre ao UUID do Supabase Auth | `docs/schema_sistema.sql:1451-1461, 2061-2104` | Sem essa ligação, toda política de RLS desta feature é inerte — nenhuma escrita/leitura protegida é testável de ponta a ponta | **Decisão do usuário:** incluir uma Fase 0 mínima de Plataforma nesta mesma tasks.md — Auth Hook do Supabase emitindo a claim `role`, função pre-request fazendo `SET app.id_usuario` a partir do JWT, e aplicar os 5 ROLES/GRANTs já definidos no schema. Não cobre PLT-02 (log já existe via trigger) nem PLT-04 (impersonação) — ficam fora |
| `dim_contratante`, `dim_coalizao` e `rel_coalizao_membro` ficaram fora do loop de trigger de auditoria do schema aprovado (só `dim_mandato`, `fat_contrato`, `rel_usuario_contrato`, `rel_mandato_candidatura` têm `trg_audit_*`) — viola AD-006 para essas 3 tabelas | `docs/schema_sistema.sql:1712-1732` | Editar/criar contratante, coalizão ou membro de coalizão não fica em `log_auditoria` — nenhuma escrita anônima é a regra, mas nada grava aqui | **Decisão do usuário:** task aditiva estendendo o mesmo loop/função `app.trg_auditoria()` já aprovada para as 3 tabelas — não é redesenho, é aplicar o padrão existente onde faltou |

> Nenhum risco de segurança, tech debt herdado ou lacuna de cobertura de teste encontrado além dos itens acima — natural para um projeto greenfield sem código anterior.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Atomicidade de escrita multi-linha | Funções Postgres RPC `SECURITY INVOKER` (`app.criar_mandato`, `app.marcar_candidatura_vigente`, `app.criar_coalizao`, `app.substituir_vinculo`); tudo o mais é `insert`/`update` direto via PostgREST | Único jeito de ter transação real sem sair da RLS nem usar `service_role` fora das 4 exceções de AD-010 — ver `## Approach Considered and Rejected` |
| Detecção de duplicata de contratante | Dentro da própria função RPC de criação (não como consulta prévia separada no cliente) | Uma única fonte de verdade para a regra "o que conta como duplicata" — evita que uma segunda tela de cadastro (futura) reimplemente a checagem de forma diferente |
| Match TSE — busca por nome | Nova extensão `pg_trgm` + índice GIN trigram sobre `app.normaliza_nome(nm_urna)` em `tse.mv_candidatura_resumo` | Sem índice de texto hoje; busca por nome em centenas de milhares de linhas precisa de suporte a fuzzy match, não só igualdade |
| Tipos TypeScript de tabela | Gerados via `supabase gen types typescript`, nunca redigitados à mão | Elimina uma segunda fonte de verdade — o schema aprovado (AD-008) já é a fonte única |
| Zod schemas | Escritos à mão, espelhando CHECK constraints, com comentário apontando a constraint espelhada | Não existe gerador Zod-a-partir-de-Postgres maduro e adotado; escrever à mão com rastreabilidade explícita é mais seguro que inventar uma ferramenta de geração agora |

> **Project-level decision a registrar em `.specs/STATE.md` após aprovação deste design:** "RPC `SECURITY INVOKER` é o padrão para toda escrita que cruza mais de uma linha/tabela; Edge Function/`service_role` continua restrito às 4 exceções de AD-010" — toda feature futura com essa mesma necessidade (Planejamento, Incidência, Operação) vai reencontrar esta pergunta. Proposto como **AD-024**.
