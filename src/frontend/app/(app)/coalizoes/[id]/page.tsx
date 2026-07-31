"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { use, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { membroCoalizaoSchema } from "@backend/schemas/coalizao";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CoalizaoRow = Database["public"]["Tables"]["dim_coalizao"]["Row"];
type ContratanteRow = Database["public"]["Tables"]["dim_contratante"]["Row"];
type MembroRow = Database["public"]["Tables"]["rel_coalizao_membro"]["Row"];
type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];

const PAPEIS = ["membro", "secretaria_executiva", "grupo_trabalho"] as const;

// membroCoalizaoSchema (T26) cobre papel/nome_grupo/dt_entrada/dt_saida;
// id_contrato (a FK exigida pelo AC3 -- "contrato do mandato, não o
// contratante direto") é acrescentado aqui via intersection, já que não faz
// parte do supertipo compartilhado com o formulário de coalizão em si.
const membroFormSchema = z.object({ id_contrato: z.number().int().positive("Selecione um contrato") }).and(
  membroCoalizaoSchema
);
type MembroFormValues = z.infer<typeof membroFormSchema>;

export default function CoalizaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idCoalizao = Number(id);

  const [coalizao, setCoalizao] = useState<CoalizaoRow | null>(null);
  const [contratante, setContratante] = useState<ContratanteRow | null>(null);
  const [membros, setMembros] = useState<MembroRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const form = useForm<MembroFormValues>({
    resolver: zodResolver(membroFormSchema),
    mode: "onChange",
    defaultValues: { papel: "membro" },
  });
  const papelSelecionado = form.watch("papel");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data: coalizaoData } = await supabase
      .from("dim_coalizao")
      .select("*")
      .eq("id_coalizao", idCoalizao)
      .maybeSingle();
    setCoalizao(coalizaoData ?? null);

    if (coalizaoData) {
      const { data: contratanteData } = await supabase
        .from("dim_contratante")
        .select("*")
        .eq("id_contratante", coalizaoData.id_contratante)
        .maybeSingle();
      setContratante(contratanteData ?? null);

      const { data: membrosData } = await supabase
        .from("rel_coalizao_membro")
        .select("*")
        .eq("id_coalizao", idCoalizao)
        .order("dt_entrada", { ascending: false });
      setMembros(membrosData ?? []);
    }

    // Contratos elegíveis como membro (AC3: contrato do mandato, não o
    // contratante direto) -- lista geral de fat_contrato; este lote não
    // constrói um seletor com join tipado por tipo_contratante='mandato'
    // (escopo além do Done-when desta task, ver Status em tasks.md).
    const { data: contratosData } = await supabase
      .from("fat_contrato")
      .select("*")
      .order("id_contrato", { ascending: false });
    setContratos(contratosData ?? []);

    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCoalizao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternarPlanejamentoProprio() {
    if (!coalizao) return;
    setMensagem(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("dim_coalizao")
      .update({ possui_planejamento_proprio: !coalizao.possui_planejamento_proprio })
      .eq("id_coalizao", idCoalizao);
    if (error) {
      setMensagem(mapeiaErroRpc(error).message);
      return;
    }
    await carregar();
  }

  async function adicionarMembro(valores: MembroFormValues) {
    setMensagem(null);
    const supabase = createClient();
    const { error } = await supabase.from("rel_coalizao_membro").insert({
      id_coalizao: idCoalizao,
      id_contrato: valores.id_contrato,
      papel: valores.papel,
      nome_grupo: valores.nome_grupo ?? null,
      dt_entrada: valores.dt_entrada ?? undefined,
    });
    if (error) {
      setMensagem(mapeiaErroRpc(error).message);
      return;
    }
    form.reset({ papel: "membro" });
    await carregar();
  }

  async function encerrarMembro(membro: MembroRow) {
    setMensagem(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("rel_coalizao_membro")
      .update({ dt_saida: new Date().toISOString().slice(0, 10) })
      .eq("id_coalizao", membro.id_coalizao)
      .eq("id_contrato", membro.id_contrato)
      .eq("papel", membro.papel);
    if (error) {
      setMensagem(mapeiaErroRpc(error).message);
      return;
    }
    await carregar();
  }

  if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  if (!coalizao) return <p className="p-6 text-sm text-muted-foreground">Coalizão não encontrada.</p>;

  return (
    <div className="mx-auto grid max-w-2xl gap-8 p-6">
      <div>
        <h1 className="mb-2 text-xl font-semibold">{contratante?.nome ?? `Coalizão #${idCoalizao}`}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Planejamento próprio: {coalizao.possui_planejamento_proprio ? "Sim" : "Não"}
        </p>
        {/* FND-COL-02: alterna a qualquer momento via update direto. */}
        <Button type="button" variant="outline" onClick={() => void alternarPlanejamentoProprio()}>
          {coalizao.possui_planejamento_proprio ? "Desativar" : "Ativar"} planejamento próprio
        </Button>
        {mensagem && <p className="mt-2 text-sm text-red-500">{mensagem}</p>}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Membros</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {membros.map((m) => (
              <TableRow key={`${m.id_contrato}-${m.papel}`}>
                <TableCell>#{m.id_contrato}</TableCell>
                <TableCell>{m.papel}</TableCell>
                <TableCell>{m.nome_grupo ?? "—"}</TableCell>
                <TableCell>{m.dt_entrada}</TableCell>
                <TableCell>{m.dt_saida ?? "—"}</TableCell>
                <TableCell>
                  {!m.dt_saida && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void encerrarMembro(m)}>
                      Encerrar participação
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Adicionar membro</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(adicionarMembro)} className="grid gap-4">
            <FormField
              control={form.control}
              name="id_contrato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato do mandato</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contratos.map((c) => (
                        <SelectItem key={c.id_contrato} value={String(c.id_contrato)}>
                          Contrato #{c.id_contrato} ({c.dt_inicio})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="papel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAPEIS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* FND-COL-04: nome_grupo só aparece/é exigido quando papel='grupo_trabalho' --
                membroCoalizaoSchema (T26) já espelha ck_membro_grupo via .refine(), então
                o gate de habilitação do submit é o próprio form.formState.isValid. */}
            {papelSelecionado === "grupo_trabalho" && (
              <FormField
                control={form.control}
                name="nome_grupo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do grupo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {mensagem && <p className="text-sm text-red-500">{mensagem}</p>}
            <Button type="submit" disabled={!form.formState.isValid} className="w-fit">
              Adicionar membro
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
