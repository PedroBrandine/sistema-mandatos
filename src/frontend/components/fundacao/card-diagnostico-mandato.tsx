"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

import type { NoticiaMandato } from "@backend/queries/ficha-mandato";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { Json } from "@backend/supabase/database.types";

import { EditorListaLinks } from "@/components/fundacao/editor-lista-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// DIAG-10..DIAG-17 (.specs/features/diagnostico-mandato-estrategia/spec.md,
// "P1: Campos de texto livre do Diagnóstico"). Mesmo padrão de edição de
// CardSobreMandato (fundacao/card-sobre-mandato.tsx): editor de tags para
// listas curtas de texto, update direto em dim_mandato, nulo quando vazio
// (nunca array vazio). "Principais Notícias" usa EditorListaLinks (par
// título+URL) em vez de tag simples.

export interface CardDiagnosticoMandatoProps {
  idMandato: number;
  principaisDestaques: string[] | null;
  cargosLegislatura: string[] | null;
  principaisPls: string[] | null;
  principaisNoticias: NoticiaMandato[] | null;
  onAtualizado: () => void;
}

interface ListaEditavelProps {
  label: string;
  itens: string[];
  onChange: (itens: string[]) => void;
  placeholder: string;
}

function ListaEditavel({ label, itens, onChange, placeholder }: ListaEditavelProps) {
  const [novoItem, setNovoItem] = useState("");

  function adicionar() {
    const valor = novoItem.trim();
    if (valor === "") return;
    onChange([...itens, valor]);
    setNovoItem("");
  }

  function remover(indice: number) {
    onChange(itens.filter((_, i) => i !== indice));
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((item, indice) => (
          <Badge key={`${item}-${indice}`} variant="secondary" className="gap-1 py-1 pl-3 pr-1">
            {item}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label={`Remover ${item}`}
              onClick={() => remover(indice)}
            >
              <X className="size-3.5" />
            </Button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={adicionar}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function ListaExibicao({ label, itens }: { label: string; itens: string[] | null }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {itens && itens.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((item, indice) => (
            <Badge key={`${item}-${indice}`} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-foreground">—</p>
      )}
    </div>
  );
}

export function CardDiagnosticoMandato({
  idMandato,
  principaisDestaques,
  cargosLegislatura,
  principaisPls,
  principaisNoticias,
  onAtualizado,
}: CardDiagnosticoMandatoProps) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [destaquesEdicao, setDestaquesEdicao] = useState<string[]>(principaisDestaques ?? []);
  const [cargosEdicao, setCargosEdicao] = useState<string[]>(cargosLegislatura ?? []);
  const [plsEdicao, setPlsEdicao] = useState<string[]>(principaisPls ?? []);
  const [noticiasEdicao, setNoticiasEdicao] = useState<NoticiaMandato[]>(principaisNoticias ?? []);

  function iniciarEdicao() {
    setDestaquesEdicao(principaisDestaques ?? []);
    setCargosEdicao(cargosLegislatura ?? []);
    setPlsEdicao(principaisPls ?? []);
    setNoticiasEdicao(principaisNoticias ?? []);
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await createClient()
      .from("dim_mandato")
      .update({
        principais_destaques: destaquesEdicao.length > 0 ? destaquesEdicao : null,
        cargos_legislatura: cargosEdicao.length > 0 ? cargosEdicao : null,
        principais_pls: plsEdicao.length > 0 ? plsEdicao : null,
        principais_noticias: noticiasEdicao.length > 0 ? (noticiasEdicao as unknown as Json) : null,
      })
      .eq("id_mandato", idMandato);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      setSalvando(false);
      return;
    }
    setSalvando(false);
    setEditando(false);
    onAtualizado();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnóstico do Mandato</CardTitle>
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
            <ListaEditavel
              label="Principais Destaques"
              itens={destaquesEdicao}
              onChange={setDestaquesEdicao}
              placeholder="Novo destaque"
            />
            <ListaEditavel
              label="Cargos na Legislatura"
              itens={cargosEdicao}
              onChange={setCargosEdicao}
              placeholder="Novo cargo"
            />
            <ListaEditavel
              label="Principais PLs"
              itens={plsEdicao}
              onChange={setPlsEdicao}
              placeholder="Novo PL"
            />
            <EditorListaLinks titulo="Principais Notícias" itens={noticiasEdicao} onChange={setNoticiasEdicao} />

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
            <ListaExibicao label="Principais Destaques" itens={principaisDestaques} />
            <ListaExibicao label="Cargos na Legislatura" itens={cargosLegislatura} />
            <ListaExibicao label="Principais PLs" itens={principaisPls} />

            <div className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Principais Notícias</p>
              {principaisNoticias && principaisNoticias.length > 0 ? (
                <ul className="grid gap-1">
                  {principaisNoticias.map((noticia, indice) => (
                    <li key={`${noticia.url}-${indice}`}>
                      <a
                        href={noticia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {noticia.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground">—</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
