import { createClient } from "@backend/supabase/server";
import { buscarAtingimentoPorRecorte, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";

// visao-gerencial-g3-g6, T25 (GER-14/15/16). Server Component. Evolução
// mensal fica de fora de propósito -- fat_snapshot_mensal (job de
// fechamento mensal, OUT-06) não existe ainda (spec.md, Out of Scope;
// decisão confirmada com o usuário na sessão de Specify). Placeholder
// explícito, nunca gráfico vazio silencioso (spec.md GER-15).
export async function G5AtingimentoCard({ filtro }: { filtro: FiltroRecorte }) {
  let dado;
  try {
    const client = await createClient();
    dado = await buscarAtingimentoPorRecorte(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atingimento (G5)</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar o atingimento." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atingimento (G5)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {dado.qtdSmNaoAtualizadosMesCorrente} Sucesso(s) Mensal(is) não atualizado(s) no mês corrente
        </p>

        {dado.qtdDesatualizados > 0 && (
          <Alert>
            <AlertTitle>Atingimento desatualizado</AlertTitle>
            <AlertDescription>
              {dado.qtdDesatualizados} contrato(s) do recorte têm atingimento desatualizado -- o número agregado abaixo
              não reflete o dado mais recente desses contratos.
            </AlertDescription>
          </Alert>
        )}

        {dado.porProduto.length === 0 ? (
          <EstadoVazio titulo="Nenhum contrato com atingimento no recorte" mensagem="Ajuste o filtro da barra." />
        ) : (
          <ChartBarraHorizontal
            titulo="% de atingimento por produto"
            itens={dado.porProduto.map((p) => ({ id: p.nome, rotulo: p.nome, valor: p.pctMedio }))}
            unidade="pct"
          />
        )}

        {dado.porProjeto.length > 0 && (
          <ChartBarraHorizontal
            titulo="% de atingimento por projeto"
            itens={dado.porProjeto.map((p) => ({ id: p.nome, rotulo: p.nome, valor: p.pctMedio }))}
            unidade="pct"
          />
        )}

        <EstadoVazio
          titulo="Evolução mensal aguardando fechamento mensal (OUT-06)"
          mensagem="G5 é indicador fotografado -- a série histórica depende do job de fechamento mensal (fat_snapshot_mensal), que ainda não existe."
        />
      </CardContent>
    </Card>
  );
}
