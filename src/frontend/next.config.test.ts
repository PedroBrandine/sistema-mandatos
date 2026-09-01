import { describe, expect, it } from "vitest";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

import config from "./next.config";

// AD-037. `experimental.workerThreads` existe aqui para corrigir um bug de dev
// (rotas dinâmicas devolvendo 500 com "Jest worker encountered N child process
// exceptions" quando o console do terminal do `npm run dev` morre --
// investigação em .specs/features/dev-server-rotas-dinamicas-500/). O flag é
// lido também pelo `next build`, então o que precisa ficar travado é o
// **escopo**: dev sim, build não.
//
// Sem estes testes, três regressões silenciosas passam inteiras: mover o flag
// pro objeto base (passa a valer em produção), tirar o flag (o bug volta, e o
// sintoma aponta pra dentro do node_modules), ou trocar o export de função por
// objeto literal (o ramo de fase some sem nenhum sinal).
describe("next.config", () => {
  it("é exportado como função de fase, não como objeto literal", () => {
    expect(typeof config).toBe("function");
  });

  it("liga experimental.workerThreads na fase de dev (AD-037)", () => {
    const resolvido = config(PHASE_DEVELOPMENT_SERVER);

    expect(resolvido.experimental?.workerThreads).toBe(true);
  });

  it.each([
    ["build de produção", PHASE_PRODUCTION_BUILD],
    ["servidor de produção", PHASE_PRODUCTION_SERVER],
  ])("não liga workerThreads no %s (AD-037)", (_nome, fase) => {
    const resolvido = config(fase);

    expect(resolvido.experimental?.workerThreads).not.toBe(true);
  });

  it("preserva as opções do objeto base em todas as fases", () => {
    for (const fase of [
      PHASE_DEVELOPMENT_SERVER,
      PHASE_PRODUCTION_BUILD,
      PHASE_PRODUCTION_SERVER,
    ]) {
      // allowedDevOrigins mora no objeto base; se o ramo de dev deixar de
      // espalhar `...nextConfig`, some sem ninguém notar.
      expect(config(fase).allowedDevOrigins).toEqual(["192.168.15.9"]);
    }
  });
});
