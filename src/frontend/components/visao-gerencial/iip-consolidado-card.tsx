import { createClient } from "@backend/supabase/server";
import { buscarIipConsolidado, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";

// visao-gerencial-g3-g6, T27 (GER-18). Server Component, leitura (não é
// indicador G) -- nunca recalcula o IIP (AD-014, a Incidência calcula, a
// Saída só lê mv_iip_contrato). Regra de segurança §9 do pedido original:
// MV sem RLS, leitura só no servidor -- nunca client component (respeitado
// por este arquivo ser um Server Component puro).
export async function IipConsolidadoCard({ filtro }: { filtro: FiltroRecorte }) {
  let dado;
  try {
    const client = await createClient();
    dado = await buscarIipConsolidado(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>IIP consolidado</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar o IIP." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>IIP consolidado</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Alert>
          <AlertTitle>Valor provisório (D2)</AlertTitle>
          <AlertDescription>
            A aritmética final do IIP ainda está aberta com a área de conhecimento -- este número é
            <code className="mx-1 rounded bg-muted px-1">iip_provisorio</code>, sujeito a mudar.
          </AlertDescription>
        </Alert>

        <div className="flex items-baseline gap-3">
          <p className="font-heading text-4xl font-bold text-foreground">
            {dado.valorMedio === null ? "—" : dado.valorMedio.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">
            {dado.dtDadoMaisRecente
              ? `dado mais recente: ${new Date(dado.dtDadoMaisRecente).toLocaleDateString("pt-BR")}`
              : "sem fato gerador no recorte"}
          </p>
        </div>

        {dado.distribuicaoPorNivel.some((n) => n.qtdContratos > 0) && (
          <ChartBarraHorizontal
            titulo="Distribuição por nível de IIP"
            itens={dado.distribuicaoPorNivel.map((n) => ({ id: n.nivel, rotulo: n.nivel, valor: n.qtdContratos }))}
            ordenarPorValor={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
