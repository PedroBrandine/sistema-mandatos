import type { CadeiaItem } from "@backend/queries/incidencia";
import { rotulaCadeias, type CadeiaRotulada } from "@/lib/incidencia-cadeia";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// FGC-13/FGC-14 (T21, fatos-geradores-ciclo-vida). Lista de cadeias do Ciclo
// de Vida -- letra posicional gerada no render (rotulaCadeias, T14, AD-053),
// nunca lida do banco. Cadeia com mais de 1 Fato Gerador marcada "Origem
// comum" (spec.md P2 AC3); cadeia direta no fato (1 elemento, sem
// rel_fato_origem) renderiza normal, sem marca de incompletude (AC4); seção
// própria "Cadeia Projetada (em análise)" para cadeias só de fatos
// projetados (AC5).
export interface CadeiaListaProps {
  cadeias: CadeiaItem[];
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function Cadeia({ cadeia }: { cadeia: CadeiaRotulada }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{cadeia.rotulo}</CardTitle>
        {cadeia.origemComum && <Badge variant="outline">Origem comum</Badge>}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {cadeia.itens.map((item) => (
          <div key={item.idFatoGerador} className="flex items-center justify-between">
            <span>{item.titulo ?? "—"}</span>
            <span className="text-muted-foreground">{formatarData(item.dataEvento)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CadeiaLista({ cadeias }: CadeiaListaProps) {
  if (cadeias.length === 0) {
    return <EstadoVazio titulo="Nenhuma cadeia ainda" mensagem="Cadeias aparecem aqui a partir do primeiro Fato Gerador." />;
  }

  const agrupadas = rotulaCadeias(cadeias);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        {agrupadas.realizadas.map((cadeia) => (
          <Cadeia key={cadeia.rotulo} cadeia={cadeia} />
        ))}
      </div>

      {agrupadas.projetadas.length > 0 && (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Cadeia Projetada (em análise)</h3>
          {agrupadas.projetadas.map((cadeia) => (
            <Cadeia key={cadeia.rotulo} cadeia={cadeia} />
          ))}
        </div>
      )}
    </div>
  );
}
