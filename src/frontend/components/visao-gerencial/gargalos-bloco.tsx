import { createClient } from "@backend/supabase/server";
import { buscarPendencias, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { GargalosTabela } from "@/components/visao-gerencial/gargalos-tabela";

// visao-gerencial-g3-g6, T29 (Bloco 3, GER-19). Server Component -- busca a
// 1ª página no servidor, repassa pro Client Component (agrupamento,
// paginação incremental, navegação). `key={JSON.stringify(filtro)}` força
// remount de GargalosTabela quando o recorte muda -- zera o acumulado de
// "carregar mais" (evita misturar páginas de recortes diferentes).
export async function GargalosBloco({ filtro }: { filtro: FiltroRecorte }) {
  let resultado;
  try {
    const client = await createClient();
    resultado = await buscarPendencias(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gargalos</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar os gargalos." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gargalos</CardTitle>
      </CardHeader>
      <CardContent>
        <GargalosTabela
          key={JSON.stringify(filtro)}
          linhasIniciais={resultado.linhas}
          totalInicial={resultado.total}
          filtro={filtro}
        />
      </CardContent>
    </Card>
  );
}
