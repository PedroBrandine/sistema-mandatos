"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import type { PlanejamentoCompleto, PreditorPrioritarioLinha } from "@backend/queries/planejamento";

import { createClient } from "@backend/supabase/client";

import type { PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DadosPlanejamentoForm } from "./dados-planejamento-form";

// PLV-14 (.specs/features/planejamento-estrategico-v2/spec.md:323). Conteúdo da aba
// "Diagnóstico (Análise de Conjuntura)": os três campos de contexto do plano em
// cartões, mais Perfil de atuação (só PLL) e preditores prioritários.
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
//
// GIP SAIU daqui em 2026-09-17 (Pedro, olhando a tela em dev): era placeholder
// da feature anterior (PLR-06, "em desenvolvimento") e depois virou leitura real
// (SAI-08/09/10), mas a ficha do contrato ganhou aba GIP própria desde então
// (ficha-mandato-contrato) -- o card aqui duplicava exatamente o que a aba GIP
// já mostra. Nenhum nó do Figma da v2 (57:671, 227:194) desenha GIP dentro do
// Planejamento. `buscarEvolucaoGip`/`LinhaEvolucaoGip` em
// backend/queries/planejamento.ts ficam órfãos por este corte -- são de
// saida-numeros-impacto (SAI-08/09/10), não desta feature, então a decisão de
// apagá-los é de quem é dono daquela spec.
export interface ContextoEstrategicoProps {
  planejamento: PlanejamentoCompleto;
  preditoresAtuais: PreditorPrioritarioLinha[];
  produtoNome: string;
  permissoes: PermissoesModo;
  onDadosAlterados: () => void;
}

export function ContextoEstrategico({
  planejamento,
  preditoresAtuais,
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
            {/* Figma 57:671: padding 24px, título 14px bold vinho, texto 16px,
                Editar em contorno vinho. */}
            <div className="grid gap-4">
              {CAMPOS.map(({ titulo, valor }) => (
                <Card key={titulo} className="[--card-spacing:--spacing(6)]">
                  <CardHeader>
                    <CardTitle className="text-sm text-secondary">{titulo}</CardTitle>
                    {podeEditar && (
                      <CardAction>
                        <Button type="button" variant="vinho" size="sm" onClick={() => setEditando(true)}>
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-base text-foreground">{valor ?? "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* PLV-14 AC2. Perfil de atuação só existe no levantamento de campos do
                PLL (PLR-05) -- Estratégia e Coalizão nunca usam a coluna, e o cartão
                não aparece para eles. Dentro do PLL ele segue a regra AC3: vazio é
                "—", não cartão escondido. */}
            {ePll && (
              <Card className="[--card-spacing:--spacing(6)]">
                <CardHeader>
                  <CardTitle className="text-sm text-secondary">Perfil de atuação</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base text-foreground">{perfilExibido ?? "—"}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
