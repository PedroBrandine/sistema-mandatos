import Link from "next/link";

import type { ContratoCard } from "@backend/queries/mandatos-lista";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
// da Fase 5).
//
// Ajuste de fidelidade visual -- Mandatos (2026-09-14). O card inteiro
// deixou de ser um <Link> (antipadrão de link envolvendo conteúdo
// heterogêneo) -- o Figma só marca "Ver contrato →" como link explícito no
// rodapé, então só esse texto é clicável agora.
export interface ListaMandatosProps {
  mandatos: ContratoCard[];
  // Quando presente, cada card ganha o botão "Editar contrato". Quem decide se
  // o usuário pode (hoje só admin/gestora, para excluir o mandato) é a página:
  // sem o handler, o botão simplesmente não existe.
  onEditar?: (mandato: ContratoCard) => void;
}

const STATUS_LABEL: Record<ContratoCard["status"], string> = {
  ativo: "Ativo",
  concluido: "Finalizado",
  nao_concluido: "Desligado",
};

// Cores do badge de status (Figma 202:554 "Status"). Desligado usa
// variant="destructive" do Badge (bg-destructive/10 text-destructive) --
// --destructive em globals.css (#EB5454) já é o mesmo vermelho do Figma.
// Ativo/Finalizado não têm token de sucesso/neutro dedicado no design
// system do projeto (globals.css só define primary/secondary/destructive) --
// usam a paleta padrão do Tailwind (emerald/muted), mesma escolha que o
// código anterior já fazia para o dot ("bg-emerald-500").
const STATUS_BADGE_CLASS: Record<ContratoCard["status"], string> = {
  ativo: "border-transparent bg-emerald-50 text-emerald-700",
  concluido: "border-transparent bg-muted text-muted-foreground",
  nao_concluido: "",
};

const STATUS_DOT_CLASS: Record<ContratoCard["status"], string> = {
  ativo: "bg-emerald-500",
  concluido: "bg-muted-foreground",
  nao_concluido: "bg-destructive",
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

// Mesmo parser sem-fuso de formatarData, sem o ano -- rodapé do card usa
// formato curto ("Encerrado em 31/05", Figma 202:554), o cabeçalho usa o
// formato longo com ano.
function formatarDataCurta(data: string | null): string {
  if (!data) return "—";
  const [, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

// atualizadoEm vem de fat_contrato.atualizado_em (dado real -- ver
// queries/mandatos-lista.ts). Diferença em dias inteiros, sem arredondar
// pra cima: "Atualizado hoje" cobre o dia inteiro, não só a última hora.
function diasDesdeAtualizacao(atualizadoEm: string): number {
  const diffMs = Date.now() - new Date(atualizadoEm).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// Rodapé do card (Figma 202:554 "Rodapé do contrato"): o texto à esquerda
// varia por status -- ativo mostra havidade da última atualização,
// concluído/desligado mostram a data de encerramento (dt_fim), que já é o
// motivo do contrato ter saído do estado "ativo".
function textoRodape(mandato: ContratoCard): string {
  if (mandato.status === "concluido") return `Encerrado em ${formatarDataCurta(mandato.dtFim)}`;
  if (mandato.status === "nao_concluido") return `Desligado em ${formatarDataCurta(mandato.dtFim)}`;
  const dias = diasDesdeAtualizacao(mandato.atualizadoEm);
  return dias === 0 ? "Atualizado hoje" : `Atualizado há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function CampoRotulado({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn("text-sm font-medium", destaque && "font-normal text-secondary")}>{valor}</p>
    </div>
  );
}

function MandatoCard({ mandato, onEditar }: { mandato: ContratoCard; onEditar?: (mandato: ContratoCard) => void }) {
  return (
    <Card className="h-full gap-4 border border-border/60 p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-1.5">
          {/* Prefixo "Contrato" (Figma 202:554 "Identificação") reforça o
              vínculo visual nome-do-mandato <-> Contrato. */}
          <p className="text-base font-bold leading-snug">Contrato {mandato.nomeContratante}</p>
          <p className="text-xs text-muted-foreground">
            {formatarData(mandato.dtInicio)} — {formatarData(mandato.dtFim)}
          </p>
        </div>
        <Badge
          variant={mandato.status === "nao_concluido" ? "destructive" : "outline"}
          className={cn("shrink-0 gap-1.5", STATUS_BADGE_CLASS[mandato.status])}
        >
          <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[mandato.status])} />
          {STATUS_LABEL[mandato.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <CampoRotulado rotulo="Gestora" valor={mandato.nomeGestora ?? "—"} />
        <CampoRotulado rotulo="Projeto" valor={mandato.nomeProjeto ?? "—"} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <CampoRotulado rotulo="Data Inicial" valor={formatarData(mandato.dtInicio)} />
        <CampoRotulado rotulo="Data Final" valor={formatarData(mandato.dtFim)} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <CampoRotulado rotulo="Etapa atual" valor={mandato.nomeEtapaAtual ?? "—"} destaque />
        <CampoRotulado rotulo="Responsável" valor={mandato.nomeResponsavel ?? "—"} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
        <span className="text-muted-foreground">{textoRodape(mandato)}</span>
        <div className="flex items-center gap-3">
          {onEditar && (
            <Button type="button" variant="vinho" size="sm" onClick={() => onEditar(mandato)}>
              Editar contrato
            </Button>
          )}
          <Link href={`/contratos/${mandato.idContrato}`} className="font-bold text-secondary hover:underline">
            Ver contrato →
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function ListaMandatos({ mandatos, onEditar }: ListaMandatosProps) {
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
        <MandatoCard key={mandato.idContrato} mandato={mandato} onEditar={onEditar} />
      ))}
    </div>
  );
}
