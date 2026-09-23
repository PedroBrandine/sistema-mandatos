import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarInformacoesGeraisMandato } from "./ficha-mandato";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" (FMC-05, FMC-06, FMC-07, FMC-10, FMC-11, FMC-12, FMC-13).
// Test Coverage Matrix (tasks.md, T24): query com cliente Supabase mockado,
// roteado por nome de tabela -- mesmo padrão de queries/contrato.test.ts, já
// que buscarInformacoesGeraisMandato encadeia várias tabelas (algumas mais de
// uma vez, ex.: fat_contrato serve tanto a resolução do contrato quanto o
// histórico).

type RespostaTabela = { data: unknown; error: { message: string } | null };

type ChamadaTabela = { tabela: string; metodo: string; args: unknown[] };

// `chamadas` é opcional -- só usado pelo teste de PF2-08 (T8) que precisa
// confirmar QUE filtro foi enviado ao banco (o mock não filtra de verdade,
// então a única forma de provar ".is('dt_saida', null)" é capturar a
// chamada). Os demais testes não passam o parâmetro e continuam intactos.
function criarClienteMock(
  respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>,
  chamadas?: ChamadaTabela[]
) {
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
    function registrar(metodo: string, args: unknown[]) {
      chamadas?.push({ tabela, metodo, args });
    }
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        registrar("select", args);
        return builder;
      },
      eq: (...args: unknown[]) => {
        registrar("eq", args);
        return builder;
      },
      in: (...args: unknown[]) => {
        registrar("in", args);
        return builder;
      },
      is: (...args: unknown[]) => {
        registrar("is", args);
        return builder;
      },
      order: (...args: unknown[]) => {
        registrar("order", args);
        return builder;
      },
      maybeSingle: () => Promise.resolve(resposta),
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return client as unknown as SupabaseClient<Database>;
}

const CONTRATO_BASE = {
  id_contrato: 1,
  id_contratante: 10,
  id_usuario_ponto_focal: null as number | null,
  ref_projeto: null as { id_projeto: number; nome: string } | null,
};

const MANDATO_BASE = {
  id_mandato: 100,
  minibiografia: null as string | null,
  principais_pautas: null as string[] | null,
};

describe("buscarInformacoesGeraisMandato", () => {
  it("retorna null quando o id_contrato não existe", async () => {
    const client = criarClienteMock({ fat_contrato: { data: null, error: null } });
    const resultado = await buscarInformacoesGeraisMandato(client, 999);
    expect(resultado).toBeNull();
  });

  it("retorna null quando o contrato não tem dim_mandato associado (coalizão, edge case)", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: CONTRATO_BASE, error: null },
      dim_mandato: { data: null, error: null },
    });
    const resultado = await buscarInformacoesGeraisMandato(client, 1);
    expect(resultado).toBeNull();
  });

  it("popula minibiografia e principaisPautas quando preenchidos (FMC-05, FMC-06)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null }, // histórico
      ],
      dim_mandato: {
        data: { ...MANDATO_BASE, minibiografia: "Bio do mandato", principais_pautas: ["Educação", "Saúde"] },
        error: null,
      },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.minibiografia).toBe("Bio do mandato");
    expect(resultado?.principaisPautas).toEqual(["Educação", "Saúde"]);
  });

  it("minibiografia e principaisPautas ausentes chegam como null, nunca string/array vazio (AD-005)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.minibiografia).toBeNull();
    expect(resultado?.principaisPautas).toBeNull();
  });

  it("áreas temáticas vinculadas trazem nome e ordem do catálogo (FMC-07)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [{ id_agenda: 2 }, { id_agenda: 1 }], error: null },
      ref_agenda_tematica: {
        data: [
          { id_agenda: 1, nome: "Educação", ordem: 1 },
          { id_agenda: 2, nome: "Saúde", ordem: 2 },
        ],
        error: null,
      },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.areasTematicas).toEqual([
      { idAgenda: 1, nome: "Educação", ordem: 1 },
      { idAgenda: 2, nome: "Saúde", ordem: 2 },
    ]);
  });

  it("sem nenhum tema vinculado, áreasTematicas é uma lista vazia (não consulta o catálogo)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.areasTematicas).toEqual([]);
  });

  it("deriva contatoParlamentar e contatoChefeGabinete de rel_usuario_contrato + dim_usuario (A-04)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: {
        data: [
          { id_usuario: 20, cargo: "parlamentar", papel_no_contrato: null },
          { id_usuario: 21, cargo: "chefe_gabinete", papel_no_contrato: null },
        ],
        error: null,
      },
      dim_usuario: {
        data: [
          { id_usuario: 20, nome: "Dep. Fulano", email: "fulano@camara.gov", telefone: "11999990000" },
          { id_usuario: 21, nome: "Chefe Beltrana", email: "beltrana@camara.gov", telefone: null },
        ],
        error: null,
      },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.contatoParlamentar).toEqual({
      idUsuario: 20,
      nome: "Dep. Fulano",
      email: "fulano@camara.gov",
      telefone: "11999990000",
    });
    expect(resultado?.contatoChefeGabinete).toEqual({
      idUsuario: 21,
      nome: "Chefe Beltrana",
      email: "beltrana@camara.gov",
      telefone: null,
    });
  });

  it("contato ausente (nenhum vínculo com aquele cargo) chega como null, cada um independente (AD-005)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: {
        data: [{ id_usuario: 20, cargo: "parlamentar", papel_no_contrato: null }],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 20, nome: "Dep. Fulano", email: "fulano@camara.gov", telefone: null }], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.contatoParlamentar).not.toBeNull();
    expect(resultado?.contatoChefeGabinete).toBeNull();
  });

  it("popula pontoFocal a partir de fat_contrato.id_usuario_ponto_focal (A-05, FMC-11)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: { ...CONTRATO_BASE, id_usuario_ponto_focal: 30 }, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      dim_usuario: { data: [{ id_usuario: 30, nome: "Ana Legisla", email: "ana@legisla.org", telefone: null }], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.pontoFocal).toEqual({ idUsuario: 30, nome: "Ana Legisla" });
  });

  it("sem ponto focal, o controle de tela oferece 'Vincular usuário' -- aqui, pontoFocal é null", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.pontoFocal).toBeNull();
  });

  it("gestoras vêm de rel_usuario_contrato com papel_no_contrato='gestora' (FMC-11)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: {
        data: [
          { id_usuario: 40, cargo: null, papel_no_contrato: "gestora" },
          { id_usuario: 41, cargo: null, papel_no_contrato: "assessor" },
        ],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 40, nome: "Gestora Uma", email: "g1@legisla.org", telefone: null }], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.gestoras).toEqual([{ idUsuario: 40, nome: "Gestora Uma" }]);
  });

  it("sem gestora vinculada, a lista de gestoras é vazia", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.gestoras).toEqual([]);
  });

  it("histórico de contratos lista todos os fat_contrato do mesmo id_contratante (FMC-12)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        {
          data: [
            { id_contrato: 1, status: "ativo", dt_inicio: "2026-01-01", dt_fim: null },
            { id_contrato: 2, status: "concluido", dt_inicio: "2024-01-01", dt_fim: "2025-12-31" },
          ],
          error: null,
        },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.historicoContratos).toEqual([
      { idContrato: 1, status: "ativo", dtInicio: "2026-01-01", dtFim: null },
      { idContrato: 2, status: "concluido", dtInicio: "2024-01-01", dtFim: "2025-12-31" },
    ]);
  });

  it("mandato sem nenhum outro contrato mostra a linha do próprio contrato, não estado vazio (edge case)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [{ id_contrato: 1, status: "ativo", dt_inicio: "2026-01-01", dt_fim: null }], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.historicoContratos).toEqual([
      { idContrato: 1, status: "ativo", dtInicio: "2026-01-01", dtFim: null },
    ]);
  });

  it("projeto vinculado vem do embed ref_projeto do próprio fat_contrato (FMC-13)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: { ...CONTRATO_BASE, ref_projeto: { id_projeto: 5, nome: "Projeto Alfa" } }, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.projeto).toEqual({ idProjeto: 5, nome: "Projeto Alfa" });
  });

  it("sem projeto vinculado, projeto é null", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.projeto).toBeNull();
  });

  it("coalizões vinculadas vêm de rel_coalizao_membro, com o nome de dim_contratante (FMC-13)", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: {
        data: [{ id_coalizao: 7, dim_coalizao: { id_contratante: 70, dim_contratante: { nome: "Coalizão Verde" } } }],
        error: null,
      },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.coalizoes).toEqual([{ idCoalizao: 7, nome: "Coalizão Verde" }]);
  });

  it("sem coalizão vinculada, a lista é vazia", async () => {
    const client = criarClienteMock({
      fat_contrato: [
        { data: CONTRATO_BASE, error: null },
        { data: [], error: null },
      ],
      dim_mandato: { data: MANDATO_BASE, error: null },
      rel_mandato_agenda_tematica: { data: [], error: null },
      rel_usuario_contrato: { data: [], error: null },
      rel_coalizao_membro: { data: [], error: null },
    });

    const resultado = await buscarInformacoesGeraisMandato(client, 1);

    expect(resultado?.coalizoes).toEqual([]);
  });

  // PF2-08 (T8), Done-when: "buscarCoalizoesVinculadas não retorna mais
  // membros com dt_saida preenchido". O mock não filtra de verdade (é o
  // Postgres que faz isso via IS NULL), então a asserção possível aqui é
  // confirmar que a chamada certa foi enviada ao banco -- mesmo racional de
  // atualizarStatusContrato.test.ts (afirma os args do UPDATE, não o efeito).
  it("filtra coalizões ativas: chama rel_coalizao_membro.is('dt_saida', null) (PF2-08)", async () => {
    const chamadas: ChamadaTabela[] = [];
    const client = criarClienteMock(
      {
        fat_contrato: [
          { data: CONTRATO_BASE, error: null },
          { data: [], error: null },
        ],
        dim_mandato: { data: MANDATO_BASE, error: null },
        rel_mandato_agenda_tematica: { data: [], error: null },
        rel_usuario_contrato: { data: [], error: null },
        rel_coalizao_membro: { data: [], error: null },
      },
      chamadas
    );

    await buscarInformacoesGeraisMandato(client, 1);

    const chamadaIs = chamadas.find((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "is");
    expect(chamadaIs?.args).toEqual(["dt_saida", null]);
  });
});
