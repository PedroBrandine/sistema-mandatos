import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarAgendaMentoriasPll } from "./pll-mentorias";

// diagnostico-participante-pll (Agenda PLL, Figma 328:1262). Mesmo padrão de
// mock roteado por tabela de pll-agenda.test.ts -- builder simples,
// respostas por nome de tabela, sem Supabase real.

type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(resposta),
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }
  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return client as unknown as SupabaseClient<Database>;
}

const OK = { error: null };

const RESPOSTAS_BASE = {
  fat_contrato: { data: { id_produto: 2 }, ...OK },
  ref_etapa: { data: { id_etapa: 900 }, ...OK },
  ref_tipo_registro: { data: { id_tipo_registro: 901, qtd_prevista: 5 }, ...OK },
  fat_encontro: { data: [], ...OK },
  fat_registro: { data: [], ...OK },
  rel_usuario_contrato: { data: null, ...OK },
};

describe("buscarAgendaMentoriasPll (diagnostico-participante-pll)", () => {
  it("caminho feliz: monta 5 slots vazios quando não há nenhum encontro/registro ainda", async () => {
    const client = criarClienteMock(RESPOSTAS_BASE);

    const agenda = await buscarAgendaMentoriasPll(client, 43);

    expect(agenda).not.toBeNull();
    expect(agenda!.qtdPrevista).toBe(5);
    expect(agenda!.idEtapa).toBe(900);
    expect(agenda!.idTipoRegistro).toBe(901);
    expect(agenda!.nomeMentor).toBeNull();
    expect(agenda!.slots).toHaveLength(5);
    expect(agenda!.slots.map((s) => s.nrSequencia)).toEqual([1, 2, 3, 4, 5]);
    expect(agenda!.slots.every((s) => s.status === null && s.idEncontro === null && s.registro === null)).toBe(true);
  });

  it("preenche o slot certo com o encontro, o mentor e o registro reais", async () => {
    const client = criarClienteMock({
      ...RESPOSTAS_BASE,
      fat_encontro: {
        data: [
          {
            id_encontro: 501,
            nr_sequencia: 3,
            status: "planejado",
            dt_prevista_inicio: "2026-09-15T14:00:00-03:00",
            dt_realizada: null,
            criado_em: "2026-09-01T00:00:00Z",
          },
        ],
        ...OK,
      },
      fat_registro: {
        data: [{ nr_sequencia: 1, resumo: "Foi ótimo", dim_usuario: { nome: "Ana Mentora" } }],
        ...OK,
      },
      rel_usuario_contrato: { data: { dim_usuario: { nome: "Carlos Mendes" } }, ...OK },
    });

    const agenda = await buscarAgendaMentoriasPll(client, 43);

    expect(agenda!.nomeMentor).toBe("Carlos Mendes");
    const slot1 = agenda!.slots.find((s) => s.nrSequencia === 1)!;
    expect(slot1.registro).toEqual({ resumo: "Foi ótimo", nomeAutor: "Ana Mentora" });
    expect(slot1.status).toBeNull();
    const slot3 = agenda!.slots.find((s) => s.nrSequencia === 3)!;
    expect(slot3.idEncontro).toBe(501);
    expect(slot3.status).toBe("planejado");
    expect(slot3.dtPrevistaInicio).toBe("2026-09-15T14:00:00-03:00");
  });

  it("um slot com encontro cancelado E um novo planejado usa o VIVO, não o cancelado", async () => {
    const client = criarClienteMock({
      ...RESPOSTAS_BASE,
      fat_encontro: {
        data: [
          // order("criado_em", desc) -- o mais recente é o cancelado.
          { id_encontro: 502, nr_sequencia: 2, status: "cancelado", dt_prevista_inicio: null, dt_realizada: null, criado_em: "2026-09-10T00:00:00Z" },
          { id_encontro: 501, nr_sequencia: 2, status: "planejado", dt_prevista_inicio: "2026-09-01T10:00:00-03:00", dt_realizada: null, criado_em: "2026-09-01T00:00:00Z" },
        ],
        ...OK,
      },
    });

    const agenda = await buscarAgendaMentoriasPll(client, 43);

    const slot2 = agenda!.slots.find((s) => s.nrSequencia === 2)!;
    expect(slot2.idEncontro).toBe(501);
    expect(slot2.status).toBe("planejado");
  });

  it("edge case: contrato sem etapa 'mentorias' provisionada devolve null (nunca quebra)", async () => {
    const client = criarClienteMock({ ...RESPOSTAS_BASE, ref_etapa: { data: null, ...OK } });

    const agenda = await buscarAgendaMentoriasPll(client, 43);

    expect(agenda).toBeNull();
  });

  it("edge case: contrato inexistente devolve null", async () => {
    const client = criarClienteMock({ ...RESPOSTAS_BASE, fat_contrato: { data: null, ...OK } });

    const agenda = await buscarAgendaMentoriasPll(client, 999);

    expect(agenda).toBeNull();
  });
});
