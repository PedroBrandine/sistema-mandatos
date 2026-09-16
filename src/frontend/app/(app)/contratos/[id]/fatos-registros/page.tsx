"use client";

import { use, useCallback, useEffect, useState } from "react";

import {
  buscarCadeiasIncidencia,
  buscarFatosGeradoresDoContrato,
  buscarInsightsDoContrato,
  buscarPreInsightsDoContrato,
  buscarRegistrosDoContrato,
  buscarTimelineIncidencia,
  type CadeiaItem,
  type FatoGeradorResumo,
  type InsightResumo,
  type PreInsightResumo,
  type RegistroResumo,
  type TimelineItem,
} from "@backend/queries/incidencia";
import { createClient } from "@backend/supabase/client";

import { AbaIncidencia } from "@/components/incidencia/aba-incidencia";
import { CadeiaLista } from "@/components/incidencia/cadeia-lista";
import { FatoGeradorWizard } from "@/components/incidencia/fato-gerador-wizard";
import { IncidenciaKpis } from "@/components/incidencia/incidencia-kpis";
import { InsightForm } from "@/components/incidencia/insight-form";
import { PreInsightForm } from "@/components/incidencia/pre-insight-form";
import { RegistroForm } from "@/components/incidencia/registro-form";
import { TimelineFeed } from "@/components/incidencia/timeline-feed";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// FGC-16 (T25, fatos-geradores-ciclo-vida). Página da aba "Fatos Geradores e
// Registros" -- casa única de leitura E escrita das 4 entidades (AD-057).
// Substitui o placeholder `<EmDesenvolvimento>` que `ficha-mandato-contrato`
// (FMC-04) deixou aqui de propósito ("já tem dona"). Monta AbaIncidencia com
// as duas visões e o menu Criar; todo o dado vive no estado desta página
// (mesmo padrão de etapas/[codigo]/page.tsx) -- trocar de visão não remonta
// nada porque AbaIncidencia renderiza condicionalmente sobre os MESMOS
// ReactNode já compostos aqui, não refaz fetch.
export default function ContratoFatosRegistrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [carregando, setCarregando] = useState(true);
  const [registros, setRegistros] = useState<RegistroResumo[]>([]);
  const [insights, setInsights] = useState<InsightResumo[]>([]);
  const [fatosGeradores, setFatosGeradores] = useState<FatoGeradorResumo[]>([]);
  const [preInsights, setPreInsights] = useState<PreInsightResumo[]>([]);
  const [timelineItens, setTimelineItens] = useState<TimelineItem[]>([]);
  const [cadeias, setCadeias] = useState<CadeiaItem[]>([]);

  const carregarTudo = useCallback(async () => {
    const supabase = createClient();
    const [registrosD, insightsD, fatosD, preInsightsD, timelineD, cadeiasD] = await Promise.all([
      buscarRegistrosDoContrato(supabase, idContrato),
      buscarInsightsDoContrato(supabase, idContrato),
      buscarFatosGeradoresDoContrato(supabase, idContrato),
      buscarPreInsightsDoContrato(supabase, idContrato),
      buscarTimelineIncidencia(supabase, idContrato),
      buscarCadeiasIncidencia(supabase, idContrato),
    ]);
    setRegistros(registrosD);
    setInsights(insightsD);
    setFatosGeradores(fatosD);
    setPreInsights(preInsightsD);
    setTimelineItens(timelineD);
    setCadeias(cadeiasD);
    setCarregando(false);
  }, [idContrato]);

  useEffect(() => {
    // set-state-in-effect é falso-positivo aqui (mesmo racional de
    // encontros-lista.tsx): todo setState de `carregarTudo` roda depois do
    // `await Promise.all`, nunca síncrono ao efeito. `carregarTudo` não pode
    // ser declarada dentro do efeito porque os 4 onConcluido do menu Criar
    // também a chamam para recarregar sem sair da aba (AC8).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarTudo();
  }, [carregarTudo]);

  if (carregando) {
    return <CarregandoSkeleton />;
  }

  const linhaDoTempo = (
    <TimelineFeed
      itens={timelineItens}
      registros={registros}
      insights={insights}
      fatosGeradores={fatosGeradores}
      preInsights={preInsights}
    />
  );

  const cicloDeVida = (
    <div className="grid gap-4">
      <IncidenciaKpis idContrato={idContrato} fatosGeradores={fatosGeradores} />
      <CadeiaLista cadeias={cadeias} />
    </div>
  );

  return (
    <AbaIncidencia
      linhaDoTempo={linhaDoTempo}
      cicloDeVida={cicloDeVida}
      criar={[
        {
          rotulo: "Registrar Registro",
          renderizar: (fechar) => (
            <RegistroForm
              idContrato={idContrato}
              onConcluido={() => {
                fechar();
                void carregarTudo();
              }}
            />
          ),
        },
        {
          rotulo: "Registrar Pré-Insight",
          renderizar: (fechar) => (
            <PreInsightForm
              idContrato={idContrato}
              onConcluido={() => {
                fechar();
                void carregarTudo();
              }}
            />
          ),
        },
        {
          rotulo: "Registrar Insight",
          renderizar: (fechar) => (
            <InsightForm
              idContrato={idContrato}
              onConcluido={() => {
                fechar();
                void carregarTudo();
              }}
              onCancelar={fechar}
            />
          ),
        },
        {
          rotulo: "Registrar Fato Gerador",
          renderizar: (fechar) => (
            <FatoGeradorWizard
              idContrato={idContrato}
              onConcluido={() => {
                fechar();
                void carregarTudo();
              }}
              onCancelar={fechar}
            />
          ),
        },
      ]}
    />
  );
}
