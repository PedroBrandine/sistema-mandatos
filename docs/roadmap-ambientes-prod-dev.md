# Roadmap — Separação de ambientes Produção / Desenvolvimento

Plano de 5 dias para o Sistema Mandatos sair de **um único ambiente** para
**produção e desenvolvimento separados**, com deploy e migrations
automatizados.

Estimativa: 2 a 5 horas por dia. Ritmo pensado para aprender fazendo, não
para executar às cegas.

> **Checklist para o Notion:** `docs/checklist-ambientes-notion.md`. Os IDs
> (`D1.1`, `D2.4`, …) são os mesmos nos dois arquivos — use o checklist para
> marcar progresso e este documento para o detalhe de cada passo.

---

## Ponto de partida (04/08/2026)

| Peça | Situação hoje |
| ---- | ------------- |
| Supabase | 1 projeto cloud: `sistema-mandatos-dev` (`npnvoolkebhabjkjzqwn`), região `sa-east-1` |
| Migrations | 24 arquivos, histórico local ↔ remoto sincronizado e limpo |
| Vercel | 1 projeto: `sistema-mandatos` (`prj_Y5qWAjvq9XNRJz3DkhQL3Cy62Uqd`) |
| GitHub | `PedroBrandine/sistema-mandatos`, branch `master` |
| CI/CD | Nenhum (`.github/` não existe) |
| Máquina | 11,8 GB RAM (684 MB disponíveis), C: com 16,8 GB livres de 237 GB |
| Docker | **Não instalado e não previsto** — ver decisão abaixo |
| Segredos | Nenhum `.env` real jamais commitado (só `.env.example`) ✅ |

### Premissa central

O projeto atual chama-se `sistema-mandatos-dev` e contém dados de teste
(`supabase/seed_test.sql`). O plano assume que **ele continua sendo o
ambiente de desenvolvimento** e que **produção nasce como um projeto novo e
vazio**, construído exclusivamente a partir das migrations.

Isso tem uma vantagem que vai além da organização: construir produção do zero
**prova** que as 24 migrations reproduzem o schema inteiro.

> ⚠️ **Se o projeto atual já tiver dados reais em uso**, o plano inverte: o
> atual vira produção e o projeto novo vira dev. O Dia 2 muda; os outros
> quatro dias continuam válidos.

### Decisão: sem Docker nesta máquina

A máquina tem 11,8 GB de RAM com **684 MB disponíveis** e 20,8 GB de 23,6 GB
de commit em uso — ela já pagina pesado sem Docker nenhum. O stack local do
Supabase (~14 containers) pediria mais 3–4 GB de RAM e ~10 GB de disco.

**Consequência para o plano:** o desenvolvimento continua contra o projeto
cloud de dev, como já é hoje. O que se perde é o banco descartável na sua
mesa. O que **não** se perde — `db reset` provando as migrations do zero,
`db diff` detectando deriva, banco efêmero por PR — migra para o **Dia 4**,
porque os runners do GitHub Actions têm Docker. A rede de segurança sai do
seu notebook e vira automação, que é onde ela funciona melhor de qualquer
forma.

---

## Dia 1 — Preparar o terreno e travar a linha de base

**Objetivo:** liberar espaço, registrar como o ambiente atual se comporta
hoje, e levantar tudo que **não é SQL** e vai precisar ser reconfigurado à
mão no projeto de produção.

Sem um banco local para experimentar, o Dia 2 acontece direto no cloud. Este
dia existe para que ele não te pegue de surpresa.

### Passos

**D1.1** — Liberar espaço em disco. Alvos medidos, todos regeneráveis:

| Alvo | Tamanho |
| ---- | ------- |
| `%LOCALAPPDATA%\Temp` | 8,1 GB |
| `%LOCALAPPDATA%\npm-cache` (`npm cache clean --force`) | 3,9 GB |
| `src/frontend/.next` | 1,2 GB |
| `%LOCALAPPDATA%\pip\Cache` | 1,2 GB |
| `C:\Windows\SoftwareDistribution\Download` + `C:\Windows\Temp` | 0,6 GB |

Meta: sair de 16,8 GB livres para ~30 GB.

**D1.2** — Decidir o destino da pasta `Desktop\Dev Apps\Velhos` (3,1 GB, dos
quais 3,17 GB são `node_modules`/`.next` de projetos antigos). Apagar só os
`node_modules` já devolve quase tudo sem perder código.

**D1.3** — Conferir a folga da máquina depois da limpeza:
```powershell
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select DeviceID, FreeSpace
(Get-CimInstance Win32_PerfRawData_PerfOS_Memory).AvailableMBytes
```

**D1.4** — Travar a linha de base das migrations:
```bash
supabase migration list --linked
```
Esperado: 24 linhas com `local` e `remote` preenchidos, sem órfãs.

**D1.5** — Rodar o auditor no dev e **guardar a saída**:
```bash
supabase db advisors --linked
```
Ela vira o gabarito de comparação no D2.7 — o prod deve acusar os mesmos
avisos que o dev, nem mais nem menos.

**D1.6** — Rodar e registrar o que passa hoje:
```bash
npm run lint
npm run test:unit
npm run test:integration
```
Se algo já falha antes da separação, você precisa saber agora — senão vai
culpar o ambiente novo depois.

**D1.7** — **O passo que substitui a validação local.** Levantar tudo que
existe no projeto de dev e **não** está nas migrations, porque nada disso
sobe com `db push`:
- `[auth.hook.custom_access_token]` — está em `config.toml`, sobe com
  `config push` (D2.4)
- `site_url` e `additional_redirect_urls` — hoje apontam para
  `localhost:3000` e para o IP de LAN `192.168.15.9`
- Configuração de SMTP
- Qualquer coisa rodada no SQL Editor que nunca virou arquivo (foi assim que
  o `DISABLE ROW LEVEL SECURITY` das tabelas `ref_*` ficou sem registro até
  04/08)

**D1.8** — Guardar as chaves do projeto de dev (`.env.local`) num gerenciador
de senhas. No Dia 3 você vai precisar delas para preencher a Vercel.

### Entregável
Disco com folga, linha de base registrada, e a lista do que não é SQL.

### Como saber que deu certo
D1.4 mostra as 24 migrations sincronizadas, e você tem por escrito a saída de
D1.5 e a lista de D1.7.

### Armadilha
A tentação é pular este dia por parecer burocrático. Ele é o seguro contra o
Dia 2: cada item do D1.7 que passar despercebido vira uma diferença silenciosa
entre dev e produção.

---

## Dia 2 — Criar o projeto de produção

**Objetivo:** provisionar `sistema-mandatos-prod` vazio, com o schema
completo e a configuração de auth correta.

Sem banco local, **este é o momento em que as 24 migrations são testadas do
zero pela primeira vez**. O projeto está vazio: se der errado, você deleta e
recria sem perder nada.

### Passos

**D2.1** — Criar o projeto no dashboard do Supabase:
- Nome: `sistema-mandatos-prod`
- Região: `sa-east-1` (a mesma do dev — latência e consistência)

**D2.2** — **Senha do banco: gere forte e guarde num gerenciador de senhas.**
Ela não é recuperável, só resetável.

**D2.3** — Linkar e aplicar o schema:
```bash
supabase link --project-ref <ref-do-prod>
supabase db push
```
As 24 migrations rodam do zero, em ordem. Qualquer erro aqui é uma migration
que depende de algo que não está versionado — anote e corrija com um arquivo
novo, nunca editando migration já aplicada.

**D2.4** — **Sincronizar a configuração do projeto** (o passo que quase todo
mundo esquece):
```bash
supabase config push
```
É isto que ativa `[auth.hook.custom_access_token]` no projeto remoto. Sem
ele o JWT sai sem os claims e **toda a RLS falha silenciosamente** — o
usuário loga e não enxerga nada.

**D2.5** — Ajustar os valores específicos de produção levantados em D1.7:
- `site_url` → seu domínio real (hoje está `http://localhost:3000`)
- `additional_redirect_urls` → remover o IP de LAN `192.168.15.9`

**D2.6** — Configurar SMTP real, se for enviar magic link para usuários de
verdade.

**D2.7** — Rodar o auditor e **comparar com o gabarito de D1.5**:
```bash
supabase db advisors --linked
```

**D2.8** — Confirmar o histórico:
```bash
supabase migration list --linked
```

**D2.9** — Testar o login ponta a ponta no prod, com um usuário de verdade.
É o único jeito de confirmar que o D2.4 pegou.

**D2.10** — Voltar o link para o dev:
```bash
supabase link --project-ref npnvoolkebhabjkjzqwn
```

> **Não** rodar `seed_test.sql` em produção. Ela nasce vazia.

### Entregável
Projeto de produção provisionado, schema idêntico ao dev, sem dados.

### Como saber que deu certo
D2.8 mostra as 24 com `local` e `remote` preenchidos, D2.7 bate com o
gabarito de D1.5, e em D2.9 o usuário loga **e enxerga dados** (se enxergar
tela vazia, o D2.4 falhou).

### Armadilha
O plano gratuito do Supabase permite **2 projetos ativos**. Com dev + prod
você fecha a cota — não sobra slot para staging. Como não há Supabase local
nesta máquina, o projeto de dev acumula os dois papéis: é onde você
desenvolve e é onde você testa antes de promover. Trate-o com mais cuidado do
que um dev descartável mereceria.

---

## Dia 3 — Vercel com ambientes separados

**Objetivo:** cada branch deployar contra o banco certo, automaticamente.

A Vercel já tem três ambientes nativos — você não cria nada, só preenche
valores diferentes em cada um.

### Passos

**D3.1 / D3.2** — Em **Settings → Environment Variables**, cadastrar as
mesmas três chaves com valores diferentes por ambiente:

| Variável | Production (D3.1) | Preview / Development (D3.2) |
| -------- | ----------------- | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | dev |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | dev |

**D3.3** — Conferir que `SUPABASE_SERVICE_ROLE_KEY` **nunca** tem prefixo
`NEXT_PUBLIC_` — isso a colocaria no bundle do cliente (AD-009 no
`.env.example`).

**D3.4** — Em **Settings → Git**, confirmar `master` como Production Branch.

**D3.5** — Criar a branch de trabalho:
```bash
git checkout -b develop && git push -u origin develop
```
Toda branch que não seja `master` gera um Preview automático apontando para
o dev.

**D3.6** — Conferir o **Root Directory** do projeto na Vercel. O repo é um
monorepo com npm workspaces e o Next fica em `src/frontend` — se o build
quebrar, é aqui.

**D3.7** — Abrir um PR de teste e validar que a URL de preview sobe e
conversa com o banco de dev.

### Entregável
`master` → produção contra banco de produção. Qualquer outra branch →
preview contra banco de dev.

### Como saber que deu certo
No deploy de preview, o app lê os dados de teste do seed. No de produção, o
app sobe vazio (sem dados) e sem erro.

---

## Dia 4 — CI/CD no GitHub Actions

**Objetivo:** nada entra em produção sem passar por teste, migration vai para
o banco sozinha, **e o que a máquina local não consegue fazer passa a ser
feito aqui.**

Este dia ficou mais importante por causa da decisão de não usar Docker. Os
runners do GitHub Actions são Ubuntu **com Docker instalado**, então tudo que
o seu notebook não aguenta roda aqui de graça — e roda automaticamente, sem
depender de você lembrar.

### Passos

**D4.1** — Gerar um token de acesso do Supabase (Dashboard → Account →
Access Tokens).

**D4.2** — Cadastrar em **GitHub → Settings → Secrets and variables →
Actions**:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD_PROD`
- `SUPABASE_PROJECT_REF_PROD` e `SUPABASE_PROJECT_REF_DEV`

**D4.3** — Criar `.github/workflows/ci.yml` — roda em todo PR:
```
npm ci → npm run lint → npm run test:unit
```

**D4.4** — **O substituto do `db reset` local.** No mesmo workflow, um job
que sobe o Supabase dentro do runner:
```
supabase start
supabase db reset          # prova que as 24 migrations sobem do zero
supabase db query --local --file supabase/seed_test.sql
npm run test:integration   # contra o banco efêmero, não contra o dev
```
Isso resolve de uma vez a validação que você perdeu no Dia 1 **e** a
concorrência entre PRs disputando o banco de dev. Vai exigir apontar
`supabase/tests/helpers/sql.ts` para `--local` quando rodar em CI.

**D4.5** — Criar `.github/workflows/deploy-db.yml` — roda ao mergear em
`master`:
```
supabase link --project-ref $SUPABASE_PROJECT_REF_PROD
supabase db push
```

**D4.6** — **O substituto do `db diff` local.** Um workflow agendado
(semanal) que compara o schema real dos dois projetos com o que as migrations
produzem:
```
supabase db diff --linked      # com o link apontando para dev, depois prod
```
É a única verificação que pega mudança feita no SQL Editor — o
`migration list` é cego para ela, porque SQL avulso não se registra em lugar
nenhum.

**D4.7** — Proteger a branch `master`: exigir PR e CI verde antes do merge.

**D4.8** — Validar o ciclo completo com um PR que contenha uma migration
nova.

### Entregável
Pipeline rodando: migrations validadas do zero a cada PR, deriva detectada
semanalmente, e promoção para produção por merge.

### Como saber que deu certo
Em D4.8, o PR falha se o teste quebrar, e aplica sozinho no prod ao ser
mergeado. E o workflow de D4.6 roda sem acusar diferença.

### Armadilha
`supabase db diff` no CI precisa da senha do banco de cada projeto, não só do
access token. Se o D4.6 falhar com erro de conexão, é isso.

---

## Dia 5 — Blindagem e disciplina de processo

**Objetivo:** garantir que a separação não se desfaça sozinha em duas semanas.

### Passos

**D5.1** — **Backups**: conferir a política de backup do projeto de produção.
No plano free são backups diários com retenção curta; PITR é pago. Decida
conscientemente o que você aceita perder.

**D5.2** — **Fechar o caminho paralelo.** A deriva encontrada em 01/08
aconteceu porque havia duas rotas para alterar o banco: arquivos de migration
e o SQL Editor. Regra a registrar no `CLAUDE.md`:
> Toda mudança de schema nasce como arquivo em `supabase/migrations/` e
> chega ao banco por `supabase db push`. O SQL Editor é somente leitura.

Sem `db diff` rodando na sua máquina, esta regra deixa de ser boa prática e
vira a sua principal defesa — o D4.6 só avisa depois do fato, e uma vez por
semana.

**D5.3** — **Verificação manual de deriva**, o que dá para fazer sem Docker:
```bash
supabase migration list --linked
```
Ele compara a **tabela de histórico**, não o schema real. Pega migration
aplicada por fora que se registrou; **não pega** SQL rodado no SQL Editor.
Para esse segundo caso, dependa do D4.6.

**D5.4** — **Numeração de migrations**: adotar o padrão de timestamp do CLI
(`supabase migration new <nome>`) em vez de `00NN` manual. Foi a numeração
manual que produziu a colisão dos dois `0023`.

**D5.5** — **Documentar o fluxo** num `docs/fluxo-de-trabalho.md`: como criar
migration, como testar, como promover para produção.

**D5.6** — **Checklist de release** curto, para usar em toda subida a
produção.

**D5.7** — **Reavaliar o Docker.** Se um dia a máquina ganhar RAM, o Dia 1
original volta a valer e você recupera o banco descartável local. Anote isso
como dívida técnica consciente, não como esquecimento.

### Entregável
Runbook escrito e regra de processo registrada no `CLAUDE.md`.

---

## Resumo

| Dia | Foco | IDs | Entregável |
| --- | ---- | --- | ---------- |
| 1 | Preparar terreno + linha de base | D1.1–D1.8 | Disco livre e o que não é SQL levantado |
| 2 | Projeto de produção | D2.1–D2.10 | Prod provisionado, vazio, auth configurada |
| 3 | Vercel multi-ambiente | D3.1–D3.7 | Deploy correto por branch |
| 4 | GitHub Actions | D4.1–D4.8 | CI valida do zero, detecta deriva e promove |
| 5 | Blindagem | D5.1–D5.7 | Backups, regra de processo, runbook |

### Os três erros que mais custam caro

1. **Pular o D2.4 (`supabase config push`).** O auth hook não é SQL. Sem ele
   a RLS falha em silêncio — o usuário loga e não vê nada, e você vai
   procurar o bug no lugar errado por horas.
2. **Continuar usando o SQL Editor depois do D5.2.** É o que gera a deriva
   que só aparece quando você cria o próximo ambiente — e, sem Docker local,
   você só descobre no workflow semanal do D4.6.
3. **Tratar migration como reversível depois que produção existir.** A partir
   do D2.3, nada de editar migration já aplicada: toda correção é um arquivo
   novo, para frente.
