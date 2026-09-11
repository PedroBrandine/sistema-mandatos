import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: redesenho-estrategia-tela-first / EST-10 (T23: seções e campos
// somente leitura) e EST-11 (T24: submissão transacional). Tela de ESCRITA,
// então AD-042 integral: os dois lados de cada condicional, estado vazio e
// estado de erro.
//
// Para alcançar o passo "revisar" sem passar pelo <Popover> do TseMatchSearch
// (que não estabiliza em jsdom -- ver tse-match-search.test.tsx), o filho é
// substituído por um botão que chama `onSelecionar` com uma candidatura fixa.
// O componente real já tem teste próprio; aqui o que está sob teste é o
// wizard.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

const CANDIDATURA = {
  anoEleicao: 2022,
  sqCandidato: 111,
  nrTurno: 1,
  nrTituloEleitoral: "123456789012",
  nmCandidato: "PEDRO ANTONIO BIGARDI",
  nmUrna: "PEDRO BIGARDI",
  sgUf: "SP",
  nmMunicipioPrincipal: "CAMPINAS",
  sgPartido: "PC do B",
  cdCargo: 13,
  dsGenero: "MASCULINO",
  qtVotosTotal: 1000,
  metodoMatch: "nome_uf_cargo" as const,
  confianca: "alta" as const,
};

// Linhas das tabelas de referência que o wizard carrega no mount.
const TABELAS: Record<string, unknown[]> = {
  ref_cargo: [{ id_cargo: 3, nome: "Vereador", cd_cargo_tse: 13 }],
  ref_partido: [{ id_partido: 5, sigla: "PC do B" }],
  ref_produto: [{ id_produto: 1, nome: "Estratégia" }],
  ref_projeto: [{ id_projeto: 26, nome: "Imagina 2" }],
  // A coalizão tem id_contratante 447 e id_coalizao 104 -- propositalmente
  // diferentes, que é a distinção no centro do bug corrigido em T24.
  dim_coalizao: [{ id_coalizao: 104, dim_contratante: { nome: "bancada do clima" } }],
};

// Builder encadeável e "thenable": o wizard usa
// supabase.from(x).select(y).eq(...).then(...), sem await.
function criarClienteFake() {
  return {
    from(tabela: string) {
      const linhas = TABELAS[tabela] ?? [];
      const builder: Record<string, unknown> = {
        then: (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: linhas, error: null }).then(resolve),
      };
      for (const metodo of ["select", "eq", "order", "in", "is"]) {
        builder[metodo] = () => builder;
      }
      return builder;
    },
  };
}

const criarMandatoMock = vi.fn();
const buscarMandatoExistentePorTituloMock = vi.fn();
const buscarPerfilCandidaturaMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => criarClienteFake(),
}));

vi.mock("@backend/rpc/mandato", () => ({
  criarMandato: (...args: unknown[]) => criarMandatoMock(...args),
}));

vi.mock("@backend/queries/mandato", () => ({
  buscarMandatoExistentePorTitulo: (...args: unknown[]) =>
    buscarMandatoExistentePorTituloMock(...args),
}));

vi.mock("@backend/queries/tse", () => ({
  buscarPerfilCandidatura: (...args: unknown[]) => buscarPerfilCandidaturaMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("./tse-match-search", () => ({
  TseMatchSearch: ({ onSelecionar }: { onSelecionar: (c: typeof CANDIDATURA) => void }) => (
    <button type="button" onClick={() => onSelecionar(CANDIDATURA)}>
      mock: selecionar candidatura TSE
    </button>
  ),
}));

import { MandatoWizard } from "./mandato-wizard";

beforeEach(() => {
  criarMandatoMock.mockReset();
  buscarMandatoExistentePorTituloMock.mockReset();
  buscarPerfilCandidaturaMock.mockReset();
  pushMock.mockReset();
  buscarMandatoExistentePorTituloMock.mockResolvedValue(null);
  buscarPerfilCandidaturaMock.mockResolvedValue(null);
  criarMandatoMock.mockResolvedValue({
    idContratante: 900,
    idMandato: 901,
    idVinculoTse: null,
    idContrato: 902,
  });
});

afterEach(cleanup);

function renderizar() {
  return render(
    <MandatoWizard
      onCriado={vi.fn()}
      produtoTravado={{ id: 1, nome: "Estratégia" }}
      destino={(r) => `/produtos/estrategia/mandatos/${r.idMandato}`}
    />
  );
}

/** Sai do passo "buscar" para o passo "revisar" (candidatura do TSE vinculada). */
async function irParaRevisar() {
  fireEvent.click(screen.getByRole("button", { name: /selecionar candidatura TSE/i }));
  await screen.findByText("Candidatura TSE vinculada");
}

/** Sai do passo "buscar" para o passo "manual". */
async function irParaManual() {
  fireEvent.click(screen.getByRole("button", { name: /cadastro manual pela mesma tela/i }));
  await screen.findByText("Cadastro manual");
}

describe("MandatoWizard — seções do formulário (EST-10)", () => {
  it("no passo inicial mostra a busca e ainda não mostra o formulário", () => {
    renderizar();

    expect(screen.getByRole("button", { name: /selecionar candidatura TSE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cadastro manual pela mesma tela/i })).toBeInTheDocument();
    expect(screen.queryByText("Ficha do mandato")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar mandato/i })).not.toBeInTheDocument();
  });

  it("renderiza as 4 seções do design depois de vincular a candidatura", async () => {
    renderizar();
    await irParaRevisar();

    expect(screen.getByText("Ficha do mandato")).toBeInTheDocument();
    expect(screen.getByText(/Complemento · o TSE não cobre/)).toBeInTheDocument();
    expect(screen.getByText("Uso interno da Legisla")).toBeInTheDocument();
    expect(screen.getByText("Abertura de Contrato")).toBeInTheDocument();
  });

  it("preenche a ficha com os dados da candidatura selecionada (AC3)", async () => {
    renderizar();
    await irParaRevisar();

    expect(screen.getByLabelText("Nome")).toHaveValue("PEDRO BIGARDI");
    expect(screen.getByLabelText("UF")).toHaveValue("SP");
    expect(screen.getByLabelText("Município")).toHaveValue("CAMPINAS");
    expect(screen.getByLabelText("Título eleitoral")).toHaveValue("123456789012");
    expect(screen.getByLabelText("Nome civil")).toHaveValue("PEDRO ANTONIO BIGARDI");
  });
});

describe("MandatoWizard — campos do TSE somente leitura (EST-10 AC3/AC4)", () => {
  it("com candidatura vinculada, os 6 campos do TSE ficam somente leitura (AC3)", async () => {
    renderizar();
    await irParaRevisar();

    // Os 4 campos de texto: readOnly (continuam focalizáveis e copiáveis).
    expect(screen.getByLabelText("Nome")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("UF")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Município")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Título eleitoral")).toHaveAttribute("readonly");
    expect(screen.getByText("Vindo do TSE")).toBeInTheDocument();

    // Cargo e partido são <Select> (Radix), que não tem readOnly -- a única
    // forma de travar a troca é disabled.
    expect(screen.getByLabelText("Cargo")).toBeDisabled();
    expect(screen.getByLabelText("Partido")).toBeDisabled();
  });

  it("no cadastro manual os MESMOS campos são editáveis (AC4, lado oposto)", async () => {
    renderizar();
    await irParaManual();

    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("UF")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("Município")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("Título eleitoral")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("Cargo")).toBeEnabled();
    expect(screen.getByLabelText("Partido")).toBeEnabled();
    expect(screen.queryByText("Vindo do TSE")).not.toBeInTheDocument();

    // E editáveis de verdade, não só sem o atributo.
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "MARIA DA SILVA" } });
    expect(screen.getByLabelText("Nome")).toHaveValue("MARIA DA SILVA");
  });

  it("no cadastro manual a ficha começa vazia, sem dado do TSE (AC4)", async () => {
    renderizar();
    await irParaManual();

    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("Título eleitoral")).toHaveValue("");
    expect(screen.getByText("Preenchimento integral")).toBeInTheDocument();
  });
});

describe("MandatoWizard — cancelar e buscar novamente (EST-10 AC5)", () => {
  it("desfaz o vínculo TSE e reabre a busca", async () => {
    renderizar();
    await irParaRevisar();
    expect(screen.getByText("Candidatura TSE vinculada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancelar e buscar novamente/i }));

    await waitFor(() =>
      expect(screen.queryByText("Candidatura TSE vinculada")).not.toBeInTheDocument()
    );
    // Voltou para a busca, e o formulário saiu da tela junto com o vínculo.
    expect(screen.getByRole("button", { name: /selecionar candidatura TSE/i })).toBeInTheDocument();
    expect(screen.queryByText("Ficha do mandato")).not.toBeInTheDocument();
  });

  it("também sai do cadastro manual de volta para a busca", async () => {
    renderizar();
    await irParaManual();

    fireEvent.click(screen.getByRole("button", { name: /cancelar e buscar novamente/i }));

    await waitFor(() => expect(screen.queryByText("Cadastro manual")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /selecionar candidatura TSE/i })).toBeInTheDocument();
  });
});
