"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { createClient } from "@backend/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHAVES_FILTRO = ["produto", "projeto", "gestora", "mentor", "periodo"] as const;
type ChaveFiltro = (typeof CHAVES_FILTRO)[number];

const OPCOES_PERIODO = [
  { valor: "3", rotulo: "Últimos 3 meses" },
  { valor: "6", rotulo: "Últimos 6 meses" },
  { valor: "12", rotulo: "Últimos 12 meses" },
];

interface OpcaoRotulada {
  id: number;
  nome: string;
}

async function buscarProdutos(): Promise<OpcaoRotulada[]> {
  const client = createClient();
  const { data, error } = await client.from("ref_produto").select("id_produto, nome").order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_produto, nome: p.nome }));
}

async function buscarProjetos(): Promise<OpcaoRotulada[]> {
  const client = createClient();
  const { data, error } = await client.from("ref_projeto").select("id_projeto, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }));
}

async function buscarPessoasPorPapel(papel: "gestora" | "mentor"): Promise<OpcaoRotulada[]> {
  const client = createClient();
  const { data, error } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", papel)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

// visao-gerencial-g3-g6, T20 (GER-02/03/04/05). Barra de recorte sticky --
// único Client Component "puro" de nível de página (design.md, Architecture
// Overview): grava os 5 filtros na URL (searchParams), o Server Component
// pai (page.tsx) re-renderiza e repassa o filtro pra cada bloco. Sem estado
// local próprio de filtro -- a URL é a única fonte de verdade (evita drift
// entre o que a barra mostra e o que os blocos usam).
export function BarraRecorte() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: produtos } = useQuery({ queryKey: ["recorte-produtos"], queryFn: buscarProdutos });
  const { data: projetos } = useQuery({ queryKey: ["recorte-projetos"], queryFn: buscarProjetos });
  const { data: gestoras } = useQuery({ queryKey: ["recorte-gestoras"], queryFn: () => buscarPessoasPorPapel("gestora") });
  const { data: mentores } = useQuery({ queryKey: ["recorte-mentores"], queryFn: () => buscarPessoasPorPapel("mentor") });

  function atualizarFiltro(chave: ChaveFiltro, valor: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === undefined) {
      params.delete(chave);
    } else {
      params.set(chave, valor);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function limparTudo() {
    router.replace(pathname, { scroll: false });
  }

  const rotuloPorChave = (chave: ChaveFiltro): string | undefined => {
    const bruto = searchParams.get(chave);
    if (bruto === null) return undefined;
    if (chave === "periodo") return OPCOES_PERIODO.find((o) => o.valor === bruto)?.rotulo;
    const lista = chave === "produto" ? produtos : chave === "projeto" ? projetos : chave === "gestora" ? gestoras : mentores;
    return lista?.find((o) => String(o.id) === bruto)?.nome;
  };

  const filtrosAtivos = CHAVES_FILTRO.filter((chave) => searchParams.get(chave) !== null);

  return (
    <div className="sticky top-0 z-20 -mx-6 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto grid max-w-6xl gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={searchParams.get("produto") ?? ""} onValueChange={(v) => atualizarFiltro("produto", v || undefined)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              {(produtos ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get("projeto") ?? ""} onValueChange={(v) => atualizarFiltro("projeto", v || undefined)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Projeto/edição" />
            </SelectTrigger>
            <SelectContent>
              {(projetos ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get("gestora") ?? ""} onValueChange={(v) => atualizarFiltro("gestora", v || undefined)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Gestora" />
            </SelectTrigger>
            <SelectContent>
              {(gestoras ?? []).map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get("mentor") ?? ""} onValueChange={(v) => atualizarFiltro("mentor", v || undefined)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Mentor" />
            </SelectTrigger>
            <SelectContent>
              {(mentores ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get("periodo") ?? ""} onValueChange={(v) => atualizarFiltro("periodo", v || undefined)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Período (evolução)" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_PERIODO.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtrosAtivos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filtrosAtivos.map((chave) => (
              <Badge key={chave} variant="secondary" className="gap-1 pr-1">
                {rotuloPorChave(chave) ?? chave}
                <button
                  type="button"
                  onClick={() => atualizarFiltro(chave, undefined)}
                  aria-label={`Remover filtro ${chave}`}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={limparTudo}>
              Limpar tudo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
