import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanejamentoToolbar } from "./planejamento-toolbar";
import { PERMISSOES } from "./permissoes";

// Spec anchor: PF-09 (.specs/features/pente-fino-2026-09/spec.md, "P2: Filtro
// por mês no planejamento estratégico" AC1, T10 de tasks.md) -- mesmo padrão
// de busca/onBuscaChange já coberto indiretamente por planejamento-grade.test.tsx;
// este arquivo cobre só o controle novo na toolbar.

const onBuscaChange = vi.fn();
const onSoPendentesChange = vi.fn();
const onMesChange = vi.fn();
const onSoMinhasMetasChange = vi.fn();
const onExpandirTudo = vi.fn();
const onRecolherTudo = vi.fn();
const onCriarObjetivo = vi.fn();
const onAplicarEmMassa = vi.fn();

function renderiza(mes: string | null = null) {
  return render(
    <PlanejamentoToolbar
      permissoes={PERMISSOES.gestora}
      busca=""
      onBuscaChange={onBuscaChange}
      soPendentes={false}
      onSoPendentesChange={onSoPendentesChange}
      mes={mes}
      onMesChange={onMesChange}
      soMinhasMetas={false}
      onSoMinhasMetasChange={onSoMinhasMetasChange}
      onExpandirTudo={onExpandirTudo}
      onRecolherTudo={onRecolherTudo}
      onCriarObjetivo={onCriarObjetivo}
      quantidadeMarcada={0}
      onAplicarEmMassa={onAplicarEmMassa}
    />
  );
}

beforeEach(() => {
  onBuscaChange.mockReset();
  onSoPendentesChange.mockReset();
  onMesChange.mockReset();
  onSoMinhasMetasChange.mockReset();
});

afterEach(cleanup);

describe("PlanejamentoToolbar — filtro por mês (PF-09 AC1)", () => {
  it("exibe o filtro de mês, além da busca por descrição já existente", () => {
    renderiza();
    expect(screen.getByLabelText("Buscar objetivo, meta ou sucesso mensal por descrição")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por mês")).toBeInTheDocument();
  });

  it("sem mes selecionado, o campo fica vazio", () => {
    renderiza(null);
    expect(screen.getByLabelText("Filtrar por mês")).toHaveValue("");
  });

  it("com mes=2026-07-01, o campo mostra 2026-07 (formato do <input type=month>)", () => {
    renderiza("2026-07-01");
    expect(screen.getByLabelText("Filtrar por mês")).toHaveValue("2026-07");
  });

  it("selecionar um mês chama onMesChange com YYYY-MM-01, mesmo dia-1 de ck_sucesso_mes", () => {
    renderiza();
    fireEvent.change(screen.getByLabelText("Filtrar por mês"), { target: { value: "2026-09" } });
    expect(onMesChange).toHaveBeenCalledWith("2026-09-01");
  });

  it("limpar o campo chama onMesChange com null", () => {
    renderiza("2026-07-01");
    fireEvent.change(screen.getByLabelText("Filtrar por mês"), { target: { value: "" } });
    expect(onMesChange).toHaveBeenCalledWith(null);
  });
});
