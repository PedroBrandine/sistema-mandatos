import Link from "next/link";
import { Home, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface NaoAutorizadoProps {
  titulo?: string;
  mensagem?: string;
}

// Bloqueio 403 -- primeiro componente do tipo no projeto (visao-gerencial-g3-g6,
// T18, GER-01). Diferente de <EstadoVazio> (recorte sem dado): aqui o
// problema é permissão, não ausência de dado -- ícone/tom próprios (nunca a
// cor de status "erro" reaproveitada como decoração genérica, regra de
// visualização do pedido original).
export function NaoAutorizado({
  titulo = "Acesso restrito",
  mensagem = "Esta área é exclusiva da coordenação de Mandatos (Gestora/Admin).",
}: NaoAutorizadoProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center shadow-sm">
      <div className="flex size-20 items-center justify-center rounded-full bg-destructive/5 ring-1 ring-destructive/10">
        <ShieldAlert className="size-10 text-destructive/70" strokeWidth={1.5} aria-hidden="true" />
      </div>

      <div className="grid gap-2 max-w-md">
        <p className="font-heading text-xl font-medium text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{mensagem}</p>
      </div>

      <Link href="/">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Home className="size-3.5" aria-hidden="true" />
          Voltar ao hub
        </Button>
      </Link>
    </div>
  );
}
