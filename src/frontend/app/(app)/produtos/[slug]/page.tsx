import { redirect } from "next/navigation";

// NAV-01 AC2: /produtos/[slug] sem sub-rota redireciona pra aba Dashboard --
// alvo fixo, não depende de nenhum dado (slug já validado pelo layout pai).
export default async function ProdutoIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/produtos/${slug}/dashboard`);
}
