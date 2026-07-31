"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";

import { CoalizaoCard, type CoalizaoCardProps } from "@/components/fundacao/coalizao-card";
import { Button } from "@/components/ui/button";

type CoalizaoCartao = CoalizaoCardProps["coalizao"];

// CAD-05 a CAD-08: listagem em cards de todas as coalizões cadastradas --
// mesma estrutura de /mandatos (T14): fetch direto + useState, grid de
// cards, estado vazio com CTA.
export default function CoalizoesPage() {
  const [coalizoes, setCoalizoes] = useState<CoalizaoCartao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [{ data: coalizoesData }, { data: contratantesData }] = await Promise.all([
      supabase.from("dim_coalizao").select("*").order("id_coalizao"),
      supabase.from("dim_contratante").select("*"),
    ]);

    const contratantesPorId = new Map((contratantesData ?? []).map((c) => [c.id_contratante, c]));

    const lista: CoalizaoCartao[] = (coalizoesData ?? []).map((co) => {
      const contratante = contratantesPorId.get(co.id_contratante);
      return {
        idCoalizao: co.id_coalizao,
        nome: contratante?.nome ?? `Coalizão #${co.id_coalizao}`,
        sgUf: contratante?.sg_uf ?? null,
        nmMunicipio: contratante?.nm_municipio ?? null,
      };
    });

    setCoalizoes(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl uppercase">Coalizões</h1>
        <Link href="/coalizoes/novo">
          <Button type="button">Novo</Button>
        </Link>
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : coalizoes.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhuma coalizão cadastrada ainda.</p>
          <Link href="/coalizoes/novo">
            <Button type="button">Cadastrar coalizão</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coalizoes.map((co) => (
            <CoalizaoCard key={co.idCoalizao} coalizao={co} />
          ))}
        </div>
      )}
    </div>
  );
}
