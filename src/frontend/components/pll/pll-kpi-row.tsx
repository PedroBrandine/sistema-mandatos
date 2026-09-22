"use client";

import { useId } from "react";

import type { PllKpi } from "@backend/queries/pll-dashboard";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// pll-dashboard-agenda T8 (design.md "PllKpiRow", PLL-DB-02/03/04/06). Faixa
// dos 5 KPIs do Dashboard do PLL (Figma 44:477).
//
// Layout de referência: kpi-row.tsx (Estratégia) -- mesma ideia de grid
// responsivo fechando em 5 colunas no desktop, sem reaproveitar o componente
// (os KPIs do PLL não vêm de vw_estrategia_kpi, e o card 2 -- Distribuição de
// status -- não tem equivalente lá).
//
// PLL-DB-06: o Figma 44:477 estoura a margem direita com o 5º KPI --
// corrigido aqui com 5 colunas IGUAIS dentro do contêiner (grid-cols-5 no
// breakpoint largo), nunca uma coluna maior que as outras.
//
// AD-003: nenhum número é somado/calculado aqui além do percentual de exibição
// da barra segmentada (proporção de exibição, não uma métrica nova -- os 4
// contadores de status já chegam prontos de buscarPllKpis).
type FormatoKpi = "inteiro" | "percentual";

const FORMATADOR: Record<FormatoKpi, Intl.NumberFormat> = {
  inteiro: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }),
  percentual: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
};

export const AUSENCIA_KPI_PLL = "—";

function formatar(valor: number | null, formato: FormatoKpi): string {
  // AD-005: só null vira "—". Zero é medição real (PLL-DB-06 edge case:
  // recorte com 0 mentorados exibe 0 nas contagens).
  if (valor === null) return AUSENCIA_KPI_PLL;
  const texto = FORMATADOR[formato].format(valor);
  return formato === "percentual" ? `${texto}%` : texto;
}

interface RotuloProps {
  id: string;
  texto: string;
}

function Rotulo({ id, texto }: RotuloProps) {
  return (
    <p id={id} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
      {texto}
    </p>
  );
}

function KpiTotalMentorados({ valor }: { valor: number }) {
  const rotuloId = useId();
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        <Rotulo id={rotuloId} texto="Total de mentorados" />
        {/* Número calculado só na origem (buscarPllKpis) -- este card só
            exibe, sem afordância de edição (AD-003). */}
        <p className="mt-1 font-heading text-3xl text-secondary">{formatar(valor, "inteiro")}</p>
      </CardContent>
    </Card>
  );
}

const SEGMENTOS_STATUS: { chave: keyof PllKpi["distribuicaoStatus"]; rotulo: string; dotClass: string }[] = [
  { chave: "ativo", rotulo: "Ativo", dotClass: "bg-emerald-500" },
  { chave: "desistente", rotulo: "Desistente", dotClass: "bg-amber-500" },
  { chave: "desligado", rotulo: "Desligado", dotClass: "bg-destructive" },
  { chave: "concluido", rotulo: "Concluído", dotClass: "bg-chart-4" },
];

// PLL-DB-03: barra segmentada + legenda com o percentual de cada status sobre
// o TOTAL DE MENTORADOS do recorte (D-1: Ativo/Desistente/Desligado/Concluído
// -- os 2 primeiros nomes que o Figma pedia e o banco não distinguia até a
// migration de T1). Recorte com 0 mentorados: cada percentual vira "—" (sem
// divisão por zero), nunca "0%" travestido de "não há dado" (AD-005 edge
// case: contagens exibem 0, percentuais exibem "—").
function KpiDistribuicaoStatus({ distribuicao, total }: { distribuicao: PllKpi["distribuicaoStatus"]; total: number }) {
  const rotuloId = useId();
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent className="flex flex-col gap-2">
        <Rotulo id={rotuloId} texto="Distribuição de status" />
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribuição de status dos mentorados">
          {total > 0 &&
            SEGMENTOS_STATUS.map((s) => {
              const qtd = distribuicao[s.chave];
              if (qtd === 0) return null;
              return <div key={s.chave} className={s.dotClass} style={{ width: `${(qtd / total) * 100}%` }} />;
            })}
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {SEGMENTOS_STATUS.map((s) => {
            const qtd = distribuicao[s.chave];
            const pct = total > 0 ? formatar((qtd / total) * 100, "percentual") : AUSENCIA_KPI_PLL;
            return (
              <li key={s.chave} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("size-1.5 shrink-0 rounded-full", s.dotClass)} aria-hidden="true" />
                <span>
                  {s.rotulo}: {pct}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// D-11: "realizadas / planejadas" -- o rótulo promete dois valores (o mockup
// mostrava um número só, corrigido aqui). planejadas já inclui as realizadas
// (buscarPllKpis soma realizado + planejado).
function KpiMentorias({ realizadas, planejadas }: { realizadas: number; planejadas: number }) {
  const rotuloId = useId();
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        <Rotulo id={rotuloId} texto="Mentorias realizadas x planejadas" />
        <p className="mt-1 font-heading text-3xl text-secondary">
          {formatar(realizadas, "inteiro")}
          <span className="text-lg text-muted-foreground"> / {formatar(planejadas, "inteiro")}</span>
        </p>
      </CardContent>
    </Card>
  );
}

// PLL-DB-04: percentual sem afordância de edição (AD-003), "—" quando não há
// dim_planejamento no recorte -- nunca "0%".
function KpiAtingimento({ valor }: { valor: number | null }) {
  const rotuloId = useId();
  const texto = formatar(valor, "percentual");
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        <Rotulo id={rotuloId} texto="Atingimento Plan." />
        <p className="mt-1 font-heading text-3xl text-secondary">{texto}</p>
        {valor !== null && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-labelledby={rotuloId}
            aria-valuenow={valor}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${valor}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiFatosGeradores({ valor }: { valor: number }) {
  const rotuloId = useId();
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        <Rotulo id={rotuloId} texto="Fatos geradores registrados" />
        <p className="mt-1 font-heading text-3xl text-secondary">{formatar(valor, "inteiro")}</p>
      </CardContent>
    </Card>
  );
}

export interface PllKpiRowProps {
  kpi: PllKpi;
}

export function PllKpiRow({ kpi }: PllKpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KpiTotalMentorados valor={kpi.totalMentorados} />
      <KpiDistribuicaoStatus distribuicao={kpi.distribuicaoStatus} total={kpi.totalMentorados} />
      <KpiMentorias realizadas={kpi.mentoriasRealizadas} planejadas={kpi.mentoriasPlanejadas} />
      <KpiAtingimento valor={kpi.atingimentoMedio} />
      <KpiFatosGeradores valor={kpi.fatosGeradoresRegistrados} />
    </div>
  );
}
