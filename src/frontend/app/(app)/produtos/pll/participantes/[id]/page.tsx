"use client";

import { use } from "react";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buscarCadastroParticipanteFicha } from "@backend/queries/pll-ficha";
import { createClient } from "@backend/supabase/client";

import { DiagnosticoParticipantePll } from "@/components/pll/diagnostico-participante-pll";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// T15 (design.md "Components" -- FichaMentoradoPage; PLL-CP-14…19). Cabeçalho
// (nome + papel) da Ficha do Mentorado; o corpo (Dados TSE, Composição
// Partidária, Afinidade de Agenda, blocos editáveis T19) vive em
// DiagnosticoParticipantePll (.specs/features/diagnostico-participante-pll/
// spec.md) -- reaproveitado também pela aba "Diagnóstico" da ficha de
// contrato (/contratos/[id]/diagnostico) quando o contrato é do PLL.
//
// Rota literal `/produtos/pll/participantes/[id]` (não `[slug]`), igual ao
// href já usado por ListaParticipantesPll (T8/T12, lista-participantes-pll.tsx:254)
// -- por isso NÃO herda o layout.tsx de `produtos/[slug]` (árvore de rotas
// diferente no App Router: uma pasta literal "pll" não compartilha layout
// com a pasta dinâmica "[slug]" no mesmo nível). ProdutoShell é reaproveitado
// diretamente aqui, não pelo layout pai (design.md "Reuses: ProdutoShell").
//
// Esta rota continua existindo mesmo depois da aba Diagnóstico da ficha de
// contrato: é o único caminho de Ficha para um registro de staging AINDA sem
// `id_contrato` (antes do vínculo TSE) -- Out of Scope de
// diagnostico-participante-pll/spec.md.

const PAPEL_LABEL: Record<"mentorado" | "mentor", string> = {
  mentorado: "Mentorado",
  mentor: "Mentor",
};

export default function FichaMentoradoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idCadastroParticipante = Number(id);
  const router = useRouter();

  const { data: participante, isLoading: carregandoParticipante } = useQuery({
    queryKey: ["pll-ficha-participante", idCadastroParticipante],
    queryFn: () => buscarCadastroParticipanteFicha(createClient(), idCadastroParticipante),
    enabled: Number.isFinite(idCadastroParticipante),
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

      <DiagnosticoParticipantePll
        idCadastroParticipante={idCadastroParticipante}
        onVincular={() => router.push("/produtos/pll/participantes")}
      />
    </div>
  );
}
