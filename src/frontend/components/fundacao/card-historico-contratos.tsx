import type { HistoricoContratoLinha } from "@backend/queries/ficha-mandato";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rotuloStatusContrato, type StatusContrato } from "@/lib/ficha-formatos";

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
}

// dt_inicio/dt_fim são DATE puro -- fatia de string em vez de `new Date()`,
// mesmo cuidado de `dataBr` em produtos/[slug]/agenda/page.tsx (evita voltar
// um dia por causa do fuso).
function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function CardHistoricoContratos({ contratos }: CardHistoricoContratosProps) {
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
            {contratos.map((c) => (
              <TableRow key={c.idContrato}>
                <TableCell>{formatarDataBr(c.dtInicio)}</TableCell>
                <TableCell className="text-muted-foreground">{c.dtFim ? formatarDataBr(c.dtFim) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_STATUS[c.status as StatusContrato] ?? "outline"}>
                    {rotuloStatusContrato(c.status as StatusContrato)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
