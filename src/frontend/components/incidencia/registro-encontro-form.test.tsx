import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T31 Done-when
// (FMC-14, FMC-15, FMC-18, FMC-19, FMC-21; spec.md P1 Registro AC1-AC13) --
//  - Etapa/Tipo em leitura, sem controle de edição
//  - Sequência "nº X de Y" / "nº X" -- os dois lados
//  - Com encontro: Presentes pré-marcada; sem encontro: lista livre, sem quebrar
//  - Nenhum campo Canal
//  - Erro do RPC -> <ErroInline>
//
// AD-042 integral: cada condicional citada acima tem os dois lados testados.

const criarRegistroMock = vi.fn();
vi.mock("@backend/rpc/registro", async () => {
  const real = await vi.importActual<typeof import("@backend/rpc/registro")>("@backend/rpc/registro");
  return { ...real, criarRegistro: (...args: unknown[]) => criarRegistroMock(...args) };
});

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import { RegistroEncontroForm, type ParticipanteRegistroEncontro } from "./registro-encontro-form";

afterEach(cleanup);

const onConcluido = vi.fn();
const onCancelar = vi.fn();

const SCHEMA_COM_CAMPOS = {
  versao: 1,
  campos: [
    { chave: "adequacoes", rotulo: "Adequações a serem realizadas", tipo: "texto_longo" },
    { chave: "organograma", rotulo: "Organograma", tipo: "link", artefato_tipo: "organograma" },
  ],
};

const PARTICIPANTES: ParticipanteRegistroEncontro[] = [
  { idUsuario: 7, origem: "legisla", nome: "Ana Gestora" },
  { nomeLivre: "Assessor convidado", origem: "externo", nome: "Assessor convidado" },
];

function propsBase(overrides: Partial<React.ComponentProps<typeof RegistroEncontroForm>> = {}) {
  return {
    idContrato: 42,
    idEtapa: 9,
    idTipoRegistro: 6,
    nomeEtapa: "Governança",
    nomeTipo: "Diagnóstico de Organograma",
    qtdPrevista: null as number | null,
    schemaCampos: { versao: 1, campos: [] },
    onConcluido,
    onCancelar,
    ...overrides,
  };
}

beforeEach(() => {
  criarRegistroMock.mockReset();
  onConcluido.mockReset();
  onCancelar.mockReset();
  criarRegistroMock.mockResolvedValue({ idRegistro: 900 });
});

describe("RegistroEncontroForm — Etapa/Tipo herdados e imutáveis (FMC-14/A-16)", () => {
  it("exibe Etapa e Tipo como texto, sem nenhum select ou input de edição", () => {
    render(<RegistroEncontroForm {...propsBase()} />);

    expect(screen.getByText("Governança")).toBeInTheDocument();
    expect(screen.getAllByText("Diagnóstico de Organograma").length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("RegistroEncontroForm — sequência (FMC-15 AC2, T16 rotuloSequencia)", () => {
  it("com qtd_prevista, renderiza 'nº X de Y'", () => {
    render(<RegistroEncontroForm {...propsBase({ qtdPrevista: 4, nrSequencia: 2 })} />);
    expect(screen.getByText("nº 2 de 4")).toBeInTheDocument();
  });

  it("sem qtd_prevista, renderiza só 'nº X'", () => {
    render(<RegistroEncontroForm {...propsBase({ qtdPrevista: null, nrSequencia: 3 })} />);
    expect(screen.getByText("nº 3")).toBeInTheDocument();
  });
});

describe("RegistroEncontroForm — Presentes (FMC-18 AC9/AC10, A-21)", () => {
  it("com encontro, a lista chega pré-marcada dos participantes do encontro", () => {
    render(<RegistroEncontroForm {...propsBase({ idEncontro: 501, participantesEncontro: PARTICIPANTES })} />);

    const checkboxAna = screen.getByLabelText("Ana Gestora") as HTMLInputElement;
    const checkboxAssessor = screen.getByLabelText("Assessor convidado") as HTMLInputElement;
    expect(checkboxAna.checked).toBe(true);
    expect(checkboxAssessor.checked).toBe(true);
  });

  it("sem encontro, a lista nasce livre e o formulário não quebra (A-08)", () => {
    render(<RegistroEncontroForm {...propsBase({ idEncontro: undefined, participantesEncontro: [] })} />);

    expect(screen.getByText("Nenhum presente adicionado ainda.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do presente"), {
      target: { value: "Vereadora Convidada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(screen.getByLabelText("Vereadora Convidada")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum presente adicionado ainda.")).not.toBeInTheDocument();
  });
});

describe("RegistroEncontroForm — Canal removido do produto (FMC-19)", () => {
  it("não renderiza nenhum campo Canal", () => {
    render(<RegistroEncontroForm {...propsBase()} />);
    expect(screen.queryByText(/canal/i)).not.toBeInTheDocument();
  });
});

describe("RegistroEncontroForm — camada dinâmica (FMC-16/FMC-17)", () => {
  it("sem campos declarados, exibe a mensagem de camada vazia", () => {
    render(<RegistroEncontroForm {...propsBase({ schemaCampos: { versao: 1, campos: [] } })} />);
    expect(
      screen.getByText("Nenhum campo extra necessário para este Tipo de Registro")
    ).toBeInTheDocument();
  });

  it("com campos declarados, renderiza os rótulos do schema_campos do tipo", () => {
    render(<RegistroEncontroForm {...propsBase({ schemaCampos: SCHEMA_COM_CAMPOS })} />);
    expect(screen.getByLabelText("Adequações a serem realizadas")).toBeInTheDocument();
    expect(screen.getByLabelText("Organograma")).toBeInTheDocument();
  });
});

describe("RegistroEncontroForm — submissão via app.criar_registro (FMC-21)", () => {
  it("envia conteudo/artefatos/presentes e conclui em caso de sucesso", async () => {
    render(
      <RegistroEncontroForm
        {...propsBase({
          idEncontro: 501,
          schemaCampos: SCHEMA_COM_CAMPOS,
          participantesEncontro: PARTICIPANTES,
        })}
      />
    );

    fireEvent.change(screen.getByLabelText("Adequações a serem realizadas"), {
      target: { value: "Rever organograma da assessoria" },
    });
    fireEvent.change(screen.getByLabelText("Organograma"), {
      target: { value: "https://drive.example.com/organograma" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criarRegistroMock).toHaveBeenCalledTimes(1));

    const [, payload] = criarRegistroMock.mock.calls[0];
    expect(payload).toMatchObject({
      idContrato: 42,
      idEncontro: 501,
      idTipoRegistro: 6,
      conteudo: { adequacoes: "Rever organograma da assessoria" },
      artefatos: [{ tipo: "organograma", url: "https://drive.example.com/organograma", descricao: null }],
      presentes: [
        { idUsuario: 7, nomeLivre: null, origem: "legisla" },
        { idUsuario: null, nomeLivre: "Assessor convidado", origem: "externo" },
      ],
    });
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("erro do RPC renderiza <ErroInline>, sem chamar onConcluido", async () => {
    criarRegistroMock.mockRejectedValue(new Error("URL deve começar com http:// ou https://"));

    render(<RegistroEncontroForm {...propsBase()} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByText("URL deve começar com http:// ou https://")).toBeInTheDocument()
    );
    expect(screen.getByText("Não foi possível salvar o registro")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("RegistroEncontroForm — desmarcar presença (A-21: edição só toca rel_registro_participante)", () => {
  it("desmarcar um participante pré-marcado o exclui de 'presentes' no envio", async () => {
    render(
      <RegistroEncontroForm
        {...propsBase({ idEncontro: 501, participantesEncontro: PARTICIPANTES })}
      />
    );

    fireEvent.click(screen.getByLabelText("Assessor convidado"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criarRegistroMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarRegistroMock.mock.calls[0];
    expect(payload.presentes).toEqual([{ idUsuario: 7, nomeLivre: null, origem: "legisla" }]);
  });
});

describe("RegistroEncontroForm — resumo e data (payload básico)", () => {
  it("envia ocorrido_em e resumo preenchidos pela usuária", async () => {
    render(<RegistroEncontroForm {...propsBase()} />);

    fireEvent.change(screen.getByLabelText("Ocorrido em"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Reunião de alinhamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(criarRegistroMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarRegistroMock.mock.calls[0];
    expect(payload).toMatchObject({ ocorridoEm: "2026-09-10", resumo: "Reunião de alinhamento" });
  });
});

describe("RegistroEncontroForm — cancelamento", () => {
  it("botão Cancelar aciona onCancelar sem enviar nada", () => {
    render(<RegistroEncontroForm {...propsBase()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(criarRegistroMock).not.toHaveBeenCalled();
  });
});
