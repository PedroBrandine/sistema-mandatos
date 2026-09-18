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
  // PF-05: opções de gestora que o wizard carrega quando produtoTravado está
  // presente (mesma tabela que CardPontoFocal já usa para Ponto Focal).
  dim_usuario: [
    { id_usuario: 21, nome: "Ana Gestora" },
    { id_usuario: 22, nome: "Bia Gestora" },
  ],
};

const insertRelUsuarioContratoMock = vi.fn().mockResolvedValue({ error: null });

// Builder encadeável e "thenable": o wizard usa
// supabase.from(x).select(y).eq(...).then(...), sem await; PF-05 também
// insere via supabase.from("rel_usuario_contrato").insert([...]) com await.
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
      if (tabela === "rel_usuario_contrato") {
        builder.insert = (linhas: unknown[]) => insertRelUsuarioContratoMock(linhas);
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

// Classes de erro reais (não mockadas): o wizard decide o que mostrar pelo
// `instanceof`, então trocá-las por dublês invalidaria justamente o que estes
// testes checam.
import {
  ErroBancoNaoMapeadoError,
  PermissaoNegadaError,
  ViolacaoUnicaError,
} from "@backend/rpc/errors";

import { MandatoWizard } from "./mandato-wizard";

beforeEach(() => {
  criarMandatoMock.mockReset();
  buscarMandatoExistentePorTituloMock.mockReset();
  buscarPerfilCandidaturaMock.mockReset();
  pushMock.mockReset();
  insertRelUsuarioContratoMock.mockReset();
  insertRelUsuarioContratoMock.mockResolvedValue({ error: null });
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

describe("MandatoWizard — submissão transacional (EST-11 AC6 / AD-024)", () => {
  it("submete por uma única chamada de RPC, nunca dois inserts", async () => {
    renderizar();
    await irParaRevisar();

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    await waitFor(() => expect(criarMandatoMock).toHaveBeenCalledTimes(1));

    // Mandato e contrato vão no MESMO payload -- é isso que garante a
    // transação única do lado do banco (app.criar_mandato).
    const [, payload] = criarMandatoMock.mock.calls[0];
    expect(payload.mandato).toBeDefined();
    expect(payload.contrato).toMatchObject({ id_produto: 1 });
    expect(payload.contratante).toMatchObject({ nome: "PEDRO BIGARDI" });
    // Candidatura vinculada viaja junto, então a função grava
    // origem_partido_cargo = 'tse'.
    expect(payload.candidatura).toMatchObject({ sq_candidato: 111, metodo_match: "nome_uf_cargo" });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/produtos/estrategia/mandatos/901"));
  });

  it("a coalizão vai pelo id_coalizao de dim_coalizao, não pelo id_contratante", async () => {
    renderizar();
    await irParaManual();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "MARIA DA SILVA" } });

    // O <Select> carregou a partir de dim_coalizao: a opção de "bancada do
    // clima" tem de valer 104 (id_coalizao), não 447 (id_contratante). É a
    // confusão entre essas duas chaves que fazia a RPC estourar 23503.
    const gatilho = screen.getByLabelText("Coalizão existente");
    await waitFor(() => expect(gatilho).toBeEnabled());
    fireEvent.click(gatilho);
    fireEvent.click(await screen.findByRole("option", { name: "bancada do clima" }));

    fireEvent.click(screen.getByLabelText("Papel na coalizão"));
    fireEvent.click(await screen.findByRole("option", { name: "Membro" }));

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    await waitFor(() => expect(criarMandatoMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarMandatoMock.mock.calls[0];
    expect(payload.coalizao).toEqual({ id_coalizao: 104, papel: "membro", nome_grupo: null });
    expect(payload.coalizao.id_coalizao).not.toBe(447);
  });

  it("sem coalizão escolhida, o payload manda coalizao nula", async () => {
    renderizar();
    await irParaRevisar();

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    await waitFor(() => expect(criarMandatoMock).toHaveBeenCalledTimes(1));
    expect(criarMandatoMock.mock.calls[0][1].coalizao).toBeNull();
  });
});

describe("MandatoWizard — gestoras no cadastro (PF-05)", () => {
  it("mostra o campo de gestoras, opcional (AC1/AC3)", async () => {
    renderizar();
    await irParaRevisar();

    expect(screen.getByText("Gestoras (opcional)")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Ana Gestora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bia Gestora" })).toBeInTheDocument();
  });

  it("sem gestora selecionada, salva o contrato normalmente sem inserir vínculo (AC3)", async () => {
    renderizar();
    await irParaRevisar();

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    await waitFor(() => expect(criarMandatoMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(insertRelUsuarioContratoMock).not.toHaveBeenCalled();
  });

  it("com gestoras selecionadas, cada uma vira uma linha em rel_usuario_contrato (AC2)", async () => {
    renderizar();
    await irParaRevisar();

    fireEvent.click(await screen.findByRole("button", { name: "Ana Gestora" }));
    fireEvent.click(screen.getByRole("button", { name: "Bia Gestora" }));

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    await waitFor(() => expect(insertRelUsuarioContratoMock).toHaveBeenCalledTimes(1));
    expect(insertRelUsuarioContratoMock.mock.calls[0][0]).toEqual([
      { id_contrato: 902, id_usuario: 21, papel_no_contrato: "gestora" },
      { id_contrato: 902, id_usuario: 22, papel_no_contrato: "gestora" },
    ]);
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
  });
});

describe("MandatoWizard — erros da submissão (EST-11 AC7, L-008)", () => {
  it("título duplicado mostra a mensagem específica e preserva o formulário (AC7)", async () => {
    criarMandatoMock.mockRejectedValue(
      new ViolacaoUnicaError(
        "dim_mandato_nr_titulo_eleitoral_key",
        "Já existe um mandato cadastrado com este título eleitoral."
      )
    );

    renderizar();
    await irParaRevisar();
    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    expect(
      await screen.findByText("Já existe um mandato cadastrado com este título eleitoral.")
    ).toBeInTheDocument();
    // O formulário continua na tela, com os dados preenchidos -- nada de
    // voltar para a busca e perder o que já foi digitado.
    expect(screen.getByText("Ficha do mandato")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("PEDRO BIGARDI");
    expect(screen.getByLabelText("Título eleitoral")).toHaveValue("123456789012");
    // E oferece a saída para o mandato que já existe.
    expect(
      screen.getByRole("button", { name: /ver mandato existente/i })
    ).toBeInTheDocument();
  });

  it("erro propaga pelo ErroInline, o componente padrão (L-008)", async () => {
    criarMandatoMock.mockRejectedValue(new PermissaoNegadaError());

    renderizar();
    await irParaRevisar();
    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    const alerta = await screen.findByRole("alert");
    // ErroInline = <Alert variant="destructive"> com este título padrão.
    expect(alerta).toHaveTextContent("Não foi possível carregar");
    expect(alerta).toHaveTextContent("Você não tem permissão para realizar esta operação.");
  });

  it("erro do banco sem mapeamento chega à tela com código e mensagem, não com frase genérica", async () => {
    // Exatamente o caso que o Pedro viu: 23503 vindo do insert em
    // rel_coalizao_membro. Antes, `mapeiaErroRpc` devolvia o objeto cru do
    // PostgREST (que não é Error em runtime) e o catch o trocava por
    // "Erro ao cadastrar mandato ou contrato.".
    criarMandatoMock.mockRejectedValue(
      new ErroBancoNaoMapeadoError(
        "23503",
        'insert or update on table "rel_coalizao_membro" violates foreign key constraint "rel_coalizao_membro_id_coalizao_fkey"'
      )
    );

    renderizar();
    await irParaRevisar();
    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("23503");
    expect(alerta).toHaveTextContent("rel_coalizao_membro");
    expect(alerta).not.toHaveTextContent("Erro ao cadastrar mandato ou contrato.");
  });

  it("erro que não é Error nenhum ainda diz algo útil, em vez de fingir uma causa", async () => {
    // O objeto cru do PostgREST, caso escape por um caminho que não passe
    // por mapeiaErroRpc.
    criarMandatoMock.mockRejectedValue({
      code: "22P02",
      message: 'invalid input syntax for type bigint: ""',
      details: null,
      hint: null,
    });

    renderizar();
    await irParaRevisar();
    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("22P02");
    expect(alerta).toHaveTextContent("invalid input syntax");
  });

  it("sem erro nenhum, nenhum ErroInline aparece (lado oposto)", async () => {
    renderizar();
    await irParaRevisar();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /salvar mandato/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
