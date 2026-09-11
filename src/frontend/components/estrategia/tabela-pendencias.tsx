"use client";

import { useRouter } from "next/navigation";

import type { CategoriaPendencia, Pendencia } from "@backend/queries/pendencias";

import { Badge } from "@/components/ui/badge";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// EST-07 (T18, design.md "TabelaPendencias"). AD-046: tela de leitura --
// caminho feliz de cada AC. Mesmo padrão de linha clicável de
// GargalosTabela (visao-gerencial/gargalos-tabela.tsx, T29): TableRow é um
// <tr> puro sem suporte a asChild, então <Link> como filho seria HTML
// inválido -- onClick + onKeyDown (Enter/Espaço) no próprio <tr>, focável
// via tabIndex, sem dependência nova.
const ROTULO_CATEGORIA: Record<CategoriaPendencia, string> = {
  cadastro: "Cadastro incompleto",
  formulario_aberto: "Formulário aberto",
  etapa_atrasada: "Etapa atrasada",
  encontro_vencido: "Encontro vencido",
  sem_registro_recente: "Sem registro recente",
  sucesso_mensal_atrasado: "Sucesso Mensal atrasado",
};

export interface TabelaPendenciasProps {
  pendencias: Pendencia[];
}

function LinhaPendencia({ pendencia }: { pendencia: Pendencia }) {
  const router = useRouter();
  const destino = `/contratos/${pendencia.idContrato}`;

  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      role="link"
      onClick={() => router.push(destino)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(destino);
        }
      }}
    >
      <TableCell>{pendencia.nomeContratante}</TableCell>
      <TableCell>
        <Badge variant="destructive">{ROTULO_CATEGORIA[pendencia.categoria]}</Badge>
      </TableCell>
      <TableCell>{pendencia.detalhe ?? "—"}</TableCell>
      <TableCell>{new Date(pendencia.dtReferencia).toLocaleDateString("pt-BR")}</TableCell>
    </TableRow>
  );
}

export function TabelaPendencias({ pendencias }: TabelaPendenciasProps) {
  if (pendencias.length === 0) {
    return (
      <EstadoVazio titulo="Sem pendências" mensagem="Nenhuma das categorias de pendência tem item em aberto." />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mandato</TableHead>
          <TableHead>Tipo de pendência</TableHead>
          <TableHead>Detalhe</TableHead>
          <TableHead>Data de referência</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendencias.map((p) => (
          <LinhaPendencia key={`${p.idContrato}-${p.categoria}-${p.detalhe}`} pendencia={p} />
        ))}
      </TableBody>
    </Table>
  );
}
