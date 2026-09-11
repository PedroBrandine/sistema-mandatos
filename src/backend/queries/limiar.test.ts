import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarLimiares } from "./limiar";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T18b
// "Done when" (EST-07 / AD-004) --
//  - queries/limiar.ts lê os 4 limiares de ref_limiar_pendencia, nenhum
//    número mágico no componente
//
// Mock roteado por nome de tabela, mesmo padrão de queries/prospeccao.test.ts.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => {
      chamadas.push({ tabela, metodo: "from", args: [tabela] });
      return criarBuilder(tabela);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const LINHAS_REF_LIMIAR_PENDENCIA = [
  { codigo: "formulario_aberto", dias: 30, pct_duracao_etapa: null, ativo: true },
  { codigo: "sem_registro_recente", dias: 45, pct_duracao_etapa: null, ativo: true },
  { codigo: "etapa_atencao", dias: null, pct_duracao_etapa: 70, ativo: true },
  { codigo: "etapa_atrasado", dias: null, pct_duracao_etapa: 100, ativo: true },
];

describe("buscarLimiares", () => {
  // Done-when: "queries/limiar.ts lê os 4 limiares de ref_limiar_pendencia"
  it("lê ref_limiar_pendencia e devolve as 4 linhas com as duas bases mapeadas", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_limiar_pendencia: { data: LINHAS_REF_LIMIAR_PENDENCIA, error: null },
    });

    const resultado = await buscarLimiares(client);

    expect(chamadas[0]).toEqual({ tabela: "ref_limiar_pendencia", metodo: "from", args: ["ref_limiar_pendencia"] });
    expect(resultado).toEqual([
      { codigo: "formulario_aberto", dias: 30, pctDuracaoEtapa: null, ativo: true },
      { codigo: "sem_registro_recente", dias: 45, pctDuracaoEtapa: null, ativo: true },
      { codigo: "etapa_atencao", dias: null, pctDuracaoEtapa: 70, ativo: true },
      { codigo: "etapa_atrasado", dias: null, pctDuracaoEtapa: 100, ativo: true },
    ]);
  });

  // Edge case: sem linhas (tabela vazia) nunca lança
  it("data null (sem linhas) retorna [] em vez de lançar", async () => {
    const { client } = criarClienteMock({
      ref_limiar_pendencia: { data: null, error: null },
    });

    await expect(buscarLimiares(client)).resolves.toEqual([]);
  });

  // Done-when implícito (padrão do projeto): erro do PostgREST propaga como throw
  it("erro ao ler ref_limiar_pendencia propaga como throw", async () => {
    const erro = { message: "permission denied for table ref_limiar_pendencia" };
    const { client } = criarClienteMock({
      ref_limiar_pendencia: { data: null, error: erro },
    });

    await expect(buscarLimiares(client)).rejects.toEqual(erro);
  });
});
