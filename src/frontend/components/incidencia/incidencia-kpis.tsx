import type { ReactNode } from "react";

import type { FatoGeradorResumo } from "@backend/queries/incidencia";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { IipCard } from "./iip-card";
import { CLASSE_KPI_CARD, CLASSE_KPI_NUMERO, CLASSE_KPI_ROTULO } from "./kpi-estilo";

// FGC-14 (T21, fatos-geradores-ciclo-vida). Faixa de KPIs do Ciclo de Vida
// (Figma 109:60): Fatos Geradores, Insights, Pré-Insights, Registros e IIP.
//
// Fatos Geradores mostra "realizados/total" com barra e "N projeções em
// aberto" embaixo. O total é realizados + projetados -- o "15" do mockup
// (12 + 3) sai daí, não é denominador externo. Os dois números continuam
// distintos na tela (spec.md P1 "Fato projetado e sua realização" AC6): a
// fração diz quanto do que foi registrado já aconteceu e a linha de baixo
// conta o que falta, sem fundir os dois num único total. O IIP, ao lado, só
// considera realizados ("Somente realizados") -- projeção não é impacto ainda.
//
// Insights/Pré-Insights/Registros são contagens simples das listas que a
// página já carrega (mesma fonte da Linha do Tempo, então os números batem
// com o que o usuário vê no feed). Zero é número medido, não ausência.
export interface IncidenciaKpisProps {
  // Aba do contrato: passa o id e o cartão de IIP do contrato é montado aqui.
  idContrato?: number;
  // Aba agregada do produto: o cartão de IIP (média dos mandatos do recorte)
  // vem pronto de fora. Tem precedência sobre `idContrato`.
  iip?: ReactNode;
  fatosGeradores: FatoGeradorResumo[];
  totalInsights: number;
  totalPreInsights: number;
  totalRegistros: number;
}

function KpiContagem({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card className={cn(CLASSE_KPI_CARD, "flex-1")} role="group" aria-label={rotulo}>
      <CardContent className="flex flex-col gap-3">
        <p className={CLASSE_KPI_ROTULO}>{rotulo}</p>
        <p className={CLASSE_KPI_NUMERO}>{valor}</p>
      </CardContent>
    </Card>
  );
}

export function IncidenciaKpis({
  idContrato,
  iip,
  fatosGeradores,
  totalInsights,
  totalPreInsights,
  totalRegistros,
}: IncidenciaKpisProps) {
  const realizados = fatosGeradores.filter((f) => f.situacao === "realizado").length;
  const projetados = fatosGeradores.filter((f) => f.situacao === "projetado").length;
  const total = realizados + projetados;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-start">
      <Card className={cn(CLASSE_KPI_CARD, "flex-1")} role="group" aria-label="Fatos Geradores">
        <CardContent className="flex flex-col gap-3">
          <p className={CLASSE_KPI_ROTULO}>Fatos Geradores</p>
          <div className="flex items-center gap-3">
            {/* Sem nenhum fato não há fração a mostrar: "0/0" leria como
                divisão inválida e a barra vazia como "0% atingido". */}
            <p className={CLASSE_KPI_NUMERO}>{total > 0 ? `${realizados}/${total}` : "0"}</p>
            {total > 0 && (
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label="Fatos Geradores realizados"
                aria-valuenow={realizados}
                aria-valuemin={0}
                aria-valuemax={total}
              >
                <div className="h-full rounded-full bg-secondary" style={{ width: `${(realizados / total) * 100}%` }} />
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{projetados} projeções em aberto</p>
        </CardContent>
      </Card>

      <KpiContagem rotulo="Insights" valor={totalInsights} />
      <KpiContagem rotulo="Pré-Insights" valor={totalPreInsights} />
      <KpiContagem rotulo="Registros" valor={totalRegistros} />

      {iip ?? (idContrato != null && <IipCard idContrato={idContrato} className="sm:w-full lg:w-[380px] lg:flex-none" />)}
    </div>
  );
}
