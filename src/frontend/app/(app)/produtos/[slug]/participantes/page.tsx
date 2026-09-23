"use client";

import { use, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  buscarCadastroParticipantesPll,
  buscarMetricasCadastroPll,
  upsertCadastroParticipantes,
  vincularParticipanteAoTse,
  type ParticipantePll,
} from "@backend/queries/pll-cadastro";
import { buscarEdicoesPll, buscarProjetosAtivos, criarEdicaoPll } from "@backend/queries/pll-edicao";
import type { ProdutoSlug } from "@backend/queries/produto";
import { descreveErroDesconhecido } from "@backend/rpc/errors";
import type { LinhaCadastroPll } from "@backend/schemas/cadastro-participante-pll";
import { createClient } from "@backend/supabase/client";
import type { CandidaturaSugerida } from "@backend/types/fundacao";

import { useProdutoAtual } from "@/hooks/use-produto-atual";
import { CadastroManualDialog } from "@/components/pll/cadastro-manual-dialog";
import { CriarEdicaoDialog } from "@/components/pll/criar-edicao-dialog";
import {
  ListaParticipantesPll,
  type FiltroListaParticipantesPll,
} from "@/components/pll/lista-participantes-pll";
import { UploadPlanilhaCard } from "@/components/pll/upload-planilha-card";
import { VincularTseDialog } from "@/components/pll/vincular-tse-dialog";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// T9 (design.md, PLL-SH-02, PLL-CP-01…09): monta UploadPlanilhaCard (T6) +
// ListaParticipantesPll (T8) com dado real (T7). Rota só existe de fato para
// o produto PLL -- ABAS_POR_PRODUTO (pll-dashboard-agenda T2) já liga a aba
// "Participantes" a `/participantes` só no conjunto do PLL; acesso direto a
// outro slug mostra o estado abaixo em vez de dado que não existe pra aquele
// produto (mesmo espírito de not-found.tsx, sem 404 -- a rota existe, o
// conteúdo é que é exclusivo do PLL).
//
// "RLS decide o que cada papel vê" (T9 Done-when): esta página não adiciona
// NENHUMA checagem de papel_global/papel_no_contrato -- a lista e o upload
// mostram exatamente o que `fat_cadastro_participante` devolve pra sessão
// autenticada, e é a RLS de T2 quem decide isso, nunca o cliente.
const TAMANHO_PAGINA_PARTICIPANTES = 20;

// T12 (PLL-CP-11): mesma resolução partido/cargo -> id que mandato-wizard.tsx
// já faz antes de chamar criarMandato -- sem ela, dim_mandato.id_partido_atual/
// id_cargo_atual ficam NULL mesmo com candidatura do TSE escolhida
// (0014_fn_criar_mandato.sql grava exatamente o que `p_mandato` manda, sem
// resolver `cd_cargo_tse`/sigla de partido sozinho).
async function buscarCargosAtivos(): Promise<{ idCargo: number; cdCargoTse: number | undefined }[]> {
  const { data, error } = await createClient()
    .from("ref_cargo")
    .select("id_cargo, cd_cargo_tse")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((c) => ({ idCargo: c.id_cargo, cdCargoTse: c.cd_cargo_tse ?? undefined }));
}

async function buscarPartidosAtivos(): Promise<{ idPartido: number; sigla: string }[]> {
  const { data, error } = await createClient()
    .from("ref_partido")
    .select("id_partido, sigla")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((p) => ({ idPartido: p.id_partido, sigla: p.sigla }));
}

export default function ProdutoParticipantesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };

  if (slug !== "pll") {
    return (
      <EstadoVazio
        titulo="Participantes é exclusivo do PLL"
        mensagem="Esta tela existe só para o produto PLL (spec.md, PLL-SH-02)."
      />
    );
  }

  return <ParticipantesPllPage />;
}

function ParticipantesPllPage() {
  const { data: produto, isLoading: carregandoProduto } = useProdutoAtual("pll");
  const idProduto = produto?.idProduto;
  const queryClient = useQueryClient();

  const { data: edicoes, isLoading: carregandoEdicoes } = useQuery({
    queryKey: ["pll-participantes-edicoes", idProduto],
    queryFn: () => buscarEdicoesPll(createClient(), idProduto as number),
    enabled: idProduto !== undefined,
  });

  const { data: projetos } = useQuery({
    queryKey: ["ref-projeto-ativos"],
    queryFn: () => buscarProjetosAtivos(createClient()),
  });
  const [idEdicaoSelecionada, setIdEdicaoSelecionada] = useState<number | undefined>(undefined);
  const [filtro, setFiltro] = useState<FiltroListaParticipantesPll>({});
  const [pagina, setPagina] = useState(1);
  // T12: linha em processo de vínculo TSE -- presente = VincularTseDialog aberto.
  const [participanteParaVincular, setParticipanteParaVincular] = useState<ParticipantePll | null>(null);

  // Edição escolhida define pra onde a importação grava (D-4: o upsert exige
  // idEdicao). Sem nenhuma edição ativa cadastrada, upload e lista ficam
  // bloqueados (ver estado abaixo) -- "Criar edição" (sessão 22/09) é o jeito
  // de sair desse estado.
  const idEdicaoEfetiva = idEdicaoSelecionada ?? edicoes?.[0]?.idEdicao;

  const { mutateAsync: criarEdicao } = useMutation({
    // PF2-03: idsMentores não vem mais do dialog -- vai sempre [] pro RPC,
    // que já trata pool vazio como "sem mentor padrão" (criarEdicaoPll).
    mutationFn: (input: { nome: string; dtInicio: string; idProjeto: number }) =>
      criarEdicaoPll(createClient(), { idProduto: idProduto as number, idsMentores: [], ...input }),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ["pll-participantes-edicoes"] });
      setIdEdicaoSelecionada(resultado.idEdicao);
      setPagina(1);
    },
  });

  const filtroConsulta = {
    idProduto: idProduto as number,
    idEdicao: idEdicaoEfetiva,
    busca: filtro.busca,
    partido: filtro.partido,
    uf: filtro.uf,
    pagina,
    tamanhoPagina: TAMANHO_PAGINA_PARTICIPANTES,
  };
  const habilitado = idProduto !== undefined && idEdicaoEfetiva !== undefined;

  const {
    data: resultado,
    isLoading: carregandoLista,
    isError: erroLista,
    refetch: refetchLista,
  } = useQuery({
    queryKey: ["pll-cadastro-lista", filtroConsulta],
    queryFn: () => buscarCadastroParticipantesPll(createClient(), filtroConsulta),
    enabled: habilitado,
  });

  // Opções de Partido/UF do filtro: derivadas de um recorte amplo da mesma
  // edição (sem busca/filtro aplicado) -- não existe query de valores
  // distintos dedicada, fora do escopo de T7 (buscarCadastroParticipantesPll
  // já pagina, então usar um tamanho de página grande evita nova função só
  // pra isso).
  const { data: resultadoOpcoes } = useQuery({
    queryKey: ["pll-cadastro-opcoes-filtro", idProduto, idEdicaoEfetiva],
    queryFn: () =>
      buscarCadastroParticipantesPll(createClient(), {
        idProduto: idProduto as number,
        idEdicao: idEdicaoEfetiva,
        tamanhoPagina: 500,
      }),
    enabled: habilitado,
  });
  const partidos = Array.from(
    new Set((resultadoOpcoes?.linhas ?? []).map((l) => l.siglaPartido).filter((v): v is string => v !== null))
  ).sort();
  const ufs = Array.from(
    new Set((resultadoOpcoes?.linhas ?? []).map((l) => l.siglaUf).filter((v): v is string => v !== null))
  ).sort();

  const { data: metricas } = useQuery({
    queryKey: ["pll-cadastro-metricas", idProduto, idEdicaoEfetiva],
    queryFn: () =>
      buscarMetricasCadastroPll(createClient(), {
        idProduto: idProduto as number,
        idEdicao: idEdicaoEfetiva,
      }),
    enabled: habilitado,
  });

  const { mutateAsync: importar } = useMutation({
    mutationFn: (linhas: LinhaCadastroPll[]) =>
      upsertCadastroParticipantes(createClient(), {
        idProduto: idProduto as number,
        idEdicao: idEdicaoEfetiva as number,
        linhas,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-lista"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-metricas"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-opcoes-filtro"] });
    },
  });

  const { data: cargos } = useQuery({ queryKey: ["ref-cargo-ativos"], queryFn: buscarCargosAtivos });
  const { data: partidosRef } = useQuery({ queryKey: ["ref-partido-ativos"], queryFn: buscarPartidosAtivos });

  // T12 (PLL-CP-10, PLL-CP-11, PLL-CP-12): vínculo TSE via vincularParticipanteAoTse
  // (T10) -- sucesso invalida a MESMA queryKey da lista (["pll-cadastro-lista"]),
  // então o indicador ✓ chega por refetch normal do react-query, nunca por
  // reload de página inteira (Done-when de T12).
  const { mutateAsync: vincularTse } = useMutation({
    mutationFn: (input: { participante: ParticipantePll; candidatura: CandidaturaSugerida }) => {
      const idPartido = partidosRef?.find((p) => p.sigla === input.candidatura.sgPartido)?.idPartido ?? null;
      const idCargo = cargos?.find((c) => c.cdCargoTse === input.candidatura.cdCargo)?.idCargo ?? null;
      return vincularParticipanteAoTse(createClient(), {
        idCadastroParticipante: input.participante.idCadastroParticipante,
        idProduto: idProduto as number,
        idEdicao: idEdicaoEfetiva ?? null,
        candidatura: {
          ano_eleicao: input.candidatura.anoEleicao,
          sq_candidato: input.candidatura.sqCandidato,
          nr_turno: input.candidatura.nrTurno,
          metodo_match: input.candidatura.metodoMatch,
          confianca: input.candidatura.confianca,
        },
        contratante: {
          nome:
            input.candidatura.nmUrna ??
            input.candidatura.nmCandidato ??
            input.participante.nomeParlamentar ??
            input.participante.nomeCompleto,
          sg_uf: input.candidatura.sgUf ?? null,
        },
        mandato: {
          nm_civil: input.candidatura.nmCandidato ?? null,
          nm_urna: input.candidatura.nmUrna ?? null,
          nr_titulo_eleitoral: input.candidatura.nrTituloEleitoral ?? null,
          id_partido_atual: idPartido,
          id_cargo_atual: idCargo,
        },
        // PLL-CP-12: já vinculado (troca) -- reaproveita o mesmo contratante,
        // preservando histórico em rel_mandato_candidatura (T10).
        idContratanteExistente: input.participante.idContrato ?? undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-lista"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-opcoes-filtro"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-metricas"] });
    },
  });

  if (carregandoProduto || carregandoEdicoes) {
    return <CarregandoSkeleton variante="cards" />;
  }

  const botaoCriarEdicao = (
    <CriarEdicaoDialog
      projetos={projetos ?? []}
      onCriar={async (input) => {
        await criarEdicao(input);
      }}
    />
  );

  if (!edicoes || edicoes.length === 0) {
    return (
      <div className="grid gap-4">
        <EstadoVazio
          titulo="Nenhuma edição cadastrada"
          mensagem="Crie a primeira edição do PLL para começar a importar participantes."
        />
        <div>{botaoCriarEdicao}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={idEdicaoEfetiva !== undefined ? String(idEdicaoEfetiva) : undefined}
          onValueChange={(v) => {
            setIdEdicaoSelecionada(Number(v));
            setPagina(1);
          }}
        >
          <SelectTrigger aria-label="Edição" className="w-56">
            <SelectValue placeholder="Selecione a edição" />
          </SelectTrigger>
          <SelectContent>
            {edicoes.map((edicao) => (
              <SelectItem key={edicao.idEdicao} value={String(edicao.idEdicao)}>
                {edicao.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {botaoCriarEdicao}
        <CadastroManualDialog
          onCriar={async (linha) => {
            await importar([linha]);
          }}
        />
      </div>

      <UploadPlanilhaCard
        metricas={{
          participantesCadastrados: metricas?.participantesCadastrados ?? 0,
          pendentesRevisao: metricas?.pendentesRevisao ?? 0,
          comDadosIncompletos: metricas?.comDadosIncompletos ?? 0,
        }}
        ultimaImportacao={metricas?.ultimaImportacao ?? null}
        onImportar={async (linhas) => {
          await importar(linhas);
        }}
      />

      {erroLista ? (
        <ErroInline
          mensagem="Não foi possível carregar a lista de participantes."
          onRetry={() => refetchLista()}
        />
      ) : carregandoLista || !resultado ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <ListaParticipantesPll
          participantes={resultado.linhas}
          total={resultado.total}
          pagina={pagina}
          tamanhoPagina={TAMANHO_PAGINA_PARTICIPANTES}
          filtro={filtro}
          onFiltroChange={(novoFiltro) => {
            setFiltro(novoFiltro);
            setPagina(1);
          }}
          onPaginaChange={setPagina}
          partidos={partidos}
          ufs={ufs}
          onVincularTse={setParticipanteParaVincular}
        />
      )}

      {participanteParaVincular && (
        <VincularTseDialog
          open
          onOpenChange={(aberto) => {
            if (!aberto) setParticipanteParaVincular(null);
          }}
          participante={participanteParaVincular}
          onConfirmar={async (candidatura) => {
            try {
              await vincularTse({ participante: participanteParaVincular, candidatura });
            } catch (erro) {
              // PLL-CP-11 edge case: candidatura já vinculada a outro
              // participante do mesmo contrato (dim_contratante UNIQUE) chega
              // aqui já mapeada por mapeiaErroRpc (T10) -- nunca uma frase
              // genérica (AD-005). Relança pra VincularTseDialog NÃO fechar
              // (PLL-CP-13: erro não é uma decisão explícita).
              toast.error(descreveErroDesconhecido(erro));
              throw erro;
            }
          }}
          onNaoEncontrado={() => {}}
        />
      )}
    </div>
  );
}
