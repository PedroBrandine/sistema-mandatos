"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DuplicataDetectadaError } from "@backend/rpc/errors";
import { criarCoalizao } from "@backend/rpc/coalizao";
import { coalizaoSchema } from "@backend/schemas/coalizao";
import { contratanteSchema } from "@backend/schemas/contratante";
import { createClient } from "@backend/supabase/client";
import type { CoalizaoCriada, ContratanteSimilar } from "@backend/types/fundacao";

import { ContratanteFields } from "@/components/fundacao/contratante-fields";
import { DuplicataWarningDialog } from "@/components/fundacao/duplicata-warning-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RefOption {
  id: number;
  nome: string;
}

const criarCoalizaoFormSchema = z.object({
  contratante: contratanteSchema,
  coalizao: coalizaoSchema,
});
type CriarCoalizaoFormValues = z.infer<typeof criarCoalizaoFormSchema>;

export interface CoalizaoFormProps {
  onCriada: (coalizao: CoalizaoCriada) => void;
}

// Cadastro de coalizão (FND-COL-01): cria dim_contratante+dim_coalizao numa
// transação (criarCoalizao, T28), mesma checagem de duplicata de
// criarMandato. Reusa ContratanteFields (T29) e DuplicataWarningDialog (T30).
export function CoalizaoForm({ onCriada }: CoalizaoFormProps) {
  const [projetos, setProjetos] = useState<RefOption[]>([]);
  const [similares, setSimilares] = useState<ContratanteSimilar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<CriarCoalizaoFormValues>({
    resolver: zodResolver(criarCoalizaoFormSchema),
    mode: "onChange",
    defaultValues: { contratante: { nome: "" }, coalizao: { possui_planejamento_proprio: false } },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_projeto")
      .select("id_projeto, nome")
      .eq("ativo", true)
      .then(({ data }) => setProjetos((data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }))));
  }, []);

  async function enviar(valores: CriarCoalizaoFormValues, ignorarDuplicata = false) {
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const resultado = await criarCoalizao(supabase, {
        contratante: valores.contratante,
        coalizao: valores.coalizao,
        ignorarDuplicata,
      });
      setSimilares(null);
      onCriada(resultado);
    } catch (e) {
      if (e instanceof DuplicataDetectadaError) {
        setSimilares(e.similares);
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao cadastrar coalizão.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => enviar(v))} className="grid gap-6">
          <ContratanteFields control={form.control} />
          <FormField
            control={form.control}
            name="coalizao.id_projeto_origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projeto de origem</FormLabel>
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
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
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
            name="coalizao.possui_planejamento_proprio"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4"
                  />
                </FormControl>
                <FormLabel className="!mt-0">Possui planejamento próprio</FormLabel>
              </FormItem>
            )}
          />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <Button type="submit" disabled={enviando} className="w-fit">
            {enviando ? "Salvando..." : "Cadastrar coalizão"}
          </Button>
        </form>
      </Form>
      {similares && (
        <DuplicataWarningDialog
          candidatos={similares}
          onConfirmar={() => void enviar(form.getValues(), true)}
          onCancelar={() => setSimilares(null)}
        />
      )}
    </>
  );
}
