"use client";

import { use, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buscarCadastroParticipantesPll,
  buscarMetricasCadastroPll,
  upsertCadastroParticipantes,
} from "@backend/queries/pll-cadastro";
import type { ProdutoSlug } from "@backend/queries/produto";
import type { LinhaCadastroPll } from "@backend/schemas/cadastro-participante-pll";
import { createClient } from "@backend/supabase/client";

import { useProdutoAtual } from "@/hooks/use-produto-atual";
import {
  ListaParticipantesPll,
  type FiltroListaParticipantesPll,
} from "@/components/pll/lista-participantes-pll";
import { UploadPlanilhaCard } from "@/components/pll/upload-planilha-card";
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

async function buscarEdicoesAtivas(): Promise<{ id: number; nome: string }[]> {
  const { data, error } = await createClient()
    .from("ref_projeto")
    .select("id_projeto, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }));
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
    queryKey: ["pll-participantes-edicoes"],
    queryFn: buscarEdicoesAtivas,
  });

  const [idProjetoSelecionado, setIdProjetoSelecionado] = useState<number | undefined>(undefined);
  const [filtro, setFiltro] = useState<FiltroListaParticipantesPll>({});
  const [pagina, setPagina] = useState(1);

  // Edição escolhida define pra onde a importação grava (D-4: o upsert exige
  // idProjeto). SPEC-PRECISION GAP: nem spec.md nem design.md dizem qual
  // "edição" recebe uma importação nova -- esta Select torna a escolha
  // explícita em vez de assumir uma edição implícita; sem nenhuma edição
  // ativa cadastrada, upload e lista ficam bloqueados (ver estado abaixo).
  const idProjetoEfetivo = idProjetoSelecionado ?? edicoes?.[0]?.id;

  const filtroConsulta = {
    idProduto: idProduto as number,
    idProjeto: idProjetoEfetivo,
    busca: filtro.busca,
    partido: filtro.partido,
    uf: filtro.uf,
    pagina,
    tamanhoPagina: TAMANHO_PAGINA_PARTICIPANTES,
  };
  const habilitado = idProduto !== undefined && idProjetoEfetivo !== undefined;

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
    queryKey: ["pll-cadastro-opcoes-filtro", idProduto, idProjetoEfetivo],
    queryFn: () =>
      buscarCadastroParticipantesPll(createClient(), {
        idProduto: idProduto as number,
        idProjeto: idProjetoEfetivo,
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
    queryKey: ["pll-cadastro-metricas", idProduto, idProjetoEfetivo],
    queryFn: () =>
      buscarMetricasCadastroPll(createClient(), {
        idProduto: idProduto as number,
        idProjeto: idProjetoEfetivo,
      }),
    enabled: habilitado,
  });

  const { mutateAsync: importar } = useMutation({
    mutationFn: (linhas: LinhaCadastroPll[]) =>
      upsertCadastroParticipantes(createClient(), {
        idProduto: idProduto as number,
        idProjeto: idProjetoEfetivo as number,
        linhas,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-lista"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-metricas"] });
      void queryClient.invalidateQueries({ queryKey: ["pll-cadastro-opcoes-filtro"] });
    },
  });

  if (carregandoProduto || carregandoEdicoes) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (!edicoes || edicoes.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma edição cadastrada"
        mensagem="Cadastre uma edição (projeto) do PLL antes de importar participantes."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Select
        value={idProjetoEfetivo !== undefined ? String(idProjetoEfetivo) : undefined}
        onValueChange={(v) => {
          setIdProjetoSelecionado(Number(v));
          setPagina(1);
        }}
      >
        <SelectTrigger aria-label="Edição" className="w-56">
          <SelectValue placeholder="Selecione a edição" />
        </SelectTrigger>
        <SelectContent>
          {edicoes.map((edicao) => (
            <SelectItem key={edicao.id} value={String(edicao.id)}>
              {edicao.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        />
      )}
    </div>
  );
}
