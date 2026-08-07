# Separação Prod / Dev — Checklist

Cole este conteúdo direto no Notion: ele converte `- [ ]` em blocos to-do
automaticamente. Cada item tem um ID (`D1.1`) que corresponde ao mesmo ID em
`docs/roadmap-ambientes-prod-dev.md`, onde está o detalhe, os comandos e as
armadilhas.

> **Decisão que molda este plano:** esta máquina não comporta o Docker
> (11,8 GB de RAM com 684 MB disponíveis). O desenvolvimento continua contra
> o projeto cloud de dev, e tudo que exigiria Docker foi movido para o Dia 4,
> onde roda nos servidores do GitHub.
>
> **Status em 06/08/2026:** Dias 1 e 2 concluídos, Dia 3 quase. Os dois
> ambientes estão no ar — https://sistema-mandatos.vercel.app (prod) e
> https://sistema-mandatos-dev.vercel.app (dev). Detalhes operacionais em
> `docs/ambientes.md`.

## Dia 1 — Preparar o terreno e travar a linha de base

> **Em palavras simples:** é o dia de arrumar a casa antes da mudança. Primeiro
> você joga fora o entulho para caber tudo. Depois anota num papel como as
> coisas estão funcionando hoje — e principalmente faz a lista do que **não**
> vai dentro das caixas, porque vai precisar ser instalado à mão na casa nova.

- [x] **D1.1** Liberar espaço em disco: Temp (8,1 GB), npm-cache (3,9 GB), `.next` (1,2 GB), pip cache (1,2 GB), Windows Update (0,6 GB) — meta: ~30 GB livres
- [ ] **D1.2** *(adiado por decisão — fica como está)* Decidir o destino da pasta `Dev Apps\Velhos` (3,1 GB, quase tudo `node_modules` de projetos antigos)
- [x] **D1.3** Conferir a folga da máquina depois da limpeza (disco livre e RAM disponível)
- [x] **D1.4** Travar a linha de base: `supabase migration list --linked` deve mostrar todas as migrations sincronizadas
- [x] **D1.5** Rodar `supabase db advisors --linked` no dev e **guardar a saída** como gabarito para o D2.7
- [x] **D1.6** Rodar `npm run lint`, `test:unit` e `test:integration` e registrar o que passa hoje
- [x] **D1.7** Levantar tudo que **não é SQL** e não sobe com `db push`: auth hook, `site_url`, redirect URLs, SMTP, e SQL avulso rodado no Editor
- [x] **D1.8** Guardar as chaves do `.env.local` de dev num gerenciador de senhas (serão usadas no Dia 3)

## Dia 2 — Criar o projeto de produção

> **Em palavras simples:** "produção" é a loja de verdade, onde os clientes de
> verdade entram. Até hoje você tinha uma sala só, e usava ela para testar e
> para receber visita ao mesmo tempo. Hoje você constrói a segunda sala,
> limpa e vazia — e é aqui que o manual de montagem é testado pela primeira
> vez de verdade. Se der errado, é só jogar a sala fora e começar de novo:
> ela ainda está vazia.

- [x] **D2.1** Criar o projeto `sistema-mandatos-prod` no Supabase, região `sa-east-1`
- [x] **D2.2** Guardar a senha do banco num gerenciador de senhas (não é recuperável)
- [x] **D2.3** Rodar `supabase link --project-ref <ref-prod>` e `supabase db push` — todas as migrations do zero
- [x] **D2.4** Rodar `supabase config push` para ativar o `custom_access_token` hook
- [x] **D2.5** Ajustar `site_url` e `additional_redirect_urls` para o domínio real (remover o IP de LAN)
- [x] **D2.6** ~~Configurar SMTP~~ — **cancelado**: o app usa apenas `signInWithPassword`, não há magic link
- [x] **D2.7** Rodar `supabase db advisors --linked` e comparar com o gabarito do D1.5
- [x] **D2.8** Confirmar `supabase migration list --linked` com todas as linhas local ↔ remote
- [ ] **D2.9** Testar o login ponta a ponta no prod — se logar e a tela vier vazia, o D2.4 falhou
- [x] **D2.10** Voltar o link para o projeto de dev (`npnvoolkebhabjkjzqwn`)

## Dia 3 — Vercel com ambientes separados

> **Em palavras simples:** a Vercel é quem coloca o site no ar. Imagine duas
> portas com plaquinhas: a da frente leva à loja de verdade, e a de trás leva
> a uma cópia de teste que só você usa. Hoje você ensina o sistema qual porta
> leva a qual sala — assim um teste seu nunca aparece por engano na loja de
> verdade.

- [x] **D3.1** Cadastrar as 3 variáveis no ambiente **Production** com as chaves de prod
- [x] **D3.2** Cadastrar as 3 variáveis em **Preview** e **Development** com as chaves de dev
- [x] **D3.3** Conferir que `SUPABASE_SERVICE_ROLE_KEY` não tem prefixo `NEXT_PUBLIC_`
- [x] **D3.4** Confirmar `master` como Production Branch em Settings → Git
- [x] **D3.5** Criar e publicar a branch `develop`
- [ ] **D3.6** Conferir o Root Directory do projeto na Vercel (monorepo, app em `src/frontend`)
- [ ] **D3.7** Abrir um PR de teste e validar que o preview sobe contra o banco de dev

## Dia 4 — CI/CD no GitHub Actions

> **Em palavras simples:** contratar um robô inspetor. Toda vez que você quer
> mudar alguma coisa, ele confere antes de deixar subir, e se estiver tudo
> certo ele mesmo leva a mudança até a loja de verdade. E como a sua mesa é
> pequena demais para montar a maquete, o robô monta a maquete **na bancada
> dele** — do zero, toda vez, de graça. Este virou o dia mais importante do
> plano.

- [ ] **D4.1** Gerar um Access Token do Supabase (Dashboard → Account → Access Tokens)
- [ ] **D4.2** Cadastrar os secrets no GitHub (access token, senha do prod, refs de prod e dev)
- [ ] **D4.3** Criar `.github/workflows/ci.yml` — `npm ci` + lint + test:unit em todo PR
- [ ] **D4.4** Adicionar o job com `supabase start` + `db reset` + seed + `test:integration` contra banco efêmero (substitui o `db reset` local)
- [ ] **D4.5** Criar `.github/workflows/deploy-db.yml` — `db push` no prod ao mergear em `master`
- [ ] **D4.6** Criar o workflow semanal de `supabase db diff --linked` nos dois projetos (substitui o `db diff` local)
- [ ] **D4.7** Proteger a branch `master`: exigir PR e CI verde antes do merge
- [ ] **D4.8** Validar o ciclo completo com um PR contendo uma migration nova

## Dia 5 — Blindagem e disciplina de processo

> **Em palavras simples:** combinar as regras da casa e pendurar a rede de
> segurança. Backup é a cópia de tudo, para o caso de alguma coisa se perder.
> E a regra principal é que a loja passa a ter **uma porta só** para ser
> mudada — ninguém mais entra pela janela e muda o lugar dos móveis sem
> avisar, que foi exatamente o que aconteceu no dia 01/08.

- [ ] **D5.1** Definir e conferir a política de backup do projeto de produção
- [ ] **D5.2** Registrar no `CLAUDE.md` a regra: migration é o único caminho até o banco
- [ ] **D5.3** Adotar a rotina manual `supabase migration list --linked` (lembrando que ela não pega SQL do Editor — isso é o D4.6)
- [ ] **D5.4** Adotar `supabase migration new` (timestamp) no lugar da numeração manual `00NN`
- [ ] **D5.5** Escrever `docs/fluxo-de-trabalho.md` com o ciclo criar → testar → promover
- [ ] **D5.6** Montar o checklist curto de release
- [ ] **D5.7** Anotar como dívida técnica: se a máquina ganhar RAM, o Docker e o banco local voltam à mesa

## Pendências descobertas no caminho

Itens que não estavam no plano original e apareceram durante a execução.

- [ ] **P1** Desativar as **chaves legadas** (`eyJhbGci…`) nos dois projetos Supabase: *Settings → API Keys → Legacy API Keys → Disable*. Uma delas está no histórico do git desde 31/07 e só a desativação a torna inofensiva
- [ ] **P2** Configurar o **deploy automático de branches** na Vercel (*Settings → Git*). Hoje só a branch de produção deploya sozinha; o link de dev precisa de `vercel deploy` + `alias set` manuais
- [ ] **P3** Decidir sobre **`enable_signup = true`** — hoje qualquer pessoa cria conta em produção, embora os usuários sejam provisionados por script
- [ ] **P4** Resolver o **usuário `admin` inativo** (`sistema@legislabrasil.org.br`, `ativo = false`). Como `app.pre_request` exige `ativo = true`, não há papel de admin funcionando
- [ ] **P5** Limpar os **2 perfis de teste** (`@legislabrasil.test`) que foram junto na importação de usuários para produção
- [ ] **P6** Resolver os **35 problemas de lint do frontend** antes do D4.3 (13 imports não usados, 10 `set-state-in-effect`)
- [ ] **P7** Avaliar **`REVOKE EXECUTE`** nas funções `SECURITY DEFINER` expostas a `anon` (advisors apontam 6 a 8 ocorrências)
