"use client";

import { use, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

import { AbaIncidencia, PARAM_VISAO } from "@/components/incidencia/aba-incidencia";
import { CadeiaLista } from "@/components/incidencia/cadeia-lista";
import { FatoGeradorForm, type FatoGeradorExistente } from "@/components/incidencia/fato-gerador-form";
import { FatoGeradorWizard } from "@/components/incidencia/fato-gerador-wizard";
import { IncidenciaKpis } from "@/components/incidencia/incidencia-kpis";
import { InsightForm, type InsightExistente } from "@/components/incidencia/insight-form";
import { PreInsightForm, type PreInsightExistente } from "@/components/incidencia/pre-insight-form";
import { RegistroForm, type RegistroExistente } from "@/components/incidencia/registro-form";
import type { OrigemFato } from "@/components/incidencia/seletor-origem";
import { TimelineFeed } from "@/components/incidencia/timeline-feed";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Achado do Verifier (fix task pós-T25, spec.md "A aba como casa única" AC2:
// "item da timeline acionado para edição abre o formulário da própria
// entidade, sem sair da aba"). T23/T24 (e os fixes de Pré-Insight/Fato
// Gerador) já deixaram RegistroForm/InsightForm/PreInsightForm/
// FatoGeradorForm prontos para editar -- faltava esta página conectar o
// clique em "Editar" (TimelineFeed→PainelDetalhe) a um diálogo que abre o
// formulário certo, populado com o registro verdadeiro (busca direta por id
// no clique, não a partir do resumo já carregado -- o resumo tem só campos
// de exibição, não os brutos que o formulário precisa editar). Fato Gerador
// edita a tripla/níveis/título/data via FatoGeradorForm direto (sem passar
// pelo wizard -- natureza/origem não são reabertas na edição; mudar
// `situacao` continua sendo só o RealizarFatoDialog/T19).
type ItemEditando =
  | { tipo: "registro"; dados: RegistroExistente }
  | { tipo: "insight"; dados: InsightExistente }
  | { tipo: "pre_insight"; dados: PreInsightExistente }
  | {
      tipo: "fato_gerador";
      dados: FatoGeradorExistente;
      situacao: "projetado" | "realizado";
      // T16 (pente-fino 2026-09, PF-08 AC4): só preenchido quando o diálogo
      // abre a partir de um card do Ciclo de Vida (CadeiaLista) -- mostra a
      // origem associada (banner somente-leitura que FatoGeradorForm já
      // tem, T17) junto do detalhe do Fato Gerador. Ausente quando abre a
      // partir da Linha do Tempo (abrirEdicao original, T-fix pós-Verifier):
      // edição não reabre origem lá.
      origemParaExibir?: OrigemFato;
    };

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  async function abrirEdicao(item: TimelineItem, origemParaExibir?: OrigemFato) {
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
      return;
    }

    if (item.tipo === "fato_gerador") {
      const { data } = await supabase
        .from("fat_fato_gerador")
        .select("id_fato_gerador, id_tipologia, titulo, situacao, contribuicao_legisla, descricao_evidencia, dt_ocorrencia, dt_prevista")
        .eq("id_fato_gerador", item.idOrigem)
        .maybeSingle();
      if (!data) return;
      setItemEditando({
        tipo: "fato_gerador",
        situacao: data.situacao as "projetado" | "realizado",
        origemParaExibir,
        dados: {
          idFatoGerador: data.id_fato_gerador,
          idTipologia: data.id_tipologia,
          titulo: data.titulo,
          contribuicaoLegisla: data.contribuicao_legisla,
          descricaoEvidencia: data.descricao_evidencia,
          dtOcorrencia: data.dt_ocorrencia,
          dtPrevista: data.dt_prevista,
        },
      });
    }
  }

  // T16 (pente-fino 2026-09, PF-08 AC4): clique num card do Ciclo de Vida
  // (CadeiaLista) abre o detalhe da origem + Fato Gerador associado.
  // Reaproveita o mesmo diálogo/formulário de edição já usado pela Linha do
  // Tempo (abrirEdicao) -- só monta um TimelineItem sintético (o bloco
  // `fato_gerador` de abrirEdicao só usa `idOrigem`) e repassa a origem já
  // resolvida por buscarCadeiasIncidencia para o banner somente-leitura que
  // FatoGeradorForm já exibe (T17).
  function abrirDetalheCicloDeVida(item: CadeiaItem) {
    const origemParaExibir: OrigemFato | undefined = item.origem
      ? { tipo: item.origem.tipo, id: Number(item.chaveOrigem.split(":")[1]), rotulo: item.origem.titulo }
      : undefined;
    void abrirEdicao(
      {
        tipo: "fato_gerador",
        idOrigem: item.idFatoGerador,
        titulo: item.titulo,
        dataEvento: item.dataEvento,
        criadoEm: null,
        idUsuarioAutor: null,
        nomeAutor: null,
      },
      origemParaExibir
    );
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

  function verNoCicloDeVida() {
    // Navegação cruzada "Ver no Ciclo de Vida" (mockup 108:4, acerto de
    // fidelidade visual pós-Verifier) -- mesma troca de querystring que
    // AbaIncidencia usa internamente (router.replace, sem entrada no
    // histórico), só que disparada de dentro da Linha do Tempo.
    const params = new URLSearchParams(searchParams.toString());
    params.set(PARAM_VISAO, "ciclo-de-vida");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const linhaDoTempo = (
    <TimelineFeed
      itens={timelineItens}
      registros={registros}
      insights={insights}
      fatosGeradores={fatosGeradores}
      preInsights={preInsights}
      onEditar={(item) => void abrirEdicao(item)}
      onVerNoCicloDeVida={verNoCicloDeVida}
      onRealizado={() => void carregarTudo()}
    />
  );

  const cicloDeVida = (
    <div className="grid gap-4">
      <IncidenciaKpis idContrato={idContrato} fatosGeradores={fatosGeradores} />
      <CadeiaLista
        cadeias={cadeias}
        onRealizado={() => void carregarTudo()}
        onAbrirDetalhe={abrirDetalheCicloDeVida}
      />
    </div>
  );

  const ROTULO_EDICAO: Record<ItemEditando["tipo"], string> = {
    registro: "Editar Registro",
    insight: "Editar Insight",
    pre_insight: "Editar Pré-Insight",
    fato_gerador: "Editar Fato Gerador",
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
          {itemEditando?.tipo === "fato_gerador" && (
            <FatoGeradorForm
              idContrato={idContrato}
              situacaoInicial={itemEditando.situacao}
              origemInicial={itemEditando.origemParaExibir}
              fatoGeradorExistente={itemEditando.dados}
              onConcluido={aoConcluirEdicao}
              onCancelar={fecharEdicao}
            />
          )}
        </DialogContent>
      </Dialog>

      <AbaIncidencia
        linhaDoTempo={linhaDoTempo}
        cicloDeVida={cicloDeVida}
        criar={[
          // PF-08/T14 (pente-fino 2026-09): "Registrar Registro" saiu do
          // menu Criar da Linha do Tempo/Ciclo de Vida (spec.md P2 AC5) --
          // é ação da Agenda, não destas duas visões. RegistroForm continua
          // importado nesta página só para a edição (abrirEdicao acima).
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
