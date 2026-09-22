import { utils, write } from "xlsx";
import { describe, expect, it } from "vitest";

import { ErroCabecalhoDesconhecido, parseCadastroPll } from "./cadastro-participante-pll";

// Anexo A (.specs/features/pll-cadastro-participantes/spec.md) -- tasks.md T4
// "Done when": .xlsx e .csv parseiam para o mesmo formato de objeto; cabeçalho
// não reconhecido gera erro nomeado (não silencioso).

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

const LINHA_PLANILHA = [
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
  "Saúde, Tecnologia",
  "Mobilidade urbana",
];

function gerarXlsxBuffer(cabecalhos: string[], linhas: unknown[][]): ArrayBuffer {
  const planilha = utils.aoa_to_sheet([cabecalhos, ...linhas]);
  const pasta = utils.book_new();
  utils.book_append_sheet(pasta, planilha, "Sheet1");
  const buffer = write(pasta, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function escaparCampoCsv(valor: unknown): string {
  const texto = String(valor);
  return texto.includes(",") ? `"${texto}"` : texto;
}

function gerarCsvString(cabecalhos: string[], linhas: unknown[][]): string {
  const linhasTexto = [cabecalhos, ...linhas].map((linha) => linha.map(escaparCampoCsv).join(","));
  return linhasTexto.join("\n");
}

describe("parseCadastroPll", () => {
  it("parseia .xlsx e .csv da mesma planilha para o MESMO formato de objeto", () => {
    const bufferXlsx = gerarXlsxBuffer(CABECALHOS, [LINHA_PLANILHA]);
    const textoCsv = gerarCsvString(CABECALHOS, [LINHA_PLANILHA]);

    const linhasXlsx = parseCadastroPll(bufferXlsx);
    const linhasCsv = parseCadastroPll(textoCsv);

    expect(linhasXlsx).toHaveLength(1);
    expect(linhasCsv).toHaveLength(1);
    expect(linhasXlsx[0]).toEqual(linhasCsv[0]);
  });

  it("mapeia os 25 cabeçalhos do Anexo A para os campos de fat_cadastro_participante", () => {
    const buffer = gerarXlsxBuffer(CABECALHOS, [LINHA_PLANILHA]);
    const [linha] = parseCadastroPll(buffer) as [Record<string, unknown>];
    expect(linha).toMatchObject({
      papel: "mentorado",
      nome_completo: "Fulana de Tal",
      email: "fulana@example.com",
      telefone: "11999999999",
      identidade_genero: "Mulher cis",
      orientacao_sexual: "Heterossexual",
      cor_raca: "Parda",
      deficiencias: "Nenhuma",
      partido_filiado: "PT",
      tempo_na_politica: "5 anos",
      conhecia_legisla: true,
      nome_parlamentar: "Dep. Fulano",
      cor_raca_parlamentar: "Branca",
      partido_parlamentar: "PT",
      estado_eleicao: "SP",
      cargos_anteriores: "Vereador",
      mandatos_anteriores: "1",
      rede_social: "@fulano",
      nota_educacao: 5,
      nota_seguranca_publica: 4,
      nota_modernizacao_estado: 3,
      nota_clima: 2,
      outras_pautas: ["Saúde", "Tecnologia"],
      especifique_pauta: "Mobilidade urbana",
    });
  });

  it("mapeia 'Mentor' (Dados do Mandato) para o valor 'mentor' do enum papel", () => {
    const linhaMentor = [...LINHA_PLANILHA];
    linhaMentor[0] = "Mentor";
    const buffer = gerarXlsxBuffer(CABECALHOS, [linhaMentor]);
    const [linha] = parseCadastroPll(buffer) as [Record<string, unknown>];
    expect(linha.papel).toBe("mentor");
  });

  it("mapeia 'Já conhecia a Legisla' = 'Não' para false", () => {
    const linhaNao = [...LINHA_PLANILHA];
    linhaNao[11] = "Não";
    const buffer = gerarXlsxBuffer(CABECALHOS, [linhaNao]);
    const [linha] = parseCadastroPll(buffer) as [Record<string, unknown>];
    expect(linha.conhecia_legisla).toBe(false);
  });

  it("célula vazia vira null (AD-005 -- ausência é null, nunca sentinela)", () => {
    const linhaComVazio = [...LINHA_PLANILHA];
    linhaComVazio[7] = ""; // Cor/raça
    const buffer = gerarXlsxBuffer(CABECALHOS, [linhaComVazio]);
    const [linha] = parseCadastroPll(buffer) as [Record<string, unknown>];
    expect(linha.cor_raca).toBeNull();
  });

  it("parseia múltiplas linhas para múltiplos objetos, na mesma ordem", () => {
    const linha2 = [...LINHA_PLANILHA];
    linha2[3] = "outra@example.com";
    linha2[1] = "Outra Pessoa";
    const buffer = gerarXlsxBuffer(CABECALHOS, [LINHA_PLANILHA, linha2]);
    const linhas = parseCadastroPll(buffer) as Record<string, unknown>[];
    expect(linhas).toHaveLength(2);
    expect(linhas[0].email).toBe("fulana@example.com");
    expect(linhas[1].email).toBe("outra@example.com");
  });

  // T4 "Done when": cabeçalho não reconhecido gera erro NOMEADO, não silencioso.
  it("lança ErroCabecalhoDesconhecido (nomeado) quando uma coluna não corresponde ao Anexo A", () => {
    const cabecalhosComErro = [...CABECALHOS];
    cabecalhosComErro[1] = "Nome Completo do Participante"; // grafia diferente do Anexo A
    const buffer = gerarXlsxBuffer(cabecalhosComErro, [LINHA_PLANILHA]);

    expect(() => parseCadastroPll(buffer)).toThrow(ErroCabecalhoDesconhecido);
    try {
      parseCadastroPll(buffer);
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroCabecalhoDesconhecido);
      expect((erro as ErroCabecalhoDesconhecido).cabecalho).toBe("Nome Completo do Participante");
      expect((erro as Error).message).toContain("Nome Completo do Participante");
    }
  });
});
