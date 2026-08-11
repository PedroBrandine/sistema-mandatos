"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, buscarEtapasDoProduto } from "@backend/queries/contrato";

import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// NAV-04: redireciona para a 1ª etapa (menor ordem) assim que carrega.
// Cliente, porque a etapa-alvo depende de query (diferente do redirect
// estático de /produtos/[slug], T14). router.replace dentro de useEffect é
// o padrão correto aqui -- diferente de notFound() (FichaContratoChrome,
// T22), que nunca pode ser chamado num efeito. Contrato inexistente já é
// tratado pelo layout.tsx pai.
//
// Achado do Verifier (validation.md, Fix 2): quando ref_etapa vem vazio pro
// produto (edge case que "não deveria acontecer" -- régua já seedada pros 3
// produtos), o efeito abaixo simplesmente não navegava e a página ficava
// presa no CarregandoSkeleton pra sempre, mesmo a aba "Nenhuma etapa
// cadastrada" (FichaContratoChrome) já existindo. `semEtapas` fecha esse
// estado explicitamente em vez de deixar o efeito morrer em silêncio.
export default function ContratoIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);
  const router = useRouter();
  const [semEtapas, setSemEtapas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((contrato) => {
      if (cancelado || !contrato) return;
      buscarEtapasDoProduto(supabase, contrato.idProduto).then((etapas) => {
        if (cancelado) return;
        if (etapas.length === 0) {
          setSemEtapas(true);
          return;
        }
        router.replace(`/contratos/${idContrato}/etapas/${etapas[0].codigo}`);
      });
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato, router]);

  if (semEtapas) {
    return <EmDesenvolvimento titulo="Nenhuma etapa cadastrada" />;
  }

  return <CarregandoSkeleton />;
}
