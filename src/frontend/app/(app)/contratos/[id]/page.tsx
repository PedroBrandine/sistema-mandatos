"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, buscarEtapasDoProduto } from "@backend/queries/contrato";

import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// NAV-04: redireciona para a 1ª etapa (menor ordem) assim que carrega.
// Cliente, porque a etapa-alvo depende de query (diferente do redirect
// estático de /produtos/[slug], T14). router.replace dentro de useEffect é
// o padrão correto aqui -- diferente de notFound() (FichaContratoChrome,
// T22), que nunca pode ser chamado num efeito. Contrato inexistente já é
// tratado pelo layout.tsx pai.
export default function ContratoIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((contrato) => {
      if (cancelado || !contrato) return;
      buscarEtapasDoProduto(supabase, contrato.idProduto).then((etapas) => {
        if (cancelado || etapas.length === 0) return;
        router.replace(`/contratos/${idContrato}/etapas/${etapas[0].codigo}`);
      });
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato, router]);

  return <CarregandoSkeleton />;
}
