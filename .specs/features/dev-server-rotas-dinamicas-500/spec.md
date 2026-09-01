# Rotas dinâmicas devolvendo 500 no `next dev` Specification

## Problem Statement

Toda rota dinâmica do sistema (`/mandatos/[id]`, `/contratos/[id]/*`, `/coalizoes/[id]`,
`/produtos/[slug]/*`, `/numeros-impacto/[idContratante]`, `/convite/[token]`) passou a devolver
HTTP 500 no `npm run dev`, com o overlay do Next mostrando:

> Runtime Error — Jest worker encountered 2 child process exceptions, exceeding retry limit

A mensagem não ajuda: as 5 frames do stack são todas de
`node_modules/next/dist/compiled/jest-worker`, nenhuma linha é do projeto, e não existe nenhum
teste Jest neste repositório (a suíte é Vitest). Rotas estáticas (`/`, `/mandatos`, `/contratos`,
`/usuarios`, `/visao-gerencial`) continuam em 200 — só as dinâmicas quebram.

### Causa raiz (investigada e confirmada por experimento)

Três fatos encadeados, cada um verificado dentro do próprio processo do dev server que estava
falhando (rota temporária de diagnóstico, já removida):

1. **O Next faz `fork()` de um processo Node novo a cada request de rota dinâmica em dev.**
   `DevServer.getStaticPathsWorker()` (`next/dist/server/dev/next-dev-server.js:111`) cria um
   `jest-worker` com `numWorkers: 1` e `.end()` no `finally`; `base-server.js:1365` dispara isso
   para **toda** rota dinâmica em dev (`isDynamicRoute(pathname) && isAppPath`), independentemente
   de a página exportar `generateStaticParams`. Este projeto **não tem nenhum
   `generateStaticParams`** — o processo é criado, carrega o bundle da página e conclui que não há
   caminho estático nenhum.

2. **O processo filho morre com `0xC0000142` (`STATUS_DLL_INIT_FAILED`).** Ele é encerrado pelo
   loader do Windows antes de o runtime do Node começar, então não escreve **nada** em stderr.
   O `jest-worker` só enxerga um exit code diferente de zero, tenta uma vez (`maxRetries: 1`) e
   lança a mensagem genérica. É por isso que o erro não tem causa visível.

3. **O que quebrou foi o console do processo pai, não o código.** Medido no dev server doente:

   | Tentativa a partir do dev server | Resultado |
   | --- | --- |
   | `fork()` do `processChild.js` do jest-worker | `0xC0000142` |
   | `fork()` de um script trivial que só sai com código 7 | `0xC0000142` |
   | `spawn` de `node -e "process.exit(7)"` | `0xC0000142` |
   | `spawn` de `cmd.exe /c exit 7` | `0xC0000142` |
   | o mesmo `cmd.exe`, porém `detached` — **console novo** | **exit 7, ok** |
   | `new Worker(...)` de `node:worker_threads` | **ok** |

   Não é memória, não é o `--max-old-space-size=6033` que o Next injeta via `NODE_OPTIONS`
   (testado com o flag removido e com 512 MB: falha idêntica), e não é a máquina — no mesmo
   instante, um `node` recém-iniciado de outro terminal criava filhos normalmente. É **específico
   daquele processo**: o console (conhost) do terminal que rodou `npm run dev` morreu, todo filho
   que herda esse console falha na inicialização das DLLs, e só escapam quem ganha console novo
   (`detached`) ou quem não é processo (thread). Sintomas coerentes no log: `process.stdout` virou
   `SyncWriteStream` com `isTTY: false`, mais `Error: write EPIPE` e `MaxListenersExceededWarning`
   em `.next/dev/logs/next-development.log`.

O gatilho é rotina: fechar a aba do terminal do VS Code, recarregar a janela do VS Code, ou
suspender/retomar a máquina com o `next dev` aberto. O dev server sobrevive à morte do terminal e
continua servindo rotas estáticas — o que faz o defeito parecer "o Next quebrou", não "o terminal
morreu". No caso observado o servidor estava de pé havia 23,6 h.

## Goals

- [ ] Rotas dinâmicas voltam a responder 200 em dev, e **permanecem** respondendo depois de o
      terminal que iniciou o `npm run dev` morrer.
- [ ] Eliminar o `fork()` por request de rota dinâmica — custo puro, já que nenhuma página do
      projeto exporta `generateStaticParams`.
- [ ] Deixar registrado o caminho de diagnóstico, para ninguém gastar de novo uma hora atrás de um
      erro cujo texto aponta para o lugar errado.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Qualquer mudança de comportamento em produção / `next build` | O defeito só existe em `next dev`; mexer no build por causa disso é risco sem retorno |
| Corrigir a mensagem de erro do Next / abrir issue upstream | Fora do controle deste repositório; a mitigação local resolve o sintoma aqui |
| Instalar Docker / aumentar RAM da máquina | Dívida já registrada e consciente em `docs/fluxo-de-trabalho.md` — e não é a causa deste defeito |
| Reescrever qualquer rota dinâmica | Nenhuma delas está errada; o defeito é de infraestrutura de dev |
| Mexer em `NODE_OPTIONS` / `--max-old-space-size` do dev server | Testado e descartado como causa |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Mitigar no `next.config.ts` em vez de só documentar "reinicie o servidor" | Ligar `experimental.workerThreads` **só na fase de dev** | Reiniciar resolve até o terminal morrer de novo — o que acontece toda semana. Thread não cria processo, então o modo de falha some de vez; e some junto o `fork()` por request, que aqui nunca teve utilidade | y — decisão desta sessão, custo/risco medidos abaixo |
| Escopo do flag | `PHASE_DEVELOPMENT_SERVER`, com `next.config.ts` exportado como função | `experimental.workerThreads` também é lido por `build/index.js:352`; travar por **fase** (e não por `NODE_ENV`) garante zero efeito em `next build` — inclusive no Preview da Vercel | y |
| Risco de usar um flag `experimental.*` | Aceito | É validado pelo schema do Next (`config-schema.js:316`, default `false`), não é flag oculta; e o raio de alcance é uma única chamada em dev que hoje só devolve "nenhum caminho estático" | y |
| O reinício do dev server continua necessário **desta vez** | Sim | O processo atual já está com o console morto; a correção evita a **próxima** ocorrência, não ressuscita o processo doente | y |

**Open questions:** nenhuma.

## User Stories

### P1: Navegar em rotas dinâmicas em dev sem 500 ⭐ MVP

**User Story**: Como Pedro, quero abrir a tela de um contrato, de um mandato ou de um produto no
`npm run dev` e ver a tela, para trabalhar sem reiniciar o servidor toda vez que fecho um terminal.

**Acceptance Criteria**

- **DEV-01**: WHEN uma rota dinâmica (`/contratos/[id]`, `/mandatos/[id]`, `/coalizoes/[id]`,
  `/produtos/[slug]`, `/numeros-impacto/[idContratante]`, `/convite/[token]`) é requisitada no
  `next dev` THEN o servidor SHALL responder HTTP 200, e não 500.
- **DEV-02**: WHEN uma rota dinâmica é requisitada no `next dev` THEN o dev server SHALL resolver
  os caminhos estáticos **sem criar nenhum processo filho** — nenhum `node.exe` novo cujo
  `ParentProcessId` seja o do dev server durante o request.
- **DEV-03**: WHEN o console do terminal que iniciou o `npm run dev` deixa de existir (aba fechada,
  janela do VS Code recarregada, máquina suspensa) THEN as rotas dinâmicas SHALL continuar
  respondendo 200.

### P2: Não pagar o custo do flag em produção

**Acceptance Criteria**

- **DEV-04**: WHEN `next build` é executado (local, CI ou Vercel) THEN a configuração resolvida
  SHALL ter `experimental.workerThreads` desligado — comportamento de build idêntico ao de antes
  desta correção.

### P3: Diagnóstico não se perde

**Acceptance Criteria**

- **DEV-05**: WHEN alguém encontrar de novo "Jest worker encountered N child process exceptions"
  THEN `docs/fluxo-de-trabalho.md` (seção "Quando algo dá errado") SHALL dizer o que o erro
  realmente significa e qual é a ação, sem exigir nova investigação.

## Dimensões implícitas (sweep — escopo Medium)

| Dimensão | Resolução |
| --- | --- |
| Falha / falha parcial | É o próprio objeto da spec: filho morre sem stderr e o `jest-worker` mascara a causa (DEV-01/DEV-05) |
| Dependência externa falhando | A "dependência" aqui é o console do sistema operacional; DEV-03 cobre a perda dele |
| Observabilidade | `.next/dev/logs/next-development.log` já registra; o que faltava era tradução do erro — DEV-05 |
| Auth, limites, concorrência, ciclo de vida do dado, validação de entrada, idempotência, transição de estado | N/A — a correção é de configuração de dev; não toca request, dado, sessão nem schema |
