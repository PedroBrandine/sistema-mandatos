"use client";

import { useState } from "react";

import type { ObjetivoComMetas, PessoaVinculada } from "@backend/queries/planejamento";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MetaForm } from "./meta-form";
import { ObjetivoForm } from "./objetivo-form";

// PLM-08 (exibição), PLM-10/12/13, PLM-11, PLM-14. Árvore Objetivo -> Meta
// com o pct_atingimento de cada nível (já calculado por
// app.recalcula_atingimento, nunca recalculado no cliente -- AD-005) e o
// alerta de soma de peso ≠ 100 (Edge Case do spec.md: alerta, nunca
// bloqueio de uso diário).
//
// PLM-14 (achado de bug real, corrigido nesta revisão): o gate de
// criar/editar é só gestora/admin -- Mentor tem GRANT SELECT em
// fat_objetivo_especifico/fat_meta (docs/schema_sistema.sql:2084-2089), não
// INSERT/UPDATE. A versão anterior incluía "mentor" aqui (copiado por
// engano do gate de escrita de Sucesso Mensal, onde Mentor de fato tem
// GRANT) -- mostrava um botão que sempre falhava com 42501.
export interface HierarquiaPlanejamentoProps {
  idPlanejamento: number;
  produtoNome: string;
  objetivos: ObjetivoComMetas[];
  pessoasVinculadas: PessoaVinculada[];
  // idsMetaComPesoDivergente: Metas cujo somatório de peso dos Sucessos
  // Mensais do mês corrente não fecha 100 -- calculado pela página (que já
  // carrega a grade), não por este componente (não tem acesso a
  // fat_sucesso_mensal.peso).
  idsMetaComPesoDivergente: Set<number>;
  onAlterado: () => void;
  // somenteLeitura (Edge Case do spec.md, "Coalizão sem planejamento
  // próprio"): a leitura agregada de cada membro nunca oferece criação de
  // Objetivo/Meta, mesmo pra quem teria papel de escrita -- é leitura, não
  // a tela de gestão do próprio contrato do membro.
  somenteLeitura?: boolean;
}

function formatarPct(valor: number | null): string {
  return valor == null ? "—" : `${valor}%`;
}

export function HierarquiaPlanejamento({
  idPlanejamento,
  produtoNome,
  objetivos,
  pessoasVinculadas,
  idsMetaComPesoDivergente,
  onAlterado,
  somenteLeitura = false,
}: HierarquiaPlanejamentoProps) {
  const { papel } = usePapelGlobal();
  const podeEditarEstrutura = !somenteLeitura && (papel === "gestora" || papel === "admin");

  const [criandoObjetivo, setCriandoObjetivo] = useState(false);
  const [criandoMetaEm, setCriandoMetaEm] = useState<number | null>(null);
  const [editandoObjetivo, setEditandoObjetivo] = useState<number | null>(null);
  const [editandoMeta, setEditandoMeta] = useState<number | null>(null);

  return (
    <div className="grid gap-6">
      {objetivos.map((objetivo) => (
        <div key={objetivo.idObjetivo} className="grid gap-3 rounded-lg border p-4">
          {editandoObjetivo === objetivo.idObjetivo ? (
            <ObjetivoForm
              modo={{ tipo: "editar", objetivo }}
              onConcluido={() => {
                setEditandoObjetivo(null);
                onAlterado();
              }}
              onCancelar={() => setEditandoObjetivo(null)}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{objetivo.descricao}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{formatarPct(objetivo.pctAtingimento)}</Badge>
                {podeEditarEstrutura && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoObjetivo(objetivo.idObjetivo)}>
                    Editar
                  </Button>
                )}
              </div>
            </div>
          )}

          <ul className="grid gap-2">
            {objetivo.metas.map((meta) =>
              editandoMeta === meta.idMeta ? (
                <li key={meta.idMeta}>
                  <MetaForm
                    modo={{ tipo: "editar", meta }}
                    produtoNome={produtoNome}
                    pessoasVinculadas={pessoasVinculadas}
                    onConcluido={() => {
                      setEditandoMeta(null);
                      onAlterado();
                    }}
                    onCancelar={() => setEditandoMeta(null)}
                  />
                </li>
              ) : (
                <li key={meta.idMeta} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span>{meta.descricao}</span>
                  <div className="flex items-center gap-2">
                    {meta.status !== "ativa" && <Badge variant="secondary">{meta.status}</Badge>}
                    {idsMetaComPesoDivergente.has(meta.idMeta) && (
                      <Badge variant="destructive" title="A soma dos pesos dos Sucessos Mensais desta Meta não fecha 100">
                        Peso ≠ 100
                      </Badge>
                    )}
                    <Badge variant="outline">{formatarPct(meta.pctAtingimento)}</Badge>
                    {podeEditarEstrutura && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoMeta(meta.idMeta)}>
                        Editar
                      </Button>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>

          {podeEditarEstrutura && (
            <>
              {criandoMetaEm === objetivo.idObjetivo ? (
                <MetaForm
                  modo={{ tipo: "criar", idObjetivo: objetivo.idObjetivo }}
                  produtoNome={produtoNome}
                  pessoasVinculadas={pessoasVinculadas}
                  onConcluido={() => {
                    setCriandoMetaEm(null);
                    onAlterado();
                  }}
                  onCancelar={() => setCriandoMetaEm(null)}
                />
              ) : (
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCriandoMetaEm(objetivo.idObjetivo)}>
                  + Meta
                </Button>
              )}
            </>
          )}
        </div>
      ))}

      {podeEditarEstrutura && (
        <>
          {criandoObjetivo ? (
            <ObjetivoForm
              modo={{ tipo: "criar", idPlanejamento }}
              onConcluido={() => {
                setCriandoObjetivo(false);
                onAlterado();
              }}
              onCancelar={() => setCriandoObjetivo(false)}
            />
          ) : (
            <Button type="button" variant="outline" className="w-fit" onClick={() => setCriandoObjetivo(true)}>
              + Objetivo
            </Button>
          )}
        </>
      )}
    </div>
  );
}
