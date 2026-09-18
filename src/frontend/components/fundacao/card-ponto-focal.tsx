"use client";

import { useEffect, useState } from "react";

import type { UsuarioResumo } from "@backend/queries/ficha-mandato";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC7 (FMC-11, A-05). Pedro: "apenas uma tag para
// mencionar algum usuário Legisla, nada de mais" -- por isso o controle é só
// um Select gravando fat_contrato.id_usuario_ponto_focal, sem papel de RLS
// novo. Gestoras vêm de rel_usuario_contrato (papel_no_contrato='gestora'),
// em leitura -- edição de vínculo já existe na aba "Gestão da equipe"
// (/vinculos), não se duplica aqui.
//
// A lista de usuários Legisla é buscada inline (useEffect + createClient()),
// mesmo padrão do fetch de dim_usuario em vinculos/page.tsx:49-54 -- só ao
// entrar em edição, para não pagar a consulta em toda renderização do card.

export interface CardPontoFocalProps {
  idContrato: number;
  pontoFocal: UsuarioResumo | null;
  gestoras: UsuarioResumo[];
  onAtualizado: () => void;
}

export function CardPontoFocal({ idContrato, pontoFocal, gestoras, onAtualizado }: CardPontoFocalProps) {
  const [editando, setEditando] = useState(false);
  const [opcoes, setOpcoes] = useState<UsuarioResumo[] | null>(null);
  const [idSelecionado, setIdSelecionado] = useState<number | null>(pontoFocal?.idUsuario ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // PF-06: mesma lógica de "Vincular usuário" da seção Ponto Focal, mas
  // grava em rel_usuario_contrato (papel_no_contrato: "gestora") -- um
  // INSERT que soma à lista, nunca um UPDATE que substitui um valor único.
  const [vinculandoGestora, setVinculandoGestora] = useState(false);
  const [opcoesGestora, setOpcoesGestora] = useState<UsuarioResumo[] | null>(null);
  const [idGestoraSelecionada, setIdGestoraSelecionada] = useState<number | null>(null);
  const [erroGestora, setErroGestora] = useState<string | null>(null);
  const [salvandoGestora, setSalvandoGestora] = useState(false);

  useEffect(() => {
    if (!editando || opcoes !== null) return;
    let cancelado = false;
    createClient()
      .from("dim_usuario")
      .select("id_usuario, nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(mapeiaErroRpc(error).message);
          return;
        }
        setOpcoes((data ?? []).map((u) => ({ idUsuario: u.id_usuario, nome: u.nome })));
      });
    return () => {
      cancelado = true;
    };
  }, [editando, opcoes]);

  useEffect(() => {
    if (!vinculandoGestora || opcoesGestora !== null) return;
    let cancelado = false;
    createClient()
      .from("dim_usuario")
      .select("id_usuario, nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErroGestora(mapeiaErroRpc(error).message);
          return;
        }
        setOpcoesGestora((data ?? []).map((u) => ({ idUsuario: u.id_usuario, nome: u.nome })));
      });
    return () => {
      cancelado = true;
    };
  }, [vinculandoGestora, opcoesGestora]);

  function iniciarEdicao() {
    setIdSelecionado(pontoFocal?.idUsuario ?? null);
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await createClient()
      .from("fat_contrato")
      .update({ id_usuario_ponto_focal: idSelecionado })
      .eq("id_contrato", idContrato);
    setSalvando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    setEditando(false);
    onAtualizado();
  }

  function iniciarVinculoGestora() {
    setIdGestoraSelecionada(null);
    setErroGestora(null);
    setVinculandoGestora(true);
  }

  async function salvarGestora() {
    if (idGestoraSelecionada === null) return;
    setSalvandoGestora(true);
    setErroGestora(null);
    const { error } = await createClient()
      .from("rel_usuario_contrato")
      .insert({ id_contrato: idContrato, id_usuario: idGestoraSelecionada, papel_no_contrato: "gestora" });
    setSalvandoGestora(false);
    if (error) {
      setErroGestora(mapeiaErroRpc(error).message);
      return;
    }
    setVinculandoGestora(false);
    onAtualizado();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ponto Focal e Gestoras</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 text-sm">
        {erro && <ErroInline mensagem={erro} />}

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Ponto Focal</p>

          {editando ? (
            <div className="grid gap-2">
              <Select
                value={idSelecionado ? String(idSelecionado) : undefined}
                onValueChange={(v) => setIdSelecionado(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={opcoes === null ? "Carregando…" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {(opcoes ?? []).map((u) => (
                    <SelectItem key={u.idUsuario} value={String(u.idUsuario)}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={salvar} disabled={salvando || idSelecionado === null}>
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(false)}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : pontoFocal ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{pontoFocal.nome}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={iniciarEdicao}>
                Alterar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={iniciarEdicao}>
              Vincular usuário
            </Button>
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Gestoras</p>
          {erroGestora && <ErroInline mensagem={erroGestora} />}
          {gestoras.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {gestoras.map((g) => (
                <Badge key={g.idUsuario} variant="outline">
                  {g.nome}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-foreground">—</p>
          )}

          {vinculandoGestora ? (
            <div className="grid gap-2">
              <Select
                value={idGestoraSelecionada ? String(idGestoraSelecionada) : undefined}
                onValueChange={(v) => setIdGestoraSelecionada(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={opcoesGestora === null ? "Carregando…" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {(opcoesGestora ?? []).map((u) => (
                    <SelectItem key={u.idUsuario} value={String(u.idUsuario)}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  aria-label="Salvar gestora"
                  onClick={salvarGestora}
                  disabled={salvandoGestora || idGestoraSelecionada === null}
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Cancelar vínculo de gestora"
                  onClick={() => setVinculandoGestora(false)}
                  disabled={salvandoGestora}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              aria-label="Vincular usuário (gestora)"
              onClick={iniciarVinculoGestora}
            >
              Vincular usuário
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
