import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Radix <Select> precisa destes 2 stubs em jsdom (mesmo padrão de
// mandato-wizard.test.tsx/fato-gerador-form.test.tsx) -- sem eles, abrir o
// dropdown lança "scrollIntoView is not a function"/"hasPointerCapture is
// not a function".
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "A aba
// como casa única da Incidência" AC3/AC4 (Registro fora da etapa exige a
// etapa explicitamente, autor resolvido pela sessão). AD-042 integral.

const idUsuarioMock = vi.fn<() => number | null>();

vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({ idUsuario: idUsuarioMock(), papel: "mentor", carregando: false }),
}));

const buscarReguaDoContratoMock = vi.fn();
vi.mock("@backend/queries/etapa-contrato", () => ({
  buscarReguaDoContrato: (...args: unknown[]) => buscarReguaDoContratoMock(...args),
}));

const buscarTiposRegistroDaEtapaMock = vi.fn();
const buscarEncontrosDoContratoMock = vi.fn();
vi.mock("@backend/queries/incidencia", () => ({
  buscarTiposRegistroDaEtapa: (...args: unknown[]) => buscarTiposRegistroDaEtapaMock(...args),
  buscarEncontrosDoContrato: (...args: unknown[]) => buscarEncontrosDoContratoMock(...args),
}));

const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => ({
      insert: (valores: Record<string, unknown>) => insertMock(valores),
      update: (valores: Record<string, unknown>) => {
        updateMock(valores);
        return { eq: (coluna: string, valor: unknown) => eqMock(coluna, valor) };
      },
      // ref_tipo_registro: lookup de id_etapa a partir do tipo do registro
      // existente (fix pós-T25 -- edição deriva a etapa, não pergunta de novo).
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(tabela),
        }),
      }),
    }),
  }),
}));

import { RegistroForm } from "./registro-form";

const onConcluido = vi.fn();
const TIPOS = [{ id: 1, nome: "Pontapé" }];
const ETAPAS = [
  { idEtapa: 10, nome: "Mapa Político" },
  { idEtapa: 11, nome: "Plano de Ação" },
];

beforeEach(() => {
  idUsuarioMock.mockReset();
  buscarReguaDoContratoMock.mockReset();
  buscarTiposRegistroDaEtapaMock.mockReset();
  buscarEncontrosDoContratoMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  maybeSingleMock.mockReset();
  onConcluido.mockReset();

  idUsuarioMock.mockReturnValue(42);
  buscarReguaDoContratoMock.mockResolvedValue(ETAPAS);
  buscarTiposRegistroDaEtapaMock.mockResolvedValue(TIPOS);
  buscarEncontrosDoContratoMock.mockResolvedValue([]);
  insertMock.mockResolvedValue({ error: null });
  eqMock.mockResolvedValue({ error: null });
  maybeSingleMock.mockResolvedValue({ data: { id_etapa: 10 } });
});

afterEach(cleanup);

describe("RegistroForm — seletor de etapa fora do contexto de rota (spec.md AC4)", () => {
  it("sem idEtapa fixado, mostra o Select de etapa e bloqueia Salvar até escolher", async () => {
    render(<RegistroForm idContrato={7} onConcluido={onConcluido} />);

    expect(await screen.findByText("Selecione a etapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  });

  it("com idEtapa fixado (tela de etapa), NÃO mostra o Select -- lado oposto (regressão)", () => {
    render(<RegistroForm idContrato={7} idEtapa={10} onConcluido={onConcluido} />);

    expect(screen.queryByText("Selecione a etapa")).not.toBeInTheDocument();
    expect(buscarReguaDoContratoMock).not.toHaveBeenCalled();
  });
});

describe("RegistroForm — canal removido do formulário (FMC-19)", () => {
  it("não existe mais campo Canal", () => {
    render(<RegistroForm idContrato={7} idEtapa={10} onConcluido={onConcluido} />);
    expect(screen.queryByLabelText(/canal/i)).not.toBeInTheDocument();
  });
});

describe("RegistroForm — criação (INSERT)", () => {
  it("envia id_usuario_autor resolvido da sessão e chama insert, não update", async () => {
    render(<RegistroForm idContrato={7} idEtapa={10} onConcluido={onConcluido} />);

    // 2 comboboxes nesta configuração (idEtapa fixado, sem seletor de etapa):
    // Tipo de Registro (1º) e Encontro de origem (2º).
    await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(2));
    const [comboTipo] = screen.getAllByRole("combobox");
    fireEvent.click(comboTipo);
    fireEvent.click(await screen.findByRole("option", { name: "Pontapé" }));
    fireEvent.change(screen.getByLabelText("Ocorrido em"), { target: { value: "2026-09-16" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ id_contrato: 7, id_tipo_registro: 1, id_usuario_autor: 42 });
    expect(updateMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("INSERT negado pela RLS exibe ErroInline e não conclui -- lado oposto (achado do Verifier)", async () => {
    insertMock.mockResolvedValue({ error: { message: "RLS negou a escrita.", code: "42501" } });

    render(<RegistroForm idContrato={7} idEtapa={10} onConcluido={onConcluido} />);

    await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(2));
    const [comboTipo] = screen.getAllByRole("combobox");
    fireEvent.click(comboTipo);
    fireEvent.click(await screen.findByRole("option", { name: "Pontapé" }));
    fireEvent.change(screen.getByLabelText("Ocorrido em"), { target: { value: "2026-09-16" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("RegistroForm — edição (UPDATE)", () => {
  it("com registroExistente, popula os valores e chama update pelo id, não insert -- lado oposto", async () => {
    render(
      <RegistroForm
        idContrato={7}
        idEtapa={10}
        registroExistente={{
          idRegistro: 99,
          idTipoRegistro: 1,
          ocorridoEm: "2026-09-01",
          nrSequencia: null,
          idEncontro: null,
          resumo: "Resumo antigo",
        }}
        onConcluido={onConcluido}
      />
    );

    expect(await screen.findByDisplayValue("Resumo antigo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-09-01")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(eqMock).toHaveBeenCalledWith("id_registro", 99);
    expect(insertMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("editando a partir da Linha do Tempo (sem idEtapa fixado), deriva a etapa e NÃO mostra o Select -- fix pós-T25", async () => {
    render(
      <RegistroForm
        idContrato={7}
        registroExistente={{
          idRegistro: 99,
          idTipoRegistro: 1,
          ocorridoEm: "2026-09-01",
          nrSequencia: null,
          idEncontro: null,
          resumo: "Resumo antigo",
        }}
        onConcluido={onConcluido}
      />
    );

    expect(await screen.findByDisplayValue("Resumo antigo")).toBeInTheDocument();
    expect(screen.queryByText("Selecione a etapa")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(eqMock).toHaveBeenCalledWith("id_registro", 99);
  });
});
