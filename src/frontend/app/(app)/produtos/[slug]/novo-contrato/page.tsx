"use client";

import { use } from "react";

import type { ProdutoSlug } from "@backend/queries/produto";

import { NovoContratoView } from "@/components/produtos/novo-contrato-view";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { useProdutoAtual } from "@/hooks/use-produto-atual";

// NAV-09: página fina -- resolve idProduto/nome via useProdutoAtual (T12) e
// delega tudo ao orquestrador NovoContratoView (T20). slug já validado pelo
// layout.tsx pai (T13).
export default function ProdutoNovoContratoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto } = useProdutoAtual(slug);

  if (!produto) {
    return <CarregandoSkeleton />;
  }

  // ProdutoShell abriu para 1800px por causa do Quadro do Dashboard; um
  // formulário nessa largura fica ilegível, então esta aba mantém por conta
  // própria os ~1152px que a tela tinha antes -- centralizados, senão o card
  // fica colado à esquerda com o resto da tela vazio.
  return (
    <div className="mx-auto w-full max-w-6xl">
      <NovoContratoView slug={slug} idProduto={produto.idProduto} nomeProduto={produto.nome} />
    </div>
  );
}
