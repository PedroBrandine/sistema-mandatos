import { CheckCircle2, CircleDashed, Wrench } from "lucide-react";

import {
  ATUALIZADO_EM,
  CAMADAS_DADO,
  ENTREGUE,
  FALTA,
  ROTULO_STATUS_PENDENCIA,
  type StatusCamada,
  type StatusPendencia,
} from "@/lib/apresentacao-funcionalidades";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Tela pedida por Pedro (2026-09-22): um botão no Hub que mostra, de forma
// visual, o que já foi entregue e o que falta no sistema -- para apresentar a
// chefia. Conteúdo estático (lib/apresentacao-funcionalidades.ts), não uma
// métrica de negócio do sistema: não há view de Saída para "quantas features
// existem" (AD-003 não se aplica aqui, é meta-conteúdo sobre o projeto, não
// sobre mandato/contrato). Server Component simples -- nada para buscar,
// nada para interagir.
function formatarData(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

const COR_STATUS_CAMADA: Record<StatusCamada, string> = {
  completo: "bg-emerald-500",
  parcial: "bg-amber-500",
  pendente: "bg-destructive",
};

const ROTULO_STATUS_CAMADA: Record<StatusCamada, string> = {
  completo: "Completo",
  parcial: "Parcial",
  pendente: "Pendente",
};

const VARIANTE_BADGE_PENDENCIA: Record<StatusPendencia, "secondary" | "outline" | "destructive"> = {
  nao_iniciado: "outline",
  em_andamento: "secondary",
  debito: "destructive",
};

export default function ApresentacaoFuncionalidadesPage() {
  const totalEntregue = ENTREGUE.reduce((soma, bloco) => soma + bloco.itens.length, 0);
  const totalFalta = FALTA.reduce((soma, bloco) => soma + bloco.itens.length, 0);
  const camadasCompletas = CAMADAS_DADO.filter((c) => c.status === "completo").length;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl uppercase tracking-tight text-primary">
          Apresentação — Funcionalidades
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          O que já está entregue e funcionando no Sistema Mandatos, e o que ainda falta.
          Atualizado em {formatarData(ATUALIZADO_EM)}, a partir do estado real do código
          (`.specs/roadmap.md` e `.specs/STATE.md`).
        </p>
      </div>

      {/* Resumo -- três números grandes, mesmo padrão visual dos KPIs de
          Visão Gerencial (font-heading text-3xl), só que contados aqui mesmo
          (array estático, não agregação de dado de negócio -- AD-003 é sobre
          métrica de mandato/contrato, não sobre este inventário). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
              Camadas de dado completas
            </p>
            <p className="font-heading text-3xl text-secondary">
              {camadasCompletas}/{CAMADAS_DADO.length}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
              Funcionalidades entregues
            </p>
            <p className="font-heading text-3xl text-secondary">{totalEntregue}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
              Pendências mapeadas
            </p>
            <p className="font-heading text-3xl text-secondary">{totalFalta}</p>
          </CardContent>
        </Card>
      </div>

      {/* Camadas de dado -- visão arquitetural rápida, ordem de dependência
          (AD-007: Plataforma/Fundação primeiro, Saída por último). */}
      <section className="space-y-3">
        <h2 className="text-base font-bold uppercase tracking-wide text-secondary">Camadas de dado</h2>
        <div className="grid gap-2">
          {CAMADAS_DADO.map((camada) => (
            <div
              key={camada.nome}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("size-2.5 shrink-0 rounded-full", COR_STATUS_CAMADA[camada.status])} aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{camada.nome}</span>
                <span className="text-sm text-muted-foreground">{camada.detalhe}</span>
              </div>
              <Badge variant="outline" className="w-fit shrink-0">
                {ROTULO_STATUS_CAMADA[camada.status]}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {/* O que já foi entregue */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-base font-bold uppercase tracking-wide text-secondary">O que já foi entregue</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ENTREGUE.map((bloco) => (
            <Card key={bloco.titulo}>
              <CardHeader>
                <CardTitle>{bloco.titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {bloco.itens.map((item) => (
                    <li key={item.titulo} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>
                        <span className="font-medium text-foreground">{item.titulo}</span>
                        {" — "}
                        <span className="text-muted-foreground">{item.descricao}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* O que ainda falta */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-bold uppercase tracking-wide text-secondary">O que ainda falta</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FALTA.map((bloco) => (
            <Card key={bloco.titulo}>
              <CardHeader>
                <CardTitle>{bloco.titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {bloco.itens.map((item) => (
                    <li key={item.titulo} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.titulo}</span>
                        <Badge variant={VARIANTE_BADGE_PENDENCIA[item.status]}>
                          {ROTULO_STATUS_PENDENCIA[item.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.descricao}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
        Conteúdo escrito à mão a partir do estado real do repositório -- atualize
        `src/frontend/lib/apresentacao-funcionalidades.ts` conforme o roadmap avançar.
      </p>
    </div>
  );
}
