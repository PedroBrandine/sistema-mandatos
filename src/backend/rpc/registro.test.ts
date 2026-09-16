import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { criarRegistro } from "./registro";
import { ErroBancoNaoMapeadoError, PermissaoNegadaError, ViolacaoConstraintError } from "./errors";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T21 Done-when
// (FMC-21) --
//  - Serializa conteudo, artefatos e presentes como JSONB
//  - Cada erro mapeado com asserção própria (lição L-010)
//
// design.md "RPCs": app.criar_registro(p_id_contrato, p_id_encontro,
// p_id_tipo_registro, p_ocorrido_em, p_resumo, p_conteudo JSONB, p_artefatos
// JSONB, p_presentes JSONB) -> BIGINT. T20 (a função em si) fica para quando
// o push for liberado -- este wrapper usa a assinatura já fechada em
// design.md, contra um cliente Supabase mockado. Mesmo padrão de
// rpc/encontro.ts (criarEncontro, T19).

type Chamada = { schema: string; fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ schema: nome, fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("criarRegistro (FMC-21)", () => {
  it("sucesso: chama app.criar_registro com o payload completo -- conteudo/artefatos/presentes como JSONB -- e retorna idRegistro", async () => {
    const { client, chamadas } = criarClienteMock({ data: 501, error: null });

    const resultado = await criarRegistro(client, {
      idContrato: 1,
      idEncontro: 9,
      idTipoRegistro: 3,
      ocorridoEm: "2026-09-20T13:00:00Z",
      resumo: "Imersão de planejamento",
      conteudo: { cronograma: "anexo", observacoes: "correu bem" },
      artefatos: [
        { tipo: "cronograma", url: "https://drive.google.com/cronograma" },
        { tipo: "outro", url: "https://sheets.google.com/monitoramento", descricao: "Planilha de monitoramento" },
      ],
      presentes: [
        { idUsuario: 10, origem: "legisla" },
        { nomeLivre: "Fulano de Tal", origem: "externo" },
      ],
    });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "criar_registro",
      params: {
        p_id_contrato: 1,
        p_id_encontro: 9,
        p_id_tipo_registro: 3,
        p_ocorrido_em: "2026-09-20T13:00:00Z",
        p_resumo: "Imersão de planejamento",
        p_conteudo: { cronograma: "anexo", observacoes: "correu bem" },
        p_artefatos: [
          { tipo: "cronograma", url: "https://drive.google.com/cronograma", descricao: null },
          { tipo: "outro", url: "https://sheets.google.com/monitoramento", descricao: "Planilha de monitoramento" },
        ],
        p_presentes: [
          { id_usuario: 10, nome_livre: null, origem: "legisla" },
          { id_usuario: null, nome_livre: "Fulano de Tal", origem: "externo" },
        ],
      },
    });
    expect(resultado).toEqual({ idRegistro: 501 });
  });

  it("sucesso: payload mínimo (sem id_encontro/resumo, conteudo={}, artefatos/presentes vazios) omite os opcionais como undefined", async () => {
    const { client, chamadas } = criarClienteMock({ data: 12, error: null });

    const resultado = await criarRegistro(client, {
      idContrato: 1,
      idTipoRegistro: 2,
      ocorridoEm: "2026-09-20T13:00:00Z",
      conteudo: {},
      artefatos: [],
      presentes: [],
    });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "criar_registro",
      params: {
        p_id_contrato: 1,
        p_id_encontro: undefined,
        p_id_tipo_registro: 2,
        p_ocorrido_em: "2026-09-20T13:00:00Z",
        p_resumo: undefined,
        p_conteudo: {},
        p_artefatos: [],
        p_presentes: [],
      },
    });
    expect(resultado).toEqual({ idRegistro: 12 });
  });

  it("conteudo chega como objeto (JSONB), nunca serializado como string", async () => {
    const { client, chamadas } = criarClienteMock({ data: 1, error: null });

    await criarRegistro(client, {
      idContrato: 1,
      idTipoRegistro: 2,
      ocorridoEm: "2026-09-20T13:00:00Z",
      conteudo: { adequacoes: "revisar organograma" },
      artefatos: [],
      presentes: [],
    });

    const params = chamadas[0].params as Record<string, unknown>;
    expect(typeof params.p_conteudo).toBe("object");
    expect(params.p_conteudo).toEqual({ adequacoes: "revisar organograma" });
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(
      criarRegistro(client, {
        idContrato: 1,
        idTipoRegistro: 2,
        ocorridoEm: "2026-09-20T13:00:00Z",
        conteudo: {},
        artefatos: [],
        presentes: [],
      })
    ).rejects.toBeInstanceOf(PermissaoNegadaError);
  });

  it("23514 (ck_artefato_url num artefato do registro): lança ViolacaoConstraintError com mensagem de fallback", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: {
        code: "23514",
        message: 'new row for relation "fat_artefato" violates check constraint "ck_artefato_url"',
      },
    });

    await expect(
      criarRegistro(client, {
        idContrato: 1,
        idTipoRegistro: 2,
        ocorridoEm: "2026-09-20T13:00:00Z",
        conteudo: {},
        artefatos: [{ tipo: "outro", url: "drive.google.com/sem-protocolo" }],
        presentes: [],
      })
    ).rejects.toBeInstanceOf(ViolacaoConstraintError);
  });

  it("código não mapeado (chave fora do schema_campos, ex.: P0001) chega como ErroBancoNaoMapeadoError, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "Chave 'assinatura' não declarada em schema_campos deste tipo" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await criarRegistro(client, {
      idContrato: 1,
      idTipoRegistro: 2,
      ocorridoEm: "2026-09-20T13:00:00Z",
      conteudo: { assinatura: "x" },
      artefatos: [],
      presentes: [],
    }).catch((e: unknown) => e);

    expect(capturado).toBeInstanceOf(ErroBancoNaoMapeadoError);
    expect((capturado as ErroBancoNaoMapeadoError).codigo).toBe(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.message);
  });
});
