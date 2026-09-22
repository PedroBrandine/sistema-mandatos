import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";

import { UploadPlanilhaCard } from "./upload-planilha-card";

// jsdom não implementa Blob/File.prototype.arrayBuffer (achado real desta
// task -- verificado: `typeof new File([...]).arrayBuffer === "undefined"`
// sob jsdom 26, apesar de ser API padrão suportada por todo navegador real
// desde 2020). O componente usa `arquivo.arrayBuffer()` porque é a API
// correta em produção; o polyfill fica só aqui, no teste, via FileReader
// (que o jsdom implementa).
if (typeof File.prototype.arrayBuffer !== "function") {
  File.prototype.arrayBuffer = function (this: File) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as ArrayBuffer);
      leitor.onerror = () => reject(leitor.error);
      leitor.readAsArrayBuffer(this);
    });
  };
}

// Spec anchor: .specs/features/pll-cadastro-participantes/{spec.md,tasks.md} T6
// "Done when" (PLL-CP-01…04), Figma 387:4 ("import-section-card"). AD-042 --
// os dois lados de cada condicional: sucesso/erro, com dado/vazio (AD-005),
// habilitado/desabilitado.
afterEach(cleanup);

const CABECALHOS = [
  "Você é um(a) [Mentorado/Mentor]",
  "Nome Completo",
  "Data de nascimento",
  "E-mail",
  "Telefone (com DDD)",
  "Identidade de gênero",
  "Orientação sexual",
  "Cor/raça",
  "Deficiências",
  "Partido filiado",
  "Tempo na política",
  "Já conhecia a Legisla",
  "Nome do Parlamentar",
  "Cor/raça do parlamentar",
  "Partido do parlamentar",
  "Estado de eleição",
  "Cargos anteriores",
  "Mandatos anteriores",
  "Instagram/rede social",
  "Educação",
  "Segurança pública",
  "Modernização do Estado",
  "Clima",
  "Outras pautas prioritárias",
  "Especifique a pauta",
];

const LINHA_VALIDA = [
  "Mentorado",
  "Fulana de Tal",
  "1990-01-01",
  "fulana@example.com",
  "11999999999",
  "Mulher cis",
  "Heterossexual",
  "Parda",
  "Nenhuma",
  "PT",
  "5 anos",
  "Sim",
  "Dep. Fulano",
  "Branca",
  "PT",
  "SP",
  "Vereador",
  "1",
  "@fulano",
  "5",
  "4",
  "3",
  "2",
  "Saúde",
  "Mobilidade urbana",
];

function gerarArquivoXlsx(cabecalhos: string[], linhas: unknown[][], nome = "planilha.xlsx"): File {
  const planilha = utils.aoa_to_sheet([cabecalhos, ...linhas]);
  const pasta = utils.book_new();
  utils.book_append_sheet(pasta, planilha, "Sheet1");
  const buffer = write(pasta, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new File([new Uint8Array(buffer)], nome, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const METRICAS_ZERADAS = { participantesCadastrados: 0, pendentesRevisao: 0, comDadosIncompletos: 0 };

function selecionarArquivo(arquivo: File) {
  const input = screen.getByLabelText("Selecionar arquivo de planilha") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [arquivo] } });
}

describe("UploadPlanilhaCard", () => {
  it("mostra as 3 métricas de cadastro recebidas por prop", () => {
    render(
      <UploadPlanilhaCard
        metricas={{ participantesCadastrados: 42, pendentesRevisao: 3, comDadosIncompletos: 2 }}
        ultimaImportacao={null}
        onImportar={vi.fn()}
      />
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  // AD-005: ausência é "—", nunca "N/A" ou string vazia.
  it("sem última importação (AD-005), mostra '—'", () => {
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={vi.fn()} />);
    expect(screen.getByText(/Última importação: —/)).toBeInTheDocument();
  });

  // Done-when: "Sucesso mostra 'Última importação: DD/MM/AAAA por ‹nome›'"
  it("com última importação, mostra a data em DD/MM/AAAA e o nome de quem importou", () => {
    render(
      <UploadPlanilhaCard
        metricas={METRICAS_ZERADAS}
        ultimaImportacao={{ data: "2026-09-12", nomeUsuario: "Ana Paula" }}
        onImportar={vi.fn()}
      />
    );
    expect(screen.getByText(/Última importação: 12\/09\/2026 por Ana Paula/)).toBeInTheDocument();
  });

  it("botão 'Exportar dados' vem desabilitado (P3/fora do MVP, edge case da spec.md)", () => {
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Exportar dados/i })).toBeDisabled();
  });

  // PLL-CP-01: arquivo válido -- todas as linhas chegam a onImportar.
  it("sucesso: planilha válida chama onImportar com as linhas validadas, sem erro exibido", async () => {
    const onImportar = vi.fn();
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);

    selecionarArquivo(gerarArquivoXlsx(CABECALHOS, [LINHA_VALIDA]));

    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(1));
    const linhasRecebidas = onImportar.mock.calls[0][0];
    expect(linhasRecebidas).toHaveLength(1);
    expect(linhasRecebidas[0]).toMatchObject({ email: "fulana@example.com", papel: "mentorado" });
    expect(screen.queryByText(/erro/i)).not.toBeInTheDocument();
  });

  // PLL-CP-02: erro rejeita a importação INTEIRA, com a lista completa de
  // erros -- e onImportar NUNCA é chamado (nenhuma linha entra parcialmente).
  it("erro: planilha com campo obrigatório inválido mostra a lista de erros e NÃO chama onImportar", async () => {
    const onImportar = vi.fn();
    const linhaComPapelInvalido = [...LINHA_VALIDA];
    linhaComPapelInvalido[0] = "Coordenador"; // fora de Mentorado/Mentor -> vira "coordenador", rejeitado pelo enum
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);

    selecionarArquivo(gerarArquivoXlsx(CABECALHOS, [linhaComPapelInvalido]));

    await waitFor(() => expect(screen.getByText(/Importação rejeitada/i)).toBeInTheDocument());
    expect(screen.getByText(/Linha 1/)).toBeInTheDocument();
    expect(onImportar).not.toHaveBeenCalled();
  });

  // Edge case: e-mail duplicado no mesmo arquivo -- lote inteiro rejeitado,
  // apontando as duas linhas em conflito.
  it("erro: e-mails duplicados no arquivo rejeitam o lote inteiro apontando as duas linhas", async () => {
    const onImportar = vi.fn();
    const linha2 = [...LINHA_VALIDA];
    linha2[1] = "Outra Pessoa";
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);

    selecionarArquivo(gerarArquivoXlsx(CABECALHOS, [LINHA_VALIDA, linha2]));

    await waitFor(() => expect(screen.getByText(/Importação rejeitada/i)).toBeInTheDocument());
    expect(screen.getByText(/Linha 1/)).toBeInTheDocument();
    expect(screen.getByText(/Linha 2/)).toBeInTheDocument();
    expect(onImportar).not.toHaveBeenCalled();
  });

  // T4 "Done when": cabeçalho não reconhecido -- erro NOMEADO, não silencioso,
  // exibido como erro geral (não é erro de campo de uma linha específica).
  it("erro: cabeçalho de coluna desconhecido mostra erro geral e NÃO chama onImportar", async () => {
    const onImportar = vi.fn();
    const cabecalhosComErro = [...CABECALHOS];
    cabecalhosComErro[1] = "Nome do Participante"; // grafia diferente do Anexo A
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);

    selecionarArquivo(gerarArquivoXlsx(cabecalhosComErro, [LINHA_VALIDA]));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível importar a planilha/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Nome do Participante/)).toBeInTheDocument();
    expect(onImportar).not.toHaveBeenCalled();
  });

  // Erro na própria escrita (onImportar rejeita) -- também vira erro geral,
  // visível, nunca falha silenciosamente.
  it("erro: falha de onImportar (ex.: RLS/rede) mostra erro geral", async () => {
    const onImportar = vi.fn().mockRejectedValue(new Error("permissão negada"));
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);

    selecionarArquivo(gerarArquivoXlsx(CABECALHOS, [LINHA_VALIDA]));

    await waitFor(() => expect(screen.getByText("permissão negada")).toBeInTheDocument());
  });

  // habilitado/desabilitado (AD-042): botão "Selecionar arquivo" desabilita
  // enquanto o processamento do arquivo selecionado está em andamento.
  it("desabilita o botão 'Selecionar arquivo' enquanto processa, e reabilita ao terminar", async () => {
    const onImportar = vi.fn();
    render(<UploadPlanilhaCard metricas={METRICAS_ZERADAS} ultimaImportacao={null} onImportar={onImportar} />);
    const botaoSelecionar = screen.getByRole("button", { name: /Selecionar arquivo/i });
    expect(botaoSelecionar).not.toBeDisabled();

    selecionarArquivo(gerarArquivoXlsx(CABECALHOS, [LINHA_VALIDA]));

    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(botaoSelecionar).not.toBeDisabled());
  });
});
