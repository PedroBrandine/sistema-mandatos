"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { preInsightSchema, type PreInsightInput } from "@backend/schemas/pre-insight";
import { createClient } from "@backend/supabase/client";
import { usePapelGlobal } from "@/hooks/use-papel-global";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// FGC-05 (T18, fatos-geradores-ciclo-vida). INSERT direto em fat_pre_insight
// (sem RPC, mesmo padrão de registro-form.tsx -- 1 tabela só, sem invariante
// multi-tabela que justifique AD-024). Autor resolvido por usePapelGlobal,
// nunca digitado no formulário (spec.md P1 "Pré-Insight como entidade" AC2):
// a RLS (p_por_contrato, WITH CHECK) rejeitaria qualquer id_usuario_autor
// que o form tentasse enviar diferente do usuário da sessão.
export interface PreInsightFormProps {
  idContrato: number;
  onConcluido: () => void;
}

export function PreInsightForm({ idContrato, onConcluido }: PreInsightFormProps) {
  const { idUsuario, carregando: carregandoUsuario } = usePapelGlobal();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<PreInsightInput>({
    resolver: zodResolver(preInsightSchema),
    mode: "onChange",
    defaultValues: { id_contrato: idContrato, conteudo: "" },
  });

  async function enviar(valores: PreInsightInput) {
    if (!idUsuario) {
      setErro("Não foi possível identificar o usuário autor. Recarregue a página e tente novamente.");
      return;
    }

    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const { error } = await supabase.from("fat_pre_insight").insert({
      id_contrato: valores.id_contrato,
      conteudo: valores.conteudo,
      ocorrido_em: valores.ocorrido_em ?? undefined,
      id_usuario_autor: idUsuario,
    });

    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }

    form.reset({ id_contrato: idContrato, conteudo: "" });
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        <FormField
          control={form.control}
          name="conteudo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ocorrido_em"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data (opcional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {erro && <ErroInline mensagem={erro} />}
        <div>
          <Button type="submit" disabled={enviando || carregandoUsuario || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Criar Pré-Insight"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
