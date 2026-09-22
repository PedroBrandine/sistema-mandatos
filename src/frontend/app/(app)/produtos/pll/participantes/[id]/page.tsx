"use client";

import { use } from "react";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  buscarComposicaoPartidariaCasa,
  buscarPerfilCandidatura,
  buscarTodasCandidaturasPorTitulo,
  type ComposicaoPartido,
} from "@backend/queries/tse";
import { createClient } from "@backend/supabase/client";

import { FichaAfinidadeAgenda } from "@/components/pll/ficha-afinidade-agenda";
import { FichaDadosTse, type CandidaturaFichaTse } from "@/components/pll/ficha-dados-tse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// T15 (design.md "Components" -- FichaMentoradoPage; PLL-CP-14…19). Monta os
// blocos de LEITURA da Ficha do Mentorado: cabeçalho + Dados TSE (T14) +
// Afinidade de Agenda (T14) + Composição Partidária da Casa (T13). T19
// (Lote 3, Fase 6) acrescenta os 3 blocos EDITÁVEIS (Desafios/Destaques/
// Ambição/SWOT) nesta mesma página -- não recriada aqui.
//
// Rota literal `/produtos/pll/participantes/[id]` (não `[slug]`), igual ao
// href já usado por ListaParticipantesPll (T8/T12, lista-participantes-pll.tsx:254)
// -- por isso NÃO herda o layout.tsx de `produtos/[slug]` (árvore de rotas
// diferente no App Router: uma pasta literal "pll" não compartilha layout
// com a pasta dinâmica "[slug]" no mesmo nível). ProdutoShell é reaproveitado
// diretamente aqui, não pelo layout pai (design.md "Reuses: ProdutoShell").
//
// "Composição Partidária da Casa" (PLL-CP-17…19) não tem componente próprio
// no plano de tasks (T13 é só a função, T14 só lista os 2 componentes de
// Dados TSE/Afinidade) -- renderizado inline nesta página, granularidade
// "T15 | 1 página" da Task Granularity Check de tasks.md.

interface CadastroParticipanteFicha {
  idCadastroParticipante: number;
  nomeCompleto: string;
  papel: "mentorado" | "mentor";
  idVinculoTse: number | null;
  notaEducacao: number | null;
  notaSegurancaPublica: number | null;
  notaModernizacaoEstado: number | null;
  notaClima: number | null;
  outrasPautas: string[];
  especifiquePauta: string | null;
  desafios: string[];
  destaques: string[];
  ambicaoTexto: string | null;
  ambicaoTags: string[];
  swotForcas: string[];
  swotFraquezas: string[];
  swotOportunidades: string[];
  swotAmeacas: string[];
}

async function buscarCadastroParticipanteFicha(id: number): Promise<CadastroParticipanteFicha | null> {
  const { data, error } = await createClient()
    .from("fat_cadastro_participante")
    .select(
      "id_cadastro_participante, nome_completo, papel, id_vinculo_tse, nota_educacao, nota_seguranca_publica, nota_modernizacao_estado, nota_clima, outras_pautas, especifique_pauta, desafios, destaques, ambicao_texto, ambicao_tags, swot_forcas, swot_fraquezas, swot_oportunidades, swot_ameacas"
    )
    .eq("id_cadastro_participante", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    idCadastroParticipante: data.id_cadastro_participante,
    nomeCompleto: data.nome_completo,
    papel: data.papel as "mentorado" | "mentor",
    idVinculoTse: data.id_vinculo_tse,
    notaEducacao: data.nota_educacao,
    notaSegurancaPublica: data.nota_seguranca_publica,
    notaModernizacaoEstado: data.nota_modernizacao_estado,
    notaClima: data.nota_clima,
    outrasPautas: data.outras_pautas ?? [],
    especifiquePauta: data.especifique_pauta,
    desafios: data.desafios ?? [],
    destaques: data.destaques ?? [],
    ambicaoTexto: data.ambicao_texto,
    ambicaoTags: data.ambicao_tags ?? [],
    swotForcas: data.swot_forcas ?? [],
    swotFraquezas: data.swot_fraquezas ?? [],
    swotOportunidades: data.swot_oportunidades ?? [],
    swotAmeacas: data.swot_ameacas ?? [],
  };
}

interface DadosTseFicha {
  candidaturas: CandidaturaFichaTse[];
  composicao: ComposicaoPartido[];
}

async function buscarDadosTseFicha(idVinculoTse: number): Promise<DadosTseFicha> {
  const client = createClient();
  const vazio: DadosTseFicha = { candidaturas: [], composicao: [] };

  const { data: vinculo } = await client
    .from("rel_mandato_candidatura")
    .select("id_mandato")
    .eq("id_vinculo_tse", idVinculoTse)
    .maybeSingle();
  if (!vinculo) return vazio;

  const { data: mandato } = await client
    .from("dim_mandato")
    .select("nr_titulo_eleitoral")
    .eq("id_mandato", vinculo.id_mandato)
    .maybeSingle();
  if (!mandato?.nr_titulo_eleitoral) return vazio;

  const brutas = await buscarTodasCandidaturasPorTitulo(client, mandato.nr_titulo_eleitoral);
  if (brutas.length === 0) return vazio;

  const perfis = await Promise.all(
    brutas.map((c) =>
      buscarPerfilCandidatura(client, {
        anoEleicao: c.anoEleicao,
        sqCandidato: c.sqCandidato,
        nrTurno: c.nrTurno,
      }).catch(() => null)
    )
  );

  const candidaturas: CandidaturaFichaTse[] = brutas
    .map((c, i) => ({
      anoEleicao: c.anoEleicao,
      situacaoEleitoral: c.dsSituacaoCandidatura ?? c.dsSitTotTurno,
      coligacao: perfis[i]?.coligacao ?? null,
      votosRecebidos: c.qtVotosTotal,
    }))
    .sort((a, b) => b.anoEleicao - a.anoEleicao);

  // PLL-CP-17: composição da Casa/UF/ano do mandato VIGENTE (eh_mandato_vigente)
  // -- nunca de uma candidatura anterior (spec.md Edge Cases).
  const { data: vigenteRow } = await client
    .from("rel_mandato_candidatura")
    .select("ano_eleicao")
    .eq("id_mandato", vinculo.id_mandato)
    .eq("eh_mandato_vigente", true)
    .maybeSingle();
  const anoVigente = vigenteRow?.ano_eleicao ?? candidaturas[0]?.anoEleicao ?? null;
  const brutaVigente = anoVigente != null ? brutas.find((c) => c.anoEleicao === anoVigente) : undefined;

  const composicao =
    brutaVigente && brutaVigente.cdCargo != null && brutaVigente.sgUf
      ? await buscarComposicaoPartidariaCasa(client, {
          anoEleicao: brutaVigente.anoEleicao,
          cdCargo: brutaVigente.cdCargo,
          sgUf: brutaVigente.sgUf,
        }).catch(() => [])
      : [];

  return { candidaturas, composicao };
}

const PAPEL_LABEL: Record<CadastroParticipanteFicha["papel"], string> = {
  mentorado: "Mentorado",
  mentor: "Mentor",
};

function ComposicaoPartidariaCasa({ composicao }: { composicao: ComposicaoPartido[] }) {
  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Composição Partidária da Casa</CardTitle>
      </CardHeader>
      <CardContent>
        {/* PLL-CP-19: nunca gráfico vazio sem explicação. */}
        {composicao.length === 0 ? (
          <EstadoVazio titulo="Dados indisponíveis para esta Casa/ano" />
        ) : (
          <ul className="grid gap-2">
            {composicao.map((linha) => (
              <li key={linha.siglaPartido} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{linha.siglaPartido}</span>
                <span className="text-muted-foreground">
                  {linha.quantidade} ({linha.percentual.toFixed(1)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function FichaMentoradoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idCadastroParticipante = Number(id);
  const router = useRouter();

  const {
    data: participante,
    isLoading: carregandoParticipante,
  } = useQuery({
    queryKey: ["pll-ficha-participante", idCadastroParticipante],
    queryFn: () => buscarCadastroParticipanteFicha(idCadastroParticipante),
    enabled: Number.isFinite(idCadastroParticipante),
  });

  const vinculadoTse = participante?.idVinculoTse != null;

  const { data: dadosTse, isLoading: carregandoTse } = useQuery({
    queryKey: ["pll-ficha-tse", participante?.idVinculoTse],
    queryFn: () => buscarDadosTseFicha(participante!.idVinculoTse!),
    enabled: vinculadoTse,
  });

  if (carregandoParticipante) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (!participante) {
    return (
      <EstadoVazio
        titulo="Participante não encontrado"
        mensagem="Este participante não existe ou você não tem acesso a ele."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/produtos/pll/participantes"
          className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar aos participantes
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-4xl uppercase tracking-tight text-secondary">
            {participante.nomeCompleto}
          </h1>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            {PAPEL_LABEL[participante.papel]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {carregandoTse && vinculadoTse ? (
          <CarregandoSkeleton variante="cards" />
        ) : (
          <FichaDadosTse
            vinculadoTse={vinculadoTse}
            candidaturas={dadosTse?.candidaturas ?? []}
            onVincular={() => router.push("/produtos/pll/participantes")}
          />
        )}

        <FichaAfinidadeAgenda
          notaEducacao={participante.notaEducacao}
          notaSegurancaPublica={participante.notaSegurancaPublica}
          notaModernizacaoEstado={participante.notaModernizacaoEstado}
          notaClima={participante.notaClima}
          outrasPautas={participante.outrasPautas}
          especifiquePauta={participante.especifiquePauta}
        />

        {vinculadoTse && <ComposicaoPartidariaCasa composicao={dadosTse?.composicao ?? []} />}
      </div>
    </div>
  );
}
