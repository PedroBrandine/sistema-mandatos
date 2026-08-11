import Link from "next/link";

import { Button } from "@/components/ui/button";

// NAV-04: UI de 404 com a marca do contrato em vez do 404 genérico do Next,
// usada quando FichaContratoChrome chama notFound() (id_contrato inexistente).
export default function ContratoNotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 p-16 text-center">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
        Contrato não encontrado
      </h1>
      <p className="text-sm text-muted-foreground">
        Esse contrato não existe no sistema. Volte ao hub e escolha um produto para ver seus
        contratos ativos.
      </p>
      <Link href="/">
        <Button type="button">Voltar ao hub</Button>
      </Link>
    </div>
  );
}
