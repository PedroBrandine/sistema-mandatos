import { z } from "zod";

// Espelha fat_fato_gerador (docs/schema_sistema.sql:1098-1117, + titulo/
// situacao/dt_prevista de T2) -- criado via app.criar_fato_gerador (RPC
// SECURITY INVOKER, AD-024: fato + até 1 linha de vínculo na mesma ação, ver
// rpc/fato-gerador.ts). nivel_d1/d2/d3 são TEXT referenciando
// ref_nivel_iip(codigo) -- catálogo (buscarNiveisIip), não enum fixo em Zod,
// mesmo tratamento de id_preditor_1/2 (catálogo ref_preditor).
// id_meta_origem/id_insight_origem/id_pre_insight_origem/id_registro_origem
// são independentes entre si: nenhuma combinação (nenhum, um só, mais de um)
// é inválida aqui -- ck_fato_origem só se aplica dentro da RPC quando ela
// decide gravar rel_fato_origem (spec.md P1 AC3/AC4: fato sem origem também
// é válido).
export const fatoGeradorSchema = z
  .object({
    id_contrato: z.number().int().positive("id_contrato é obrigatório"),
    id_tipologia: z.number().int().positive("id_tipologia é obrigatório"),
    // Obrigatório no client mesmo com a coluna nullable no banco (T2,
    // design.md Tech Decisions "titulo nullable": NOT NULL quebraria fatos já
    // gravados; a obrigatoriedade fica só aqui, fonte de verdade dos
    // formulários, CLAUDE.md).
    titulo: z.string().trim().min(1, "titulo é obrigatório"),
    nivel_d1: z.string().nullable().optional(),
    nivel_d2: z.string().nullable().optional(),
    nivel_d3: z.string().nullable().optional(),
    id_preditor_1: z.number().int().positive().nullable().optional(),
    id_preditor_2: z.number().int().positive().nullable().optional(),
    // ck_fato_contribuicao: contribuicao_legisla IS NULL OR BETWEEN 0 AND 5
    contribuicao_legisla: z.number().int().min(0).max(5).nullable().optional(),
    descricao_evidencia: z.string().nullable().optional(),
    // ck_fato_situacao: sem .default() -- mesma convenção de
    // metaSchema.status/sucessoMensalSchema.status (schemas/planejamento.ts):
    // @hookform/resolvers/zod infere o tipo do form pelo INPUT, e .default()
    // tornaria o campo opcional no input. Sempre setado explicitamente em
    // defaultValues do form (T17).
    situacao: z.enum(["projetado", "realizado"]),
    dt_ocorrencia: z.string().nullable().optional(),
    dt_prevista: z.string().nullable().optional(),
    id_meta_origem: z.number().int().positive().nullable().optional(),
    id_insight_origem: z.number().int().positive().nullable().optional(),
    id_pre_insight_origem: z.number().int().positive().nullable().optional(),
    id_registro_origem: z.number().int().positive().nullable().optional(),
  })
  // ck_fato_niveis: COALESCE(nivel_d1, nivel_d2, nivel_d3) IS NOT NULL
  .refine((valor) => valor.nivel_d1 != null || valor.nivel_d2 != null || valor.nivel_d3 != null, {
    message: "Preencha ao menos um nível (D1, D2 ou D3).",
    path: ["nivel_d1"],
  })
  // ck_fato_preditores: secundário exige primário e não pode repeti-lo (mesma
  // regra de ck_meta_preditores/ck_objetivo_preditores em schemas/planejamento.ts)
  .refine(
    (valor) =>
      valor.id_preditor_2 == null ||
      (valor.id_preditor_1 != null && valor.id_preditor_2 !== valor.id_preditor_1),
    {
      message: "id_preditor_2 exige id_preditor_1 e não pode repeti-lo",
      path: ["id_preditor_2"],
    }
  )
  // ck_fato_situacao_data (T2), ramo "realizado": exige dt_ocorrencia
  // (spec.md P1 AC10 -- "Já aconteceu" torna Data de ocorrência obrigatória).
  .refine((valor) => valor.situacao !== "realizado" || valor.dt_ocorrencia != null, {
    message: "Data de ocorrência é obrigatória quando o fato já aconteceu.",
    path: ["dt_ocorrencia"],
  })
  // ck_fato_situacao_data (T2), ramo "projetado": exige dt_prevista
  // (spec.md P1 AC11 -- "Ainda vai acontecer" pede Data prevista).
  .refine((valor) => valor.situacao !== "projetado" || valor.dt_prevista != null, {
    message: "Data prevista é obrigatória para um fato que ainda vai acontecer.",
    path: ["dt_prevista"],
  })
  // spec.md P1 AC11: "SHALL NOT pedir data de ocorrência" -- projetado proíbe
  // dt_ocorrencia (design.md Tasks: ".refine() condicional... proíbe
  // dt_ocorrencia").
  .refine((valor) => valor.situacao !== "projetado" || valor.dt_ocorrencia == null, {
    message: "Fato ainda vai acontecer não deve ter Data de ocorrência.",
    path: ["dt_ocorrencia"],
  });

export type FatoGeradorInput = z.infer<typeof fatoGeradorSchema>;
