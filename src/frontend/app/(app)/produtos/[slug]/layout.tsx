import { notFound } from "next/navigation";

import { isProdutoSlug } from "@backend/queries/produto";
import { ProdutoShell } from "@/components/produtos/produto-shell";

// NAV-02 AC4: valida o slug contra o mapa fixo de 3 produtos (comparação de
// string, sem round-trip ao banco -- ver design.md, Tech Decisions) e chama
// notFound() se inválido. Server Component -- Next 16, params é Promise.
export default async function ProdutoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isProdutoSlug(slug)) {
    notFound();
  }

  return <ProdutoShell slug={slug}>{children}</ProdutoShell>;
}
