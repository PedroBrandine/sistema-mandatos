"use client";

import { use, useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { atualizarStatusContrato } from "@backend/rpc/contrato";
import { moverEtapaKanban } from "@backend/rpc/kanban";
import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, buscarEtapasDoProduto, type ContratoParaFicha, type EtapaResumo } from "@backend/queries/contrato";
import { buscarInformacoesGeraisMandato, type InformacoesGeraisMandato } from "@backend/queries/ficha-mandato";

import { CardHistoricoContratos } from "@/components/fundacao/card-historico-contratos";
import { CardPontoFocal } from "@/components/fundacao/card-ponto-focal";
import { CardProjetosCoalizoes } from "@/components/fundacao/card-projetos-coalizoes";
import { CardSobreMandato } from "@/components/fundacao/card-sobre-mandato";
import { InformacoesTseMandato } from "@/components/fundacao/informacoes-tse-mandato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// FMC-05..FMC-13 (.specs/features/ficha-mandato-contrato/spec.md, "P1:
// Informações Gerais do mandato"). Monta os 4 cards novos de T25-T28 mais a
// seção TSE já existente (informacoes-tse-mandato.tsx), que DESCE para uma
// seção própria dentro da mesma aba -- ela não é substituída (design.md,
// Code Reuse Analysis). Layout de duas colunas conforme o desenho `57:6`:
// coluna esquerda com a identidade editorial do mandato (Sobre o Mandato +
// Ponto Focal e Gestoras), coluna direita com o histórico administrativo
// (Histórico de Contratos + Projetos e Coalizões Vinculados); o TSE ocupa a
// largura cheia abaixo das duas.
//
// contrato: undefined=carregando, null=confirmado ausente/coalizão --
// notFound() só é chamado no corpo do render (nunca dentro do useEffect que
// popula o estado), mesmo padrão de ficha-contrato-chrome.tsx e das demais
// sub-rotas desta ficha. `erro` cobre a falha de
// buscarInformacoesGeraisMandato (RLS negando leitura, AD-001, ou qualquer
// outra falha de leitura) -- a query lança em vez de devolver undefined
// nesse caso, então precisa de try/catch aqui.
export default function InformacoesContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [dados, setDados] = useState<InformacoesGeraisMandato | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  // PF-04 (T4): etapas do produto do contrato, pra montar o Select de Etapa
  // -- mesma leitura que a Ficha já usa pras abas (buscarEtapasDoProduto).
  const [etapas, setEtapas] = useState<EtapaResumo[]>([]);

  const carregarDados = useCallback(async () => {
    setErro(null);
    try {
      const resultado = await buscarInformacoesGeraisMandato(createClient(), idContrato);
      setDados(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar as informações gerais do mandato.");
    }
  }, [idContrato]);

  const carregarContrato = useCallback(async () => {
    const encontrado = await buscarContratoParaFicha(createClient(), idContrato);
    const valido = encontrado && encontrado.tipoContratante === "mandato" && encontrado.idMandato != null;
    setContrato(valido ? encontrado : null);
    return valido ? encontrado : null;
  }, [idContrato]);

  useEffect(() => {
    let cancelado = false;
    carregarContrato().then((encontrado) => {
      if (cancelado || !encontrado) return;
      buscarEtapasDoProduto(createClient(), encontrado.idProduto).then((lista) => {
        if (!cancelado) setEtapas(lista);
      });
    });
    return () => {
      cancelado = true;
    };
  }, [carregarContrato]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined || dados === undefined) {
    return erro ? <ErroInline mensagem={erro} onRetry={carregarDados} /> : <CarregandoSkeleton />;
  }

  if (erro) {
    return <ErroInline mensagem={erro} onRetry={carregarDados} />;
  }

  if (!dados) {
    // buscarInformacoesGeraisMandato devolve null quando o contrato não tem
    // dim_mandato -- não deveria acontecer aqui (contrato já filtrado acima
    // por tipoContratante === "mandato"), mas trata explicitamente em vez de
    // deixar a tela quebrar (AD-005).
    return (
      <ErroInline mensagem="Não foi possível carregar as informações gerais deste mandato." onRetry={carregarDados} />
    );
  }

  return (
    <div className="grid gap-6">
      <CardStatusEtapa
        idContrato={idContrato}
        contrato={contrato}
        etapas={etapas}
        onAtualizado={() => void carregarContrato()}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <CardSobreMandato
            idMandato={dados.idMandato}
            minibiografia={dados.minibiografia}
            principaisPautas={dados.principaisPautas}
            areasTematicas={dados.areasTematicas}
            contatoParlamentar={dados.contatoParlamentar}
            contatoChefeGabinete={dados.contatoChefeGabinete}
            onAtualizado={carregarDados}
          />
          <CardPontoFocal
            idContrato={idContrato}
            pontoFocal={dados.pontoFocal}
            gestoras={dados.gestoras}
            onAtualizado={carregarDados}
          />
        </div>

        <div className="grid gap-6">
          <CardHistoricoContratos contratos={dados.historicoContratos} idContratoAtual={idContrato} />
          <CardProjetosCoalizoes projeto={dados.projeto} coalizoes={dados.coalizoes} />
        </div>
      </div>

      <InformacoesTseMandato idMandato={dados.idMandato} />
    </div>
  );
}

type StatusContrato = "ativo" | "concluido" | "nao_concluido";

const ROTULO_STATUS: Record<StatusContrato, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  nao_concluido: "Não concluído",
};

interface CardStatusEtapaProps {
  idContrato: number;
  contrato: ContratoParaFicha | null | undefined;
  etapas: EtapaResumo[];
  onAtualizado: () => void;
}

// PF-04 (T4): edição de Status (via atualizarStatusContrato, T3) e Etapa
// (via moverEtapaKanban já existente -- mesma RPC que o Kanban usa, mesma
// coluna fat_contrato.id_etapa_atual, então uma mudança aqui aparece no
// Kanban na próxima leitura dele, sem campo duplicado). Transição de etapa
// inválida é recusada pela própria RPC (KAN01/TransicaoInvalidaError),
// mesma regra do Kanban.
function CardStatusEtapa({ idContrato, contrato, etapas, onAtualizado }: CardStatusEtapaProps) {
  const [statusSelecionado, setStatusSelecionado] = useState<StatusContrato | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState<string | null>(null);

  const [etapaSelecionada, setEtapaSelecionada] = useState<number | null>(null);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  if (!contrato) return null;

  const status = statusSelecionado ?? contrato.status;
  const etapa = etapaSelecionada ?? contrato.idEtapaAtual;

  async function salvarStatus() {
    setSalvandoStatus(true);
    setErroStatus(null);
    try {
      await atualizarStatusContrato(createClient(), idContrato, status, motivo || null);
      setStatusSelecionado(null);
      setMotivo("");
      onAtualizado();
    } catch (e) {
      setErroStatus(e instanceof Error ? e.message : "Erro ao atualizar o status do contrato.");
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function salvarEtapa() {
    if (etapa === null) return;
    setSalvandoEtapa(true);
    setErroEtapa(null);
    try {
      await moverEtapaKanban(createClient(), { idContrato, idEtapaDestino: etapa });
      setEtapaSelecionada(null);
      onAtualizado();
    } catch (e) {
      setErroEtapa(e instanceof Error ? e.message : "Erro ao atualizar a etapa do contrato.");
    } finally {
      setSalvandoEtapa(false);
    }
  }

  const statusMudou = status !== contrato.status;
  const etapaMudou = etapa !== contrato.idEtapaAtual;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status e Etapa</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm sm:grid-cols-2">
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Status do contrato</p>
          {erroStatus && <ErroInline mensagem={erroStatus} />}
          <Select value={status} onValueChange={(v) => setStatusSelecionado(v as StatusContrato)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROTULO_STATUS) as StatusContrato[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status === "nao_concluido" && (
            <Input
              placeholder="Motivo do encerramento"
              aria-label="Motivo do encerramento"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
          {statusMudou && (
            <Button
              type="button"
              size="sm"
              className="w-fit"
              onClick={salvarStatus}
              disabled={salvandoStatus || (status === "nao_concluido" && motivo.trim().length === 0)}
            >
              Salvar status
            </Button>
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Etapa do produto</p>
          {erroEtapa && <ErroInline mensagem={erroEtapa} />}
          <Select
            value={etapa !== null ? String(etapa) : undefined}
            onValueChange={(v) => setEtapaSelecionada(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={etapas.length === 0 ? "Carregando…" : "Selecione"} />
            </SelectTrigger>
            <SelectContent>
              {etapas.map((e) => (
                <SelectItem key={e.idEtapa} value={String(e.idEtapa)}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {etapaMudou && (
            <Button type="button" size="sm" className="w-fit" onClick={salvarEtapa} disabled={salvandoEtapa}>
              Salvar etapa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
