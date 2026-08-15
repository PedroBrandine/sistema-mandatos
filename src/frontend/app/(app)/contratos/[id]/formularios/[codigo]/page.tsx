"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarFormulariosDoContrato, type FormularioListado } from "@backend/queries/formulario";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { FormularioGenericoForm } from "@/components/produtos/formulario-generico-form";
import { FormularioGipForm } from "@/components/produtos/formulario-gip-form";

// FRM-04. Resolve `codigo` da URL: GIP tem tela sob medida (T20), os 2
// formulários de inscrição PLL (inscricao_mentorado/inscricao_mentor) são
// fora de escopo desta feature (spec.md Out of Scope -- acontecem antes de
// existir fat_contrato, incompatível com id_contrato NOT NULL), os outros
// 13 usam o formulário genérico. respondentePermitido reaproveita
// buscarFormulariosDoContrato (T14): a mesma filtragem por papel que a
// lista (T16) usa -- se o item não aparece na lista filtrada de um
// Mentor/Assessor, ele não é o respondente deste formulário (navegação
// direta por URL, fora do fluxo da lista).
const CODIGOS_FORA_DE_ESCOPO = new Set(["inscricao_mentorado", "inscricao_mentor"]);

export default function FormularioContratoPage({
  params,
}: {
  params: Promise<{ id: string; codigo: string }>;
}) {
  const { id, codigo } = use(params);
  const idContrato = Number(id);
  const { papel, idUsuario, carregando: carregandoPapel } = usePapelGlobal();

  const [formularios, setFormularios] = useState<FormularioListado[] | null>(null);

  useEffect(() => {
    if (carregandoPapel || papel == null || idUsuario == null) return;
    let cancelado = false;
    void buscarFormulariosDoContrato(createClient(), idContrato, papel, idUsuario).then((lista) => {
      if (!cancelado) setFormularios(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [idContrato, papel, idUsuario, carregandoPapel]);

  if (codigo === "gip") {
    return <FormularioGipForm idContrato={idContrato} />;
  }

  if (CODIGOS_FORA_DE_ESCOPO.has(codigo)) {
    return (
      <EmDesenvolvimento
        titulo="Fora de escopo"
        mensagem="A inscrição PLL acontece antes da criação do contrato e não é respondida por aqui."
      />
    );
  }

  if (carregandoPapel || formularios === null) {
    return <CarregandoSkeleton />;
  }

  // buscarFormulariosDoContrato já filtra por papel (FRM-14) -- pra
  // Gestora/Admin, "não achar" é código inexistente (URL inválida); pra
  // Mentor/Assessor, também cobre "endereçado a outro papel" (o item nem
  // aparece na lista filtrada dele). RLS bloqueia a escrita de qualquer jeito
  // (defesa em profundidade) -- 404 aqui é só a UX de navegação direta.
  const item = formularios.find((f) => f.codigo === codigo);
  if (!item) {
    notFound();
  }

  // item garantido não-nulo daqui em diante (notFound() acima já interrompeu
  // o render) -- e por construção, se chegou na lista filtrada, o usuário
  // pode responder (respondentePermitido é sempre true neste ponto).

  return (
    <FormularioGenericoForm
      idContrato={idContrato}
      idFormulario={item.idFormulario}
      codigo={codigo}
      respondentePermitido={true}
    />
  );
}
