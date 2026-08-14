import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha fat_encontro (docs/schema_sistema.sql:786-808) -- INSERT/UPDATE
// direto via PostgREST (design.md Tech Decisions: ações distintas do
// usuário -- criar Encontro e marcar realizado -- sem RPC). Campos cobertos:
// os que design.md descreve para encontro-form.tsx ("status/datas
// condicionais/modalidade/local") + nr_sequencia/id_tipo_registro, o par que
// dá sentido a uq_encontro_sequencia (spec.md P2 AC4). id_etapa/
// tema_prioritario/id_externo_calendar/url_meet ficam fora desta fatia --
// nenhuma menção em spec.md/design.md/tasks.md como campo do formulário.
export const encontroSchema = z
  .object({
    id_contrato: z.number().int().positive("id_contrato é obrigatório"),
    id_tipo_registro: z.number().int().positive().nullable().optional(),
    // ck_encontro_sequencia: nr_sequencia IS NULL OR nr_sequencia > 0
    nr_sequencia: z.number().int().positive().nullable().optional(),
    titulo: z.string().trim().min(1, "titulo é obrigatório"),
    // ck_encontro_status -- sem .default() (ver rationale de metaSchema.status
    // em schemas/planejamento.ts): sempre setado explicitamente em
    // defaultValues do form, nunca implícito no schema.
    status: z.enum(["planejado", "realizado", "cancelado", "remarcado"]),
    dt_prevista_inicio: z.string().nullable().optional(),
    dt_prevista_fim: z.string().nullable().optional(),
    dt_realizada: z.string().nullable().optional(),
    // ck_encontro_modalidade
    modalidade: z.enum(["presencial", "online"]).nullable().optional(),
    local: textoLimpoSchema,
  })
  // ck_encontro_planejado: status <> 'planejado' OR dt_prevista_inicio IS NOT NULL
  .refine((valor) => valor.status !== "planejado" || valor.dt_prevista_inicio != null, {
    message: "Data prevista de início é obrigatória para encontro planejado.",
    path: ["dt_prevista_inicio"],
  })
  // ck_encontro_realizado: status <> 'realizado' OR dt_realizada IS NOT NULL
  .refine((valor) => valor.status !== "realizado" || valor.dt_realizada != null, {
    message: "Data de realização é obrigatória para encontro realizado.",
    path: ["dt_realizada"],
  });

export type EncontroInput = z.infer<typeof encontroSchema>;

// Espelha rel_encontro_participante (docs/schema_sistema.sql:820-829).
export const participanteSchema = z
  .object({
    id_encontro: z.number().int().positive("id_encontro é obrigatório"),
    id_usuario: z.number().int().positive().nullable().optional(),
    nome_livre: textoLimpoSchema,
    // ck_participante_origem
    origem: z.enum(["legisla", "mandato", "externo"]),
    presente: z.boolean().nullable().optional(),
  })
  // ck_participante_identificacao: (id_usuario IS NULL) <> (nome_livre IS NULL) -- XOR
  .refine((valor) => (valor.id_usuario == null) !== (valor.nome_livre == null), {
    message: "Informe um usuário do sistema OU um nome de participante externo, nunca os dois.",
    path: ["id_usuario"],
  });

export type ParticipanteInput = z.infer<typeof participanteSchema>;
