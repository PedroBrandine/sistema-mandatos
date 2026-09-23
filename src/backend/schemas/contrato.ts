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
    // espelha ck_contrato_status (AD-066: 'desistente'/'desligado' são status
    // de participação do PLL, mesma coluna)
    status: z.enum(["ativo", "concluido", "nao_concluido", "desistente", "desligado"]),
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
  .refine(
    (valor) =>
      !["nao_concluido", "desistente", "desligado"].includes(valor.status) || valor.motivo_encerramento != null,
    {
      message: "motivo_encerramento é obrigatório quando status='nao_concluido'/'desistente'/'desligado'",
      path: ["motivo_encerramento"],
    }
  );

export type ContratoInput = z.infer<typeof contratoSchema>;

// Espelha o payload `p_contrato` lido por app.criar_mandato
// (supabase/migrations/20260813180132_fnd_ctr_05_snapshot_cargo_partido_contrato.sql:132-146)
// -- o subconjunto que a tela de abertura preenche. Os demais campos de
// fat_contrato não vêm do formulário: `status` é fixado em 'ativo' pela
// própria função, e o snapshot de cargo/partido é copiado do mandato.
//
// Vive aqui, e não inline no formulário, por L-005: a versão inline de
// mandato-wizard.tsx era uma cópia equivalente que podia divergir em silêncio
// deste arquivo. `id_projeto` aceita null porque o campo é opcional na tela.
export const aberturaContratoSchema = z.object({
  id_produto: z.number().int().positive("Obrigatório"),
  id_projeto: z.number().int().positive().nullable().optional(),
  // NOT NULL em fat_contrato, sem default na função -- exigido aqui para não
  // chegar no banco como 23502.
  dt_inicio: z.string().min(10, "Data inválida"),
});

export type AberturaContratoInput = z.infer<typeof aberturaContratoSchema>;
