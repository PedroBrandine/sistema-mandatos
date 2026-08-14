import { createClient } from "@backend/supabase/server";
import { buscarSaudeCobertura, buscarSaudeFormularios, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ChartLinhaEvolucao } from "@/components/visao-gerencial/chart-linha-evolucao";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";
import { apararUltimosMeses } from "@/components/visao-gerencial/periodo";

// visao-gerencial-g3-g6, T22 (Bloco 0, GER-06/07/08). G3+G4 medem o próprio
// sistema (Constituição §2.6) -- ficam acima de qualquer indicador de
// mandato, sempre (garantido pela ordem em page.tsx, T30). Server Component
// -- busca os dois indicadores no servidor, cada um com try/catch próprio
// pra falhar isolado do resto do bloco (12. Estados: erro nunca derruba os
// outros).
export async function SaudeOperacaoBloco({ filtro }: { filtro: FiltroRecorte }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BlocoG3 filtro={filtro} />
      <BlocoG4 filtro={filtro} />
    </div>
  );
}

async function BlocoG3({ filtro }: { filtro: FiltroRecorte }) {
  let dado;
  try {
    const client = await createClient();
    dado = await buscarSaudeCobertura(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cobertura de registro (G3)</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar a cobertura de registro." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobertura de registro (G3)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {dado.pctCobertura === null ? (
          <EstadoVazio titulo="Sem contrato ativo no recorte" mensagem="Ajuste o filtro pra ver a cobertura de registro." />
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <p className="font-heading text-4xl font-bold text-foreground">{dado.pctCobertura.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">
                {dado.qtdSemRegistro} contrato(s) sem registro nos últimos 45 dias
                {dado.qtdEtapasSemRegistro > 0 ? ` · ${dado.qtdEtapasSemRegistro} etapa(s) concluída(s) sem registro` : ""}
              </p>
            </div>
            {dado.evolucaoMensal.length > 0 && (
              <ChartLinhaEvolucao
                titulo="Evolução mensal da cobertura"
                series={[
                  {
                    id: "cobertura",
                    nome: "Cobertura",
                    cor: "var(--primary)",
                    pontos: apararUltimosMeses(dado.evolucaoMensal, filtro.mesesEvolucao).map((p) => ({ mes: p.mes, valor: p.pct })),
                  },
                ]}
                unidade="pct"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

async function BlocoG4({ filtro }: { filtro: FiltroRecorte }) {
  let dado;
  try {
    const client = await createClient();
    dado = await buscarSaudeFormularios(client, filtro);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Formulários (G4)</CardTitle>
        </CardHeader>
        <CardContent>
          <ErroInline mensagem="Não foi possível carregar a saúde de formulários." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulários (G4)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {dado.qtdAbertosMais30Dias} formulário(s) aberto(s) há mais de 30 dias
        </p>
        {dado.porFormulario.length === 0 ? (
          <EstadoVazio titulo="Nenhum formulário no recorte" mensagem="Ajuste o filtro pra ver a taxa de resposta." />
        ) : (
          <ChartBarraHorizontal
            titulo="Taxa de resposta por formulário"
            itens={dado.porFormulario.map((f) => ({ id: String(f.idFormulario), rotulo: f.nomeFormulario, valor: f.taxaResposta }))}
            unidade="pct"
          />
        )}
        {dado.evolucaoMensal.length > 0 && (
          <ChartLinhaEvolucao
            titulo="Evolução mensal da taxa média de resposta"
            series={[
              {
                id: "taxa",
                nome: "Taxa média",
                cor: "var(--primary)",
                pontos: apararUltimosMeses(dado.evolucaoMensal, filtro.mesesEvolucao).map((p) => ({ mes: p.mes, valor: p.taxaMedia })),
              },
            ]}
            unidade="pct"
          />
        )}
      </CardContent>
    </Card>
  );
}
