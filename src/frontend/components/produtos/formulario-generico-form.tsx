"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  buscarMetricasAtivas,
  buscarSubmissaoPropria,
  type MetricaFormulario,
  type Submissao,
} from "@backend/queries/formulario";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { Json } from "@backend/supabase/database.types";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface FormularioGenericoFormProps {
  idContrato: number;
  idFormulario: number;
  codigo: string;
  respondentePermitido: boolean;
}

interface DetalheFormulario {
  estado: "aberto" | "fechado";
  exigeAnexo: boolean;
  permiteEdicaoAberta: boolean;
  versaoFormulario: number;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatarValor(valor: unknown, tipo: string): string {
  if (valor === null || valor === undefined) return "—";
  if (tipo === "booleano") return valor ? "Sim" : "Não";
  return String(valor);
}

function campoZod(tipo: string) {
  if (tipo === "escala_0_10") return z.number().int().min(0).max(10);
  if (tipo === "escala_1_5") return z.number().int().min(1).max(5);
  if (tipo === "booleano") return z.boolean();
  return z.number(); // "numero" e qualquer tipo não mapeado (fallback conservador)
}

// FRM-04, FRM-05, FRM-07, FRM-09, FRM-10, FRM-11 (design.md
// "FormularioGenericoForm"). Cobre os 13 formulários sem forma fixa -- Zod
// schema construído em runtime a partir de ref_metrica_formulario (T14,
// buscarMetricasAtivas), nunca um schema fixo em backend/schemas (design.md,
// Components: "schema dinâmico em vez de fixo").
//
// idContrato/idFormulario resolvem estado/exigeAnexo/permiteEdicaoAberta/versao
// por conta própria (join rel_formulario_contrato+ref_formulario, mesmo
// padrão de buscarFormulariosDoContrato mas escopado a 1 formulário) --
// design.md não listava esses 3 campos como prop, e a rota (T19) já paga o
// custo de 1 fetch da lista inteira; refazer aqui evita replumbing e mantém a
// assinatura de design.md intacta (idContrato, idFormulario, codigo,
// respondentePermitido).
export function FormularioGenericoForm({
  idContrato,
  idFormulario,
  codigo,
  respondentePermitido,
}: FormularioGenericoFormProps) {
  const { papel, idUsuario, carregando: carregandoPapel } = usePapelGlobal();
  const podeAdministrar = papel === "admin" || papel === "gestora";

  const detalheQuery = useQuery({
    queryKey: ["formulario-detalhe", idContrato, idFormulario],
    queryFn: async (): Promise<DetalheFormulario> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("rel_formulario_contrato")
        .select("estado, ref_formulario(exige_anexo, permite_edicao_aberta, versao)")
        .eq("id_contrato", idContrato)
        .eq("id_formulario", idFormulario)
        .single();
      if (error) throw mapeiaErroRpc(error);

      const formulario = data.ref_formulario as unknown as {
        exige_anexo: boolean;
        permite_edicao_aberta: boolean;
        versao: number;
      };
      return {
        estado: data.estado as "aberto" | "fechado",
        exigeAnexo: formulario.exige_anexo,
        permiteEdicaoAberta: formulario.permite_edicao_aberta,
        versaoFormulario: formulario.versao,
      };
    },
  });

  const metricasQuery = useQuery({
    queryKey: ["formulario-metricas", idFormulario],
    queryFn: () => buscarMetricasAtivas(createClient(), idFormulario),
  });

  const submissaoQuery = useQuery({
    queryKey: ["formulario-submissao-propria", idContrato, idFormulario, idUsuario],
    queryFn: () => buscarSubmissaoPropria(createClient(), idContrato, idFormulario, idUsuario as number, null),
    enabled: idUsuario != null,
  });

  if (
    carregandoPapel ||
    detalheQuery.isLoading ||
    metricasQuery.isLoading ||
    (idUsuario != null && submissaoQuery.isLoading)
  ) {
    return <CarregandoSkeleton variante="list" />;
  }

  if (detalheQuery.isError || metricasQuery.isError || submissaoQuery.isError) {
    return (
      <ErroInline
        mensagem="Não foi possível carregar este formulário."
        onRetry={() => {
          void detalheQuery.refetch();
          void metricasQuery.refetch();
          void submissaoQuery.refetch();
        }}
      />
    );
  }

  const detalhe = detalheQuery.data as DetalheFormulario;
  const metricas = metricasQuery.data ?? [];
  const minhaSubmissao = submissaoQuery.data ?? null;

  // FRM-05: sem métrica ativa -- bloqueio, sem botão de envio.
  if (metricas.length === 0) {
    return (
      <EstadoVazio
        titulo="Formulário sem campos configurados"
        mensagem="Este formulário ainda não tem campos configurados."
      />
    );
  }

  // FRM-09: formulário fechado bloqueia o respondente comum; Gestora/Admin
  // continuam podendo visualizar/gerenciar.
  if (detalhe.estado === "fechado" && !podeAdministrar) {
    return <EstadoVazio titulo="Formulário fechado" mensagem="Este formulário está fechado no momento." />;
  }

  if (!minhaSubmissao && !respondentePermitido) {
    return (
      <EstadoVazio
        titulo="Você não é o respondente deste formulário"
        mensagem="Nenhuma resposta foi enviada ainda para este formulário."
      />
    );
  }

  return (
    <FormularioGenericoCampos
      idContrato={idContrato}
      idFormulario={idFormulario}
      codigo={codigo}
      metricas={metricas}
      minhaSubmissao={minhaSubmissao}
      detalhe={detalhe}
      podeAdministrar={podeAdministrar}
      idUsuario={idUsuario as number}
    />
  );
}

interface CamposProps {
  idContrato: number;
  idFormulario: number;
  codigo: string;
  metricas: MetricaFormulario[];
  minhaSubmissao: Submissao | null;
  detalhe: DetalheFormulario;
  podeAdministrar: boolean;
  idUsuario: number;
}

// Estados (b)/(c) de design.md: formulário editável (1º envio ou reenvio) ou
// somente leitura -- só existe depois que o pai já garantiu que há métrica
// ativa e que o usuário pode estar aqui (FRM-09/FRM-05/respondentePermitido).
// Schema Zod isolado neste componente-filho (não no pai) de propósito: o
// schema depende de `metricas` (só disponível depois do fetch) -- useForm só
// pode ser chamado 1x por instância de componente, então a instância nasce
// aqui já com o schema final, sem reset condicional.
function FormularioGenericoCampos({
  idContrato,
  idFormulario,
  metricas,
  minhaSubmissao,
  detalhe,
  podeAdministrar,
  idUsuario,
}: CamposProps) {
  const queryClient = useQueryClient();
  const [reaberto, setReaberto] = useState(false);

  // FRM-10/FRM-11: editável se nunca respondeu, se permite_edicao_aberta=true,
  // ou se Gestora/Admin explicitamente reabriu.
  const somenteLeitura = minhaSubmissao != null && !detalhe.permiteEdicaoAberta && !(podeAdministrar && reaberto);

  const shape: Record<string, z.ZodTypeAny> = Object.fromEntries(
    metricas.map((m) => [m.codigoCampo, campoZod(m.tipo)])
  );
  if (detalhe.exigeAnexo) {
    // FRM-07: aceite obrigatório antes de habilitar o envio.
    shape.aceite = z.boolean().refine((v) => v === true, { message: "É necessário aceitar para enviar." });
  }
  const schema = z.object(shape);

  const respostasExistentes = (minhaSubmissao?.respostas ?? {}) as Record<string, unknown>;
  const defaultValues: Record<string, unknown> = {};
  for (const m of metricas) {
    defaultValues[m.codigoCampo] = respostasExistentes[m.codigoCampo] ?? (m.tipo === "booleano" ? false : undefined);
  }
  if (detalhe.exigeAnexo) {
    defaultValues.aceite = minhaSubmissao?.aceiteEm != null;
  }

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema) as Resolver<Record<string, unknown>>,
    mode: "onChange",
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: async (valores: Record<string, unknown>) => {
      const supabase = createClient();
      const respostas: Record<string, unknown> = {};
      for (const m of metricas) respostas[m.codigoCampo] = valores[m.codigoCampo];
      const agora = new Date().toISOString();

      if (minhaSubmissao) {
        // FRM-10: reenvio -- update pela mesma linha (id_submissao já lido),
        // nunca upsert (design.md, Risks -- índice de destino é parcial/expressão).
        const { error } = await supabase
          .from("fat_submissao")
          .update({
            respostas: respostas as Json,
            atualizada_em: agora,
            ...(detalhe.exigeAnexo ? { aceite_em: agora } : {}),
          })
          .eq("id_submissao", minhaSubmissao.idSubmissao);
        if (error) throw mapeiaErroRpc(error);
        return;
      }

      // FRM-06: 1º envio -- insert direto.
      const { error } = await supabase.from("fat_submissao").insert({
        id_contrato: idContrato,
        id_formulario: idFormulario,
        versao_formulario: detalhe.versaoFormulario,
        id_usuario_respondente: idUsuario,
        respostas: respostas as Json,
        ...(detalhe.exigeAnexo ? { aceite_em: agora } : {}),
      });
      if (error) throw mapeiaErroRpc(error);
    },
    onSuccess: () => {
      toast.success("Resposta enviada com sucesso.");
      setReaberto(false);
      void queryClient.invalidateQueries({ queryKey: ["formulario-submissao-propria", idContrato, idFormulario, idUsuario] });
      void queryClient.invalidateQueries({ queryKey: ["formularios-contrato", idContrato] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (somenteLeitura) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Resposta já enviada em {formatarData((minhaSubmissao as Submissao).enviadaEm)}.
        </p>
        <dl className="grid gap-2 rounded-lg border p-4">
          {metricas.map((m) => (
            <div key={m.idMetrica} className="grid grid-cols-[1fr_auto] gap-2">
              <dt className="text-sm text-muted-foreground">{m.rotulo}</dt>
              <dd className="text-sm font-medium">{formatarValor(respostasExistentes[m.codigoCampo], m.tipo)}</dd>
            </div>
          ))}
        </dl>
        {podeAdministrar && (
          <Button type="button" variant="outline" onClick={() => setReaberto(true)}>
            Reabrir para editar
          </Button>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
        {metricas.map((m) => (
          <FormField
            key={m.idMetrica}
            control={form.control}
            name={m.codigoCampo}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.rotulo}</FormLabel>
                <FormControl>
                  {m.tipo === "escala_0_10" || m.tipo === "escala_1_5" ? (
                    <Select
                      value={field.value != null ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: m.tipo === "escala_0_10" ? 11 : 5 },
                          (_, i) => (m.tipo === "escala_0_10" ? 0 : 1) + i
                        ).map((opcao) => (
                          <SelectItem key={opcao} value={String(opcao)}>
                            {opcao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : m.tipo === "booleano" ? (
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  ) : (
                    <Input
                      type="number"
                      value={field.value == null ? "" : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {detalhe.exigeAnexo && (
          <FormField
            control={form.control}
            name="aceite"
            render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 font-normal">
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  Li e concordo
                </Label>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending || !form.formState.isValid}>
            {mutation.isPending ? "Enviando..." : "Enviar"}
          </Button>
          {podeAdministrar && reaberto && (
            <Button type="button" variant="outline" onClick={() => setReaberto(false)}>
              Cancelar reabertura
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
