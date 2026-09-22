import { Vote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// pll-cadastro-participantes T14 (design.md "Components" -- ficha-dados-tse;
// PLL-CP-14, PLL-CP-15). Bloco "Dados TSE" da Ficha do Mentorado -- layout
// inspirado em informacoes-tse-mandato.tsx (fundacao/), mas sem os 3 campos
// que não existem no espelho TSE (D-2 da spec: Número do Candidato,
// Classificação na Lista, Despesa de Campanha).
//
// Componente é PURAMENTE presentational (recebe os dados já resolvidos pelo
// pai, T15) -- mesmo padrão de painel-afinidade-agenda.tsx/
// painel-analise-participante.tsx (pll-dashboard-agenda), que também não
// fazem fetch próprio. Buscar/montar os dados da candidatura é
// responsabilidade da página (FichaMentoradoPage, T15), que já reaproveita
// buscarTodasCandidaturasPorTitulo/buscarPerfilCandidatura (tse.ts).

export interface CandidaturaFichaTse {
  anoEleicao: number;
  /** ds_situacao_candidatura ?? ds_sit_tot_turno -- "Situação Eleitoral" (PLL-CP-14). */
  situacaoEleitoral: string | null;
  coligacao: string | null;
  votosRecebidos: number;
}

export interface FichaDadosTseProps {
  vinculadoTse: boolean;
  /** Ordenadas por ano de eleição, mais recente primeiro. Vazio quando `vinculadoTse` é `false`. */
  candidaturas: CandidaturaFichaTse[];
  /** PLL-CP-15: atalho pra vincular quando ainda não há vínculo. */
  onVincular?: () => void;
}

export function FichaDadosTse({ vinculadoTse, candidaturas, onVincular }: FichaDadosTseProps) {
  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Vote className="size-4 text-emerald-600 dark:text-emerald-400" /> Dados TSE
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!vinculadoTse ? (
          <EstadoVazio
            titulo="Ainda não vinculado ao TSE"
            mensagem="Vincule este participante a uma candidatura do TSE para ver situação eleitoral, coligação e votação."
            acao={
              onVincular && (
                <button
                  type="button"
                  onClick={onVincular}
                  className="text-sm font-bold text-secondary hover:underline"
                >
                  Vincular ao TSE
                </button>
              )
            }
          />
        ) : candidaturas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma candidatura encontrada para este mandato." />
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3">
              {candidaturas.map((c) => (
                <div
                  key={c.anoEleicao}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm sm:grid-cols-4"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Eleição</p>
                    <p className="font-bold">{c.anoEleicao}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Situação Eleitoral</p>
                    {/* AD-005: campo ausente vira "—", nunca em branco. */}
                    <p className="font-semibold">{c.situacaoEleitoral ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coligação</p>
                    <p className="font-semibold">{c.coligacao ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Votos Recebidos</p>
                    <p className="font-semibold">{c.votosRecebidos.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>

            {candidaturas.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Evolução de Votos
                </p>
                <ul className="grid gap-1 text-sm">
                  {[...candidaturas]
                    .sort((a, b) => a.anoEleicao - b.anoEleicao)
                    .map((c) => (
                      <li key={c.anoEleicao} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{c.anoEleicao}</span>
                        <span className="font-semibold">{c.votosRecebidos.toLocaleString("pt-BR")} votos</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
