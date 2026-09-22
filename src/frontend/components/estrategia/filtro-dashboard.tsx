"use client";

import { Button } from "@/components/ui/button";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

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
// Seleção múltipla (2026-09-21, pedido do Pedro): Gestora e Projeto são
// MultiSelectPesquisavel -- busca na lista e vários valores marcados
// (`idsGestora`/`idsProjeto`; ausente ou vazia = sem filtro).
//
// "Limpar filtros" (2026-09-14, pedido do Pedro): o Figma 44:29 não desenha
// esse botão, mas com filtragem real ligada (idsGestora/idsProjeto), não ter
// como voltar ao estado sem filtro é uma lacuna de uso, não fidelidade ao
// pixel. Mesmo rótulo/variant/posição de FiltrosMandatos, para não inventar
// um terceiro padrão visual de "limpar" no mesmo produto.
//
// Intervalo de data (2026-09-22, pedido do Pedro): mandatário com mais de um
// contrato de Estratégia (renovação, ciclo anterior) faz o indicador da
// faixa de KPI (iipMedio/pctAtingimentoMedio/nrFatosGeradores em
// fn_estrategia_kpi) misturar dados de contratos de períodos diferentes --
// não há como excluir o contrato antigo sem um recorte de data. Por isso é
// um filtro à parte dos dois MultiSelectPesquisavel (a exceção "menos data"
// da regra de filtro padrão do produto): dois `<input type="month">`
// nativos, mês/ano de início e fim, recortando fat_contrato.dt_inicio
// (mesmo grão de fn_estrategia_kpi). Nenhum dos dois é obrigatório.
export interface OpcaoFiltroDashboard {
  id: number;
  nome: string;
}

export interface ValorFiltroDashboard {
  idsGestora?: number[];
  idsProjeto?: number[];
  // "AAAA-MM", valor cru do <input type="month">.
  mesInicio?: string;
  mesFim?: string;
}

export interface FiltroDashboardProps {
  filtro: ValorFiltroDashboard;
  onChange: (filtro: ValorFiltroDashboard) => void;
  gestoras: OpcaoFiltroDashboard[];
  projetos: OpcaoFiltroDashboard[];
}

// "AAAA-MM" -> primeiro dia do mês em "AAAA-MM-DD". Data local, sem hora --
// dt_inicio é `date`, comparação nunca cruza fuso.
function primeiroDiaDoMes(mes: string): string {
  return `${mes}-01`;
}

// "AAAA-MM" -> último dia do mês em "AAAA-MM-DD" (28-31, conforme o mês).
function ultimoDiaDoMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  return `${mes}-${String(ultimoDia).padStart(2, "0")}`;
}

// Converte {mesInicio, mesFim} (o que a UI edita) em {dataInicio, dataFim}
// (o que fn_estrategia_kpi espera): página chama isto ao montar o filtro da
// query, o componente nunca fala com a camada de dados diretamente.
export function intervaloDataDoFiltro(filtro: ValorFiltroDashboard): { dataInicio?: string; dataFim?: string } {
  return {
    dataInicio: filtro.mesInicio ? primeiroDiaDoMes(filtro.mesInicio) : undefined,
    dataFim: filtro.mesFim ? ultimoDiaDoMes(filtro.mesFim) : undefined,
  };
}

export function FiltroDashboard({ filtro, onChange, gestoras, projetos }: FiltroDashboardProps) {
  function atualizar(patch: Partial<ValorFiltroDashboard>) {
    onChange({ ...filtro, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
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

      <div className="flex items-center gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Contrato iniciado de
          <input
            type="month"
            aria-label="Início do intervalo de data"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            value={filtro.mesInicio ?? ""}
            onChange={(e) => atualizar({ mesInicio: e.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          até
          <input
            type="month"
            aria-label="Fim do intervalo de data"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            value={filtro.mesFim ?? ""}
            onChange={(e) => atualizar({ mesFim: e.target.value || undefined })}
          />
        </label>
      </div>

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
