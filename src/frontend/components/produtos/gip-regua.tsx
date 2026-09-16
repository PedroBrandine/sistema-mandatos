"use client";

import { useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";

import { buscarGipDoContrato, type GipDoContrato, type MomentoGip } from "@backend/queries/gip";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import { usePapelGlobal } from "@/hooks/use-papel-global";

import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: GIP
// conforme a metodologia vigente" (FMC-25, FMC-26, FMC-27). design.md,
// Components -> GipRegua. Reusa o CAMINHO de submissão de
// formulario-gip-form.tsx (INSERT direto em fat_submissao -- fat_gip/
// fat_gip_dimensao são 100% derivadas por app.trg_deriva_gip, nunca
// escritas aqui, FMC-26), sem extrair para backend/rpc/gip.ts (fora do
// escopo de arquivos desta task).
export interface GipReguaProps {
  idContrato: number;
  momento: MomentoGip;
}

const ROTULO_MOMENTO: Record<MomentoGip, string> = { inicio: "Início", fim: "Fim" };

export function GipRegua({ idContrato, momento }: GipReguaProps) {
  const { idUsuario, carregando: carregandoUsuario } = usePapelGlobal();
  const [dados, setDados] = useState<GipDoContrato | undefined>(undefined);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    setErro(null);
    try {
      const resultado = await buscarGipDoContrato(createClient(), idContrato, momento);
      setDados(resultado);
      setRespostas(Object.fromEntries(resultado.dimensoes.map((d) => [d.codigo, d.valorAtual ?? d.valorMin])));
    } catch (e) {
      setErro(e instanceof Error ? e.message : mapeiaErroRpc(e as PostgrestError).message);
    }
  }

  useEffect(() => {
    void carregar();
    // idContrato/momento definem a leitura -- eslint-disable evitado
    // recriando `carregar` a cada render é o padrão já usado em
    // informacoes/page.tsx (carregarDados via useCallback); aqui a função
    // não precisa memo porque só o efeito a chama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idContrato, momento]);

  if (dados === undefined) {
    return erro ? <ErroInline mensagem={erro} onRetry={carregar} /> : <CarregandoSkeleton variante="list" />;
  }

  // FMC-27 AC7: momento já aplicado não oferece novo envio -- estado de
  // leitura com o nível + descritor já gravado por dimensão.
  if (dados.aplicado) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Momento {ROTULO_MOMENTO[momento]} já aplicado{dados.aplicadoEm ? ` em ${dados.aplicadoEm}` : ""}.
        </p>
        <div className="grid gap-3">
          {dados.dimensoes.map((d) => {
            const nivel = d.niveis.find((n) => n.valor === d.valorAtual);
            return (
              <div key={d.idDimensao} className="grid gap-1 rounded-lg border p-3">
                <p className="text-sm font-medium">{d.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {d.valorAtual !== null ? `Nível ${d.valorAtual} — ${nivel?.descricao ?? ""}` : "—"}
                </p>
              </div>
            );
          })}
        </div>
        {erro && <ErroInline mensagem={erro} />}
      </div>
    );
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    try {
      if (!idUsuario) {
        throw new Error("Não foi possível identificar o usuário respondente. Recarregue a página.");
      }

      const { data: formulario, error: erroFormulario } = await supabase
        .from("ref_formulario")
        .select("id_formulario, versao")
        .eq("codigo", "gip")
        .single();
      if (erroFormulario) throw erroFormulario;

      const { error: erroSubmissao } = await supabase.from("fat_submissao").insert({
        id_contrato: idContrato,
        id_formulario: formulario.id_formulario,
        versao_formulario: formulario.versao,
        id_usuario_respondente: idUsuario,
        momento,
        respostas: { dimensoes: respostas },
      });
      if (erroSubmissao) throw erroSubmissao;

      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : mapeiaErroRpc(e as PostgrestError).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4">
      {dados.dimensoes.map((d) => (
        <fieldset key={d.idDimensao} className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{d.nome}</legend>
          <div className="grid gap-1.5">
            {d.niveis.map((n) => (
              <label key={n.valor} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`gip-dimensao-${d.idDimensao}`}
                  value={n.valor}
                  checked={respostas[d.codigo] === n.valor}
                  onChange={() => setRespostas((atual) => ({ ...atual, [d.codigo]: n.valor }))}
                />
                <span>
                  <span className="font-medium">Nível {n.valor}</span> — {n.descricao}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {erro && <ErroInline mensagem={erro} />}

      <div>
        <Button type="button" onClick={enviar} disabled={enviando || carregandoUsuario}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
