"use client";

import { use, useState } from "react";

import { GipEvolucao } from "@/components/produtos/gip-evolucao";
import { GipRegua } from "@/components/produtos/gip-regua";
import { Button } from "@/components/ui/button";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: GIP
// conforme a metodologia vigente" AC6 (FMC-25..FMC-28). design.md, Ordem de
// construção "GIP" -- monta os 3 modos (Início/Fim de GipRegua + Evolução
// de GipEvolucao) atrás de um seletor local. Substitui o placeholder de T23
// (`EmDesenvolvimento titulo="GIP em desenvolvimento"`).
//
// A-10: `momento = 'meio'` permanece no CHECK do banco, sem superfície --
// o seletor SÓ oferece Início e Fim, mais a visão Evolução.
type Modo = "inicio" | "fim" | "evolucao";

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: "inicio", rotulo: "Início" },
  { valor: "fim", rotulo: "Fim" },
  { valor: "evolucao", rotulo: "Evolução" },
];

export default function ContratoGipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);
  const [modo, setModo] = useState<Modo>("inicio");

  return (
    <div className="grid gap-6">
      <h1 className="font-heading text-2xl text-secondary">Régua dos Sonhos (GIP)</h1>

      <div className="flex gap-2" role="tablist" aria-label="Modo de visualização do GIP">
        {MODOS.map((m) => (
          <Button
            key={m.valor}
            type="button"
            variant={modo === m.valor ? "default" : "outline"}
            onClick={() => setModo(m.valor)}
          >
            {m.rotulo}
          </Button>
        ))}
      </div>

      {modo === "inicio" && <GipRegua idContrato={idContrato} momento="inicio" />}
      {modo === "fim" && <GipRegua idContrato={idContrato} momento="fim" />}
      {modo === "evolucao" && <GipEvolucao idContrato={idContrato} />}
    </div>
  );
}
