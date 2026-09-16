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
    moveHierarquia: true,
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
    moveHierarquia: false,
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
    moveHierarquia: false,
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
    moveHierarquia: true,
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

  // PLV-09 (.specs/features/planejamento-estrategico-v2/spec.md:229) -- mover uma Meta
  // para outro Objetivo, ou um Sucesso Mensal para outra Meta, pelo próprio modal.
  it.each(Object.keys(PERMISSOES) as PapelPlanejamento[])(
    "papel '%s': quem não edita a hierarquia também não a reparenta",
    (papel) => {
      // Reparentar é edição estrutural -- muda id_objetivo/id_meta e marca origem
      // E destino como desatualizados (AC1/AC2), disparando recálculo dos dois
      // lados. Um papel que não pode editar Meta pelo modal não pode mover uma
      // Meta inteira de Objetivo; seriam duas portas para a mesma escrita, e a
      // segunda ficaria aberta.
      expect(PERMISSOES[papel].moveHierarquia).toBe(PERMISSOES[papel].crudHierarquia);
    }
  );

  it("assessor e mentor não movem na hierarquia", () => {
    // O lado oposto do teste acima: se o invariante virasse `true === true` por
    // acidente (as duas capacidades ligadas em todo mundo), este teste cai.
    expect(PERMISSOES.assessor.moveHierarquia).toBe(false);
    expect(PERMISSOES.mentor.moveHierarquia).toBe(false);
    expect(PERMISSOES.gestora.moveHierarquia).toBe(true);
  });

  it("mentor: Monitorar/Ler, sem CRUD, sem auditoria", () => {
    expect(PERMISSOES.mentor.modosDisponiveis).toEqual(["monitorar", "ler"]);
    expect(PERMISSOES.mentor.crudHierarquia).toBe(false);
    expect(PERMISSOES.mentor.veAuditoria).toBe(false);
  });
});
