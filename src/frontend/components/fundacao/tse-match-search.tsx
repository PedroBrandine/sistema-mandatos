"use client";

import { useState } from "react";

import { buscarCandidaturas } from "@backend/queries/tse";
import { createClient } from "@backend/supabase/client";
import type { CandidaturaSugerida } from "@backend/types/fundacao";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VARIANTE_CONFIANCA: Record<CandidaturaSugerida["confianca"], "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baixa: "outline",
};

export interface TseMatchSearchProps {
  onSelecionar: (candidatura: CandidaturaSugerida) => void;
}

// Busca de candidaturas em tse.mv_candidatura_resumo (buscarCandidaturas, T27)
// -- FND-TSE-01 (sugestão automática por nome/UF/cargo) e FND-TSM-01 (busca
// manual quando a automática não acha nada). Os mesmos campos de filtro
// servem os dois casos -- não há uma tela "automática" separada da "manual":
// se a primeira busca não retorna nada, o componente entra em `modoManual`
// (FND-TSM-02) e qualquer seleção seguinte sai com metodoMatch='manual',
// mesmo que a query em si sempre classifique como 'nome_uf_cargo'
// internamente (ver src/backend/queries/tse.ts).
export function TseMatchSearch({ onSelecionar }: TseMatchSearchProps) {
  const [nome, setNome] = useState("");
  const [sgUf, setSgUf] = useState("");
  const [anoEleicao, setAnoEleicao] = useState("");
  const [resultados, setResultados] = useState<CandidaturaSugerida[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setBuscando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const resultado = await buscarCandidaturas(supabase, {
        nome: nome.trim() || undefined,
        sgUf: sgUf.trim() || undefined,
        anoEleicao: anoEleicao ? Number(anoEleicao) : undefined,
      });
      setResultados(resultado);
      // FND-TSM-01: busca automática sem nenhum resultado libera a busca
      // manual (mesma UI, sem tela de erro) -- uma vez em modo manual,
      // qualquer seleção grava metodo_match='manual' (FND-TSM-02).
      if (resultado.length === 0) setModoManual(true);
    } catch {
      setErro("Não foi possível buscar candidaturas agora. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  }

  function selecionar(candidatura: CandidaturaSugerida) {
    onSelecionar(modoManual ? { ...candidatura, metodoMatch: "manual" } : candidatura);
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Input
          placeholder="UF"
          maxLength={2}
          value={sgUf}
          onChange={(e) => setSgUf(e.target.value.toUpperCase())}
        />
        <Input
          placeholder="Ano da eleição"
          inputMode="numeric"
          value={anoEleicao}
          onChange={(e) => setAnoEleicao(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Button type="button" onClick={() => void buscar()} disabled={buscando} className="w-fit">
        {buscando ? "Buscando..." : "Buscar"}
      </Button>

      {erro && <p className="text-sm text-red-500">{erro}</p>}

      {resultados !== null && resultados.length === 0 && !erro && (
        <p className="text-sm text-muted-foreground">
          Nenhuma candidatura encontrada. Refine os filtros acima para continuar a busca manualmente.
        </p>
      )}

      {resultados !== null && resultados.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Partido</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultados.map((candidatura) => (
              <TableRow key={`${candidatura.sqCandidato}-${candidatura.anoEleicao}-${candidatura.nrTurno}`}>
                <TableCell>{candidatura.nmUrna ?? candidatura.nmCandidato ?? "—"}</TableCell>
                <TableCell>{candidatura.sgUf ?? "—"}</TableCell>
                <TableCell>{candidatura.sgPartido ?? "—"}</TableCell>
                <TableCell>{candidatura.anoEleicao}</TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_CONFIANCA[candidatura.confianca]}>{candidatura.confianca}</Badge>
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" onClick={() => selecionar(candidatura)}>
                    Selecionar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
