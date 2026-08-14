"use client";

import { ChevronsDown, ChevronsUp, Search } from "lucide-react";
import { useState } from "react";

import { normalizaEntradaPct } from "@/lib/planejamento-formato";

import type { ModoPlanejamento, PermissoesModo } from "./permissoes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// PLR-11 (.specs/features/planejamento-estrategico-redesenho, T14). Ações de
// navegação/filtro da árvore-grade, fora da tabela em si -- nenhum round-trip
// novo ao banco, tudo client-side sobre a árvore já carregada
// (PlanejamentoGrade aplica os filtros de fato).
export interface PlanejamentoToolbarProps {
  permissoes: PermissoesModo;
  modo: ModoPlanejamento;
  busca: string;
  onBuscaChange: (valor: string) => void;
  soPendentes: boolean;
  onSoPendentesChange: (valor: boolean) => void;
  // T15: "só as minhas metas" -- só faz sentido pra quem enxerga a carteira
  // inteira do contrato mas quer se filtrar à própria responsabilidade
  // (Mentor/Assessor); Gestora/Admin já esperam ver tudo por padrão.
  soMinhasMetas: boolean;
  onSoMinhasMetasChange: (valor: boolean) => void;
  onExpandirTudo: () => void;
  onRecolherTudo: () => void;
  onCriarObjetivo: () => void;
  // PLR-17 (T22): "aplicar % em massa" -- a toolbar só mostra o contador e
  // recebe o valor final; quem decide QUAIS células estão marcadas e
  // reescreve o banco é a PlanejamentoGrade (onAplicarEmMassa delega lá).
  quantidadeMarcada: number;
  onAplicarEmMassa: (valor: number) => void;
}

export function PlanejamentoToolbar({
  permissoes,
  modo,
  busca,
  onBuscaChange,
  soPendentes,
  onSoPendentesChange,
  soMinhasMetas,
  onSoMinhasMetasChange,
  onExpandirTudo,
  onRecolherTudo,
  onCriarObjetivo,
  quantidadeMarcada,
  onAplicarEmMassa,
}: PlanejamentoToolbarProps) {
  const mostraSoMinhasMetas = !permissoes.crudHierarquia;
  const [valorEmMassa, setValorEmMassa] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
      <Button type="button" variant="ghost" size="sm" onClick={onExpandirTudo}>
        <ChevronsDown className="size-4" />
        Expandir tudo
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onRecolherTudo}>
        <ChevronsUp className="size-4" />
        Recolher tudo
      </Button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="h-8 w-56 pl-7"
          aria-label="Buscar objetivo, meta ou sucesso mensal por descrição"
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={soPendentes}
          onChange={(e) => onSoPendentesChange(e.target.checked)}
          className="size-4 rounded border-input"
        />
        Só pendentes
      </label>

      {mostraSoMinhasMetas && (
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soMinhasMetas}
            onChange={(e) => onSoMinhasMetasChange(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Só as minhas metas
        </label>
      )}

      {quantidadeMarcada > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-1">
          <span className="text-xs text-muted-foreground">{quantidadeMarcada} selecionada(s)</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="valor %"
            value={valorEmMassa}
            onChange={(e) => setValorEmMassa(e.target.value)}
            className="h-7 w-20"
            aria-label="Valor a aplicar nas células selecionadas"
          />
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={() => {
              const pct = normalizaEntradaPct(valorEmMassa);
              if (pct === null) return;
              onAplicarEmMassa(pct);
              setValorEmMassa("");
            }}
          >
            Aplicar
          </Button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {permissoes.crudHierarquia && modo === "construir" && (
          <Button type="button" variant="outline" size="sm" onClick={onCriarObjetivo}>
            + Objetivo
          </Button>
        )}
      </div>
    </div>
  );
}
