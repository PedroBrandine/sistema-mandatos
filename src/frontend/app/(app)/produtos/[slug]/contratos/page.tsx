"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@backend/supabase/client";
import { buscarContratosAtivosPorProduto, type ContratoAtivoResumo } from "@backend/queries/contrato";
import type { ProdutoSlug } from "@backend/queries/produto";
import { useProdutoAtual } from "@/hooks/use-produto-atual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// NAV-03: card por fat_contrato ativo do produto. slug já validado pelo
// layout.tsx pai (T13) -- única fronteira de validação, ver design.md.
export default function ProdutoContratosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto } = useProdutoAtual(slug);
  const [contratos, setContratos] = useState<ContratoAtivoResumo[] | null>(null);

  useEffect(() => {
    if (!produto) return;
    let cancelado = false;

    buscarContratosAtivosPorProduto(createClient(), produto.idProduto).then((lista) => {
      if (!cancelado) setContratos(lista);
    });

    return () => {
      cancelado = true;
    };
  }, [produto]);

  if (contratos === null) {
    return <CarregandoSkeleton />;
  }

  if (contratos.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum contrato ativo"
        mensagem="Este produto ainda não tem contrato ativo."
        acao={
          <Link href={`/produtos/${slug}/novo-contrato`}>
            <Button type="button">Cadastrar novo contrato</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contratos.map((c) => (
        <Link key={c.idContrato} href={`/contratos/${c.idContrato}`} className="group">
          <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader>
              <CardTitle>{c.nomeContratante}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Início: {new Date(c.dtInicio).toLocaleDateString("pt-BR")}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
