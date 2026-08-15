"use client";

import { use } from "react";

import { FormulariosLista } from "@/components/produtos/formularios-lista";

// FRM-01, FRM-02: substitui o placeholder <EmDesenvolvimento> (NAV-06) pela
// lista real. idContrato vem do próprio segmento de rota -- FichaContratoChrome
// (layout pai) não repassa idProduto pra `{children}` hoje, e FormulariosLista
// não precisa dele (ver SPEC_DEVIATION em formularios-lista.tsx).
export default function ContratoFormulariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FormulariosLista idContrato={Number(id)} />;
}
