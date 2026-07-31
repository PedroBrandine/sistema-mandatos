"use client";

import type { Database } from "@backend/supabase/database.types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type VinculoRow = Database["public"]["Tables"]["rel_usuario_contrato"]["Row"];

export interface VinculoTableProps {
  vinculos: VinculoRow[];
  nomesPorUsuario: Record<number, string>;
  onEditar: (vinculo: VinculoRow) => void;
  onSubstituir: (vinculo: VinculoRow) => void;
  onEncerrar: (vinculo: VinculoRow) => void;
}

// Lista puramente apresentacional de rel_usuario_contrato -- as ações
// (editar/substituir/encerrar) são delegadas à página (T37), que decide o que
// abrir/chamar. Vínculo fechado (dt_fim preenchido) não tem ação: histórico
// nunca é reaberto por aqui.
export function VinculoTable({ vinculos, nomesPorUsuario, onEditar, onSubstituir, onEncerrar }: VinculoTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pessoa</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {vinculos.map((v) => {
          const aberto = v.dt_fim == null;
          return (
            <TableRow key={v.id_vinculo}>
              <TableCell>{nomesPorUsuario[v.id_usuario] ?? `#${v.id_usuario}`}</TableCell>
              <TableCell>{v.papel_no_contrato}</TableCell>
              <TableCell>{v.cargo ?? "—"}</TableCell>
              <TableCell>{v.dt_inicio}</TableCell>
              <TableCell>{aberto ? <Badge variant="outline">Aberto</Badge> : v.dt_fim}</TableCell>
              <TableCell>
                {aberto && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => onEditar(v)}>
                      Editar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onSubstituir(v)}>
                      Substituir
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => onEncerrar(v)}>
                      Encerrar
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
