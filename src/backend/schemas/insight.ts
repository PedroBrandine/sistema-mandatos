import { z } from "zod";

// Espelha fat_insight (docs/schema_sistema.sql:1063-1074) + rel_insight_origem
// (docs/schema_sistema.sql:1080-1085) -- criado via app.criar_insight (RPC
// SECURITY INVOKER, AD-024: insight + até 2 linhas de vínculo na mesma ação,
// ver rpc/insight.ts). id_meta_origem/id_sucesso_origem são independentes:
// nenhuma combinação (nenhum, só Meta, só Sucesso, os dois) é inválida aqui
// -- ck_insight_origem só se aplica dentro da RPC quando ela decide gravar
// rel_insight_origem, e só grava quando ao menos um dos dois vem preenchido
// (spec.md P2 AC4: "0, 1 ou 2 vínculos simultâneos").
export const insightSchema = z.object({
  id_contrato: z.number().int().positive("id_contrato é obrigatório"),
  conteudo: z.string().trim().min(1, "conteudo é obrigatório"),
  desdobramentos: z.string().nullable().optional(),
  comprovacao_dados: z.string().nullable().optional(),
  ocorrido_em: z.string().nullable().optional(),
  id_pilar: z.number().int().positive().nullable().optional(),
  // trg_valida_insight_contrato: id_registro precisa ser do mesmo contrato --
  // validado pela UI (Select só lista Registros do próprio contrato, ver
  // design.md) e pelo trigger no banco, não expressável em Zod (não há dado
  // de "contrato do registro" disponível no client sem round-trip).
  id_registro: z.number().int().positive().nullable().optional(),
  id_meta_origem: z.number().int().positive().nullable().optional(),
  id_sucesso_origem: z.number().int().positive().nullable().optional(),
});

export type InsightInput = z.infer<typeof insightSchema>;
