import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// Barra de filtros da aba "Fatos Geradores" do produto: Gestora, Projeto,
// Contrato e Período. Mesma família visual de FiltrosMandatos (Figma
// 202:554) -- caixa única com dropdowns de 42px, o texto do rótulo vira o
// placeholder. Cada um dos três primeiros é um MultiSelectPesquisavel (busca
// na lista, vários valores marcados; `idsGestora` etc. ausentes ou vazios =
// sem filtro). Período (De/Até) veio da Linha do Tempo (TimelineFeed) para
// ficar junto dos demais filtros, já que ali é a única aba com barra de
// filtros por cima -- na aba do contrato o período continua interno ao
// TimelineFeed. Só apresenta: recebe o estado e as opções, devolve a
// intenção por `onChange`; quem busca as opções e decide o que fazer com
// Contrato quando Gestora ou Projeto mudam é a página.
export interface OpcaoFiltroFatosGeradores {
  id: number;
  nome: string;
}

export interface ValorFiltrosFatosGeradores {
  idsGestora?: number[];
  idsProjeto?: number[];
  idsContrato?: number[];
  periodoInicio?: string;
  periodoFim?: string;
}

export interface FiltrosFatosGeradoresProps {
  filtro: ValorFiltrosFatosGeradores;
  onChange: (filtro: ValorFiltrosFatosGeradores) => void;
  gestoras: OpcaoFiltroFatosGeradores[];
  projetos: OpcaoFiltroFatosGeradores[];
  // Já restritos a Gestora/Projeto escolhidos -- a página filtra antes.
  contratos: OpcaoFiltroFatosGeradores[];
  // PF3-03 (.specs/features/pente-fino-2026-09-23-lote2/spec.md): PLL não
  // tem gestora -- a página troca o rótulo (e a fonte de `gestoras`, que
  // nesse caso já vem com os mentores) sem duplicar este componente.
  rotuloPessoa?: "Gestora" | "Mentor";
}

const FILTRO_VAZIO: ValorFiltrosFatosGeradores = {};

interface SeletorProps {
  valores: number[] | undefined;
  placeholder: string;
  rotulo: string;
  rotuloPlural: string;
  opcoes: OpcaoFiltroFatosGeradores[];
  onChange: (ids: number[] | undefined) => void;
}

function Seletor({ valores, placeholder, rotulo, rotuloPlural, opcoes, onChange }: SeletorProps) {
  return (
    <MultiSelectPesquisavel
      className="h-[42px] flex-1"
      opcoes={opcoesDeIdNome(opcoes)}
      valores={valores ?? []}
      onChange={(ids) => onChange(listaOuUndefined(ids))}
      placeholder={placeholder}
      rotulo={rotulo}
      rotuloPlural={rotuloPlural}
    />
  );
}

export function FiltrosFatosGeradores({
  filtro,
  onChange,
  gestoras,
  projetos,
  contratos,
  rotuloPessoa = "Gestora",
}: FiltrosFatosGeradoresProps) {
  const temFiltro = [filtro.idsGestora, filtro.idsProjeto, filtro.idsContrato].some(
    (ids) => ids !== undefined && ids.length > 0
  ) || Boolean(filtro.periodoInicio) || Boolean(filtro.periodoFim);

  const rotuloPessoaPlural = rotuloPessoa === "Mentor" ? "mentores" : "gestoras";
  const placeholderPessoa = rotuloPessoa === "Mentor" ? "Todos os mentores" : "Todas as gestoras";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center">
      <Seletor
        valores={filtro.idsGestora}
        placeholder={placeholderPessoa}
        rotulo={rotuloPessoa}
        rotuloPlural={rotuloPessoaPlural}
        opcoes={gestoras}
        onChange={(idsGestora) => onChange({ ...filtro, idsGestora })}
      />
      <Seletor
        valores={filtro.idsProjeto}
        placeholder="Todos os projetos"
        rotulo="Projeto"
        rotuloPlural="projetos"
        opcoes={projetos}
        onChange={(idsProjeto) => onChange({ ...filtro, idsProjeto })}
      />
      <Seletor
        valores={filtro.idsContrato}
        placeholder="Todos os contratos"
        rotulo="Contrato"
        rotuloPlural="contratos"
        opcoes={contratos}
        onChange={(idsContrato) => onChange({ ...filtro, idsContrato })}
      />
      <div className="flex items-end gap-2">
        <Calendar className="mb-2.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="grid gap-1">
          <Label htmlFor="fatos-geradores-periodo-inicio" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="fatos-geradores-periodo-inicio"
            type="date"
            value={filtro.periodoInicio ?? ""}
            onChange={(e) => onChange({ ...filtro, periodoInicio: e.target.value || undefined })}
            className="h-[42px] w-auto text-xs"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fatos-geradores-periodo-fim" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="fatos-geradores-periodo-fim"
            type="date"
            value={filtro.periodoFim ?? ""}
            onChange={(e) => onChange({ ...filtro, periodoFim: e.target.value || undefined })}
            className="h-[42px] w-auto text-xs"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-[42px] font-semibold text-secondary hover:text-secondary lg:w-[150px]"
        disabled={!temFiltro}
        onClick={() => onChange(FILTRO_VAZIO)}
      >
        Limpar filtros
      </Button>
    </div>
  );
}
