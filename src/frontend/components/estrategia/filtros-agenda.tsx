"use client";

import type { OpcaoAgenda } from "@backend/queries/agenda";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4 "filter-bar").
// Pedro reportou que "os filtros de gestora, projeto e contrato também não
// aparecem como foi definido no Figma" — a página só desenhava a grade e a
// lista (T30b comment, page.tsx). `FiltroAgenda` (queries/agenda.ts) já
// aceita os três recortes por interseção; faltava só o controle.
//
// Presentational puro, mesmo espírito de FiltrosMandatos (T21, Mandatos): o
// padrão é COPIADO de lá (Select do shadcn, sentinela "todos"), não
// importado — FiltrosMandatos pertence à tela de Mandatos e outro worker
// mexe nela em paralelo.
//
// Diferença deliberada do padrão de FiltrosMandatos: lá o texto do
// placeholder ("Gestora", "Projeto") só aparece com nenhum valor escolhido, e
// "Limpar filtros" é um botão à parte. Aqui o Figma 163:4 desenha o RÓTULO do
// filtro ("Filtrar por gestora") como o próprio texto do dropdown no estado
// "todos" — por isso o item-sentinela usa esse texto como label, não um
// "Todas as gestoras" genérico.
const TODOS = "todos";

export interface ValorFiltrosAgenda {
  idGestora?: number;
  idProjeto?: number;
  idContrato?: number;
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
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: number | undefined;
  opcoes: OpcaoAgenda[];
  onChange: (id: number | undefined) => void;
}) {
  return (
    <Select
      value={valor !== undefined ? String(valor) : TODOS}
      onValueChange={(v) => onChange(v === TODOS ? undefined : Number(v))}
    >
      <SelectTrigger className="w-full flex-1" aria-label={rotulo}>
        <SelectValue placeholder={rotulo} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{rotulo}</SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
        valor={filtro.idGestora}
        opcoes={gestoras}
        onChange={(idGestora) => atualizar({ idGestora })}
      />
      <DropdownFiltro
        rotulo="Filtrar por projeto"
        valor={filtro.idProjeto}
        opcoes={projetos}
        onChange={(idProjeto) => atualizar({ idProjeto })}
      />
      <DropdownFiltro
        rotulo="Filtrar por contrato"
        valor={filtro.idContrato}
        opcoes={contratos}
        onChange={(idContrato) => atualizar({ idContrato })}
      />
    </div>
  );
}
