import { describe, expect, it } from "vitest";

import { PERMISSOES, type PapelPlanejamento, type PermissoesModo } from "./permissoes";

// Spec anchor: PLR-07 (.specs/features/planejamento-estrategico-redesenho/spec.md) --
// PERMISSOES é a fonte única de verdade de papel×modo -> capacidades; a tabela abaixo é a
// mesma reproduzida literalmente em design.md ("PERMISSOES -- fonte única de verdade").
// Nenhuma combinação fora desta tabela é aceita.

const ESPERADO: Record<PapelPlanejamento, PermissoesModo> = {
  gestora: {
    modosDisponiveis: ["construir", "monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: true,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: true,
    veColunaResponsavel: true,
  },
  mentor: {
    modosDisponiveis: ["monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: false,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: false,
    veColunaResponsavel: true,
  },
  assessor: {
    modosDisponiveis: ["monitorar"],
    modoPadrao: "monitorar",
    crudHierarquia: false,
    editaPctTodasAsMetas: false,
    editaPctSóMetasProprias: true,
    veIip: false,
    veIncidencia: false,
    veAuditoria: false,
    veColunaResponsavel: false,
  },
  admin: {
    modosDisponiveis: ["construir", "monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: true,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: true,
    veColunaResponsavel: true,
  },
};

describe("PERMISSOES", () => {
  it("tem exatamente os 4 papéis (sem papel 'legisla', Achado 2 do context.md)", () => {
    expect(Object.keys(PERMISSOES).sort()).toEqual(["admin", "assessor", "gestora", "mentor"]);
  });

  it.each(Object.keys(ESPERADO) as PapelPlanejamento[])(
    "papel '%s' bate exatamente com a matriz de design.md",
    (papel) => {
      expect(PERMISSOES[papel]).toEqual(ESPERADO[papel]);
    }
  );

  describe.each(Object.keys(ESPERADO) as PapelPlanejamento[])("papel '%s'", (papel) => {
    const esperado = ESPERADO[papel];
    const capacidades = Object.keys(esperado) as (keyof PermissoesModo)[];

    it.each(capacidades)("capacidade '%s'", (capacidade) => {
      expect(PERMISSOES[papel][capacidade]).toEqual(esperado[capacidade]);
    });
  });

  it("admin replica o perfil de gestora nesta tela (Achado 2: impersonation é gap de plataforma)", () => {
    expect(PERMISSOES.admin).toEqual(PERMISSOES.gestora);
  });

  it("assessor: só Monitorar, sem CRUD, sem coluna de responsável, sem IIP/incidência/auditoria", () => {
    expect(PERMISSOES.assessor.modosDisponiveis).toEqual(["monitorar"]);
    expect(PERMISSOES.assessor.crudHierarquia).toBe(false);
    expect(PERMISSOES.assessor.veColunaResponsavel).toBe(false);
    expect(PERMISSOES.assessor.veIip).toBe(false);
    expect(PERMISSOES.assessor.veIncidencia).toBe(false);
    expect(PERMISSOES.assessor.veAuditoria).toBe(false);
    expect(PERMISSOES.assessor.editaPctSóMetasProprias).toBe(true);
    expect(PERMISSOES.assessor.editaPctTodasAsMetas).toBe(false);
  });

  it("mentor: Monitorar/Ler, sem CRUD, sem auditoria", () => {
    expect(PERMISSOES.mentor.modosDisponiveis).toEqual(["monitorar", "ler"]);
    expect(PERMISSOES.mentor.crudHierarquia).toBe(false);
    expect(PERMISSOES.mentor.veAuditoria).toBe(false);
  });
});
