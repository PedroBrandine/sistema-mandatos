"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";

import { MandatoCard, type MandatoCardProps } from "@/components/fundacao/mandato-card";
import { Button } from "@/components/ui/button";

type MandatoCartao = MandatoCardProps["mandato"];

// CAD-01 a CAD-04: listagem em cards de todos os mandatos cadastrados --
// mesmo padrão de fetch direto + useState já usado em /usuarios (sem
// TanStack Query, ver spec.md Out of Scope). Partido/cargo atuais são
// resolvidos aqui (mapa id->nome), mesmo padrão de MandatoWizard.
export default function MandatosPage() {
  const [mandatos, setMandatos] = useState<MandatoCartao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [{ data: mandatosData }, { data: contratantesData }, { data: partidosData }, { data: cargosData }] =
      await Promise.all([
        supabase.from("dim_mandato").select("*").order("id_mandato"),
        supabase.from("dim_contratante").select("*"),
        supabase.from("ref_partido").select("id_partido, sigla"),
        supabase.from("ref_cargo").select("id_cargo, nome"),
      ]);

    const contratantesPorId = new Map((contratantesData ?? []).map((c) => [c.id_contratante, c]));
    const partidosPorId = new Map((partidosData ?? []).map((p) => [p.id_partido, p.sigla]));
    const cargosPorId = new Map((cargosData ?? []).map((c) => [c.id_cargo, c.nome]));

    const lista: MandatoCartao[] = (mandatosData ?? []).map((m) => {
      const contratante = contratantesPorId.get(m.id_contratante);
      return {
        idMandato: m.id_mandato,
        nomeUrna: m.nm_urna,
        nomeContratante: contratante?.nome ?? `Contratante #${m.id_contratante}`,
        sgUf: contratante?.sg_uf ?? null,
        siglaPartido: m.id_partido_atual != null ? (partidosPorId.get(m.id_partido_atual) ?? null) : null,
        nomeCargo: m.id_cargo_atual != null ? (cargosPorId.get(m.id_cargo_atual) ?? null) : null,
      };
    });

    setMandatos(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl uppercase">Mandatos</h1>
        <Link href="/mandatos/novo">
          <Button type="button">Novo</Button>
        </Link>
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : mandatos.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum mandato cadastrado ainda.</p>
          <Link href="/mandatos/novo">
            <Button type="button">Cadastrar mandato</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mandatos.map((m) => (
            <MandatoCard key={m.idMandato} mandato={m} />
          ))}
        </div>
      )}
    </div>
  );
}
