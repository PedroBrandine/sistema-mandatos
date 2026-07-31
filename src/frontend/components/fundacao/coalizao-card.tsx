import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CoalizaoCardProps {
  coalizao: {
    idCoalizao: number;
    nome: string;
    sgUf: string | null;
    nmMunicipio: string | null;
  };
}

// CAD-05/CAD-07: card individual da listagem de coalizões -- nome, UF e
// município, com fallback "—" pra campo ausente (AD-005). Clique navega pro
// detalhe já existente.
export function CoalizaoCard({ coalizao }: CoalizaoCardProps) {
  return (
    <Link href={`/coalizoes/${coalizao.idCoalizao}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{coalizao.nome}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground">
          <p>UF: {coalizao.sgUf ?? "—"}</p>
          <p>Município: {coalizao.nmMunicipio ?? "—"}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
