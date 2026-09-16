"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";

import type { AreaTematicaVinculada, ContatoPessoa } from "@backend/queries/ficha-mandato";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC1, AC2, AC3, AC4, AC5, AC6, AC10 (FMC-05, FMC-06,
// FMC-07, FMC-08, FMC-10). Vocabulário confirmado com a skill
// figma-dominio-legisla: os rótulos "Sobre o Mandato", "Minibiografia",
// "Principais Pautas", "Áreas Temáticas" e "Dados de Contato" já são os
// nomes usados no texto da spec (traduzidos do Figma em duas rodadas contra
// docs/schema_sistema.sql) -- o glossário da skill ainda não cobre esta
// feature (mais nova que a última atualização dele), então a spec é a fonte
// verbatim aqui.
//
// Catálogo de áreas temáticas buscado inline (useEffect + createClient()),
// mesmo padrão de ContextoEstrategico (contexto-estrategico.tsx:88-102) para
// ref_perfil_atuacao -- é uma dependência de referência pequena e própria do
// card, não parte do agregado que buscarInformacoesGeraisMandato devolve
// (FMC-08 é rastreado para esta task, não para T24).

export interface CardSobreMandatoProps {
  idMandato: number;
  minibiografia: string | null;
  principaisPautas: string[] | null;
  areasTematicas: AreaTematicaVinculada[];
  contatoParlamentar: ContatoPessoa | null;
  contatoChefeGabinete: ContatoPessoa | null;
  onAtualizado: () => void;
}

interface TemaCatalogo {
  idAgenda: number;
  nome: string;
  ordem: number | null;
}

function formatarContato(contato: ContatoPessoa | null): string {
  if (!contato) return "—";
  const partes = [contato.nome, contato.email, contato.telefone].filter(Boolean);
  return partes.join(" · ");
}

export function CardSobreMandato({
  idMandato,
  minibiografia,
  principaisPautas,
  areasTematicas,
  contatoParlamentar,
  contatoChefeGabinete,
  onAtualizado,
}: CardSobreMandatoProps) {
  const [editando, setEditando] = useState(false);
  const [catalogo, setCatalogo] = useState<TemaCatalogo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [bioEdicao, setBioEdicao] = useState(minibiografia ?? "");
  const [pautasEdicao, setPautasEdicao] = useState<string[]>(principaisPautas ?? []);
  const [novaPauta, setNovaPauta] = useState("");
  const [idsAgendaEdicao, setIdsAgendaEdicao] = useState<number[]>(areasTematicas.map((a) => a.idAgenda));

  // Catálogo é global (independe do mandato) -- uma leitura por montagem do
  // card basta; abrir/fechar a edição não deve refazer a consulta.
  useEffect(() => {
    let cancelado = false;
    createClient()
      .from("ref_agenda_tematica")
      .select("id_agenda, nome, ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(mapeiaErroRpc(error).message);
          return;
        }
        setCatalogo((data ?? []).map((t) => ({ idAgenda: t.id_agenda, nome: t.nome, ordem: t.ordem })));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function iniciarEdicao() {
    setBioEdicao(minibiografia ?? "");
    setPautasEdicao(principaisPautas ?? []);
    setNovaPauta("");
    setIdsAgendaEdicao(areasTematicas.map((a) => a.idAgenda));
    setErro(null);
    setEditando(true);
  }

  function adicionarPauta() {
    const valor = novaPauta.trim();
    if (valor === "") return;
    setPautasEdicao((atual) => [...atual, valor]);
    setNovaPauta("");
  }

  function removerPauta(indice: number) {
    setPautasEdicao((atual) => atual.filter((_, i) => i !== indice));
  }

  function alternarTema(idAgenda: number) {
    setIdsAgendaEdicao((atual) =>
      atual.includes(idAgenda) ? atual.filter((id) => id !== idAgenda) : [...atual, idAgenda]
    );
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const supabase = createClient();

    const { error: erroUpdate } = await supabase
      .from("dim_mandato")
      .update({
        minibiografia: bioEdicao.trim() === "" ? null : bioEdicao,
        principais_pautas: pautasEdicao.length > 0 ? pautasEdicao : null,
      })
      .eq("id_mandato", idMandato);
    if (erroUpdate) {
      setErro(mapeiaErroRpc(erroUpdate).message);
      setSalvando(false);
      return;
    }

    const idsAtuais = new Set(areasTematicas.map((a) => a.idAgenda));
    const idsNovos = new Set(idsAgendaEdicao);
    const paraInserir = [...idsNovos].filter((id) => !idsAtuais.has(id));
    const paraRemover = [...idsAtuais].filter((id) => !idsNovos.has(id));

    if (paraInserir.length > 0) {
      const { error: erroInsert } = await supabase
        .from("rel_mandato_agenda_tematica")
        .insert(paraInserir.map((idAgenda) => ({ id_mandato: idMandato, id_agenda: idAgenda })));
      if (erroInsert) {
        setErro(mapeiaErroRpc(erroInsert).message);
        setSalvando(false);
        return;
      }
    }

    if (paraRemover.length > 0) {
      const { error: erroDelete } = await supabase
        .from("rel_mandato_agenda_tematica")
        .delete()
        .eq("id_mandato", idMandato)
        .in("id_agenda", paraRemover);
      if (erroDelete) {
        setErro(mapeiaErroRpc(erroDelete).message);
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);
    setEditando(false);
    onAtualizado();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sobre o Mandato</CardTitle>
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
              <Label htmlFor="sobre-mandato-bio">Minibiografia</Label>
              <Textarea
                id="sobre-mandato-bio"
                value={bioEdicao}
                onChange={(e) => setBioEdicao(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sobre-mandato-nova-pauta">Principais Pautas</Label>
              <div className="flex flex-wrap gap-1.5">
                {pautasEdicao.map((pauta, indice) => (
                  <Badge key={`${pauta}-${indice}`} variant="secondary" className="gap-1 py-1 pl-3 pr-1">
                    {pauta}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-5"
                      aria-label={`Remover pauta ${pauta}`}
                      onClick={() => removerPauta(indice)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="sobre-mandato-nova-pauta"
                  value={novaPauta}
                  onChange={(e) => setNovaPauta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarPauta();
                    }
                  }}
                  placeholder="Nova pauta"
                />
                <Button type="button" variant="outline" onClick={adicionarPauta}>
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Áreas Temáticas</Label>
              {catalogo === null ? (
                <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
              ) : catalogo.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma área temática cadastrada"
                  mensagem="O catálogo de áreas temáticas ainda não foi preenchido."
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {catalogo.map((tema) => (
                    <label key={tema.idAgenda} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={idsAgendaEdicao.includes(tema.idAgenda)}
                        onChange={() => alternarTema(tema.idAgenda)}
                      />
                      {tema.nome}
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
        ) : (
          <div className="grid gap-4 text-sm">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Minibiografia</p>
              <p className="whitespace-pre-line text-foreground">{minibiografia ?? "—"}</p>
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Principais Pautas</p>
              {principaisPautas && principaisPautas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {principaisPautas.map((pauta, indice) => (
                    <Badge key={`${pauta}-${indice}`} variant="secondary">
                      {pauta}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-foreground">—</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Áreas Temáticas</p>
              {areasTematicas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {areasTematicas.map((tema) => (
                    <Badge key={tema.idAgenda} variant="outline">
                      {tema.nome}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-foreground">—</p>
              )}
            </div>

            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Dados de Contato</p>
              <p className="text-foreground">Parlamentar: {formatarContato(contatoParlamentar)}</p>
              <p className="text-foreground">Chefe de Gabinete: {formatarContato(contatoChefeGabinete)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
