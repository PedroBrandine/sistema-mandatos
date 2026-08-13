"use client";

import { useEffect, useState } from "react";

import {
  buscarContratosMembros,
  buscarGradeSucessosMensais,
  buscarPlanejamentoCompleto,
  type ContratoMembro,
  type PlanejamentoCompleto,
} from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { PlanejamentoArvore } from "./planejamento-arvore";

// Edge Case do spec.md ("Coalizão sem planejamento próprio"): "SHALL mostrar
// a leitura agregada dos mandatos membros, nunca um formulário de criação de
// Objetivo (não existe dim_planejamento própria pra escrever)". Reusa
// PlanejamentoArvore 1x por membro, sem agregação nova (context.md) -- e
// sempre somenteLeitura (é leitura, não a tela de gestão do contrato do
// membro).
export interface PlanejamentoAgregadoCoalizaoProps {
  idCoalizao: number;
  mesReferencia: string;
}

interface DadosMembro {
  membro: ContratoMembro;
  planejamento: PlanejamentoCompleto | null;
}

export function PlanejamentoAgregadoCoalizao({ idCoalizao, mesReferencia }: PlanejamentoAgregadoCoalizaoProps) {
  const [dados, setDados] = useState<DadosMembro[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    async function carregar() {
      const membros = await buscarContratosMembros(supabase, idCoalizao);
      const carregados = await Promise.all(
        membros.map(async (membro) => ({
          membro,
          planejamento: await buscarPlanejamentoCompleto(supabase, membro.idContrato),
        }))
      );
      if (!cancelado) setDados(carregados);
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [idCoalizao]);

  if (dados === null) return <CarregandoSkeleton variante="list" />;

  if (dados.length === 0) {
    return <EstadoVazio titulo="Nenhum membro ativo nesta Coalizão" />;
  }

  return (
    <div className="grid gap-8">
      {dados.map(({ membro, planejamento }) => (
        <DadosPlanejamentoMembro key={membro.idContrato} nomeContratante={membro.nomeContratante} planejamento={planejamento} mesReferencia={mesReferencia} />
      ))}
    </div>
  );
}

function DadosPlanejamentoMembro({
  nomeContratante,
  planejamento,
  mesReferencia,
}: {
  nomeContratante: string;
  planejamento: PlanejamentoCompleto | null;
  mesReferencia: string;
}) {
  const [linhasGrade, setLinhasGrade] = useState<Awaited<ReturnType<typeof buscarGradeSucessosMensais>> | null>(null);
  const idsMeta = planejamento?.objetivos.flatMap((o) => o.metas.map((m) => m.idMeta)) ?? [];

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    buscarGradeSucessosMensais(supabase, idsMeta, mesReferencia).then((linhas) => {
      if (!cancelado) setLinhasGrade(linhas);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planejamento?.idPlanejamento, mesReferencia]);

  if (!planejamento) return null;

  return (
    <section className="grid gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-base font-medium">{nomeContratante}</h3>
      <PlanejamentoArvore
        idPlanejamento={planejamento.idPlanejamento}
        produtoNome="Estratégia"
        objetivos={planejamento.objetivos}
        linhas={linhasGrade ?? []}
        pessoasVinculadas={[]}
        onEdicaoCelula={async () => {}}
        onColarFaixa={async () => {}}
        onHierarquiaAlterada={() => {}}
        onGradeAlterada={() => {}}
        somenteLeitura
      />
    </section>
  );
}
