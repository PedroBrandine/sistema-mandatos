import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { hashToken } from "@backend/lib/convite-token";
import { checarRateLimitConvite } from "@backend/queries/convite";
import { consumirConvite } from "@backend/rpc/consumir-convite";
import { createAdminClient } from "@backend/supabase/admin";
import { createClient } from "@backend/supabase/server";

function extrairIp(request: NextRequest): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return "0.0.0.0";
}

// CVT-06/08/10. Adaptador fino em volta de consumirConvite (T10) -- extrai
// token/nome/senha do POST nativo (ConviteConsumoForm, T14), traduz o
// resultado em redirect. Rate limit checado de novo aqui (defesa em
// profundidade sobre o check já feito no GET da página, T13) antes de
// qualquer chamada a consumirConvite.
//
// Vive em /convite/[token]/consumir (não em /convite/[token], onde já mora
// o page.tsx, T13) -- o Next.js App Router não permite page.tsx e route.ts
// no mesmo segmento (erro de build: "Conflicting route and page").
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const ip = extrairIp(request);

  const permitido = await checarRateLimitConvite(admin, ip);
  if (!permitido) {
    redirect(`/convite/${token}?erro=${encodeURIComponent("Muitas tentativas. Tente novamente em alguns minutos.")}`);
  }

  const formData = await request.formData();
  const nome = String(formData.get("nome") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  const tokenHash = await hashToken(token);
  const server = await createClient();

  const resultado = await consumirConvite({ admin, server }, { tokenHash, nome, senha });

  if (resultado.tipo === "erro") {
    redirect(`/convite/${token}?erro=${encodeURIComponent(resultado.mensagem)}`);
  }
  if (resultado.tipo === "sucesso_sem_login") {
    // `motivo` -- achado do Verifier independente (rodada 2, validation.md):
    // as 3 causas de "sem login automático" caíam todas no mesmo
    // ?msg=conta_existente, rótulo incorreto pras outras duas (a conta
    // acabou de ser criada, não é uma conta "existente").
    redirect(`/login?msg=${resultado.motivo}`);
  }
  redirect("/");
}
