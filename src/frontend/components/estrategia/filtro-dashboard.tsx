"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Ajuste de fidelidade visual, 2026-09-14 (Figma 44:29 "filter-bar"). Faltava
// por inteiro na página -- o comentário de EST-08/T33b em page.tsx já
// registrava a lacuna: "a view e a query já aceitam os dois recortes
// (idGestora/idProjeto), mas nenhuma task desenhava os controles".
//
// Presentational, mesmo padrão de FiltrosMandatos (T21): recebe o valor do
// filtro e as opções via props, devolve a intenção via `onChange` -- não
// busca gestora/projeto por conta própria (a orquestração fica na página).
// Só 2 campos (Figma não desenha mais nenhum aqui, ao contrário do filtro de
// Mandatos com 5), por isso um componente próprio em vez de reusar
// FiltrosMandatos (que também traz data/etapa/status fora de escopo desta
// tela e está fora dos arquivos permitidos para edição neste ajuste).
//
// "Limpar filtros" (2026-09-14, pedido do Pedro): o Figma 44:29 não desenha
// esse botão, mas com filtragem real ligada (idGestora/idProjeto), não ter
// como voltar ao estado sem filtro é uma lacuna de uso, não fidelidade ao
// pixel. Mesmo rótulo/variant/posição de FiltrosMandatos, para não inventar
// um terceiro padrão visual de "limpar" no mesmo produto.
export interface OpcaoFiltroDashboard {
  id: number;
  nome: string;
}

export interface ValorFiltroDashboard {
  idGestora?: number;
  idProjeto?: number;
}

export interface FiltroDashboardProps {
  filtro: ValorFiltroDashboard;
  onChange: (filtro: ValorFiltroDashboard) => void;
  gestoras: OpcaoFiltroDashboard[];
  projetos: OpcaoFiltroDashboard[];
}

export function FiltroDashboard({ filtro, onChange, gestoras, projetos }: FiltroDashboardProps) {
  function atualizar(patch: Partial<ValorFiltroDashboard>) {
    onChange({ ...filtro, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <Select
        value={filtro.idGestora !== undefined ? String(filtro.idGestora) : ""}
        onValueChange={(v) => atualizar({ idGestora: v ? Number(v) : undefined })}
      >
        <SelectTrigger className="w-full flex-1">
          <SelectValue placeholder="Filtrar por gestora" />
        </SelectTrigger>
        <SelectContent>
          {gestoras.map((g) => (
            <SelectItem key={g.id} value={String(g.id)}>
              {g.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtro.idProjeto !== undefined ? String(filtro.idProjeto) : ""}
        onValueChange={(v) => atualizar({ idProjeto: v ? Number(v) : undefined })}
      >
        <SelectTrigger className="w-full flex-1">
          <SelectValue placeholder="Filtrar por projeto" />
        </SelectTrigger>
        <SelectContent>
          {projetos.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
