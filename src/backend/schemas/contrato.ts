import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha fat_contrato (supabase/migrations/0009_fundacao_tabelas.sql) -- insert
// direto via PostgREST (design.md ContratoForm.onAbrir/onEncerrar, sem RPC).
// `id_contrato` é opcional e só existe ao editar/encerrar um contrato já criado
// (usado só para checar ck_contrato_nao_e_proprio_anterior contra si mesmo).
export const contratoSchema = z
  .object({
    id_contrato: z.number().int().positive().nullable().optional(),
    id_produto: z.number().int().positive("id_produto é obrigatório"),
    id_projeto: z.number().int().positive().nullable().optional(),
    id_contrato_anterior: z.number().int().positive().nullable().optional(),
    id_cargo_no_contrato: z.number().int().positive().nullable().optional(),
    id_partido_no_contrato: z.number().int().positive().nullable().optional(),
    dt_inicio: z.string("dt_inicio é obrigatório"),
    dt_fim_prevista: z.string().nullable().optional(),
    dt_fim: z.string().nullable().optional(),
    // espelha ck_contrato_status
    status: z.enum(["ativo", "concluido", "nao_concluido"]),
    // espelha domínio texto_limpo
    motivo_encerramento: textoLimpoSchema,
    // espelha ck_contrato_profundidade
    profundidade_impacto: z.enum(["alto", "medio"]).nullable().optional(),
    localizador_legado: z.string().nullable().optional(),
  })
  // espelha ck_contrato_periodo: dt_fim IS NULL OR dt_inicio IS NULL OR dt_fim >= dt_inicio
  .refine((valor) => valor.dt_fim == null || valor.dt_inicio == null || valor.dt_fim >= valor.dt_inicio, {
    message: "dt_fim deve ser maior ou igual a dt_inicio",
    path: ["dt_fim"],
  })
  // espelha ck_contrato_nao_e_proprio_anterior: id_contrato_anterior IS DISTINCT FROM id_contrato
  .refine((valor) => valor.id_contrato == null || valor.id_contrato_anterior !== valor.id_contrato, {
    message: "id_contrato_anterior não pode ser o próprio contrato",
    path: ["id_contrato_anterior"],
  })
  // espelha ck_contrato_motivo: status <> 'nao_concluido' OR motivo_encerramento IS NOT NULL
  // (spec.md FND-CTR AC3: "SHALL exigir motivo_encerramento não vazio")
  .refine((valor) => valor.status !== "nao_concluido" || valor.motivo_encerramento != null, {
    message: "motivo_encerramento é obrigatório quando status='nao_concluido'",
    path: ["motivo_encerramento"],
  });

export type ContratoInput = z.infer<typeof contratoSchema>;
