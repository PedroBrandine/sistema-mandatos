"use client";

import type { OpcaoAgenda } from "@backend/queries/agenda";

import { Button } from "@/components/ui/button";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4 "filter-bar").
// Pedro reportou que "os filtros de gestora, projeto e contrato também não
// aparecem como foi definido no Figma" — a página só desenhava a grade e a
// lista (T30b comment, page.tsx). `FiltroAgenda` (queries/agenda.ts) já
// aceita os três recortes por interseção; faltava só o controle.
//
// Presentational puro, mesmo espírito de FiltrosMandatos (T21, Mandatos): o
// padrão é COPIADO de lá, não importado — FiltrosMandatos pertence à tela de
// Mandatos e outro worker mexe nela em paralelo.
//
// Seleção múltipla (2026-09-21, pedido do Pedro): cada dropdown é um
// MultiSelectPesquisavel -- busca dentro da lista e vários valores marcados.
// O Figma 163:4 desenha o RÓTULO do filtro ("Filtrar por gestora") como o
// próprio texto do dropdown sem seleção; é o `placeholder`. Sem nada marcado
// não há filtro, então o item-sentinela "todos" deixou de existir.
//
// "Limpar filtros" (2026-09-14, pedido do Pedro, mesma justificativa do
// Dashboard): um botão único que zera os 3 de uma vez evita 3 cliques quando
// a intenção é "ver tudo de novo". Mesmo rótulo/variant de FiltrosMandatos/
// FiltroDashboard.
export interface ValorFiltrosAgenda {
  idsGestora?: number[];
  idsProjeto?: number[];
  idsContrato?: number[];
}

export interface FiltrosAgendaProps {
  filtro: ValorFiltrosAgenda;
  onChange: (filtro: ValorFiltrosAgenda) => void;
  gestoras: OpcaoAgenda[];
  projetos: OpcaoAgenda[];
  contratos: OpcaoAgenda[];
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

export function FiltrosAgenda({ filtro, onChange, gestoras, projetos, contratos }: FiltrosAgendaProps) {
  function atualizar(patch: Partial<ValorFiltrosAgenda>) {
    onChange({ ...filtro, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
      <DropdownFiltro
        rotulo="Filtrar por gestora"
        rotuloPlural="gestoras"
        valores={filtro.idsGestora}
        opcoes={gestoras}
        onChange={(idsGestora) => atualizar({ idsGestora })}
      />
      <DropdownFiltro
        rotulo="Filtrar por projeto"
        rotuloPlural="projetos"
        valores={filtro.idsProjeto}
        opcoes={projetos}
        onChange={(idsProjeto) => atualizar({ idsProjeto })}
      />
      <DropdownFiltro
        rotulo="Filtrar por contrato"
        rotuloPlural="contratos"
        valores={filtro.idsContrato}
        opcoes={contratos}
        onChange={(idsContrato) => atualizar({ idsContrato })}
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
