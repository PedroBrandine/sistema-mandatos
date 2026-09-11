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
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-data-de">Início — de</Label>
          <Input
            id="filtro-data-de"
            type="date"
            value={filtro.dtInicioDe ?? ""}
            onChange={(e) => atualizar({ dtInicioDe: e.target.value || undefined })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-data-ate">Início — até</Label>
          <Input
            id="filtro-data-ate"
            type="date"
            value={filtro.dtInicioAte ?? ""}
            onChange={(e) => atualizar({ dtInicioAte: e.target.value || undefined })}
          />
        </div>

        <Select
          value={filtro.idGestora !== undefined ? String(filtro.idGestora) : ""}
          onValueChange={(v) => atualizar({ idGestora: v ? Number(v) : undefined })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Gestora" />
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
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Projeto" />
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <Select
          value={filtro.idEtapa !== undefined ? String(filtro.idEtapa) : ""}
          onValueChange={(v) => atualizar({ idEtapa: v ? Number(v) : undefined })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Etapa" />
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
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {OPCOES_STATUS.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={() => onChange(FILTRO_VAZIO)}>
          Limpar filtros
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {contagem} {contagem === 1 ? "mandato" : "mandatos"}
      </p>
    </div>
  );
}
