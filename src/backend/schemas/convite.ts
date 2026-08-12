import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha convite_contrato (supabase/migrations/20260812001921_convite_contrato_estrutura.sql)
// -- emissão via app.emitir_convite (RPC, T2), nunca insert direto (AD-024,
// invalidação de duplicado é multi-passo). CVT-07: só mentor/assessor, nunca
// admin/gestora/leitura -- mesma guarda do ck_convite_papel/app.consumir_convite,
// aqui espelhada no client pra dar feedback antes do round-trip.
export const convidarSchema = z.object({
  // espelha ck_convite_email: email = lower(btrim(email)) AND email LIKE '%@%.%'
  email: z
    .string()
    .refine((valor) => valor === valor.trim().toLowerCase(), {
      message: "email deve estar em minúsculas e sem espaço nas bordas",
    })
    .refine((valor) => /@.*\./.test(valor), {
      message: "email deve conter '@' seguido de '.' (ex.: nome@dominio.com)",
    }),
  // espelha ck_convite_papel
  papel_no_contrato: z.enum(["mentor", "assessor"]),
  // espelha ck_convite_cargo
  cargo: z
    .enum(["parlamentar", "chefe_gabinete", "assessor", "secretaria_executiva", "nao_se_aplica"])
    .nullable()
    .optional(),
  // espelha domínio texto_limpo
  grau_responsabilidade: textoLimpoSchema,
  areas: z.array(z.string()).nullable().optional(),
});

export type ConvidarInput = z.infer<typeof convidarSchema>;

// Formulário de consumo do convite (/convite/[token]) -- nome + senha, com
// confirmação client-side antes do submit nativo (design.md ConviteConsumoForm).
// minimum_password_length do projeto (supabase/config.toml) é 6.
export const consumirSenhaSchema = z
  .object({
    nome: z.string().trim().min(1, "nome é obrigatório"),
    senha: z.string().min(6, "senha deve ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(1, "confirme a senha"),
  })
  .refine((valor) => valor.senha === valor.confirmarSenha, {
    message: "as senhas não coincidem",
    path: ["confirmarSenha"],
  });

export type ConsumirSenhaInput = z.infer<typeof consumirSenhaSchema>;
