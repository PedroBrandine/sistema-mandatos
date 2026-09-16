import { z } from "zod";

// Espelha fat_pre_insight (T1, supabase/migrations/20260916153343_incidencia_v2_pre_insight.sql)
// -- entidade nova (AD-055): sinal bruto captado pela assessoria antes de
// amadurecer em Insight. INSERT direto (sem RPC, mesmo padrão de
// registro-form.tsx) -- id_usuario_autor é resolvido pela sessão
// (usePapelGlobal), nunca recebido deste schema (spec.md P1 "Pré-Insight
// como entidade" AC2).
export const preInsightSchema = z.object({
  id_contrato: z.number().int().positive("id_contrato é obrigatório"),
  conteudo: z.string().trim().min(1, "conteudo é obrigatório"),
  ocorrido_em: z.string().nullable().optional(),
});

export type PreInsightInput = z.infer<typeof preInsightSchema>;
