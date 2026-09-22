"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import {
  filtraNumerosImpacto,
  opcoesFiltroNumerosImpacto,
  resumoNumerosImpacto,
  type FiltroNumerosImpacto,
  type LinhaNumerosImpacto,
} from "@backend/queries/numeros-impacto";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";
import { FiltroNumerosImpactoBar } from "@/components/numeros-impacto/filtro-numeros-impacto";

function formataData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface StatTileProps {
  rotulo: string;
  valor: number;
}

// Mesmo padrão visual de KpiSimples (estrategia/kpi-row.tsx): rótulo pequeno
// uppercase (via CSS, não no texto -- leitor de tela) + número grande em
// font-heading (Anton). Não reaproveita KpiSimples porque ele é tipado pro
// formato de EstrategiaKpi (vw_estrategia_kpi, AD-003); aqui o número vem de
// resumoNumerosImpacto (queries/numeros-impacto.ts), não dessa view.
function StatTile({ rotulo, valor }: StatTileProps) {
  const rotuloId = useId();
  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        <p id={rotuloId} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-1 font-heading text-3xl text-secondary">{new Intl.NumberFormat("pt-BR").format(valor)}</p>
      </CardContent>
    </Card>
  );
}

interface NumerosImpactoDashboardProps {
  linhas: LinhaNumerosImpacto[];
}

// Dashboard pedido pelo Pedro em 2026-09-22 pra apresentação do mesmo dia:
// filtros de gestora/projeto/ano + KPIs + gráficos, com a tabela original
// (SAI-01..04) mantida embaixo, agora recortada pelo mesmo filtro. Sem tela
// de Figma pra esta parte (só a tabela tinha referência) -- diagramação
// própria seguindo o padrão de faixa-de-filtro + faixa-de-KPIs + gráficos já
// estabelecido no Dashboard de Estratégia (produtos/[slug]/dashboard).
//
// Client Component: o Server Component (page.tsx) faz o
// refresh-então-leitura de mv_numeros_impacto uma única vez e entrega o
// conjunto inteiro aqui -- filtro e agregação (resumoNumerosImpacto) rodam em
// memória sobre esse conjunto já carregado, sem round-trip novo ao Supabase a
// cada troca de filtro (mesma leitura "organização inteira" que a MV já era).
export function NumerosImpactoDashboard({ linhas }: NumerosImpactoDashboardProps) {
  const [filtro, setFiltro] = useState<FiltroNumerosImpacto>({});

  const opcoes = useMemo(() => opcoesFiltroNumerosImpacto(linhas), [linhas]);
  const linhasFiltradas = useMemo(() => filtraNumerosImpacto(linhas, filtro), [linhas, filtro]);
  const resumo = useMemo(() => resumoNumerosImpacto(linhasFiltradas), [linhasFiltradas]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <FiltroNumerosImpactoBar
            filtro={filtro}
            onChange={setFiltro}
            gestoras={opcoes.gestoras}
            projetos={opcoes.projetos}
            anos={opcoes.anos}
          />
        </div>
        {/* Exportar relatório: em desenvolvimento (pedido do Pedro). Sem
            precedente no projeto de botão desabilitado com tooltip -- o rótulo
            já comunica o estado, mesmo espírito de EmDesenvolvimento
            (app-shell/em-desenvolvimento.tsx) pra blocos inteiros. */}
        <Button type="button" variant="outline" disabled className="gap-1.5 whitespace-nowrap">
          <Download className="size-3.5" aria-hidden="true" />
          Exportar relatório (em desenvolvimento)
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile rotulo="Quantidade de contratos" valor={resumo.qtdContratos} />
        <StatTile rotulo="Quantidade de mandatos" valor={resumo.qtdMandatos} />
        <StatTile rotulo="Quantidade de coalizões" valor={resumo.qtdCoalizoes} />
      </div>

      {linhasFiltradas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum contrato no recorte"
          mensagem="Ajuste ou limpe os filtros para ver os números de impacto."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Contratos por produto</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartBarraHorizontal titulo="Contratos por produto" itens={resumo.porProduto} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contratos por projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartBarraHorizontal titulo="Contratos por projeto" itens={resumo.porProjeto} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contagem por status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartBarraHorizontal titulo="Contagem por status" itens={resumo.porStatus} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contagem por ano de início</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartBarraHorizontal
                titulo="Contagem por ano de início"
                itens={resumo.porAno}
                ordenarPorValor={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Perfil demográfico</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <ChartBarraHorizontal titulo="Gênero" itens={resumo.percentualGenero} unidade="pct" />
              <ChartBarraHorizontal titulo="Raça" itens={resumo.percentualRaca} unidade="pct" />
              <ChartBarraHorizontal
                titulo="Orientação sexual"
                itens={resumo.percentualOrientacaoSexual}
                unidade="pct"
              />
            </CardContent>
          </Card>

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
                  {linhasFiltradas.map((linha) => (
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
        </>
      )}
    </div>
  );
}
