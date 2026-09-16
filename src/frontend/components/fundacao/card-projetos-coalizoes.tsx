import type { CoalizaoVinculada, ProjetoVinculado } from "@backend/queries/ficha-mandato";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC9 (FMC-13). Cores confirmadas com a skill
// figma-dominio-legisla / docs/Identidade Visual Legisla.md: "Codificação de
// produtos por cor... Coalizões → Roxo" (#BA6BED, `--chart-5` em
// globals.css) -- mesma variável já usada para o badge de tipo de registro
// em produtos/[slug]/agenda/page.tsx. "Projeto" não é produto e não tem cor
// própria na paleta, então usa a variante neutra padrão do Badge.

export interface CardProjetosCoalizoesProps {
  projeto: ProjetoVinculado | null;
  coalizoes: CoalizaoVinculada[];
}

export function CardProjetosCoalizoes({ projeto, coalizoes }: CardProjetosCoalizoesProps) {
  const semVinculo = !projeto && coalizoes.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projetos e Coalizões Vinculados</CardTitle>
      </CardHeader>
      <CardContent>
        {semVinculo ? (
          <EstadoVazio
            titulo="Nenhum projeto ou coalizão vinculado"
            mensagem="Este contrato ainda não tem projeto de origem nem participação em coalizão."
          />
        ) : (
          <ul className="grid gap-2">
            {projeto && (
              <li className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Projeto</Badge>
                <span className="text-foreground">{projeto.nome}</span>
              </li>
            )}
            {coalizoes.map((c) => (
              <li key={c.idCoalizao} className="flex items-center gap-2 text-sm">
                <Badge className="bg-chart-5 text-foreground">Coalizão</Badge>
                <span className="text-foreground">{c.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
