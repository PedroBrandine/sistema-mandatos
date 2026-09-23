"use client";

import { useState } from "react";

import type { ContratoParaFicha } from "@backend/queries/contrato";
import type { InformacoesGeraisPll } from "@backend/queries/pll-informacoes";
import { atualizarStatusContrato } from "@backend/rpc/contrato";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// diagnostico-participante-pll (Informações Gerais do PLL, Figma 449:4,
// restilizado pra Anton/Commissioner/paleta oficial em vez de Sora/#0f4c43 --
// decisão do Pedro, 23/09). "Base Eleitoral" do frame não tem coluna em
// nenhuma tabela -- omitida (regra nº1 de figma-dominio-legisla). "Parear
// mentor" e "Ver visão agregada da edição" do frame ficam só como leitura
// nesta rodada (sem ação): construir esses 2 fluxos de escrita é aumento de
// escopo que não foi pedido, registrado aqui pra não implementar em silêncio.

const STATUS_LABEL_PLL: Record<string, string> = {
  ativo: "Ativo",
  desistente: "Desistente",
  desligado: "Desligado",
  concluido: "Concluído",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatarPeriodo(dtInicio: string, dtFim: string | null): string {
  return `${formatarData(dtInicio)} – ${dtFim ? formatarData(dtFim) : "atual"}`;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-semibold text-secondary">{valor ?? "—"}</p>
    </div>
  );
}

export interface InformacoesGeraisPllPainelProps {
  idContrato: number;
  contrato: ContratoParaFicha;
  info: InformacoesGeraisPll;
  onAtualizado: () => void;
}

export function InformacoesGeraisPllPainel({ idContrato, contrato, info, onAtualizado }: InformacoesGeraisPllPainelProps) {
  const [statusSelecionado, setStatusSelecionado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const status = statusSelecionado ?? contrato.status;
  const statusMudou = status !== contrato.status;
  const exigeMotivo = status === "desistente" || status === "desligado" || status === "nao_concluido";

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await atualizarStatusContrato(
        createClient(),
        idContrato,
        status as "ativo" | "concluido" | "nao_concluido" | "desistente" | "desligado",
        motivo || null
      );
      setStatusSelecionado(null);
      setMotivo("");
      onAtualizado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar o status da participação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Campo rotulo="Identidade de Gênero" valor={info.identidadeGenero} />
          <Campo rotulo="Orientação Sexual" valor={info.orientacaoSexual} />
          <Campo rotulo="Cor/Raça" valor={info.corRaca} />
          <Campo rotulo="Tempo na Política" valor={info.tempoNaPolitica} />
          <Campo rotulo="Idade" valor={info.idade != null ? `${info.idade} anos` : null} />
          <Campo rotulo="Escolaridade" valor={info.escolaridade} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Mandato</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Campo rotulo="Partido" valor={contrato.partidoAtual ?? null} />
          <Campo rotulo="Estado" valor={contrato.sgUf ?? null} />
          <Campo rotulo="Cargo" valor={contrato.cargoAtual ?? null} />
          <Campo rotulo="Mandatos Anteriores" valor={info.mandatosAnteriores} />
          <Campo rotulo="Cargos Anteriores" valor={info.cargosAnteriores} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Mentor Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{info.nomeMentor ?? "Nenhum mentor pareado ainda"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vínculo de Acesso</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              <p className="text-xs text-muted-foreground">Origem do cadastro</p>
              <p className="text-sm font-semibold">
                {info.origemCadastro
                  ? `Importado em ${formatarData(info.origemCadastro.dataImportacao)} por ${info.origemCadastro.nomeUsuario}`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Edição Vinculada</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              <p className="text-xs text-muted-foreground">Edição atual</p>
              <p className="text-sm font-semibold">{info.edicaoAtual?.nomeEdicao ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Participação</CardTitle>
            </CardHeader>
            <CardContent>
              {info.historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma participação preenchida</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Edição</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {info.historico.map((h) => (
                      <TableRow key={`${h.nomeEdicao}-${h.dtInicio}`}>
                        <TableCell>{h.nomeEdicao}</TableCell>
                        <TableCell>{formatarPeriodo(h.dtInicio, h.dtFim)}</TableCell>
                        <TableCell>{h.statusContrato ? (STATUS_LABEL_PLL[h.statusContrato] ?? h.statusContrato) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Controle da Participação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {erro && <ErroInline mensagem={erro} />}
              <div className="grid gap-1.5">
                <p className="text-xs font-bold text-muted-foreground">Status</p>
                <Select value={status} onValueChange={setStatusSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL_PLL).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {exigeMotivo && (
                <div className="grid gap-1.5">
                  <p className="text-xs font-bold text-muted-foreground">Motivo (obrigatório para Desistente ou Desligado)</p>
                  <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" />
                </div>
              )}
              {statusMudou && (
                <Button
                  type="button"
                  size="sm"
                  className="w-fit"
                  onClick={() => void salvar()}
                  disabled={salvando || (exigeMotivo && motivo.trim().length === 0)}
                >
                  Salvar status
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
