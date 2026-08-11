"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, buscarEtapasDoProduto, type EtapaResumo } from "@backend/queries/contrato";

import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// NAV-04 AC2: cada etapa é uma aba real, vazia de conteúdo por ora (que
// dependeria de fat_etapa_contrato, não provisionada). codigo que não
// corresponde a nenhuma etapa do produto responde 404 -- mesma técnica de
// FichaContratoChrome (T22): notFound() no corpo do render, nunca dentro do
// useEffect que popula o estado.
export default function EtapaContratoPage({
  params,
}: {
  params: Promise<{ id: string; codigo: string }>;
}) {
  const { id, codigo } = use(params);
  const idContrato = Number(id);

  const [etapa, setEtapa] = useState<EtapaResumo | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((contrato) => {
      if (cancelado) return;
      if (!contrato) {
        setEtapa(null);
        return;
      }
      buscarEtapasDoProduto(supabase, contrato.idProduto).then((etapas) => {
        if (cancelado) return;
        setEtapa(etapas.find((e) => e.codigo === codigo) ?? null);
      });
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato, codigo]);

  if (etapa === null) {
    notFound();
  }

  if (etapa === undefined) {
    return <CarregandoSkeleton />;
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Etapa {etapa.ordem}</p>
      <EmDesenvolvimento titulo={`${etapa.nome} em desenvolvimento`} />
    </div>
  );
}
