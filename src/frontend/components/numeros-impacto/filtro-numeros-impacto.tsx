"use client";

import type { FiltroNumerosImpacto, OpcaoNumerosImpacto } from "@backend/queries/numeros-impacto";

import { Button } from "@/components/ui/button";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// Dashboard "Números de Impacto" (2026-09-22). Mesmo padrão presentational de
// FiltroDashboard (estrategia/filtro-dashboard.tsx): recebe filtro/opções via
// props, devolve a intenção via onChange -- não busca nada sozinho. Um
// componente próprio (em vez de reusar FiltroDashboard) porque aqui são 3
// campos, e o terceiro (ano) não é um id de tabela, é o próprio anoInicio.
export interface FiltroNumerosImpactoProps {
  filtro: FiltroNumerosImpacto;
  onChange: (filtro: FiltroNumerosImpacto) => void;
  gestoras: OpcaoNumerosImpacto[];
  projetos: OpcaoNumerosImpacto[];
  anos: number[];
}

export function FiltroNumerosImpactoBar({ filtro, onChange, gestoras, projetos, anos }: FiltroNumerosImpactoProps) {
  function atualizar(patch: Partial<FiltroNumerosImpacto>) {
    onChange({ ...filtro, ...patch });
  }

  const opcoesAno = anos.map((ano) => ({ valor: ano, rotulo: String(ano) }));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <MultiSelectPesquisavel
        className="flex-1"
        opcoes={opcoesDeIdNome(gestoras)}
        valores={filtro.idsGestora ?? []}
        onChange={(v) => atualizar({ idsGestora: listaOuUndefined(v) })}
        placeholder="Filtrar por gestora"
        rotuloPlural="gestoras"
      />

      <MultiSelectPesquisavel
        className="flex-1"
        opcoes={opcoesDeIdNome(projetos)}
        valores={filtro.idsProjeto ?? []}
        onChange={(v) => atualizar({ idsProjeto: listaOuUndefined(v) })}
        placeholder="Filtrar por projeto"
        rotuloPlural="projetos"
      />

      <MultiSelectPesquisavel
        className="flex-1"
        opcoes={opcoesAno}
        valores={filtro.anos ?? []}
        onChange={(v) => atualizar({ anos: listaOuUndefined(v) })}
        placeholder="Filtrar por ano de início"
        rotuloPlural="anos"
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
