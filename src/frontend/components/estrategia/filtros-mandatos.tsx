import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// EST-09 (T21, design.md/tasks.md, Figma 202:554). AD-046: tela de leitura --
// caminho feliz de cada AC. Presentational, mesmo espírito de
// QuadroAcompanhamento (T16): recebe o estado do filtro e as opções via
// props, devolve a intenção via `onChange` -- não busca gestora/projeto/
// etapa por conta própria (a orquestração fica pra página, T21b). "Data"
// (EST-09 AC3) é um único filtro conceitual com dois campos (de/até), sobre
// dt_inicio -- mesmo par que queries/mandatos-lista.ts (T19) espera.
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
  idGestora?: number;
  idProjeto?: number;
  idEtapa?: number;
  status?: "ativo" | "concluido" | "nao_concluido";
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
const OPCOES_STATUS: { valor: ValorFiltrosMandatos["status"] & string; rotulo: string }[] = [
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

          <Select
            value={filtro.idGestora !== undefined ? String(filtro.idGestora) : ""}
            onValueChange={(v) => atualizar({ idGestora: v ? Number(v) : undefined })}
          >
            <SelectTrigger className="h-[42px] w-full flex-1">
              <SelectValue placeholder="Todas as gestoras" />
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
            <SelectTrigger className="h-[42px] w-full flex-1">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Select
            value={filtro.idEtapa !== undefined ? String(filtro.idEtapa) : ""}
            onValueChange={(v) => atualizar({ idEtapa: v ? Number(v) : undefined })}
          >
            <SelectTrigger className="h-[42px] w-full flex-1">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              {etapas.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtro.status ?? ""}
            onValueChange={(v) => atualizar({ status: (v || undefined) as ValorFiltrosMandatos["status"] })}
          >
            <SelectTrigger className="h-[42px] w-full flex-1">
              <SelectValue placeholder="Todos os status: ativo, finalizado, desligado" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_STATUS.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
