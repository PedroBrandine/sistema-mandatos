import type { StatusMandato } from "@backend/queries/mandatos-lista";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// EST-09 (T21, design.md/tasks.md, Figma 202:554). AD-046: tela de leitura --
// caminho feliz de cada AC. Presentational, mesmo espírito de
// QuadroAcompanhamento (T16): recebe o estado do filtro e as opções via
// props, devolve a intenção via `onChange` -- não busca gestora/projeto/
// etapa por conta própria (a orquestração fica pra página, T21b). "Data"
// (EST-09 AC3) é um único filtro conceitual com dois campos (de/até), sobre
// dt_inicio -- mesmo par que queries/mandatos-lista.ts (T19) espera.
//
// Seleção múltipla (2026-09-21, pedido do Pedro): Gestora, Projeto, Etapa e
// Status são MultiSelectPesquisavel -- dropdown com busca que aceita vários
// valores (`idsGestora` etc. são listas; ausente/vazia = sem filtro). Só as
// datas seguem como campo único. O texto do placeholder e o aria-label são os
// mesmos de antes.
//
// Ajuste de fidelidade visual -- Mandatos (2026-09-14). Layout original era
// um grid 2x4 com <Label> empilhado sobre cada campo -- o Figma 202:554 usa
// uma barra compacta de 2 linhas, sem rótulo visível (o texto do rótulo vira
// o placeholder do próprio Select). Os <Label> continuam no DOM como
// sr-only: getByLabelText (filtros-mandatos.test.tsx) e leitor de tela
// seguem enxergando "Início — de"/"Início — até", só o visual muda.
// Gap declarado: input[type=date] não renderiza texto de placeholder
// customizado em nenhum browser principal (Chrome/Firefox mostram só o
// formato nativo, ex. "dd/mm/aaaa") -- por isso os dois campos de data não
// reproduzem literalmente "Data inicial"/"Data final" como texto visível
// dentro da caixa, diferente dos Selects (que usam SelectValue placeholder
// e reproduzem o texto do Figma 1:1). É limitação de plataforma, não
// escolha de implementação.
export interface OpcaoFiltroMandatos {
  id: number;
  nome: string;
}

export interface ValorFiltrosMandatos {
  dtInicioDe?: string;
  dtInicioAte?: string;
  idsGestora?: number[];
  idsProjeto?: number[];
  idsEtapa?: number[];
  status?: StatusMandato[];
}

export interface FiltrosMandatosProps {
  filtro: ValorFiltrosMandatos;
  onChange: (filtro: ValorFiltrosMandatos) => void;
  gestoras: OpcaoFiltroMandatos[];
  projetos: OpcaoFiltroMandatos[];
  etapas: OpcaoFiltroMandatos[];
  contagem: number;
}

// Mesmos rótulos de lista-mandatos.tsx (STATUS_LABEL) -- duplicado aqui de
// propósito, mesmo padrão de ROTULO_CATEGORIA em tabela-pendencias.tsx: um
// mapa pequeno o bastante pra não justificar acoplar os dois componentes.
const OPCOES_STATUS: { valor: StatusMandato; rotulo: string }[] = [
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "concluido", rotulo: "Finalizado" },
  { valor: "nao_concluido", rotulo: "Desligado" },
];

const FILTRO_VAZIO: ValorFiltrosMandatos = {};

export function FiltrosMandatos({ filtro, onChange, gestoras, projetos, etapas, contagem }: FiltrosMandatosProps) {
  function atualizar(patch: Partial<ValorFiltrosMandatos>) {
    onChange({ ...filtro, ...patch });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="lg:w-[210px]">
            <Label htmlFor="filtro-data-de" className="sr-only">
              Início — de
            </Label>
            <Input
              id="filtro-data-de"
              type="date"
              className="h-[42px] w-full"
              value={filtro.dtInicioDe ?? ""}
              onChange={(e) => atualizar({ dtInicioDe: e.target.value || undefined })}
            />
          </div>
          <div className="lg:w-[210px]">
            <Label htmlFor="filtro-data-ate" className="sr-only">
              Início — até
            </Label>
            <Input
              id="filtro-data-ate"
              type="date"
              className="h-[42px] w-full"
              value={filtro.dtInicioAte ?? ""}
              onChange={(e) => atualizar({ dtInicioAte: e.target.value || undefined })}
            />
          </div>

          <MultiSelectPesquisavel
            className="h-[42px] flex-1"
            opcoes={opcoesDeIdNome(gestoras)}
            valores={filtro.idsGestora ?? []}
            onChange={(v) => atualizar({ idsGestora: listaOuUndefined(v) })}
            placeholder="Todas as gestoras"
            rotulo="Gestora"
            rotuloPlural="gestoras"
          />

          <MultiSelectPesquisavel
            className="h-[42px] flex-1"
            opcoes={opcoesDeIdNome(projetos)}
            valores={filtro.idsProjeto ?? []}
            onChange={(v) => atualizar({ idsProjeto: listaOuUndefined(v) })}
            placeholder="Todos os projetos"
            rotulo="Projeto"
            rotuloPlural="projetos"
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <MultiSelectPesquisavel
            className="h-[42px] flex-1"
            opcoes={opcoesDeIdNome(etapas)}
            valores={filtro.idsEtapa ?? []}
            onChange={(v) => atualizar({ idsEtapa: listaOuUndefined(v) })}
            placeholder="Todas as etapas"
            rotulo="Etapa"
            rotuloPlural="etapas"
          />

          <MultiSelectPesquisavel
            className="h-[42px] flex-1"
            opcoes={OPCOES_STATUS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
            valores={filtro.status ?? []}
            onChange={(v) => atualizar({ status: listaOuUndefined(v) })}
            placeholder="Todos os status: ativo, finalizado, desligado"
            rotulo="Status"
            rotuloPlural="status"
          />

          <Button
            type="button"
            variant="ghost"
            className="h-[42px] font-semibold text-secondary hover:text-secondary lg:w-[150px]"
            onClick={() => onChange(FILTRO_VAZIO)}
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-base font-bold">
          {contagem} {contagem === 1 ? "mandato" : "mandatos"}
        </p>
        {/* "Mais recentes primeiro" descreve a ordenação fixa de
            buscarMandatosLista (.order("dt_inicio", { ascending: false })) --
            rótulo estático, não um controle de ordenação. Gap declarado: o
            Figma 202:554 desenha um chevron de dropdown ali, sugerindo um
            seletor de ordenação, mas nenhuma task/AC pede essa
            interatividade nem a query aceita outro campo de order -- inventar
            o controle seria scope creep (mesmo raciocínio do comentário em
            dashboard/page.tsx sobre a barra de filtros de gestora/projeto). */}
        <p className="text-sm text-muted-foreground">Mais recentes primeiro</p>
      </div>
    </div>
  );
}
