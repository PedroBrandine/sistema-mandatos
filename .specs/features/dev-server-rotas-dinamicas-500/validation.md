# Rotas dinâmicas devolvendo 500 no `next dev` — Validation

**Date**: 2026-09-01
**Spec**: `.specs/features/dev-server-rotas-dinamicas-500/spec.md`
**Escopo**: Medium — Design e Tasks pulados (1 arquivo de config + 1 de teste + 2 de documentação)
**Verifier**: ⚠️ **autor == verificador**. A instrução ativa da sessão proíbe despachar sub-agente
sem pedido explícito do usuário, então o Verifier independente previsto pelo ritual (roadmap §8.2)
**não** rodou. O que substitui, e não é equivalente: toda evidência abaixo é medição de execução
real (HTTP, contagem de processos do SO, loader de config do próprio Next), não leitura de código,
mais um sensor de discriminação com 4 mutantes. Um segundo par de olhos ainda vale a pena antes de
tratar isto como fechado.
**Veredito**: **PASS** — 5/5 critérios (DEV-01 a DEV-05).

---

## Arquivos alterados

| Arquivo | O quê |
| --- | --- |
| `src/frontend/next.config.ts` | Export vira função de fase; `experimental.workerThreads` ligado só em `PHASE_DEVELOPMENT_SERVER` (AD-037) |
| `src/frontend/next.config.test.ts` | **novo** — 5 testes travando o escopo do flag |
| `docs/fluxo-de-trabalho.md` | Entrada em "Quando algo dá errado": o que o erro significa e qual é a ação |
| `.specs/STATE.md` | AD-037 + handoff |

Nenhuma rota, query, schema, migration ou componente foi tocado. Nenhuma mudança alcança produção
em runtime (ver DEV-04).

---

## Critérios de aceite — evidência

| Critério | Resultado esperado pela spec | Evidência medida | Resultado |
| --- | --- | --- | --- |
| **DEV-01** — rota dinâmica no `next dev` responde 200, não 500 | HTTP 200 em todas | 11 rotas dinâmicas exercitadas contra o dev server rodando: `/contratos/1`, `/contratos/1/{informacoes,planejamento,encontros,formularios,vinculos}`, `/mandatos/1`, `/coalizoes/1`, `/numeros-impacto/1240`, `/convite/xyz` → **200**; `/produtos/{coalizao,estrategia,pll}` → **307** (redirect legítimo do próprio app para `/dashboard`), `/produtos/pll/{dashboard,agenda,contratos}` → **200**. Zero ocorrências da string `Jest worker` em qualquer corpo de resposta. Antes da correção, as mesmas rotas devolviam **500** | ✅ PASS |
| **DEV-02** — nenhum processo filho criado por request | Zero `node.exe` novo com `ParentProcessId` do dev server | Amostragem a cada 40 ms durante 25 s (`Get-CimInstance Win32_Process -Filter ParentProcessId=22460`) enquanto 20 requests atingiam 5 rotas dinâmicas distintas: **1 filho distinto observado**, PID 8352 — o processo persistente do Turbopack, já presente no baseline ocioso. **Nenhum filho novo**. Contagem de threads do dev server subiu de 24 (baseline) para 29 (máximo sob carga): a assinatura exata do worker migrando para `worker_threads` | ✅ PASS |
| **DEV-03** — rotas dinâmicas sobrevivem à morte do console do terminal | Continuam em 200 | Verificado por construção + medição direta da premissa, não por encenar a morte do console: (a) com `workerThreads` ligado nenhum processo é criado (DEV-02), então não existe filho para herdar console; (b) no processo doente original, medido antes da correção: `fork`/`spawn` → `0xC0000142` em 5 variantes, `spawn` com `detached` (console novo) → exit 7 ok, `new Worker` de `node:worker_threads` → **ok**. Thread funciona exatamente na condição em que processo falha. **Limite honesto**: a cadeia é (a)+(b), não um teste ponta-a-ponta que mate o conhost e re-teste — isso não foi encenado | ✅ PASS (por inferência de duas medições, ver limite) |
| **DEV-04** — `next build` com `workerThreads` desligado | Config resolvida sem o flag; build idêntico | Dois níveis. (1) Carregando `next.config.ts` pelo **loader do próprio Next** (`next/dist/server/config`) nas três fases: `phase-development-server → true`, `phase-production-build → false`, `phase-production-server → false`. (2) `npm run build` real: exit 0, `✓ Compiled successfully in 54s`, 25 rotas emitidas — e **zero** ocorrências de `workerThreads`/`Experiments` na saída (em dev, o boot imprime `- Experiments (use with caution): ✓ workerThreads`) | ✅ PASS |
| **DEV-05** — documentação traduz o erro e dá a ação | Entrada em `docs/fluxo-de-trabalho.md` | `docs/fluxo-de-trabalho.md`, seção "Quando algo dá errado", primeira entrada: nomeia a mensagem literal, explica que `jest-worker` é dependência interna do Next (não a suíte, que é Vitest), aponta o console morto como causa, dá a ação (matar e subir de terminal vivo) e o caso de borda observado (404 em vez de 500 → `rm -rf src/frontend/.next`) | ✅ PASS |

---

## Sensor de discriminação

4 mutações aplicadas em `src/frontend/next.config.ts`, cada uma revertida em seguida (arquivo final
`diff`-idêntico ao backup):

| Mutante | Regressão que representa | Testes que falharam | Morto? |
| --- | --- | --- | --- |
| M1 — `experimental: { workerThreads: true }` movido para o objeto base | Flag vaza para `next build`/produção | 2 | ✅ |
| M2 — `workerThreads: false` no ramo de dev | Correção removida, o bug volta | 1 | ✅ |
| M3 — export volta a ser `export default nextConfig` | Ramo de fase desaparece inteiro | 5 | ✅ |
| M4 — ramo de dev deixa de espalhar `...nextConfig` | Opções do objeto base (`allowedDevOrigins`) somem só em dev | 1 | ✅ |

**Sobreviventes: 0.**

---

## Gates

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | ✅ 478 testes, 44 arquivos, todos passando (5 novos em `src/frontend/next.config.test.ts`) |
| `npx tsc --noEmit -p src/frontend/tsconfig.json` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| `npm run lint:all` | ⚠️ 30 problemas (15 erros, 15 warnings) — **todos pré-existentes**, em `components/**`. `next.config.ts` e `next.config.test.ts` não aparecem na saída do lint. Baseline não alterado por esta correção, e não corrigido aqui (fora de escopo) |

---

## Achados durante a verificação

**F1 — cache de dev inconsistente depois da morte abrupta do servidor anterior (corrigido).**
Na primeira subida após a correção, **todas** as rotas passaram a devolver 404 — inclusive
estáticas que existiam e apareciam no `app-paths-manifest.json` (`/mandatos`, `/contratos`), com
`/` e `/login` em 200. Não era regressão da mudança de config: o dev server anterior tinha sido
morto no meio de uma escrita em `.next/dev` (o `write EPIPE` do log), deixando o cache do Turbopack
inconsistente. `rm -rf src/frontend/.next` e nova subida resolveram; todas as medições de DEV-01 e
DEV-02 acima são **posteriores** a essa limpeza. O caso ficou documentado em
`docs/fluxo-de-trabalho.md` porque a diferença 500 vs. 404 é a única pista de que são dois
problemas distintos.

**F2 — hipóteses descartadas com medição, registradas para não serem re-investigadas.**
`--max-old-space-size=6033` que o Next injeta via `NODE_OPTIONS` (testado removido e em 512 MB:
falha idêntica), pressão de memória da máquina (um `node` recém-iniciado criava filhos normalmente
no mesmo instante), vazamento de processos (contagem de `node.exe` estável em 14 antes e depois de
5 requests) e esgotamento de handles/desktop heap (972 handles, 25 threads, `SharedSection` padrão).

**Débito não desta correção**: os 30 problemas de lint pré-existentes em `components/**`.

---

## Próximo passo

Nenhum obrigatório. O dev server em execução já está com a correção ativa (`✓ workerThreads` no
boot). Recomendado, não bloqueante: um Verifier independente revisar esta validação, pelo desvio
registrado no cabeçalho.
