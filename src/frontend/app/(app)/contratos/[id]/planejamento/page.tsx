"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { toast } from "sonner";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { atualizarSucessosEmLote, recalcularAtingimento } from "@backend/rpc/planejamento";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";
import {
  buscarCoalizaoInfo,
  buscarGradeSucessosMensais,
  buscarPlanejamentoCompleto,
  type PlanejamentoCompleto,
  type SucessoMensalGrade,
} from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { GradeSucessosMensais } from "@/components/planejamento/grade-sucessos-mensais";
import { HierarquiaPlanejamento } from "@/components/planejamento/hierarquia-planejamento";
import { PlanejamentoAgregadoCoalizao } from "@/components/planejamento/planejamento-agregado-coalizao";

// PLM-01, PLM-07. Substitui o placeholder <EmDesenvolvimento> já reservado
// pela Trilha F (NAV-08) -- não cria rota nova. Ramifica por
// tipoContratante/possuiPlanejamentoProprio (design.md "Architecture
// Overview"): Coalizão sem planejamento próprio mostra a leitura agregada
// dos membros (PlanejamentoAgregadoCoalizao); todo o resto mostra a
// hierarquia + grade reais do próprio contrato.
//
// Fetch inline via .then() dentro do próprio efeito (mesmo padrão de
// etapas/[codigo]/page.tsx) -- não via função extraída chamada de dentro do
// efeito, que a regra react-hooks/set-state-in-effect rejeita mesmo com
// await no meio. Guard de "já recalculei este planejamento" via useRef, não
// useState -- ref não é state reativo, mutar direto no efeito não viola a regra.
function mesReferenciaCorrente(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

function idsMetaDoPlanejamento(planejamento: PlanejamentoCompleto | null): number[] {
  return planejamento?.objetivos.flatMap((o) => o.metas.map((m) => m.idMeta)) ?? [];
}

export default function ContratoPlanejamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);
  const mesReferencia = useMemo(() => mesReferenciaCorrente(), []);

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [coalizaoSemPlanejamentoProprio, setCoalizaoSemPlanejamentoProprio] = useState<number | null>(null);
  const [planejamento, setPlanejamento] = useState<PlanejamentoCompleto | null>(null);
  const [linhasGrade, setLinhasGrade] = useState<SucessoMensalGrade[]>([]);

  const idPlanejamentoRecalculadoRef = useRef<number | null>(null);

  // Carrega contrato -> decide o ramo (Coalizão sem planejamento próprio ou não).
  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then(async (dados) => {
      if (cancelado) return;
      setContrato(dados);
      if (!dados || dados.tipoContratante !== "coalizao") return;

      const coalizao = await buscarCoalizaoInfo(supabase, dados.idContratante);
      if (!cancelado && coalizao && !coalizao.possuiPlanejamentoProprio) {
        setCoalizaoSemPlanejamentoProprio(coalizao.idCoalizao);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato]);

  // Carrega hierarquia + grade do próprio contrato (só no ramo não-agregado).
  useEffect(() => {
    if (contrato === undefined || coalizaoSemPlanejamentoProprio !== null) return;
    let cancelado = false;
    const supabase = createClient();

    buscarPlanejamentoCompleto(supabase, idContrato).then(async (dados) => {
      if (cancelado) return;
      setPlanejamento(dados);

      const ids = idsMetaDoPlanejamento(dados);
      if (ids.length > 0) {
        const linhas = await buscarGradeSucessosMensais(supabase, ids, mesReferencia);
        if (!cancelado) setLinhasGrade(linhas);
      }

      // PLM-07: recalcula a cascata síncrono, ao abrir a tela -- 1 vez por
      // planejamento (design.md Tech Decisions: não pg_cron, sem infra no
      // projeto; 1 linha de dim_planejamento é barato o bastante).
      if (dados && idPlanejamentoRecalculadoRef.current !== dados.idPlanejamento) {
        idPlanejamentoRecalculadoRef.current = dados.idPlanejamento;
        recalcularAtingimento(supabase, dados.idPlanejamento).catch(() => undefined);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [contrato, coalizaoSemPlanejamentoProprio, idContrato, mesReferencia]);

  async function recarregarHierarquia() {
    const supabase = createClient();
    setPlanejamento(await buscarPlanejamentoCompleto(supabase, idContrato));
  }

  const idsMetaComPesoDivergente = useMemo(() => {
    const somaPorMeta = new Map<number, number>();
    for (const linha of linhasGrade) {
      somaPorMeta.set(linha.idMeta, (somaPorMeta.get(linha.idMeta) ?? 0) + linha.peso);
    }
    const divergentes = new Set<number>();
    for (const [idMeta, soma] of somaPorMeta) {
      if (Math.round(soma * 100) / 100 !== 100) divergentes.add(idMeta);
    }
    return divergentes;
  }, [linhasGrade]);

  const metasParaGrade = useMemo(
    () => planejamento?.objetivos.flatMap((o) => o.metas.map((m) => ({ idMeta: m.idMeta, descricao: m.descricao }))) ?? [],
    [planejamento]
  );

  // PLM-02: salva só a célula editada, sem recarregar a grade inteira (AC
  // literal + risco de adoção AD-028 -- refetch completo a cada tecla é
  // exatamente o custo de rede que a US inteira existe para evitar).
  // Atualização otimista do estado local: nenhum outro campo exibido
  // (status/diasAtraso/estaAtrasado) deriva de pct_atingimento, então
  // substituir só esse campo na linha em memória é suficiente e correto.
  async function handleEdicaoCelula(idSucesso: number, pctAtingimento: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from("fat_sucesso_mensal")
      .update({ pct_atingimento: pctAtingimento })
      .eq("id_sucesso", idSucesso);
    if (error) {
      toast.error(mapeiaErroRpc(error).message);
      return;
    }
    setLinhasGrade((atual) =>
      atual.map((linha) => (linha.idSucesso === idSucesso ? { ...linha, pctAtingimento } : linha))
    );
  }

  // Mesmo raciocínio de handleEdicaoCelula, para as N linhas da faixa colada.
  async function handleColarFaixa(valores: { idSucesso: number; pctAtingimento: number }[]) {
    const supabase = createClient();
    try {
      await atualizarSucessosEmLote(supabase, valores);
      const pctPorId = new Map(valores.map((v) => [v.idSucesso, v.pctAtingimento]));
      setLinhasGrade((atual) =>
        atual.map((linha) => (pctPorId.has(linha.idSucesso) ? { ...linha, pctAtingimento: pctPorId.get(linha.idSucesso)! } : linha))
      );
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao salvar a faixa colada.");
    }
  }

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined) {
    return <CarregandoSkeleton variante="table" />;
  }

  if (coalizaoSemPlanejamentoProprio !== null) {
    return <PlanejamentoAgregadoCoalizao idCoalizao={coalizaoSemPlanejamentoProprio} mesReferencia={mesReferencia} />;
  }

  if (!planejamento) {
    return <CarregandoSkeleton variante="table" />;
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Planejamento Estratégico</h2>
        {planejamento.pctAtingimento != null && (
          <p className="text-sm text-muted-foreground">Atingimento geral: {planejamento.pctAtingimento}%</p>
        )}
      </div>

      {planejamento.objetivos.length === 0 ? (
        <EstadoVazio titulo="Nenhum Objetivo Específico cadastrado ainda" />
      ) : (
        <HierarquiaPlanejamento
          idPlanejamento={planejamento.idPlanejamento}
          produtoNome={contrato.nomeProduto}
          objetivos={planejamento.objetivos}
          idsMetaComPesoDivergente={idsMetaComPesoDivergente}
          onCriado={recarregarHierarquia}
        />
      )}

      <GradeSucessosMensais
        metas={metasParaGrade}
        linhas={linhasGrade}
        onEdicaoCelula={handleEdicaoCelula}
        onColarFaixa={handleColarFaixa}
      />
    </div>
  );
}
