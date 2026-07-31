"use client";

import { useRouter } from "next/navigation";

import type { MandatoCriado } from "@backend/types/fundacao";

import { MandatoWizard } from "@/components/fundacao/mandato-wizard";

export default function NovoMandatoPage() {
  const router = useRouter();

  function aoCriar(mandato: MandatoCriado) {
    router.push(`/mandatos/${mandato.idMandato}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 md:p-10">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl uppercase">Novo mandato</h1>
        <p className="text-sm text-muted-foreground">
          Uma ficha por pessoa. Nome, partido e cargo vêm do TSE — o resto você completa.
        </p>
      </div>
      <MandatoWizard onCriado={aoCriar} />
    </div>
  );
}
