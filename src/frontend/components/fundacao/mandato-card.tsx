import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MandatoCardProps {
  mandato: {
    idMandato: number;
    nomeUrna: string | null;
    nomeContratante: string;
    sgUf: string | null;
    siglaPartido: string | null;
    nomeCargo: string | null;
  };
}

// CAD-01/CAD-03: card individual da listagem de mandatos -- nome de urna se
// preenchido, senão o nome do contratante; UF/partido/cargo com fallback "—"
// pra campo ausente (AD-005). Clique navega pro detalhe já existente.
export function MandatoCard({ mandato }: MandatoCardProps) {
  const nome = mandato.nomeUrna ?? mandato.nomeContratante;

  return (
    <Link href={`/mandatos/${mandato.idMandato}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{nome}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground">
          <p>UF: {mandato.sgUf ?? "—"}</p>
          <p>Partido: {mandato.siglaPartido ?? "—"}</p>
          <p>Cargo: {mandato.nomeCargo ?? "—"}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
