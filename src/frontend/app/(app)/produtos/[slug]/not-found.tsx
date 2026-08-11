import Link from "next/link";

import { Button } from "@/components/ui/button";

// NAV-02 AC4: UI de 404 com a marca do produto em vez do 404 genérico do
// Next, usada quando o layout.tsx desta rota chama notFound() (slug fora de
// PRODUTO_SLUGS).
export default function ProdutoNotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 p-16 text-center">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
        Produto não encontrado
      </h1>
      <p className="text-sm text-muted-foreground">
        Esse produto não existe no sistema. Volte ao hub e escolha um dos produtos disponíveis.
      </p>
      <Link href="/">
        <Button type="button">Voltar ao hub</Button>
      </Link>
    </div>
  );
}
