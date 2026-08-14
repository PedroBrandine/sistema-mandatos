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

import { PERMISSOES } from "./permissoes";
import { PlanejamentoGrade } from "./planejamento-grade";

// Edge Case do spec.md ("Coalizão sem planejamento próprio"): "SHALL mostrar
// a leitura agregada dos mandatos membros, nunca um formulário de criação de
// Objetivo (não existe dim_planejamento própria pra escrever)". Reusa
// PlanejamentoGrade (T16, .specs/features/planejamento-estrategico-redesenho
// -- substitui PlanejamentoArvore) 1x por membro, sem agregação nova
// (context.md) -- e sempre somenteLeitura (é leitura, não a tela de gestão
// do contrato do membro). `permissoes: PERMISSOES.gestora` + `modo="ler"`:
// maximiza visibilidade de coluna (é um resumo, não deve esconder nada por
// papel) -- `somenteLeitura` já derruba toda capacidade de escrita
// independente do perfil de permissões escolhido aqui.
export interface PlanejamentoAgregadoCoalizaoProps {
  idCoalizao: number;
}

interface DadosMembro {
  membro: ContratoMembro;
  planejamento: PlanejamentoCompleto | null;
}

export function PlanejamentoAgregadoCoalizao({ idCoalizao }: PlanejamentoAgregadoCoalizaoProps) {
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
        <DadosPlanejamentoMembro key={membro.idContrato} nomeContratante={membro.nomeContratante} planejamento={planejamento} />
      ))}
    </div>
  );
}

function DadosPlanejamentoMembro({
  nomeContratante,
  planejamento,
}: {
  nomeContratante: string;
  planejamento: PlanejamentoCompleto | null;
}) {
  const [linhasGrade, setLinhasGrade] = useState<Awaited<ReturnType<typeof buscarGradeSucessosMensais>> | null>(null);
  const idsMeta = planejamento?.objetivos.flatMap((o) => o.metas.map((m) => m.idMeta)) ?? [];

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    buscarGradeSucessosMensais(supabase, idsMeta).then((linhas) => {
      if (!cancelado) setLinhasGrade(linhas);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planejamento?.idPlanejamento]);

  if (!planejamento) return null;

  return (
    <section className="grid gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-base font-medium">{nomeContratante}</h3>
      <PlanejamentoGrade
        idPlanejamento={planejamento.idPlanejamento}
        produtoNome="Estratégia"
        objetivos={planejamento.objetivos}
        linhas={linhasGrade ?? []}
        pessoasVinculadas={[]}
        permissoes={PERMISSOES.gestora}
        modo="ler"
        onEdicaoCelula={async () => {}}
        onColarFaixa={async () => {}}
        onHierarquiaAlterada={() => {}}
        onGradeAlterada={() => {}}
        somenteLeitura
      />
    </section>
  );
}
