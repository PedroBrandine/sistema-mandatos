# Ambientes — Produção e Desenvolvimento

Referência operacional. Se você só precisa saber "qual é o link", "onde ficam
as chaves" ou "como subo uma mudança", está tudo aqui.

Última atualização: 06/08/2026.

---

## Os dois ambientes

| | Desenvolvimento | Produção |
| --- | --- | --- |
| **URL** | https://sistema-mandatos-dev.vercel.app | https://sistema-mandatos.vercel.app |
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
`sb_secret_…`). As chaves legadas em formato JWT (`eyJhbGci…`) não são mais
usadas em lugar nenhum e **devem ser desativadas** no dashboard de cada
projeto: *Settings → API Keys → Legacy API Keys → Disable*.

Isso é importante porque uma `service_role` legada do projeto de dev ficou
commitada no repositório entre 31/07 e 06/08 (commit `33e4bc9`). O arquivo foi
corrigido, mas o histórico do git preserva a chave — só a desativação a torna
inofensiva.

---

## Como subir uma mudança

### De código

```bash
git checkout develop
# ... suas mudanças ...
git push
npx vercel deploy                                    # gera o preview
npx vercel alias set <url-do-preview> sistema-mandatos-dev.vercel.app
```

Para produção, faça merge em `master` e rode `npx vercel deploy --prod`.

> ⚠️ A integração com o Git da Vercel **não** está criando deploys
> automáticos para branches que não sejam a de produção. Por isso o passo
> manual acima. Configurar isso em *Settings → Git* eliminaria os dois últimos
> comandos.

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
- **CI/CD não existe** (`.github/` ausente) — Dias 4 e 5 do roadmap.
- **Docker não instalado**, por decisão consciente (a máquina tem 11,8 GB de
  RAM e ~90% de commit em uso). Consequência: sem `supabase db reset` local e
  sem `db diff` para detectar deriva. Ver `docs/roadmap-ambientes-prod-dev.md`.
