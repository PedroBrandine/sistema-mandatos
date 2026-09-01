# Fluxo de trabalho

Como uma mudança sai da sua máquina e chega em produção, sem quebrar nada no
caminho.

`docs/ambientes.md` responde "onde ficam as chaves" e "qual é o link". Este
documento responde "o que eu faço agora". Última atualização: 07/08/2026.

---

## O ciclo normal

```
sua máquina  →  develop  →  ambiente de dev  →  PR  →  master  →  produção
                (push)      (Vercel, ~1 min)          (merge)    (Vercel + banco)
```

Só existe um caminho até produção: **merge em `master`**. Não há botão de
deploy, não há upload manual, não há SQL Editor.

### Mudança só de código

```bash
git checkout develop
# ... escreva o código ...
npm run lint            # raiz: src/backend, supabase/tests, scripts
npm run test:unit
git commit && git push
```

Um minuto depois a mudança está em
https://sistema-mandatos-git-develop-legisla.vercel.app. Confira ali antes de
abrir o PR — é para isso que o ambiente de dev existe.

### Mudança de schema

Toda mudança de banco **nasce como arquivo**. Nunca abra o SQL Editor para
escrever.

```bash
supabase migration new nome_da_mudanca     # gera o arquivo com timestamp
# ... escreva o SQL ...

cat supabase/.temp/project-ref             # CONFIRA: tem que ser o de dev
supabase db push                           # aplica em dev
npm run test:integration                   # valida contra o banco de dev
npm run db:types                           # se mudou tabela/coluna/função
```

Depois é o ciclo normal: commit, push, PR, merge. **Você não roda `db push` em
produção** — o `deploy-db.yml` faz isso ao receber o merge em `master`.

> **Numeração:** use `supabase migration new`, que gera
> `20260807143022_nome.sql`. O padrão manual `00NN_` produziu dois `0023` em
> 01/08 e a colisão custou uma reconciliação de histórico. Os 28 arquivos
> antigos ficam como estão — timestamp ordena depois de `0028`, então misturar
> é seguro.

> **Forward-only:** migration aplicada não se edita, nem em dev. Correção é
> arquivo novo. Editar uma já aplicada faz o banco e o histórico contarem
> histórias diferentes, e a divergência só aparece quando alguém reconstrói o
> banco do zero — normalmente em produção.

---

## Checklist de release

Rode antes de abrir o PR para `master`. Leva dois minutos e cobre o que já deu
errado antes.

- [ ] `npm run lint` e `npm run test:unit` passam
- [ ] `npm run test:integration` passa contra o banco de dev
- [ ] Testei a mudança no ambiente de dev, pelo navegador
- [ ] Se mexi em schema: a migration está no PR e **não editei** nenhuma antiga
- [ ] Se mexi em tabela/coluna/função: rodei `npm run db:types` e o `.types.ts` está no PR
- [ ] Nenhuma chave, senha ou token no diff (`git diff origin/master...HEAD`)
- [ ] Se a mudança destrói dados (DROP, DELETE, ALTER … TYPE): tirei dump antes — ver abaixo
- [ ] O CI do PR está verde

Depois do merge:

- [ ] O `deploy-db.yml` terminou verde (aba *Actions*)
- [ ] Abri https://sistema-mandatos.vercel.app e fiz login
- [ ] A tela não mostra o aviso "Ambiente de desenvolvimento" (se mostrar, o
      build de produção pegou as variáveis erradas)

---

## Verificação de deriva

Deriva é o banco e as migrations contarem histórias diferentes. Aconteceu seis
vezes entre 30/07 e 06/08, sempre pela mesma causa: SQL rodado à mão que nunca
virou arquivo. Uma delas derrubou a produção inteira.

| Ferramenta | Pega | Não pega |
| --- | --- | --- |
| `supabase migration list --linked` | migration aplicada por fora que se registrou | SQL avulso no SQL Editor |
| `drift-check.yml` (`db diff`, semanal) | **qualquer** diferença de schema | nada — é a rede de verdade |

`migration list` compara a *tabela de histórico*, não o schema real. É por isso
que ele passou verde durante os seis casos. Se você quiser a checagem completa
sob demanda, dispare o `drift-check.yml` à mão pela aba *Actions* — ele roda o
`db diff` nos dois projetos.

---

## Backup antes de operação arriscada

O `supabase db dump` funciona pela rede, sem Docker e sem a senha do banco (a
CLI cria um papel de login temporário sozinha).

```bash
supabase link --project-ref dgoutrbqfuyaroobhxdq          # prod
supabase db dump --linked -f backup-schema.sql            # estrutura
supabase db dump --linked --data-only --use-copy -f backup-dados.sql
supabase link --project-ref npnvoolkebhabjkjzqwn          # volte para dev
```

> O arquivo de dados contém dados reais de negócio. **Não commite.** Guarde
> fora do repositório e apague quando não precisar mais.

Tire o dump antes de qualquer migration com `DROP`, `DELETE`, `TRUNCATE` ou
`ALTER … TYPE`. Para migrations aditivas (criar tabela, criar índice, adicionar
coluna nullable) não é necessário.

**Pendência consciente:** a política de backup automático do projeto de
produção depende do plano da organização, e ainda não foi conferida no painel
(*Database → Backups*). No plano gratuito não há PITR. Enquanto produção não
tiver dados de negócio, o risco é baixo — quando tiver, isso vira decisão de
custo, não de engenharia.

---

## Quando algo dá errado

**`npm run dev` devolvendo 500 em toda rota dinâmica, com "Jest worker
encountered N child process exceptions, exceeding retry limit".** Não procure
teste nenhum: a suíte aqui é Vitest, o `jest-worker` é uma dependência interna
do Next. O erro quer dizer **"o dev server não consegue mais criar processos
filhos"**, e a causa quase sempre é que o console do terminal que rodou o
`npm run dev` morreu — aba do VS Code fechada, janela recarregada, máquina
suspensa — enquanto o servidor continuou de pé. Em dev o Next dá `fork()` de um
Node novo a cada request de rota dinâmica; herdando um console morto, o filho é
abatido pelo loader do Windows (`0xC0000142`) antes de conseguir escrever
qualquer coisa, e o Next só consegue relatar o exit code. Rotas estáticas
seguem em 200, o que faz o defeito parecer da aplicação.

**Ação: mate o dev server e suba de novo a partir de um terminal vivo.** O
`experimental.workerThreads` ligado em `src/frontend/next.config.ts` (só na fase
de dev) faz esse worker rodar em thread e não em processo, então isto não
deveria voltar a acontecer — se acontecer, é sinal de que o flag saiu do
config. Se depois de reiniciar as rotas passarem a dar **404** em vez de 500,
inclusive rotas estáticas que existem, o cache de dev ficou inconsistente
porque o servidor anterior morreu no meio de uma escrita: `rm -rf
src/frontend/.next` e suba de novo. Investigação completa, com os experimentos
que descartaram memória e `NODE_OPTIONS`, em
`.specs/features/dev-server-rotas-dinamicas-500/`.

**Código quebrado em produção.** Painel da Vercel → *Deployments* → o deploy
anterior → *Promote to Production*. Um clique, segundos. É por isso que o
deploy de código não tem trava.

**Schema errado em produção.** Não existe desfazer. O caminho é **migration
nova, para frente**, que corrige o estado. Foi assim com a `0025` (colunas
perdidas pela `0023`) e com a `0028` (produção 100% fora do ar por falta de um
`GRANT USAGE`). É por isso que o deploy de schema exige CI verde.

**O `deploy-db.yml` falhou.** Leia qual passo:

| Passo que falhou | O que significa |
| --- | --- |
| `Exigir CI verde neste commit` | o CI falhou ou não terminou — **nada foi aplicado** |
| `Descobrir URL IPv4 do banco` | não chegou ao banco — a própria mensagem de erro diz se é senha, pooler errado ou rede. **Nada foi aplicado** |
| `Aplicar migrations` | o `db push` quebrou; o banco pode estar parcialmente aplicado — leia o log antes de repetir |
| `Aplicar configuração de auth` | migrations entraram, `config.toml` não |

O último passo, `Auditoria de segurança`, **lista mas não bloqueia**. Ele
imprime 4 alertas `ERROR` esperados — `rls_disabled_in_public` em `ref_cargo`,
`ref_partido`, `ref_produto` e `ref_projeto`, catálogos de referência onde a
migration `0024` desligou RLS de propósito. Se aparecer um quinto, é novo e
merece atenção.

O CI conecta no banco pelo **pooler**, não pelo host direto: `db.<ref>.supabase.co`
resolve só em IPv6 e runners do GitHub não têm IPv6. Na sua máquina o
`--linked` funciona normal. Detalhes em `docs/ambientes.md`.

---

## Dívidas técnicas conscientes

Não são esquecimento — são escolhas registradas, com o custo conhecido.

**Docker não instalado.** A máquina tem 11,8 GB de RAM com ~90% de commit em
uso. Sem Docker não existe `supabase db reset` local nem `db diff` na sua
máquina. O CI cobre os dois: o job `integracao` reconstrói o banco do zero a
cada PR, e o `drift-check.yml` roda o `db diff` semanalmente. Se a máquina
ganhar RAM, instalar o Docker devolve o ciclo de segundos em vez de minutos.

**35 problemas de lint no frontend.** O job `lint-frontend` os mostra a cada PR
mas não bloqueia (`continue-on-error`), porque as telas ainda vão ser
redesenhadas. Quando a UI estabilizar, remova o `continue-on-error`.

**Nenhuma trava nativa do GitHub.** Proteção de branch, rulesets, revisor
obrigatório e temporizador são todos pagos em repositório privado. No lugar
deles: o hook `.githooks/pre-push` (contra o acidente local) e o job
`aguardar-ci` do `deploy-db.yml` (no servidor, contra o irreversível). Detalhes
em `docs/ambientes.md`.
