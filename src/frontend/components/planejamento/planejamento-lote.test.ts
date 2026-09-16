import { describe, expect, it } from "vitest";

import type { BaseSucessoMensalLote } from "@backend/rpc/planejamento";

import { expandeMesesEmSucessos } from "./planejamento-lote";

// Spec anchor: PLV-06 (.specs/features/planejamento-estrategico-v2/spec.md:203)
// -- "marcar vários meses ao criar um Sucesso Mensal que se repete, para não
// cadastrar o mesmo item doze vezes".
//
// A ESCRITA é da RPC app.cria_sucessos_mensais_lote (T5/T10): um único INSERT
// atômico, uma cascata só (AC6). Esta função NÃO escreve e não é um segundo
// caminho de escrita -- ela normaliza a seleção da grade em `meses` para a RPC
// e devolve os N irmãos para a PRÉVIA do modal ("isto vai criar 3 linhas").
// Duplicar a escrita aqui quebraria AC6 e a atomicidade.

const BASE: BaseSucessoMensalLote = {
  descricao: "Reunião mensal com a base",
  peso: 10,
  status: "pendente",
  idUsuarioResponsavel: 7,
};

describe("expandeMesesEmSucessos — N meses viram N irmãos (PLV-06 AC2)", () => {
  it("um mês marcado gera um sucesso", () => {
    const { meses, sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01"], 42);
    expect(meses).toEqual(["2026-07-01"]);
    expect(sucessos).toHaveLength(1);
  });

  it("reproduz o Independent Test: Jul/Ago/Set viram 3 linhas", () => {
    // spec.md:225 -- "criar um SM marcando Jul/Ago/Set; a grade passa a mostrar
    // 3 linhas".
    const { sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01", "2026-08-01", "2026-09-01"], 42);
    expect(sucessos.map((s) => s.mes_referencia)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
  });

  it("os 12 meses do ano geram 12 irmãos", () => {
    const ano = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`);
    const { sucessos } = expandeMesesEmSucessos(BASE, ano, 42);
    expect(sucessos).toHaveLength(12);
  });

  it("todo irmão carrega a mesma descrição, peso, status e responsável", () => {
    // AC2: "com a mesma descrição, o mesmo peso e o mesmo responsável".
    const { sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01", "2026-08-01"], 42);
    for (const sucesso of sucessos) {
      expect(sucesso.descricao).toBe("Reunião mensal com a base");
      expect(sucesso.peso).toBe(10);
      expect(sucesso.status).toBe("pendente");
      expect(sucesso.id_usuario_responsavel).toBe(7);
      expect(sucesso.id_meta).toBe(42);
    }
  });

  it("cada irmão difere apenas no mes_referencia", () => {
    // AC3: os N são independentes. O que os distingue é só o mês -- nenhum
    // vínculo de irmandade é gravado (context.md D-3).
    const { sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01", "2026-08-01"], 42);
    const semMes = sucessos.map((sucesso) => ({ ...sucesso, mes_referencia: "(ignorado)" }));
    expect(semMes[0]).toEqual(semMes[1]);
    expect(sucessos[0].mes_referencia).not.toBe(sucessos[1].mes_referencia);
  });

  it("campos opcionais ausentes na base saem nulos, não indefinidos (AD-005)", () => {
    const { sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01"], 42);
    expect(sucessos[0].dt_limite).toBeNull();
    expect(sucessos[0].pct_atingimento).toBeNull();
  });

  it("dt_limite e pct_atingimento informados na base chegam a todos os irmãos", () => {
    const comLimite: BaseSucessoMensalLote = { ...BASE, dtLimite: "2026-12-31", pctAtingimento: 25 };
    const { sucessos } = expandeMesesEmSucessos(comLimite, ["2026-07-01", "2026-08-01"], 42);
    expect(sucessos.map((s) => s.dt_limite)).toEqual(["2026-12-31", "2026-12-31"]);
    expect(sucessos.map((s) => s.pct_atingimento)).toEqual([25, 25]);
  });
});

describe("expandeMesesEmSucessos — normalização do mês", () => {
  it("todo mês sai no dia 1, como exige ck_sucesso_mes", () => {
    const { meses } = expandeMesesEmSucessos(BASE, ["2026-07-15"], 42);
    expect(meses).toEqual(["2026-07-01"]);
  });

  it("ordena os meses, independente da ordem em que a grade foi marcada", () => {
    const { meses } = expandeMesesEmSucessos(BASE, ["2026-09-01", "2026-07-01", "2026-08-01"], 42);
    expect(meses).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
  });

  it("mês repetido colapsa em um só", () => {
    // A grade marca cada mês uma vez, então repetição aqui é ruído, não
    // intenção -- dois irmãos idênticos no mesmo mês não são o que a Gestora
    // pediu. O .refine de sucessoMensalLoteSchema segue como rede, para payload
    // montado fora desta função.
    const { meses, sucessos } = expandeMesesEmSucessos(BASE, ["2026-07-01", "2026-07-01"], 42);
    expect(meses).toEqual(["2026-07-01"]);
    expect(sucessos).toHaveLength(1);
  });

  it("dois dias do mesmo mês também colapsam, porque viram o mesmo dia 1", () => {
    const { meses } = expandeMesesEmSucessos(BASE, ["2026-07-03", "2026-07-28"], 42);
    expect(meses).toEqual(["2026-07-01"]);
  });
});

describe("expandeMesesEmSucessos — recusas (PLV-06 AC5)", () => {
  it("lista vazia é recusada", () => {
    // AC5: "WHEN nenhum mês está marcado THEN o salvamento SHALL ser recusado".
    expect(() => expandeMesesEmSucessos(BASE, [], 42)).toThrow(/ao menos um mês/);
  });

  it("acima de 12 meses é recusado, o mesmo limite de PLN02", () => {
    const treze = Array.from({ length: 13 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}-01`);
    expect(() => expandeMesesEmSucessos(BASE, treze, 42)).toThrow(/12 meses/);
  });

  it("13 marcações que colapsam para 12 meses distintos são aceitas", () => {
    // O limite é de meses, não de cliques: a contagem vale depois do dedupe,
    // igual ao array que chega na RPC.
    const ano = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`);
    const { meses } = expandeMesesEmSucessos(BASE, [...ano, "2026-01-01"], 42);
    expect(meses).toHaveLength(12);
  });

  it("mês em formato irreconhecível é recusado, em vez de virar data inventada", () => {
    expect(() => expandeMesesEmSucessos(BASE, ["julho"], 42)).toThrow(/mês inválido/);
  });
});
