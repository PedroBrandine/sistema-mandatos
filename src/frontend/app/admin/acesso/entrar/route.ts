import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createAdminClient } from "@backend/supabase/admin";
import { createClient } from "@backend/supabase/server";

// Contraparte de scripts/gerar-link-acesso.ts, mas sem o passo manual de
// copiar/colar um link -- gera e consome o magic link no mesmo request,
// direto no servidor. NODE_ENV só é "development" sob `next dev`; em
// qualquer build (`next build`/`next start`, inclusive Preview na Vercel,
// que builda com NODE_ENV=production) esta rota fica inerte -- é a
// blindagem contra expor generateLink (service_role) fora da máquina do
// dev, sem precisar de nenhum token secreto adicional.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    redirect("/admin/acesso?error=" + encodeURIComponent("Disponível só em ambiente de desenvolvimento local."));
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email.endsWith("@legislabrasil.org")) {
    redirect("/admin/acesso?error=" + encodeURIComponent("Só e-mails @legislabrasil.org."));
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (error || !data) {
    redirect("/admin/acesso?error=" + encodeURIComponent(error?.message ?? "Erro ao gerar acesso."));
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: data.properties.verification_type as EmailOtpType,
    token_hash: data.properties.hashed_token,
  });

  if (verifyError) {
    redirect("/admin/acesso?error=" + encodeURIComponent(verifyError.message));
  }

  redirect("/");
}
