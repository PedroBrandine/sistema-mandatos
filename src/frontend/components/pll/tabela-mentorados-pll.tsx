"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";

import type { MentoradoPll } from "@backend/queries/pll-dashboard";

import { Badge } from "@/components/ui/badge";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// pll-dashboard-agenda T10 (design.md "TabelaMentoradosPll", PLL-DB-07…11).
//
// Busca/ordenação client-side (reconciliação registrada em T6,
// queries/pll-dashboard.ts: buscarMentoradosPll NÃO filtra/ordena no
// backend, mesmo padrão de ListaMandatos/TabelaPendencias) -- este
// componente é quem filtra e ordena, sobre a lista inteira que a query
// devolve.
export interface TabelaMentoradosPllProps {
  mentorados: MentoradoPll[];
}

const STATUS_LABEL: Record<MentoradoPll["status"], string> = {
  ativo: "Ativo",
  desistente: "Desistente",
  desligado: "Desligado",
  concluido: "Concluído",
};

const STATUS_BADGE_CLASS: Record<MentoradoPll["status"], string> = {
  ativo: "border-transparent bg-emerald-50 text-emerald-700",
  desistente: "border-transparent bg-amber-50 text-amber-700",
  desligado: "",
  concluido: "border-transparent bg-muted text-muted-foreground",
};

type Coluna = "nomeMentorado" | "nomeParlamentar" | "siglaPartido" | "siglaUf" | "nomeMentor" | "mentoriasRealizadas" | "pctAtingimento" | "status" | "nomeEdicao";

interface DefinicaoColuna {
  coluna: Coluna;
  rotulo: string;
}

const COLUNAS: DefinicaoColuna[] = [
  { coluna: "nomeMentorado", rotulo: "Nome do mentorado" },
  { coluna: "nomeParlamentar", rotulo: "Parlamentar" },
  { coluna: "siglaPartido", rotulo: "Partido" },
  { coluna: "siglaUf", rotulo: "UF" },
  { coluna: "nomeMentor", rotulo: "Mentor(a)" },
  { coluna: "mentoriasRealizadas", rotulo: "Mentorias" },
  { coluna: "pctAtingimento", rotulo: "Ating. (%)" },
  { coluna: "status", rotulo: "Status" },
  { coluna: "nomeEdicao", rotulo: "Edição" },
];

// PLL-DB-09: busca sem diferenciar maiúsculas/acentos -- mesmo normalizador
// de multi-select-pesquisavel.tsx (duplicado aqui de propósito: componente
// de outra tela, mesma reconciliação já registrada em pll-dashboard.ts).
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function valorOrdenavel(mentorado: MentoradoPll, coluna: Coluna): string | number {
  const valor = mentorado[coluna];
  if (valor === null) return "";
  return valor;
}

export function TabelaMentoradosPll({ mentorados }: TabelaMentoradosPllProps) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; crescente: boolean }>({
    coluna: "nomeMentorado",
    crescente: true,
  });

  const filtrados = useMemo(() => {
    const buscaNormalizada = normalizar(busca.trim());
    if (!buscaNormalizada) return mentorados;
    return mentorados.filter(
      (m) =>
        normalizar(m.nomeMentorado).includes(buscaNormalizada) ||
        normalizar(m.nomeParlamentar).includes(buscaNormalizada)
    );
  }, [mentorados, busca]);

  const ordenados = useMemo(() => {
    const copia = [...filtrados];
    copia.sort((a, b) => {
      const va = valorOrdenavel(a, ordenacao.coluna);
      const vb = valorOrdenavel(b, ordenacao.coluna);
      const comparacao =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR");
      return ordenacao.crescente ? comparacao : -comparacao;
    });
    return copia;
  }, [filtrados, ordenacao]);

  function alternarOrdenacao(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, crescente: !atual.crescente } : { coluna, crescente: true }
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-xl text-secondary">Mentorados participantes</p>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por participante ou parlamentar…"
          aria-label="Buscar por participante ou parlamentar"
          className="max-w-xs"
        />
      </div>

      {mentorados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum mentorado encontrado"
          mensagem="Nenhum contrato corresponde aos filtros aplicados."
        />
      ) : ordenados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum resultado para a busca"
          mensagem="Nenhum mentorado ou parlamentar corresponde ao termo buscado."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUNAS.map(({ coluna, rotulo }) => {
                  const ativa = ordenacao.coluna === coluna;
                  const Icone = ativa ? (ordenacao.crescente ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <TableHead key={coluna}>
                      <button
                        type="button"
                        onClick={() => alternarOrdenacao(coluna)}
                        className="flex items-center gap-1 font-bold uppercase tracking-wide"
                      >
                        {rotulo}
                        <Icone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead aria-hidden="true" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenados.map((mentorado) => (
                <TableRow
                  key={mentorado.idContrato}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="link"
                  onClick={() => router.push(`/contratos/${mentorado.idContrato}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/contratos/${mentorado.idContrato}`);
                    }
                  }}
                >
                  <TableCell>{mentorado.nomeMentorado || "—"}</TableCell>
                  <TableCell>{mentorado.nomeParlamentar || "—"}</TableCell>
                  <TableCell>{mentorado.siglaPartido ?? "—"}</TableCell>
                  <TableCell>{mentorado.siglaUf ?? "—"}</TableCell>
                  <TableCell>{mentorado.nomeMentor ?? "—"}</TableCell>
                  <TableCell>{mentorado.mentoriasRealizadas}</TableCell>
                  <TableCell>{mentorado.pctAtingimento === null ? "—" : `${mentorado.pctAtingimento}%`}</TableCell>
                  <TableCell>
                    <Badge
                      variant={mentorado.status === "desligado" ? "destructive" : "outline"}
                      className={cn("shrink-0", STATUS_BADGE_CLASS[mentorado.status])}
                    >
                      {STATUS_LABEL[mentorado.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{mentorado.nomeEdicao ?? "—"}</TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
