"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import type { LinhaEvolucaoGip, PlanejamentoCompleto, PreditorPrioritarioLinha } from "@backend/queries/planejamento";

import { createClient } from "@backend/supabase/client";

import type { PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { DadosPlanejamentoForm } from "./dados-planejamento-form";

// SAI-08, SAI-09, SAI-10. Ordem cronológica de exibição -- vw_gip_evolucao
// ordena por momento alfabeticamente (fim, inicio, meio), não cronológico;
// a UI reagrupa aqui na ordem certa antes de renderizar.
const ORDEM_MOMENTO = ["inicio", "meio", "fim"] as const;
const ROTULO_MOMENTO: Record<string, string> = { inicio: "Início", meio: "Meio", fim: "Fim" };
const ROTULO_SITUACAO: Record<string, string> = { atingiu: "Atingiu", proximo: "Próximo", distante: "Distante" };
const VARIANTE_SITUACAO: Record<string, "secondary" | "outline" | "destructive"> = {
  atingiu: "secondary",
  proximo: "outline",
  distante: "destructive",
};

function agrupaEvolucaoGipPorMomento(evolucaoGip: LinhaEvolucaoGip[]): [string, LinhaEvolucaoGip[]][] {
  const porMomento = new Map<string, LinhaEvolucaoGip[]>();
  for (const linha of evolucaoGip) {
    const lista = porMomento.get(linha.momento) ?? [];
    lista.push(linha);
    porMomento.set(linha.momento, lista);
  }
  return ORDEM_MOMENTO.filter((m) => porMomento.has(m)).map((m) => [m, porMomento.get(m)!]);
}

// PLV-14 (.specs/features/planejamento-estrategico-v2/spec.md:323). Conteúdo da aba
// "Diagnóstico (Análise de Conjuntura)": os três campos de contexto do plano em
// cartões, mais Perfil de atuação (só PLL), preditores prioritários e GIP.
//
// Era a coluna esquerda do layout de 2 colunas da PLR-01, colapsável via <details>.
// O <details> saiu com a coluna: numa aba inteira não há o que colapsar, e o
// "accordion abaixo de 1024px" que ele resolvia deixou de existir junto com a
// segunda coluna. Os cartões empilham sozinhos no grid responsivo.
//
// Os três cartões têm cada um sua ação Editar (AC1), e as três abrem O MESMO
// DadosPlanejamentoForm: legado, objetivo do ano e análise de conjuntura são três
// colunas da MESMA linha de dim_planejamento. Três formulários separados seriam três
// escritas concorrentes na mesma linha, cada uma sobrescrevendo o que a outra acabou
// de gravar.
export interface ContextoEstrategicoProps {
  planejamento: PlanejamentoCompleto;
  preditoresAtuais: PreditorPrioritarioLinha[];
  evolucaoGip: LinhaEvolucaoGip[];
  produtoNome: string;
  permissoes: PermissoesModo;
  onDadosAlterados: () => void;
}

export function ContextoEstrategico({
  planejamento,
  preditoresAtuais,
  evolucaoGip,
  produtoNome,
  permissoes,
  onDadosAlterados,
}: ContextoEstrategicoProps) {
  const [editando, setEditando] = useState(false);
  const [nomePerfil, setNomePerfil] = useState<string | null>(null);
  const preditoresOrdenados = [...preditoresAtuais].sort((a, b) => a.ordem - b.ordem);
  // PLV-14 AC4 foi revogada com os modos (AD-059): não há mais modo Ler para
  // servir de gatilho, então Editar depende só do papel.
  const podeEditar = permissoes.crudHierarquia;
  const ePll = produtoNome === "PLL";

  // PLV-14 AC2. dim_planejamento guarda só id_perfil_atuacao; o nome vem de
  // ref_perfil_atuacao, mesma leitura que DadosPlanejamentoForm já faz para
  // montar o Select. Só no PLL -- nos demais produtos a coluna nunca é usada
  // (PLR-05), e buscar seria uma ida ao banco para um cartão que não aparece.
  // Sem setState no corpo do efeito (react-hooks/set-state-in-effect): quando não
  // há perfil a buscar, o efeito simplesmente não faz nada, e quem decide o que
  // aparece é `perfilExibido` abaixo. Limpar por setState aqui causaria render em
  // cascata só para chegar ao mesmo "—".
  useEffect(() => {
    if (!ePll || planejamento.idPerfilAtuacao === null) return;
    let cancelado = false;
    createClient()
      .from("ref_perfil_atuacao")
      .select("nome")
      .eq("id_perfil", planejamento.idPerfilAtuacao)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setNomePerfil(data?.nome ?? null);
      });
    return () => {
      cancelado = true;
    };
  }, [ePll, planejamento.idPerfilAtuacao]);

  // PLV-14 AC1/AC3. Um cartão por campo, SEMPRE presente: campo vazio mostra "—"
  // (AD-005) e mantém o Editar. Esconder o cartão vazio faria sumir justamente o
  // que ainda precisa ser preenchido -- o cartão em branco é o convite.
  const CAMPOS: { titulo: string; valor: string | null }[] = [
    { titulo: "Legado", valor: planejamento.legado },
    { titulo: "Objetivo do ano", valor: planejamento.objetivoAno },
    { titulo: "Análise de conjuntura", valor: planejamento.analiseConjuntura },
  ];

  // Nome só vale enquanto o plano de fato aponta para um perfil -- sem isto, trocar
  // o perfil para vazio deixaria o nome antigo na tela até a próxima busca.
  const perfilExibido = ePll && planejamento.idPerfilAtuacao !== null ? nomePerfil : null;

  return (
    <div className="w-full">
      <div className="grid gap-4">
        {editando && podeEditar ? (
          <DadosPlanejamentoForm
            planejamento={planejamento}
            preditoresAtuais={preditoresAtuais}
            produtoNome={produtoNome}
            onConcluido={() => {
              setEditando(false);
              onDadosAlterados();
            }}
          />
        ) : (
          <div className="grid gap-3 text-sm">
            {/* 57:671: cartões EMPILHADOS em largura cheia, com o Editar no canto
                superior direito de cada um -- não em grade de 3 colunas. Os três
                campos são textos longos (Análise de conjuntura ocupa parágrafos
                no mockup); em coluna estreita eles quebram em tiras ilegíveis. */}
            <div className="grid gap-3">
              {CAMPOS.map(({ titulo, valor }) => (
                <Card key={titulo}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-secondary">{titulo}</CardTitle>
                    {podeEditar && (
                      <CardAction>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-foreground">{valor ?? "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* PLV-14 AC2. Perfil de atuação só existe no levantamento de campos do
                PLL (PLR-05) -- Estratégia e Coalizão nunca usam a coluna, e o cartão
                não aparece para eles. Dentro do PLL ele segue a regra AC3: vazio é
                "—", não cartão escondido. */}
            {ePll && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-secondary">Perfil de atuação</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">{perfilExibido ?? "—"}</p>
                </CardContent>
              </Card>
            )}

            {preditoresOrdenados.length > 0 && (
              <div className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Preditores prioritários</p>
                <div className="flex flex-wrap gap-1.5">
                  {preditoresOrdenados.map((p) => (
                    <Badge key={p.ordem} variant="outline">
                      {p.ordem}. {p.nomePreditor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}


            {/* SAI-08, SAI-09, SAI-10: substitui o placeholder PLR-06 (fechado por
                formularios-produto, T9 -- vw_gip_evolucao já existe) por leitura real,
                agrupada por momento (inicio/meio/fim). Contrato sem nenhuma aplicação
                de GIP mostra <EstadoVazio> (spec.md P3.AC3); momento só com
                reguaSonhos preenchido (onde_chegamos/gap/situacao null) mostra a
                explicação de "aspiração pactuada" em vez de "0"/traço genérico
                (spec.md P3.AC2, AD-005). */}
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">GIP</p>
              {evolucaoGip.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma aplicação de GIP ainda"
                  mensagem="A régua × onde chegamos aparece aqui assim que o contrato tiver ao menos uma aplicação."
                />
              ) : (
                <div className="grid gap-3">
                  {agrupaEvolucaoGipPorMomento(evolucaoGip).map(([momento, linhasDoMomento]) => {
                    const quadrante = linhasDoMomento.find((l) => l.quadrante !== null)?.quadrante ?? null;
                    return (
                      <div key={momento} className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{ROTULO_MOMENTO[momento] ?? momento}</p>
                          {quadrante && (
                            <Badge variant="outline" className="text-[10px]">
                              {quadrante}
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-1.5">
                          {linhasDoMomento.map((linha) => (
                            <div key={linha.dimensao} className="grid gap-0.5 text-xs">
                              <p className="font-medium text-foreground">{linha.nomeDimensao}</p>
                              <p className="text-muted-foreground">Régua dos Sonhos: {linha.reguaSonhos ?? "—"}</p>
                              {linha.ondeChegamos !== null ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-muted-foreground">
                                    Onde chegamos: {linha.ondeChegamos} (gap {linha.gap})
                                  </span>
                                  {linha.situacao && (
                                    <Badge variant={VARIANTE_SITUACAO[linha.situacao]} className="text-[10px]">
                                      {ROTULO_SITUACAO[linha.situacao]}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] italic text-muted-foreground">
                                  Aspiração pactuada — ainda sem leitura de &quot;onde chegamos&quot;.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
