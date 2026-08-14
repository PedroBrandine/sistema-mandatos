import { createClient } from "@backend/supabase/server";
import { buscarDistribuicaoEtapas, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { DistribuicaoEtapasInterativo } from "@/components/visao-gerencial/distribuicao-etapas-interativo";

// visao-gerencial-g3-g6, T24 (Bloco 1, GER-10). Server Component -- busca no
// servidor, repassa dado já ordenado (ref_etapa.ordem, nunca por volume)
// pro Client Component que cuida do clique/modal.
export async function DistribuicaoEtapasBloco({ filtro }: { filtro: FiltroRecorte }) {
  let linhas;
  try {
    const client = await createClient();
    linhas = await buscarDistribuicaoEtapas(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Onde estão os mandatos</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar a distribuição por etapa." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onde estão os mandatos</CardTitle>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma etapa no recorte" mensagem="Ajuste o filtro de produto na barra." />
        ) : (
          <DistribuicaoEtapasInterativo linhas={linhas} filtro={filtro} />
        )}
      </CardContent>
    </Card>
  );
}
