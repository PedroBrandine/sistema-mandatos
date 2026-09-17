"use client";

import { useMemo, useState } from "react";

import type {
  FatoGeradorResumo,
  InsightResumo,
  PreInsightResumo,
  RegistroResumo,
  TimelineItem,
} from "@backend/queries/incidencia";
import { agrupaPorMes } from "@/lib/incidencia-timeline";

import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PainelDetalhe } from "./painel-detalhe";

// FGC-10 (T20, fatos-geradores-ciclo-vida). Feed cronológico agrupado por mês
// (agrupaPorMes, T13) com filtro por tipo (AC2) e por período (AC3) --
// filtragem client-side, os 4 tipos já vêm carregados de uma vez (view
// única, T5/T12). Compõe PainelDetalhe internamente: seleciona o item e
// resolve o resumo completo do tipo certo pelo id de origem.
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
}

const TIPOS: { valor: TimelineItem["tipo"]; rotulo: string }[] = [
  { valor: "pre_insight", rotulo: "Pré-Insight" },
  { valor: "registro", rotulo: "Registro" },
  { valor: "insight", rotulo: "Insight" },
  { valor: "fato_gerador", rotulo: "Fato Gerador" },
];

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
}: TimelineFeedProps) {
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<TimelineItem["tipo"]>>(
    () => new Set(TIPOS.map((t) => t.valor))
  );
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [selecionado, setSelecionado] = useState<TimelineItem | null>(null);

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

  const registroSelecionado =
    selecionado?.tipo === "registro" ? registros.find((r) => r.idRegistro === selecionado.idOrigem) : undefined;
  const insightSelecionado =
    selecionado?.tipo === "insight" ? insights.find((i) => i.idInsight === selecionado.idOrigem) : undefined;
  const fatoGeradorSelecionado =
    selecionado?.tipo === "fato_gerador"
      ? fatosGeradores.find((f) => f.idFatoGerador === selecionado.idOrigem)
      : undefined;
  const preInsightSelecionado =
    selecionado?.tipo === "pre_insight" ? preInsights.find((p) => p.idPreInsight === selecionado.idOrigem) : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {TIPOS.map((tipo) => (
            <label key={tipo.valor} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tiposVisiveis.has(tipo.valor)}
                onChange={() => alternarTipo(tipo.valor)}
              />
              {tipo.rotulo}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="timeline-periodo-inicio">De</Label>
            <Input
              id="timeline-periodo-inicio"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timeline-periodo-fim">Até</Label>
            <Input id="timeline-periodo-fim" type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
        </div>

        {grupos.length === 0 ? (
          <EstadoVazio titulo="Nenhum item no período" mensagem="Ajuste os filtros de tipo ou período para ver a linha do tempo." />
        ) : (
          <div className="grid gap-6">
            {grupos.map((grupo) => (
              <div key={grupo.mes} className="grid gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{grupo.mes}</h3>
                <div className="grid gap-2">
                  {grupo.itens.map((item) => (
                    <button
                      key={chave(item)}
                      type="button"
                      onClick={() => setSelecionado(item)}
                      aria-pressed={selecionado ? chave(selecionado) === chave(item) : false}
                      className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 data-[selecionado=true]:bg-muted"
                      data-selecionado={selecionado ? chave(selecionado) === chave(item) : false}
                    >
                      <span className="font-medium">{item.titulo ?? "—"}</span>
                      <span className="ml-2 text-muted-foreground">{formatarData(item.dataEvento)}</span>
                    </button>
                  ))}
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
        onEditar={onEditar && selecionado ? () => onEditar(selecionado) : undefined}
      />
    </div>
  );
}
