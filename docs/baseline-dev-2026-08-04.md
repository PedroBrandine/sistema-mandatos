# Linha de base do ambiente de dev — 04/08/2026

Registro do estado do projeto `sistema-mandatos-dev` (`npnvoolkebhabjkjzqwn`)
**antes** da criação do ambiente de produção. Serve de gabarito de comparação
para o Dia 2 do `docs/roadmap-ambientes-prod-dev.md`.

> ⚠️ **Documento histórico — congelado em 04/08/2026.** Não reflete o estado
> atual. O ambiente de produção foi criado em 06/08 e mais correções vieram
> depois (migrations `0027`, `0028` e a reordenação da `0001`). Para o estado
> de hoje, veja `docs/ambientes.md`; para o histórico completo das
> descobertas, a seção "O que realmente aconteceu" em
> `docs/roadmap-ambientes-prod-dev.md`.

---

## D1.1 / D1.3 — Máquina

| | Antes | Depois |
| --- | ----- | ------ |
| C: livre | 16,76 GB (7,1%) | **30,64 GB (12,9%)** |
| RAM disponível | 684 MB | 1.343 MB |
| Commit | 20,8 / 23,6 GB (88%) | 21,2 / 23,6 GB (90%) |

Liberados **13,88 GB**:

| Alvo | Liberado |
| ---- | -------- |
| `%LOCALAPPDATA%\Temp` | 8.037 MB (45 itens em uso, ignorados) |
| `npm-cache` | ~3.900 MB |
| `src/frontend/.next` | 1.212 MB |
| `pip\Cache` | 1.178 MB |
| `C:\Windows\Temp` | 167 MB |

**Não liberado:** `C:\Windows\SoftwareDistribution\Download` (410 MB) — exige
privilégio elevado e parada do serviço Windows Update.

> A folga de RAM continua crítica (90% de commit). A decisão de não instalar
> Docker segue válida.

---

## D1.4 — Migrations

`supabase migration list --linked`: **24 migrations, `local` e `remote`
preenchidos em todas, sem órfãs.** Histórico limpo desde a reconciliação de
04/08 (repair da `20260801134547` + push de `0023`/`0024`).

---

## D1.5 — Advisors (gabarito para o D2.7)

`supabase db advisors --linked --type all`

### ERROR — 4 ocorrências, todas intencionais

| Regra | Objeto |
| ----- | ------ |
| `rls_disabled_in_public` | `public.ref_cargo` |
| `rls_disabled_in_public` | `public.ref_partido` |
| `rls_disabled_in_public` | `public.ref_produto` |
| `rls_disabled_in_public` | `public.ref_projeto` |

São consequência deliberada da migration `0024_ref_tables_rls_fix.sql`, que
desabilita RLS nos catálogos de referência para permitir leitura pública.
**O prod deve apresentar exatamente estes 4 e nenhum outro.** Qualquer
`rls_disabled_in_public` além destes quatro é um bug.

### WARN — agrupados

| Regra | Qtd | Objetos |
| ----- | --- | ------- |
| `function_search_path_mutable` | 6 | `public.carrega_tse`, `app.id_usuario`, `app.f_unaccent`, `app.normaliza_nome`, `app.id_usuario_sistema`, `app.cria_particoes_log` |
| `anon_security_definer_function_executable` | 8 | `app.contratos_do_usuario`, `app.custom_access_token_hook`, `app.papel_atual`, `app.pre_request`, `app.provisiona_usuario_dominio_legisla`, `app.trg_auditoria`, `public.carrega_tse`, `public.rls_auto_enable` |
| `authenticated_security_definer_function_executable` | 8 | os mesmos acima |
| `extension_in_public` | 3 | `unaccent`, `btree_gin`, `pg_trgm` |
| `auth_leaked_password_protection` | 1 | configuração de Auth (não é SQL — ver D1.7) |

O grupo mais relevante para produção é o
`anon_security_definer_function_executable`: funções internas como
`app.custom_access_token_hook` e `app.pre_request` estão chamáveis por
`anon` via `/rest/v1/rpc/...`. Em dev é tolerável; em produção merece um
`REVOKE EXECUTE` — que deve nascer como migration nova, não como SQL avulso.

---

## D1.6 — O que passa hoje

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | ❌ **4 erros** |
| `npm run test:unit` | ✅ 91 testes, 10 arquivos |
| `npm run test:integration` | ❌ **2 testes falham + 1 suíte com timeout** (124 passam) |

### Erros de lint pré-existentes

```
DADOS TSE/carga_amostral.js:48       'count' atribuído mas nunca usado
src/backend/rpc/coalizao.test.ts:13  '_nome' definido mas nunca usado
src/backend/rpc/mandato.test.ts:13   '_nome' definido mas nunca usado
src/backend/rpc/vinculo.test.ts:13   '_nome' definido mas nunca usado
```

Todos `@typescript-eslint/no-unused-vars`. **Já falhavam antes de qualquer
mudança de ambiente.** Precisam ser corrigidos antes do D4.3, senão o CI
nasce vermelho e você aprende a ignorá-lo.

> Nota: como o script é `eslint . && npm run lint --workspace=frontend`, a
> falha no primeiro impede o lint do frontend de rodar. Há possivelmente mais
> erros escondidos atrás desses quatro.

### Testes de integração: 124 passam, 2 falham, 1 suíte estoura timeout

Duração total: **1.310 s** (22 min) — cada asserção faz round-trip até
`sa-east-1` via Management API.

#### ❌ Falha 1 — regressão introduzida pela migration `0023`

```
fn-criar-coalizao.integration.test.ts:114
  expected null to be 28   (row.id_projeto_origem)
```

A migration `0023_coalizao_classificacao_agenda.sql` usou
`CREATE OR REPLACE FUNCTION app.criar_coalizao` e, ao reescrever a função,
**perdeu duas colunas** que a versão de `0016_fn_criar_coalizao.sql` gravava:

| Tabela | Coluna perdida |
| ------ | -------------- |
| `dim_contratante` | `id_partido_relacionado` |
| `dim_coalizao` | `id_projeto_origem` |

```sql
-- 0016 (correto)
INSERT INTO dim_contratante (..., id_partido_relacionado, localizador_legado)
INSERT INTO dim_coalizao (id_contratante, id_projeto_origem, possui_planejamento_proprio)

-- 0023 (atual — as duas colunas sumiram)
INSERT INTO dim_contratante (..., localizador_legado)
INSERT INTO dim_coalizao (id_contratante, possui_planejamento_proprio, classificacao, agenda_tematica)
```

É um bug de código real, corrigido pela migration
`0025_fix_criar_coalizao_colunas_perdidas.sql` (`CREATE OR REPLACE`
restaurando as duas colunas) — nunca por edição da `0023`, que já está
aplicada.

**Impacto em dados: nenhum.** Levantamento das 3 coalizões existentes:

| id | Nome | Criada | Origem |
| -- | ---- | ------ | ------ |
| 103 | FRENTE AMBIENTALISTA | 31/07 | anterior à `0023` |
| 104 | bancada do clima | 31/07 | anterior à `0023` |
| 121 | T19 Seed Coalizão Exemplo | 04/08 | seed, INSERT direto |

As duas de 31/07 são anteriores à regressão e já tinham os campos nulos
porque o chamador não os enviava; a de 04/08 é o seed de teste, que insere por
SQL direto. **Nenhuma coalizão foi criada via `app.criar_coalizao` durante a
janela da regressão** — o bug foi pego antes de causar dano.

#### ❌ Falha 2 — deriva de dados no `ref_cargo`

```
catalogos.integration.test.ts:30
  expected 6 to be greater than or equal to 9
```

A migration `0007_catalogos_fundacao.sql` insere **9 cargos**. O banco de dev
tem **6**. Faltam:

| Cargo ausente | `cd_cargo_tse` |
| ------------- | -------------- |
| `Prefeito(a)` | 11 |
| `Vice-Prefeito(a)` | 12 |
| `Governador(a)` | 3 |

A `0007` foi criada em 30/07 e **nunca foi editada** (`git log` confirma um
único commit, `51e160c`, já contendo as 9 linhas). Logo, as três linhas foram
**apagadas do banco de dev fora de banda** — SQL Editor ou script avulso.

> **Este é o caso de manual do problema que o roadmap ataca.** O
> `migration list` mostra tudo sincronizado, porque DELETE não se registra em
> lugar nenhum. Quando o prod for criado do zero no Dia 2, ele terá 9 cargos
> e o dev terá 6 — os ambientes já nascem divergentes, e este mesmo teste vai
> **passar** contra prod e **falhar** contra dev.

#### ⚠️ Falha 3 — timeout de infraestrutura

```
fundacao-tabelas.integration.test.ts > dim_mandato UNIQUE(id_contratante)
  Error: Hook timed out in 30000ms
```

Não é bug de código: é o `hookTimeout` de 30 s estourando contra a latência da
Management API. Reforça o argumento do **D4.4** — banco efêmero local no
runner elimina essa fragilidade e derruba os 22 minutos para segundos.

---

### ✅ Resolução (04/08/2026, mesmo dia)

| Achado | Correção | Status |
| ------ | -------- | ------ |
| Regressão `app.criar_coalizao` | migration `0025_fix_criar_coalizao_colunas_perdidas.sql` | aplicada no dev, teste T22 passa |
| Deriva `ref_cargo` (6 vs 9) | migration `0026_remove_cargos_nao_utilizados.sql` + teste ajustado para 6 | aplicada no dev, teste T12 passa |
| 4 erros de lint na raiz | `count` morto removido; `argsIgnorePattern: "^_"` no `eslint.config.mjs` | `npx eslint .` limpo |
| Timeout em `fundacao-tabelas` | nenhuma — é latência da Management API | aberto, endereçado pelo D4.4 |

Histórico agora com **26 migrations** sincronizadas local ↔ remoto.

> ⚠️ **Descoberto ao corrigir o lint:** o script era
> `eslint . && npm run lint --workspace=frontend`, então o lint do frontend
> nunca chegava a rodar. Com a raiz limpa ele passou a rodar e revelou
> **35 problemas (15 erros, 20 avisos)**: 13 `no-unused-vars` (imports de
> ícones — trivial), 10 `react-hooks/set-state-in-effect` (exige refatoração
> com risco de comportamento), 4 `no-explicit-any`, 3
> `react-hooks/incompatible-library`.
>
> **Decisão (04/08):** não corrigir agora — as telas envolvidas ainda vão ser
> redesenhadas. Os scripts foram separados para que a dívida fique visível em
> vez de escondida atrás do `&&`:
>
> | Script | Escopo | Estado |
> | ------ | ------ | ------ |
> | `npm run lint` | raiz (`src/backend`, `supabase/tests`) | ✅ verde — obrigatório no CI |
> | `npm run lint:frontend` | `src/frontend` | ❌ 35 problemas — informativo no CI |
> | `npm run lint:all` | ambos | ❌ — usar quando a UI estabilizar |

---

## D1.7 — O que **não** é SQL e não sobe com `db push`

Esta é a lista que o Dia 2 precisa reconfigurar à mão no projeto novo.

### 1. Auth hook — o item crítico
`[auth.hook.custom_access_token] enabled = true` (`config.toml:323`).
Sobe com **`supabase config push`** (D2.4), nunca com `db push`. Sem ele o
JWT sai sem claims e toda a RLS falha em silêncio.

### 2. URLs de redirecionamento
```toml
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000/**",
  "http://192.168.15.9:3000/**",      # IP de LAN — remover em prod
  "https://*-legisla.vercel.app/**"   # previews da Vercel — manter
]
```
O wildcard da Vercel já está lá, o que ajuda no Dia 3. O `site_url` de
produção precisa virar o domínio real.

### 3. Política de senha e cadastro
| Chave | Valor em dev | Consideração para prod |
| ----- | ------------ | ---------------------- |
| `minimum_password_length` | 6 | fraco para produção |
| `password_requirements` | `""` (nenhum) | idem |
| `enable_signup` | `true` | **cadastro aberto a qualquer um** |
| `jwt_expiry` | 3600 | ok |

O `enable_signup = true` merece decisão explícita: o sistema provisiona
usuários por domínio (`app.provisiona_usuario_dominio_legisla`), então
cadastro aberto em produção pode não ser o desejado.

### 4. Proteção contra senha vazada
Desabilitada (apontado pelo advisor). É uma chave do dashboard de Auth, não
SQL. Vale ligar em produção.

### 5. SMTP
Não configurado. Em dev os e-mails caem no Inbucket local; no projeto cloud
o Supabase usa um serviço compartilhado com limite baixo de envio. Para magic
link com usuários reais, precisa de SMTP próprio.

### 6. Sem pendências nestas frentes
- **Edge Functions:** nenhuma (`supabase/functions` não existe)
- **Storage buckets:** nenhum declarado
- **Provedores OAuth externos:** nenhum habilitado
- **SQL avulso sem arquivo:** nenhum conhecido — o caso das tabelas `ref_*`
  foi regularizado em `0024` no dia 04/08

---

## D1.8 — Chaves

Guardar num gerenciador de senhas o conteúdo de `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` do projeto de dev). Serão necessárias no D3.2.

*Tarefa manual — não automatizável.*

---

## Pendências que saem do Dia 1

Os dois bloqueadores do Dia 2 (regressão da `criar_coalizao` e deriva do
`ref_cargo`) foram resolvidos no mesmo dia. **O caminho para o Dia 2 está
livre.** Restam:

1. 🟡 **Resolver os 35 problemas de lint do frontend** antes do D4.3 — 13 são
   imports não usados (triviais), 10 são `set-state-in-effect` (refatoração
   com risco de comportamento)
2. 🟡 **Decidir sobre `enable_signup` em produção** — D2.5
3. 🟢 **Decidir o destino da pasta `Dev Apps\Velhos`** (3,1 GB) — D1.2
4. 🟢 **Guardar as chaves do `.env.local` no gerenciador de senhas** — D1.8
5. 🟢 **Avaliar `REVOKE EXECUTE`** nas funções `SECURITY DEFINER` expostas a
   `anon`, como migration nova
