"use client";

import { use, useCallback, useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";
import { buscarDiagnosticoMandato, type DiagnosticoMandato } from "@backend/queries/ficha-mandato";

import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { CardDiagnosticoMandato } from "@/components/fundacao/card-diagnostico-mandato";
import { CardSwotMandato } from "@/components/fundacao/card-swot-mandato";
import { InformacoesTseMandato } from "@/components/fundacao/informacoes-tse-mandato";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";

// DIAG-01..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md).
// Substitui o placeholder anterior (FMC-04, AC6) só para contratos de
// mandato: candidaturas TSE (movidas de "Informações Gerais", DIAG-01..03),
// Diagnóstico do Mandato (campos de texto livre, DIAG-10..17) e Análise SWOT
// (DIAG-18..20). Contratos de coalizão (buscarDiagnosticoMandato devolve
// null -- sem dim_mandato) continuam com o placeholder: conteúdo de
// coalizão é spec própria, fora do escopo desta feature.
export default function ContratoDiagnosticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [dados, setDados] = useState<DiagnosticoMandato | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setErro(null);
    try {
      const resultado = await buscarDiagnosticoMandato(createClient(), idContrato);
      setDados(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o diagnóstico do mandato.");
    }
  }, [idContrato]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  if (dados === undefined) {
    return erro ? <ErroInline mensagem={erro} onRetry={carregarDados} /> : <CarregandoSkeleton />;
  }

  if (erro) {
    return <ErroInline mensagem={erro} onRetry={carregarDados} />;
  }

  if (!dados) {
    return <EmDesenvolvimento titulo="Diagnóstico" />;
  }

  return (
    <div className="grid gap-6">
      <CardDiagnosticoMandato
        idMandato={dados.idMandato}
        principaisDestaques={dados.principaisDestaques}
        cargosLegislatura={dados.cargosLegislatura}
        principaisPls={dados.principaisPls}
        principaisNoticias={dados.principaisNoticias}
        onAtualizado={carregarDados}
      />

      <CardSwotMandato
        idMandato={dados.idMandato}
        swotForcas={dados.swotForcas}
        swotFraquezas={dados.swotFraquezas}
        swotOportunidades={dados.swotOportunidades}
        swotAmeacas={dados.swotAmeacas}
        onAtualizado={carregarDados}
      />

      <InformacoesTseMandato idMandato={dados.idMandato} />
    </div>
  );
}
