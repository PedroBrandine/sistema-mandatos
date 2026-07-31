"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { ContratoForm } from "@/components/fundacao/contrato-form";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];

// Página de abertura de contrato para um mandato (FND-CTR-01 a 05). Também
// lista os contratos já existentes do mesmo contratante -- necessário para o
// seletor de "contrato anterior" do ContratoForm (T34) -- com uma ação de
// encerrar inline por linha, já que "encerrar" é o segundo modo do mesmo
// componente e não há outra página nesta fase dedicada a contrato existente.
export default function NovoContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idMandato = Number(id);
  const router = useRouter();

  const [idContratante, setIdContratante] = useState<number | null>(null);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [encerrandoId, setEncerrandoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data: mandato } = await supabase
      .from("dim_mandato")
      .select("id_contratante")
      .eq("id_mandato", idMandato)
      .maybeSingle();

    if (mandato) {
      setIdContratante(mandato.id_contratante);
      const { data: contratosData } = await supabase
        .from("fat_contrato")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .order("dt_inicio", { ascending: false });
      setContratos(contratosData ?? []);
    }
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMandato]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando || idContratante == null) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-8 p-6">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Contratos existentes</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Início</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((c) => (
              <TableRow key={c.id_contrato}>
                <TableCell>{c.dt_inicio}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>
                  {c.status === "ativo" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEncerrandoId(c.id_contrato)}
                    >
                      Encerrar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {encerrandoId != null && (
          <div className="mt-4 rounded-lg border p-4">
            <ContratoForm
              idContratante={idContratante}
              contratosExistentes={contratos}
              modo={{ tipo: "encerrar", contrato: contratos.find((c) => c.id_contrato === encerrandoId)! }}
              onConcluido={() => {
                setEncerrandoId(null);
                void carregar();
              }}
            />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Novo contrato</h2>
        <ContratoForm
          idContratante={idContratante}
          contratosExistentes={contratos}
          modo={{ tipo: "abrir" }}
          onConcluido={() => router.push(`/mandatos/${idMandato}`)}
        />
      </div>
    </div>
  );
}
