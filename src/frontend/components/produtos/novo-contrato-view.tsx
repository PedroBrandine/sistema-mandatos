"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import type { ProdutoSlug } from "@backend/queries/produto";

import { CoalizaoForm } from "@/app/(app)/coalizoes/coalizao-form";
import { ContratoForm } from "@/components/fundacao/contrato-form";
import { MandatoWizard } from "@/components/fundacao/mandato-wizard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ContratanteRow = Database["public"]["Tables"]["dim_contratante"]["Row"];

export interface NovoContratoViewProps {
  slug: ProdutoSlug;
  idProduto: number;
  nomeProduto: string;
}

type PassoCoalizao = "escolher" | "nova" | "existente";

// NAV-09: orquestrador da aba "Cadastro de novo Contrato" -- Estratégia/PLL
// reaproveitam o MandatoWizard inteiro (busca TSE/manual/existente já
// resolvidas); Coalizão ramifica em nova coalizão (CoalizaoForm) ou coalizão
// existente (Select), convergindo no mesmo ContratoForm. Ver design.md,
// Components -> NovoContratoView.
export function NovoContratoView({ slug, idProduto, nomeProduto }: NovoContratoViewProps) {
  const produtoTravado = { id: idProduto, nome: nomeProduto };

  if (slug !== "coalizao") {
    return (
      <MandatoWizard
        produtoTravado={produtoTravado}
        destino={(r) => `/contratos/${r.idContrato}`}
        onCriado={() => {}}
      />
    );
  }

  return <FluxoCoalizao produtoTravado={produtoTravado} />;
}

function FluxoCoalizao({ produtoTravado }: { produtoTravado: { id: number; nome: string } }) {
  const router = useRouter();
  const [passo, setPasso] = useState<PassoCoalizao>("escolher");
  const [contratanteAlvo, setContratanteAlvo] = useState<number | null>(null);
  const [coalizoes, setCoalizoes] = useState<ContratanteRow[]>([]);

  useEffect(() => {
    if (passo !== "existente") return;
    let cancelado = false;
    createClient()
      .from("dim_contratante")
      .select("*")
      .eq("tipo_contratante", "coalizao")
      .then(({ data }) => {
        if (!cancelado) setCoalizoes(data ?? []);
      });
    return () => {
      cancelado = true;
    };
  }, [passo]);

  // Passo comum (AC2/AC3): assim que uma coalizão é definida -- nova ou
  // existente -- os dois caminhos convergem no mesmo ContratoForm.
  if (contratanteAlvo !== null) {
    return (
      <ContratoForm
        idContratante={contratanteAlvo}
        contratosExistentes={[]}
        modo={{ tipo: "abrir" }}
        produtoTravado={produtoTravado}
        onConcluido={(criado) => criado && router.push(`/contratos/${criado.idContrato}`)}
      />
    );
  }

  if (passo === "escolher") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={() => setPasso("nova")}>
          Nova coalizão
        </Button>
        <Button type="button" variant="outline" onClick={() => setPasso("existente")}>
          Coalizão existente
        </Button>
      </div>
    );
  }

  if (passo === "nova") {
    return (
      <div className="grid gap-4">
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPasso("escolher")}>
          Voltar
        </Button>
        <CoalizaoForm onCriada={(c) => setContratanteAlvo(c.idContratante)} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPasso("escolher")}>
        Voltar
      </Button>
      <Select onValueChange={(v) => setContratanteAlvo(Number(v))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione a coalizão" />
        </SelectTrigger>
        <SelectContent>
          {coalizoes.map((c) => (
            <SelectItem key={c.id_contratante} value={String(c.id_contratante)}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
