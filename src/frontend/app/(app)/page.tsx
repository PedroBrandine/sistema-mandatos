"use client";

import { useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";
import { buscarCardsHub, type CardHub } from "@backend/queries/hub";
import { HubCard } from "@/components/app-shell/hub-card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// EST-02 (T12). Substitui a lista literal BOTOES_PRODUTO (risco de AD-001
// já registrado em design.md) por buscarCardsHub (T11) -- um card por
// destino que a leitura no banco realmente permitiu, na ordem fixa dela.
//
// Subtítulo revisto (Done-when): deixa de dizer "Escolha um produto", porque
// o Hub agora lista produtos E ferramentas (Visão Gerencial, Números de
// Impacto, Gestão de Usuários) -- risco aceito: o texto novo é escolha desta
// task, não valida contra nenhuma tela do Figma (que ainda mostra o
// subtítulo antigo).
export default function HubPage() {
  const [cards, setCards] = useState<CardHub[] | null>(null);

  useEffect(() => {
    let cancelado = false;

    buscarCardsHub(createClient()).then((lista) => {
      if (!cancelado) setCards(lista);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-primary">
          Legisla Brasil
        </h1>
        <p className="text-base text-muted-foreground max-w-lg">
          Acesse seus produtos e ferramentas de gestão estratégica, tudo em um só lugar.
        </p>
      </div>

      {cards === null ? (
        <CarregandoSkeleton />
      ) : cards.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum destino disponível"
          mensagem="Sua conta ainda não tem acesso a nenhum produto ou ferramenta."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {cards.map((card) => (
            <HubCard key={card.destino} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
