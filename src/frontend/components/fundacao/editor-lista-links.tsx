"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import type { NoticiaMandato } from "@backend/queries/ficha-mandato";

import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";

// DIAG-14..DIAG-17 (.specs/features/diagnostico-mandato-estrategia/spec.md,
// "P1: Campos de texto livre do Diagnóstico"). Lista editável de
// {titulo, url} -- mesma interação de EditorListaTexto (pll/editor-lista-texto.tsx),
// mas com um segundo campo (URL) e validação de formato. Não reaproveita
// EditorListaTexto porque o item aqui é um par, não uma string única.

export interface EditorListaLinksProps {
  titulo: string;
  itens: NoticiaMandato[];
  onChange: (itens: NoticiaMandato[]) => void;
  readOnly?: boolean;
}

function urlValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function EditorListaLinks({ titulo, itens, onChange, readOnly = false }: EditorListaLinksProps) {
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indiceEditando, setIndiceEditando] = useState<number | null>(null);
  const [tituloEditando, setTituloEditando] = useState("");
  const [urlEditando, setUrlEditando] = useState("");

  function adicionar() {
    const tituloAparado = novoTitulo.trim();
    const urlAparada = novaUrl.trim();
    if (!tituloAparado || !urlAparada) return;
    if (!urlValida(urlAparada)) {
      setErro("URL inválida -- use um link começando com http:// ou https://.");
      return;
    }
    setErro(null);
    onChange([...itens, { titulo: tituloAparado, url: urlAparada }]);
    setNovoTitulo("");
    setNovaUrl("");
  }

  function remover(indice: number) {
    onChange(itens.filter((_, i) => i !== indice));
  }

  function iniciarEdicao(indice: number) {
    setIndiceEditando(indice);
    setTituloEditando(itens[indice].titulo);
    setUrlEditando(itens[indice].url);
    setErro(null);
  }

  function salvarEdicao() {
    if (indiceEditando === null) return;
    const tituloAparado = tituloEditando.trim();
    const urlAparada = urlEditando.trim();
    if (!tituloAparado || !urlAparada) {
      remover(indiceEditando);
      setIndiceEditando(null);
      return;
    }
    if (!urlValida(urlAparada)) {
      setErro("URL inválida -- use um link começando com http:// ou https://.");
      return;
    }
    setErro(null);
    onChange(itens.map((item, i) => (i === indiceEditando ? { titulo: tituloAparado, url: urlAparada } : item)));
    setIndiceEditando(null);
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold">{titulo}</p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {itens.length === 0 ? (
        <EstadoVazio
          titulo="Nada registrado ainda"
          mensagem={readOnly ? undefined : `Use os campos abaixo para adicionar a primeira notícia.`}
        />
      ) : (
        <ul className="grid gap-2">
          {itens.map((item, indice) => (
            <li
              key={`${item.url}-${indice}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            >
              {indiceEditando === indice ? (
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={tituloEditando}
                    onChange={(e) => setTituloEditando(e.target.value)}
                    aria-label={`Editar título da notícia ${indice + 1}`}
                    autoFocus
                  />
                  <Input
                    value={urlEditando}
                    onChange={(e) => setUrlEditando(e.target.value)}
                    aria-label={`Editar URL da notícia ${indice + 1}`}
                  />
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Button type="button" size="sm" onClick={salvarEdicao}>
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Cancelar edição"
                      onClick={() => setIndiceEditando(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary underline-offset-2 hover:underline"
                  >
                    {item.titulo}
                  </a>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar "${item.titulo}"`}
                        onClick={() => iniciarEdicao(indice)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover "${item.titulo}"`}
                        onClick={() => remover(indice)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Título da notícia"
            aria-label="Título da nova notícia"
          />
          <Input
            value={novaUrl}
            onChange={(e) => setNovaUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="https://…"
            aria-label="URL da nova notícia"
          />
          <Button type="button" size="sm" onClick={adicionar} disabled={!novoTitulo.trim() || !novaUrl.trim()}>
            <Plus className="size-3.5" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
