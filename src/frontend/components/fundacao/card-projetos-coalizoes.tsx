"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import type { CoalizaoVinculada, ProjetoVinculado } from "@backend/queries/ficha-mandato";
import { adicionarMembroCoalizao, removerMembroCoalizao } from "@backend/rpc/coalizao";
import { atualizarProjetoContrato } from "@backend/rpc/contrato";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC9 (FMC-13). Cores confirmadas com a skill
// figma-dominio-legisla / docs/Identidade Visual Legisla.md: "Codificação de
// produtos por cor... Coalizões → Roxo" (#BA6BED, `--chart-5` em
// globals.css) -- mesma variável já usada para o badge de tipo de registro
// em produtos/[slug]/agenda/page.tsx. "Projeto" não é produto e não tem cor
// própria na paleta, então usa a variante neutra padrão do Badge.
//
// PF2-08 (T10): botão "Editar" no header (mesmo padrão de card-sobre-mandato.tsx
// e card-ponto-focal.tsx -- T9) + edição inline (mesmo padrão de
// CardStatusEtapa/CardSobreMandato: sem modal, Salvar/Cancelar dentro do
// próprio card). Antes desta task o card era 100% somente-leitura -- agora
// troca o projeto de origem (atualizarProjetoContrato, T8) e adiciona/remove
// coalizões vinculadas (adicionarMembroCoalizao/removerMembroCoalizao, T8).
// Catálogo de projetos/coalizões buscado só ao entrar em edição, mesmo
// racional de CardSobreMandato (ref_agenda_tematica) -- consulta pequena e
// própria do card, não faz parte do agregado de buscarInformacoesGeraisMandato.

const SEM_PROJETO = "_nenhum";

export interface CardProjetosCoalizoesProps {
  idContrato: number;
  projeto: ProjetoVinculado | null;
  coalizoes: CoalizaoVinculada[];
  onAtualizado: () => void;
}

interface ProjetoCatalogo {
  idProjeto: number;
  nome: string;
}

interface CoalizaoCatalogo {
  idCoalizao: number;
  nome: string;
}

export function CardProjetosCoalizoes({ idContrato, projeto, coalizoes, onAtualizado }: CardProjetosCoalizoesProps) {
  const semVinculo = !projeto && coalizoes.length === 0;

  const [editando, setEditando] = useState(false);
  const [catalogoProjetos, setCatalogoProjetos] = useState<ProjetoCatalogo[] | null>(null);
  const [catalogoCoalizoes, setCatalogoCoalizoes] = useState<CoalizaoCatalogo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [idProjetoEdicao, setIdProjetoEdicao] = useState<number | null>(projeto?.idProjeto ?? null);
  const [idsCoalizaoEdicao, setIdsCoalizaoEdicao] = useState<number[]>(coalizoes.map((c) => c.idCoalizao));

  useEffect(() => {
    if (!editando || catalogoProjetos !== null) return;
    let cancelado = false;
    createClient()
      .from("ref_projeto")
      .select("id_projeto, nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(mapeiaErroRpc(error).message);
          return;
        }
        setCatalogoProjetos((data ?? []).map((p) => ({ idProjeto: p.id_projeto, nome: p.nome })));
      });
    return () => {
      cancelado = true;
    };
  }, [editando, catalogoProjetos]);

  useEffect(() => {
    if (!editando || catalogoCoalizoes !== null) return;
    let cancelado = false;
    createClient()
      .from("dim_coalizao")
      .select("id_coalizao, dim_contratante(nome)")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(mapeiaErroRpc(error).message);
          return;
        }
        const lista = (data ?? [])
          .map((c) => {
            const contratante = c.dim_contratante as unknown as { nome: string } | null;
            if (!contratante?.nome) return null;
            return { idCoalizao: c.id_coalizao, nome: contratante.nome };
          })
          .filter((c): c is CoalizaoCatalogo => c !== null);
        setCatalogoCoalizoes(lista);
      });
    return () => {
      cancelado = true;
    };
  }, [editando, catalogoCoalizoes]);

  function iniciarEdicao() {
    setIdProjetoEdicao(projeto?.idProjeto ?? null);
    setIdsCoalizaoEdicao(coalizoes.map((c) => c.idCoalizao));
    setErro(null);
    setEditando(true);
  }

  function alternarCoalizao(idCoalizao: number) {
    setIdsCoalizaoEdicao((atual) =>
      atual.includes(idCoalizao) ? atual.filter((id) => id !== idCoalizao) : [...atual, idCoalizao]
    );
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const supabase = createClient();

      if (idProjetoEdicao !== (projeto?.idProjeto ?? null)) {
        await atualizarProjetoContrato(supabase, idContrato, idProjetoEdicao);
      }

      const idsAtuais = new Set(coalizoes.map((c) => c.idCoalizao));
      const idsNovos = new Set(idsCoalizaoEdicao);
      const paraAdicionar = [...idsNovos].filter((id) => !idsAtuais.has(id));
      const paraRemover = [...idsAtuais].filter((id) => !idsNovos.has(id));

      for (const idCoalizao of paraAdicionar) {
        await adicionarMembroCoalizao(supabase, idCoalizao, idContrato);
      }
      for (const idCoalizao of paraRemover) {
        await removerMembroCoalizao(supabase, idCoalizao, idContrato);
      }

      setSalvando(false);
      setEditando(false);
      onAtualizado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar projeto e coalizões vinculados.");
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projetos e Coalizões Vinculados</CardTitle>
        {!editando && (
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={iniciarEdicao}>
              <Pencil className="size-3.5" />
              Editar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {erro && <ErroInline mensagem={erro} />}

        {editando ? (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="projetos-coalizoes-projeto">Projeto de origem</Label>
              <Select
                value={idProjetoEdicao !== null ? String(idProjetoEdicao) : SEM_PROJETO}
                onValueChange={(v) => setIdProjetoEdicao(v === SEM_PROJETO ? null : Number(v))}
              >
                <SelectTrigger id="projetos-coalizoes-projeto" className="w-full">
                  <SelectValue placeholder={catalogoProjetos === null ? "Carregando…" : "Nenhum"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PROJETO}>Nenhum</SelectItem>
                  {(catalogoProjetos ?? []).map((p) => (
                    <SelectItem key={p.idProjeto} value={String(p.idProjeto)}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Coalizões vinculadas</Label>
              {catalogoCoalizoes === null ? (
                <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
              ) : catalogoCoalizoes.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma coalizão cadastrada"
                  mensagem="Ainda não há coalizões cadastradas no sistema."
                />
              ) : (
                <div className="grid gap-2">
                  {catalogoCoalizoes.map((c) => (
                    <label key={c.idCoalizao} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={idsCoalizaoEdicao.includes(c.idCoalizao)}
                        onChange={() => alternarCoalizao(c.idCoalizao)}
                      />
                      {c.nome}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={salvar} disabled={salvando}>
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditando(false)} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : semVinculo ? (
          <EstadoVazio
            titulo="Nenhum projeto ou coalizão vinculado"
            mensagem="Este contrato ainda não tem projeto de origem nem participação em coalizão."
          />
        ) : (
          <ul className="grid gap-2">
            {projeto && (
              <li className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Projeto</Badge>
                <span className="text-foreground">{projeto.nome}</span>
              </li>
            )}
            {coalizoes.map((c) => (
              <li key={c.idCoalizao} className="flex items-center gap-2 text-sm">
                <Badge className="bg-chart-5 text-foreground">Coalizão</Badge>
                <span className="text-foreground">{c.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
