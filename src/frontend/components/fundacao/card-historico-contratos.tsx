"use client";

import { useRouter } from "next/navigation";

import type { HistoricoContratoLinha } from "@backend/queries/ficha-mandato";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rotuloStatusContrato, type StatusContrato } from "@/lib/ficha-formatos";
import { cn } from "@/lib/utils";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC8 (FMC-12). Reusa rotuloStatusContrato (lib/ficha-
// formatos.ts, T16) -- nunca reescreve o rótulo aqui, exatamente para não
// reabrir a divergência que motivou aquela função: "Em andamento" e nome de
// etapa nunca aparecem, só Ativo/Concluído/Não concluído (ck_contrato_status).
// Status é leitura pura (Out of Scope da spec: mudança de status só por
// fluxo de contrato) -- nenhum controle de edição nesta tabela.

const VARIANTE_STATUS: Record<StatusContrato, "default" | "outline" | "destructive"> = {
  ativo: "default",
  concluido: "outline",
  nao_concluido: "destructive",
};

export interface CardHistoricoContratosProps {
  contratos: HistoricoContratoLinha[];
  // Contrato cuja Ficha está aberta agora -- destaca a própria linha na
  // lista (pedido do Pedro, 2026-09-22: identificar em qual contrato a
  // pessoa está sem precisar decorar data/status). Opcional: quem já usava
  // este card sem saber o contrato atual continua funcionando, só sem o
  // destaque.
  idContratoAtual?: number;
}

// dt_inicio/dt_fim são DATE puro -- fatia de string em vez de `new Date()`,
// mesmo cuidado de `dataBr` em produtos/[slug]/agenda/page.tsx (evita voltar
// um dia por causa do fuso).
function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function CardHistoricoContratos({ contratos, idContratoAtual }: CardHistoricoContratosProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Contratos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((c) => {
              const destino = `/contratos/${c.idContrato}`;
              const ehAtual = c.idContrato === idContratoAtual;
              return (
                // TableRow é um <tr> puro, sem suporte a asChild -- <Link>
                // como filho de <tr> seria HTML inválido (mesmo achado de
                // visao-gerencial/gargalos-tabela.tsx, T29). onClick +
                // onKeyDown no próprio <tr>, focável via tabIndex, é o
                // padrão de "linha inteira clicável" já em uso no projeto.
                //
                // A linha do contrato atual não navega pra si mesma -- sem
                // role="link"/tabIndex/onClick, só o destaque visual
                // (fundo + borda à esquerda na cor da marca).
                <TableRow
                  key={c.idContrato}
                  className={cn(
                    !ehAtual && "cursor-pointer",
                    ehAtual && "border-l-2 border-l-secondary bg-secondary/5 hover:bg-secondary/5"
                  )}
                  tabIndex={ehAtual ? undefined : 0}
                  role={ehAtual ? undefined : "link"}
                  onClick={ehAtual ? undefined : () => router.push(destino)}
                  onKeyDown={
                    ehAtual
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(destino);
                          }
                        }
                  }
                >
                  <TableCell className={cn(ehAtual && "font-semibold text-secondary")}>
                    {formatarDataBr(c.dtInicio)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.dtFim ? formatarDataBr(c.dtFim) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={VARIANTE_STATUS[c.status as StatusContrato] ?? "outline"}>
                        {rotuloStatusContrato(c.status as StatusContrato)}
                      </Badge>
                      {ehAtual && (
                        <Badge variant="secondary" className="text-[10px]">
                          Você está aqui
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
