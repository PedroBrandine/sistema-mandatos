import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../supabase/database.types";

const mocks = vi.hoisted(() => ({
  buscarTodasCandidaturasPorTitulo: vi.fn(),
  buscarPerfilCandidatura: vi.fn(),
}));
vi.mock("./tse", () => ({
  buscarTodasCandidaturasPorTitulo: mocks.buscarTodasCandidaturasPorTitulo,
  buscarPerfilCandidatura: mocks.buscarPerfilCandidatura,
}));

import { buscarInformacoesGeraisPll } from "./pll-informacoes";

// diagnostico-participante-pll (Informações Gerais PLL, Figma 449:4).

type RespostaTabela = { data: unknown; error: { message: string } | null };

// Fila por tabela: cada `.from(tabela)` consome a próxima resposta da fila
// (ou repete a última, se só houver uma) -- necessário porque
// buscarInformacoesGeraisPll consulta `fat_cadastro_participante` DUAS vezes
// com formatos diferentes (a linha do contrato, depois o histórico por e-mail).
function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const filas = new Map<string, RespostaTabela[]>(
    Object.entries(respostasPorTabela).map(([tabela, resp]) => [tabela, Array.isArray(resp) ? [...resp] : [resp]])
  );
  function proximaResposta(tabela: string): RespostaTabela {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }
  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      not: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(resposta),
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }
  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return client as unknown as SupabaseClient<Database>;
}

const OK = { error: null };

const CADASTRO_BASE = {
  id_cadastro_participante: 1,
  email: "fulana@exemplo.com",
  identidade_genero: "Feminino",
  orientacao_sexual: "Heterossexual",
  cor_raca: "Parda",
  tempo_na_politica: "6-10 anos",
  mandatos_anteriores: "2 mandatos",
  cargos_anteriores: "Vereadora, Prefeita",
  id_vinculo_tse: null,
  id_edicao: 10,
  importado_em: "2026-08-01T12:00:00Z",
  importado_por: 5,
};

const HISTORICO_VAZIO = { data: [], ...OK };

const RESPOSTAS_BASE: Record<string, RespostaTabela | RespostaTabela[]> = {
  fat_cadastro_participante: [{ data: CADASTRO_BASE, ...OK }, HISTORICO_VAZIO],
  rel_usuario_contrato: { data: null, ...OK },
  dim_usuario: { data: { nome: "Gestora Fulana" }, ...OK },
  fat_edicao: { data: { nome: "PLL 2026.1", dt_inicio: "2026-01-01", dt_fim: null }, ...OK },
};

beforeEach(() => {
  mocks.buscarTodasCandidaturasPorTitulo.mockReset();
  mocks.buscarPerfilCandidatura.mockReset();
});

describe("buscarInformacoesGeraisPll", () => {
  it("edge case: sem linha de cadastro correspondente ao contrato, devolve null", async () => {
    const client = criarClienteMock({ ...RESPOSTAS_BASE, fat_cadastro_participante: { data: null, ...OK } });

    const resultado = await buscarInformacoesGeraisPll(client, 999);

    expect(resultado).toBeNull();
  });

  it("caminho feliz: monta Dados Pessoais, Mentor, Vínculo de Acesso e Edição Vinculada", async () => {
    const client = criarClienteMock({
      ...RESPOSTAS_BASE,
      rel_usuario_contrato: { data: { dim_usuario: { nome: "Carlos Mendes" } }, ...OK },
    });

    const info = await buscarInformacoesGeraisPll(client, 43);

    expect(info).not.toBeNull();
    expect(info!.identidadeGenero).toBe("Feminino");
    expect(info!.corRaca).toBe("Parda");
    expect(info!.nomeMentor).toBe("Carlos Mendes");
    expect(info!.origemCadastro).toEqual({ dataImportacao: "2026-08-01T12:00:00Z", nomeUsuario: "Gestora Fulana" });
    expect(info!.edicaoAtual).toEqual({ nomeEdicao: "PLL 2026.1", dtInicio: "2026-01-01", dtFim: null, statusContrato: null });
  });

  it("sem mentor pareado, nomeMentor é null (Figma: 'Nenhum mentor pareado ainda')", async () => {
    const client = criarClienteMock(RESPOSTAS_BASE);

    const info = await buscarInformacoesGeraisPll(client, 43);

    expect(info!.nomeMentor).toBeNull();
  });

  it("sem id_vinculo_tse, idade/escolaridade ficam null sem chamar o TSE", async () => {
    const client = criarClienteMock(RESPOSTAS_BASE);

    const info = await buscarInformacoesGeraisPll(client, 43);

    expect(info!.idade).toBeNull();
    expect(info!.escolaridade).toBeNull();
    expect(mocks.buscarTodasCandidaturasPorTitulo).not.toHaveBeenCalled();
  });

  it("com id_vinculo_tse, resolve idade/escolaridade pelo perfil da candidatura mais recente", async () => {
    mocks.buscarTodasCandidaturasPorTitulo.mockResolvedValue([
      { anoEleicao: 2018, sqCandidato: 1, nrTurno: 1 },
      { anoEleicao: 2022, sqCandidato: 2, nrTurno: 1 },
    ]);
    mocks.buscarPerfilCandidatura.mockResolvedValue({ idade: 42, grauInstrucao: "Pós-Graduação" });

    const client = criarClienteMock({
      ...RESPOSTAS_BASE,
      fat_cadastro_participante: [{ data: { ...CADASTRO_BASE, id_vinculo_tse: 77 }, ...OK }, HISTORICO_VAZIO],
      rel_mandato_candidatura: { data: { id_mandato: 9 }, ...OK },
      dim_mandato: { data: { nr_titulo_eleitoral: "123456789012" }, ...OK },
    });

    const info = await buscarInformacoesGeraisPll(client, 43);

    expect(info!.idade).toBe(42);
    expect(info!.escolaridade).toBe("Pós-Graduação");
    expect(mocks.buscarPerfilCandidatura).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ anoEleicao: 2022 })
    );
  });
});
