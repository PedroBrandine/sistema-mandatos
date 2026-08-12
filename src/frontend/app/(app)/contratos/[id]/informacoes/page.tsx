"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";

import { InformacoesTseMandato } from "@/components/fundacao/informacoes-tse-mandato";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// Aba "Informações Gerais" da ficha do contrato -- pedido direto de Pedro
// após o fechamento da feature navegacao-por-produto, primeira aba (antes
// das etapas) só quando tipo_contratante === 'mandato' (ver
// ficha-contrato-chrome.tsx). Contrato de coalizão ou tipo genérico não tem
// aba correspondente no chrome, então acessar esta rota direto por URL
// responde 404 -- mesma técnica das demais sub-rotas desta ficha: contrato
// (ou o ramo errado dele) === null no corpo do render, nunca dentro do
// useEffect que popula o estado.
export default function InformacoesContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((encontrado) => {
      if (cancelado) return;
      const valido = encontrado && encontrado.tipoContratante === "mandato" && encontrado.idMandato != null;
      setContrato(valido ? encontrado : null);
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato]);

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined) {
    return <CarregandoSkeleton />;
  }

  return <InformacoesTseMandato idMandato={contrato.idMandato as number} />;
}
