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
import { InsightForm, type InsightExistente } from "@/components/incidencia/insight-form";
import { PreInsightForm, type PreInsightExistente } from "@/components/incidencia/pre-insight-form";
import { RegistroForm, type RegistroExistente } from "@/components/incidencia/registro-form";
import { TimelineFeed } from "@/components/incidencia/timeline-feed";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Achado do Verifier (fix task pós-T25, spec.md "A aba como casa única" AC2:
// "item da timeline acionado para edição abre o formulário da própria
// entidade, sem sair da aba"). T23/T24 (e o fix de Pré-Insight) já deixaram
// RegistroForm/InsightForm/PreInsightForm prontos para editar -- faltava
// esta página conectar o clique em "Editar" (TimelineFeed→PainelDetalhe) a
// um diálogo que abre o formulário certo, populado com o registro
// verdadeiro (busca direta por id no clique, não a partir do resumo já
// carregado -- o resumo tem só campos de exibição, não os brutos que o
// formulário precisa editar). Fato Gerador fica de fora (TimelineFeed já
// nunca oferece "Editar" para esse tipo): o wizard é só de criação, editar
// a tripla/níveis/situação de um fato já classificado não foi desenhado.
type ItemEditando =
  | { tipo: "registro"; dados: RegistroExistente }
  | { tipo: "insight"; dados: InsightExistente }
  | { tipo: "pre_insight"; dados: PreInsightExistente };

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
  const [itemEditando, setItemEditando] = useState<ItemEditando | null>(null);

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

  async function abrirEdicao(item: TimelineItem) {
    const supabase = createClient();

    if (item.tipo === "registro") {
      const { data } = await supabase
        .from("fat_registro")
        .select("id_registro, id_tipo_registro, ocorrido_em, nr_sequencia, id_encontro, resumo")
        .eq("id_registro", item.idOrigem)
        .maybeSingle();
      if (!data) return;
      setItemEditando({
        tipo: "registro",
        dados: {
          idRegistro: data.id_registro,
          idTipoRegistro: data.id_tipo_registro,
          ocorridoEm: data.ocorrido_em,
          nrSequencia: data.nr_sequencia,
          idEncontro: data.id_encontro,
          resumo: data.resumo,
        },
      });
      return;
    }

    if (item.tipo === "insight") {
      const { data } = await supabase
        .from("fat_insight")
        .select("id_insight, conteudo, desdobramentos, comprovacao_dados, ocorrido_em, id_pilar, id_registro")
        .eq("id_insight", item.idOrigem)
        .maybeSingle();
      if (!data) return;
      setItemEditando({
        tipo: "insight",
        dados: {
          idInsight: data.id_insight,
          conteudo: data.conteudo,
          desdobramentos: data.desdobramentos,
          comprovacaoDados: data.comprovacao_dados,
          ocorridoEm: data.ocorrido_em,
          idPilar: data.id_pilar,
          idRegistro: data.id_registro,
        },
      });
      return;
    }

    if (item.tipo === "pre_insight") {
      const { data } = await supabase
        .from("fat_pre_insight")
        .select("id_pre_insight, conteudo, ocorrido_em")
        .eq("id_pre_insight", item.idOrigem)
        .maybeSingle();
      if (!data) return;
      setItemEditando({
        tipo: "pre_insight",
        dados: { idPreInsight: data.id_pre_insight, conteudo: data.conteudo, ocorridoEm: data.ocorrido_em },
      });
    }
  }

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
      onEditar={(item) => void abrirEdicao(item)}
    />
  );

  const cicloDeVida = (
    <div className="grid gap-4">
      <IncidenciaKpis idContrato={idContrato} fatosGeradores={fatosGeradores} />
      <CadeiaLista cadeias={cadeias} />
    </div>
  );

  const ROTULO_EDICAO: Record<ItemEditando["tipo"], string> = {
    registro: "Editar Registro",
    insight: "Editar Insight",
    pre_insight: "Editar Pré-Insight",
  };

  function fecharEdicao() {
    setItemEditando(null);
  }

  function aoConcluirEdicao() {
    fecharEdicao();
    void carregarTudo();
  }

  return (
    <>
      <Dialog open={itemEditando != null} onOpenChange={(aberto) => !aberto && fecharEdicao()}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{itemEditando ? ROTULO_EDICAO[itemEditando.tipo] : ""}</DialogTitle>
          </DialogHeader>
          {itemEditando?.tipo === "registro" && (
            <RegistroForm idContrato={idContrato} registroExistente={itemEditando.dados} onConcluido={aoConcluirEdicao} />
          )}
          {itemEditando?.tipo === "insight" && (
            <InsightForm
              idContrato={idContrato}
              insightExistente={itemEditando.dados}
              onConcluido={aoConcluirEdicao}
              onCancelar={fecharEdicao}
            />
          )}
          {itemEditando?.tipo === "pre_insight" && (
            <PreInsightForm idContrato={idContrato} preInsightExistente={itemEditando.dados} onConcluido={aoConcluirEdicao} />
          )}
        </DialogContent>
      </Dialog>

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
    </>
  );
}
