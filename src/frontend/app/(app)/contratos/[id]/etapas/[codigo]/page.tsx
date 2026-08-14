"use client";

import { use, useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, buscarEtapasDoProduto, type EtapaResumo } from "@backend/queries/contrato";
import { buscarReguaDoContrato, type EtapaRegua } from "@backend/queries/etapa-contrato";
import { buscarRegistrosDaEtapa, type RegistroResumo } from "@backend/queries/incidencia";

import { RegistroForm } from "@/components/incidencia/registro-form";
import { Badge } from "@/components/ui/badge";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// RGI-09/RGI-10 (.specs/features/operacao-regua-instanciacao/spec.md). Preenche o
// placeholder que a Trilha F deixou aqui ("vazia de conteúdo por ora, que dependeria
// de fat_etapa_contrato, não provisionada") -- cada aba de etapa mostra a régua
// completa do produto (não só a própria etapa), ordenada por ordem, com a linha do
// `codigo` da URL destacada. Design decidiu por essa leitura em vez de uma rota nova
// (design.md "Frontend -- Tela da régua"): a barra de abas já é a navegação ordenada
// que o AC1 pede, o conteúdo de cada aba é a mesma tabela, só a linha em foco muda.
//
// Sem TanStack Query/Table de propósito (SPEC_DEVIATION registrada em design.md): o
// componente pai (FichaContratoChrome) e esta própria página já usam
// useEffect+useState manual -- migrar só esta folha criaria inconsistência de padrão
// de fetch sem nenhum ganho pedido pela spec.
const STATUS_LABEL: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  dispensada: "Dispensada",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline" | "ghost"> = {
  nao_iniciada: "secondary",
  em_andamento: "default",
  concluida: "outline",
  dispensada: "ghost",
};

function formatarData(data: string | null): string {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

export default function EtapaContratoPage({
  params,
}: {
  params: Promise<{ id: string; codigo: string }>;
}) {
  const { id, codigo } = use(params);
  const idContrato = Number(id);

  const [etapa, setEtapa] = useState<EtapaResumo | null | undefined>(undefined);
  const [regua, setRegua] = useState<EtapaRegua[]>([]);
  const [registros, setRegistros] = useState<RegistroResumo[]>([]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((contrato) => {
      if (cancelado) return;
      if (!contrato) {
        setEtapa(null);
        return;
      }
      buscarEtapasDoProduto(supabase, contrato.idProduto).then((etapas) => {
        if (cancelado) return;
        setEtapa(etapas.find((e) => e.codigo === codigo) ?? null);
      });
      buscarReguaDoContrato(supabase, idContrato).then((linhas) => {
        if (!cancelado) setRegua(linhas);
      });
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato, codigo]);

  // INC-09/INC-11: idEtapa (ref_etapa) da linha da régua com este `codigo` --
  // escopa o Select de Tipo de Registro (buscarTiposRegistroDaEtapa) e a
  // listagem abaixo da tabela (buscarRegistrosDaEtapa).
  const idEtapa = regua.find((linha) => linha.codigo === codigo)?.idEtapa ?? null;

  const carregarRegistros = useCallback(() => {
    if (idEtapa == null) return;
    const supabase = createClient();
    void buscarRegistrosDaEtapa(supabase, idContrato, idEtapa).then(setRegistros);
  }, [idContrato, idEtapa]);

  useEffect(() => {
    carregarRegistros();
  }, [carregarRegistros]);

  if (etapa === null) {
    notFound();
  }

  if (etapa === undefined) {
    return <CarregandoSkeleton />;
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Etapa {etapa.ordem}</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etapa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Previsto</TableHead>
            <TableHead>Realizado</TableHead>
            <TableHead>Atraso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regua.map((linha) => (
            <TableRow
              key={linha.idEtapaContrato}
              className={cn(linha.codigo === codigo && "bg-muted/50")}
              aria-current={linha.codigo === codigo ? "step" : undefined}
            >
              <TableCell className="font-medium">{linha.nome}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[linha.status] ?? "secondary"}>
                  {STATUS_LABEL[linha.status] ?? linha.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatarData(linha.dtPrevistaInicio)} → {formatarData(linha.dtPrevistaConclusao)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatarData(linha.dtInicio)} → {formatarData(linha.dtConclusao)}
              </TableCell>
              <TableCell>
                {linha.estaAtrasada ? (
                  <Badge variant="destructive">{linha.diasAtraso} dia(s)</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* INC-09/INC-10/INC-11: Registros desta etapa -- form inline (sem
          Dialog, página já dedicada) + lista abaixo, mesmo padrão de
          design.md "etapas/[codigo]/page.tsx (edita)". */}
      {idEtapa != null && (
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Registros</p>
          <RegistroForm idContrato={idContrato} idEtapa={idEtapa} onConcluido={carregarRegistros} />

          {registros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro nesta etapa ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ocorrido em</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Autor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((r) => (
                  <TableRow key={r.idRegistro}>
                    <TableCell className="font-medium">{r.tipoRegistro}</TableCell>
                    <TableCell className="text-muted-foreground">{formatarData(r.ocorridoEm)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.resumo ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.nomeAutor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
