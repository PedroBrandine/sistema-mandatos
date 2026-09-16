"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buscarInsightsDoContrato,
  buscarPreInsightsDoContrato,
  type InsightResumo,
  type PreInsightResumo,
} from "@backend/queries/incidencia";
import { buscarPlanejamentoCompleto } from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// FGC-01 (T15, fatos-geradores-ciclo-vida). Passo 1 do FatoGeradorWizard
// (T16): 4 abas de origem (Pré-Insight/Registro/Insight/Meta) com busca
// textual, mais "Fato sem origem" como caminho de primeira classe (spec.md
// P1 AC2/AC3, Edge Case "busca sem resultado"). Escopado ao contrato em
// todas as 4 fontes (AC4) -- nenhuma delas aceita filtro fora de idContrato.
//
// Registro não tem query centralizada por contrato inteiro (só
// buscarRegistrosDaEtapa, escopada a 1 etapa) -- fetch inline, mesmo padrão
// já usado em insight-form.tsx para "Registro de origem". Meta reaproveita
// buscarPlanejamentoCompleto (mesmo padrão de fato-gerador-form.tsx).
export type TipoOrigem = "pre_insight" | "registro" | "insight" | "meta";

export type OrigemFato = { tipo: TipoOrigem; id: number; rotulo: string } | { tipo: "sem_origem" };

interface ItemOrigem {
  id: number;
  rotulo: string;
}

const ABAS: { id: TipoOrigem; rotulo: string }[] = [
  { id: "pre_insight", rotulo: "Pré-Insight" },
  { id: "registro", rotulo: "Registro" },
  { id: "insight", rotulo: "Insight" },
  { id: "meta", rotulo: "Meta" },
];

export interface SeletorOrigemProps {
  idContrato: number;
  valor: OrigemFato | null;
  onSelecionar: (origem: OrigemFato) => void;
}

export function SeletorOrigem({ idContrato, valor, onSelecionar }: SeletorOrigemProps) {
  const [aba, setAba] = useState<TipoOrigem>("pre_insight");
  const [busca, setBusca] = useState("");
  const [itensPorTipo, setItensPorTipo] = useState<Record<TipoOrigem, ItemOrigem[]>>({
    pre_insight: [],
    registro: [],
    insight: [],
    meta: [],
  });

  useEffect(() => {
    const supabase = createClient();

    void buscarPreInsightsDoContrato(supabase, idContrato).then((lista: PreInsightResumo[]) =>
      setItensPorTipo((atual) => ({
        ...atual,
        pre_insight: lista.map((p) => ({ id: p.idPreInsight, rotulo: p.conteudo.slice(0, 60) })),
      }))
    );

    void buscarInsightsDoContrato(supabase, idContrato).then((lista: InsightResumo[]) =>
      setItensPorTipo((atual) => ({
        ...atual,
        insight: lista.map((i) => ({ id: i.idInsight, rotulo: i.conteudo.slice(0, 60) })),
      }))
    );

    supabase
      .from("fat_registro")
      .select("id_registro, ocorrido_em, resumo")
      .eq("id_contrato", idContrato)
      .order("ocorrido_em", { ascending: false })
      .then(
        ({
          data,
        }: {
          data: { id_registro: number; ocorrido_em: string; resumo: string | null }[] | null;
        }) =>
          setItensPorTipo((atual) => ({
            ...atual,
            registro: (data ?? []).map((r) => ({
              id: r.id_registro,
              rotulo: `${new Date(r.ocorrido_em).toLocaleDateString("pt-BR")} — ${r.resumo ?? "sem resumo"}`,
            })),
          }))
      );

    void buscarPlanejamentoCompleto(supabase, idContrato).then((planejamento) =>
      setItensPorTipo((atual) => ({
        ...atual,
        meta: (planejamento?.objetivos ?? []).flatMap((o) =>
          o.metas.map((m) => ({ id: m.idMeta, rotulo: m.descricao }))
        ),
      }))
    );
  }, [idContrato]);

  const itensDaAba = itensPorTipo[aba];
  const buscaNormalizada = busca.trim().toLowerCase();
  const itensFiltrados = useMemo(
    () =>
      buscaNormalizada === ""
        ? itensDaAba
        : itensDaAba.filter((item) => item.rotulo.toLowerCase().includes(buscaNormalizada)),
    [itensDaAba, buscaNormalizada]
  );

  function selecionarAba(id: TipoOrigem) {
    setAba(id);
    setBusca("");
  }

  const semOrigemSelecionado = valor?.tipo === "sem_origem";

  return (
    <div className="grid gap-4">
      <nav aria-label="Origem do Fato Gerador" className="flex items-center gap-4 border-b border-border/40">
        {ABAS.map(({ id, rotulo }) => {
          const ativa = id === aba;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => selecionarAba(id)}
              className={cn(
                "pb-2 text-sm font-medium",
                ativa ? "border-b-2 border-secondary text-secondary" : "text-muted-foreground"
              )}
            >
              {rotulo}
            </button>
          );
        })}
      </nav>

      <Input
        placeholder="Buscar..."
        aria-label="Buscar origem"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {itensFiltrados.length > 0 ? (
        <ul className="grid gap-1.5">
          {itensFiltrados.map((item) => {
            const selecionado = !!valor && valor.tipo === aba && "id" in valor && valor.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => onSelecionar({ tipo: aba, id: item.id, rotulo: item.rotulo })}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm",
                    selecionado ? "border-secondary bg-secondary/10" : "border-border/60"
                  )}
                >
                  {item.rotulo}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid gap-2 rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
          <p>Nenhum resultado encontrado.</p>
          <button
            type="button"
            onClick={() => onSelecionar({ tipo: "sem_origem" })}
            className="mx-auto text-sm font-medium text-secondary underline-offset-4 hover:underline"
          >
            Continuar sem origem
          </button>
        </div>
      )}

      <button
        type="button"
        aria-pressed={semOrigemSelecionado}
        onClick={() => onSelecionar({ tipo: "sem_origem" })}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-sm font-medium",
          semOrigemSelecionado
            ? "border-secondary bg-secondary/10 text-secondary"
            : "border-dashed border-border/60 text-muted-foreground"
        )}
      >
        Fato sem origem
      </button>
    </div>
  );
}
