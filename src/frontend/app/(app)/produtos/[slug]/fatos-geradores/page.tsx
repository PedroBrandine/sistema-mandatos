"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { buscarEstrategiaKpi } from "@backend/queries/estrategia-kpi";
import { buscarIncidenciaDoProduto } from "@backend/queries/incidencia-produto";
import { buscarMandatosLista, type ContratoCard } from "@backend/queries/mandatos-lista";
import { buscarGestorasAtivas, buscarProjetosAtivos } from "@backend/queries/opcoes-filtro";
import type { ProdutoSlug } from "@backend/queries/produto";
import { createClient } from "@backend/supabase/client";

import { AbaIncidencia } from "@/components/incidencia/aba-incidencia";
import { CadeiaLista } from "@/components/incidencia/cadeia-lista";
import { IipCard, IipKpiCard } from "@/components/incidencia/iip-card";
import { IncidenciaKpis } from "@/components/incidencia/incidencia-kpis";
import { TimelineFeed } from "@/components/incidencia/timeline-feed";
import { FiltrosFatosGeradores, type ValorFiltrosFatosGeradores } from "@/components/estrategia/filtros-fatos-geradores";
import { listaOuUndefined } from "@/components/ui/multi-select-pesquisavel";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { useProdutoAtual } from "@/hooks/use-produto-atual";
import type { ContratoIdentificado } from "@/lib/incidencia-contrato";

// Aba "Fatos Geradores" do produto -- a Incidência (Linha do Tempo + Ciclo de
// Vida) de TODOS os mandatos do produto numa tela, com filtros de Gestora,
// Projeto e Contrato. Mesma aba que a ficha do contrato tem
// (/contratos/[id]/fatos-registros), só que agregada.
//
// Somente leitura, de propósito: criar/editar Registro, Pré-Insight, Insight e
// Fato Gerador continua exclusivo da ficha do contrato (AD-057) -- aqui não há
// um contrato para vincular o que fosse criado. Cada item mostra de qual
// mandato é e leva à ficha, onde se edita.
//
// A lista de contratos vem de buscarMandatosLista (mesma fonte da aba
// Mandatos, então Gestora e Projeto filtram do mesmo jeito lá e aqui), sem
// filtro de status: mandato concluído ou desligado também tem histórico de
// incidência.

// O contratante sozinho não distingue dois contratos do mesmo parlamentar
// (projetos diferentes), então o projeto entra no rótulo quando existe.
function rotuloContrato(m: ContratoCard): string {
  return m.nomeProjeto ? `${m.nomeContratante} · ${m.nomeProjeto}` : m.nomeContratante;
}

const CLASSE_IIP = "sm:w-full lg:w-[380px] lg:flex-none";

export default function ProdutoFatosGeradoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto } = useProdutoAtual(slug);
  const [filtro, setFiltro] = useState<ValorFiltrosFatosGeradores>({});

  const { data: gestoras } = useQuery({
    queryKey: ["fatos-geradores-gestoras"],
    queryFn: () => buscarGestorasAtivas(createClient()),
  });
  const { data: projetos } = useQuery({
    queryKey: ["fatos-geradores-projetos"],
    queryFn: () => buscarProjetosAtivos(createClient()),
  });

  // Contratos que Gestora e Projeto deixam passar -- é também a lista de
  // opções do dropdown Contrato.
  const { data: mandatos, error: erroMandatos } = useQuery<ContratoCard[]>({
    queryKey: ["fatos-geradores-mandatos", produto?.idProduto, filtro.idsGestora, filtro.idsProjeto],
    queryFn: () =>
      buscarMandatosLista(createClient(), {
        idProduto: produto!.idProduto,
        idsGestora: filtro.idsGestora,
        idsProjeto: filtro.idsProjeto,
      }),
    enabled: produto !== undefined,
  });

  // Contratos escolhidos que o recorte Gestora/Projeto ainda deixa passar.
  // Trocar Gestora ou Projeto pode tirar da lista um contrato já marcado; em
  // vez de apagar a seleção inteira (e perder os que continuam válidos), o
  // marcado que saiu da lista simplesmente deixa de valer -- e volta a valer se
  // o recorte o trouxer de volta. Nada filtra por algo que o dropdown não mostra.
  const idsContratoEscolhidos = useMemo(() => {
    const escolhidos = filtro.idsContrato ?? [];
    if (!mandatos || escolhidos.length === 0) return [];
    const disponiveis = new Set(mandatos.map((m) => m.idContrato));
    return escolhidos.filter((id) => disponiveis.has(id));
  }, [mandatos, filtro.idsContrato]);

  const idsContrato = useMemo(() => {
    if (!mandatos) return [];
    return idsContratoEscolhidos.length > 0 ? idsContratoEscolhidos : mandatos.map((m) => m.idContrato);
  }, [mandatos, idsContratoEscolhidos]);

  const {
    data: incidencia,
    error: erroIncidencia,
    refetch,
  } = useQuery({
    queryKey: ["fatos-geradores-incidencia", idsContrato],
    queryFn: () => buscarIncidenciaDoProduto(createClient(), idsContrato),
    // Sem mandato no recorte não há o que ler (a tela mostra estado vazio).
    enabled: mandatos !== undefined && mandatos.length > 0,
  });

  // IIP: com UM contrato escolhido, é o IIP dele; com nenhum ou vários, a média
  // do recorte -- Gestora/Projeto e, se houver, os contratos marcados --
  // calculada no banco (fn_estrategia_kpi, AD-003 -- nada é calculado nesta
  // tela, e nada é somado aqui: a média de vários contratos não sai de médias
  // parciais).
  const contratoUnico = idsContratoEscolhidos.length === 1 ? idsContratoEscolhidos[0] : undefined;
  const { data: kpiMedio, error: erroKpi } = useQuery({
    queryKey: [
      "fatos-geradores-iip-medio",
      produto?.idProduto,
      filtro.idsGestora,
      filtro.idsProjeto,
      idsContratoEscolhidos,
    ],
    queryFn: () =>
      buscarEstrategiaKpi(createClient(), {
        idProduto: produto!.idProduto,
        idsGestora: filtro.idsGestora,
        idsProjeto: filtro.idsProjeto,
        idsContrato: listaOuUndefined(idsContratoEscolhidos),
      }),
    enabled: produto !== undefined && contratoUnico === undefined,
  });

  const contratos = useMemo(() => {
    const mapa = new Map<number, ContratoIdentificado>();
    for (const m of mandatos ?? []) {
      mapa.set(m.idContrato, { nome: rotuloContrato(m), href: `/contratos/${m.idContrato}/fatos-registros` });
    }
    return mapa;
  }, [mandatos]);

  const opcoesContrato = useMemo(
    () => (mandatos ?? []).map((m) => ({ id: m.idContrato, nome: rotuloContrato(m) })),
    [mandatos]
  );

  const cabecalho = (
    <div>
      <h2 className="text-2xl font-bold text-secondary">Fatos Geradores</h2>
      <p className="text-sm text-muted-foreground">
        Linha do Tempo e Ciclo de Vida de todos os mandatos. Para registrar ou editar, abra a ficha do mandato.
      </p>
    </div>
  );

  const barraDeFiltros = (
    <FiltrosFatosGeradores
      filtro={filtro}
      onChange={setFiltro}
      gestoras={gestoras ?? []}
      projetos={projetos ?? []}
      contratos={opcoesContrato}
    />
  );

  if (produto === undefined) {
    return <CarregandoSkeleton />;
  }

  // O cabeçalho e a barra de filtros ficam sempre montados: cada mudança de
  // filtro troca a chave das consultas e, se a tela toda caísse no skeleton, o
  // select desmontaria no meio da interação. Só a área de conteúdo carrega.
  function conteudo() {
    const erro = erroMandatos ?? erroIncidencia;
    if (erro) {
      return (
        <ErroInline
          mensagem={erro instanceof Error ? erro.message : "Falha ao carregar os fatos geradores."}
          onRetry={() => void refetch()}
        />
      );
    }

    if (mandatos === undefined) return <CarregandoSkeleton />;

    // Sem mandato no recorte não há Incidência nem KPI a mostrar -- um estado
    // vazio nomeado, não uma tela de zeros que pareceria "medimos e deu zero".
    if (mandatos.length === 0) {
      return (
        <EstadoVazio titulo="Nenhum mandato neste recorte" mensagem="Ajuste Gestora ou Projeto para ver os fatos geradores." />
      );
    }

    if (incidencia === undefined) return <CarregandoSkeleton />;

    const iip =
      contratoUnico !== undefined ? (
        <IipCard idContrato={contratoUnico} className={CLASSE_IIP} />
      ) : (
        <IipKpiCard
          titulo="IIP médio — Índ. de impacto"
          carregando={kpiMedio === undefined && !erroKpi}
          erro={erroKpi ? (erroKpi instanceof Error ? erroKpi.message : "Falha ao carregar o IIP.") : null}
          valor={kpiMedio?.iipMedio ?? null}
          d1={kpiMedio?.componenteD1Medio ?? null}
          d2={kpiMedio?.componenteD2Medio ?? null}
          d3={kpiMedio?.componenteD3Medio ?? null}
          mensagemVazia="sem fato gerador realizado"
          formatarValor={(v) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}
          className={CLASSE_IIP}
        />
      );

    const linhaDoTempo = (
      <TimelineFeed
        itens={incidencia.timeline}
        registros={incidencia.registros}
        insights={incidencia.insights}
        fatosGeradores={incidencia.fatosGeradores}
        preInsights={incidencia.preInsights}
        contratos={contratos}
        periodoInicio={filtro.periodoInicio}
        periodoFim={filtro.periodoFim}
        onPeriodoInicioChange={(periodoInicio) => setFiltro({ ...filtro, periodoInicio: periodoInicio || undefined })}
        onPeriodoFimChange={(periodoFim) => setFiltro({ ...filtro, periodoFim: periodoFim || undefined })}
      />
    );

    const resumo = (
      <IncidenciaKpis
        iip={iip}
        fatosGeradores={incidencia.fatosGeradores}
        totalInsights={incidencia.insights.length}
        totalPreInsights={incidencia.preInsights.length}
        totalRegistros={incidencia.registros.length}
      />
    );

    const cicloDeVida = <CadeiaLista cadeias={incidencia.cadeias} contratos={contratos} />;

    return <AbaIncidencia linhaDoTempo={linhaDoTempo} cicloDeVida={cicloDeVida} criar={[]} resumo={resumo} />;
  }

  return (
    <div className="grid gap-7">
      {cabecalho}
      {barraDeFiltros}
      {conteudo()}
    </div>
  );
}
