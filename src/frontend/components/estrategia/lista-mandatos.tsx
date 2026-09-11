import Link from "next/link";

import type { ContratoCard } from "@backend/queries/mandatos-lista";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { cn } from "@/lib/utils";

// EST-09 (T20, design.md "ListaMandatos", Figma 202:554). AD-046: tela de
// leitura -- caminho feliz de cada AC, sem par positivo/negativo de cada
// condicional.
//
// Grade de cards de contrato: cada card mostra os 7 campos de EST-09 AC1
// (contratante, vigência, status, gestora, projeto, etapa atual e
// responsável) -- "vigência" é o par Data Inicial/Data Final do Figma, não
// um texto de período separado (decisão registrada no Registro de execução
// da Fase 5). Card inteiro é um link pro contrato, mesmo padrão da página
// atual de Mandatos (produtos/[slug]/mandatos/page.tsx antes de T21b).
export interface ListaMandatosProps {
  mandatos: ContratoCard[];
}

const STATUS_LABEL: Record<ContratoCard["status"], string> = {
  ativo: "Ativo",
  concluido: "Finalizado",
  nao_concluido: "Desligado",
};

const STATUS_DOT_CLASS: Record<ContratoCard["status"], string> = {
  ativo: "bg-emerald-500",
  concluido: "bg-primary",
  nao_concluido: "bg-muted-foreground",
};

const STATUS_BADGE_VARIANT: Record<ContratoCard["status"], "default" | "secondary" | "outline"> = {
  ativo: "default",
  concluido: "secondary",
  nao_concluido: "outline",
};

// dt_fim nula (AD-005): "--", nunca uma data inventada (EST-09 AC5).
// Formata o "YYYY-MM-DD" cru direto, sem passar por Date/toLocaleDateString:
// Date("2026-01-10") é meia-noite UTC, e toLocaleDateString converte pro
// fuso local -- num fuso a oeste de UTC (ex.: America/Sao_Paulo) isso
// exibe o dia anterior. dt_inicio/dt_fim são DATE puro no Postgres, sem
// componente de hora, então não há fuso a considerar.
function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function CampoRotulado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  );
}

function MandatoCard({ mandato }: { mandato: ContratoCard }) {
  return (
    <Link href={`/contratos/${mandato.idContrato}`} className="group">
      <Card className="h-full gap-4 border border-border/60 p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold leading-snug">{mandato.nomeContratante}</p>
          <Badge variant={STATUS_BADGE_VARIANT[mandato.status]} className="gap-1.5 shrink-0">
            <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[mandato.status])} />
            {STATUS_LABEL[mandato.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <CampoRotulado rotulo="Gestão" valor={mandato.nomeGestora ?? "—"} />
          <CampoRotulado rotulo="Projeto" valor={mandato.nomeProjeto ?? "—"} />
          <CampoRotulado rotulo="Data Inicial" valor={formatarData(mandato.dtInicio)} />
          <CampoRotulado rotulo="Data Final" valor={formatarData(mandato.dtFim)} />
          <CampoRotulado rotulo="Etapa" valor={mandato.nomeEtapaAtual ?? "—"} />
          <CampoRotulado rotulo="Responsável" valor={mandato.nomeResponsavel ?? "—"} />
        </div>
      </Card>
    </Link>
  );
}

export function ListaMandatos({ mandatos }: ListaMandatosProps) {
  if (mandatos.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum mandato encontrado"
        mensagem="Nenhum contrato corresponde aos filtros aplicados."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {mandatos.map((mandato) => (
        <MandatoCard key={mandato.idContrato} mandato={mandato} />
      ))}
    </div>
  );
}
