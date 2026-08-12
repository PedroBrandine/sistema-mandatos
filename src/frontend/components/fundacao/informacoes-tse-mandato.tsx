"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Vote } from "lucide-react";
import { toast } from "sonner";

import { marcarCandidaturaVigente } from "@backend/rpc/mandato";
import {
  buscarPerfilCandidatura,
  buscarPerfilEleitoradoCandidatura,
  buscarTodasCandidaturasPorTitulo,
} from "@backend/queries/tse";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import type { PerfilCandidatura, PerfilEleitorado } from "@backend/types/fundacao";

import { PerfilEleitoradoChart } from "@/components/fundacao/perfil-eleitorado-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

type CandidaturaRow = Database["public"]["Tables"]["rel_mandato_candidatura"]["Row"];

interface PerfilVotacao {
  qtVotosTotal: number | null;
  nmMunicipioPrincipal: string | null;
  nmUrna: string | null;
  dsCargo: string | null;
  sgPartido: string | null;
}

interface PerfilTseCandidatura {
  votacao: PerfilVotacao | null;
  pessoal: PerfilCandidatura | null;
  eleitorado: PerfilEleitorado | null;
}

export interface InformacoesTseMandatoProps {
  idMandato: number;
}

// Aba "Informações Gerais" da ficha do contrato (só quando tipo_contratante
// === 'mandato', ver ficha-contrato-chrome.tsx) -- pedido direto de Pedro
// após o fechamento da feature navegacao-por-produto: "por hora" os dados do
// TSE (versão completa: accordion por ano + perfil pessoal + gráfico de
// eleitorado, confirmado por Pedro em vez da versão simples).
//
// Reproduz o mesmo bloco/lógica que já existe em mandatos/[id]/page.tsx
// (accordion de candidaturas TSE), mas como componente independente e
// autocontido (fetch próprio, não recebe nada de fora além de idMandato) --
// deliberado: aquela página é grande (745 linhas), delicada (cascata de
// exclusão) e sem cobertura de teste (camada de frontend, decisão de
// projeto); refatorá-la pra extrair o bloco compartilhado teria risco de
// regressão desproporcional ao ganho de não duplicar ~150 linhas. Se algum
// dia as duas telas forem tocadas juntas de propósito, unificar num só
// componente compartilhado é o caminho natural (ver Deferred Ideas).
export function InformacoesTseMandato({ idMandato }: InformacoesTseMandatoProps) {
  const [carregando, setCarregando] = useState(true);
  const [nrTituloEleitoral, setNrTituloEleitoral] = useState<string | null>(null);
  const [nmUrna, setNmUrna] = useState<string | null>(null);
  const [candidaturas, setCandidaturas] = useState<CandidaturaRow[]>([]);
  const [perfisTse, setPerfisTse] = useState<Record<number, PerfilTseCandidatura>>({});
  const [anoAberto, setAnoAberto] = useState<number | null>(null);
  // Incrementado por marcarVigente pra forçar o efeito abaixo a recarregar
  // sem precisar chamar uma função "carregar" de fora do próprio efeito
  // (react-hooks/set-state-in-effect não permite invocar, de dentro de um
  // useEffect, uma função useCallback que dá setState -- a função de
  // carregamento fica local ao efeito, e o reload vira mudança de dependência).
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const supabase = createClient();

      const { data: mandato } = await supabase
        .from("dim_mandato")
        .select("nr_titulo_eleitoral, nm_urna")
        .eq("id_mandato", idMandato)
        .maybeSingle();

      if (cancelado) return;
      if (!mandato) {
        setCarregando(false);
        return;
      }

      setNrTituloEleitoral(mandato.nr_titulo_eleitoral);
      setNmUrna(mandato.nm_urna);

      const { data: candidaturasData } = await supabase
        .from("rel_mandato_candidatura")
        .select("*")
        .eq("id_mandato", idMandato)
        .order("ano_eleicao", { ascending: false });

      let cList = candidaturasData ?? [];

      if (mandato.nr_titulo_eleitoral) {
        const completas = await buscarTodasCandidaturasPorTitulo(supabase, mandato.nr_titulo_eleitoral);
        for (const comp of completas) {
          const jaExiste = cList.some(
            (c) => c.ano_eleicao === comp.anoEleicao && c.sq_candidato === comp.sqCandidato
          );
          if (!jaExiste) {
            cList.push({
              id_vinculo_tse: -comp.sqCandidato,
              id_mandato: idMandato,
              ano_eleicao: comp.anoEleicao,
              sq_candidato: comp.sqCandidato,
              nr_turno: comp.nrTurno,
              metodo_match: "titulo_eleitoral",
              confianca: "alta",
              status: "confirmado",
              id_usuario_validou: null,
              validado_em: null,
              criado_em: new Date().toISOString(),
              eh_mandato_vigente: false,
            });
          }
        }
      }

      if (cancelado) return;
      cList = [...cList].sort((a, b) => b.ano_eleicao - a.ano_eleicao);
      setCandidaturas(cList);
      setAnoAberto((atual) => atual ?? (cList.length > 0 ? cList[0].ano_eleicao : null));

      const entradas = await Promise.all(
        cList.map(async (c) => {
          const chave = { anoEleicao: c.ano_eleicao, sqCandidato: c.sq_candidato, nrTurno: c.nr_turno };
          const [resumo, pessoal, eleitorado] = await Promise.all([
            supabase
              .schema("tse")
              .from("mv_candidatura_resumo")
              .select("qt_votos_total, nm_municipio_principal, nm_urna, ds_cargo, sg_partido")
              .eq("ano_eleicao", chave.anoEleicao)
              .eq("sq_candidato", chave.sqCandidato)
              .eq("nr_turno", chave.nrTurno)
              .maybeSingle()
              .then(({ data }) => data ?? null),
            buscarPerfilCandidatura(supabase, chave).catch(() => null),
            buscarPerfilEleitoradoCandidatura(supabase, chave).catch(() => null),
          ]);

          let qtVotosTotal = resumo?.qt_votos_total ?? null;
          if (qtVotosTotal == null) {
            const { data: votosZona } = await supabase
              .schema("tse")
              .from("fat_votacao_zona")
              .select("qt_votos_nominais")
              .eq("sq_candidato", c.sq_candidato);
            if (votosZona && votosZona.length > 0) {
              qtVotosTotal = votosZona.reduce((acc, curr) => acc + (curr.qt_votos_nominais ?? 0), 0);
            }
          }

          const perfil: PerfilTseCandidatura = {
            votacao:
              resumo || qtVotosTotal !== null
                ? {
                    qtVotosTotal,
                    nmMunicipioPrincipal: resumo?.nm_municipio_principal ?? pessoal?.nmUe ?? null,
                    nmUrna: resumo?.nm_urna ?? mandato.nm_urna,
                    dsCargo: resumo?.ds_cargo ?? null,
                    sgPartido: resumo?.sg_partido ?? null,
                  }
                : null,
            pessoal,
            eleitorado,
          };
          return [c.id_vinculo_tse, perfil] as const;
        })
      );
      if (cancelado) return;
      setPerfisTse(Object.fromEntries(entradas));
      setCarregando(false);
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [idMandato, versao]);

  async function marcarVigente(idVinculoTse: number) {
    const supabase = createClient();
    try {
      await marcarCandidaturaVigente(supabase, idVinculoTse);
      toast.success("Candidatura marcada como vigente!");
      setVersao((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar esta candidatura como vigente.");
    }
  }

  if (carregando) {
    return <CarregandoSkeleton variante="list" linhas={2} />;
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Vote className="size-4 text-emerald-600 dark:text-emerald-400" /> Candidaturas no TSE
        </CardTitle>
        <CardDescription className="text-xs">
          Menu expandido por ano eleitoral com inteligência e votação real do TSE
          {nmUrna ? ` — ${nmUrna}` : ""}
          {nrTituloEleitoral ? ` (título ${nrTituloEleitoral})` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidaturas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma candidatura vinculada no TSE." />
        ) : (
          <div className="grid gap-3">
            {candidaturas.map((c) => {
              const perfil = perfisTse[c.id_vinculo_tse];
              const estaAberto = anoAberto === c.ano_eleicao;

              return (
                <div
                  key={c.id_vinculo_tse}
                  className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setAnoAberto(estaAberto ? null : c.ano_eleicao)}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-mono font-bold text-sm">
                        {c.ano_eleicao}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            Eleição {c.ano_eleicao} — {perfil?.votacao?.dsCargo ?? "Cargo"}
                          </span>
                          {c.eh_mandato_vigente && (
                            <Badge className="bg-emerald-600 gap-1 text-[10px]">
                              <CheckCircle2 className="size-3" /> Vigente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {perfil?.votacao?.nmUrna ?? "—"} • {perfil?.votacao?.sgPartido ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Votos apurados</p>
                        <p className="font-heading font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {perfil?.votacao?.qtVotosTotal != null
                            ? perfil.votacao.qtVotosTotal.toLocaleString("pt-BR")
                            : "—"}
                        </p>
                      </div>
                      {estaAberto ? (
                        <ChevronUp className="size-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {estaAberto && (
                    <div className="p-5 grid gap-6 border-t border-border/40 bg-card text-xs animate-in slide-in-from-top-2 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/40">
                        <div>
                          <span className="font-semibold text-muted-foreground">Município Principal: </span>
                          <span className="font-bold text-foreground">
                            {perfil?.votacao?.nmMunicipioPrincipal ?? perfil?.pessoal?.nmUe ?? "—"}
                          </span>
                        </div>
                        {!c.eh_mandato_vigente && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void marcarVigente(c.id_vinculo_tse)}
                            className="text-xs font-medium w-fit"
                          >
                            Marcar como candidatura vigente
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div className="rounded-lg bg-muted/40 p-4 border space-y-1.5">
                          <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                            Desempenho Eleitoral
                          </p>
                          <p className="text-2xl font-bold font-heading text-foreground">
                            {perfil?.votacao?.qtVotosTotal != null
                              ? perfil.votacao.qtVotosTotal.toLocaleString("pt-BR")
                              : "—"}{" "}
                            <span className="text-xs font-normal text-muted-foreground">votos</span>
                          </p>
                          <p className="text-muted-foreground">
                            Turno: <span className="font-semibold text-foreground">{c.nr_turno}º Turno</span>
                          </p>
                        </div>

                        {perfil?.pessoal && (
                          <div className="rounded-lg bg-muted/40 p-4 border space-y-1.5">
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                              Perfil Pessoal (TSE)
                            </p>
                            <p>
                              Idade: <span className="font-semibold text-foreground">{perfil.pessoal.idade ?? "—"}</span>
                            </p>
                            <p>
                              Gênero: <span className="font-semibold text-foreground">{perfil.pessoal.genero ?? "—"}</span>
                            </p>
                            <p>
                              Cor/Raça:{" "}
                              <span className="font-semibold text-foreground">{perfil.pessoal.corRaca ?? "—"}</span>
                            </p>
                            <p>
                              Instrução:{" "}
                              <span className="font-semibold text-foreground">{perfil.pessoal.grauInstrucao ?? "—"}</span>
                            </p>
                          </div>
                        )}

                        {perfil?.eleitorado && (
                          <div className="rounded-lg bg-muted/40 p-4 border space-y-2">
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                              Eleitorado da Base
                            </p>
                            <PerfilEleitoradoChart titulo="Gênero" dados={perfil.eleitorado.genero} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
