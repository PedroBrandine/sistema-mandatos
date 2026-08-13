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
  buscarPessoasVinculadasAoContrato,
  buscarPlanejamentoCompleto,
  buscarPreditoresPlanejamento,
  type PessoaVinculada,
  type PlanejamentoCompleto,
  type PreditorPrioritarioLinha,
  type SucessoMensalGrade,
} from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { DadosPlanejamentoForm } from "@/components/planejamento/dados-planejamento-form";
import { PlanejamentoAgregadoCoalizao } from "@/components/planejamento/planejamento-agregado-coalizao";
import { PlanejamentoArvore } from "@/components/planejamento/planejamento-arvore";

// PLM-01, PLM-07, PLM-15/16. Substitui o placeholder <EmDesenvolvimento> já
// reservado pela Trilha F (NAV-08) -- não cria rota nova. Ramifica por
// tipoContratante/possuiPlanejamentoProprio (design.md "Architecture
// Overview"): Coalizão sem planejamento próprio mostra a leitura agregada
// dos membros (PlanejamentoAgregadoCoalizao); todo o resto mostra os dados
// do planejamento + hierarquia + grade reais do próprio contrato.
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
  const { papel } = usePapelGlobal();
  const podeEditarDadosPlanejamento = papel === "gestora" || papel === "admin";

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [coalizaoSemPlanejamentoProprio, setCoalizaoSemPlanejamentoProprio] = useState<number | null>(null);
  const [planejamento, setPlanejamento] = useState<PlanejamentoCompleto | null>(null);
  const [linhasGrade, setLinhasGrade] = useState<SucessoMensalGrade[]>([]);
  const [pessoasVinculadas, setPessoasVinculadas] = useState<PessoaVinculada[]>([]);
  const [preditoresAtuais, setPreditoresAtuais] = useState<PreditorPrioritarioLinha[]>([]);
  const [editandoDadosPlanejamento, setEditandoDadosPlanejamento] = useState(false);

  const idPlanejamentoRecalculadoRef = useRef<number | null>(null);

  // Carrega contrato -> decide o ramo (Coalizão sem planejamento próprio ou
  // não) e as pessoas vinculadas (Select de "responsável" da Meta, PLM-13).
  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then(async (dados) => {
      if (cancelado) return;
      setContrato(dados);

      const pessoas = await buscarPessoasVinculadasAoContrato(supabase, idContrato);
      if (!cancelado) setPessoasVinculadas(pessoas);

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

  // Carrega hierarquia + grade + preditores prioritários do próprio contrato
  // (só no ramo não-agregado).
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

      if (dados) {
        const preditores = await buscarPreditoresPlanejamento(supabase, dados.idPlanejamento);
        if (!cancelado) setPreditoresAtuais(preditores);
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

  async function recarregarPreditores() {
    if (!planejamento) return;
    const supabase = createClient();
    setPreditoresAtuais(await buscarPreditoresPlanejamento(supabase, planejamento.idPlanejamento));
  }

  // PLM-17/18: criar/editar detalhes de um Sucesso Mensal muda campos que a
  // atualização otimista de handleEdicaoCelula não cobre -- refetch
  // completo da grade (ação rara, diferente do fluxo de % da AC PLM-02).
  async function recarregarGrade() {
    const ids = idsMetaDoPlanejamento(planejamento);
    if (ids.length === 0) return;
    const supabase = createClient();
    setLinhasGrade(await buscarGradeSucessosMensais(supabase, ids, mesReferencia));
  }

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
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Planejamento Estratégico</h2>
          {planejamento.pctAtingimento != null && (
            <p className="text-sm text-muted-foreground">Atingimento geral: {planejamento.pctAtingimento}%</p>
          )}
        </div>

        {/* PLM-15/16: objetivo do ano/legado/análise de conjuntura/perfil de
            atuação + preditores prioritários -- só Gestora/Admin editam
            (mesmo GRANT de dim_planejamento/rel_planejamento_preditor que
            justifica o gate de Objetivo/Meta, PLM-14); Mentor/Assessor
            veem em leitura. */}
        {podeEditarDadosPlanejamento &&
          (editandoDadosPlanejamento ? (
            <DadosPlanejamentoForm
              planejamento={planejamento}
              preditoresAtuais={preditoresAtuais}
              onConcluido={() => {
                setEditandoDadosPlanejamento(false);
                void recarregarHierarquia();
                void recarregarPreditores();
              }}
            />
          ) : (
            <div className="grid gap-1 rounded-lg border p-4 text-sm">
              <p>
                <span className="font-medium">Objetivo do ano:</span> {planejamento.objetivoAno ?? "—"}
              </p>
              <p>
                <span className="font-medium">Legado:</span> {planejamento.legado ?? "—"}
              </p>
              <p>
                <span className="font-medium">Análise de conjuntura:</span> {planejamento.analiseConjuntura ?? "—"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={() => setEditandoDadosPlanejamento(true)}
              >
                Editar dados do Planejamento
              </Button>
            </div>
          ))}
      </div>

      <PlanejamentoArvore
        idPlanejamento={planejamento.idPlanejamento}
        produtoNome={contrato.nomeProduto}
        objetivos={planejamento.objetivos}
        linhas={linhasGrade}
        pessoasVinculadas={pessoasVinculadas}
        onEdicaoCelula={handleEdicaoCelula}
        onColarFaixa={handleColarFaixa}
        onHierarquiaAlterada={recarregarHierarquia}
        onGradeAlterada={recarregarGrade}
      />
    </div>
  );
}
