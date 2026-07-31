"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { marcarCandidaturaVigente } from "@backend/rpc/mandato";
import { contratanteSchema } from "@backend/schemas/contratante";
import { mandatoSchema } from "@backend/schemas/mandato";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { ContratanteFields } from "@/components/fundacao/contratante-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];
type CandidaturaRow = Database["public"]["Tables"]["rel_mandato_candidatura"]["Row"];

const detalheSchema = z.object({
  contratante: contratanteSchema,
  mandato: mandatoSchema,
});
type DetalheFormValues = z.infer<typeof detalheSchema>;

// Detalhe e edição de mandato (FND-TSE-04): edição de dim_mandato/
// dim_contratante via `update` direto (single-table, sem RPC) + ação
// "marcar como vigente" numa candidatura (marcarCandidaturaVigente, T28).
export default function MandatoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idMandato = Number(id);

  const [carregando, setCarregando] = useState(true);
  const [idContratante, setIdContratante] = useState<number | null>(null);
  const [candidaturas, setCandidaturas] = useState<CandidaturaRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const form = useForm<DetalheFormValues>({
    resolver: zodResolver(detalheSchema),
    mode: "onChange",
    defaultValues: { contratante: { nome: "" }, mandato: {} },
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data: mandato } = await supabase
      .from("dim_mandato")
      .select("*")
      .eq("id_mandato", idMandato)
      .maybeSingle();

    if (mandato) {
      setIdContratante(mandato.id_contratante);

      const { data: contratante } = await supabase
        .from("dim_contratante")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .maybeSingle();

      form.reset({
        contratante: {
          nome: contratante?.nome ?? "",
          sg_uf: contratante?.sg_uf ?? null,
          nm_municipio: contratante?.nm_municipio ?? null,
        },
        mandato: {
          nm_civil: mandato.nm_civil,
          nm_urna: mandato.nm_urna,
          nr_titulo_eleitoral: mandato.nr_titulo_eleitoral,
        },
      });

      const { data: candidaturasData } = await supabase
        .from("rel_mandato_candidatura")
        .select("*")
        .eq("id_mandato", idMandato)
        .order("ano_eleicao", { ascending: false });
      setCandidaturas(candidaturasData ?? []);

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

  async function salvar(valores: DetalheFormValues) {
    if (idContratante == null) return;
    setMensagem(null);
    const supabase = createClient();

    const { error: erroContratante } = await supabase
      .from("dim_contratante")
      .update({
        nome: valores.contratante.nome,
        sg_uf: valores.contratante.sg_uf ?? null,
        nm_municipio: valores.contratante.nm_municipio ?? null,
      })
      .eq("id_contratante", idContratante);

    const { error: erroMandato } = await supabase
      .from("dim_mandato")
      .update({
        nm_civil: valores.mandato.nm_civil ?? null,
        nm_urna: valores.mandato.nm_urna ?? null,
        nr_titulo_eleitoral: valores.mandato.nr_titulo_eleitoral ?? null,
      })
      .eq("id_mandato", idMandato);

    const erro = erroContratante ?? erroMandato;
    if (erro) {
      setMensagem(mapeiaErroRpc(erro).message);
      return;
    }
    setMensagem("Alterações salvas.");
  }

  async function marcarVigente(idVinculoTse: number) {
    setMensagem(null);
    const supabase = createClient();
    try {
      await marcarCandidaturaVigente(supabase, idVinculoTse);
      await carregar();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Não foi possível marcar esta candidatura como vigente.");
    }
  }

  if (carregando) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-8 p-6">
      <div>
        <h1 className="mb-6 text-xl font-semibold">Mandato #{idMandato}</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(salvar)} className="grid gap-4">
            <ContratanteFields control={form.control} />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mandato.nm_civil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome civil</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mandato.nr_titulo_eleitoral"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título eleitoral</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {mensagem && <p className="text-sm">{mensagem}</p>}
            <Button type="submit" className="w-fit">
              Salvar
            </Button>
          </form>
        </Form>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Candidaturas TSE</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead>Vigente</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidaturas.map((c) => (
              <TableRow key={c.id_vinculo_tse}>
                <TableCell>{c.ano_eleicao}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>
                  <Badge variant="outline">{c.confianca}</Badge>
                </TableCell>
                <TableCell>{c.eh_mandato_vigente ? "Sim" : "Não"}</TableCell>
                <TableCell>
                  {!c.eh_mandato_vigente && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void marcarVigente(c.id_vinculo_tse)}
                    >
                      Marcar como vigente
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">Contratos</h2>
          <Link href={`/mandatos/${idMandato}/contratos/novo`}>
            <Button type="button" variant="outline" size="sm">
              Novo contrato
            </Button>
          </Link>
        </div>
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
                  <Link href={`/contratos/${c.id_contrato}/vinculos`} className="text-sm underline">
                    Vínculos
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
