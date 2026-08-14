import { z } from "zod";

// Espelha fat_fato_gerador (docs/schema_sistema.sql:1098-1117) -- criado via
// app.criar_fato_gerador (RPC SECURITY INVOKER, AD-024: fato + até 2 linhas
// de vínculo na mesma ação, ver rpc/fato-gerador.ts). nivel_d1/d2/d3 são TEXT
// referenciando ref_nivel_iip(codigo) -- catálogo (buscarNiveisIip), não
// enum fixo em Zod, mesmo tratamento de id_preditor_1/2 (catálogo
// ref_preditor). id_meta_origem/id_insight_origem são independentes: nenhuma
// combinação (nenhum, só Meta, só Insight, os dois) é inválida aqui --
// ck_fato_origem só se aplica dentro da RPC quando ela decide gravar
// rel_fato_origem (spec.md P1 AC3/AC4: Meta e Insight não são mutuamente
// exclusivos, fato sem origem também é válido).
export const fatoGeradorSchema = z
  .object({
    id_contrato: z.number().int().positive("id_contrato é obrigatório"),
    id_tipologia: z.number().int().positive("id_tipologia é obrigatório"),
    nivel_d1: z.string().nullable().optional(),
    nivel_d2: z.string().nullable().optional(),
    nivel_d3: z.string().nullable().optional(),
    id_preditor_1: z.number().int().positive().nullable().optional(),
    id_preditor_2: z.number().int().positive().nullable().optional(),
    // ck_fato_contribuicao: contribuicao_legisla IS NULL OR BETWEEN 0 AND 5
    contribuicao_legisla: z.number().int().min(0).max(5).nullable().optional(),
    descricao_evidencia: z.string().nullable().optional(),
    dt_ocorrencia: z.string("dt_ocorrencia é obrigatório"),
    id_meta_origem: z.number().int().positive().nullable().optional(),
    id_insight_origem: z.number().int().positive().nullable().optional(),
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
  );

export type FatoGeradorInput = z.infer<typeof fatoGeradorSchema>;
