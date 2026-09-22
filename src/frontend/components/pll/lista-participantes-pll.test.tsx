import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Spec anchor: tasks.md T8 "Done when" (PLL-CP-05…09):
//  - Rótulo "Parlamentar" (D-1), não "Deputado(a)"
//  - Célula ausente = "—"; paginação "Mostrando X–Y de N"
// Test Coverage Matrix: "Componentes de escrita (Upload, Lista+ações,
// VincularTse, Editores)" -- AD-042, os dois lados de cada condicional.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(cleanup);

import type { ParticipantePll } from "@backend/queries/pll-cadastro";

import { ListaParticipantesPll } from "./lista-participantes-pll";

function participante(overrides: Partial<ParticipantePll> = {}): ParticipantePll {
  return {
    idCadastroParticipante: 1,
    papel: "mentorado",
    nomeCompleto: "Fulana de Tal",
    siglaPartido: "PT",
    siglaUf: "SP",
    nomeParlamentar: "Dep. Fulano",
    email: "fulana@teste.com",
    telefone: "11999999999",
    nomeMentorPareado: "Carla Mentora",
    vinculadoTse: true,
    statusCadastro: "completo",
    idContrato: 42,
    ...overrides,
  };
}

const PROPS_PADRAO = {
  participantes: [participante()],
  total: 1,
  pagina: 1,
  tamanhoPagina: 20,
  filtro: {},
  onFiltroChange: vi.fn(),
  onPaginaChange: vi.fn(),
  partidos: ["PT", "PSDB"],
  ufs: ["SP", "RJ"],
};

describe("ListaParticipantesPll — rótulos e colunas (D-1)", () => {
  it("usa 'Parlamentar' como cabeçalho, nunca 'Deputado(a)'", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} />);

    expect(screen.getByRole("columnheader", { name: "Parlamentar" })).toBeInTheDocument();
    expect(screen.queryByText(/deputado/i)).not.toBeInTheDocument();
  });
});

describe("ListaParticipantesPll — ausência de campo vira '—' (AD-005)", () => {
  it("campos vazios (partido, UF, parlamentar, telefone, mentor pareado) mostram '—'", () => {
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={[
          participante({
            siglaPartido: null,
            siglaUf: null,
            nomeParlamentar: null,
            telefone: null,
            nomeMentorPareado: null,
          }),
        ]}
      />
    );

    expect(screen.getAllByText("—")).toHaveLength(5);
  });

  it("lado oposto: participante com todos os campos preenchidos não mostra nenhum '—'", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} />);

    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});

describe("ListaParticipantesPll — indicador de vínculo TSE", () => {
  it("participante vinculado mostra ✓", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} participantes={[participante({ vinculadoTse: true })]} />);

    expect(screen.getByLabelText("Vinculado ao TSE")).toHaveTextContent("✓");
  });

  it("lado oposto: participante não vinculado mostra ✕", () => {
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={[participante({ vinculadoTse: false, idContrato: null, nomeMentorPareado: null })]}
      />
    );

    expect(screen.getByLabelText("Não vinculado ao TSE")).toHaveTextContent("✕");
  });
});

describe("ListaParticipantesPll — botão Vincular TSE (T12 wire)", () => {
  it("participante SEM vínculo e onVincularTse presente mostra o botão", () => {
    const onVincularTse = vi.fn();
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={[participante({ vinculadoTse: false, idContrato: null, nomeMentorPareado: null })]}
        onVincularTse={onVincularTse}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /vincular tse/i }));
    expect(onVincularTse).toHaveBeenCalledWith(
      expect.objectContaining({ vinculadoTse: false })
    );
  });

  it("lado oposto: participante já vinculado não mostra o botão, mesmo com onVincularTse presente", () => {
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={[participante({ vinculadoTse: true })]}
        onVincularTse={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /vincular tse/i })).not.toBeInTheDocument();
  });

  it("sem onVincularTse (T8 isolado, antes do wire de T12) o botão nunca aparece, mesmo sem vínculo", () => {
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={[participante({ vinculadoTse: false, idContrato: null, nomeMentorPareado: null })]}
      />
    );

    expect(screen.queryByRole("button", { name: /vincular tse/i })).not.toBeInTheDocument();
  });
});

describe("ListaParticipantesPll — estado vazio", () => {
  it("lista vazia mostra EstadoVazio, nunca uma tabela vazia", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} participantes={[]} total={0} />);

    expect(screen.getByText("Nenhum participante encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lado oposto: com participantes a tabela renderiza normalmente", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} />);

    expect(screen.queryByText("Nenhum participante encontrado")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("ListaParticipantesPll — busca e filtros", () => {
  it("digitar na busca chama onFiltroChange com o texto (PLL-CP-06)", () => {
    const onFiltroChange = vi.fn();
    render(<ListaParticipantesPll {...PROPS_PADRAO} onFiltroChange={onFiltroChange} />);

    fireEvent.change(screen.getByLabelText("Buscar por nome, e-mail ou parlamentar"), {
      target: { value: "ped" },
    });

    expect(onFiltroChange).toHaveBeenCalledWith({ busca: "ped" });
  });

  it("lado oposto: apagar a busca envia busca: undefined, não string vazia", () => {
    const onFiltroChange = vi.fn();
    render(<ListaParticipantesPll {...PROPS_PADRAO} filtro={{ busca: "ped" }} onFiltroChange={onFiltroChange} />);

    fireEvent.change(screen.getByLabelText("Buscar por nome, e-mail ou parlamentar"), {
      target: { value: "" },
    });

    expect(onFiltroChange).toHaveBeenCalledWith({ busca: undefined });
  });
});

describe("ListaParticipantesPll — paginação (PLL-CP-08)", () => {
  it("mostra 'Mostrando X–Y de N registros' com o recorte da página atual", () => {
    render(
      <ListaParticipantesPll
        {...PROPS_PADRAO}
        participantes={Array.from({ length: 5 }, (_, i) => participante({ idCadastroParticipante: i + 1 }))}
        total={42}
        pagina={2}
        tamanhoPagina={5}
      />
    );

    expect(screen.getByText("Mostrando 6–10 de 42 registros")).toBeInTheDocument();
  });

  it("primeira página desabilita 'Página anterior'; segunda página habilita", () => {
    const { rerender } = render(<ListaParticipantesPll {...PROPS_PADRAO} total={100} pagina={1} tamanhoPagina={20} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    rerender(<ListaParticipantesPll {...PROPS_PADRAO} total={100} pagina={2} tamanhoPagina={20} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
  });

  it("última página desabilita 'Próxima página'; página anterior à última habilita", () => {
    const { rerender } = render(<ListaParticipantesPll {...PROPS_PADRAO} total={40} pagina={2} tamanhoPagina={20} />);
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();

    rerender(<ListaParticipantesPll {...PROPS_PADRAO} total={40} pagina={1} tamanhoPagina={20} />);
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
  });

  it("clicar em 'Próxima página' chama onPaginaChange com pagina + 1", () => {
    const onPaginaChange = vi.fn();
    render(<ListaParticipantesPll {...PROPS_PADRAO} total={100} pagina={1} tamanhoPagina={20} onPaginaChange={onPaginaChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPaginaChange).toHaveBeenCalledWith(2);
  });

  it("total zero não renderiza a barra de paginação", () => {
    render(<ListaParticipantesPll {...PROPS_PADRAO} participantes={[]} total={0} />);

    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});
