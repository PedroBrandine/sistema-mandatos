"use client";

import { useRouter } from "next/navigation";

import type { CoalizaoCriada } from "@backend/types/fundacao";

import { CoalizaoForm } from "../coalizao-form";

export default function NovaCoalizaoPage() {
  const router = useRouter();

  function aoCriar(coalizao: CoalizaoCriada) {
    router.push(`/coalizoes/${coalizao.idCoalizao}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Nova coalizão</h1>
      <CoalizaoForm onCriada={aoCriar} />
    </div>
  );
}
