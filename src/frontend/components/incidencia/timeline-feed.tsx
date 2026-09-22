"use client";

import { useMemo, useState } from "react";
import { Calendar, Check, Landmark, Tag } from "lucide-react";

import type {
  FatoGeradorResumo,
  InsightResumo,
  PreInsightResumo,
  RegistroResumo,
  TimelineItem,
} from "@backend/queries/incidencia";
import type { MapaContratos } from "@/lib/incidencia-contrato";
import { agrupaPorMes } from "@/lib/incidencia-timeline";
import { DESTAQUE_FATO_GERADOR, TIPO_ESTILO, TIPO_ROTULO } from "@/lib/incidencia-visual";

import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PainelDetalhe } from "./painel-detalhe";
import { RealizarFatoDialog } from "./realizar-fato-dialog";

// FGC-10 (T20, fatos-geradores-ciclo-vida). Feed cronológico agrupado por mês
// (agrupaPorMes, T13) com filtro por tipo (AC2) e por período (AC3) --
// filtragem client-side, os 4 tipos já vêm carregados de uma vez (view
// única, T5/T12). Compõe PainelDetalhe internamente: seleciona o item e
// resolve o resumo completo do tipo certo pelo id de origem.
//
// Acerto de fidelidade visual (pós-Verifier, mockup 108:4 via
// figma-design-to-code): cor por tipo, marcador na linha do tempo, chip de
// filtro, "Por: <nome>" e o trecho descritivo por card. Os campos exibidos
// são só os que já existem nos *Resumo (nenhum "Fonte"/"Local"/badge
// inventado -- isso é reincidência catalogada em figma-dominio-legisla e
// já ficou de fora deliberadamente, ver context.md).
export interface TimelineFeedProps {
  itens: TimelineItem[];
  registros: RegistroResumo[];
  insights: InsightResumo[];
  fatosGeradores: FatoGeradorResumo[];
  preInsights: PreInsightResumo[];
  // Achado do Verifier (fix task pós-T25, spec.md "aba como casa única"
  // AC2): repassado a PainelDetalhe para qualquer tipo selecionado -- as 4
  // entidades têm formulário de edição (Fato Gerador ganhou em
  // fato-gerador-form.tsx logo após o Verifier apontar o gap).
  onEditar?: (item: TimelineItem) => void;
  // Opcional: navegação cruzada para o Ciclo de Vida a partir de um Fato
  // Gerador selecionado ("Ver no Ciclo de Vida", mockup 108:4). Só a página
  // sabe trocar a visão (querystring `?visao=`), por isso é um callback.
  onVerNoCicloDeVida?: () => void;
  // T14 (pente-fino 2026-09, PF-08): recarrega os dados depois de marcar um
  // Fato Gerador projetado como realizado pelo card (RealizarFatoDialog).
  onRealizado?: () => void;
  // Aba agregada do produto: quando a lista mistura vários mandatos, cada
  // card e o painel dizem de qual é o item. Ausente na aba do contrato.
  contratos?: MapaContratos;
  // Filtro de período controlado de fora (produto: fica junto de
  // Gestora/Projeto/Contrato na barra de filtros do topo, T-fix pós-Figma).
  // Sem essas props, o período volta a ser interno -- caso do contrato, que
  // não tem barra de filtros por cima da aba.
  periodoInicio?: string;
  periodoFim?: string;
  onPeriodoInicioChange?: (valor: string) => void;
  onPeriodoFimChange?: (valor: string) => void;
}

const TIPOS: TimelineItem["tipo"][] = ["pre_insight", "registro", "insight", "fato_gerador"];

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function chave(item: TimelineItem): string {
  return `${item.tipo}-${item.idOrigem}`;
}

export function TimelineFeed({
  itens,
  registros,
  insights,
  fatosGeradores,
  preInsights,
  onEditar,
  onVerNoCicloDeVida,
  onRealizado,
  contratos,
  periodoInicio: periodoInicioControlado,
  periodoFim: periodoFimControlado,
  onPeriodoInicioChange,
  onPeriodoFimChange,
}: TimelineFeedProps) {
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<TimelineItem["tipo"]>>(() => new Set(TIPOS));
  const [periodoInicioInterno, setPeriodoInicioInterno] = useState("");
  const [periodoFimInterno, setPeriodoFimInterno] = useState("");
  const [selecionado, setSelecionado] = useState<TimelineItem | null>(null);

  // Controlado (barra de filtros do produto) quando o chamador passa
  // `onPeriodoXChange`; sem isso, o estado é interno (aba do contrato, que
  // não tem onde mais colocar esse filtro).
  const periodoControlado = onPeriodoInicioChange !== undefined;
  const periodoInicio = periodoControlado ? (periodoInicioControlado ?? "") : periodoInicioInterno;
  const periodoFim = periodoControlado ? (periodoFimControlado ?? "") : periodoFimInterno;
  const definirPeriodoInicio = onPeriodoInicioChange ?? setPeriodoInicioInterno;
  const definirPeriodoFim = onPeriodoFimChange ?? setPeriodoFimInterno;

  function alternarTipo(tipo: TimelineItem["tipo"]) {
    setTiposVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(tipo)) novo.delete(tipo);
      else novo.add(tipo);
      return novo;
    });
  }

  const filtrados = useMemo(
    () =>
      itens.filter((item) => {
        if (!tiposVisiveis.has(item.tipo)) return false;
        if (periodoInicio && (item.dataEvento ?? "") < periodoInicio) return false;
        if (periodoFim && (item.dataEvento ?? "") > periodoFim) return false;
        return true;
      }),
    [itens, tiposVisiveis, periodoInicio, periodoFim]
  );

  const grupos = useMemo(() => agrupaPorMes(filtrados), [filtrados]);

  const porRegistro = useMemo(() => new Map(registros.map((r) => [r.idRegistro, r])), [registros]);
  const porInsight = useMemo(() => new Map(insights.map((i) => [i.idInsight, i])), [insights]);
  const porFato = useMemo(() => new Map(fatosGeradores.map((f) => [f.idFatoGerador, f])), [fatosGeradores]);
  const porPreInsight = useMemo(() => new Map(preInsights.map((p) => [p.idPreInsight, p])), [preInsights]);

  function descricao(item: TimelineItem): string | null {
    if (item.tipo === "registro") return porRegistro.get(item.idOrigem)?.resumo ?? null;
    if (item.tipo === "insight") return porInsight.get(item.idOrigem)?.conteudo ?? null;
    if (item.tipo === "pre_insight") return porPreInsight.get(item.idOrigem)?.conteudo ?? null;
    return porFato.get(item.idOrigem)?.descricaoEvidencia ?? null;
  }

  function metaLinha(item: TimelineItem): string | null {
    if (item.tipo === "registro") return porRegistro.get(item.idOrigem)?.tipoRegistro ?? null;
    if (item.tipo === "insight") return porInsight.get(item.idOrigem)?.pilar ?? null;
    if (item.tipo === "fato_gerador") {
      const tipologia = porFato.get(item.idOrigem)?.tipologia;
      if (!tipologia) return null;
      // "grupo · tipologia · estado" -- só o meio, mesmo dado, versão curta
      // pro chip do card (o painel de detalhe mostra a string completa).
      const partes = tipologia.split(" · ");
      return partes.length === 3 ? partes[1] : tipologia;
    }
    return null;
  }

  // T14 (pente-fino 2026-09, PF-08): só Fato Gerador tem `situacao`
  // (projetado/realizado) -- as outras 3 entidades não têm essa dimensão.
  function situacaoDoFato(item: TimelineItem): "projetado" | "realizado" | null {
    if (item.tipo !== "fato_gerador") return null;
    return porFato.get(item.idOrigem)?.situacao ?? null;
  }

  const registroSelecionado =
    selecionado?.tipo === "registro" ? porRegistro.get(selecionado.idOrigem) : undefined;
  const insightSelecionado = selecionado?.tipo === "insight" ? porInsight.get(selecionado.idOrigem) : undefined;
  const fatoGeradorSelecionado =
    selecionado?.tipo === "fato_gerador" ? porFato.get(selecionado.idOrigem) : undefined;
  const preInsightSelecionado =
    selecionado?.tipo === "pre_insight" ? porPreInsight.get(selecionado.idOrigem) : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtrar Tipos:</span>
          {TIPOS.map((tipo) => {
            const cor = TIPO_ESTILO[tipo];
            const ativo = tiposVisiveis.has(tipo);
            return (
              <label
                key={tipo}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium"
                style={ativo ? undefined : { opacity: 0.55 }}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={ativo}
                  onChange={() => alternarTipo(tipo)}
                  aria-label={TIPO_ROTULO[tipo]}
                />
                <span className="size-2 shrink-0 rounded-full" style={{ background: cor.dot }} />
                {TIPO_ROTULO[tipo]}
                {ativo && <Check className="size-3" style={{ color: cor.text }} />}
              </label>
            );
          })}
        </div>

        {!periodoControlado && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <Calendar className="mb-1.5 size-3.5 text-muted-foreground" />
            <div className="grid gap-1">
              <Label htmlFor="timeline-periodo-inicio" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="timeline-periodo-inicio"
                type="date"
                value={periodoInicio}
                onChange={(e) => definirPeriodoInicio(e.target.value)}
                className="h-8 w-auto text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="timeline-periodo-fim" className="text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                id="timeline-periodo-fim"
                type="date"
                value={periodoFim}
                onChange={(e) => definirPeriodoFim(e.target.value)}
                className="h-8 w-auto text-xs"
              />
            </div>
          </div>
        )}

        {grupos.length === 0 ? (
          <EstadoVazio titulo="Nenhum item no período" mensagem="Ajuste os filtros de tipo ou período para ver a linha do tempo." />
        ) : (
          <div className="grid gap-6">
            {grupos.map((grupo) => (
              <div key={grupo.mes} className="grid gap-3">
                <div
                  className="w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase"
                  style={{ borderColor: DESTAQUE_FATO_GERADOR, color: DESTAQUE_FATO_GERADOR, background: "#f0fdf4" }}
                >
                  {grupo.mes}
                </div>
                <div className="grid gap-3">
                  {grupo.itens.map((item) => {
                    const cor = TIPO_ESTILO[item.tipo];
                    const isSelecionado = selecionado ? chave(selecionado) === chave(item) : false;
                    const desc = descricao(item);
                    const meta = metaLinha(item);
                    // T14 (pente-fino 2026-09, PF-08): diferenciação visual
                    // projetado/realizado -- só existe para Fato Gerador.
                    // Projetado ganha borda tracejada + badge própria (não
                    // reaproveita a badge de tipo, que continua identificando
                    // a entidade) e a ação de marcar como realizado.
                    const situacao = situacaoDoFato(item);
                    const projetado = situacao === "projetado";
                    return (
                      <div key={chave(item)} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <span
                            className="size-3 shrink-0 rounded-full ring-4 ring-background"
                            style={{ background: cor.dot, opacity: projetado ? 0.5 : 1 }}
                          />
                          <span className="mt-1 w-px flex-1 bg-border" />
                        </div>
                        <div className="grid flex-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelecionado(item)}
                            aria-pressed={isSelecionado}
                            data-selecionado={isSelecionado}
                            data-situacao={situacao ?? undefined}
                            className="grid gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50"
                            style={{
                              borderColor: isSelecionado ? DESTAQUE_FATO_GERADOR : undefined,
                              borderWidth: isSelecionado ? 2 : undefined,
                              borderStyle: projetado ? "dashed" : undefined,
                              opacity: projetado ? 0.85 : 1,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
                                  style={{ background: cor.bg, borderColor: cor.border, color: cor.text }}
                                >
                                  {TIPO_ROTULO[item.tipo]}
                                </span>
                                {projetado && (
                                  <span className="rounded border border-dashed border-muted-foreground/50 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                    Projetado
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatarData(item.dataEvento)}</span>
                            </div>
                            {contratos && item.idContrato != null && contratos.has(item.idContrato) && (
                              <span className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-secondary">
                                <Landmark className="size-3" />
                                {contratos.get(item.idContrato)!.nome}
                              </span>
                            )}
                            <span className="font-medium">{item.titulo ?? "—"}</span>
                            {desc && <p className="line-clamp-2 text-xs text-muted-foreground">{desc}</p>}
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              {meta ? (
                                <span className="inline-flex items-center gap-1" style={{ color: cor.text }}>
                                  <Tag className="size-3" />
                                  {meta}
                                </span>
                              ) : (
                                <span />
                              )}
                              {item.nomeAutor && <span>Por: {item.nomeAutor}</span>}
                            </div>
                          </button>
                          {projetado && onRealizado && (
                            <div className="flex justify-end">
                              <RealizarFatoDialog idFatoGerador={item.idOrigem} onConcluido={onRealizado} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PainelDetalhe
        item={selecionado}
        registro={registroSelecionado}
        insight={insightSelecionado}
        fatoGerador={fatoGeradorSelecionado}
        preInsight={preInsightSelecionado}
        contrato={selecionado?.idContrato != null ? contratos?.get(selecionado.idContrato) : undefined}
        onEditar={onEditar && selecionado ? () => onEditar(selecionado) : undefined}
        onVerNoCicloDeVida={
          onVerNoCicloDeVida && selecionado?.tipo === "fato_gerador" ? onVerNoCicloDeVida : undefined
        }
      />
    </div>
  );
}
