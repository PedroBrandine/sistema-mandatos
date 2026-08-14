import { createClient } from "@backend/supabase/server";
import { buscarCompletudeCadastro, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";

const ROTULO_CAMPO: Record<string, string> = {
  ds_genero: "Gênero",
  ds_raca: "Raça",
  fl_pcd: "PCD",
  confianca: "Confiança",
  titulo_eleitoral: "Título eleitoral",
};

// visao-gerencial-g3-g6, T26 (GER-17). Server Component. Evolução mensal
// fica de fora, TODO(G6-evolucao) -- log_auditoria é Admin-only por RLS
// (p_log_admin), Gestora nunca conseguiria ler; abrir essa exceção de
// segurança é decisão fora do escopo de Design (design.md, "Achado que
// reverte uma decisão do Discuss").
export async function G6CompletudeCard({ filtro }: { filtro: FiltroRecorte }) {
  let dado;
  try {
    const client = await createClient();
    dado = await buscarCompletudeCadastro(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completude de cadastro (G6)</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar a completude de cadastro." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completude de cadastro (G6)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {dado.every((c) => c.qtdContratos === 0) ? (
          <EstadoVazio titulo="Nenhum campo pendente no recorte" mensagem="Cadastro completo pros contratos filtrados." />
        ) : (
          <ChartBarraHorizontal
            titulo="Contratos com campo pendente"
            itens={dado.map((c) => ({ id: c.campo, rotulo: ROTULO_CAMPO[c.campo] ?? c.campo, valor: c.qtdContratos }))}
            ordenarPorValor={false}
          />
        )}

        <EstadoVazio
          titulo="Evolução mensal fora de escopo (TODO G6-evolucao)"
          mensagem="Exigiria minerar log_auditoria (Admin-only por RLS) -- decisão de segurança fora desta fatia."
        />
      </CardContent>
    </Card>
  );
}
