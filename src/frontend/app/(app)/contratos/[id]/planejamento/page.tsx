"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { toast } from "sonner";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { atualizarSucessosEmLote, recalcularAtingimento } from "@backend/rpc/planejamento";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";
import { buscarReguaDoContrato, type EtapaRegua } from "@backend/queries/etapa-contrato";
import {
  buscarCoalizaoInfo,
  buscarEvolucaoGip,
  buscarGradeSucessosMensais,
  buscarPessoasVinculadasAoContrato,
  buscarPlanejamentoCompleto,
  buscarPreditoresPlanejamento,
  type LinhaEvolucaoGip,
  type PessoaVinculada,
  type PlanejamentoCompleto,
  type PreditorPrioritarioLinha,
  type SucessoMensalGrade,
} from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ContextoEstrategico } from "@/components/planejamento/contexto-estrategico";
import { PlanejamentoAbas } from "@/components/planejamento/planejamento-abas";
import { PERMISSOES } from "@/components/planejamento/permissoes";
import { PlanejamentoAgregadoCoalizao } from "@/components/planejamento/planejamento-agregado-coalizao";
import { PlanejamentoGrade, type PlanejamentoGradeHandle } from "@/components/planejamento/planejamento-grade";
import { PlanejamentoHeader } from "@/components/planejamento/planejamento-header";
import { PlanejamentoToolbar } from "@/components/planejamento/planejamento-toolbar";
import { cn } from "@/lib/utils";

// PLM-01, PLM-07, PLM-15/16 (planejamento-planilha-monitoramento) + PLR-01,
// PLR-02, PLR-04, PLR-07 (.specs/features/planejamento-estrategico-redesenho,
// T9/T10). Substitui o placeholder <EmDesenvolvimento> já reservado pela
// Trilha F (NAV-08) -- não cria rota nova. Ramifica por
// tipoContratante/possuiPlanejamentoProprio (design.md "Architecture
// Overview"): Coalizão sem planejamento próprio mostra a leitura agregada
// dos membros (PlanejamentoAgregadoCoalizao); todo o resto mostra o cabeçalho
// + as duas abas do próprio contrato.
//
// PLV-14 (T15) APOSENTOU o layout de 2 colunas da PLR-01. O contexto
// estratégico era coluna esquerda permanente (<details>, accordion abaixo de
// 1024px) ao lado da árvore-grade; agora é a aba Diagnóstico, e a grade ocupa a
// largura inteira na aba Construir a estrutura. A regra "nenhum painel fixo à
// direita em nenhum estado" continua valendo, agora trivialmente: não há
// segunda coluna.
//
// PlanejamentoGrade substitui PlanejamentoArvore -- árvore-grade unificada.
// O seletor Construir/Monitorar/Ler que vivia aqui foi REMOVIDO em 2026-09-16
// (AD-059): as telas novas não o desenham, e "Construir" como modo colidia com
// a aba "Construir a estrutura" logo acima dele. A grade mostra um conjunto
// único de colunas e a edição acontece pelo painel lateral de cada item.
//
// Fetch inline via .then() dentro do próprio efeito (mesmo padrão de
// etapas/[codigo]/page.tsx) -- não via função extraída chamada de dentro do
// efeito, que a regra react-hooks/set-state-in-effect rejeita mesmo com
// await no meio.
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
  const { papel, idUsuario } = usePapelGlobal();
  // PLR-07: fallback conservador (assessor -- perfil mais restrito) enquanto
  // `papel` ainda carrega, pra nunca renderizar CRUD/dado sensível antes de
  // saber o papel real (mesmo raciocínio já usado em outras telas do
  // projeto para "carregando" != "sem permissão").
  const permissoes = PERMISSOES[papel ?? "assessor"];
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [soMinhasMetas, setSoMinhasMetas] = useState(false);
  const [quantidadeMarcada, setQuantidadeMarcada] = useState(0);
  const gradeRef = useRef<PlanejamentoGradeHandle>(null);

  // Edge Case (.specs/features/planejamento-estrategico-redesenho/spec.md
  // "WHEN o papel é assessor e ele abre a tela THEN o modo inicial SHALL ser
  // Monitorar, filtrado apenas às Metas [dele]"). `papel` chega async
  // (usePapelGlobal) -- não dá pra decidir no useState inicial de
  // `soMinhasMetas` sem usar o fallback "assessor" também pra quem NÃO é
  // assessor (o fallback existe só pra nunca mostrar CRUD/dado sensível
  // antes de saber o papel real, não pra decidir default de filtro).
  // "Ajustar estado durante o render" (padrão recomendado pelo React pra
  // derivar estado de uma prop que muda, em vez de useEffect + setState
  // síncrono -- react-hooks/set-state-in-effect) -- roda 1x só, na primeira
  // vez que `papel` resolve (`papelParaFiltroPadrao` grava o último papel já
  // processado); depois disso o usuário controla a caixa livremente
  // (toolbar), sem isto voltar a mexer.
  const [papelParaFiltroPadrao, setPapelParaFiltroPadrao] = useState<typeof papel>(null);
  if (papel !== null && papel !== papelParaFiltroPadrao) {
    setPapelParaFiltroPadrao(papel);
    if (PERMISSOES[papel].editaPctSóMetasProprias) setSoMinhasMetas(true);
  }

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [coalizaoSemPlanejamentoProprio, setCoalizaoSemPlanejamentoProprio] = useState<number | null>(null);
  const [regua, setRegua] = useState<EtapaRegua[]>([]);
  const [planejamento, setPlanejamento] = useState<PlanejamentoCompleto | null>(null);
  const [linhasGrade, setLinhasGrade] = useState<SucessoMensalGrade[]>([]);
  const [pessoasVinculadas, setPessoasVinculadas] = useState<PessoaVinculada[]>([]);
  const [preditoresAtuais, setPreditoresAtuais] = useState<PreditorPrioritarioLinha[]>([]);
  const [evolucaoGip, setEvolucaoGip] = useState<LinhaEvolucaoGip[]>([]);

  // Carrega contrato -> decide o ramo (Coalizão sem planejamento próprio ou
  // não), as pessoas vinculadas (Select de "responsável" da Meta, PLM-13) e a
  // régua (etapa atual + atraso pro cabeçalho, PLR-02 -- vw_etapa_contrato via
  // buscarReguaDoContrato, já usada por etapas/[codigo]/page.tsx, nenhuma
  // query nova).
  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then(async (dados) => {
      if (cancelado) return;
      setContrato(dados);

      const pessoas = await buscarPessoasVinculadasAoContrato(supabase, idContrato);
      if (!cancelado) setPessoasVinculadas(pessoas);

      const reguaCompleta = await buscarReguaDoContrato(supabase, idContrato);
      if (!cancelado) setRegua(reguaCompleta);

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

  // Carrega hierarquia + grade (todos os meses do ciclo, D-C -- ver
  // context.md) + preditores prioritários do próprio contrato (só no ramo
  // não-agregado). PLR-04: NÃO recalcula a cascata automaticamente aqui --
  // a tela mostra o valor antigo + a faixa (planejamento.atingimentoDesatualizado)
  // até o usuário clicar "Recalcular agora" (handleRecalcular abaixo). Isso
  // troca o comportamento de PLM-07 (recálculo síncrono e silencioso ao
  // abrir a tela) pela regra inegociável §4 do pedido original -- decisão
  // registrada em design.md "page.tsx — recomposição".
  useEffect(() => {
    if (contrato === undefined || coalizaoSemPlanejamentoProprio !== null) return;
    let cancelado = false;
    const supabase = createClient();

    buscarPlanejamentoCompleto(supabase, idContrato).then(async (dados) => {
      if (cancelado) return;
      setPlanejamento(dados);

      const ids = idsMetaDoPlanejamento(dados);
      if (ids.length > 0) {
        const linhas = await buscarGradeSucessosMensais(supabase, ids);
        if (!cancelado) setLinhasGrade(linhas);
      }

      if (dados) {
        const preditores = await buscarPreditoresPlanejamento(supabase, dados.idPlanejamento);
        if (!cancelado) setPreditoresAtuais(preditores);

        // SAI-08, SAI-09, SAI-10: mesmo useEffect que já busca preditoresAtuais
        // (tasks.md T13) -- evolucaoGip é escopada por id_contrato, não por
        // id_planejamento, mas nasce junto por conveniência (mesmo gatilho).
        const gip = await buscarEvolucaoGip(supabase, idContrato);
        if (!cancelado) setEvolucaoGip(gip);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [contrato, coalizaoSemPlanejamentoProprio, idContrato]);

  // PLR-04: dispara o recálculo só por ação explícita do botão "Recalcular
  // agora" (PlanejamentoHeader) -- refetch de planejamento+grade depois,
  // pra tela mostrar os números novos assim que eles existirem de verdade.
  async function handleRecalcular() {
    if (!planejamento) return;
    const supabase = createClient();
    try {
      await recalcularAtingimento(supabase, planejamento.idPlanejamento);
      setPlanejamento(await buscarPlanejamentoCompleto(supabase, idContrato));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao recalcular o atingimento.");
    }
  }

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
    setLinhasGrade(await buscarGradeSucessosMensais(supabase, ids));
  }

  // PLM-02: salva só a célula editada, sem recarregar a grade inteira (AC
  // literal + risco de adoção AD-028 -- refetch completo a cada tecla é
  // exatamente o custo de rede que a US inteira existe para evitar).
  // Atualização otimista do estado local: nenhum outro campo exibido
  // (status/diasAtraso/estaAtrasado) deriva de pct_atingimento, então
  // substituir só esse campo na linha em memória é suficiente e correto.
  //
  // Success Criteria (spec.md "Limpar uma célula de % grava NULL"): aceita
  // `null` -- `pct_atingimento` já é nullable (AD-005, "NULL nunca
  // sentinela"), quem decide "vazio = NULL" é PlanejamentoGrade
  // (handleCommitCelula), não aqui.
  //
  // PLR-19: relança o erro depois do toast -- PlanejamentoGrade precisa
  // saber que a escrita falhou pra reverter o valor otimista exibido na
  // célula (a Promise nunca resolver com sucesso silencioso num erro real).
  async function handleEdicaoCelula(idSucesso: number, pctAtingimento: number | null) {
    const supabase = createClient();
    const { error } = await supabase
      .from("fat_sucesso_mensal")
      .update({ pct_atingimento: pctAtingimento })
      .eq("id_sucesso", idSucesso);
    if (error) {
      toast.error(mapeiaErroRpc(error).message);
      throw error;
    }
    setLinhasGrade((atual) =>
      atual.map((linha) => (linha.idSucesso === idSucesso ? { ...linha, pctAtingimento } : linha))
    );
  }

  // Mesmo raciocínio de handleEdicaoCelula, para as N linhas da faixa colada
  // (PLR-16/17/18: colar em faixa, aplicar em massa e undo passam todos por
  // aqui). PLR-19: relança o erro após o toast, pelo mesmo motivo acima.
  async function handleColarFaixa(valores: { idSucesso: number; pctAtingimento: number }[]) {
    const supabase = createClient();
    try {
      await atualizarSucessosEmLote(supabase, valores);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao salvar a faixa colada.");
      throw erro;
    }
    const pctPorId = new Map(valores.map((v) => [v.idSucesso, v.pctAtingimento]));
    setLinhasGrade((atual) =>
      atual.map((linha) => (pctPorId.has(linha.idSucesso) ? { ...linha, pctAtingimento: pctPorId.get(linha.idSucesso)! } : linha))
    );
  }

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined) {
    return <CarregandoSkeleton variante="table" />;
  }

  if (coalizaoSemPlanejamentoProprio !== null) {
    return <PlanejamentoAgregadoCoalizao idCoalizao={coalizaoSemPlanejamentoProprio} />;
  }

  if (!planejamento) {
    return <CarregandoSkeleton variante="table" />;
  }

  const etapaAtual = regua.find((e) => e.status === "em_andamento") ?? null;
  const cobertura = {
    n: linhasGrade.filter((l) => l.pctAtingimento != null).length,
    N: linhasGrade.length,
  };

  return (
    <div className="grid gap-6">
      <PlanejamentoHeader
        planejamento={planejamento}
        contrato={contrato}
        etapaAtual={etapaAtual}
        mesCicloAtual={mesReferencia}
        cobertura={cobertura}
        permissoes={permissoes}
        onRecalcular={handleRecalcular}
      />

      {/* PLV-14. As duas abas SUBSTITUEM o layout de 2 colunas da PLR-01: o
          contexto estratégico deixa de ser coluna esquerda permanente e passa a
          ser a aba Diagnóstico, e a árvore-grade ganha a largura inteira na aba
          Construir a estrutura. A regra "nenhum painel fixo à direita" continua
          valendo -- agora trivialmente, porque não há segunda coluna. */}
      <PlanejamentoAbas
        diagnostico={
          <ContextoEstrategico
            planejamento={planejamento}
            preditoresAtuais={preditoresAtuais}
            evolucaoGip={evolucaoGip}
            produtoNome={contrato.nomeProduto}
            permissoes={permissoes}
            onDadosAlterados={() => {
              void recarregarHierarquia();
              void recarregarPreditores();
            }}
          />
        }
        estrutura={
          <div className="grid min-w-0 gap-3">
            <PlanejamentoToolbar
              permissoes={permissoes}
              busca={busca}
              onBuscaChange={setBusca}
              soPendentes={soPendentes}
              onSoPendentesChange={setSoPendentes}
              soMinhasMetas={soMinhasMetas}
              onSoMinhasMetasChange={setSoMinhasMetas}
              onExpandirTudo={() => gradeRef.current?.expandirTudo()}
              onRecolherTudo={() => gradeRef.current?.recolherTudo()}
              onCriarObjetivo={() => gradeRef.current?.criarObjetivo()}
              quantidadeMarcada={quantidadeMarcada}
              onAplicarEmMassa={(valor) => gradeRef.current?.aplicarEmMassa(valor)}
            />

            <PlanejamentoGrade
              ref={gradeRef}
              idPlanejamento={planejamento.idPlanejamento}
              produtoNome={contrato.nomeProduto}
              objetivos={planejamento.objetivos}
              linhas={linhasGrade}
              pessoasVinculadas={pessoasVinculadas}
              permissoes={permissoes}
              busca={busca}
              soPendentes={soPendentes}
              soMinhasMetas={soMinhasMetas}
              idUsuario={idUsuario}
              onSelecaoMudou={setQuantidadeMarcada}
              onEdicaoCelula={handleEdicaoCelula}
              onColarFaixa={handleColarFaixa}
              onHierarquiaAlterada={recarregarHierarquia}
              onGradeAlterada={recarregarGrade}
            />
          </div>
        }
      />
    </div>
  );
}
