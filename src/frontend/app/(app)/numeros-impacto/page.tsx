import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createClient } from "@backend/supabase/server";
import { buscarPapelGlobalAtual } from "@backend/queries/usuario";
import { atualizaEBuscaNumerosImpacto, type LinhaNumerosImpacto } from "@backend/queries/numeros-impacto";
import { NaoAutorizado } from "@/components/app-shell/nao-autorizado";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formataData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// SAI-01, SAI-02, SAI-03, SAI-04. Server Component -- gate de papel idêntico
// ao de visao-gerencial/page.tsx:52-66 (bloqueia mentor/assessor com
// <NaoAutorizado> antes de qualquer dado renderizar), depois refresh
// síncrono seguido de leitura (design.md, "Tech Decisions" -- ordem
// obrigatória, nunca ler sem refrescar antes; ordem agora garantida dentro
// de atualizaEBuscaNumerosImpacto, com teste unitário próprio -- Fix F1 do
// validation.md, achado do Verifier de que a ordem não tinha proteção
// automática de regressão). Cada linha = 1 fat_contrato (LinhaNumerosImpacto,
// design.md "Data Models"), listando os números de impacto lado a lado com o
// contexto do contrato, sem agrupamento client-side.
//
// SPEC_DEVIATION: design.md descreve o erro de refresh/leitura com "botão de
// retry" -- mas <ErroInline onRetry=...> exige função de callback, e este é
// um Server Component (passar uma função quebraria a fronteira server/
// client, mesmo motivo pelo qual SaudeOperacaoBloco/GargalosBloco -- também
// Server Components -- renderizam <ErroInline> sem onRetry). Reabrir a
// página já refaz o refresh (mesmo Tech Decision que justificou usar Server
// Component em vez de useState/useEffect aqui).
export default async function NumerosImpactoPage() {
  const client = await createClient();
  const papel = await buscarPapelGlobalAtual(client);

  if (papel === "mentor" || papel === "assessor") {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 p-6">
        <NaoAutorizado />
      </div>
    );
  }

  let linhas: LinhaNumerosImpacto[];
  try {
    linhas = await atualizaEBuscaNumerosImpacto(client);
  } catch {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 p-6">
        <Breadcrumbs items={[{ label: "Números de Impacto" }]} />
        <Card>
          <CardHeader>
            <CardTitle>Números de Impacto</CardTitle>
          </CardHeader>
          <CardContent>
            <ErroInline mensagem="Não foi possível atualizar ou carregar os números de impacto." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6">
      <Breadcrumbs items={[{ label: "Números de Impacto" }]} />

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Números de Impacto</h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {linhas.length} contrato(s)
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Contratos por contratante, ano da 1ª contratação e ordem do contrato -- lidos direto de{" "}
          <code className="font-mono">mv_numeros_impacto</code>, sem planilha manual.
        </p>
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum contrato encontrado"
          mensagem="Ainda não há contratos para calcular números de impacto."
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ano de início</TableHead>
                  <TableHead>Nº contratos</TableHead>
                  <TableHead>1ª contratação</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.idContrato}>
                    <TableCell className="font-medium">{linha.nomeContratante}</TableCell>
                    <TableCell>{linha.nomeProduto}</TableCell>
                    <TableCell>{linha.nomeProjeto ?? "—"}</TableCell>
                    <TableCell>{linha.status}</TableCell>
                    <TableCell>{linha.anoInicio}</TableCell>
                    <TableCell>{linha.nrContratosContratante}</TableCell>
                    <TableCell>{formataData(linha.dtPrimeiraContratacao)}</TableCell>
                    <TableCell>{linha.ordemContrato}</TableCell>
                    <TableCell>
                      <Link href={`/numeros-impacto/${linha.idContratante}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs font-semibold text-primary">
                          Ver mandato
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
