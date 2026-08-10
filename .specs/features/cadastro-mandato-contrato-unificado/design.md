# Cadastro de Mandato e Contrato Unificado — Design

**Spec**: `.specs/features/cadastro-mandato-contrato-unificado/spec.md`
**Status**: Draft
**Escopo desta rodada de Design**: **apenas CMU-15** (contrato próprio da Coalizão) e **CMU-16**
(correção do seletor de membro, débito `FND-COL-03`). CMU-01 a CMU-14 já estão implementados —
auditados diretamente no código e registrados na tabela de Requirement Traceability do `spec.md`,
sem necessidade de nenhum design novo. Escopo Medium (poucos arquivos, sem tabela/RPC/RLS nova) —
design inline e breve, conforme `references/design.md` da skill.

---

## Architecture Overview

Os dois requisitos tocam um único arquivo de tela: `src/frontend/app/(app)/coalizoes/[id]/page.tsx`.
Nenhuma tabela nova, nenhuma função RPC nova, nenhuma política de RLS nova — reaproveita por completo
o que a Fundação já construiu (`ContratoForm`, `fat_contrato`, RLS `p_por_carteira`). O único código
novo é: (a) uma query adicional pra listar os contratos da própria coalizão, (b) uma ação que abre
`ContratoForm` inline, e (c) a correção de uma query existente pra filtrar por
`dim_contratante.tipo_contratante = 'mandato'`.

```mermaid
graph TD
    A["/coalizoes/[id] (Gestora)"] -->|clique em "Novo contrato"| B["ContratoForm modo=abrir<br/>idContratante = id_contratante da coalizão"]
    B -->|insert fat_contrato| C[("fat_contrato")]
    A -->|carregar: eq id_contratante própria coalizão| D["Card novo:<br/>Contratos da coalizão (CMU-15 AC2)"]
    D --> C
    B -.contratosExistentes = mesma lista.-> D
    A -->|carregar: join dim_contratante<br/>eq tipo_contratante='mandato'| E["Select corrigido:<br/>Adicionar membro (CMU-16)"]
    E --> C
    E -.filtra por.-> F[("dim_contratante")]
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `ContratoForm` (modo `"abrir"`) | `src/frontend/components/fundacao/contrato-form.tsx` | Importado **sem alteração**. Já é agnóstico de tipo de contratante — só recebe `idContratante: number`. Passar `idContratante={contratante.id_contratante}` (a coalizão) e `contratosExistentes` = lista já filtrada por `id_contratante` da própria coalizão (o próprio componente já documenta esse contrato em comentário — `contrato-form.tsx:192-193`, FND-CTR-02) |
| `mapeiaErroRpc` | `src/backend/rpc/errors.ts` | Mesma função já usada em `alternarPlanejamentoProprio`/`adicionarMembro` nesta mesma página — nenhuma mudança |
| Padrão "ação → formulário inline" (toggle) | `src/frontend/app/(app)/mandatos/[id]/contratos/novo/page.tsx` (state `encerrandoId`) | Mesmo padrão: state boolean/nullable controla se o formulário aparece dentro da própria tela, sem navegar pra rota nova |
| `contratoSchema` | `src/backend/schemas/contrato.ts` | Já agnóstico de tipo de contratante — nenhuma mudança |
| Padrão de embed de FK via PostgREST | `src/backend/queries/mandato.ts:17` (`dim_mandato ... dim_contratante (nome)`) | Mesmo padrão de sintaxe pra filtrar `fat_contrato` por uma coluna de `dim_contratante` (CMU-16) |

### Integration Points

| System | Integration Method |
| ------ | ------------------- |
| `fat_contrato` | Um `insert` direto via PostgREST dentro de `ContratoForm` (modo `abrir`) — já existente, mesma tabela e mesma coluna `id_contratante` que hoje só recebe `id_contratante` de mandato |
| `dim_contratante` | Query de leitura adicional (embed `!inner`) só pra filtrar o seletor de membro por `tipo_contratante='mandato'` — sem escrita nova |
| RLS (`p_por_carteira` em `fat_contrato`) | Nenhuma mudança necessária — a política já libera Gestora/Admin por completo (`app.papel_atual() IN ('admin','gestora')`) e não distingue tipo de contratante hoje; abrir contrato pra coalizão não exige RLS diferente do que já existe pra mandato |

---

## Components

### `CoalizaoDetalhePage` (modificado)

- **Purpose**: adicionar a seção "Contratos da coalizão" + ação "Novo contrato" (CMU-15), e corrigir
  a fonte de dados do seletor "Adicionar membro" (CMU-16).
- **Location**: `src/frontend/app/(app)/coalizoes/[id]/page.tsx`
- **Mudanças de estado**:
  - **Novo** `contratosProprios: ContratoRow[]` — contratos cujo `id_contratante` é o da própria
    coalizão. Query: `supabase.from("fat_contrato").select("*").eq("id_contratante", coalizaoData.id_contratante).order("dt_inicio", { ascending: false })`.
    Usado tanto pro novo Card "Contratos da coalizão" (CMU-15 AC2) quanto como `contratosExistentes`
    do `ContratoForm` (CMU-15 AC3 — "contrato anterior" só pode ser outro contrato da mesma coalizão).
  - **`contratos` (existente, corrigido)** — passa a ser exclusivamente a lista de candidatos ao
    seletor "Adicionar membro". Query corrigida (CMU-16):
    ```ts
    supabase
      .from("fat_contrato")
      .select("*, dim_contratante!inner(tipo_contratante)")
      .eq("dim_contratante.tipo_contratante", "mandato")
      .order("id_contrato", { ascending: false })
    ```
    Recomendação: renomear pra `contratosMandato` no momento da implementação — o nome genérico
    `contratos` foi exatamente o que permitiu o bug `FND-COL-03` passar sem ser notado; um nome que
    já denuncia o filtro reduz a chance de reintroduzir a mesma confusão.
  - **Novo** `abrindoContrato: boolean` — mesmo padrão de `encerrandoId` da página de contrato do
    mandato; controla a visibilidade do `ContratoForm` inline.
- **Novo bloco de UI**: Card "Contratos da coalizão" — tabela no mesmo padrão visual da tabela
  "Membros" já existente (Produto, Início, Status), com um botão "Novo contrato" no header (mesmo
  lugar/estilo do botão "Adicionar membro" que a seção de membros já tem). O clique alterna
  `abrindoContrato`; quando `true`, renderiza:
  ```tsx
  <ContratoForm
    idContratante={coalizao.id_contratante}
    contratosExistentes={contratosProprios}
    modo={{ tipo: "abrir" }}
    onConcluido={() => { setAbrindoContrato(false); void carregar(); }}
  />
  ```
- **Dependencies**: `ContratoForm`, `mapeiaErroRpc`, `createClient` (já importados na página).
- **Reuses**: tudo listado em Code Reuse Analysis, acima.

Nenhum outro componente muda. `ContratoForm` e `contratoSchema` permanecem exatamente como estão —
zero edição nos dois.

---

## Data Models

Nenhuma tabela nova, nenhuma coluna nova. `fat_contrato.id_contratante` já é uma FK genérica para
`dim_contratante(id_contratante)` (`0009_fundacao_tabelas.sql:79`), sem CHECK nem trigger que
restrinja por `tipo_contratante` — é exatamente essa ausência de restrição que já torna CMU-15
possível sem migração alguma. `dim_coalizao.id_contratante` (mesma migration, linha 71) é a coluna
que fornece o `idContratante` a passar pro `ContratoForm`.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --------------- | -------- | ------------ |
| Insert em `fat_contrato` falha (RLS, constraint de campo) | `ContratoForm` já trata com `mapeiaErroRpc` internamente — reaproveitado sem mudança | Mensagem de erro já mapeada (mesmo padrão do fluxo de mandato), exibida dentro do próprio formulário |
| Seletor "Adicionar membro" carrega vazio (nenhum contrato de mandato cadastrado ainda) | `SelectContent` já renderiza sem opções hoje quando a lista está vazia — nenhuma mudança de comportamento, só a fonte dos dados muda | Select aparece sem opções, mesmo placeholder "Selecione" que já existe |
| Coalizão sem nenhum contrato próprio ainda (`contratosProprios` vazio) | Mesmo padrão vazio que a tabela "Membros" já usa (`membros.length === 0`) | Mensagem "Nenhum contrato para esta coalizão" (ou equivalente), sem quebrar a tela |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | --------------------- | ------ | ---------- |
| CMU-04 sem ação na condição de corrida do wizard de mandato | `mandato-wizard.tsx:287-295` | Usuário vê a mensagem certa mas não tem atalho pra abrir contrato do mandato já existente — precisa refazer a busca manualmente | Fora do escopo desta rodada de Design (CMU-15/16); registrado como Q1 em "Perguntas abertas para Pedro" no `spec.md` |
| CMU-13: exclusão silenciosa de vínculo TSE já confirmado (histórico, já aplicado) | `0022_cadastro_mandato_contrato_unificado.sql:11-15` | Já aconteceu em dev e produção — não bloqueia CMU-15/16, mas é uma decisão de dado tomada sem trilha registrada | Fora do escopo desta rodada; registrado como Q3 em "Perguntas abertas para Pedro" |
| CMU-14 AC5: carga futura do TSE sem filtro de cargo | `0027_carrega_tse.sql`, `DADOS TSE/carga_amostral.js` | Uma nova safra do TSE reintroduz cargos fora do Legislativo, desfazendo 0022/0026 silenciosamente | Fora do escopo desta rodada; registrado como Q2 em "Perguntas abertas para Pedro" |
| `/mandatos/[id]/contratos/novo` parece órfã (nenhum link no código aponta pra ela) | `src/frontend/app/(app)/mandatos/[id]/contratos/novo/page.tsx` | Nenhum impacto funcional (código morto, não quebra nada) — mas confundiria quem for procurar "onde fica a tela de novo contrato" ao ler o código | Este design **não** replica esse padrão de rota dedicada pra Coalizão — abre inline em `/coalizoes/[id]` (ver Tech Decisions). Decisão de remover ou manter a rota órfã do mandato fica com Pedro — registrado como Q4 em "Perguntas abertas para Pedro" |
| Renomear `contratos` → `contratosMandato` toca um arquivo que outra trilha pode estar editando em paralelo | `coalizoes/[id]/page.tsx` | Risco de conflito de merge se outra trilha tocar o mesmo arquivo ao mesmo tempo — fora do controle desta feature | Nenhuma mitigação de Design; é aviso pra quem for implementar (fase Tasks/Execute), não uma decisão a tomar agora |

> Nenhum concern de segurança/performance **novo**: RLS e grants de `fat_contrato`/`dim_contratante`
> já cobrem este caso (a política `p_por_carteira` não distingue tipo de contratante hoje e não
> precisa passar a distinguir pra este requisito específico).

---

## Tech Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Inline vs. rota dedicada para "Novo contrato" da coalizão | Inline dentro de `/coalizoes/[id]/page.tsx` (toggle boolean, mesmo padrão de `encerrandoId`) | `/mandatos/[id]/contratos/novo` está órfã hoje (nenhum link aponta pra ela — confirmado por busca no código). Replicar o mesmo padrão de rota dedicada criaria uma segunda rota com o mesmo risco de virar órfã; a página de coalizão já concentra todas as ações da entidade (planejamento próprio, membros), então "Novo contrato" cabe no mesmo lugar, sem navegação extra |
| Escrita single-table, sem RPC | `insert` direto em `fat_contrato` via `ContratoForm` (já existe, sem mudança de arquitetura) | AD-024 exige RPC `SECURITY INVOKER` só para invariante multi-tabela; abrir um contrato é 1 linha em 1 tabela — mesma regra que já vale hoje pro fluxo de contrato avulso de mandato via este mesmo componente. Não há necessidade de subir pro caminho atômico (RPC) que `app.criar_mandato` usa, porque aqui não há mandato/coalizão pra criar junto — só o contrato |
| Query do seletor "Adicionar membro" via embed `!inner` | `fat_contrato.select("*, dim_contratante!inner(tipo_contratante)").eq("dim_contratante.tipo_contratante", "mandato")` | Mesmo padrão de embed de FK que `buscarMandatoExistentePorTitulo` (`queries/mandato.ts:17`) já usa pra ler `dim_contratante` a partir de outra tabela — sem função nova, sem RPC. A FK já existe (`fat_contrato.id_contratante REFERENCES dim_contratante`, `0009_fundacao_tabelas.sql:79`), então o embed funciona sem migração |

> **Project-level decisions:** nenhuma decisão desta rodada precisa virar `AD-NNN` novo em
> `.specs/STATE.md` — tudo é local à feature e reaproveita convenções já ativas (AD-024 para a regra
> de RPC vs. insert direto). A decisão sobre CMU-14 (candidato a `AD-029` restringindo cargas futuras
> do TSE ao Legislativo) fica registrada como pergunta aberta no `spec.md` (Q2), não decidida aqui —
> é escopo de CMU-14 (já implementado, fora desta rodada de Design), não de CMU-15/16.
