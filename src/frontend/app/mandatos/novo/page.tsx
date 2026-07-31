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
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Novo mandato</h1>
      <MandatoWizard onCriado={aoCriar} />
    </div>
  );
}
