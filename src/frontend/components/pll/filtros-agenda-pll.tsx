"use client";

import type { OpcaoAgenda } from "@backend/queries/agenda";

import { Button } from "@/components/ui/button";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// pll-dashboard-agenda T13 (design.md "Ajuste de FiltrosAgenda ->
// FiltrosAgendaPll", PLL-AG-08, D-4). Mesmo padrão visual de Select múltiplo
// de FiltrosAgenda (estrategia/filtros-agenda.tsx) -- copiado, não importado
// (aquele componente é da Agenda de Estratégia/Coalizão e usa
// gestora/projeto/contrato; D-4 troca os 3 recortes por mentor(a)/
// mentorado/edição, que não existem lá).
export interface ValorFiltrosAgendaPll {
  idsMentor?: number[];
  idsMentorado?: number[];
  idsProjeto?: number[];
}

export interface FiltrosAgendaPllProps {
  filtro: ValorFiltrosAgendaPll;
  onChange: (filtro: ValorFiltrosAgendaPll) => void;
  mentores: OpcaoAgenda[];
  mentorados: OpcaoAgenda[];
  edicoes: OpcaoAgenda[];
}

function DropdownFiltro({
  rotulo,
  rotuloPlural,
  valores,
  opcoes,
  onChange,
}: {
  rotulo: string;
  rotuloPlural: string;
  valores: number[] | undefined;
  opcoes: OpcaoAgenda[];
  onChange: (ids: number[] | undefined) => void;
}) {
  return (
    <MultiSelectPesquisavel
      className="flex-1"
      opcoes={opcoesDeIdNome(opcoes)}
      valores={valores ?? []}
      onChange={(ids) => onChange(listaOuUndefined(ids))}
      placeholder={rotulo}
      rotulo={rotulo}
      rotuloPlural={rotuloPlural}
    />
  );
}

export function FiltrosAgendaPll({ filtro, onChange, mentores, mentorados, edicoes }: FiltrosAgendaPllProps) {
  function atualizar(patch: Partial<ValorFiltrosAgendaPll>) {
    onChange({ ...filtro, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
      <DropdownFiltro
        rotulo="Filtrar por mentor(a)"
        rotuloPlural="mentores"
        valores={filtro.idsMentor}
        opcoes={mentores}
        onChange={(idsMentor) => atualizar({ idsMentor })}
      />
      <DropdownFiltro
        rotulo="Filtrar por mentorado"
        rotuloPlural="mentorados"
        valores={filtro.idsMentorado}
        opcoes={mentorados}
        onChange={(idsMentorado) => atualizar({ idsMentorado })}
      />
      <DropdownFiltro
        rotulo="Filtrar por edição"
        rotuloPlural="edições"
        valores={filtro.idsProjeto}
        opcoes={edicoes}
        onChange={(idsProjeto) => atualizar({ idsProjeto })}
      />

      <Button
        type="button"
        variant="ghost"
        className="font-semibold text-secondary hover:text-secondary sm:w-auto"
        onClick={() => onChange({})}
      >
        Limpar filtros
      </Button>
    </div>
  );
}
