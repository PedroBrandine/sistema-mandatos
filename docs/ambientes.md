# Ambientes — Produção e Desenvolvimento

Referência operacional. Se você só precisa saber "qual é o link", "onde ficam
as chaves" ou "como subo uma mudança", está tudo aqui.

Última atualização: 06/08/2026.

---

## Os dois ambientes

| | Desenvolvimento | Produção |
| --- | --- | --- |
| **URL** | https://sistema-mandatos-git-develop-legisla.vercel.app | https://sistema-mandatos.vercel.app |
| **Projeto Supabase** | `sistema-mandatos-dev` | `sistema-mandatos-prod` |
| **Ref** | `npnvoolkebhabjkjzqwn` | `dgoutrbqfuyaroobhxdq` |
| **Região** | `sa-east-1` | `sa-east-1` |
| **Ambiente Vercel** | Preview + Development | Production |
| **Branch** | `develop` (e qualquer outra) | `master` |
| **Migrations** | 28/28 | 28/28 |
| **Usuários** | 34 contas / 51 perfis | 34 contas / 52 perfis |
| **Dados de negócio** | dados de teste | **vazio** |

Aliases adicionais de produção: `sistema-mandatos-legisla.vercel.app` e
`sistema-mandatos-git-master-legisla.vercel.app`.

> ⚠️ Existe também um alias `sistema-mandatos-dev.vercel.app`, criado à mão
> antes do deploy automático funcionar. Ele **não se atualiza sozinho** — vai
> mostrar um build velho. Não use; prefira o `git-develop-legisla` da tabela
> acima, que a Vercel mantém apontando para o último push da branch.
>
> Os aliases `*-git-<branch>-legisla.vercel.app` **não aparecem** em
> *Settings → Domains* do painel: aquela tela só lista domínios atribuídos
> explicitamente. Os aliases de branch são automáticos e ficam junto de cada
> build, na aba *Deployments*. Não se assuste ao ver só um domínio lá.

---

## Onde ficam as chaves

Regra: **as chaves de produção nunca ficam na sua máquina.** Se não estão no
seu `.env.local`, é impossível apontar o `npm run dev` para produção por
engano.

| Destino | Conteúdo | Aponta para |
| ------- | -------- | ----------- |
| `.env.local` (raiz) | usado pelos testes de integração e pelos scripts | **dev** |
| `src/frontend/.env.local` | usado pelo Next.js local | **dev** |
| Vercel → **Production** | 3 variáveis | **prod** |
| Vercel → **Preview** | 3 variáveis | **dev** |
| Vercel → **Development** | 3 variáveis | **dev** |
| Gerenciador de senhas | senhas do banco + chaves `secret` | ambos |
| Repositório | **nada** além do `.env.example` (só nomes) | — |

As três variáveis em cada lugar são sempre as mesmas:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY`.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` **nunca** com prefixo `NEXT_PUBLIC_` — isso a
> mandaria para o bundle do navegador. Ela ignora RLS por completo.

### Formato das chaves

O projeto usa o **formato novo** do Supabase (`sb_publishable_…` e
`sb_secret_…`). As chaves legadas em formato JWT (`eyJhbGci…`) foram
**desativadas nos dois projetos** em 06/08/2026 — verificado: respondem 401.

Isso importava porque uma `service_role` legada do projeto de dev ficou
commitada no repositório entre 31/07 e 06/08 (commit `33e4bc9`). O arquivo foi
corrigido, mas o histórico do git preserva a chave; a desativação é o que a
tornou inofensiva.

Se algum dia precisar reativá-las, o caminho é *Settings → API Keys → Legacy
API Keys* — uma seção separada da lista de chaves novas.

---

## Como subir uma mudança

### De código

O deploy é **automático** — a Vercel está conectada ao repositório GitHub.

```bash
git checkout develop
# ... suas mudanças ...
git push          # ~1 min depois, o ambiente de dev já reflete a mudança
```

Para produção, faça merge em `master` e dê push. A Vercel publica sozinha, e
o workflow `deploy-db.yml` aplica as migrations no banco de produção.

| Push em | Publica em | Banco |
| ------- | ---------- | ----- |
| `develop` (ou qualquer branch) | `…-git-<branch>-legisla.vercel.app` | dev |
| `master` | `sistema-mandatos.vercel.app` | prod |

> ⚠️ **Todo push em `master` vai direto para produção.** É por isso que a
> proteção de branch (PR obrigatório + CI verde) deixou de ser opcional.

### De schema (migrations)

Toda mudança de banco nasce como arquivo e chega ao banco por `db push` —
nunca pelo SQL Editor.

```bash
supabase migration new <nome>                        # cria o arquivo
# ... escreva o SQL ...

supabase link --project-ref npnvoolkebhabjkjzqwn     # dev
supabase db push

supabase link --project-ref dgoutrbqfuyaroobhxdq     # prod
supabase db push

supabase link --project-ref npnvoolkebhabjkjzqwn     # volte para o dev
```

### De configuração de auth

`supabase/config.toml` é um arquivo só para os dois projetos, então o
`site_url` vem de variável de ambiente:

```bash
# dev
SUPABASE_AUTH_SITE_URL=http://localhost:3000 supabase config push

# prod
SUPABASE_AUTH_SITE_URL=https://sistema-mandatos.vercel.app supabase config push
```

Se a variável não estiver definida, o push grava `site_url` vazio e os
redirecionamentos de auth quebram.

---

---

## CI/CD (GitHub Actions)

Três workflows em `.github/workflows/`:

| Workflow | Quando roda | O que faz |
| -------- | ----------- | --------- |
| `ci.yml` | todo PR e push em `master`/`develop` | lint da raiz + 91 testes unitários; sobe um **Supabase efêmero** no runner, aplica as migrations do zero e roda os testes de integração contra ele; lint do frontend como job informativo |
| `deploy-db.yml` | push em `master` que toque `supabase/**` | `db push` + `config push` no projeto de produção, e auditoria de segurança depois |
| `drift-check.yml` | segundas, 11h17 UTC (e sob demanda) | `db diff` nos dois projetos — **falha se o banco não bater com as migrations** |

O `ci.yml` **não usa secret nenhum** (o banco é local ao runner). Os outros
dois dependem de três secrets já cadastrados no repositório:
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_PROD` e
`SUPABASE_DB_PASSWORD_DEV`.

### Por que o job de banco efêmero importa

Ele é a única coisa que prova que as migrations reconstroem o banco **do
zero** — validação que a máquina de desenvolvimento não consegue fazer por
não ter Docker. Foi exatamente esse tipo de falha que derrubou o primeiro
`db push` em produção (a `0001` criava uma política antes das funções que ela
referencia). Com esse job, isso apareceria num PR.

O `drift-check.yml` cobre o outro flanco: `supabase migration list` compara a
tabela de histórico, não o schema, e é **cego** para SQL rodado à mão no
editor. Só o `db diff` pega.

### Rodando os testes de integração localmente

Na sua máquina eles batem no projeto cloud de dev (padrão). Em CI, a variável
`SUPABASE_TEST_TARGET=local` faz `supabase/tests/helpers/sql.ts` apontar para
o banco do runner.

---

## Proteção da branch de produção

`master` publica em produção no instante em que recebe um commit, e dispara o
`deploy-db.yml`. Não há confirmação nem desfazer.

A trava correta seria a **proteção de branch do GitHub**, mas ela é recurso
pago em repositório privado — testado em 06/08/2026, tanto a proteção clássica
quanto os *rulesets* retornam `403 Upgrade to GitHub Pro`. As duas saídas
oficiais seriam assinar o GitHub Pro (~US$ 4/mês) ou tornar o repositório
público (inviável: o histórico contém uma `service_role` antiga).

Na falta disso, existe um **git hook** em `.githooks/pre-push` que recusa push
direto em `master`. Ele precisa ser habilitado uma vez por clone:

```bash
git config core.hooksPath .githooks
```

**Limites, que importam:** vale só na máquina onde foi habilitado, e
`git push --no-verify` passa por cima. Ele impede o acidente, não o ato
deliberado — e o acidente é o risco real aqui.

### A trava que roda no servidor

O hook não cobre merge feito pela interface do GitHub, nem outra máquina. Para
o que é irreversível — migrations no banco de produção — existe uma segunda
camada, esta **no servidor**: o job `aguardar-ci` do `deploy-db.yml` consulta
os check runs do commit e **se recusa a aplicar migrations se o CI não tiver
passado**.

| | Deploy de código | Deploy de schema |
| --- | --- | --- |
| Onde | Vercel | `deploy-db.yml` |
| Gatilho | push em `master` | push em `master` que toque `supabase/**` |
| Trava | nenhuma | **exige CI verde** |
| Reversível? | sim — rollback instantâneo na Vercel | **não** |

A assimetria é proposital. Publicar código quebrado é chato e se desfaz em um
clique; aplicar migration errada em produção não se desfaz. A trava está onde
o dano é permanente.

Execução manual pela aba *Actions* (`workflow_dispatch`) pula a verificação —
clicar no botão já é ato deliberado.

Testado em 07/08/2026: além de branch protection e rulesets, **revisor
obrigatório e temporizador de environment também são recusados por plano**
(`422`). Nenhuma trava nativa do GitHub está disponível neste repositório.

O caminho correto para levar código a produção continua sendo o Pull Request:

```bash
git push origin <sua-branch>
gh pr create --base master
```

---

## Regras que evitam acidente

1. **Confira o link antes de qualquer escrita.** `supabase db push`,
   `config push` e principalmente `db reset` agem sobre o projeto linkado
   naquele momento:
   ```bash
   cat supabase/.temp/project-ref
   supabase projects list        # olhe a coluna linked
   ```
2. **Migration aplicada não se edita.** Toda correção é arquivo novo, para
   frente. Houve uma exceção documentada (a `0001`, que não conseguia
   reconstruir o banco do zero) — foi exceção, não precedente.
3. **SQL Editor é somente leitura.** Quatro divergências entre dev e prod
   nasceram de SQL rodado à mão que nunca virou arquivo. Todas custaram
   tempo, e uma delas derrubou a produção inteira.
4. **Produção não recebe seed.** `supabase/seed_test.sql` é só para dev.

---

## Estado conhecido e pendências

- **`enable_signup = true`** nos dois ambientes: qualquer pessoa cria conta.
  Como os usuários são provisionados por script, isso provavelmente deveria
  ser desligado.
- **`enable_confirmations = true`** sem SMTP próprio: quem se cadastrar
  depende do serviço compartilhado do Supabase, que tem limite baixo.
- **Usuário `admin` inativo** (`sistema@legislabrasil.org.br`, `ativo = false`)
  nos dois ambientes. Como `app.pre_request` exige `ativo = true`, não há
  papel de admin funcionando hoje.
- **Dois perfis de teste** (`@legislabrasil.test`) foram junto na importação de
  usuários para produção. Não têm conta de login.
- **Produção sem dados de negócio**: os 34 usuários entram, mas não há
  contratantes, mandatos nem contratos. Os vínculos `rel_usuario_contrato` não
  foram copiados porque apontam para contratos inexistentes lá.
- **`master` sem proteção de branch**: qualquer push vai direto para
  produção. Falta exigir PR e CI verde (D4.7).
- **Dia 5 não iniciado**: backups, regra de processo no `CLAUDE.md`,
  `docs/fluxo-de-trabalho.md` e checklist de release.
- **Docker não instalado**, por decisão consciente (a máquina tem 11,8 GB de
  RAM e ~90% de commit em uso). Consequência: sem `supabase db reset` local e
  sem `db diff` para detectar deriva. Ver `docs/roadmap-ambientes-prod-dev.md`.
