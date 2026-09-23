"use client";

import { use, useCallback, useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha } from "@backend/queries/contrato";
import { buscarDiagnosticoMandato, type DiagnosticoMandato } from "@backend/queries/ficha-mandato";
import { buscarCadastroParticipanteFichaPorContrato } from "@backend/queries/pll-ficha";

import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { CardDiagnosticoMandato } from "@/components/fundacao/card-diagnostico-mandato";
import { CardSwotMandato } from "@/components/fundacao/card-swot-mandato";
import { InformacoesTseMandato } from "@/components/fundacao/informacoes-tse-mandato";
import { DiagnosticoParticipantePll } from "@/components/pll/diagnostico-participante-pll";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// DIAG-01..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md)
// + DPP-01..DPP-04 (.specs/features/diagnostico-participante-pll/spec.md).
// Substitui o placeholder anterior (FMC-04, AC6). Ramifica por
// `contrato.nomeProduto` ANTES de decidir o resto: contrato do PLL mostra o
// Diagnóstico do Mentorado (DiagnosticoParticipantePll, mesmo componente de
// `/produtos/pll/participantes/[id]`); os demais produtos seguem o fluxo
// existente -- candidaturas TSE (movidas de "Informações Gerais",
// DIAG-01..03), Diagnóstico do Mandato (campos de texto livre, DIAG-10..17)
// e Análise SWOT (DIAG-18..20). Contratos de coalizão (buscarDiagnosticoMandato
// devolve null -- sem dim_mandato) continuam com o placeholder: conteúdo de
// coalizão é spec própria, fora do escopo desta feature.
export default function ContratoDiagnosticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const {
    data: contrato,
    isLoading: carregandoContrato,
    isError: erroContrato,
  } = useQuery({
    queryKey: ["contrato-ficha", idContrato],
    queryFn: () => buscarContratoParaFicha(createClient(), idContrato),
  });

  const ehPll = contrato?.nomeProduto === "PLL";

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
    if (contrato === undefined || ehPll) return;
    void carregarDados();
  }, [carregarDados, contrato, ehPll]);

  const { data: cadastroPll, isLoading: carregandoCadastroPll } = useQuery({
    queryKey: ["pll-diagnostico-por-contrato", idContrato],
    queryFn: () => buscarCadastroParticipanteFichaPorContrato(createClient(), idContrato),
    enabled: ehPll,
  });

  if (carregandoContrato) {
    return <CarregandoSkeleton />;
  }

  if (erroContrato) {
    return <ErroInline mensagem="Não foi possível carregar o contrato desta ficha." />;
  }

  if (ehPll) {
    if (carregandoCadastroPll) {
      return <CarregandoSkeleton />;
    }
    // Edge case (DPP-04): contrato PLL sem linha correspondente em
    // fat_cadastro_participante -- nunca cai no conteúdo de Estratégia.
    if (!cadastroPll) {
      return (
        <EstadoVazio
          titulo="Diagnóstico indisponível"
          mensagem="Este contrato não tem um registro de cadastro do PLL correspondente."
        />
      );
    }
    return <DiagnosticoParticipantePll idCadastroParticipante={cadastroPll.idCadastroParticipante} />;
  }

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
