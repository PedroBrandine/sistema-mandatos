import type { FatoGeradorResumo } from "@backend/queries/incidencia";

import { Card, CardContent } from "@/components/ui/card";

import { IipCard } from "./iip-card";

// FGC-14 (T21, fatos-geradores-ciclo-vida). KPIs do Ciclo de Vida -- IipCard
// reaproveitado sem mudança (já rotula "(provisório)", AD-054). Contagem de
// Fato Gerador **separada** por situação (spec.md P1 "Fato projetado e sua
// realização" AC6): realizados e "N projeções em aberto" nunca somados num
// único número -- um fato projetado não é impacto ainda.
export interface IncidenciaKpisProps {
  idContrato: number;
  fatosGeradores: FatoGeradorResumo[];
}

export function IncidenciaKpis({ idContrato, fatosGeradores }: IncidenciaKpisProps) {
  const realizados = fatosGeradores.filter((f) => f.situacao === "realizado").length;
  const projetados = fatosGeradores.filter((f) => f.situacao === "projetado").length;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <IipCard idContrato={idContrato} />

      <Card>
        <CardContent className="flex items-center gap-4 px-4 py-2 text-sm">
          <span>{realizados} fatos geradores realizados</span>
          <span className="text-muted-foreground">{projetados} projeções em aberto</span>
        </CardContent>
      </Card>
    </div>
  );
}
